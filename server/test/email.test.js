const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createEmailDelivery } = require('../email');

function config(overrides = {}) {
  return {
    provider: 'resend',
    publicAppOrigin: 'https://caloriecanvas-staging.serenx.net',
    resendApiKey: 'provider-secret',
    from: 'Calorie Canvas <no-reply@example.test>',
    allowedRecipients: [],
    requestTimeoutMs: 1000,
    maxAttempts: 3,
    retryBaseMs: 50,
    ...overrides,
  };
}

test('password reset delivery uses the configured public origin and bearer authentication', async () => {
  let request;
  const delivery = createEmailDelivery(config(), {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  });
  assert.equal(await delivery.sendPasswordReset({ email: 'tester@example.test', token: 'a token' }), true);
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer provider-secret');
  assert.match(body.text, /https:\/\/caloriecanvas-staging\.serenx\.net\/reset\?token=a%20token/);
});

test('email verification delivery builds the verification route', async () => {
  let body;
  const delivery = createEmailDelivery(config(), {
    fetchImpl: async (url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, status: 200 };
    },
  });
  assert.equal(await delivery.sendEmailVerification({
    email: 'tester@example.test', token: 'verification-token',
  }), true);
  assert.match(body.text, /https:\/\/caloriecanvas-staging\.serenx\.net\/verify-email\?token=verification-token/);
});

test('delivery retries transient failures and logs only a sanitized failure', async () => {
  let attempts = 0;
  const logs = [];
  const delivery = createEmailDelivery(config({ maxAttempts: 2 }), {
    fetchImpl: async () => {
      attempts += 1;
      return { ok: false, status: 503 };
    },
    waitImpl: async () => {},
    logger: { error: (message) => logs.push(message), warn() {} },
  });
  assert.equal(await delivery.sendEmailVerification({ email: 'private@example.test', token: 'secret' }), false);
  assert.equal(attempts, 2);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /private|secret|provider-secret/);
});

test('recipient allowlist prevents staging delivery to real users', async () => {
  let called = false;
  const delivery = createEmailDelivery(config({ allowedRecipients: ['tester@example.test'] }), {
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200 };
    },
    logger: { error() {}, warn() {} },
  });
  assert.equal(await delivery.sendPasswordReset({ email: 'user@example.test', token: 'secret' }), false);
  assert.equal(called, false);
});
