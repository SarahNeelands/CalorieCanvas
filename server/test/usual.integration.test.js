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
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createHarness() {
  const schema = `usual_${crypto.randomUUID().replaceAll('-', '')}`;
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

integrationTest('My Usuals persists defaults and enforces authentication, CSRF, and account isolation', async () => {
  const harness = await createHarness();
  try {
    const first = await createAuthenticatedUser(harness.pool, 'usual-one@example.com');
    const second = await createAuthenticatedUser(harness.pool, 'usual-two@example.com');
    const firstSnackId = crypto.randomUUID();
    await harness.pool.query(
      `INSERT INTO meals (
         id, user_id, title, type, kcal_per_100g, protein_g_per_100g,
         carbs_g_per_100g, fat_g_per_100g, unit_conversions
       ) VALUES ($1, $2, 'Chocolate', 'snack', 550, 7, 50, 34,
         '{"quantity":8,"quantity_label":"square"}')`,
      [firstSnackId, first.userId]
    );
    await harness.pool.query(
      `INSERT INTO shared_catalog_items (
         id, title, type, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g
       ) VALUES ('seed-cheetos', 'Cheetos', 'snack', 560, 6, 52, 35)`
    );

    assert.equal((await request(harness.baseUrl, '/api/usuals')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/usuals', {
      method: 'POST', cookie: first.cookie,
      body: { meal_id: firstSnackId, default_qty: 2, unit_code: 'quantity' },
    })).status, 403);
    assert.equal((await request(harness.baseUrl, '/api/usuals', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { meal_id: firstSnackId, default_qty: 2, unit_code: 'quantity', user_id: second.userId },
    })).status, 400);

    const createdResponse = await request(harness.baseUrl, '/api/usuals', {
      method: 'POST', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { meal_id: firstSnackId, default_qty: 2, unit_code: 'quantity', position: 0 },
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.user_id, first.userId);
    assert.equal(created.item.title, 'Chocolate');
    assert.equal(created.default_qty, 2);

    assert.equal((await request(harness.baseUrl, '/api/usuals', {
      method: 'POST', cookie: second.cookie, csrfToken: second.csrfToken,
      body: { meal_id: firstSnackId, default_qty: 2, unit_code: 'quantity' },
    })).status, 400);
    const secondCreated = await request(harness.baseUrl, '/api/usuals', {
      method: 'POST', cookie: second.cookie, csrfToken: second.csrfToken,
      body: { meal_id: 'seed-cheetos', default_qty: 25, unit_code: 'g' },
    });
    assert.equal(secondCreated.status, 201);

    const firstList = await request(harness.baseUrl, '/api/usuals', { cookie: first.cookie });
    const secondList = await request(harness.baseUrl, '/api/usuals', { cookie: second.cookie });
    assert.deepEqual((await firstList.json()).data.map((row) => row.item.title), ['Chocolate']);
    assert.deepEqual((await secondList.json()).data.map((row) => row.item.title), ['Cheetos']);

    assert.equal((await request(harness.baseUrl, `/api/usuals/${created.id}`, {
      method: 'PUT', cookie: second.cookie, csrfToken: second.csrfToken,
      body: { default_qty: 99 },
    })).status, 404);
    const updated = await request(harness.baseUrl, `/api/usuals/${created.id}`, {
      method: 'PUT', cookie: first.cookie, csrfToken: first.csrfToken,
      body: { default_qty: 4 },
    });
    assert.equal((await updated.json()).data.default_qty, 4);
    assert.equal((await request(harness.baseUrl, `/api/usuals/${created.id}`, {
      method: 'DELETE', cookie: second.cookie, csrfToken: second.csrfToken,
    })).status, 404);
    assert.equal((await request(harness.baseUrl, `/api/usuals/${created.id}`, {
      method: 'DELETE', cookie: first.cookie, csrfToken: first.csrfToken,
    })).status, 204);
  } finally {
    await harness.cleanup();
  }
});
