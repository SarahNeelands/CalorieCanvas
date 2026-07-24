const OWNER_FIELDS = new Set(['user_id', 'userId', 'owner_id', 'ownerId']);
const WEIGHT_FIELDS = new Set(['date', 'value', 'unit']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KG_PER_POUND = 0.45359237;
const MAX_IMPORT_RECORDS = 500;

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
    throw validationError('Weight ownership is derived from the authenticated session.');
  }
}

function validateUuid(value, label = 'Weight ID') {
  if (!UUID_PATTERN.test(value || '')) throw validationError(`${label} must be a UUID.`);
  return value;
}

function validateDate(value, label = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`${label} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
      || value < '1900-01-01' || value > tomorrow.toISOString().slice(0, 10)) {
    throw validationError(`${label} is not a valid calendar date.`);
  }
  return value;
}

function validateUnit(value) {
  if (typeof value !== 'string' || !new Set(['kg', 'lb']).has(value.toLowerCase())) {
    throw validationError('unit must be kg or lb.');
  }
  return value.toLowerCase();
}

function validateValue(value, unit) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const kilograms = unit === 'lb' ? numeric * KG_PER_POUND : numeric;
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 2000
      || kilograms < 20 || kilograms > 500) {
    throw validationError('value is outside the allowed weight range.');
  }
  const text = String(value);
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  if (decimals > 6) throw validationError('value may contain at most six decimal places.');
  return numeric;
}

function validateWeightInput(body, { partial = false } = {}) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !WEIGHT_FIELDS.has(key));
  if (unsupported) throw validationError(`Unsupported weight field: ${unsupported}.`);
  if (partial && Object.keys(body).length === 0) throw validationError('At least one weight field is required.');

  const result = {};
  if (!partial || body.date !== undefined) result.date = validateDate(body.date);
  if (!partial || body.unit !== undefined) result.unit = validateUnit(body.unit);
  if (!partial || body.value !== undefined) {
    if (partial && body.unit === undefined) result.value = body.value;
    else result.value = validateValue(body.value, result.unit);
  }
  return result;
}

function validateListQuery(query) {
  rejectOwnership(query);
  const allowed = new Set(['start_date', 'end_date', 'limit']);
  const unsupported = Object.keys(query).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported weight query parameter: ${unsupported}.`);
  const startDate = query.start_date === undefined ? null : validateDate(query.start_date, 'start_date');
  const endDate = query.end_date === undefined ? null : validateDate(query.end_date, 'end_date');
  if ((startDate && !endDate) || (!startDate && endDate) || (startDate && startDate > endDate)) {
    throw validationError('A valid start_date and end_date range is required.');
  }
  const limit = query.limit === undefined ? 365 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw validationError('limit must be an integer between 1 and 500.');
  }
  return { startDate, endDate, limit };
}

function validateImportPayload(body) {
  requireObject(body);
  rejectOwnership(body);
  const unsupported = Object.keys(body).find((key) => !new Set(['operationId', 'records']).has(key));
  if (unsupported) throw validationError(`Unsupported import field: ${unsupported}.`);
  const operationId = validateUuid(body.operationId, 'Import operation ID');
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > MAX_IMPORT_RECORDS) {
    throw validationError(`records must contain between 1 and ${MAX_IMPORT_RECORDS} entries.`);
  }
  body.records.forEach((record) => {
    if (record && typeof record === 'object' && !Array.isArray(record)) rejectOwnership(record);
  });
  return { operationId, records: body.records };
}

function validateImportRecord(record) {
  requireObject(record, 'Import record must be an object.');
  rejectOwnership(record);
  const allowed = new Set(['id', 'date', 'value', 'unit']);
  const unsupported = Object.keys(record).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported import record field: ${unsupported}.`);
  const input = validateWeightInput({ date: record.date, value: record.value, unit: record.unit });
  let id = null;
  if (record.id !== undefined && record.id !== null && record.id !== '') {
    if (typeof record.id !== 'string' || record.id.length > 200) {
      throw validationError('Import record ID must be text no longer than 200 characters.');
    }
    id = record.id;
  }
  return { ...input, id };
}

module.exports = {
  KG_PER_POUND,
  MAX_IMPORT_RECORDS,
  validateDate,
  validateImportPayload,
  validateImportRecord,
  validateListQuery,
  validateUuid,
  validateValue,
  validateWeightInput,
  validationError,
};
