const { withTransaction } = require('../db');
const catalogModel = require('./catalog');

const MEAL_LOG_COLUMNS = `
  id, user_id, meal_id, catalog_source, food_id, item_snapshot, qty, unit_code,
  grams_resolved, logged_at, log_date, timezone_offset_minutes, meal_type, position,
  kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, cholesterol_mg, sodium_mg,
  potassium_mg, calcium_mg, iron_mg, vitamin_a_mcg, vitamin_c_mg, created_at, updated_at
`;
const NUMERIC_FIELDS = [
  'qty', 'grams_resolved', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
  'sugar_g', 'cholesterol_mg', 'sodium_mg', 'potassium_mg', 'calcium_mg',
  'iron_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
];
const TOTAL_FIELDS = [
  'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'cholesterol_mg',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
];
const SECTION_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

function normalizeSnapshot(snapshot, mealId = null) {
  if (!snapshot) return null;
  const type = snapshot.type || snapshot.item_type || 'meal';
  return { ...snapshot, id: snapshot.id || mealId, type, item_type: type };
}

function normalizeMealLog(row) {
  if (!row) return null;
  const entry = { ...row };
  NUMERIC_FIELDS.forEach((field) => {
    if (entry[field] !== null && entry[field] !== undefined) entry[field] = Number(entry[field]);
  });
  entry.position = Number(entry.position);
  entry.timezone_offset_minutes = Number(entry.timezone_offset_minutes);
  entry.log_date = entry.log_date instanceof Date
    ? entry.log_date.toISOString().slice(0, 10)
    : String(entry.log_date);
  entry.meal = normalizeSnapshot(entry.item_snapshot, entry.meal_id);
  return entry;
}

function toSnapshot(item, mealId = null) {
  if (!item) return null;
  const type = item.type || item.item_type || 'meal';
  return {
    id: item.id || mealId,
    title: item.title,
    type,
    item_type: type,
    unit_conversions: item.unit_conversions || {},
    food_id: item.food_id ?? null,
    kcal_per_100g: Number(item.kcal_per_100g || 0),
    protein_g_per_100g: Number(item.protein_g_per_100g || 0),
    carbs_g_per_100g: Number(item.carbs_g_per_100g || 0),
    fat_g_per_100g: Number(item.fat_g_per_100g || 0),
  };
}

function modelError(message, status = 404) {
  const error = new Error(message);
  error.name = status === 404 ? 'NotFoundError' : 'ValidationError';
  error.status = status;
  return error;
}

async function resolveSnapshot(queryable, userId, mealId, suppliedSnapshot) {
  if (mealId) {
    const catalogItem = await catalogModel.getCatalogItem(queryable, userId, mealId);
    if (catalogItem) {
      return {
        snapshot: toSnapshot(catalogItem, mealId),
        source: catalogItem.is_shared ? 'shared' : 'user',
      };
    }
  }
  if (!suppliedSnapshot) {
    throw modelError('The catalog item is unavailable and no historical snapshot was supplied.', 400);
  }
  return {
    snapshot: toSnapshot(suppliedSnapshot, mealId),
    source: mealId ? 'historical' : 'ad_hoc',
  };
}

async function lockSection(client, userId, logDate, mealType) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`meal-log:${userId}:${logDate}:${mealType}`]
  );
}

async function shiftPositions(client, userId, logDate, mealType, fromPosition, delta) {
  await client.query(
    `UPDATE meal_logs SET position = position + $5
     WHERE user_id = $1 AND log_date = $2 AND meal_type = $3 AND position >= $4`,
    [userId, logDate, mealType, fromPosition, delta]
  );
}

async function compactSection(client, userId, logDate, mealType, removedPosition, excludedId = null) {
  await client.query(
    `UPDATE meal_logs SET position = position - 1
     WHERE user_id = $1 AND log_date = $2 AND meal_type = $3
       AND position > $4 AND ($5::uuid IS NULL OR id <> $5::uuid)`,
    [userId, logDate, mealType, removedPosition, excludedId]
  );
}

function insertValues(userId, input, snapshot, source, position) {
  return [
    userId, input.meal_id ?? null, source, input.food_id ?? snapshot.food_id ?? null,
    JSON.stringify(snapshot), input.qty, input.unit_code, input.grams_resolved,
    input.logged_at, input.log_date, input.timezone_offset_minutes,
    input.meal_type || (snapshot.type === 'snack' ? 'snack' : 'other'), position,
    ...TOTAL_FIELDS.map((field) => input[field] ?? 0),
  ];
}

