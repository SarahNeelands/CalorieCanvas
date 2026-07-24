#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { assertDestinationSafety, hasFlag, option } = require('./lib/safety');
const { createReport, increment, incrementUser, issue, writeReports } = require('./lib/report');
const { loadSharedCatalog } = require('./lib/sharedCatalog');
const { normalizeEmail, normalizeWeightUnit, stripEmbeddedMedia, timestampDateUtc, validateProfile } = require('./lib/transform');

const PROFILE_COLUMNS = [
  'user_id', 'display_name', 'dob', 'gender', 'height_cm', 'weight_kg', 'activity_level',
  'goal_weight_intent', 'goal_muscle_intent', 'calorie_goal', 'target_weight_kg',
  'target_body_fat_pct', 'pref_show_calories', 'pref_show_macros', 'pref_show_micros',
  'pref_show_exercise', 'pref_show_weight', 'setup_completed', 'setup_last_step', 'setup_draft',
  'created_at', 'updated_at',
];
const MICRO_FIELDS = Object.freeze({
  fiber_g: ['macros', 'fiber'], sugar_g: ['macros', 'sugar'], cholesterol_mg: ['macros', 'cholesterol'],
  sodium_mg: ['micros', 'sodium'], potassium_mg: ['micros', 'potassium'], calcium_mg: ['micros', 'calcium'],
  iron_mg: ['micros', 'iron'], vitamin_a_mcg: ['micros', 'vitaminA'], vitamin_c_mg: ['micros', 'vitaminC'],
});

function values(row, columns) { return columns.map((column) => row[column] ?? null); }
function placeholders(count) { return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(', '); }
function numeric(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function canonical(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value); if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${key}:${canonical(value[key])}`).join(',')}}`;
  return String(value);
}
function sameScalar(left, right) {
  if ((typeof left === 'number' || typeof right === 'number') && Number.isFinite(Number(left)) && Number.isFinite(Number(right))) return Number(left) === Number(right);
  return canonical(left) === canonical(right);
}

