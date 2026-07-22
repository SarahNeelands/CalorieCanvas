const OWNER_FIELDS = new Set(['user_id', 'userId', 'owner_id', 'ownerId', 'is_shared', 'isShared']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISTANCE_UNITS = new Set(['m', 'km', 'mi', 'yd']);
const RESISTANCE_UNITS = new Set(['kg', 'lb']);
const MAX_SYNC_ITEMS = 500;

function validationError(message, status = 400) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.status = status;
  return error;
}

function requireObject(value, message = 'Request body must be an object.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw validationError(message);
}

function rejectOwnership(value) {
  if (Object.keys(value).some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Exercise ownership is derived from the authenticated session.');
  }
}

function text(value, name, maximum, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw validationError(`${name} must be text.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw validationError(`${name} must contain between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function number(value, name, minimum, maximum, { integer = false, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum || (integer && !Number.isInteger(parsed))) {
    throw validationError(`${name} is outside the allowed range.`);
  }
  return parsed;
}

function stableId(value, name = 'exerciseId') {
  const id = text(value, name, 100);
  if (!ID_PATTERN.test(id)) throw validationError(`${name} contains unsupported characters.`);
  return id;
}

function uuid(value, name) {
  if (!UUID_PATTERN.test(value || '')) throw validationError(`${name} must be a UUID.`);
  return value;
}

function dateOnly(value, name = 'log_date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`${name} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
      || value < '1900-01-01' || value > '2200-12-31') {
    throw validationError(`${name} is not a valid date.`);
  }
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw validationError('occurred_at must include an explicit timezone offset.');
  }
  return new Date(value).toISOString();
}

