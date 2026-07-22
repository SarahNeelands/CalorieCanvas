const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { createApp } = require('../app');

const openServers = new Set();
const silentLogger = { info() {} };

async function startApp(databaseClient) {
  const app = createApp({ databaseClient, logger: silentLogger });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  openServers.add(server);

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    [...openServers].map((server) => new Promise((resolve) => server.close(resolve)))
  );
  openServers.clear();
});

test('GET /api/health reports process health without querying PostgreSQL', async () => {
  let checked = false;
  const baseUrl = await startApp({
    async checkDatabase() {
      checked = true;
    },
  });

  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(checked, false);
});

test('GET /api/ready reports readiness when PostgreSQL responds', async () => {
  const baseUrl = await startApp({ async checkDatabase() {} });

  const response = await fetch(`${baseUrl}/api/ready`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('GET /api/ready fails safely when PostgreSQL is unavailable', async () => {
  const baseUrl = await startApp({
    async checkDatabase() {
      throw new Error('sensitive database detail');
    },
  });

  const response = await fetch(`${baseUrl}/api/ready`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});

test('unknown endpoints return a JSON 404 response', async () => {
  const baseUrl = await startApp({ async checkDatabase() {} });

  const response = await fetch(`${baseUrl}/api/unknown`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found.' });
});

test('state-changing authentication requests reject an untrusted origin before database access', async () => {
  const app = createApp({
    authConfig: {
      appOrigins: ['https://caloriecanvas.serenx.net', 'https://preview.example'],
      bcryptRounds: 10,
      cookieName: 'cc_session',
      csrfCookieName: 'cc_csrf',
      cookieSecure: true,
      sessionTtlHours: 168,
      sessionRenewalThresholdHours: 24,
      passwordResetTtlMinutes: 60,
      emailVerificationTtlMinutes: 1440,
      rateLimits: { windowMinutes: 15, login: 10, signup: 5, passwordAction: 5 },
    },
    databaseClient: { async checkDatabase() {} },
    logger: { info() {}, error() {} },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  openServers.add(server);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/logout`, {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Request origin is not allowed.' });
});

test('CORS preflight accepts every configured trusted origin with credentials', async () => {
  const app = createApp({
    authConfig: {
      appOrigins: ['https://caloriecanvas.serenx.net', 'https://preview.example'],
      bcryptRounds: 10,
      cookieName: 'cc_session',
      csrfCookieName: 'cc_csrf',
      cookieSecure: true,
      sessionTtlHours: 168,
      sessionRenewalThresholdHours: 24,
      passwordResetTtlMinutes: 60,
      emailVerificationTtlMinutes: 1440,
      rateLimits: { windowMinutes: 15, login: 10, signup: 5, passwordAction: 5 },
    },
    databaseClient: { async checkDatabase() {} },
    logger: { info() {}, error() {} },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  openServers.add(server);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { origin: 'https://preview.example' },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://preview.example');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});