async function insertOrClassify(client, { table, idColumn = 'id', idValue, columns, row, compare = columns, conflictWhere, conflictValues = [], report, category, reference }) {
  const inserted = await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)}) ON CONFLICT DO NOTHING RETURNING ${idColumn}`,
    values(row, columns)
  );
  if (inserted.rowCount) { increment(report, category, 'imported'); return 'imported'; }
  const existing = await client.query(
    `SELECT ${compare.join(', ')} FROM ${table} WHERE ${conflictWhere || `${idColumn} = $1`} LIMIT 2`,
    conflictWhere ? conflictValues : [idValue]
  );
  if (existing.rowCount === 1 && compare.every((column) => sameScalar(existing.rows[0][column], row[column]))) {
    increment(report, category, 'existing'); return 'existing';
  }
  increment(report, category, 'conflicts');
  issue(report, category, 'destination_conflict', reference || idValue, 'A destination record with the same identifier or unique key has different data; no merge was performed.');
  return 'conflict';
}

function deriveHistoricalNutrition(log, meal, report) {
  const direct = { kcal: numeric(log.kcal) ?? 0, protein_g: numeric(log.protein_g) ?? 0, carbs_g: numeric(log.carbs_g) ?? 0, fat_g: numeric(log.fat_g) ?? 0 };
  const missing = {};
  const conversion = meal?.unit_conversions;
  const serving = conversion?.serving_size;
  const reliable = serving && Number(serving.qty) === 100 && String(serving.unit).toLowerCase() === 'g' && numeric(log.grams_resolved) != null;
  for (const [destination, [section, source]] of Object.entries(MICRO_FIELDS)) {
    let raw = conversion?.[section]?.[source];
    if (raw && typeof raw === 'object') raw = raw.value;
    if (reliable && numeric(raw) != null) {
      direct[destination] = Number((Number(raw) * Number(log.grams_resolved) / 100).toFixed(2));
      report.derivations.push({ category: 'mealLogs', record: log.id, field: destination, source: `meals.unit_conversions.${section}.${source}`, rule: '100g serving scaled by grams_resolved' });
      increment(report, 'mealLogNutrients', 'derived');
    } else {
      direct[destination] = 0;
      missing[destination] = true;
      increment(report, 'mealLogNutrients', 'unavailable');
    }
  }
  return { values: direct, unavailable: Object.keys(missing) };
}

async function importMigration({ pool, data, dryRun = false, failAfter = null }) {
  if (data?.formatVersion !== 1 || !data.tables || !data.source?.identityHash) throw new Error('Unsupported or incomplete migration export.');
  const report = createReport('migration-import');
  report.dryRun = dryRun;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const migration = await client.query('SELECT name FROM app_migrations ORDER BY version DESC LIMIT 1');
    if (migration.rows[0]?.name !== '013_create_food_usuals.sql') throw new Error('Destination migrations through 013 are required.');

    const validUsers = new Set();
    for (const source of data.tables.authUsers || []) {
      const email = normalizeEmail(source.email);
      if (!email) { increment(report, 'users', 'invalidEmails'); issue(report, 'users', 'invalid_email', source.id, 'Email is missing or invalid.'); continue; }
      const row = {
        id: source.id, email, password_hash: null, must_reset_password: true,
        email_verified_at: source.email_confirmed_at || source.confirmed_at || null,
        account_status: source.deleted_at || (source.banned_until && new Date(source.banned_until) > new Date()) ? 'disabled' : 'active',
        last_login_at: source.last_sign_in_at || null, password_changed_at: null,
        created_at: source.created_at, updated_at: source.updated_at || source.created_at,
      };
      const byId = await client.query('SELECT id, email, password_hash, must_reset_password FROM users WHERE id = $1 OR lower(email) = $2', [row.id, row.email]);
      if (byId.rowCount) {
        const exact = byId.rows.length === 1 && byId.rows[0].id === row.id && byId.rows[0].email === row.email && byId.rows[0].password_hash == null && byId.rows[0].must_reset_password === true;
        if (!exact) { increment(report, 'users', 'conflicts'); issue(report, 'users', 'uuid_or_email_conflict', row.id, 'UUID/email maps to a different destination user; no merge was performed.'); continue; }
        increment(report, 'users', 'existingMatching');
      } else {
        await client.query(`INSERT INTO users (id,email,password_hash,must_reset_password,email_verified_at,account_status,last_login_at,password_changed_at,created_at,updated_at) VALUES (${placeholders(10)})`, values(row, ['id','email','password_hash','must_reset_password','email_verified_at','account_status','last_login_at','password_changed_at','created_at','updated_at']));
        increment(report, 'users', 'imported');
      }
      await client.query('DELETE FROM sessions WHERE user_id = $1', [row.id]);
      validUsers.add(row.id);
    }
    if (failAfter === 'users') throw new Error('Deliberate rehearsal failure after users.');

    for (const row of data.tables.profiles || []) {
      if (!validUsers.has(row.user_id)) { increment(report, 'profiles', 'missingUsers'); issue(report, 'profiles', 'missing_user', row.user_id, 'Profile owner was not imported.'); continue; }
      const errors = validateProfile(row);
      if (errors.length) { increment(report, 'profiles', 'invalid'); issue(report, 'profiles', errors.join(','), row.user_id, 'Profile failed strict validation and was not imported.'); continue; }
      const state = await insertOrClassify(client, { table: 'profiles', idColumn: 'user_id', idValue: row.user_id, columns: PROFILE_COLUMNS, row, compare: PROFILE_COLUMNS.filter((column) => !['weight_kg','updated_at'].includes(column)), report, category: 'profiles' });
      if (state !== 'conflict') incrementUser(report, row.user_id, 'profile');
    }

    for (const source of loadSharedCatalog()) {
      const stripped = stripEmbeddedMedia(source.unit_conversions);
      const row = { id: source.id, title: source.title, type: source.type, created_at: source.created_at, updated_at: source.created_at, kcal_per_100g: source.kcal_per_100g, protein_g_per_100g: source.protein_g_per_100g, carbs_g_per_100g: source.carbs_g_per_100g, fat_g_per_100g: source.fat_g_per_100g, unit_conversions: stripped.value, food_id: source.food_id };
      await insertOrClassify(client, { table: 'shared_catalog_items', idValue: row.id, columns: Object.keys(row), row, report, category: 'sharedCatalog' });
    }

    const catalog = new Map();
    for (const source of data.tables.meals || []) {
      if (!validUsers.has(source.user_id)) { increment(report, 'catalog', 'missingUsers'); issue(report, 'catalog', 'missing_user', source.id, 'Catalog owner was not imported.'); continue; }
      const stripped = stripEmbeddedMedia(source.unit_conversions);
      const row = { ...source, updated_at: source.updated_at || source.created_at, archived_at: source.archived_at || null, unit_conversions: stripped.value };
      if (!['meal','snack','ingredient'].includes(row.type) || !String(row.title || '').trim() || ['kcal_per_100g','protein_g_per_100g','carbs_g_per_100g','fat_g_per_100g'].some((key) => numeric(row[key]) == null || Number(row[key]) < 0)) {
        increment(report, 'catalog', 'invalid'); issue(report, 'catalog', 'invalid_nutrition_or_shape', row.id, 'Catalog record failed validation.'); continue;
      }
      const columns = ['id','user_id','title','type','created_at','updated_at','archived_at','kcal_per_100g','protein_g_per_100g','carbs_g_per_100g','fat_g_per_100g','unit_conversions','food_id'];
      const state = await insertOrClassify(client, { table: 'meals', idValue: row.id, columns, row, report, category: 'catalog' });
      if (state !== 'conflict') { catalog.set(String(row.id), row); incrementUser(report, row.user_id, 'catalogItems'); }
    }
    if (failAfter === 'catalog') throw new Error('Deliberate rehearsal failure after catalog.');

    let previousLogKey = null; let position = 0;
    for (const source of data.tables.mealLogs || []) {
      if (!validUsers.has(source.user_id)) { increment(report, 'mealLogs', 'ownershipFailures'); issue(report, 'mealLogs', 'missing_user', source.id, 'Meal-log owner was not imported.'); continue; }
      const logDate = timestampDateUtc(source.logged_at);
      if (!logDate) { increment(report, 'mealLogs', 'invalidDates'); issue(report, 'mealLogs', 'invalid_date', source.id, 'logged_at is invalid.'); continue; }
      const meal = catalog.get(String(source.meal_id));
      if (!meal) { increment(report, 'mealLogs', 'missingCatalogReferences'); issue(report, 'mealLogs', 'missing_catalog_reference', source.id, String(source.meal_id)); }
      const nutrition = deriveHistoricalNutrition(source, meal, report);
      const grouping = `${source.user_id}:${source.logged_at}`; position = grouping === previousLogKey ? position + 1 : 0; previousLogKey = grouping;
      const snapshot = meal ? { id: String(meal.id), title: meal.title, type: meal.type, food_id: meal.food_id ?? null, kcal_per_100g: Number(meal.kcal_per_100g), protein_g_per_100g: Number(meal.protein_g_per_100g), carbs_g_per_100g: Number(meal.carbs_g_per_100g), fat_g_per_100g: Number(meal.fat_g_per_100g), unit_conversions: meal.unit_conversions, migration: { source: 'supabase', unavailable_nutrients: nutrition.unavailable } } : { id: String(source.meal_id), migration: { source: 'supabase', catalog_record_missing: true, unavailable_nutrients: nutrition.unavailable } };
      const row = { id: source.id, user_id: source.user_id, meal_id: source.meal_id == null ? null : String(source.meal_id), catalog_source: meal ? 'user' : 'historical', food_id: source.food_id, item_snapshot: snapshot, qty: source.qty, unit_code: source.unit_code, grams_resolved: source.grams_resolved, logged_at: source.logged_at, log_date: logDate, timezone_offset_minutes: 0, meal_type: 'other', position, ...nutrition.values, created_at: source.created_at || source.logged_at, updated_at: source.updated_at || source.created_at || source.logged_at };
      const columns = ['id','user_id','meal_id','catalog_source','food_id','item_snapshot','qty','unit_code','grams_resolved','logged_at','log_date','timezone_offset_minutes','meal_type','position','kcal','protein_g','carbs_g','fat_g',...Object.keys(MICRO_FIELDS),'created_at','updated_at'];
      const state = await insertOrClassify(client, { table: 'meal_logs', idValue: row.id, columns, row, compare: ['id','user_id','meal_id','qty','unit_code','logged_at'], report, category: 'mealLogs' });
      if (state !== 'conflict') { increment(report, 'mealLogSnapshots', 'createdOrExisting'); incrementUser(report, row.user_id, 'mealLogs'); }
    }

    for (const source of data.tables.weights || []) {
      if (!validUsers.has(source.user_id)) { increment(report, 'weights', 'missingUsers'); issue(report, 'weights', 'missing_user', source.id, 'Weight owner was not imported.'); continue; }
      const unit = normalizeWeightUnit(source.unit);
      if (!unit) { increment(report, 'weights', 'unknownUnits'); issue(report, 'weights', 'unknown_unit', source.id, String(source.unit)); continue; }
      const row = { id: source.id, user_id: source.user_id, date: source.date, value: source.value, unit, source_record_id: `supabase:${source.id}`, original_unit: String(source.unit).trim(), created_at: source.created_at, updated_at: source.updated_at || source.created_at };
      const columns = ['id','user_id','date','value','unit','source_record_id','original_unit','created_at','updated_at'];
      const preserved = await client.query('SELECT 1 FROM weights WHERE id=$1', [row.id]);
      if (!preserved.rowCount) {
        const initialCandidates = await client.query(`SELECT id FROM weights WHERE user_id=$1 AND date=$2 AND value=$3 AND unit=$4 AND source_record_id IS NULL ORDER BY created_at,id LIMIT 2`, [row.user_id,row.date,row.value,row.unit]);
        if (initialCandidates.rowCount === 1) {
          await client.query(`UPDATE weights SET id=$1,source_record_id=$2,original_unit=$3,created_at=$4,updated_at=$5 WHERE id=$6`, [row.id,row.source_record_id,row.original_unit,row.created_at,row.updated_at,initialCandidates.rows[0].id]);
          increment(report, 'weights', 'deduplicatedInitialProfileWeight'); increment(report, 'weightUnits', `${row.original_unit}->${unit}`); incrementUser(report, row.user_id, 'weights');
          continue;
        }
        if (initialCandidates.rowCount > 1) issue(report, 'weights', 'ambiguous_initial_weight', row.id, 'Multiple untracked exact destination candidates exist; none was adopted.');
      }
      const state = await insertOrClassify(client, { table: 'weights', idValue: row.id, columns, row, compare: columns.filter((column) => column !== 'updated_at'), report, category: 'weights' });
      if (state !== 'conflict') { increment(report, 'weightUnits', `${row.original_unit}->${unit}`); incrementUser(report, row.user_id, 'weights'); }
    }
    await client.query(`UPDATE profiles p SET weight_kg = latest.value_kg FROM (SELECT DISTINCT ON (user_id) user_id, value_kg FROM weights WHERE value_kg IS NOT NULL ORDER BY user_id, date DESC, created_at DESC, id DESC) latest WHERE p.user_id = latest.user_id AND p.weight_kg IS DISTINCT FROM latest.value_kg`);

    const definitions = new Map();
    for (const source of data.tables.exerciseTypes || []) {
      if (!validUsers.has(source.user_id)) { increment(report, 'exerciseDefinitions', 'missingUsers'); continue; }
      const shared = await client.query('SELECT name FROM exercise_definitions WHERE is_shared AND id = $1', [source.id]);
      if (shared.rowCount && shared.rows[0].name.toLowerCase() === String(source.name).trim().toLowerCase()) { increment(report, 'exerciseDefinitions', 'deduplicatedSharedStableIds'); definitions.set(`${source.user_id}:${source.id}`, { id: source.id, name: shared.rows[0].name, shared: true }); continue; }
      const row = { id: source.id, user_id: source.user_id, is_shared: false, name: String(source.name).trim(), created_at: source.created_at, updated_at: source.updated_at || source.created_at };
      const columns = ['id','user_id','is_shared','name','created_at','updated_at'];
      const state = await insertOrClassify(client, { table: 'exercise_definitions', idColumn: 'id', idValue: row.id, columns, row, compare: columns, conflictWhere: 'user_id = $1 AND id = $2', conflictValues: [row.user_id,row.id], report, category: 'exerciseDefinitions' });
      if (state !== 'conflict') { definitions.set(`${row.user_id}:${row.id}`, row); incrementUser(report, row.user_id, 'exerciseDefinitions'); }
    }

    for (const source of data.tables.exerciseLogs || []) {
      if (!validUsers.has(source.user_id)) { increment(report, 'exerciseLogs', 'missingUsers'); continue; }
      const date = timestampDateUtc(source.timestamp_iso);
      if (!date || !Number.isInteger(Number(source.minutes)) || Number(source.minutes) < 1 || Number(source.minutes) > 1440) { increment(report, 'exerciseLogs', 'invalid'); issue(report, 'exerciseLogs', 'invalid_record', source.id, 'Timestamp or duration is invalid.'); continue; }
      let definition = definitions.get(`${source.user_id}:${source.type_id}`);
      if (!definition) {
        const shared = await client.query('SELECT id,name FROM exercise_definitions WHERE is_shared AND id=$1', [source.type_id]);
        if (shared.rowCount) definition = { ...shared.rows[0], shared: true };
      }
      if (!definition) { increment(report, 'exerciseLogs', 'missingDefinitionReferences'); issue(report, 'exerciseLogs', 'missing_definition', source.id, source.type_id); continue; }
      const row = { id: source.id, user_id: source.user_id, definition_id: source.type_id, definition_snapshot: { id: source.type_id, name: definition.name, source: definition.shared ? 'shared' : 'user' }, duration_minutes: source.minutes, occurred_at: source.timestamp_iso, log_date: date, timezone_offset_minutes: 0, calorie_source: 'none', source_record_id: `supabase:${source.id}`, created_at: source.created_at || source.timestamp_iso, updated_at: source.updated_at || source.created_at || source.timestamp_iso };
      const columns = ['id','user_id','definition_id','definition_snapshot','duration_minutes','occurred_at','log_date','timezone_offset_minutes','calorie_source','source_record_id','created_at','updated_at'];
      const state = await insertOrClassify(client, { table: 'exercise_logs', idValue: row.id, columns, row, compare: columns, report, category: 'exerciseLogs' });
      if (state !== 'conflict') incrementUser(report, row.user_id, 'exerciseLogs');
    }
    if (failAfter === 'exercises') throw new Error('Deliberate rehearsal failure after exercises.');

    if (dryRun) await client.query('ROLLBACK'); else await client.query('COMMIT');
    report.status = dryRun ? 'dry-run-rolled-back' : 'committed';
    report.completedAt = new Date().toISOString();
    report.notes.push('Supabase timestamps have no browser offset; log_date is the UTC calendar date and timezone_offset_minutes is 0 (unknown, represented explicitly).');
    report.notes.push('Source sessions, password hashes, reset tokens, and verification tokens are never imported.');
    return report;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    report.status = 'rolled-back'; report.completedAt = new Date().toISOString();
    error.migrationReport = report; throw error;
  } finally { client.release(); }
}

async function main() {
  const argv = process.argv.slice(2);
  const input = option(argv, 'input');
  if (!input) throw new Error('--input=/path/to/export.json is required.');
  const destinationUrl = process.env.MIGRATION_DESTINATION_DATABASE_URL;
  if (!destinationUrl) throw new Error('MIGRATION_DESTINATION_DATABASE_URL is required.');
  const data = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
  assertDestinationSafety({ destinationUrl, sourceUrl: process.env.SUPABASE_SOURCE_DATABASE_URL, sourceIdentity: data.source?.identityHash, confirmProduction: hasFlag(argv, 'confirm-production') });
  const pool = new Pool({ connectionString: destinationUrl, max: 1 });
  const reportDir = path.resolve(option(argv, 'report-dir', 'migration-reports'));
  try {
    const report = await importMigration({ pool, data, dryRun: hasFlag(argv, 'dry-run') });
    const files = await writeReports(report, reportDir, `import-${Date.now()}`);
    console.info(`Import ${report.status}. Reports: ${files.jsonPath}, ${files.textPath}`);
  } catch (error) {
    if (error.migrationReport) await writeReports(error.migrationReport, reportDir, `import-failed-${Date.now()}`);
    throw error;
  } finally { await pool.end(); }
}

if (require.main === module) main().catch((error) => { console.error(`Import failed: ${error.message}`); process.exitCode = 1; });
module.exports = { deriveHistoricalNutrition, importMigration };
