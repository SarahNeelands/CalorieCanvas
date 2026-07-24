import { getCurrentUserId, getStoredUserId } from './authClient';
import { getCachedCatalogItems } from './catalogClient';
import { apiRequest } from './apiClient';

function formatLocalDate(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findCatalogSnapshot(mealId, userId) {
  if (!mealId) return null;
  const items = [
    ...getCachedCatalogItems('meal', userId),
    ...getCachedCatalogItems('snack', userId),
    ...getCachedCatalogItems('ingredient', userId),
  ];
  return items.find((item) => item.id === mealId) || null;
}

function sanitizeItemSnapshot(item) {
  if (!item) return null;
  const type = item.type || item.item_type || 'meal';
  return {
    id: item.id || null,
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

function buildExpressMealLogPayload(payload, userId, { partial = false } = {}) {
  const body = {};
  const copy = (field) => {
    if (payload[field] !== undefined) body[field] = payload[field];
  };
  for (const field of [
    'meal_id', 'food_id', 'qty', 'unit_code', 'grams_resolved', 'logged_at', 'meal_type',
    'position', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g',
    'cholesterol_mg', 'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg',
    'vitamin_a_mcg', 'vitamin_c_mg',
  ]) copy(field);

  const loggedAt = payload.logged_at ? new Date(payload.logged_at) : null;
  if (loggedAt && !Number.isNaN(loggedAt.getTime())) {
    body.logged_at = loggedAt.toISOString();
    body.log_date = payload.log_date || formatLocalDate(loggedAt);
    body.timezone_offset_minutes = payload.timezone_offset_minutes ?? -loggedAt.getTimezoneOffset();
  }
  if (payload.micros) {
    body.micros = payload.micros;
  }
  const catalogItem = partial ? null : findCatalogSnapshot(payload.meal_id, userId);
  const suppliedSnapshot = payload.item_snapshot || payload.meal;
  const snapshot = sanitizeItemSnapshot(suppliedSnapshot || catalogItem);
  if (snapshot) body.item_snapshot = snapshot;
  if (!partial && !body.meal_type) body.meal_type = snapshot?.type === 'snack' ? 'snack' : 'other';
  return body;
}

export async function createMealLog(payload) {
  const sessionUserId = await getCurrentUserId();
  const userId = sessionUserId;
  if (!userId) throw new Error('Missing user ID');
  const { payload: response, error } = await apiRequest('/meal-logs/entries', {
    method: 'POST', csrf: true, body: buildExpressMealLogPayload(payload, userId),
  });
  if (error) throw new Error(error.message);
  return response?.data;
}

export async function updateMealLog(logId, payload) {
  const sessionUserId = await getCurrentUserId();
  const userId = sessionUserId;
  if (!userId) throw new Error('Missing user ID');
  if (!logId) throw new Error('Missing meal log ID');

  const { payload: response, error } = await apiRequest(`/meal-logs/entries/${encodeURIComponent(logId)}`, {
    method: 'PUT', csrf: true, body: buildExpressMealLogPayload(payload, userId, { partial: true }),
  });
  if (error) throw new Error(error.message);
  return response?.data;
}

export async function deleteMealLog(logId, userIdArg) {
  const sessionUserId = await getCurrentUserId();
  const userId = sessionUserId;
  if (!userId) throw new Error('Missing user ID');
  if (!logId) throw new Error('Missing meal log ID');

  const { error } = await apiRequest(`/meal-logs/entries/${encodeURIComponent(logId)}`, {
    method: 'DELETE', csrf: true,
  });
  if (error) throw new Error(error.message);
}

export async function listMealLogs({ userId = getStoredUserId(), limit = 3 } = {}) {
  if (!userId) throw new Error('Missing user ID');

  const { payload, error } = await apiRequest(`/meal-logs?limit=${encodeURIComponent(limit)}`);
  if (error) throw new Error(error.message);
  return payload?.data || [];
}

export async function getDailyMealLogSummary({ userId = getStoredUserId(), date = new Date() } = {}) {
  if (!userId) throw new Error('Missing user ID');

  const localDate = formatLocalDate(date);
  const { payload, error } = await apiRequest(`/meal-logs/days/${localDate}/summary`);
  if (error) throw new Error(error.message);
  return payload?.data;
}

export async function getMealLogDay({ userId = getStoredUserId(), date = new Date() } = {}) {
  if (!userId) throw new Error('Missing user ID');
  const localDate = formatLocalDate(date);
  const { payload, error } = await apiRequest(`/meal-logs/days/${localDate}`);
  if (error) throw new Error(error.message);
  return payload?.data;
}

export async function listMealLogRange({
  userId = getStoredUserId(), startDate, endDate, limit = 500,
} = {}) {
  if (!userId) throw new Error('Missing user ID');
  if (!startDate || !endDate) throw new Error('Missing meal-log date range');
  const query = new URLSearchParams({
    start_date: formatLocalDate(startDate),
    end_date: formatLocalDate(endDate),
    limit: String(limit),
  });
  const { payload, error } = await apiRequest(`/meal-logs?${query.toString()}`);
  if (error) throw new Error(error.message);
  return payload?.data || [];
}
