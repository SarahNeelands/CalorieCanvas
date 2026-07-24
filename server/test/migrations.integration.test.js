const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { Pool } = require('pg');
const { runMigrations } = require('../migrations/run');

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createIsolatedDatabase() {
  const schema = `phase3_${crypto.randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

  const pool = new Pool({
    connectionString,
    options: `-c search_path=${schema},public`,
  });

  return {
    pool,
    schema,
    async cleanup() {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${quoteIdentifier(schema)} CASCADE`);
      await adminPool.end();
    },
  };
}

async function getNames(pool, query) {
  const result = await pool.query(query);
  return result.rows.map((row) => row.name).sort();
}

integrationTest('authentication migrations create the required schema and remain repeatable', async () => {
  const database = await createIsolatedDatabase();

  try {
    await runMigrations({ pool: database.pool });
    await runMigrations({ pool: database.pool });

    const tables = await getNames(database.pool, `
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
    `);
    assert.deepEqual(tables, [
      'app_data_seeds',
      'app_migrations',
      'catalog_sync_operations',
      'email_verification_tokens',
      'exercise_definitions',
      'exercise_logs',
      'exercise_sync_operations',
      'food_usuals',
      'meal_logs',
      'meals',
      'password_reset_tokens',
      'profiles',
      'sessions',
      'shared_catalog_items',
      'users',
      'weight_import_operations',
      'weights',
    ]);

    const ledger = await database.pool.query(
      'SELECT version, name FROM app_migrations ORDER BY version'
    );
    assert.deepEqual(ledger.rows, [
      { version: 1, name: '001_create_users.sql' },
      { version: 2, name: '002_create_sessions.sql' },
      { version: 3, name: '003_create_password_reset_tokens.sql' },
      { version: 4, name: '004_create_email_verification_tokens.sql' },
      { version: 5, name: '005_add_updated_at_triggers.sql' },
      { version: 6, name: '006_create_profiles_and_weights.sql' },
      { version: 7, name: '007_create_catalog.sql' },
      { version: 8, name: '008_create_meal_logs.sql' },
      { version: 9, name: '009_extend_weights.sql' },
      { version: 10, name: '010_create_exercises.sql' },
      { version: 11, name: '011_preserve_weight_original_unit.sql' },
      { version: 12, name: '012_create_data_seed_ledger.sql' },
      { version: 13, name: '013_create_food_usuals.sql' },
    ]);

    const sharedSeed = await database.pool.query(
      'SELECT name, length(checksum) AS checksum_length FROM app_data_seeds'
    );
    assert.deepEqual(sharedSeed.rows, [{ name: 'shared_catalog_v1', checksum_length: 64 }]);
    const sharedCatalogCount = await database.pool.query('SELECT count(*)::integer AS count FROM shared_catalog_items');
    assert.ok(sharedCatalogCount.rows[0].count > 0);

    const constraints = await getNames(database.pool, `
      SELECT constraint_name AS name
      FROM information_schema.table_constraints
      WHERE table_schema = current_schema()
        AND table_name IN (
          'users', 'sessions', 'password_reset_tokens', 'email_verification_tokens',
          'profiles', 'weights', 'weight_import_operations'
        )
    `);
    for (const required of [
      'users_pkey',
      'users_email_normalized_check',
      'users_email_shape_check',
      'users_password_hash_not_blank_check',
      'users_password_state_check',
      'users_account_status_check',
      'users_timestamp_order_check',
      'sessions_pkey',
      'sessions_user_id_fkey',
      'sessions_sid_not_blank_check',
      'sessions_sid_digest_format_check',
      'sessions_timestamp_order_check',
      'password_reset_tokens_pkey',
      'password_reset_tokens_user_id_fkey',
      'password_reset_tokens_digest_format_check',
      'password_reset_tokens_expiration_check',
      'password_reset_tokens_consumed_order_check',
      'password_reset_tokens_revoked_order_check',
      'password_reset_tokens_terminal_state_check',
      'email_verification_tokens_pkey',
      'email_verification_tokens_user_id_fkey',
      'email_verification_tokens_digest_format_check',
      'email_verification_tokens_expiration_check',
      'email_verification_tokens_consumed_order_check',
      'email_verification_tokens_revoked_order_check',
      'email_verification_tokens_terminal_state_check',
      'profiles_pkey',
      'profiles_user_id_fkey',
      'profiles_setup_draft_object_check',
      'profiles_setup_state_check',
      'weights_pkey',
      'weights_user_id_fkey',
      'weights_value_check',
      'weights_value_kg_check',
      'weights_unit_check',
      'weights_original_unit_check',
      'weight_import_operations_pkey',
      'weight_import_operations_user_id_fkey',
    ]) {
      assert.ok(constraints.includes(required), `missing constraint ${required}`);
    }

    const foreignKeys = await database.pool.query(`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
      ORDER BY conname
    `);
    assert.deepEqual(
      foreignKeys.rows.map((row) => row.name),
      [
        'catalog_sync_operations_user_id_fkey',
        'email_verification_tokens_user_id_fkey',
        'exercise_definitions_user_id_fkey',
        'exercise_logs_user_id_fkey',
        'exercise_sync_operations_user_id_fkey',
        'food_usuals_user_id_fkey',
        'meal_logs_user_id_fkey',
        'meals_user_id_fkey',
        'password_reset_tokens_user_id_fkey',
        'profiles_user_id_fkey',
        'sessions_user_id_fkey',
        'weight_import_operations_user_id_fkey',
        'weights_user_id_fkey',
      ]
    );
    foreignKeys.rows.forEach((row) => assert.match(row.definition, /ON DELETE CASCADE/));

    const userColumns = await database.pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'users'
    `);
    const userColumnMap = Object.fromEntries(
      userColumns.rows.map((column) => [column.column_name, column.is_nullable])
    );
    assert.equal(userColumnMap.password_hash, 'YES');
    for (const required of [
      'id',
      'email',
      'must_reset_password',
      'email_verified_at',
      'account_status',
      'last_login_at',
      'password_changed_at',
      'created_at',
      'updated_at',
    ]) {
      assert.ok(required in userColumnMap, `missing users column ${required}`);
    }

    for (const table of ['password_reset_tokens', 'email_verification_tokens']) {
      const tokenColumns = await database.pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1`,
        [table]
      );
      const names = tokenColumns.rows.map((row) => row.column_name);
      assert.ok(names.includes('token_digest'));
      assert.ok(!names.includes('token'));
      assert.ok(names.includes('expires_at'));
      assert.ok(names.includes('consumed_at'));
      assert.ok(names.includes('revoked_at'));
    }

    const indexes = await getNames(database.pool, `
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `);
    for (const required of [
      'users_email_normalized_unique',
      'users_account_status_idx',
      'sessions_expire_idx',
      'sessions_user_id_idx',
      'password_reset_tokens_digest_unique',
      'password_reset_tokens_user_id_idx',
      'password_reset_tokens_cleanup_idx',
      'email_verification_tokens_digest_unique',
      'email_verification_tokens_user_id_idx',
      'email_verification_tokens_cleanup_idx',
      'idx_profiles_updated_at',
      'idx_weights_user_date',
      'weights_user_source_record_unique',
      'weight_import_operations_created_at_idx',
      'exercise_definitions_shared_id_unique',
      'exercise_definitions_user_id_unique',
      'exercise_logs_user_source_unique',
      'exercise_logs_user_date_idx',
      'exercise_sync_operations_created_at_idx',
      'idx_food_usuals_user_position',
    ]) {
      assert.ok(indexes.includes(required), `missing index ${required}`);
    }

    const triggers = await getNames(database.pool, `
      SELECT tgname AS name
      FROM pg_trigger
      WHERE tgrelid IN (
        'users'::regclass, 'sessions'::regclass, 'profiles'::regclass,
        'meal_logs'::regclass, 'meals'::regclass, 'shared_catalog_items'::regclass,
        'weights'::regclass, 'food_usuals'::regclass
        , 'exercise_definitions'::regclass, 'exercise_logs'::regclass
      )
        AND NOT tgisinternal
    `);
    assert.deepEqual(triggers, [
      'exercise_definitions_set_updated_at',
      'exercise_logs_set_updated_at',
      'food_usuals_set_updated_at',
      'meal_logs_set_updated_at',
      'meals_set_updated_at',
      'profiles_set_updated_at',
      'sessions_set_updated_at',
      'shared_catalog_items_set_updated_at',
      'users_set_updated_at',
      'weights_set_updated_at',
    ]);

    const migratedUserId = crypto.randomUUID();
    await database.pool.query(
      `INSERT INTO users (id, email, password_hash, must_reset_password)
       VALUES ($1, $2, NULL, true)`,
      [migratedUserId, 'migrated@example.com']
    );
    const migratedUser = await database.pool.query(
      `SELECT id, email, password_hash, must_reset_password, account_status
       FROM users WHERE id = $1`,
      [migratedUserId]
    );
    assert.deepEqual(migratedUser.rows[0], {
      id: migratedUserId,
      email: 'migrated@example.com',
      password_hash: null,
      must_reset_password: true,
      account_status: 'active',
    });

    await assert.rejects(
      database.pool.query(
        'INSERT INTO users (id, email) VALUES ($1, $2)',
        [crypto.randomUUID(), 'Migrated@Example.com']
      ),
      (error) => error.code === '23514' && error.constraint === 'users_email_normalized_check'
    );
    await assert.rejects(
      database.pool.query(
        'INSERT INTO users (id, email) VALUES ($1, $2)',
        [crypto.randomUUID(), 'migrated@example.com']
      ),
      (error) => error.code === '23505' && error.constraint === 'users_email_normalized_unique'
    );
    await assert.rejects(
      database.pool.query(
        `INSERT INTO users (id, email, password_hash, must_reset_password)
         VALUES ($1, $2, NULL, false)`,
        [crypto.randomUUID(), 'invalid-password-state@example.com']
      ),
      (error) => error.code === '23514' && error.constraint === 'users_password_state_check'
    );

    await database.pool.query(
      `INSERT INTO sessions (sid, sess, expire, user_id)
       VALUES ($1, $2, now() + interval '1 day', $3)`,
      ['d'.repeat(64), JSON.stringify({ cookie: {} }), migratedUserId]
    );

    const originalUpdatedAt = await database.pool.query(
      'SELECT updated_at FROM users WHERE id = $1',
      [migratedUserId]
    );
    await database.pool.query(
      `UPDATE users SET updated_at = updated_at - interval '1 day' WHERE id = $1`,
      [migratedUserId]
    );
    const triggeredUpdatedAt = await database.pool.query(
      'SELECT updated_at FROM users WHERE id = $1',
      [migratedUserId]
    );
    assert.ok(triggeredUpdatedAt.rows[0].updated_at >= originalUpdatedAt.rows[0].updated_at);

    const passwordTokenId = crypto.randomUUID();
    const passwordDigest = 'a'.repeat(64);
    await database.pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_digest, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [passwordTokenId, migratedUserId, passwordDigest]
    );
    const firstConsumption = await database.pool.query(
      `UPDATE password_reset_tokens
       SET consumed_at = now()
       WHERE id = $1
         AND consumed_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [passwordTokenId]
    );
    const secondConsumption = await database.pool.query(
      `UPDATE password_reset_tokens
       SET consumed_at = now()
       WHERE id = $1
         AND consumed_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [passwordTokenId]
    );
    assert.equal(firstConsumption.rowCount, 1);
    assert.equal(secondConsumption.rowCount, 0);

    await assert.rejects(
      database.pool.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_digest, expires_at)
         VALUES ($1, $2, $3, now() - interval '1 minute')`,
        [crypto.randomUUID(), migratedUserId, 'b'.repeat(64)]
      ),
      (error) => error.code === '23514' && error.constraint === 'password_reset_tokens_expiration_check'
    );

    const verificationTokenId = crypto.randomUUID();
    await database.pool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_digest, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 day')`,
      [verificationTokenId, migratedUserId, 'c'.repeat(64)]
    );
    const verificationToken = await database.pool.query(
      `SELECT consumed_at, revoked_at, expires_at > now() AS active
       FROM email_verification_tokens WHERE id = $1`,
      [verificationTokenId]
    );
    assert.deepEqual(verificationToken.rows[0], {
      consumed_at: null,
      revoked_at: null,
      active: true,
    });

    await assert.rejects(
      database.pool.query(
        `UPDATE email_verification_tokens
         SET consumed_at = now(), revoked_at = now()
         WHERE id = $1`,
        [verificationTokenId]
      ),
      (error) => error.code === '23514' && error.constraint === 'email_verification_tokens_terminal_state_check'
    );

    await assert.rejects(
      database.pool.query(
        `INSERT INTO sessions (sid, sess, expire, user_id)
         VALUES ($1, $2, now() + interval '1 day', $3)`,
        ['e'.repeat(64), JSON.stringify({}), crypto.randomUUID()]
      ),
      (error) => error.code === '23503' && error.constraint === 'sessions_user_id_fkey'
    );
  } finally {
    await database.cleanup();
  }
});

