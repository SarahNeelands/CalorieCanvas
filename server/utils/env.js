function parsePort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseBoolean(value, name) {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`${name} must be either true or false.`);
}

function parseInteger(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function validateOrigin(value, name = 'APP_ORIGINS') {
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must contain valid HTTP or HTTPS origins.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value) {
    throw new Error(`${name} entries must be origins without paths.`);
  }
  return value;
}

function parseOrigins(env) {
  const values = [env.APP_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values.map((value) => validateOrigin(value)))];
}

function validateDatabaseUrl(value) {
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }

  return value;
}

function loadEnvironment(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const appOrigins = parseOrigins(env);
  const databaseUrl = validateDatabaseUrl(env.DATABASE_URL);
  if (nodeEnv === 'production' && !databaseUrl) throw new Error('DATABASE_URL is required in production.');
  if (nodeEnv === 'production' && appOrigins.length === 0) throw new Error('APP_ORIGINS is required in production.');
  const sessionTtlHours = parseInteger(
    env.SESSION_TTL_HOURS || '168',
    'SESSION_TTL_HOURS',
    1,
    24 * 365
  );
  const sessionRenewalThresholdHours = parseInteger(
    env.SESSION_RENEWAL_THRESHOLD_HOURS || '24',
    'SESSION_RENEWAL_THRESHOLD_HOURS',
    1,
    24 * 30
  );
  if (sessionRenewalThresholdHours >= sessionTtlHours) {
    throw new Error('SESSION_RENEWAL_THRESHOLD_HOURS must be less than SESSION_TTL_HOURS.');
  }
  const cookieSecure = parseBoolean(
    env.SESSION_COOKIE_SECURE || String(nodeEnv === 'production'),
    'SESSION_COOKIE_SECURE'
  );
  if (nodeEnv === 'production' && !cookieSecure) {
    throw new Error('SESSION_COOKIE_SECURE must be true in production.');
  }
  return {
    nodeEnv,
    host: env.SERVER_HOST || '127.0.0.1',
    port: parsePort(env.SERVER_PORT || '3001'),
    databaseUrl,
    databaseSsl: parseBoolean(env.DATABASE_SSL || 'false', 'DATABASE_SSL'),
    auth: {
      appOrigins,
      bcryptRounds: parseInteger(env.BCRYPT_ROUNDS || '12', 'BCRYPT_ROUNDS', 10, 15),
      cookieName: env.SESSION_COOKIE_NAME || 'cc_session',
      csrfCookieName: env.CSRF_COOKIE_NAME || 'cc_csrf',
      cookieSecure,
      sessionTtlHours,
      sessionRenewalThresholdHours,
      passwordResetTtlMinutes: parseInteger(
        env.PASSWORD_RESET_TTL_MINUTES || '60',
        'PASSWORD_RESET_TTL_MINUTES',
        5,
        24 * 60
      ),
      emailVerificationTtlMinutes: parseInteger(
        env.EMAIL_VERIFICATION_TTL_MINUTES || '1440',
        'EMAIL_VERIFICATION_TTL_MINUTES',
        5,
        7 * 24 * 60
      ),
      rateLimits: {
        windowMinutes: parseInteger(
          env.AUTH_RATE_LIMIT_WINDOW_MINUTES || '15',
          'AUTH_RATE_LIMIT_WINDOW_MINUTES',
          1,
          24 * 60
        ),
        login: parseInteger(env.LOGIN_RATE_LIMIT_MAX || '10', 'LOGIN_RATE_LIMIT_MAX', 1, 1000),
        signup: parseInteger(env.SIGNUP_RATE_LIMIT_MAX || '5', 'SIGNUP_RATE_LIMIT_MAX', 1, 1000),
        passwordAction: parseInteger(
          env.PASSWORD_ACTION_RATE_LIMIT_MAX || '5',
          'PASSWORD_ACTION_RATE_LIMIT_MAX',
          1,
          1000
        ),
      },
    },
  };
}

module.exports = { loadEnvironment };