async function createMealLog(pool, userId, input) {
  return withTransaction(pool, async (client) => {
    const resolved = await resolveSnapshot(client, userId, input.meal_id, input.item_snapshot);
    const mealType = input.meal_type || (resolved.snapshot.type === 'snack' ? 'snack' : 'other');
    await lockSection(client, userId, input.log_date, mealType);
    let position = input.position;
    if (position === undefined) {
      const next = await client.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS position FROM meal_logs
         WHERE user_id = $1 AND log_date = $2 AND meal_type = $3`,
        [userId, input.log_date, mealType]
      );
      position = Number(next.rows[0].position);
    } else {
      await shiftPositions(client, userId, input.log_date, mealType, position, 1);
    }
    const result = await client.query(
      `INSERT INTO meal_logs (
         user_id, meal_id, catalog_source, food_id, item_snapshot, qty, unit_code,
         grams_resolved, logged_at, log_date, timezone_offset_minutes, meal_type, position,
         kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, cholesterol_mg, sodium_mg,
         potassium_mg, calcium_mg, iron_mg, vitamin_a_mcg, vitamin_c_mg
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
       ) RETURNING ${MEAL_LOG_COLUMNS}`,
      insertValues(userId, { ...input, meal_type: mealType }, resolved.snapshot, resolved.source, position)
    );
    return normalizeMealLog(result.rows[0]);
  });
}

async function getOwnedEntry(client, userId, entryId, lock = false) {
  const result = await client.query(
    `SELECT ${MEAL_LOG_COLUMNS} FROM meal_logs
     WHERE user_id = $1 AND id = $2 ${lock ? 'FOR UPDATE' : ''}`,
    [userId, entryId]
  );
  if (!result.rows[0]) throw modelError('Meal log not found.');
  return normalizeMealLog(result.rows[0]);
}

async function updateMealLog(pool, userId, entryId, patch) {
  return withTransaction(pool, async (client) => {
    const current = await getOwnedEntry(client, userId, entryId, true);
    const oldSection = { date: current.log_date, type: current.meal_type, position: current.position };
    const nextDate = patch.log_date ?? current.log_date;
    const nextType = patch.meal_type ?? current.meal_type;
    let nextPosition = patch.position;
    const moved = nextDate !== oldSection.date || nextType !== oldSection.type
      || (nextPosition !== undefined && nextPosition !== oldSection.position);

    if (moved) {
      await lockSection(client, userId, oldSection.date, oldSection.type);
      await lockSection(client, userId, nextDate, nextType);
      await compactSection(client, userId, oldSection.date, oldSection.type, oldSection.position, entryId);
      if (nextPosition === undefined) {
        const next = await client.query(
          `SELECT COALESCE(MAX(position), -1) + 1 AS position FROM meal_logs
           WHERE user_id = $1 AND log_date = $2 AND meal_type = $3 AND id <> $4`,
          [userId, nextDate, nextType, entryId]
        );
        nextPosition = Number(next.rows[0].position);
      } else {
        await client.query(
          `UPDATE meal_logs SET position = position + 1
           WHERE user_id = $1 AND log_date = $2 AND meal_type = $3
             AND position >= $4 AND id <> $5`,
          [userId, nextDate, nextType, nextPosition, entryId]
        );
      }
    }

    let snapshot = current.item_snapshot;
    let source = current.catalog_source;
    const nextMealId = patch.meal_id === undefined ? current.meal_id : patch.meal_id;
    if (patch.meal_id !== undefined && patch.meal_id !== current.meal_id) {
      const resolved = await resolveSnapshot(client, userId, nextMealId, patch.item_snapshot);
      snapshot = resolved.snapshot;
      source = resolved.source;
    } else if (!current.meal_id && patch.item_snapshot) {
      snapshot = toSnapshot(patch.item_snapshot, null);
      source = 'ad_hoc';
    }
    const next = {
      ...current,
      ...patch,
      meal_id: nextMealId,
      catalog_source: source,
      item_snapshot: snapshot,
      log_date: nextDate,
      meal_type: nextType,
      position: moved ? nextPosition : current.position,
    };
    const result = await client.query(
      `UPDATE meal_logs SET
         meal_id = $3, catalog_source = $4, food_id = $5, item_snapshot = $6::jsonb,
         qty = $7, unit_code = $8, grams_resolved = $9, logged_at = $10,
         log_date = $11, timezone_offset_minutes = $12, meal_type = $13, position = $14,
         kcal = $15, protein_g = $16, carbs_g = $17, fat_g = $18, fiber_g = $19,
         sugar_g = $20, cholesterol_mg = $21, sodium_mg = $22, potassium_mg = $23,
         calcium_mg = $24, iron_mg = $25, vitamin_a_mcg = $26, vitamin_c_mg = $27
       WHERE user_id = $1 AND id = $2
       RETURNING ${MEAL_LOG_COLUMNS}`,
      [
        userId, entryId, next.meal_id, next.catalog_source, next.food_id,
        JSON.stringify(next.item_snapshot), next.qty, next.unit_code, next.grams_resolved,
        next.logged_at, next.log_date, next.timezone_offset_minutes, next.meal_type, next.position,
        ...TOTAL_FIELDS.map((field) => next[field]),
      ]
    );
    return normalizeMealLog(result.rows[0]);
  });
}

async function deleteMealLog(pool, userId, entryId) {
  return withTransaction(pool, async (client) => {
    const current = await getOwnedEntry(client, userId, entryId, true);
    await lockSection(client, userId, current.log_date, current.meal_type);
    await client.query('DELETE FROM meal_logs WHERE user_id = $1 AND id = $2', [userId, entryId]);
    await compactSection(client, userId, current.log_date, current.meal_type, current.position);
    return current;
  });
}

async function listMealLogs(queryable, userId, { limit, startDate, endDate }) {
  const result = await queryable.query(
    `SELECT ${MEAL_LOG_COLUMNS} FROM meal_logs
     WHERE user_id = $1
       AND ($2::date IS NULL OR log_date BETWEEN $2::date AND $3::date)
     ORDER BY ${startDate ? 'log_date ASC, meal_type ASC, position ASC, id ASC' : 'logged_at DESC, id DESC'}
     LIMIT $4`,
    [userId, startDate, endDate, limit]
  );
  return result.rows.map(normalizeMealLog);
}

function emptyTotals() {
  return {
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0,
    cholesterol_mg: 0, sodium_mg: 0, potassium_mg: 0, calcium_mg: 0, iron_mg: 0,
    vitamin_a_mcg: 0, vitamin_c_mg: 0, count: 0,
  };
}

async function getDailyTotals(queryable, userId, logDate) {
  const result = await queryable.query(
    `SELECT COUNT(*)::int AS count, ${TOTAL_FIELDS.map((field) => `COALESCE(SUM(${field}), 0) AS ${field}`).join(', ')}
     FROM meal_logs WHERE user_id = $1 AND log_date = $2`,
    [userId, logDate]
  );
  const row = result.rows[0];
  return {
    calories: Number(row.kcal),
    ...Object.fromEntries(TOTAL_FIELDS.slice(1).map((field) => [field, Number(row[field])])),
    count: Number(row.count),
  };
}

async function getDailyTotalsRange(queryable, userId) {
  const result = await queryable.query(
    `SELECT log_date AS date, COALESCE(SUM(kcal), 0) AS total_kcal
     FROM meal_logs
     WHERE user_id = $1
     GROUP BY log_date
     ORDER BY log_date ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    total_kcal: Number(row.total_kcal),
  }));
}

async function deleteMealLogDay(queryable, userId, logDate) {
  const result = await queryable.query(
    'DELETE FROM meal_logs WHERE user_id = $1 AND log_date = $2 RETURNING id',
    [userId, logDate]
  );
  return result.rowCount;
}

async function getMealLogDay(queryable, userId, logDate) {
  const entries = await listMealLogs(queryable, userId, {
    limit: 500, startDate: logDate, endDate: logDate,
  });
  const meals = SECTION_ORDER
    .map((mealType) => ({ meal_type: mealType, entries: entries.filter((entry) => entry.meal_type === mealType) }))
    .filter((section) => section.entries.length > 0);
  return { date: logDate, meals, totals: entries.length ? await getDailyTotals(queryable, userId, logDate) : emptyTotals() };
}

module.exports = {
  createMealLog,
  deleteMealLogDay,
  deleteMealLog,
  emptyTotals,
  getDailyTotals,
  getDailyTotalsRange,
  getMealLogDay,
  listMealLogs,
  normalizeMealLog,
  updateMealLog,
};
