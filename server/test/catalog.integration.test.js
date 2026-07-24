const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { Pool } = require('pg');
const { createApp } = require('../app');
const { runMigrations } = require('../migrations/run');
const { digestSecret, generateSecret } = require('../utils/security');

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const origin = 'http://127.0.0.1:3000';
const silentLogger = { info() {}, error() {} };

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function catalogInput(overrides = {}) {
  return {
    title: 'Oatmeal',
    item_type: 'meal',
    kcal_per_100g: 120,
    protein_g_per_100g: 4.5,
    carbs_g_per_100g: 21,
    fat_g_per_100g: 2.5,
    unit_conversions: { serving_size: { qty: 100, unit: 'g' } },
    food_id: null,
    ...overrides,
  };
}

async function createAuthenticatedUser(pool, email) {
  const userId = crypto.randomUUID();
  const rawSessionId = generateSecret();
  const rawCsrfToken = generateSecret();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, must_reset_password, email_verified_at)
     VALUES ($1, $2, 'test-hash', false, now())`,
    [userId, email]
  );
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, now() + interval '1 day', $3)`,
    [digestSecret(rawSessionId), JSON.stringify({ userId, csrfDigest: digestSecret(rawCsrfToken) }), userId]
  );
  return {
    userId,
    csrfToken: rawCsrfToken,
    cookie: `cc_session=${rawSessionId}; cc_csrf=${rawCsrfToken}`,
  };
}

