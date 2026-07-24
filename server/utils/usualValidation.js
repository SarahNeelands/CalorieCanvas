const OWNER_FIELDS = new Set(['user_id', 'userId', 'owner_id', 'ownerId']);
const UNITS = new Set(['mg', 'g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'quantity']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.status = 400;
  return error;
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Request body must be an object.');
  }
}

function rejectOwnership(value) {
  if (Object.keys(value).some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Usual ownership is derived from the authenticated session.');
  }
}

function boundedText(value, name, maximum, { nullable = false } = {}) {
  if (nullable && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string') throw validationError(`${name} must be text.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw validationError(`${name} must contain between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function validateUsualId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw validationError('usual ID must be a UUID.');
  }
  return value;
}

function validateMealId(value) {
  const id = boundedText(value, 'meal_id', 200);
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw validationError('meal_id contains unsupported characters.');
  }
  return id;
}

function validateUsualInput(body, { partial = false } = {}) {
  requireObject(body);
  rejectOwnership(body);
  const allowed = new Set(['meal_id', 'default_qty', 'unit_code', 'custom_label', 'position']);
  const unsupported = Object.keys(body).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported usual field: ${unsupported}.`);

  const result = {};
  if (!partial || body.meal_id !== undefined) result.meal_id = validateMealId(body.meal_id);
  if (!partial || body.default_qty !== undefined) {
    const qty = Number(body.default_qty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) {
      throw validationError('default_qty is outside the allowed range.');
    }
    result.default_qty = qty;
  }
  if (!partial || body.unit_code !== undefined) {
    if (typeof body.unit_code !== 'string' || !UNITS.has(body.unit_code)) {
      throw validationError('unit_code contains an unsupported value.');
    }
    result.unit_code = body.unit_code;
  }
  if (body.custom_label !== undefined) {
    result.custom_label = boundedText(body.custom_label, 'custom_label', 80, { nullable: true });
  }
  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0 || position > 1000000) {
      throw validationError('position is outside the allowed range.');
    }
    result.position = position;
  }
  if (partial && Object.keys(result).length === 0) {
    throw validationError('At least one usual field must be supplied.');
  }
  return result;
}

module.exports = {
  validateUsualId,
  validateUsualInput,
  validationError,
};
