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

async function createUser(pool, email, withProfile = true) {
  const userId = crypto.randomUUID();
  const sessionId = generateSecret();
  const csrfToken = generateSecret();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, must_reset_password, email_verified_at)
     VALUES ($1, $2, 'test-hash', false, now())`, [userId, email]
  );
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, now() + interval '1 day', $3)`,
    [digestSecret(sessionId), JSON.stringify({ userId, csrfDigest: digestSecret(csrfToken) }), userId]
  );
  if (withProfile) await pool.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);
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

async function json(response) {
  return response.status === 204 ? null : response.json();
}

async function createHarness() {
  const schema = `weight_${crypto.randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` });
  await runMigrations({ pool });
  const app = createApp({
    authPool: pool, databaseClient: { async checkDatabase() {} }, logger: silentLogger,
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
    pool, baseUrl: `http://127.0.0.1:${server.address().port}`,
    async cleanup() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${quoteIdentifier(schema)} CASCADE`);
      await adminPool.end();
    },
  };
}

async function write(harness, user, path, body, method = 'POST') {
  const response = await request(harness.baseUrl, path, {
    method, body, cookie: user.cookie, csrfToken: user.csrfToken,
  });
  return { response, payload: await json(response) };
}

test('weight validation conversion is exact and rejects invalid values', () => {
  const { KG_PER_POUND, validateDate, validateValue } = require('../utils/weightValidation');
  assert.equal(KG_PER_POUND, 0.45359237);
  assert.equal(validateValue(176.3698, 'lb'), 176.3698);
  assert.equal(validateDate('2025-01-31'), '2025-01-31');
  assert.throws(() => validateDate('2025-02-30'));
  assert.throws(() => validateValue(10, 'kg'));
});

integrationTest('weight schema stores original precision, generated kilograms, imports, indexes, and triggers', async () => {
  const harness = await createHarness();
  try {
    const columns = await harness.pool.query(
      `SELECT column_name, is_generated FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'weights'`
    );
    const byName = Object.fromEntries(columns.rows.map((row) => [row.column_name, row]));
    for (const name of ['value_kg', 'source_record_id', 'updated_at']) assert.ok(byName[name], name);
    assert.equal(byName.value_kg.is_generated, 'ALWAYS');
    const indexes = await harness.pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'weights'`
    );
    assert.ok(indexes.rows.some((row) => row.indexname === 'weights_user_source_record_unique'));
    const triggers = await harness.pool.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'weights'::regclass AND NOT tgisinternal`
    );
    assert.deepEqual(triggers.rows.map((row) => row.tgname), ['weights_set_updated_at']);
    const importFk = await harness.pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'weight_import_operations'::regclass AND contype = 'f'`
    );
    assert.deepEqual(importFk.rows.map((row) => row.conname), ['weight_import_operations_user_id_fkey']);
  } finally { await harness.cleanup(); }
});

