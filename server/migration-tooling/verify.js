#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { assertDestinationSafety, hasFlag, option } = require('./lib/safety');
const { createReport, increment, incrementUser, issue, writeReports } = require('./lib/report');
const { loadSharedCatalog } = require('./lib/sharedCatalog');
const { normalizeEmail, normalizeWeightUnit } = require('./lib/transform');

async function countIds(client, table, ids, idColumn = 'id') {
  if (!ids.length) return 0;
  return Number((await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${idColumn} = ANY($1)`, [ids])).rows[0].count);
}

async function verifyMigration({ pool, data }) {
  const report = createReport('migration-verification');
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const mappings = [
      ['users','users',(data.tables.authUsers || []).map((x) => x.id),'id'],
      ['profiles','profiles',(data.tables.profiles || []).map((x) => x.user_id),'user_id'],
      ['catalog','meals',(data.tables.meals || []).map((x) => x.id),'id'],
      ['mealLogs','meal_logs',(data.tables.mealLogs || []).map((x) => x.id),'id'],
      ['weights','weights',(data.tables.weights || []).filter((x) => normalizeWeightUnit(x.unit)).map((x) => x.id),'id'],
      ['exerciseLogs','exercise_logs',(data.tables.exerciseLogs || []).map((x) => x.id),'id'],
    ];
    for (const [category, table, ids, column] of mappings) {
      const found = await countIds(client, table, ids, column);
      report.counts[category] = { source: ids.length, destinationByPreservedId: found };
      if (found !== ids.length) issue(report, category, 'row_count_mismatch', null, `Expected ${ids.length} preserved identifiers; found ${found}.`);
    }
    for (const user of data.tables.authUsers || []) {
      const normalized = normalizeEmail(user.email);
      const found = await client.query('SELECT email,password_hash,must_reset_password FROM users WHERE id=$1', [user.id]);
      if (!found.rowCount || found.rows[0].email !== normalized || found.rows[0].password_hash != null || found.rows[0].must_reset_password !== true) issue(report, 'users', 'identity_or_reset_state_mismatch', user.id, 'Preserved identity, normalized email, or reset-required state does not match.');
      if (Number((await client.query('SELECT count(*)::int count FROM sessions WHERE user_id=$1', [user.id])).rows[0].count)) issue(report, 'users', 'active_destination_session', user.id, 'Migrated user has an active destination session.');
    }
    for (const weight of data.tables.weights || []) if (!normalizeWeightUnit(weight.unit)) issue(report, 'weights', 'unknown_source_unit', weight.id, String(weight.unit));
    const checks = {
      duplicateEmails: `SELECT lower(email) key,count(*) FROM users GROUP BY lower(email) HAVING count(*)>1`,
      profileOrphans: `SELECT p.user_id key FROM profiles p LEFT JOIN users u ON u.id=p.user_id WHERE u.id IS NULL`,
      catalogOrphans: `SELECT m.id key FROM meals m LEFT JOIN users u ON u.id=m.user_id WHERE u.id IS NULL`,
      mealLogOrphans: `SELECT l.id key FROM meal_logs l LEFT JOIN users u ON u.id=l.user_id WHERE u.id IS NULL`,
      incompleteMealSnapshots: `SELECT id key FROM meal_logs WHERE jsonb_typeof(item_snapshot)<>'object' OR item_snapshot='{}'::jsonb`,
      weightOrphans: `SELECT w.id key FROM weights w LEFT JOIN users u ON u.id=w.user_id WHERE u.id IS NULL`,
      exerciseLogOrphans: `SELECT l.id key FROM exercise_logs l LEFT JOIN users u ON u.id=l.user_id WHERE u.id IS NULL`,
      duplicateWeightSources: `SELECT user_id||':'||source_record_id key FROM weights WHERE source_record_id IS NOT NULL GROUP BY user_id,source_record_id HAVING count(*)>1`,
      duplicateExerciseSources: `SELECT user_id||':'||source_record_id key FROM exercise_logs WHERE source_record_id IS NOT NULL GROUP BY user_id,source_record_id HAVING count(*)>1`,
      profileLatestWeightMismatch: `SELECT p.user_id key FROM profiles p JOIN LATERAL (SELECT value_kg FROM weights w WHERE w.user_id=p.user_id ORDER BY date DESC,created_at DESC,id DESC LIMIT 1) latest ON true WHERE p.weight_kg IS DISTINCT FROM latest.value_kg`,
    };
    for (const [name, sql] of Object.entries(checks)) {
      const result = await client.query(sql); increment(report, 'integrity', name, result.rowCount);
      result.rows.slice(0, 100).forEach((row) => issue(report, 'integrity', name, row.key, 'Integrity check failed.'));
    }
    const sharedCatalog = await client.query('SELECT id FROM shared_catalog_items');
    const expectedShared = loadSharedCatalog().map((item) => item.id);
    report.counts.sharedCatalog = { expected: expectedShared.length, destination: sharedCatalog.rowCount };
    const sharedIds = new Set(sharedCatalog.rows.map((row) => row.id));
    expectedShared.filter((id) => !sharedIds.has(id)).forEach((id) => issue(report, 'sharedCatalog', 'missing_stable_id', id, 'Authoritative built-in item is absent.'));
    const sharedExercises = await client.query('SELECT id FROM exercise_definitions WHERE is_shared');
    report.counts.sharedExercises = { destination: sharedExercises.rowCount };
    for (const required of ['walk','run','cycle','yoga','swim']) if (!sharedExercises.rows.some((row) => row.id === required)) issue(report, 'sharedExercises', 'missing_stable_id', required, 'Required shared definition is absent.');
    const sourceMealIds = new Set((data.tables.meals || []).map((row) => String(row.id)));
    for (const log of data.tables.mealLogs || []) if (!sourceMealIds.has(String(log.meal_id))) issue(report, 'catalogCoverage', 'source_reference_missing', log.id, String(log.meal_id));
    for (const user of data.tables.authUsers || []) {
      const id = user.id;
      const count = (rows, field='user_id') => rows.filter((row) => row[field] === id).length;
      const destination = await client.query(`SELECT
        (SELECT count(*)::int FROM profiles WHERE user_id=$1) profile,
        (SELECT count(*)::int FROM meals WHERE user_id=$1) catalog_items,
        (SELECT count(*)::int FROM meal_logs WHERE user_id=$1) meal_logs,
        (SELECT count(*)::int FROM weights WHERE user_id=$1) weights,
        (SELECT count(*)::int FROM exercise_definitions WHERE user_id=$1) exercise_definitions,
        (SELECT count(*)::int FROM exercise_logs WHERE user_id=$1) exercise_logs`, [id]);
      const dest = destination.rows[0];
      report.users[id] = {
        profile: { source: (data.tables.profiles || []).some((row) => row.user_id === id) ? 1 : 0, destination: dest.profile },
        catalogItems: { source: count(data.tables.meals || []), destination: dest.catalog_items },
        mealLogs: { source: count(data.tables.mealLogs || []), destination: dest.meal_logs },
        weights: { source: count(data.tables.weights || []), destination: dest.weights },
        exerciseDefinitions: { source: count(data.tables.exerciseTypes || []), destinationUserOwned: dest.exercise_definitions },
        exerciseLogs: { source: count(data.tables.exerciseLogs || []), destination: dest.exercise_logs },
      };
      for (const [category, counts] of Object.entries(report.users[id])) {
        if (counts.destination !== undefined && counts.source !== counts.destination) issue(report, 'perUserCounts', `${category}_mismatch`, id, `source=${counts.source}, destination=${counts.destination}`);
      }
    }
    await client.query('COMMIT');
    report.status = report.issues.length ? 'review-required' : 'verified'; report.completedAt = new Date().toISOString();
    return report;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}

async function main() {
  const argv = process.argv.slice(2); const input = option(argv, 'input');
  if (!input) throw new Error('--input=/path/to/export.json is required.');
  const destinationUrl = process.env.MIGRATION_DESTINATION_DATABASE_URL;
  if (!destinationUrl) throw new Error('MIGRATION_DESTINATION_DATABASE_URL is required.');
  const data = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
  assertDestinationSafety({ destinationUrl, sourceUrl: process.env.SUPABASE_SOURCE_DATABASE_URL, sourceIdentity: data.source?.identityHash, confirmProduction: hasFlag(argv, 'confirm-production') });
  const pool = new Pool({ connectionString: destinationUrl, max: 1 });
  try { const report = await verifyMigration({ pool, data }); const files = await writeReports(report, path.resolve(option(argv,'report-dir','migration-reports')), `verify-${Date.now()}`); console.info(`Verification ${report.status}. Reports: ${files.jsonPath}, ${files.textPath}`); if (report.issues.length) process.exitCode=2; } finally { await pool.end(); }
}
if (require.main === module) main().catch((error) => { console.error(`Verification failed: ${error.message}`); process.exitCode=1; });
module.exports = { verifyMigration };
