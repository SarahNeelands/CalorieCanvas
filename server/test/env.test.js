const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadEnvironment } = require('../utils/env');

test('environment loader supplies local development defaults', () => {
  assert.deepEqual(loadEnvironment({}), {
    nodeEnv: 'development',
    host: '127.0.0.1',
    port: 3001,
    databaseUrl: null,
    databaseSsl: false,
    frontendDirectory: null,
    email: {
      provider: 'disabled',
      publicAppOrigin: null,
      resendApiKey: null,
      from: null,
      allowedRecipients: [],
      requestTimeoutMs: 10000,
      maxAttempts: 3,
      retryBaseMs: 250,
    },
    auth: {
      appOrigins: [],
      bcryptRounds: 12,
      cookieName: 'cc_session',
      csrfCookieName: 'cc_csrf',
      cookieSecure: false,
      emailVerificationRequired: false,
      sessionTtlHours: 168,
      sessionRenewalThresholdHours: 24,
      passwordResetTtlMinutes: 60,
      emailVerificationTtlMinutes: 1440,
      rateLimits: {
        windowMinutes: 15,
        login: 10,
        signup: 5,
        passwordAction: 5,
      },
    },
  });
});

test('environment loader accepts explicit server and PostgreSQL settings', () => {
  const config = loadEnvironment({
    NODE_ENV: 'test',
    SERVER_HOST: '0.0.0.0',
    SERVER_PORT: '4100',
    DATABASE_URL: 'postgresql://app:secret@database:5432/calorie_canvas',
    DATABASE_SSL: 'true',
  });

  assert.equal(config.nodeEnv, 'test');
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 4100);
  assert.equal(config.databaseSsl, true);
});

test('email verification can be restored explicitly', () => {
  assert.equal(loadEnvironment({ EMAIL_VERIFICATION_REQUIRED: 'true' }).auth.emailVerificationRequired, true);
  assert.throws(
    () => loadEnvironment({ EMAIL_VERIFICATION_REQUIRED: 'sometimes' }),
    /EMAIL_VERIFICATION_REQUIRED/
  );
});

test('environment loader accepts multiple unique trusted origins', () => {
  const config = loadEnvironment({
    APP_ORIGINS: 'http://127.0.0.1:3000, https://caloriecanvas.serenx.net',
  });
  assert.deepEqual(config.auth.appOrigins, [
    'http://127.0.0.1:3000',
    'https://caloriecanvas.serenx.net',
  ]);
});

test('environment loader validates production email settings', () => {
  const config = loadEnvironment({
    EMAIL_PROVIDER: 'resend',
    PUBLIC_APP_ORIGIN: 'https://caloriecanvas-staging.serenx.net',
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'Calorie Canvas <no-reply@example.test>',
    EMAIL_ALLOWED_RECIPIENTS: 'Tester@Example.test,tester@example.test',
  });
  assert.equal(config.email.provider, 'resend');
  assert.deepEqual(config.email.allowedRecipients, ['tester@example.test']);
  assert.throws(
    () => loadEnvironment({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'x' }),
    /PUBLIC_APP_ORIGIN/
  );
  assert.throws(
    () => loadEnvironment({
      EMAIL_PROVIDER: 'resend', PUBLIC_APP_ORIGIN: 'https://example.test', EMAIL_FROM: 'x',
    }),
    /RESEND_API_KEY/
  );
});

test('environment loader rejects invalid ports and database URLs', () => {
  assert.throws(
    () => loadEnvironment({ SERVER_PORT: 'not-a-port' }),
    /SERVER_PORT/
  );
  assert.throws(
    () => loadEnvironment({ DATABASE_URL: 'https://example.com/database' }),
    /postgres or postgresql/
  );
  assert.throws(() => loadEnvironment({ BCRYPT_ROUNDS: '4' }), /BCRYPT_ROUNDS/);
  assert.throws(() => loadEnvironment({ APP_ORIGINS: 'https://example.com/path' }), /APP_ORIGINS/);
  assert.throws(() => loadEnvironment({ NODE_ENV: 'production' }), /DATABASE_URL/);
  assert.throws(
    () => loadEnvironment({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:secret@database/app' }),
    /APP_ORIGINS/
  );
  assert.throws(
    () => loadEnvironment({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:secret@database/app',
      APP_ORIGINS: 'https://caloriecanvas.serenx.net',
    }),
    /EMAIL_PROVIDER=resend/
  );
  assert.throws(
    () => loadEnvironment({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:secret@database/app',
      APP_ORIGINS: 'http://caloriecanvas.serenx.net',
    }),
    /APP_ORIGINS must use HTTPS/
  );
  assert.throws(
    () => loadEnvironment({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:secret@database/app',
      APP_ORIGINS: 'https://caloriecanvas.serenx.net', EMAIL_PROVIDER: 'resend',
      PUBLIC_APP_ORIGIN: 'http://caloriecanvas.serenx.net', RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'test@example.test',
    }),
    /PUBLIC_APP_ORIGIN must use HTTPS/
  );
  assert.throws(
    () => loadEnvironment({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:secret@database/app',
      APP_ORIGINS: 'https://caloriecanvas.serenx.net', SESSION_COOKIE_SECURE: 'false',
      EMAIL_PROVIDER: 'resend', PUBLIC_APP_ORIGIN: 'https://caloriecanvas.serenx.net',
      RESEND_API_KEY: 'test-key', EMAIL_FROM: 'test@example.test',
    }),
    /SESSION_COOKIE_SECURE/
  );
  assert.throws(
    () => loadEnvironment({ SESSION_TTL_HOURS: '24', SESSION_RENEWAL_THRESHOLD_HOURS: '24' }),
    /SESSION_RENEWAL_THRESHOLD_HOURS/
  );
});
