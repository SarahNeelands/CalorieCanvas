const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { createApp } = require('../app');
const { runMigrations } = require('../migrations/run');
const { digestSecret } = require('../utils/security');

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const origin = 'http://127.0.0.1:3000';
const silentLogger = { info() {}, error() {} };

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function readCookies(response) {
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return headers.map((header) => header.split(';', 1)[0]).join('; ') || null;
}

function responseHasCookie(response, name) {
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return headers.some((header) => header.startsWith(`${name}=`));
}

async function request(baseUrl, path, { body, cookie, csrfToken, method = 'POST' } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createHarness({ emailVerificationRequired = true, rateLimits } = {}) {
  const schema = `auth_${crypto.randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${schema},public`,
  });
  await runMigrations({ pool });

  const delivered = { resets: new Map(), verifications: new Map() };
  const app = createApp({
    authPool: pool,
    databaseClient: { async checkDatabase() {} },
    logger: silentLogger,
    authConfig: {
      appOrigins: [origin, 'http://localhost:3000'],
      bcryptRounds: 4,
      cookieName: 'cc_session',
      csrfCookieName: 'cc_csrf',
      cookieSecure: false,
      emailVerificationRequired,
      sessionTtlHours: 24,
      sessionRenewalThresholdHours: 12,
      passwordResetTtlMinutes: 60,
      emailVerificationTtlMinutes: 60,
      rateLimits: rateLimits || { windowMinutes: 15, login: 100, signup: 100, passwordAction: 100 },
    },
    tokenDelivery: {
      async sendPasswordReset({ email, token }) {
        delivered.resets.set(email, token);
      },
      async sendEmailVerification({ email, token }) {
        delivered.verifications.set(email, token);
      },
    },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    delivered,
    pool,
    async cleanup() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${quoteIdentifier(schema)} CASCADE`);
      await adminPool.end();
    },
  };
}

integrationTest('signup creates an authenticated session while email verification is paused', async () => {
  const harness = await createHarness({ emailVerificationRequired: false });
  try {
    const signup = await request(harness.baseUrl, '/api/auth/signup', {
      body: { email: 'Local@Test.example ', password: 'local password' },
    });
    assert.equal(signup.status, 202);
    const payload = await signup.json();
    const cookies = readCookies(signup);
    assert.equal(payload.data.user.email, 'local@test.example');
    assert.equal(payload.data.session.user.id, payload.data.user.id);
    assert.ok(payload.csrfToken);
    assert.ok(cookies);
    assert.equal(harness.delivered.verifications.size, 0);

    const stored = await harness.pool.query(
      `SELECT email_verified_at,
              (SELECT count(*)::int FROM email_verification_tokens WHERE user_id = users.id) AS token_count
       FROM users WHERE id = $1`,
      [payload.data.user.id]
    );
    assert.ok(stored.rows[0].email_verified_at);
    assert.equal(stored.rows[0].token_count, 0);

    const session = await request(harness.baseUrl, '/api/auth/session', {
      cookie: cookies,
      method: 'GET',
    });
    assert.equal((await session.json()).session.user.id, payload.data.user.id);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('signup, verification, sessions, login, logout, reset, and password change are secure', async () => {
  const harness = await createHarness();
  try {
    const signup = await request(harness.baseUrl, '/api/auth/signup', {
      body: { email: 'Alice@Example.com ', password: 'initial password' },
    });
    assert.equal(signup.status, 202);
    const verificationToken = harness.delivered.verifications.get('alice@example.com');
    assert.ok(verificationToken);

    const storedUser = await harness.pool.query(
      'SELECT id, email, password_hash, email_verified_at FROM users WHERE email = $1',
      ['alice@example.com']
    );
    assert.equal(storedUser.rows[0].email, 'alice@example.com');
    assert.notEqual(storedUser.rows[0].password_hash, 'initial password');
    assert.equal(await bcrypt.compare('initial password', storedUser.rows[0].password_hash), true);
    assert.equal(storedUser.rows[0].email_verified_at, null);

    const storedVerification = await harness.pool.query(
      'SELECT token_digest FROM email_verification_tokens WHERE user_id = $1',
      [storedUser.rows[0].id]
    );
    assert.equal(storedVerification.rows[0].token_digest, digestSecret(verificationToken));
    assert.notEqual(storedVerification.rows[0].token_digest, verificationToken);

    const verify = await request(harness.baseUrl, '/api/auth/verify-email', {
      body: { token: verificationToken },
    });
    assert.equal(verify.status, 200);
    const verifyPayload = await verify.json();
    const verifiedCookie = readCookies(verify);
    const verifiedCsrf = verifyPayload.csrfToken;
    assert.ok(verifiedCookie);
    assert.ok(verifiedCsrf);
    const setCookie = verify.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);

    const rawSession = /(?:^|; )cc_session=([^;]+)/.exec(verifiedCookie)[1];
    const storedSession = await harness.pool.query('SELECT sid, sess FROM sessions');
    assert.equal(storedSession.rows[0].sid, digestSecret(rawSession));
    assert.notEqual(storedSession.rows[0].sid, rawSession);
    assert.equal(storedSession.rows[0].sess.csrfDigest, digestSecret(verifiedCsrf));

    const session = await request(harness.baseUrl, '/api/auth/session', {
      cookie: verifiedCookie,
      method: 'GET',
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).session.user.email, 'alice@example.com');

    const rejectedLogout = await request(harness.baseUrl, '/api/auth/logout', {
      cookie: verifiedCookie,
    });
    assert.equal(rejectedLogout.status, 403);
    const logout = await request(harness.baseUrl, '/api/auth/logout', {
      cookie: verifiedCookie,
      csrfToken: verifiedCsrf,
    });
    assert.equal(logout.status, 204);
    assert.equal((await harness.pool.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count, 0);

    const login = await request(harness.baseUrl, '/api/auth/login', {
      body: { email: 'alice@example.com', password: 'initial password' },
      cookie: verifiedCookie,
    });
    assert.equal(login.status, 200);
    const loginPayload = await login.json();
    const loginCookie = readCookies(login);
    const loginCsrf = loginPayload.csrfToken;
    assert.notEqual(loginCookie, verifiedCookie);

    const forgotKnown = await request(harness.baseUrl, '/api/auth/forgot-password', {
      body: { email: 'alice@example.com' },
    });
    const forgotUnknown = await request(harness.baseUrl, '/api/auth/forgot-password', {
      body: { email: 'missing@example.com' },
    });
    assert.equal(forgotKnown.status, 202);
    assert.equal(forgotUnknown.status, 202);
    assert.deepEqual(await forgotKnown.json(), await forgotUnknown.json());
    const resetToken = harness.delivered.resets.get('alice@example.com');
    const oldPasswordHash = storedUser.rows[0].password_hash;

    await harness.pool.query(`
      CREATE FUNCTION reject_test_session() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'deliberate test failure'; END;
      $$;
      CREATE TRIGGER reject_test_session BEFORE INSERT ON sessions
      FOR EACH ROW EXECUTE FUNCTION reject_test_session();
    `);
    const failedReset = await request(harness.baseUrl, '/api/auth/reset-password', {
      body: { token: resetToken, password: 'replacement password' },
    });
    assert.equal(failedReset.status, 500);
    const afterFailure = await harness.pool.query(
      `SELECT u.password_hash, t.consumed_at
       FROM users u JOIN password_reset_tokens t ON t.user_id = u.id
       WHERE t.token_digest = $1`,
      [digestSecret(resetToken)]
    );
    assert.equal(afterFailure.rows[0].password_hash, oldPasswordHash);
    assert.equal(afterFailure.rows[0].consumed_at, null);
    await harness.pool.query('DROP TRIGGER reject_test_session ON sessions; DROP FUNCTION reject_test_session()');

    const reset = await request(harness.baseUrl, '/api/auth/reset-password', {
      body: { token: resetToken, password: 'replacement password' },
    });
    assert.equal(reset.status, 200);
    const resetPayload = await reset.json();
    const resetCookie = readCookies(reset);
    const resetCsrf = resetPayload.csrfToken;
    assert.notEqual(resetCookie, loginCookie);
    const resetState = await harness.pool.query(
      `SELECT u.password_hash, u.must_reset_password, t.consumed_at
       FROM users u JOIN password_reset_tokens t ON t.user_id = u.id
       WHERE t.token_digest = $1`,
      [digestSecret(resetToken)]
    );
    assert.equal(await bcrypt.compare('replacement password', resetState.rows[0].password_hash), true);
    assert.equal(resetState.rows[0].must_reset_password, false);
    assert.ok(resetState.rows[0].consumed_at);

    const oldSession = await request(harness.baseUrl, '/api/auth/session', {
      cookie: loginCookie,
      method: 'GET',
    });
    assert.equal((await oldSession.json()).session, null);

    const changed = await request(harness.baseUrl, '/api/auth/change-password', {
      cookie: resetCookie,
      csrfToken: resetCsrf,
      body: { currentPassword: 'replacement password', newPassword: 'final password' },
    });
    assert.equal(changed.status, 200);
    assert.notEqual(readCookies(changed), resetCookie);

    const wrongLogin = await request(harness.baseUrl, '/api/auth/login', {
      body: { email: 'alice@example.com', password: 'wrong password' },
    });
    const missingLogin = await request(harness.baseUrl, '/api/auth/login', {
      body: { email: 'missing@example.com', password: 'wrong password' },
    });
    assert.equal(wrongLogin.status, 401);
    assert.equal(missingLogin.status, 401);
    assert.deepEqual(await wrongLogin.json(), await missingLogin.json());
  } finally {
    await harness.cleanup();
  }
});

integrationTest('a migrated user with no Supabase password hash can reset into an application session', async () => {
  const harness = await createHarness();
  try {
    const userId = crypto.randomUUID();
    await harness.pool.query(
      `INSERT INTO users (
         id, email, password_hash, must_reset_password, email_verified_at
       ) VALUES ($1, $2, NULL, true, now())`,
      [userId, 'migrated@example.com']
    );

    await request(harness.baseUrl, '/api/auth/forgot-password', {
      body: { email: 'migrated@example.com' },
    });
    const token = harness.delivered.resets.get('migrated@example.com');
    assert.ok(token);
    const reset = await request(harness.baseUrl, '/api/auth/reset-password', {
      body: { token, password: 'application password' },
    });
    assert.equal(reset.status, 200);
    assert.ok(readCookies(reset));

    const migrated = await harness.pool.query(
      'SELECT id, password_hash, must_reset_password FROM users WHERE id = $1',
      [userId]
    );
    assert.equal(migrated.rows[0].id, userId);
    assert.equal(migrated.rows[0].must_reset_password, false);
    assert.equal(await bcrypt.compare('application password', migrated.rows[0].password_hash), true);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('rate limits and sliding session renewal are enforced', async () => {
  const harness = await createHarness({
    rateLimits: { windowMinutes: 15, login: 1, signup: 1, passwordAction: 1 },
  });
  try {
    const firstSignup = await request(harness.baseUrl, '/api/auth/signup', {
      body: { email: 'limited@example.com', password: 'signup password' },
    });
    const limitedSignup = await request(harness.baseUrl, '/api/auth/signup', {
      body: { email: 'limited2@example.com', password: 'signup password' },
    });
    assert.equal(firstSignup.status, 202);
    assert.equal(limitedSignup.status, 429);

    const firstForgot = await request(harness.baseUrl, '/api/auth/forgot-password', {
      body: { email: 'missing@example.com' },
    });
    const limitedForgot = await request(harness.baseUrl, '/api/auth/forgot-password', {
      body: { email: 'missing@example.com' },
    });
    assert.equal(firstForgot.status, 202);
    assert.equal(limitedForgot.status, 429);

    const firstResend = await request(harness.baseUrl, '/api/auth/resend-verification', {
      body: { email: 'missing@example.com' },
    });
    const limitedResend = await request(harness.baseUrl, '/api/auth/resend-verification', {
      body: { email: 'missing@example.com' },
    });
    assert.equal(firstResend.status, 202);
    assert.equal(limitedResend.status, 429);

    const firstReset = await request(harness.baseUrl, '/api/auth/reset-password', {
      body: { token: 'invalid-token', password: 'replacement password' },
    });
    const limitedReset = await request(harness.baseUrl, '/api/auth/reset-password', {
      body: { token: 'invalid-token', password: 'replacement password' },
    });
    assert.equal(firstReset.status, 400);
    assert.equal(limitedReset.status, 429);

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash('sliding password', 4);
    await harness.pool.query(
      `INSERT INTO users (
         id, email, password_hash, must_reset_password, email_verified_at
       ) VALUES ($1, $2, $3, false, now())`,
      [userId, 'sliding@example.com', passwordHash]
    );
    const login = await request(harness.baseUrl, '/api/auth/login', {
      body: { email: 'sliding@example.com', password: 'sliding password' },
    });
    assert.equal(login.status, 200);
    const cookies = readCookies(login);
    const sessionId = /(?:^|; )cc_session=([^;]+)/.exec(cookies)[1];
    await harness.pool.query(
      `UPDATE sessions SET expire = now() + interval '1 hour' WHERE sid = $1`,
      [digestSecret(sessionId)]
    );
    const before = await harness.pool.query('SELECT expire FROM sessions WHERE sid = $1', [digestSecret(sessionId)]);
    const session = await request(harness.baseUrl, '/api/auth/session', {
      cookie: cookies,
      method: 'GET',
    });
    assert.equal(session.status, 200);
    assert.ok(responseHasCookie(session, 'cc_session'));
    const after = await harness.pool.query('SELECT expire FROM sessions WHERE sid = $1', [digestSecret(sessionId)]);
    assert.ok(after.rows[0].expire > before.rows[0].expire);

    const limitedLogin = await request(harness.baseUrl, '/api/auth/login', {
      body: { email: 'sliding@example.com', password: 'sliding password' },
    });
    assert.equal(limitedLogin.status, 429);
  } finally {
    await harness.cleanup();
  }
});