async function request(baseUrl, path, { body, cookie, csrfToken, method = 'GET' } = {}) {
  const headers = { origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createHarness() {
  const schema = `catalog_${crypto.randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` });
  await runMigrations({ pool });
  const app = createApp({
    authPool: pool,
    databaseClient: { async checkDatabase() {} },
    logger: silentLogger,
    authConfig: {
      appOrigins: [origin], bcryptRounds: 4, cookieName: 'cc_session', csrfCookieName: 'cc_csrf',
      cookieSecure: false, sessionTtlHours: 24, sessionRenewalThresholdHours: 12,
      passwordResetTtlMinutes: 60, emailVerificationTtlMinutes: 60,
      rateLimits: { windowMinutes: 15, login: 100, signup: 100, passwordAction: 100 },
    },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  return {
    pool,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async cleanup() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${quoteIdentifier(schema)} CASCADE`);
      await adminPool.end();
    },
  };
}

integrationTest('catalog schema defines ownership, data constraints, triggers, and indexes', async () => {
  const harness = await createHarness();
  try {
    const tables = await harness.pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name IN ('meals', 'shared_catalog_items', 'catalog_sync_operations')`
    );
    assert.deepEqual(tables.rows.map((row) => row.table_name).sort(), [
      'catalog_sync_operations', 'meals', 'shared_catalog_items',
    ]);
    const indexes = await harness.pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = current_schema() AND tablename IN ('meals', 'shared_catalog_items', 'catalog_sync_operations')`
    );
    const names = indexes.rows.map((row) => row.indexname);
    for (const expected of [
      'idx_meals_user_type_created', 'idx_meals_user_updated', 'idx_meals_user_food_id',
      'idx_meals_title_search', 'idx_shared_catalog_type_created',
      'idx_shared_catalog_title_search', 'idx_catalog_sync_operations_created',
      'idx_catalog_sync_operations_user_created',
    ]) assert.ok(names.includes(expected), expected);

    const user = await createAuthenticatedUser(harness.pool, 'constraints@example.com');
    await assert.rejects(
      harness.pool.query(
        `INSERT INTO meals (user_id, title, type, kcal_per_100g) VALUES ($1, 'Bad', 'unknown', 1)`,
        [user.userId]
      ),
      (error) => error.code === '23514' && error.constraint === 'meals_type_check'
    );
    const inserted = await harness.pool.query(
      `INSERT INTO meals (user_id, title, type) VALUES ($1, 'Trigger', 'meal') RETURNING id, updated_at`,
      [user.userId]
    );
    await harness.pool.query(
      `UPDATE meals SET updated_at = updated_at - interval '1 day' WHERE id = $1`,
      [inserted.rows[0].id]
    );
    const updated = await harness.pool.query('SELECT updated_at FROM meals WHERE id = $1', [inserted.rows[0].id]);
    assert.ok(updated.rows[0].updated_at >= inserted.rows[0].updated_at);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('catalog CRUD enforces authentication, CSRF, validation, ownership, shared immutability, and filters', async () => {
  const harness = await createHarness();
  try {
    const first = await createAuthenticatedUser(harness.pool, 'catalog-one@example.com');
    const second = await createAuthenticatedUser(harness.pool, 'catalog-two@example.com');
    await harness.pool.query(
      `INSERT INTO shared_catalog_items (
         id, title, type, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g
       ) VALUES ('seed-broccoli', 'Broccoli', 'ingredient', 34, 2.8, 6.6, 0.4)`
    );

    assert.equal((await request(harness.baseUrl, '/api/catalog/items?item_type=meal')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', body: catalogInput(),
    })).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, body: catalogInput(),
    })).status, 403);

    const createdResponse = await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken, body: catalogInput(),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.user_id, first.userId);
    assert.equal(created.item_type, 'meal');
    assert.equal(created.type, 'meal');
    assert.equal(created.kcal_per_100g, 120);
    assert.equal(created.is_shared, false);

    const read = await request(harness.baseUrl, `/api/catalog/items/${created.id}`, { cookie: first.cookie });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).data.title, 'Oatmeal');
    assert.equal((await request(harness.baseUrl, `/api/catalog/items/${created.id}`, { cookie: second.cookie })).status, 404);
    assert.equal((await request(harness.baseUrl, `/api/catalog/items/${created.id}`, {
      method: 'PUT', cookie: second.cookie, csrfToken: second.csrfToken,
      body: catalogInput({ title: 'Cross-user update' }),
    })).status, 404);

    const updatedResponse = await request(harness.baseUrl, `/api/catalog/items/${created.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ title: 'Apple Oatmeal', base_updated_at: created.updated_at }),
    });
    assert.equal(updatedResponse.status, 200);
    assert.equal((await updatedResponse.json()).data.title, 'Apple Oatmeal');

    const filtered = await request(
      harness.baseUrl,
      '/api/catalog/items?item_type=meal&query=apple&limit=20',
      { cookie: first.cookie }
    );
    assert.deepEqual((await filtered.json()).data.map((item) => item.title), ['Apple Oatmeal']);
    const shared = await request(
      harness.baseUrl,
      '/api/catalog/items?item_type=ingredient&query=broc',
      { cookie: first.cookie }
    );
    const sharedItem = (await shared.json()).data[0];
    assert.equal(sharedItem.id, 'seed-broccoli');
    assert.equal(sharedItem.user_id, '__shared_catalog__');
    assert.equal(sharedItem.is_shared, true);
    assert.equal((await request(harness.baseUrl, '/api/catalog/items/seed-broccoli', {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ item_type: 'ingredient' }),
    })).status, 404);

    assert.equal((await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ user_id: second.userId }),
    })).status, 400);
    assert.equal((await request(harness.baseUrl, `/api/catalog/items?item_type=meal&user_id=${second.userId}`, {
      cookie: first.cookie,
    })).status, 400);
    assert.equal((await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ arbitrary_column: true }),
    })).status, 400);
    assert.equal((await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ kcal_per_100g: -1 }),
    })).status, 400);

    const archived = await request(harness.baseUrl, `/api/catalog/items/${created.id}/archive`, {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
    });
    assert.equal(archived.status, 200);
    assert.ok((await archived.json()).data.archived_at);
    const afterArchive = await request(harness.baseUrl, '/api/catalog/items?item_type=meal', { cookie: first.cookie });
    assert.equal((await afterArchive.json()).data.length, 0);

    const deletable = (await (await request(harness.baseUrl, '/api/catalog/items', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: catalogInput({ title: 'Delete Me' }),
    })).json()).data;
    assert.equal((await request(harness.baseUrl, `/api/catalog/items/${deletable.id}`, {
      method: 'DELETE', cookie: second.cookie, csrfToken: second.csrfToken,
    })).status, 404);
    assert.equal((await request(harness.baseUrl, `/api/catalog/items/${deletable.id}`, {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    })).status, 204);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('catalog sync is idempotent, classifies failures, detects conflicts, and rolls back item plus ledger', async () => {
  const harness = await createHarness();
  try {
    const user = await createAuthenticatedUser(harness.pool, 'catalog-sync@example.com');
    const operationId = crypto.randomUUID();
    const operation = {
      operationId, kind: 'create', tempId: 'local-one', input: catalogInput({ title: 'Synced Meal' }),
    };
    const first = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken, body: { operations: [operation] },
    });
    const firstResult = (await first.json()).data.operations[0];
    assert.equal(firstResult.status, 'completed');
    assert.equal(firstResult.tempId, 'local-one');

    const replay = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken, body: { operations: [operation] },
    });
    const replayResult = (await replay.json()).data.operations[0];
    assert.equal(replayResult.itemId, firstResult.itemId);
    assert.equal(replayResult.replayed, true);
    const count = await harness.pool.query(
      `SELECT count(*)::int AS count FROM meals WHERE user_id = $1 AND title = 'Synced Meal'`,
      [user.userId]
    );
    assert.equal(count.rows[0].count, 1);

    const updateOperation = {
      operationId: crypto.randomUUID(), kind: 'update', itemId: firstResult.itemId,
      input: catalogInput({ title: 'Synced Meal Updated', base_updated_at: firstResult.item.updated_at }),
    };
    const updated = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [updateOperation] },
    });
    const updatedResult = (await updated.json()).data.operations[0];
    assert.equal(updatedResult.status, 'completed');
    assert.equal(updatedResult.item.title, 'Synced Meal Updated');

    const stale = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: {
        operations: [{
          ...updateOperation,
          operationId: crypto.randomUUID(),
          input: catalogInput({ title: 'Stale Update', base_updated_at: firstResult.item.updated_at }),
        }],
      },
    });
    const staleResult = (await stale.json()).data.operations[0];
    assert.equal(staleResult.status, 'permanently_invalid');
    assert.equal(staleResult.errorCode, 'conflict');

    const deleteOperation = {
      operationId: crypto.randomUUID(), kind: 'delete', itemId: firstResult.itemId,
    };
    const deleted = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [deleteOperation] },
    });
    assert.equal((await deleted.json()).data.operations[0].status, 'completed');
    const deletedReplay = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [deleteOperation] },
    });
    assert.equal((await deletedReplay.json()).data.operations[0].replayed, true);

    const reused = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [{ ...operation, input: catalogInput({ title: 'Different' }) }] },
    });
    const reusedResult = (await reused.json()).data.operations[0];
    assert.equal(reusedResult.status, 'permanently_invalid');
    assert.equal(reusedResult.errorCode, 'conflict');

    const invalid = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [{ operationId: crypto.randomUUID(), kind: 'create', tempId: 'bad', input: catalogInput({ title: '' }) }] },
    });
    assert.equal((await invalid.json()).data.operations[0].status, 'permanently_invalid');

    await harness.pool.query(`
      CREATE FUNCTION reject_catalog_sync_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'deliberate catalog sync failure'; END;
      $$;
      CREATE TRIGGER reject_catalog_sync_ledger BEFORE INSERT ON catalog_sync_operations
      FOR EACH ROW EXECUTE FUNCTION reject_catalog_sync_ledger();
    `);
    const rollbackOperation = {
      operationId: crypto.randomUUID(), kind: 'create', tempId: 'local-rollback',
      input: catalogInput({ title: 'Must Roll Back' }),
    };
    const rolledBack = await request(harness.baseUrl, '/api/catalog/sync', {
      method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { operations: [rollbackOperation] },
    });
    assert.equal((await rolledBack.json()).data.operations[0].status, 'retryable');
    const rolledBackRows = await harness.pool.query(
      `SELECT count(*)::int AS count FROM meals WHERE user_id = $1 AND title = 'Must Roll Back'`,
      [user.userId]
    );
    assert.equal(rolledBackRows.rows[0].count, 0);
  } finally {
    await harness.cleanup();
  }
});
