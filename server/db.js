const { Pool } = require('pg');
const { loadEnvironment } = require('./utils/env');

let pool;

function getPool() {
  if (pool) return pool;

  const config = loadEnvironment();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

async function withTransaction(poolOrCallback, optionalCallback) {
  const transactionPool = optionalCallback ? poolOrCallback : getPool();
  const callback = optionalCallback || poolOrCallback;
  const client = await transactionPool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function checkDatabase() {
  await query('SELECT 1');
}

async function closeDatabase() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}

module.exports = {
  checkDatabase,
  closeDatabase,
  getPool,
  query,
  withTransaction,
};
