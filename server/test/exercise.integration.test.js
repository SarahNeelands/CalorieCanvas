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

function quoteIdentifier(value) { return `"${value.replaceAll('"', '""')}"`; }

async function createUser(pool, email) {
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
  return { userId, csrfToken, cookie: `cc_session=${sessionId}; cc_csrf=${csrfToken}` };
}

async function request(baseUrl, path, { body, cookie, csrfToken, method = 'GET' } = {}) {
  const headers = { origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function payload(response) { return response.status === 204 ? null : response.json(); }

async function createHarness() {
  const schema = `exercise_${crypto.randomUUID().replaceAll('-', '')}`;
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
    body, method, cookie: user.cookie, csrfToken: user.csrfToken,
  });
  return { response, data: await payload(response) };
}

function logInput(overrides = {}) {
  return {
    definition_id: 'rowing', duration_minutes: 30,
    occurred_at: '2026-03-08T06:30:00.000Z', log_date: '2026-03-08',
    timezone_offset_minutes: -300, ...overrides,
  };
}

integrationTest('exercise schema separates shared definitions, user definitions, snapshots, and replay state', async () => {
  const harness = await createHarness();
  try {
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM exercise_definitions WHERE is_shared')).rows[0].count, 5);
    const columns = await harness.pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'exercise_logs'`
    );
    const names = columns.rows.map((row) => row.column_name);
    for (const name of [
      'definition_snapshot', 'duration_minutes', 'occurred_at', 'log_date',
      'timezone_offset_minutes', 'sets', 'repetitions', 'resistance_value',
      'distance_value', 'calories_burned', 'calorie_source', 'notes', 'source_record_id',
    ]) assert.ok(names.includes(name), name);
    const foreignKeys = await harness.pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'exercise_logs'::regclass AND contype = 'f'`
    );
    assert.deepEqual(foreignKeys.rows.map((row) => row.conname), ['exercise_logs_user_id_fkey']);
  } finally { await harness.cleanup(); }
});

integrationTest('definition routes enforce authentication, CSRF, visibility, ownership, archiving, and shared immutability', async () => {
  const harness = await createHarness();
  try {
    const first = await createUser(harness.pool, 'exercise-one@example.com');
    const second = await createUser(harness.pool, 'exercise-two@example.com');
    assert.equal((await request(harness.baseUrl, '/api/exercises')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/exercises', {
      method: 'POST', cookie: first.cookie, body: { id: 'rowing', name: 'Rowing' },
    })).status, 403);
    const created = await write(harness, first, '/api/exercises', {
      id: 'rowing', name: 'Rowing', description: 'Indoor rower', estimated_calories_per_hour: 480,
    });
    assert.equal(created.response.status, 201);
    const visible = await request(harness.baseUrl, '/api/exercises', { cookie: first.cookie });
    const definitions = (await visible.json()).data;
    assert.ok(definitions.some((item) => item.id === 'walk' && item.is_shared));
    assert.ok(definitions.some((item) => item.id === 'rowing' && !item.is_shared));
    const secondVisible = await request(harness.baseUrl, '/api/exercises', { cookie: second.cookie });
    assert.ok(!(await secondVisible.json()).data.some((item) => item.id === 'rowing'));
    assert.equal((await write(harness, first, '/api/exercises/walk', { name: 'Changed' }, 'PUT')).response.status, 404);
    assert.equal((await write(harness, first, '/api/exercises/walk', undefined, 'DELETE')).response.status, 404);
    assert.equal((await write(harness, second, '/api/exercises/rowing', { name: 'Stolen' }, 'PUT')).response.status, 404);
    assert.equal((await write(harness, first, '/api/exercises/rowing', { name: 'Row Machine' }, 'PUT')).data.data.name, 'Row Machine');
    assert.ok((await write(harness, first, '/api/exercises/rowing', undefined, 'DELETE')).data.data.archived_at);
    const active = await request(harness.baseUrl, '/api/exercises', { cookie: first.cookie });
    assert.ok(!(await active.json()).data.some((item) => item.id === 'rowing'));
    for (const body of [
      { id: 'bad id', name: 'Bad' }, { id: 'owned', name: 'Owned', user_id: second.userId },
      { id: 'long', name: 'x'.repeat(101) }, { id: 'estimate', name: 'Estimate', estimated_calories_per_hour: 6000 },
    ]) assert.equal((await write(harness, first, '/api/exercises', body)).response.status, 400);
  } finally { await harness.cleanup(); }
});

