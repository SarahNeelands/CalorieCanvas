const { digestSecret } = require('../utils/security');
const { generateSecret } = require('../utils/security');
const { renewAuthenticationCookies } = require('../utils/cookies');
const { digestsMatch } = require('./csrf');

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
    return cookies;
  }, {});
}

function createSessionMiddleware({ pool, config }) {
  return async function sessionMiddleware(req, res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const rawSessionId = cookies[config.cookieName];
      const rawCsrfCookie = cookies[config.csrfCookieName];
      req.auth = { csrfDigest: null, csrfToken: null, sessionDigest: null, user: null };
      if (!rawSessionId) return next();

      const sessionDigest = digestSecret(rawSessionId);
      const result = await pool.query(
        `SELECT u.id, u.email, u.email_verified_at, u.must_reset_password, u.account_status,
                s.expire, s.sess
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.sid = $1
           AND s.expire > now()
           AND u.account_status = 'active'
           AND u.email_verified_at IS NOT NULL
           AND NOT u.must_reset_password`,
        [sessionDigest]
      );

      if (result.rowCount === 0) return next();
      const row = result.rows[0];
      const storedCsrfDigest = row.sess?.csrfDigest;
      const cookieCsrfDigest = rawCsrfCookie ? digestSecret(rawCsrfCookie) : null;
      let rawCsrfToken = rawCsrfCookie;
      let csrfDigest = storedCsrfDigest;
      let expiresAt = row.expire;
      let sessionChanged = false;

      if (!digestsMatch(cookieCsrfDigest, storedCsrfDigest)) {
        rawCsrfToken = generateSecret();
        csrfDigest = digestSecret(rawCsrfToken);
        sessionChanged = true;
      }

      const renewalThreshold = Date.now() + config.sessionRenewalThresholdHours * 60 * 60 * 1000;
      if (expiresAt.getTime() <= renewalThreshold) {
        expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);
        sessionChanged = true;
      }

      if (sessionChanged) {
        await pool.query(
          `UPDATE sessions
           SET expire = $2, sess = jsonb_set(sess, '{csrfDigest}', to_jsonb($3::text), true)
           WHERE sid = $1`,
          [sessionDigest, expiresAt, csrfDigest]
        );
        renewAuthenticationCookies(res, config, { rawSessionId, rawCsrfToken, expiresAt });
      }

      req.auth = {
        csrfDigest,
        csrfToken: rawCsrfToken,
        sessionDigest,
        user: row,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireAuthentication(req, res, next) {
  if (
    !req.auth?.user
    || req.auth.user.account_status !== 'active'
    || !req.auth.user.email_verified_at
    || req.auth.user.must_reset_password
  ) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

module.exports = { createSessionMiddleware, parseCookies, requireAuthentication };
