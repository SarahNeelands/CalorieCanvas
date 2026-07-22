const { withTransaction } = require('../db');

const PROFILE_COLUMNS = `
  user_id, display_name, dob, gender, height_cm, weight_kg, activity_level,
  goal_weight_intent, goal_muscle_intent, calorie_goal, target_weight_kg,
  target_body_fat_pct, pref_show_calories, pref_show_macros, pref_show_micros,
  pref_show_exercise, pref_show_weight, setup_completed, setup_last_step,
  setup_draft, created_at, updated_at
`;
const NUMERIC_PROFILE_FIELDS = [
  'height_cm', 'weight_kg', 'target_weight_kg', 'target_body_fat_pct',
];

function normalizeProfile(row) {
  if (!row) return null;
  const normalized = { ...row };
  NUMERIC_PROFILE_FIELDS.forEach((field) => {
    if (normalized[field] !== null) normalized[field] = Number(normalized[field]);
  });
  if (normalized.dob instanceof Date) normalized.dob = normalized.dob.toISOString().slice(0, 10);
  return normalized;
}

async function getProfile(queryable, userId) {
  const result = await queryable.query(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return normalizeProfile(result.rows[0]);
}

async function upsertProfile(queryable, userId, patch) {
  const columns = Object.keys(patch);
  const values = columns.map((column) => patch[column]);
  const insertColumns = ['user_id', ...columns];
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
  const assignments = columns.map((column) => `${column} = EXCLUDED.${column}`);
  const result = await queryable.query(
    `INSERT INTO profiles (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${assignments.join(', ')}
     RETURNING ${PROFILE_COLUMNS}`,
    [userId, ...values]
  );
  return normalizeProfile(result.rows[0]);
}

async function getSetupProgress(queryable, userId) {
  const result = await queryable.query(
    `SELECT setup_completed, setup_last_step, setup_draft
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function saveSetupProgress(queryable, userId, setup) {
  const result = await queryable.query(
    `INSERT INTO profiles (
       user_id, setup_completed, setup_last_step, setup_draft
     ) VALUES ($1, false, $2, $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       setup_completed = false,
       setup_last_step = EXCLUDED.setup_last_step,
       setup_draft = EXCLUDED.setup_draft
     RETURNING setup_completed, setup_last_step, setup_draft`,
    [userId, setup.setup_last_step, JSON.stringify(setup.setup_draft)]
  );
  return result.rows[0];
}

async function completeSetup(pool, userId, setupDraft) {
  return withTransaction(pool, async (client) => {
    const completed = await client.query(
      `INSERT INTO profiles (
         user_id, setup_completed, setup_last_step, setup_draft
       ) VALUES ($1, true, NULL, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         setup_completed = true,
         setup_last_step = NULL,
         setup_draft = EXCLUDED.setup_draft
       RETURNING ${PROFILE_COLUMNS}`,
      [userId, JSON.stringify(setupDraft)]
    );

    await client.query(
      `INSERT INTO weights (user_id, date, value, unit)
       SELECT user_id, CURRENT_DATE, weight_kg, 'kg'
       FROM profiles
       WHERE user_id = $1
         AND weight_kg IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM weights WHERE user_id = $1)`,
      [userId]
    );
    return normalizeProfile(completed.rows[0]);
  });
}

async function getLatestWeight(queryable, userId) {
  const result = await queryable.query(
    `SELECT id, date, value, unit, created_at
     FROM weights
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    value: Number(row.value),
  };
}

module.exports = {
  completeSetup,
  getLatestWeight,
  getProfile,
  getSetupProgress,
  normalizeProfile,
  saveSetupProgress,
  upsertProfile,
};
