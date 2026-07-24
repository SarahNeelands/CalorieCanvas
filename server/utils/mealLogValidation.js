const OWNER_FIELDS = new Set(['user_id', 'userId', 'owner_id', 'ownerId']);
const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'other']);
const UNITS = new Set(['mg', 'g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'quantity']);
const ENTRY_FIELDS = new Set([
  'meal_id', 'food_id', 'item_snapshot', 'meal', 'qty', 'unit_code', 'grams_resolved',
  'logged_at', 'log_date', 'timezone_offset_minutes', 'meal_type', 'position',
  'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'cholesterol_mg',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'vitamin_a_mcg',
  'vitamin_c_mg', 'micros',
]);
const NUTRIENT_FIELDS = [
  'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'cholesterol_mg',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
];
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
    throw validationError('Meal-log ownership is derived from the authenticated session.');
  }
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

function numeric(value, name, minimum, maximum, { nullable = false, integer = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum || (integer && !Number.isInteger(parsed))) {
    throw validationError(`${name} is outside the allowed range.`);
  }
  return parsed;
}

function dateOnly(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`${name} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
      || value < '1900-01-01' || value > '2200-12-31') {
    throw validationError(`${name} is not a valid date.`);
  }
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw validationError('logged_at must be a timestamp with an explicit timezone offset.');
  }
  return new Date(value).toISOString();
}

function itemIdentifier(value) {
  if (value === null || value === undefined || value === '') return null;
  const id = boundedText(value, 'meal_id', 200);
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) throw validationError('meal_id contains unsupported characters.');
  return id;
}

function snapshot(value) {
  requireObject(value, 'item_snapshot must be an object.');
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 65_536) {
    throw validationError('item_snapshot is too large.');
  }
  const allowed = new Set([
    'id', 'title', 'type', 'item_type', 'unit_conversions', 'food_id',
    'kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g', 'fat_g_per_100g',
  ]);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported item snapshot field: ${unsupported}.`);
  const type = value.type ?? value.item_type ?? 'meal';
  if (!new Set(['meal', 'snack', 'ingredient']).has(type)) {
    throw validationError('item_snapshot.type contains an unsupported value.');
  }
  const result = {
    id: itemIdentifier(value.id),
    title: boundedText(value.title, 'item_snapshot.title', 200),
    type,
    item_type: type,
    unit_conversions: value.unit_conversions ?? {},
    food_id: boundedText(value.food_id, 'item_snapshot.food_id', 200, { nullable: true }),
  };
  requireObject(result.unit_conversions, 'item_snapshot.unit_conversions must be an object.');
  for (const field of ['kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g', 'fat_g_per_100g']) {
    result[field] = numeric(value[field] ?? 0, `item_snapshot.${field}`, 0, 100000);
  }
  return result;
}

function deriveLocalDate(loggedAt, offsetMinutes) {
  return new Date(Date.parse(loggedAt) + (offsetMinutes * 60_000)).toISOString().slice(0, 10);
}

function validateMealLogInput(body, { partial = false } = {}) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !ENTRY_FIELDS.has(key));
  if (unsupported) throw validationError(`Unsupported meal-log field: ${unsupported}.`);
  if (partial && Object.keys(body).length === 0) throw validationError('At least one meal-log field is required.');

  const result = {};
  const set = (field, parser, required = !partial) => {
    if (body[field] !== undefined) result[field] = parser(body[field]);
    else if (required) throw validationError(`${field} is required.`);
  };
  set('meal_id', itemIdentifier, false);
  set('food_id', (value) => boundedText(value, 'food_id', 200, { nullable: true }), false);
  if (body.item_snapshot !== undefined || body.meal !== undefined) {
    result.item_snapshot = snapshot(body.item_snapshot ?? body.meal);
  }
  set('qty', (value) => numeric(value, 'qty', Number.EPSILON, 1000000));
  set('unit_code', (value) => {
    const unit = boundedText(value, 'unit_code', 20).toLowerCase();
    if (!UNITS.has(unit)) throw validationError('unit_code contains an unsupported value.');
    return unit;
  });
  set('grams_resolved', (value) => numeric(value, 'grams_resolved', 0, 100000000, { nullable: true }));
  set('logged_at', timestamp);
  set('log_date', (value) => dateOnly(value, 'log_date'));
  set('timezone_offset_minutes', (value) => numeric(value, 'timezone_offset_minutes', -840, 840, { integer: true }));
  set('meal_type', (value) => {
    const mealType = boundedText(value, 'meal_type', 20).toLowerCase();
    if (!MEAL_TYPES.has(mealType)) throw validationError('meal_type contains an unsupported value.');
    return mealType;
  }, false);
  set('position', (value) => numeric(value, 'position', 0, 1000000, { integer: true }), false);

  const micros = body.micros;
  if (micros !== undefined) requireObject(micros, 'micros must be an object.');
  const microMap = {
    sodium_mg: 'sodium', potassium_mg: 'potassium', calcium_mg: 'calcium', iron_mg: 'iron',
    vitamin_a_mcg: 'vitaminA', vitamin_c_mg: 'vitaminC',
  };
  for (const field of NUTRIENT_FIELDS) {
    let value = body[field];
    if (value === undefined && microMap[field]) value = micros?.[microMap[field]];
    if (value !== undefined) result[field] = numeric(value, field, 0, 1000000);
    else if (!partial) result[field] = 0;
  }

  if (!partial && !result.meal_id && !result.item_snapshot) {
    throw validationError('An item snapshot is required for an ad hoc meal-log entry.');
  }
  if (result.logged_at && result.log_date && result.timezone_offset_minutes !== undefined
      && deriveLocalDate(result.logged_at, result.timezone_offset_minutes) !== result.log_date) {
    throw validationError('log_date does not match logged_at and timezone_offset_minutes.');
  }
  return result;
}

function validateEntryId(value) {
  if (!UUID_PATTERN.test(value || '')) throw validationError('Meal-log ID must be a UUID.');
  return value;
}

function validateListQuery(query) {
  rejectOwnership(query);
  const allowed = new Set(['limit', 'start_date', 'end_date']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw validationError('Unsupported meal-log query parameter.');
  const limit = query.limit === undefined ? 3 : numeric(query.limit, 'limit', 1, 500, { integer: true });
  const startDate = query.start_date === undefined ? null : dateOnly(query.start_date, 'start_date');
  const endDate = query.end_date === undefined ? null : dateOnly(query.end_date, 'end_date');
  if ((startDate && !endDate) || (!startDate && endDate) || (startDate && startDate > endDate)) {
    throw validationError('A valid start_date and end_date range is required.');
  }
  return { limit, startDate, endDate };
}

module.exports = {
  deriveLocalDate,
  validateEntryId,
  validateListQuery,
  validateMealLogInput,
  validationError,
};
