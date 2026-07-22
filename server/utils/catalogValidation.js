const ITEM_TYPES = new Set(['meal', 'snack', 'ingredient']);
const OWNER_FIELDS = new Set(['user_id', 'userId', 'owner_id', 'ownerId']);
const ITEM_FIELDS = new Set([
  'title', 'item_type', 'type', 'created_at', 'base_updated_at',
  'kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g',
  'fat_g_per_100g', 'unit_conversions', 'food_id',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.status = 400;
  return error;
}

function requireObject(value, message = 'Request body must be an object.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw validationError(message);
}

function rejectOwnership(value) {
  if (Object.keys(value).some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Catalog ownership is derived from the authenticated session.');
  }
}

function itemType(value) {
  if (typeof value !== 'string' || !ITEM_TYPES.has(value)) {
    throw validationError('item_type contains an unsupported value.');
  }
  return value;
}

function boundedText(value, name, maximum, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw validationError(`${name} must be text.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw validationError(`${name} must contain between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function nutrient(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) {
    throw validationError(`${name} is outside the allowed range.`);
  }
  return value;
}

function timestamp(value, name) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw validationError(`${name} must be a valid timestamp.`);
  }
  return new Date(value).toISOString();
}

function unitConversions(value) {
  if (value === undefined || value === null) return {};
  requireObject(value, 'unit_conversions must be an object.');
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 65_536) {
    throw validationError('unit_conversions is too large.');
  }
  const sanitized = { ...value };
  delete sanitized.photo_data_url;
  return sanitized;
}

function validateCatalogInput(body) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !ITEM_FIELDS.has(key));
  if (unsupported) throw validationError(`Unsupported catalog field: ${unsupported}.`);
  const typeValue = body.item_type ?? body.type;
  if (body.item_type && body.type && body.item_type !== body.type) {
    throw validationError('item_type and type must match.');
  }
  return {
    title: boundedText(body.title, 'title', 200),
    item_type: itemType(typeValue),
    created_at: timestamp(body.created_at, 'created_at'),
    base_updated_at: timestamp(body.base_updated_at, 'base_updated_at'),
    kcal_per_100g: nutrient(body.kcal_per_100g, 'kcal_per_100g'),
    protein_g_per_100g: nutrient(body.protein_g_per_100g, 'protein_g_per_100g'),
    carbs_g_per_100g: nutrient(body.carbs_g_per_100g, 'carbs_g_per_100g'),
    fat_g_per_100g: nutrient(body.fat_g_per_100g, 'fat_g_per_100g'),
    unit_conversions: unitConversions(body.unit_conversions),
    food_id: boundedText(body.food_id, 'food_id', 200, { nullable: true }),
  };
}

function validateCatalogQuery(query) {
  const allowed = new Set(['item_type', 'type', 'query', 'limit']);
  const unsupported = Object.keys(query).find((key) => !allowed.has(key));
  if (unsupported || Object.keys(query).some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Unsupported catalog query parameter.');
  }
  const typeValue = query.item_type ?? query.type;
  const search = query.query === undefined ? '' : boundedText(query.query, 'query', 200);
  const rawLimit = query.limit === undefined ? 200 : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
    throw validationError('limit must be an integer between 1 and 200.');
  }
  return { itemType: itemType(typeValue), query: search, limit: rawLimit };
}

function validateItemId(value) {
  return boundedText(value, 'item ID', 200);
}

function validateSyncOperation(value) {
  requireObject(value, 'Each sync operation must be an object.');
  rejectOwnership(value);
  const allowed = new Set(['operationId', 'kind', 'itemId', 'tempId', 'input']);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported sync field: ${unsupported}.`);
  if (!UUID_PATTERN.test(value.operationId || '')) throw validationError('operationId must be a UUID.');
  if (!new Set(['create', 'update', 'delete', 'archive']).has(value.kind)) {
    throw validationError('Unsupported sync operation kind.');
  }
  const operation = { operationId: value.operationId, kind: value.kind };
  if (value.kind === 'create') {
    operation.tempId = boundedText(value.tempId, 'tempId', 200);
    operation.input = validateCatalogInput(value.input);
  } else {
    operation.itemId = validateItemId(value.itemId);
    if (value.kind === 'update') operation.input = validateCatalogInput(value.input);
  }
  return operation;
}

function validateSyncBody(body) {
  requireObject(body);
  rejectOwnership(body);
  if (Object.keys(body).some((key) => key !== 'operations')) {
    throw validationError('Unsupported catalog sync field.');
  }
  if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 50) {
    throw validationError('operations must contain between 1 and 50 entries.');
  }
  return body.operations;
}

module.exports = {
  validateCatalogInput,
  validateCatalogQuery,
  validateItemId,
  validateSyncBody,
  validateSyncOperation,
  validationError,
};
