const crypto = require('node:crypto');

const WEIGHT_UNIT_MAP = Object.freeze({
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
});

const PROFILE_ENUMS = Object.freeze({
  activity_level: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'],
  goal_weight_intent: ['rapid_loss', 'normal_loss', 'maintain', 'normal_gain', 'rapid_gain'],
  goal_muscle_intent: ['build', 'maintain'],
  setup_last_step: ['/profile-setup', '/profile-setup-2', '/profile-setup-3', '/profile-setup-4'],
});

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function normalizeWeightUnit(value) {
  if (typeof value !== 'string') return null;
  return WEIGHT_UNIT_MAP[value.trim().toLowerCase()] || null;
}

function validDate(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf());
}

function validateProfile(row) {
  const errors = [];
  for (const [field, allowed] of Object.entries(PROFILE_ENUMS)) {
    if (row[field] != null && !allowed.includes(row[field])) errors.push(`invalid_${field}`);
  }
  if (row.dob != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.dob)) || !validDate(`${row.dob}T00:00:00Z`))) errors.push('invalid_dob');
  const ranges = { height_cm: [50, 300], weight_kg: [20, 500], calorie_goal: [800, 10000], target_weight_kg: [20, 500], target_body_fat_pct: [0, 70] };
  for (const [field, [min, max]] of Object.entries(ranges)) {
    if (row[field] != null && (!Number.isFinite(Number(row[field])) || Number(row[field]) < min || Number(row[field]) > max)) errors.push(`invalid_${field}`);
  }
  const draft = row.setup_draft ?? {};
  if (!draft || Array.isArray(draft) || typeof draft !== 'object') errors.push('invalid_setup_draft');
  else if (Buffer.byteLength(JSON.stringify(draft)) > 32768) errors.push('oversized_setup_draft');
  if (row.setup_completed === true && row.setup_last_step != null) errors.push('inconsistent_setup_state');
  return errors;
}

function stripEmbeddedMedia(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const copy = JSON.parse(JSON.stringify(input));
  const photo = copy.photo_data_url;
  delete copy.photo_data_url;
  return { value: copy, removedPhotoBytes: typeof photo === 'string' ? Buffer.byteLength(photo) : 0 };
}

function timestampDateUtc(value) {
  if (!validDate(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function stableUuid(namespace, ...parts) {
  const digest = crypto.createHash('sha256').update([namespace, ...parts].join('\0')).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

module.exports = {
  PROFILE_ENUMS, WEIGHT_UNIT_MAP, normalizeEmail, normalizeWeightUnit,
  stableUuid, stripEmbeddedMedia, timestampDateUtc, validDate, validateProfile,
};
