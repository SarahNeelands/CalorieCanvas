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
  const rawSessionId = generateSecret();
  const rawCsrfToken = generateSecret();
  await pool.query(
    `INSERT INTO users (
       id, email, password_hash, must_reset_password, email_verified_at
     ) VALUES ($1, $2, 'test-hash', false, now())`,
    [userId, email]
  );
  await pool.query(
    `INSERT INTO sessions (sid, sess, expire, user_id)
     VALUES ($1, $2::jsonb, now() + interval '1 day', $3)`,
    [
      digestSecret(rawSessionId),
      JSON.stringify({ userId, csrfDigest: digestSecret(rawCsrfToken) }),
      userId,
    ]
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
  const schema = `profile_${crypto.randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` });
  await runMigrations({ pool });
  const app = createApp({
    authPool: pool,
    databaseClient: { async checkDatabase() {} },
    logger: silentLogger,
    authConfig: {
      appOrigins: [origin],
      bcryptRounds: 4,
      cookieName: 'cc_session',
      csrfCookieName: 'cc_csrf',
      cookieSecure: false,
      sessionTtlHours: 24,
      sessionRenewalThresholdHours: 12,
      passwordResetTtlMinutes: 60,
      emailVerificationTtlMinutes: 60,
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

integrationTest('profile routes enforce authentication, CSRF, ownership, validation, and response shapes', async () => {
  const harness = await createHarness();
  try {
    const first = await createAuthenticatedUser(harness.pool, 'profile-one@example.com');
    const second = await createAuthenticatedUser(harness.pool, 'profile-two@example.com');

    assert.equal((await request(harness.baseUrl, '/api/profile')).status, 401);
    assert.equal((await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      body: { display_name: 'No session' },
    })).status, 401);

    const noCsrf = await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      body: { display_name: 'Alice' },
    });
    assert.equal(noCsrf.status, 403);

    const created = await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: {
        display_name: 'Alice',
        dob: '1990-05-12',
        gender: 'Female',
        height_cm: 168.5,
        weight_kg: 70.25,
        activity_level: 'moderately_active',
        goal_weight_intent: 'normal_loss',
        goal_muscle_intent: 'maintain',
        target_weight_kg: 65,
        target_body_fat_pct: 24,
      },
    });
    assert.equal(created.status, 200);
    const createdPayload = await created.json();
    assert.equal(createdPayload.error, null);
    assert.equal(createdPayload.data.user_id, first.userId);
    assert.equal(createdPayload.data.height_cm, 168.5);

    const read = await request(harness.baseUrl, '/api/profile', { cookie: first.cookie });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).data.display_name, 'Alice');

    const updated = await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { display_name: 'Alice Updated', pref_show_micros: true, pref_show_usuals: false },
    });
    assert.equal(updated.status, 200);
    const updatedProfile = (await updated.json()).data;
    assert.equal(updatedProfile.display_name, 'Alice Updated');
    assert.equal(updatedProfile.weight_kg, 70.25);
    assert.equal(updatedProfile.pref_show_micros, true);
    assert.equal(updatedProfile.pref_show_usuals, false);

    const setupDraft = {
      name: 'Alice Updated',
      heightCm: 168.5,
      weightKg: 70.25,
      activityLevel: 'moderately_active',
      goal: 'normal_loss',
      muscle: 'maintain',
      lastStep: '/profile-setup-4',
      completed: false,
    };
    const setup = await request(harness.baseUrl, '/api/profile/setup', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { setup_last_step: '/profile-setup-4', setup_draft: setupDraft },
    });
    assert.equal(setup.status, 200);
    assert.deepEqual((await setup.json()).data, {
      setup_completed: false,
      setup_last_step: '/profile-setup-4',
      setup_draft: setupDraft,
    });

    const completed = await request(harness.baseUrl, '/api/profile/setup/complete', {
      method: 'POST',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { setup_draft: setupDraft },
    });
    assert.equal(completed.status, 200);
    const completedProfile = (await completed.json()).data;
    assert.equal(completedProfile.setup_completed, true);
    assert.equal(completedProfile.setup_last_step, null);

    const latestWeight = await request(harness.baseUrl, '/api/profile/latest-weight', {
      cookie: first.cookie,
    });
    assert.equal(latestWeight.status, 200);
    const weightData = (await latestWeight.json()).data;
    assert.equal(weightData.value, 70.25);
    assert.equal(weightData.unit, 'kg');
    assert.match(weightData.date, /^\d{4}-\d{2}-\d{2}$/);

    await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: second.cookie,
      csrfToken: second.csrfToken,
      body: { display_name: 'Bob' },
    });
    const isolated = await request(harness.baseUrl, '/api/profile', { cookie: first.cookie });
    assert.equal((await isolated.json()).data.display_name, 'Alice Updated');

    assert.equal((await request(
      harness.baseUrl,
      `/api/profile?user_id=${second.userId}`,
      { cookie: first.cookie }
    )).status, 400);
    assert.equal((await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { user_id: second.userId, display_name: 'Stolen' },
    })).status, 400);
    assert.equal((await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { height_cm: 900 },
    })).status, 400);
    assert.equal((await request(harness.baseUrl, '/api/profile', {
      method: 'PUT',
      cookie: first.cookie,
      csrfToken: first.csrfToken,
      body: { arbitrary_column: 'value' },
    })).status, 400);
  } finally {
    await harness.cleanup();
  }
});

integrationTest('setup completion rolls back profile and initial weight when the second write fails', async () => {
  const harness = await createHarness();
  try {
    const user = await createAuthenticatedUser(harness.pool, 'rollback-profile@example.com');
    await harness.pool.query(
      `INSERT INTO profiles (user_id, display_name, weight_kg, setup_completed, setup_last_step)
       VALUES ($1, 'Rollback User', 80, false, '/profile-setup-4')`,
      [user.userId]
    );
    await harness.pool.query(`
      CREATE FUNCTION reject_initial_weight() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'deliberate profile transaction failure'; END;
      $$;
      CREATE TRIGGER reject_initial_weight BEFORE INSERT ON weights
      FOR EACH ROW EXECUTE FUNCTION reject_initial_weight();
    `);

    const response = await request(harness.baseUrl, '/api/profile/setup/complete', {
      method: 'POST',
      cookie: user.cookie,
      csrfToken: user.csrfToken,
      body: { setup_draft: { completed: false, lastStep: '/profile-setup-4' } },
    });
    assert.equal(response.status, 500);
    const profile = await harness.pool.query(
      'SELECT setup_completed, setup_last_step FROM profiles WHERE user_id = $1',
      [user.userId]
    );
    assert.deepEqual(profile.rows[0], {
      setup_completed: false,
      setup_last_step: '/profile-setup-4',
    });
    const weights = await harness.pool.query(
      'SELECT count(*)::int AS count FROM weights WHERE user_id = $1',
      [user.userId]
    );
    assert.equal(weights.rows[0].count, 0);
  } finally {
    await harness.cleanup();
  }
});
