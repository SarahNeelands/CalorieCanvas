#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { databaseIdentity, option } = require('./lib/safety');
const { stripEmbeddedMedia } = require('./lib/transform');

const TABLE_QUERIES = Object.freeze({
  authUsers: `SELECT id, email, email_confirmed_at, confirmed_at, created_at, updated_at, last_sign_in_at, banned_until, deleted_at FROM auth.users ORDER BY id`,
  profiles: 'SELECT * FROM public.profiles ORDER BY user_id',
  meals: 'SELECT * FROM public.meals ORDER BY user_id, id',
  mealLogs: 'SELECT * FROM public.meal_logs ORDER BY user_id, logged_at, id',
  weights: 'SELECT * FROM public.weights ORDER BY user_id, date, created_at, id',
  exerciseTypes: 'SELECT * FROM public.exercise_types ORDER BY user_id, id',
  exerciseLogs: 'SELECT * FROM public.exercise_logs ORDER BY user_id, timestamp_iso, id',
});

async function exportSupabase({ pool, sourceUrl }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = {};
    for (const [name, sql] of Object.entries(TABLE_QUERIES)) tables[name] = (await client.query(sql)).rows;
    let removedPhotoCount = 0;
    let removedPhotoBytes = 0;
    tables.meals = tables.meals.map((meal) => {
      const stripped = stripEmbeddedMedia(meal.unit_conversions);
      if (stripped.removedPhotoBytes) removedPhotoCount += 1;
      removedPhotoBytes += stripped.removedPhotoBytes;
      return { ...meal, unit_conversions: stripped.value };
    });
    const weightUnits = [...new Set(tables.weights.map((row) => row.unit))].sort();
    await client.query('COMMIT');
    return {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { kind: 'supabase-postgresql', identityHash: databaseIdentity(sourceUrl), readOnlySnapshot: true },
      tables,
      audit: { weightUnits, embeddedMedia: { removedPhotoCount, removedPhotoBytes } },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function main() {
  const sourceUrl = process.env.SUPABASE_SOURCE_DATABASE_URL;
  if (!sourceUrl) throw new Error('SUPABASE_SOURCE_DATABASE_URL is required.');
  const output = path.resolve(option(process.argv.slice(2), 'output', `calorie-canvas-export-${Date.now()}.json`));
  const pool = new Pool({ connectionString: sourceUrl, max: 1 });
  try {
    const data = await exportSupabase({ pool, sourceUrl });
    await fs.writeFile(output, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    console.info(`Read-only export written to ${output}. Tables: ${Object.entries(data.tables).map(([k, v]) => `${k}=${v.length}`).join(', ')}.`);
  } finally { await pool.end(); }
}

if (require.main === module) main().catch((error) => { console.error(`Export failed: ${error.message}`); process.exitCode = 1; });
module.exports = { TABLE_QUERIES, exportSupabase };