integrationTest('completed logs preserve snapshots, calories, dates, ordering, summaries, updates, deletion, and isolation', async () => {
  const harness = await createHarness();
  try {
    const first = await createUser(harness.pool, 'logs-one@example.com');
    const second = await createUser(harness.pool, 'logs-two@example.com');
    await write(harness, first, '/api/exercises', { id: 'rowing', name: 'Rowing', estimated_calories_per_hour: 480 });
    const estimated = await write(harness, first, '/api/exercise-logs', logInput({
      sets: 3, repetitions: 30, resistance_value: 25.5, resistance_unit: 'kg',
      distance_value: 2.5, distance_unit: 'km', notes: 'Morning session',
    }));
    assert.equal(estimated.response.status, 201);
    assert.equal(estimated.data.data.calories_burned, 240);
    assert.equal(estimated.data.data.calorie_source, 'estimate');
    assert.equal(estimated.data.data.definition_snapshot.name, 'Rowing');
    const userCalories = await write(harness, first, '/api/exercise-logs', logInput({
      occurred_at: '2026-03-08T07:30:00.000Z', timezone_offset_minutes: -240,
      duration_minutes: 20, calories_burned: 123.45,
    }));
    assert.equal(userCalories.data.data.calorie_source, 'user');
    assert.equal(userCalories.data.data.log_date, '2026-03-08');

    await write(harness, first, '/api/exercises/rowing', { name: 'Updated Rowing', estimated_calories_per_hour: 600 }, 'PUT');
    const history = await request(harness.baseUrl, '/api/exercise-logs', { cookie: first.cookie });
    const logs = (await history.json()).data;
    assert.deepEqual(logs.map((log) => log.serverId), [userCalories.data.data.serverId, estimated.data.data.serverId]);
    assert.equal(logs[1].definition_snapshot.name, 'Rowing');
    assert.equal(logs[1].calories_burned, 240);

    const updated = await write(harness, first, `/api/exercise-logs/${estimated.data.data.serverId}`, {
      duration_minutes: 60,
    }, 'PUT');
    assert.equal(updated.data.data.calories_burned, 480);
    assert.equal(updated.data.data.definition_snapshot.name, 'Rowing');
    assert.equal((await write(harness, second, `/api/exercise-logs/${estimated.data.data.serverId}`, { duration_minutes: 10 }, 'PUT')).response.status, 404);
    assert.equal((await request(harness.baseUrl, '/api/exercise-logs', { cookie: second.cookie }).then((r) => r.json())).data.length, 0);

    const summaryResponse = await request(
      harness.baseUrl, '/api/exercise-logs/summary?start_date=2026-03-08&end_date=2026-03-08', { cookie: first.cookie }
    );
    const summary = (await summaryResponse.json()).data;
    assert.deepEqual(summary.totals, {
      minutes: 80, calories: 603.45, sets: 3, repetitions: 30, entries: 2,
      distanceByUnit: { km: 2.5 },
    });
    assert.equal(summary.daily[0].types[0].name, 'Rowing');
    assert.equal((await write(harness, first, `/api/exercise-logs/${estimated.data.data.serverId}`, undefined, 'DELETE')).response.status, 204);
    assert.equal((await request(harness.baseUrl, '/api/exercise-logs?start_date=2026-03-08&end_date=2026-03-08', { cookie: first.cookie }).then((r) => r.json())).data.length, 1);

    assert.equal((await request(harness.baseUrl, '/api/exercise-logs', {
      method: 'POST', cookie: first.cookie, body: logInput(),
    })).status, 403);
    for (const body of [
      logInput({ user_id: first.userId }), logInput({ definition_id: 'missing' }),
      logInput({ duration_minutes: 0 }), logInput({ sets: 0 }), logInput({ repetitions: -1 }),
      logInput({ resistance_value: 10, resistance_unit: 'stone' }),
      logInput({ distance_value: 1, distance_unit: 'league' }),
      logInput({ calories_burned: 10001 }), logInput({ notes: 'x'.repeat(2001) }),
      logInput({ log_date: '2026-03-09' }),
    ]) assert.equal((await write(harness, first, '/api/exercise-logs', body)).response.status, 400);
    assert.equal((await write(harness, first, '/api/exercise-logs/not-a-uuid', { duration_minutes: 5 }, 'PUT')).response.status, 400);
  } finally { await harness.cleanup(); }
});

integrationTest('local synchronization deduplicates stable IDs, replays safely, and rolls back complete operations', async () => {
  const harness = await createHarness();
  try {
    const user = await createUser(harness.pool, 'sync@example.com');
    const operationId = crypto.randomUUID();
    const body = {
      operationId,
      definitions: [{ id: 'pilates', name: 'Pilates' }],
      logs: [logInput({ definition_id: 'pilates', source_record_id: 'local-log-1' })],
    };
    const first = await write(harness, user, '/api/exercises/sync', body);
    assert.deepEqual(
      { logsImported: first.data.data.logsImported, duplicates: first.data.data.duplicates, localDataRetained: first.data.data.localDataRetained },
      { logsImported: 1, duplicates: 0, localDataRetained: true }
    );
    const replay = await write(harness, user, '/api/exercises/sync', body);
    assert.equal(replay.data.data.replayed, true);
    const retry = await write(harness, user, '/api/exercises/sync', { ...body, operationId: crypto.randomUUID() });
    assert.equal(retry.data.data.logsImported, 0);
    assert.equal(retry.data.data.duplicates, 1);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM exercise_logs')).rows[0].count, 1);
    assert.equal((await write(harness, user, '/api/exercises/sync', {
      ...body, logs: [logInput({ definition_id: 'pilates', source_record_id: 'local-log-2' })],
    })).response.status, 409);

    await harness.pool.query(`
      CREATE FUNCTION fail_exercise_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'exercise insert failure'; END $$;
      CREATE TRIGGER exercise_insert_failure BEFORE INSERT ON exercise_logs
      FOR EACH ROW EXECUTE FUNCTION fail_exercise_insert();
    `);
    const rollbackOperation = crypto.randomUUID();
    const failed = await write(harness, user, '/api/exercises/sync', {
      operationId: rollbackOperation,
      definitions: [{ id: 'rollback-type', name: 'Rollback Type' }],
      logs: [logInput({ definition_id: 'rollback-type', source_record_id: 'rollback-log' })],
    });
    assert.equal(failed.response.status, 500);
    assert.equal((await harness.pool.query("SELECT count(*)::integer AS count FROM exercise_definitions WHERE id = 'rollback-type'")).rows[0].count, 0);
    assert.equal((await harness.pool.query('SELECT count(*)::integer AS count FROM exercise_sync_operations WHERE operation_id = $1', [rollbackOperation])).rows[0].count, 0);
  } finally { await harness.cleanup(); }
});
