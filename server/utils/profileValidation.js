const PROFILE_FIELDS = new Set([
  'display_name',
  'dob',
  'gender',
  'height_cm',
  'weight_kg',
  'activity_level',
  'goal_weight_intent',
  'goal_muscle_intent',
  'calorie_goal',
  'target_weight_kg',
  'target_body_fat_pct',
  'pref_show_calories',
  'pref_show_macros',
  'pref_show_micros',
  'pref_show_exercise',
  'pref_show_weight',
  'pref_show_calorie_average',
]);
const OWNER_FIELDS = new Set(['id', 'user_id', 'userId', 'owner_id', 'ownerId']);
const SETUP_PATHS = new Set([
  '/profile-setup',
  '/profile-setup-2',
  '/profile-setup-3',
  '/profile-setup-4',
]);
const ACTIVITY_LEVELS = new Set([
  'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete',
]);
const WEIGHT_GOALS = new Set([
  'rapid_loss', 'normal_loss', 'maintain', 'normal_gain', 'rapid_gain',
]);
const MUSCLE_GOALS = new Set(['build', 'maintain']);

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.status = 400;
  return error;
}

function requireObject(value, message = 'Request body must be an object.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw validationError(message);
}

function optionalText(value, name, maximum) {
  if (value === null) return null;
  if (typeof value !== 'string') throw validationError(`${name} must be text or null.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw validationError(`${name} must contain between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function optionalNumber(value, name, minimum, maximum, integer = false) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw validationError(`${name} is outside the allowed range.`);
  }
  if (integer && !Number.isInteger(value)) throw validationError(`${name} must be an integer.`);
  return value;
}

function optionalBoolean(value, name) {
  if (typeof value !== 'boolean') throw validationError(`${name} must be true or false.`);
  return value;
}

function optionalDate(value, name) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`${name} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
      || value < '1900-01-01' || parsed > today) {
    throw validationError(`${name} is not a valid date.`);
  }
  return value;
}

function enumValue(value, name, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw validationError(`${name} contains an unsupported value.`);
  }
  return value;
}

function validateProfilePatch(body) {
  requireObject(body);
  const keys = Object.keys(body);
  if (keys.some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Profile ownership is derived from the authenticated session.');
  }
  const unsupported = keys.find((key) => !PROFILE_FIELDS.has(key));
  if (unsupported) throw validationError(`Unsupported profile field: ${unsupported}.`);
  if (keys.length === 0) throw validationError('At least one profile field is required.');

  const validators = {
    display_name: (value) => optionalText(value, 'display_name', 100),
    dob: (value) => optionalDate(value, 'dob'),
    gender: (value) => optionalText(value, 'gender', 50),
    height_cm: (value) => optionalNumber(value, 'height_cm', 50, 300),
    weight_kg: (value) => optionalNumber(value, 'weight_kg', 20, 500),
    activity_level: (value) => enumValue(value, 'activity_level', ACTIVITY_LEVELS),
    goal_weight_intent: (value) => enumValue(value, 'goal_weight_intent', WEIGHT_GOALS),
    goal_muscle_intent: (value) => enumValue(value, 'goal_muscle_intent', MUSCLE_GOALS),
    calorie_goal: (value) => optionalNumber(value, 'calorie_goal', 800, 10000, true),
    target_weight_kg: (value) => optionalNumber(value, 'target_weight_kg', 20, 500),
    target_body_fat_pct: (value) => optionalNumber(value, 'target_body_fat_pct', 0, 70),
    pref_show_calories: (value) => optionalBoolean(value, 'pref_show_calories'),
    pref_show_macros: (value) => optionalBoolean(value, 'pref_show_macros'),
    pref_show_micros: (value) => optionalBoolean(value, 'pref_show_micros'),
    pref_show_exercise: (value) => optionalBoolean(value, 'pref_show_exercise'),
    pref_show_weight: (value) => optionalBoolean(value, 'pref_show_weight'),
    pref_show_calorie_average: (value) => optionalBoolean(value, 'pref_show_calorie_average'),
  };

  return Object.fromEntries(keys.map((key) => [key, validators[key](body[key])]));
}

function boundedDraftNumber(value, name, minimum, maximum) {
  if (typeof value === 'string' && value.trim() === '') return value;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw validationError(`setup_draft.${name} is outside the allowed range.`);
  }
  return value;
}

function validatePreferences(value) {
  requireObject(value, 'setup_draft.prefs must be an object.');
  const allowed = new Set(['show_calories', 'show_macros', 'show_micros', 'show_exercise', 'show_weight']);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported setup preference: ${unsupported}.`);
  Object.entries(value).forEach(([key, item]) => optionalBoolean(item, `prefs.${key}`));
  return value;
}