function deriveLocalDate(occurredAt, offsetMinutes) {
  return new Date(Date.parse(occurredAt) + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function pairedMeasurement(body, result, valueField, unitField, units, maximum) {
  const hasValue = body[valueField] !== undefined;
  const hasUnit = body[unitField] !== undefined;
  if (!hasValue && !hasUnit) return;
  if (body[valueField] === null && body[unitField] === null) {
    result[valueField] = null;
    result[unitField] = null;
    return;
  }
  if (!hasValue || !hasUnit) throw validationError(`${valueField} and ${unitField} must be supplied together.`);
  result[valueField] = number(body[valueField], valueField, valueField === 'distance_value' ? Number.EPSILON : 0, maximum);
  const unit = text(body[unitField], unitField, 10).toLowerCase();
  if (!units.has(unit)) throw validationError(`${unitField} contains an unsupported unit.`);
  result[unitField] = unit;
}

function validateDefinitionInput(body, { partial = false } = {}) {
  requireObject(body);
  rejectOwnership(body);
  const allowed = new Set(partial
    ? ['name', 'description', 'estimated_calories_per_hour']
    : ['id', 'name', 'description', 'estimated_calories_per_hour']);
  const unsupported = Object.keys(body).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported exercise-definition field: ${unsupported}.`);
  if (partial && Object.keys(body).length === 0) throw validationError('At least one definition field is required.');
  const result = {};
  if (!partial || body.id !== undefined) result.id = stableId(body.id);
  if (!partial || body.name !== undefined) result.name = text(body.name, 'name', 100);
  if (body.description !== undefined) result.description = text(body.description, 'description', 1000, { nullable: true });
  if (body.estimated_calories_per_hour !== undefined) {
    result.estimated_calories_per_hour = number(
      body.estimated_calories_per_hour, 'estimated_calories_per_hour', 0, 5000, { nullable: true }
    );
  }
  return result;
}

const LOG_FIELDS = new Set([
  'definition_id', 'duration_minutes', 'occurred_at', 'log_date', 'timezone_offset_minutes',
  'sets', 'repetitions', 'resistance_value', 'resistance_unit', 'distance_value',
  'distance_unit', 'calories_burned', 'notes', 'source_record_id',
]);

function validateLogInput(body, { partial = false } = {}) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !LOG_FIELDS.has(key));
  if (unsupported) throw validationError(`Unsupported exercise-log field: ${unsupported}.`);
  if (partial && Object.keys(body).length === 0) throw validationError('At least one exercise-log field is required.');
  const result = {};
  const set = (field, parser, required = !partial) => {
    if (body[field] !== undefined) result[field] = parser(body[field]);
    else if (required) throw validationError(`${field} is required.`);
  };
  set('definition_id', stableId);
  set('duration_minutes', (value) => number(value, 'duration_minutes', 1, 1440, { integer: true }));
  set('occurred_at', timestamp);
  set('log_date', (value) => dateOnly(value));
  set('timezone_offset_minutes', (value) => number(value, 'timezone_offset_minutes', -840, 840, { integer: true }));
  set('sets', (value) => number(value, 'sets', 1, 10000, { integer: true, nullable: true }), false);
  set('repetitions', (value) => number(value, 'repetitions', 1, 1000000, { integer: true, nullable: true }), false);
  pairedMeasurement(body, result, 'resistance_value', 'resistance_unit', RESISTANCE_UNITS, 5000);
  pairedMeasurement(body, result, 'distance_value', 'distance_unit', DISTANCE_UNITS, 100000);
  set('calories_burned', (value) => number(value, 'calories_burned', 0, 10000, { nullable: true }), false);
  set('notes', (value) => text(value, 'notes', 2000, { nullable: true }), false);
  set('source_record_id', (value) => text(value, 'source_record_id', 200, { nullable: true }), false);
  const dateFields = ['occurred_at', 'log_date', 'timezone_offset_minutes'];
  const suppliedDateFields = dateFields.filter((field) => result[field] !== undefined);
  if (suppliedDateFields.length && suppliedDateFields.length !== 3) {
    throw validationError('occurred_at, log_date, and timezone_offset_minutes must be supplied together.');
  }
  if (suppliedDateFields.length === 3
      && deriveLocalDate(result.occurred_at, result.timezone_offset_minutes) !== result.log_date) {
    throw validationError('log_date does not match occurred_at and timezone_offset_minutes.');
  }
  return result;
}

function validateListQuery(query) {
  rejectOwnership(query);
  const allowed = new Set(['start_date', 'end_date', 'limit', 'include_archived']);
  const unsupported = Object.keys(query).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported exercise query parameter: ${unsupported}.`);
  const startDate = query.start_date === undefined ? null : dateOnly(query.start_date, 'start_date');
  const endDate = query.end_date === undefined ? null : dateOnly(query.end_date, 'end_date');
  if ((startDate && !endDate) || (!startDate && endDate) || (startDate && startDate > endDate)) {
    throw validationError('A valid start_date and end_date range is required.');
  }
  const limit = query.limit === undefined ? 200 : number(query.limit, 'limit', 1, 500, { integer: true });
  const includeArchived = query.include_archived === 'true';
  if (query.include_archived !== undefined && !new Set(['true', 'false']).has(query.include_archived)) {
    throw validationError('include_archived must be true or false.');
  }
  return { startDate, endDate, limit, includeArchived };
}

function validateSyncPayload(body) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !new Set(['operationId', 'definitions', 'logs']).has(key));
  if (unsupported) throw validationError(`Unsupported exercise-sync field: ${unsupported}.`);
  const operationId = uuid(body.operationId, 'operationId');
  if (!Array.isArray(body.definitions) || !Array.isArray(body.logs)
      || body.definitions.length + body.logs.length > MAX_SYNC_ITEMS) {
    throw validationError(`Exercise synchronization supports at most ${MAX_SYNC_ITEMS} records.`);
  }
  body.definitions.forEach(rejectOwnership);
  body.logs.forEach(rejectOwnership);
  return { operationId, definitions: body.definitions, logs: body.logs };
}

module.exports = {
  deriveLocalDate,
  stableId,
  uuid,
  validateDefinitionInput,
  validateListQuery,
  validateLogInput,
  validateSyncPayload,
  validationError,
};
