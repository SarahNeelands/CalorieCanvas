const catalogModel = require('./catalog');

const USUAL_COLUMNS = `
  id, user_id, meal_id, item_snapshot, default_qty, unit_code, custom_label,
  position, created_at, updated_at
`;

function normalizeSnapshot(item) {
  const type = item.type || item.item_type || 'meal';
  return {
    id: item.id,
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

function normalizeUsual(row) {
  if (!row) return null;
  return {
    ...row,
    default_qty: Number(row.default_qty),
    position: Number(row.position),
    item: row.item_snapshot,
  };
}

function modelError(message, status = 404) {
  const error = new Error(message);
  error.name = status === 404 ? 'NotFoundError' : 'ValidationError';
  error.status = status;
  return error;
}

async function resolveOwnedCatalogItem(queryable, userId, mealId) {
  const item = await catalogModel.getCatalogItem(queryable, userId, mealId);
  if (!item) throw modelError('The selected food is unavailable.', 400);
  if (item.unit_conversions?.recipe_status === 'awaiting_final_weight') {
    throw modelError('Finish the recipe before adding it to My Usuals.', 400);
  }
  return item;
}

async function listUsuals(queryable, userId) {
  const result = await queryable.query(
    `SELECT ${USUAL_COLUMNS} FROM food_usuals
     WHERE user_id = $1 ORDER BY position ASC, created_at ASC, id ASC`,
    [userId]
  );
  return result.rows.map(normalizeUsual);
}

async function upsertUsual(queryable, userId, input) {
  const item = await resolveOwnedCatalogItem(queryable, userId, input.meal_id);
  const result = await queryable.query(
    `INSERT INTO food_usuals (
       user_id, meal_id, item_snapshot, default_qty, unit_code, custom_label, position
     ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     ON CONFLICT (user_id, meal_id) DO UPDATE SET
       item_snapshot = EXCLUDED.item_snapshot,
       default_qty = EXCLUDED.default_qty,
       unit_code = EXCLUDED.unit_code,
       custom_label = EXCLUDED.custom_label,
       position = EXCLUDED.position
     RETURNING ${USUAL_COLUMNS}`,
    [
      userId,
      input.meal_id,
      JSON.stringify(normalizeSnapshot(item)),
      input.default_qty,
      input.unit_code,
      input.custom_label ?? null,
      input.position ?? 0,
    ]
  );
  return normalizeUsual(result.rows[0]);
}

async function getOwnedUsual(queryable, userId, usualId) {
  const result = await queryable.query(
    `SELECT ${USUAL_COLUMNS} FROM food_usuals WHERE user_id = $1 AND id = $2`,
    [userId, usualId]
  );
  if (!result.rows[0]) throw modelError('Usual not found.');
  return normalizeUsual(result.rows[0]);
}

async function updateUsual(queryable, userId, usualId, patch) {
  const current = await getOwnedUsual(queryable, userId, usualId);
  const next = { ...current, ...patch };
  const item = patch.meal_id
    ? await resolveOwnedCatalogItem(queryable, userId, patch.meal_id)
    : current.item_snapshot;
  const result = await queryable.query(
    `UPDATE food_usuals SET
       meal_id = $3, item_snapshot = $4::jsonb, default_qty = $5, unit_code = $6,
       custom_label = $7, position = $8
     WHERE user_id = $1 AND id = $2
     RETURNING ${USUAL_COLUMNS}`,
    [
      userId,
      usualId,
      next.meal_id,
      JSON.stringify(normalizeSnapshot(item)),
      next.default_qty,
      next.unit_code,
      next.custom_label ?? null,
      next.position,
    ]
  );
  return normalizeUsual(result.rows[0]);
}

async function deleteUsual(queryable, userId, usualId) {
  const result = await queryable.query(
    'DELETE FROM food_usuals WHERE user_id = $1 AND id = $2 RETURNING id',
    [userId, usualId]
  );
  if (!result.rows[0]) throw modelError('Usual not found.');
}

module.exports = {
  deleteUsual,
  listUsuals,
  normalizeUsual,
  updateUsual,
  upsertUsual,
};
