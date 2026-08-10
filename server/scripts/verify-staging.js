const { getPool, closeDatabase } = require('../db');

async function count(pool, table, predicate = '') {
  const result = await pool.query(`SELECT count(*)::integer AS count FROM ${table} ${predicate}`);
  return result.rows[0].count;
}

async function verifyStaging() {
  const pool = getPool();
  const results = {
    migrations: await count(pool, 'app_migrations'),
    migrationVersion: (await pool.query('SELECT max(version)::integer AS version FROM app_migrations')).rows[0].version,
    seedLedger: await count(pool, 'app_data_seeds'),
    sharedCatalogItems: await count(pool, 'shared_catalog_items'),
    sharedExerciseDefinitions: await count(pool, 'exercise_definitions', 'WHERE is_shared'),
    users: await count(pool, 'users'),
    sessions: await count(pool, 'sessions'),
  };
  console.info(JSON.stringify(results, null, 2));
  const expected = results.migrations === 14
    && results.migrationVersion === 14
    && results.seedLedger === 1
    && results.sharedCatalogItems === 70
    && results.sharedExerciseDefinitions === 5;
  if (!expected) throw new Error('Staging schema or deterministic seed verification failed.');
}

verifyStaging()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