function validateSetupDraft(value) {
  requireObject(value, 'setup_draft must be an object.');
  const allowed = new Set([
    'name', 'dob', 'gender', 'heightUnit', 'weightUnit', 'heightCm', 'weightKg',
    'ft', 'inch', 'lb', 'goal', 'muscle', 'activityLevel', 'targetWeight',
    'targetWeightUnit', 'targetBf', 'lastStep', 'prefs', 'completed',
  ]);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported setup draft field: ${unsupported}.`);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 16_384) {
    throw validationError('setup_draft is too large.');
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === 'name') optionalText(item, 'setup_draft.name', 100);
    else if (key === 'dob' && item !== null && item !== '') optionalDate(item, 'setup_draft.dob');
    else if (key === 'gender' && item !== null && item !== '') optionalText(item, 'setup_draft.gender', 50);
    else if (key === 'heightUnit') enumValue(item, key, new Set(['cm', 'imperial']));
    else if (key === 'weightUnit' || key === 'targetWeightUnit') enumValue(item, key, new Set(['kg', 'lb']));
    else if (key === 'heightCm' && item !== '') boundedDraftNumber(item, key, 50, 300);
    else if (key === 'weightKg' && item !== '') boundedDraftNumber(item, key, 20, 500);
    else if (key === 'ft' && item !== '') boundedDraftNumber(item, key, 1, 9);
    else if (key === 'inch' && item !== '') boundedDraftNumber(item, key, 0, 12);
    else if (key === 'lb' && item !== '') boundedDraftNumber(item, key, 40, 1200);
    else if (key === 'goal') enumValue(item, key, WEIGHT_GOALS);
    else if (key === 'muscle') enumValue(item, key, MUSCLE_GOALS);
    else if (key === 'activityLevel') enumValue(item, key, ACTIVITY_LEVELS);
    else if (key === 'targetWeight' && item !== '') boundedDraftNumber(item, key, 20, 1200);
    else if (key === 'targetBf' && item !== '') boundedDraftNumber(item, key, 0, 70);
    else if (key === 'lastStep' && item !== null) enumValue(item, key, SETUP_PATHS);
    else if (key === 'prefs') validatePreferences(item);
    else if (key === 'completed') optionalBoolean(item, 'setup_draft.completed');
  }
  return value;
}

function validateSetupPayload(body, { completing = false } = {}) {
  requireObject(body);
  if (Object.keys(body).some((key) => OWNER_FIELDS.has(key))) {
    throw validationError('Profile ownership is derived from the authenticated session.');
  }
  const allowed = completing
    ? new Set(['setup_draft'])
    : new Set(['setup_draft', 'setup_last_step']);
  const unsupported = Object.keys(body).find((key) => !allowed.has(key));
  if (unsupported) throw validationError(`Unsupported setup field: ${unsupported}.`);
  const draft = validateSetupDraft(body.setup_draft || {});
  const lastStep = completing ? null : body.setup_last_step;
  if (!completing && !SETUP_PATHS.has(lastStep)) {
    throw validationError('setup_last_step contains an unsupported value.');
  }
  return { setup_draft: draft, setup_last_step: lastStep };
}

module.exports = {
  validateProfilePatch,
  validateSetupDraft,
  validateSetupPayload,
  validationError,
};