integrationTest('weight routes enforce auth, CSRF, validation, ownership, CRUD, ordering, ranges, and profile sync', async () => {
  const harness = await createHarness();
  try {
    const first = await createUser(harness.pool, 'weight-one@example.com');
    const second = await createUser(harness.pool, 'weight-two@example.com');
    assert.equal((await request(harness.baseUrl, '/api/weights')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/weights', {
      method: 'POST', cookie: first.cookie, body: { date: '2025-01-01', value: 80, unit: 'kg' },
    })).status, 403);

    const kg = await write(harness, first, '/api/weights', { date: '2025-01-02', value: 80.123456, unit: 'kg' });
    assert.equal(kg.response.status, 201);
    assert.equal(kg.payload.data.value, 80.123456);
    assert.equal(kg.payload.data.value_kg, 80.123456);
    const pound = await write(harness, first, '/api/weights', { date: '2025-01-02', value: 176.3698, unit: 'lb' });
    assert.equal(pound.response.status, 201);
    assert.ok(Math.abs(pound.payload.data.value_kg - 79.999996) < 0.000002);
    const later = await write(harness, first, '/api/weights', { date: '2025-02-01', value: 79, unit: 'kg' });

    const listResponse = await request(harness.baseUrl, '/api/weights', { cookie: first.cookie });
    const list = (await listResponse.json()).data;
    assert.deepEqual(list.map((item) => item.id), [kg.payload.data.id, pound.payload.data.id, later.payload.data.id]);
    const ranged = await request(harness.baseUrl, '/api/weights?start_date=2025-02-01&end_date=2025-02-01', { cookie: first.cookie });
    assert.deepEqual((await ranged.json()).data.map((item) => item.id), [later.payload.data.id]);
    const latest = await request(harness.baseUrl, '/api/weights/latest', { cookie: first.cookie });
    assert.equal((await latest.json()).data.id, later.payload.data.id);
    assert.equal(Number((await harness.pool.query('SELECT weight_kg FROM profiles WHERE user_id = $1', [first.userId])).rows[0].weight_kg), 79);

    const update = await write(harness, first, `/api/weights/${kg.payload.data.id}`, {
      date: '2025-03-01', value: 170.123456, unit: 'lb',
    }, 'PUT');
    assert.equal(update.response.status, 200);
    assert.equal(update.payload.data.value, 170.123456);
    assert.equal(
      Number((await harness.pool.query('SELECT weight_kg FROM profiles WHERE user_id = $1', [first.userId])).rows[0].weight_kg),
      Number(update.payload.data.value_kg.toFixed(2))
    );

    assert.equal((await write(harness, second, `/api/weights/${kg.payload.data.id}`, { value: 90 }, 'PUT')).response.status, 404);
    assert.equal((await write(harness, second, `/api/weights/${kg.payload.data.id}`, undefined, 'DELETE')).response.status, 404);
    for (const invalid of [
      { date: '2025-02-30', value: 80, unit: 'kg' },
      { date: '2025-01-01', value: 80, unit: 'stone' },
      { date: '2025-01-01', value: 10, unit: 'kg' },
      { date: '2025-01-01', value: 80, unit: 'kg', user_id: second.userId },
    ]) assert.equal((await write(harness, first, '/api/weights', invalid)).response.status, 400);
    assert.equal((await write(harness, first, '/api/weights/not-a-uuid', { value: 80 }, 'PUT')).response.status, 400);

    assert.equal((await write(harness, first, `/api/weights/${kg.payload.data.id}`, undefined, 'DELETE')).response.status, 204);
    assert.equal(Number((await harness.pool.query('SELECT weight_kg FROM profiles WHERE user_id = $1', [first.userId])).rows[0].weight_kg), 79);
    assert.equal((await write(harness, first, `/api/weights/${later.payload.data.id}`, undefined, 'DELETE')).response.status, 204);
    assert.equal(Number((await harness.pool.query('SELECT weight_kg FROM profiles WHERE user_id = $1', [first.userId])).rows[0].weight_kg), 80);
    assert.equal((await write(harness, first, `/api/weights/${pound.payload.data.id}`, undefined, 'DELETE')).response.status, 204);
    assert.equal((await harness.pool.query('SELECT weight_kg FROM profiles WHERE user_id = $1', [first.userId])).rows[0].weight_kg, null);
  } finally { await harness.cleanup(); }
});

integrationTest('summary is neutral in wording and interprets change against the recorded goal', async () => {
  const harness = await createHarness();
  try {
    const user = await createUser(harness.pool, 'summary@example.com');
    await harness.pool.query(
      `UPDATE profiles SET goal_weight_intent = 'normal_loss', target_weight_kg = 75 WHERE user_id = $1`, [user.userId]
    );
    const empty = await request(harness.baseUrl, '/api/weights/summary', { cookie: user.cookie });
    assert.equal((await empty.json()).data.direction, 'no_data');
    await write(harness, user, '/api/weights', { date: '2025-01-01', value: 80, unit: 'kg' });
    await write(harness, user, '/api/weights', { date: '2025-02-01', value: 78, unit: 'kg' });
    await write(harness, user, '/api/weights', { date: '2025-03-01', value: 77, unit: 'kg' });
    const response = await request(harness.baseUrl, '/api/weights/summary?start_date=2025-02-01&end_date=2025-03-01', { cookie: user.cookie });
    const summary = (await response.json()).data;
    assert.equal(summary.startingWeightKg, 80);
    assert.equal(summary.latestWeightKg, 77);
    assert.equal(summary.totalChangeKg, -3);
    assert.equal(summary.direction, 'loss');
    assert.equal(summary.period.changeKg, -1);
    assert.equal(summary.goal.direction, 'toward_goal');
    assert.equal(summary.goal.progressPct, 60);
  } finally { await harness.cleanup(); }
});