integrationTest('a failed migration rolls back its schema and ledger changes safely', async () => {
  const database = await createIsolatedDatabase();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'calorie-canvas-migrations-'));

  try {
    await fs.writeFile(
      path.join(directory, '001_create_probe.sql'),
      'CREATE TABLE migration_probe (id integer PRIMARY KEY);\n'
    );
    await fs.writeFile(
      path.join(directory, '002_fail_after_change.sql'),
      'CREATE TABLE rolled_back_table (id integer); SELECT * FROM missing_relation;\n'
    );

    await assert.rejects(
      runMigrations({ pool: database.pool, directory }),
      /Migration 002_fail_after_change.sql failed/
    );

    const tablesAfterFailure = await getNames(database.pool, `
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
    `);
    assert.ok(tablesAfterFailure.includes('migration_probe'));
    assert.ok(!tablesAfterFailure.includes('rolled_back_table'));

    const ledgerAfterFailure = await database.pool.query(
      'SELECT version, name FROM app_migrations ORDER BY version'
    );
    assert.deepEqual(ledgerAfterFailure.rows, [
      { version: 1, name: '001_create_probe.sql' },
    ]);

    await fs.writeFile(
      path.join(directory, '002_fail_after_change.sql'),
      'CREATE TABLE recovered_table (id integer PRIMARY KEY);\n'
    );
    await runMigrations({ pool: database.pool, directory });

    const ledgerAfterRecovery = await database.pool.query(
      'SELECT version, name FROM app_migrations ORDER BY version'
    );
    assert.deepEqual(ledgerAfterRecovery.rows, [
      { version: 1, name: '001_create_probe.sql' },
      { version: 2, name: '002_fail_after_change.sql' },
    ]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    await database.cleanup();
  }
});
