const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

function generateSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function digestSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

async function hashPassword(password, rounds) {
  return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  digestSecret,
  generateSecret,
  hashPassword,
  verifyPassword,
};
