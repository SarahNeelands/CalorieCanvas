const crypto = require('node:crypto');
const { withTransaction } = require('../db');

const SHARED_CATALOG_USER_ID = '__shared_catalog__';
const CATALOG_COLUMNS = `
  id::text AS id, user_id::text AS user_id, title, type, created_at, updated_at,
  archived_at, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g,
  fat_g_per_100g, unit_conversions, food_id, false AS is_shared
`;

function normalizeCatalogItem(row) {
  if (!row) return null;
  return {
    ...row,
    item_type: row.type,
    kcal_per_100g: Number(row.kcal_per_100g),
    protein_g_per_100g: Number(row.protein_g_per_100g),
    carbs_g_per_100g: Number(row.carbs_g_per_100g),
    fat_g_per_100g: Number(row.fat_g_per_100g),
  };
}

function sharedSelect() {
  return `
    id, '${SHARED_CATALOG_USER_ID}'::text AS user_id, title, type, created_at, updated_at,
    NULL::timestamptz AS archived_at, kcal_per_100g, protein_g_per_100g,
    carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id, true AS is_shared
  `;
}

async function listCatalogItems(queryable, userId, { itemType, query = '', limit = 200 }) {
  const result = await queryable.query(
    `SELECT * FROM (
       SELECT ${CATALOG_COLUMNS}
       FROM meals
       WHERE user_id = $1 AND type = $2 AND archived_at IS NULL
       UNION ALL
       SELECT ${sharedSelect()}
       FROM shared_catalog_items
       WHERE type = $2
     ) AS catalog
     WHERE $3 = '' OR position(lower($3) in lower(title)) > 0
     ORDER BY created_at DESC, id ASC
     LIMIT $4`,
    [userId, itemType, query, limit]
  );
  return result.rows.map(normalizeCatalogItem);
}

async function getCatalogItem(queryable, userId, itemId) {
  const result = await queryable.query(
    `SELECT * FROM (
       SELECT ${CATALOG_COLUMNS}
       FROM meals WHERE user_id = $1 AND id::text = $2
       UNION ALL
       SELECT ${sharedSelect()}
       FROM shared_catalog_items WHERE id = $2
     ) AS catalog
     LIMIT 1`,
    [userId, itemId]
  );
  return normalizeCatalogItem(result.rows[0]);
}

function inputValues(userId, input) {
  return [
    userId,
    input.title,
    input.item_type,
    input.created_at,
    input.kcal_per_100g,
    input.protein_g_per_100g,
    input.carbs_g_per_100g,
    input.fat_g_per_100g,
    JSON.stringify(input.unit_conversions),
    input.food_id,
  ];
}

async function createCatalogItem(queryable, userId, input) {
  const result = await queryable.query(
    `INSERT INTO meals (
       user_id, title, type, created_at, kcal_per_100g, protein_g_per_100g,
       carbs_g_per_100g, fat_g_per_100g, unit_conversions, food_id
     ) VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, $6, $7, $8, $9::jsonb, $10)
     RETURNING ${CATALOG_COLUMNS}`,
    inputValues(userId, input)
  );
  return normalizeCatalogItem(result.rows[0]);
}

function catalogError(message, status, name) {
  const error = new Error(message);
  error.status = status;
  error.name = name;
  return error;
}

async function requireOwnedItem(queryable, userId, itemId) {
  const result = await queryable.query(
    'SELECT updated_at FROM meals WHERE user_id = $1 AND id::text = $2',
    [userId, itemId]
  );
  if (!result.rows[0]) throw catalogError('Catalog item not found.', 404, 'NotFoundError');
  return result.rows[0];
}

async function updateCatalogItem(queryable, userId, itemId, input) {
  const values = [
    userId, input.title, input.item_type, input.kcal_per_100g,
    input.protein_g_per_100g, input.carbs_g_per_100g, input.fat_g_per_100g,
    JSON.stringify(input.unit_conversions), input.food_id, itemId, input.base_updated_at,
  ];
  const result = await queryable.query(
    `UPDATE meals SET
       title = $2, type = $3, kcal_per_100g = $4, protein_g_per_100g = $5,
       carbs_g_per_100g = $6, fat_g_per_100g = $7, unit_conversions = $8::jsonb,
       food_id = $9
     WHERE user_id = $1 AND id::text = $10
       AND (
         $11::timestamptz IS NULL
         OR date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $11::timestamptz)
       )
     RETURNING ${CATALOG_COLUMNS}`,
    values
  );
  if (result.rows[0]) return normalizeCatalogItem(result.rows[0]);
  const existing = await requireOwnedItem(queryable, userId, itemId);
  if (input.base_updated_at && existing) {
    throw catalogError('Catalog item changed before this update was applied.', 409, 'ConflictError');
  }
  throw catalogError('Catalog item not found.', 404, 'NotFoundError');
}

async function deleteCatalogItem(queryable, userId, itemId) {
  const result = await queryable.query(
    `DELETE FROM meals WHERE user_id = $1 AND id::text = $2
     RETURNING ${CATALOG_COLUMNS}`,
    [userId, itemId]
  );
  if (!result.rows[0]) throw catalogError('Catalog item not found.', 404, 'NotFoundError');
  return normalizeCatalogItem(result.rows[0]);
}

async function archiveCatalogItem(queryable, userId, itemId) {
  const result = await queryable.query(
    `UPDATE meals SET archived_at = COALESCE(archived_at, now())
     WHERE user_id = $1 AND id::text = $2
     RETURNING ${CATALOG_COLUMNS}`,
    [userId, itemId]
  );
  if (!result.rows[0]) throw catalogError('Catalog item not found.', 404, 'NotFoundError');
  return normalizeCatalogItem(result.rows[0]);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function operationDigest(operation) {
  return crypto.createHash('sha256').update(stableJson(operation)).digest('hex');
}

async function applySyncOperation(pool, userId, operation) {
  return withTransaction(pool, async (client) => {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`${userId}:${operation.operationId}`]
    );
    const digest = operationDigest(operation);
    const replay = await client.query(
      `SELECT request_digest, result FROM catalog_sync_operations
       WHERE user_id = $1 AND operation_id = $2`,
      [userId, operation.operationId]
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_digest !== digest) {
        throw catalogError('A sync operation ID was reused with different content.', 409, 'ConflictError');
      }
      return { ...replay.rows[0].result, replayed: true };
    }

    let item;
    if (operation.kind === 'create') {
      item = await createCatalogItem(client, userId, operation.input);
    } else if (operation.kind === 'update') {
      item = await updateCatalogItem(client, userId, operation.itemId, operation.input);
    } else if (operation.kind === 'archive') {
      item = await archiveCatalogItem(client, userId, operation.itemId);
    } else {
      item = await deleteCatalogItem(client, userId, operation.itemId);
    }
    const result = {
      status: 'completed',
      operationId: operation.operationId,
      kind: operation.kind,
      item,
      itemId: item.id,
      ...(operation.tempId ? { tempId: operation.tempId } : {}),
    };
    await client.query(
      `INSERT INTO catalog_sync_operations (
         user_id, operation_id, operation_kind, request_digest, result
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, operation.operationId, operation.kind, digest, JSON.stringify(result)]
    );
    return result;
  });
}

module.exports = {
  SHARED_CATALOG_USER_ID,
  applySyncOperation,
  archiveCatalogItem,
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  listCatalogItems,
  normalizeCatalogItem,
  updateCatalogItem,
};