integrationTest('browser import reports mixed records, prevents duplicates, preserves stable UUIDs, and replays safely', async () => {
  const harness = await createHarness();
  try {
    const user = await createUser(harness.pool, 'import@example.com');
    const stableId = crypto.randomUUID();
    await write(harness, user, '/api/weights', { date: '2025-01-01', value: 80, unit: 'kg' });
    const operationId = crypto.randomUUID();
    const records = [
      { date: '2025-01-01', value: 80, unit: 'kg' },
      { id: stableId, date: '2025-01-02', value: 175.123456, unit: 'lb' },
      { date: 'not-a-date', value: 79, unit: 'kg' },
    ];
    const imported = await write(harness, user, '/api/weights/import/browser', { operationId, records });
    assert.equal(imported.response.status, 200);
    assert.deepEqual(
      { imported: imported.payload.data.imported, duplicate: imported.payload.data.duplicate, invalid: imported.payload.data.invalid },
      { imported: 1, duplicate: 1, invalid: 1 }
    );
    assert.equal(imported.payload.data.localDataMayBeRemoved, true);
    assert.equal((await harness.pool.query('SELECT id FROM weights WHERE user_id = $1 AND date = $2', [user.userId, '2025-01-02'])).rows[0].id, stableId);

    const replay = await write(harness, user, '/api/weights/import/browser', { operationId, records });
    assert.equal(replay.payload.data.replayed, true);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM weights WHERE user_id = $1', [user.userId])).rows[0].count, 2);
    assert.equal((await write(harness, user, '/api/weights/import/browser', {
      operationId, records: [{ date: '2025-04-01', value: 76, unit: 'kg' }],
    })).response.status, 409);
    assert.equal((await write(harness, user, '/api/weights/import/browser', {
      operationId: crypto.randomUUID(), records: [{ date: '2025-01-03', value: 79, unit: 'kg', user_id: user.userId }],
    })).response.status, 400);
    const repeatedDataset = await write(harness, user, '/api/weights/import/browser', {
      operationId: crypto.randomUUID(), records,
    });
    assert.equal(repeatedDataset.payload.data.imported, 0);
    assert.equal(repeatedDataset.payload.data.duplicate, 2);
  } finally { await harness.cleanup(); }
});

integrationTest('profile synchronization failures roll back CRUD and imports', async () => {
  const harness = await createHarness();
  try {
    const user = await createUser(harness.pool, 'rollback@example.com');
    await harness.pool.query(`
      CREATE FUNCTION fail_weight_profile_sync() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.weight_kg IS DISTINCT FROM OLD.weight_kg THEN RAISE EXCEPTION 'profile sync failure'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER profiles_weight_sync_failure
      BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION fail_weight_profile_sync();
    `);
    assert.equal((await write(harness, user, '/api/weights', { date: '2025-01-01', value: 80, unit: 'kg' })).response.status, 500);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM weights')).rows[0].count, 0);
    assert.equal((await write(harness, user, '/api/weights/import/browser', {
      operationId: crypto.randomUUID(), records: [{ date: '2025-01-02', value: 79, unit: 'kg' }],
    })).response.status, 500);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM weights')).rows[0].count, 0);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM weight_import_operations')).rows[0].count, 0);
  } finally { await harness.cleanup(); }
});
