const crypto = require('node:crypto');
const { withTransaction } = require('./db');
const {
  digestSecret,
  generateSecret,
  hashPassword,
  verifyPassword,
} = require('./utils/security');

const INVALID_CREDENTIALS = 'Invalid email or password.';
const INVALID_TOKEN = 'Invalid or expired token.';

class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  return email.length >= 3 && email.length <= 320 && email.indexOf('@') > 0;
}

function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && Buffer.byteLength(password, 'utf8') <= 72;
}

function publicUser(user) {
  return user ? { id: user.id, email: user.email } : null;
}

function createAuthService({ pool, config, tokenDelivery = {} }) {
  const deliverPasswordReset = tokenDelivery.sendPasswordReset || (async () => {});
  const deliverEmailVerification = tokenDelivery.sendEmailVerification || (async () => {});
  const dummyHashPromise = hashPassword(generateSecret(), config.bcryptRounds);

  function createExpiry(durationMs) {
    return new Date(Date.now() + durationMs);
  }

  async function createSession(client, userId) {
    const rawSessionId = generateSecret();
    const rawCsrfToken = generateSecret();
    const sessionDigest = digestSecret(rawSessionId);
    const csrfDigest = digestSecret(rawCsrfToken);
    const expiresAt = createExpiry(config.sessionTtlHours * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO sessions (sid, sess, expire, user_id)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [sessionDigest, JSON.stringify({ userId, csrfDigest }), expiresAt, userId]
    );
    return { rawSessionId, rawCsrfToken, expiresAt };
  }

  async function rotateSession(client, userId, previousSessionDigest, revokeAll = false) {
    if (revokeAll) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    } else if (previousSessionDigest) {
      await client.query('DELETE FROM sessions WHERE sid = $1', [previousSessionDigest]);
    }
    return createSession(client, userId);
  }

  async function signUp({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    if (!validateEmail(normalizedEmail) || !validatePassword(password)) {
      throw new AuthError('Unable to create account.');
    }

    const emailVerificationRequired = config.emailVerificationRequired !== false;
    const passwordHash = await hashPassword(password, config.bcryptRounds);
    const rawToken = emailVerificationRequired ? generateSecret() : null;
    const tokenDigest = rawToken ? digestSecret(rawToken) : null;
    const result = await withTransaction(pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO users (
           id, email, password_hash, password_changed_at, email_verified_at
         ) VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT DO NOTHING
         RETURNING id, email`,
        [
          crypto.randomUUID(),
          normalizedEmail,
          passwordHash,
          emailVerificationRequired ? null : new Date(),
        ]
      );
      if (inserted.rowCount === 0) return null;

      const user = inserted.rows[0];
      if (emailVerificationRequired) {
        await client.query(
          `INSERT INTO email_verification_tokens (id, user_id, token_digest, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [
            crypto.randomUUID(),
            user.id,
            tokenDigest,
            createExpiry(config.emailVerificationTtlMinutes * 60 * 1000),
          ]
        );
        return { session: null, user };
      }

      return { session: await createSession(client, user.id), user };
    });

    if (result && emailVerificationRequired) {
      await deliverEmailVerification({ email: result.user.email, token: rawToken });
    }
    return {
      accepted: true,
      session: result?.session || null,
      user: publicUser(result?.user),
    };
  }

  async function login({ email, password, previousSessionDigest }) {
    const normalizedEmail = normalizeEmail(email);
    const suppliedPassword = typeof password === 'string' ? password : '';

    return withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT id, email, password_hash, email_verified_at, account_status
         FROM users WHERE email = $1 FOR UPDATE`,
        [normalizedEmail]
      );
      const user = selected.rows[0];
      const passwordHash = user?.password_hash || await dummyHashPromise;
      const passwordMatches = await verifyPassword(suppliedPassword, passwordHash);
      const canLogin = passwordMatches
        && user
        && user.account_status === 'active'
        && user.email_verified_at
        && user.password_hash;

      if (!canLogin) throw new AuthError(INVALID_CREDENTIALS, 401);

      await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      const session = await rotateSession(client, user.id, previousSessionDigest);
      return { user: publicUser(user), session };
    });
  }

  async function logout(sessionDigest) {
    await withTransaction(pool, async (client) => {
      if (sessionDigest) {
        await client.query('DELETE FROM sessions WHERE sid = $1', [sessionDigest]);
      }
    });
  }

  async function requestPasswordReset(email) {
    const normalizedEmail = normalizeEmail(email);
    const rawToken = generateSecret();
    const tokenDigest = digestSecret(rawToken);
    const user = await withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT id, email FROM users
         WHERE email = $1 AND account_status = 'active'
         FOR UPDATE`,
        [normalizedEmail]
      );
      if (selected.rowCount === 0) return null;

      const found = selected.rows[0];
      await client.query(
        `UPDATE password_reset_tokens SET revoked_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [found.id]
      );
      await client.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_digest, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          found.id,
          tokenDigest,
          createExpiry(config.passwordResetTtlMinutes * 60 * 1000),
        ]
      );
      return found;
    });

    if (user) await deliverPasswordReset({ email: user.email, token: rawToken });
    return { accepted: true };
  }

  async function completePasswordReset({ token, password }) {
    if (typeof token !== 'string' || !validatePassword(password)) {
      throw new AuthError(INVALID_TOKEN);
    }
    const tokenDigest = digestSecret(token);
    const passwordHash = await hashPassword(password, config.bcryptRounds);

    return withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT t.id AS token_id, u.id, u.email, u.account_status, u.email_verified_at
         FROM password_reset_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_digest = $1
           AND t.consumed_at IS NULL
           AND t.revoked_at IS NULL
           AND t.expires_at > now()
         FOR UPDATE OF t, u`,
        [tokenDigest]
      );
      const user = selected.rows[0];
      if (!user || user.account_status !== 'active') throw new AuthError(INVALID_TOKEN);

      await client.query(
        'UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1',
        [user.token_id]
      );
      await client.query(
        `UPDATE users
         SET password_hash = $1, password_changed_at = now()
         WHERE id = $2`,
        [passwordHash, user.id]
      );
      await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      const session = user.email_verified_at ? await createSession(client, user.id) : null;
      return { user: publicUser(user), session };
    });
  }

  async function changePassword({ userId, currentPassword, newPassword }) {
    if (!validatePassword(newPassword)) {
      throw new AuthError('Unable to change password.');
    }
    const passwordHash = await hashPassword(newPassword, config.bcryptRounds);

    return withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT id, email, password_hash, account_status
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      const user = selected.rows[0];
      const comparisonHash = user?.password_hash || await dummyHashPromise;
      const matches = await verifyPassword(
        typeof currentPassword === 'string' ? currentPassword : '',
        comparisonHash
      );
      if (!matches || !user?.password_hash || user.account_status !== 'active') {
        throw new AuthError('Unable to change password.', 401);
      }

      await client.query(
        `UPDATE users
         SET password_hash = $1, password_changed_at = now()
         WHERE id = $2`,
        [passwordHash, user.id]
      );
      const session = await rotateSession(client, user.id, null, true);
      return { user: publicUser(user), session };
    });
  }

  async function requestEmailVerification(email) {
    const normalizedEmail = normalizeEmail(email);
    const rawToken = generateSecret();
    const tokenDigest = digestSecret(rawToken);
    const user = await withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT id, email FROM users
         WHERE email = $1 AND account_status = 'active' AND email_verified_at IS NULL
         FOR UPDATE`,
        [normalizedEmail]
      );
      if (selected.rowCount === 0) return null;
      const found = selected.rows[0];
      await client.query(
        `UPDATE email_verification_tokens SET revoked_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [found.id]
      );
      await client.query(
        `INSERT INTO email_verification_tokens (id, user_id, token_digest, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          found.id,
          tokenDigest,
          createExpiry(config.emailVerificationTtlMinutes * 60 * 1000),
        ]
      );
      return found;
    });

    if (user) await deliverEmailVerification({ email: user.email, token: rawToken });
    return { accepted: true };
  }

  async function verifyEmail({ token, previousSessionDigest }) {
    if (typeof token !== 'string') throw new AuthError(INVALID_TOKEN);
    const tokenDigest = digestSecret(token);

    return withTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT t.id AS token_id, u.id, u.email, u.account_status
         FROM email_verification_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_digest = $1
           AND t.consumed_at IS NULL
           AND t.revoked_at IS NULL
           AND t.expires_at > now()
         FOR UPDATE OF t, u`,
        [tokenDigest]
      );
      const user = selected.rows[0];
      if (!user || user.account_status !== 'active') throw new AuthError(INVALID_TOKEN);

      await client.query(
        'UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1',
        [user.token_id]
      );
      await client.query(
        'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1',
        [user.id]
      );
      const session = await rotateSession(client, user.id, previousSessionDigest);
      return { user: publicUser(user), session };
    });
  }

  return {
    changePassword,
    completePasswordReset,
    login,
    logout,
    requestEmailVerification,
    requestPasswordReset,
    signUp,
    verifyEmail,
  };
}

module.exports = {
  AuthError,
  createAuthService,
  normalizeEmail,
  validatePassword,
};
