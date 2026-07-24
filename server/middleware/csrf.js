const crypto = require('node:crypto');
const { digestSecret } = require('../utils/security');

function digestsMatch(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function requireCsrf(req, res, next) {
  const suppliedToken = req.get('x-csrf-token');
  const suppliedDigest = typeof suppliedToken === 'string' ? digestSecret(suppliedToken) : null;
  if (!digestsMatch(suppliedDigest, req.auth?.csrfDigest)) {
    return res.status(403).json({ error: 'Request could not be verified.' });
  }
  return next();
}

module.exports = { digestsMatch, requireCsrf };
