const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  digestSecret,
  generateSecret,
  hashPassword,
  verifyPassword,
} = require('../utils/security');

test('generated secrets are random and only their SHA-256 digests need storage', () => {
  const first = generateSecret();
  const second = generateSecret();
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  assert.match(digestSecret(first), /^[0-9a-f]{64}$/);
  assert.notEqual(digestSecret(first), first);
});

test('password hashing and constant-time bcrypt verification work without retaining plaintext', async () => {
  const hash = await hashPassword('correct horse battery staple', 4);
  assert.notEqual(hash, 'correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});
