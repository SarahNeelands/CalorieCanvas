const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { closeDatabase, getPool } = require('../db');
const { seedSharedCatalog } = require('../seeds/sharedCatalog');

const MIGRATIONS_DIRECTORY = __dirname;
const MIGRATION_FILE_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_ID = 1_846_202_603;

function validateMigrationFiles(files) {
  const migrations = files.map((name) => {
    const match = MIGRATION_FILE_PATTERN.exec(name);
    if (!match) {
      throw new Error(
        `Invalid migration filename "${name}". Expected a name such as 001_create_users.sql.`
      );
    }

    return { name, version: Number(match[1]) };
  });

  migrations.sort((left, right) => left.version - right.version || left.name.localeCompare(right.name));

  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw new Error(
        `Migration sequence is not contiguous: expected ${String(expectedVersion).padStart(3, '0')}, ` +
        `found ${String(migration.version).padStart(3, '0')} in ${migration.name}.`
      );
    }
  });

  return migrations;
}

async function listMigrationFiles(directory = MIGRATIONS_DIRECTORY) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name);

  return validateMigrationFiles(sqlFiles);
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

async function prepareMigrationLedger(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('ALTER TABLE app_migrations ADD COLUMN IF NOT EXISTS version integer');
    await client.query('ALTER TABLE app_migrations ADD COLUMN IF NOT EXISTS checksum text');

    const legacyRows = await client.query(
      'SELECT name FROM app_migrations WHERE version IS NULL OR checksum IS NULL LIMIT 1'
    );
    if (legacyRows.rowCount > 0) {
      throw new Error(
        'The migration ledger contains legacy rows without versions or checksums; manual review is required.'
      );
    }

    await client.query('ALTER TABLE app_migrations ALTER COLUMN version SET NOT NULL');
    await client.query('ALTER TABLE app_migrations ALTER COLUMN checksum SET NOT NULL');
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS app_migrations_version_unique ON app_migrations (version)'
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function verifyAppliedMigrations(available, applied) {
  if (applied.length > available.length) {
    throw new Error('The migration ledger contains versions that are not present on disk.');
  }

  applied.forEach((row, index) => {
    const expected = available[index];
    if (!expected || row.version !== expected.version || row.name !== expected.name) {
      throw new Error(
        `Applied migration order does not match the files on disk at version ${row.version}.`
      );
    }
    if (row.checksum !== expected.checksum) {
      throw new Error(`Applied migration ${row.name} has changed since it was recorded.`);
    }
  });
}

async function loadMigrations(directory) {
  const migrations = await listMigrationFiles(directory);
  return Promise.all(
    migrations.map(async (migration) => {
      const sql = await fs.readFile(path.join(directory, migration.name), 'utf8');
      return { ...migration, sql, checksum: checksum(sql) };
    })
  );
}

async function runMigrations({ pool = getPool(), directory = MIGRATIONS_DIRECTORY } = {}) {
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await prepareMigrationLedger(client);

    const appliedResult = await client.query(
      'SELECT version, name, checksum FROM app_migrations ORDER BY version ASC'
    );
    verifyAppliedMigrations(migrations, appliedResult.rows);

    for (const migration of migrations.slice(appliedResult.rowCount)) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO app_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${migration.name} failed.`, { cause: error });
      }
    }
    if (directory === MIGRATIONS_DIRECTORY) await seedSharedCatalog(client);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => console.info('Database migrations are up to date.'))
    .catch((error) => {
      console.error('Database migration failed.', error);
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

module.exports = {
  checksum,
  listMigrationFiles,
  runMigrations,
  validateMigrationFiles,
  verifyAppliedMigrations,
};
