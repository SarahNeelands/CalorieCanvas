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

async function createAuthenticatedUser(pool, email) {
  const userId = crypto.randomUUID();
  const sessionId = generateSecret();
  const csrfToken = generateSecret();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, must_reset_password, email_verified_at)
     VALUES ($1, $2, 'test-hash', false, now())`,
    [userId, email]
  );
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, now() + interval '1 day', $3)`,
    [digestSecret(sessionId), JSON.stringify({ userId, csrfDigest: digestSecret(csrfToken) }), userId]
  );
  return { userId, csrfToken, cookie: `cc_session=${sessionId}; cc_csrf=${csrfToken}` };
}

async function request(baseUrl, path, { body, cookie, csrfToken, method = 'GET' } = {}) {
  const headers = { origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  return fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createHarness() {
  const schema = `meal_log_${crypto.randomUUID().replaceAll('-', '')}`;
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

function snapshot(overrides = {}) {
  return {
    id: null, title: 'Ad Hoc Food', type: 'meal', item_type: 'meal', unit_conversions: {},
    food_id: null, kcal_per_100g: 100, protein_g_per_100g: 5,
    carbs_g_per_100g: 10, fat_g_per_100g: 2, ...overrides,
  };
}

function entryInput(overrides = {}) {
  return {
    meal_id: null,
    item_snapshot: snapshot(),
    food_id: null,
    qty: 100,
    unit_code: 'g',
    grams_resolved: 100,
    logged_at: '2026-03-08T06:30:00.000Z',
    log_date: '2026-03-08',
    timezone_offset_minutes: -300,
    meal_type: 'breakfast',
    kcal: 100,
    protein_g: 5,
    carbs_g: 10,
    fat_g: 2,
    fiber_g: 3,
    sugar_g: 1,
    cholesterol_mg: 4,
    micros: { sodium: 10, potassium: 20, calcium: 30, iron: 1, vitaminA: 40, vitaminC: 5 },
    ...overrides,
  };
}

async function createEntry(harness, user, body) {
  const response = await request(harness.baseUrl, '/api/meal-logs/entries', {
    method: 'POST', cookie: user.cookie, csrfToken: user.csrfToken, body,
  });
  return { response, payload: response.status === 204 ? null : await response.json() };
}

integrationTest('meal-log schema has explicit snapshots, dates, ownership, constraints, indexes, and trigger', async () => {
  const harness = await createHarness();
  try {
    const columns = await harness.pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'meal_logs'`
    );
    const names = columns.rows.map((row) => row.column_name);
    for (const required of [
      'meal_id', 'item_snapshot', 'log_date', 'timezone_offset_minutes', 'meal_type', 'position',
      'fiber_g', 'sodium_mg', 'vitamin_a_mcg', 'created_at', 'updated_at',
    ]) assert.ok(names.includes(required), required);
    const indexes = await harness.pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'meal_logs'`
    );
    const indexNames = indexes.rows.map((row) => row.indexname);
    for (const required of ['idx_meal_logs_user_logged_at', 'idx_meal_logs_user_day', 'idx_meal_logs_catalog_reference']) {
      assert.ok(indexNames.includes(required), required);
    }
    const foreignKeys = await harness.pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'meal_logs'::regclass AND contype = 'f'`
    );
    assert.deepEqual(foreignKeys.rows.map((row) => row.conname), ['meal_logs_user_id_fkey']);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('meal-log reads and writes preserve snapshots, nested shapes, dates, totals, and catalog sources', async () => {
  const harness = await createHarness();
  try {
    const user = await createAuthenticatedUser(harness.pool, 'meal-log@example.com');
    const userCatalogId = crypto.randomUUID();
    await harness.pool.query(
      `INSERT INTO meals (
         id, user_id, title, type, kcal_per_100g, protein_g_per_100g,
         carbs_g_per_100g, fat_g_per_100g, unit_conversions
       ) VALUES ($1, $2, 'Original Oatmeal', 'meal', 120, 4, 21, 2, '{"brand":"Old"}')`,
      [userCatalogId, user.userId]
    );
    await harness.pool.query(
      `INSERT INTO shared_catalog_items (
         id, title, type, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g
       ) VALUES ('seed-broccoli', 'Broccoli', 'ingredient', 34, 2.8, 6.6, 0.4)`
    );

    assert.equal((await request(harness.baseUrl, '/api/meal-logs?limit=3')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/meal-logs/entries', {
      method: 'POST', cookie: user.cookie, body: entryInput(),
    })).status, 403);
    const empty = await request(harness.baseUrl, '/api/meal-logs/days/2026-03-08', { cookie: user.cookie });
    assert.deepEqual((await empty.json()).data, {
      date: '2026-03-08', meals: [],
      totals: {
        calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0,
        cholesterol_mg: 0, sodium_mg: 0, potassium_mg: 0, calcium_mg: 0, iron_mg: 0,
        vitamin_a_mcg: 0, vitamin_c_mg: 0, count: 0,
      },
    });

    const userEntry = await createEntry(harness, user, entryInput({
      meal_id: userCatalogId, item_snapshot: undefined, kcal: 240, protein_g: 8,
      carbs_g: 42, fat_g: 4,
    }));
    assert.equal(userEntry.response.status, 201);
    assert.equal(userEntry.payload.data.catalog_source, 'user');
    assert.equal(userEntry.payload.data.meal.title, 'Original Oatmeal');
    assert.equal(userEntry.payload.data.meal_id, userCatalogId);

    const sharedEntry = await createEntry(harness, user, entryInput({
      meal_id: 'seed-broccoli', item_snapshot: undefined, meal_type: 'lunch',
      logged_at: '2026-03-08T07:30:00.000Z', timezone_offset_minutes: -240,
    }));
    assert.equal(sharedEntry.payload.data.catalog_source, 'shared');
    assert.equal(sharedEntry.payload.data.log_date, '2026-03-08');

    const adHocEntry = await createEntry(harness, user, entryInput({
      meal_type: 'dinner', logged_at: '2026-03-09T02:30:00.000Z',
      log_date: '2026-03-08', timezone_offset_minutes: -240,
    }));
    assert.equal(adHocEntry.payload.data.catalog_source, 'ad_hoc');

    await harness.pool.query(
      `UPDATE meals SET title = 'Changed Later', kcal_per_100g = 999 WHERE id = $1`,
      [userCatalogId]
    );
    const quantityEdit = await request(harness.baseUrl, `/api/meal-logs/entries/${userEntry.payload.data.id}`, {
      method: 'PUT', cookie: user.cookie, csrfToken: user.csrfToken,
      body: { qty: 150, grams_resolved: 150, kcal: 180, protein_g: 6, carbs_g: 31.5, fat_g: 3 },
    });
    assert.equal((await quantityEdit.json()).data.meal.title, 'Original Oatmeal');
    const populated = await request(harness.baseUrl, '/api/meal-logs/days/2026-03-08', { cookie: user.cookie });
    const day = (await populated.json()).data;
    assert.equal(day.date, '2026-03-08');
    assert.deepEqual(day.meals.map((section) => section.meal_type), ['breakfast', 'lunch', 'dinner']);
    assert.equal(day.meals[0].entries[0].meal.title, 'Original Oatmeal');
    assert.equal(day.totals.calories, 380);
    assert.equal(day.totals.count, 3);
    assert.equal(day.totals.sodium_mg, 30);

    const summary = await request(harness.baseUrl, '/api/meal-logs/summary', { cookie: user.cookie });
    assert.deepEqual((await summary.json()).data, [{ date: '2026-03-08', total_kcal: 380 }]);
    assert.equal((await request(harness.baseUrl, '/api/meal-logs/summary')).status, 401);

    const range = await request(
      harness.baseUrl,
      '/api/meal-logs?start_date=2026-03-08&end_date=2026-03-09&limit=50',
      { cookie: user.cookie }
    );
    assert.equal((await range.json()).data.length, 3);

    await harness.pool.query('UPDATE meals SET archived_at = now() WHERE id = $1', [userCatalogId]);
    const archived = await createEntry(harness, user, entryInput({
      meal_id: userCatalogId, item_snapshot: undefined, logged_at: '2026-03-08T10:00:00.000Z',
      timezone_offset_minutes: -240,
    }));
    assert.equal(archived.response.status, 201);
    await harness.pool.query('DELETE FROM meals WHERE id = $1', [userCatalogId]);
    const historical = await createEntry(harness, user, entryInput({
      meal_id: userCatalogId,
      item_snapshot: snapshot({ id: userCatalogId, title: 'Deleted Historical Item' }),
      logged_at: '2026-03-08T11:00:00.000Z', timezone_offset_minutes: -240,
    }));
    assert.equal(historical.payload.data.catalog_source, 'historical');
    assert.equal(historical.payload.data.meal.title, 'Deleted Historical Item');
  } finally {
    await harness.cleanup();
  }
});

integrationTest('meal-log updates, moves, ordering, deletion, validation, isolation, and rollback are enforced', async () => {
  const harness = await createHarness();
  try {
    const first = await createAuthenticatedUser(harness.pool, 'meal-owner@example.com');
    const second = await createAuthenticatedUser(harness.pool, 'meal-other@example.com');
    const one = (await createEntry(harness, first, entryInput({ position: 0 }))).payload.data;
    const two = (await createEntry(harness, first, entryInput({
      item_snapshot: snapshot({ title: 'Second' }), position: 1,
    }))).payload.data;
    const other = (await createEntry(harness, second, entryInput())).payload.data;

    assert.equal((await request(harness.baseUrl, `/api/meal-logs/entries/${other.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken, body: { qty: 2 },
    })).status, 404);
    assert.equal((await request(harness.baseUrl, `/api/meal-logs/entries/${other.id}`, {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    })).status, 404);
    assert.equal((await request(harness.baseUrl, '/api/meal-logs/entries', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: entryInput({ user_id: second.userId }),
    })).status, 400);

    const updated = await request(harness.baseUrl, `/api/meal-logs/entries/${one.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { qty: 2, unit_code: 'oz', grams_resolved: 56.699, kcal: 56 },
    });
    const updatedEntry = (await updated.json()).data;
    assert.equal(updatedEntry.qty, 2);
    assert.equal(updatedEntry.unit_code, 'oz');

    const moved = await request(harness.baseUrl, `/api/meal-logs/entries/${two.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { meal_type: 'dinner', position: 0 },
    });
    assert.equal((await moved.json()).data.meal_type, 'dinner');
    const ordered = await request(harness.baseUrl, '/api/meal-logs/days/2026-03-08', { cookie: first.cookie });
    const orderedDay = (await ordered.json()).data;
    assert.deepEqual(orderedDay.meals.map((section) => section.meal_type), ['breakfast', 'dinner']);
    assert.deepEqual(orderedDay.meals[0].entries.map((entry) => entry.position), [0]);

    const retimed = await request(harness.baseUrl, `/api/meal-logs/entries/${two.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: {
        logged_at: '2026-03-09T04:30:00.000Z', log_date: '2026-03-09',
        timezone_offset_minutes: -240,
      },
    });
    const retimedEntry = (await retimed.json()).data;
    assert.equal(retimedEntry.log_date, '2026-03-09');
    assert.equal(retimedEntry.logged_at, '2026-03-09T04:30:00.000Z');

    for (const invalid of [
      entryInput({ log_date: '2026-03-07' }),
      entryInput({ qty: 0 }),
      entryInput({ unit_code: 'bucket' }),
      entryInput({ kcal: -1 }),
      entryInput({ meal_id: 'bad id' }),
    ]) {
      const response = await createEntry(harness, first, invalid);
      assert.equal(response.response.status, 400);
    }

    const blocker = (await createEntry(harness, first, entryInput({
      item_snapshot: snapshot({ title: 'Blocker' }), position: 0,
    }))).payload.data;
    const rollbackCandidate = (await createEntry(harness, first, entryInput({
      item_snapshot: snapshot({ title: 'Rollback Candidate' }), meal_type: 'other', position: 0,
    }))).payload.data;
    await harness.pool.query(`
      CREATE FUNCTION reject_meal_log_reorder() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.id = '${blocker.id}'::uuid AND NEW.position <> OLD.position THEN
          RAISE EXCEPTION 'deliberate meal-log reorder failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER reject_meal_log_reorder BEFORE UPDATE ON meal_logs
      FOR EACH ROW EXECUTE FUNCTION reject_meal_log_reorder();
    `);
    const rollback = await request(harness.baseUrl, `/api/meal-logs/entries/${rollbackCandidate.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { meal_type: 'breakfast', position: 0 },
    });
    assert.equal(rollback.status, 500);
    const stillOther = await harness.pool.query('SELECT meal_type, position FROM meal_logs WHERE id = $1', [rollbackCandidate.id]);
    assert.deepEqual(stillOther.rows[0], { meal_type: 'other', position: 0 });
    await harness.pool.query('DROP TRIGGER reject_meal_log_reorder ON meal_logs');

    const deleted = await request(harness.baseUrl, `/api/meal-logs/entries/${one.id}`, {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    });
    assert.equal(deleted.status, 204);
    assert.equal((await request(harness.baseUrl, `/api/meal-logs/entries/${one.id}`, {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    })).status, 404);

    assert.equal((await request(harness.baseUrl, '/api/meal-logs/day/2026-03-09', {
      method: 'DELETE', cookie: first.cookie,
    })).status, 403);
    assert.equal((await request(harness.baseUrl, '/api/meal-logs/day/2026-03-09', {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    })).status, 204);
    const otherUserCount = await harness.pool.query(
      'SELECT count(*)::integer AS count FROM meal_logs WHERE user_id=$1', [second.userId]
    );
    assert.equal(otherUserCount.rows[0].count, 1);
  } finally {
    await harness.cleanup();
  }
});
