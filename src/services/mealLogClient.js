import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';
import { getCurrentUserId, getStoredUserId } from './authClient';
import { getCachedCatalogItems } from './catalogClient';

const LOCAL_MEAL_LOGS_KEY = 'local_meal_logs_v1';

function readLocalMealLogs() {
  try {
    const raw = localStorage.getItem(LOCAL_MEAL_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMealLogs(entries) {
  localStorage.setItem(LOCAL_MEAL_LOGS_KEY, JSON.stringify(entries));
}

function getLocalDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export async function createMealLog(payload) {
  const userId = payload.user_id || await getCurrentUserId();
  if (!userId) throw new Error('Missing user ID');

  if (isLocalAuth()) {
    const entry = {
      id: `meal-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...payload,
      user_id: userId,
    };
    const logs = readLocalMealLogs();
    logs.unshift(entry);
    writeLocalMealLogs(logs);
    return entry;
  }

  const dbPayload = {
    user_id: userId,
    meal_id: payload.meal_id,
    food_id: payload.food_id ?? null,
    qty: payload.qty,
    unit_code: payload.unit_code,
    grams_resolved: payload.grams_resolved,
    logged_at: payload.logged_at,
    kcal: payload.kcal,
    protein_g: payload.protein_g,
    carbs_g: payload.carbs_g,
    fat_g: payload.fat_g,
  };

  const { data, error } = await supabase.from('meal_logs').insert(dbPayload).select().single();
  if (error) throw error;
  return data;
}

export async function listMealLogs({ userId = getStoredUserId(), limit = 3 } = {}) {
  if (!userId) throw new Error('Missing user ID');

  if (isLocalAuth()) {
    const meals = getCachedCatalogItems('meal', userId);
    return readLocalMealLogs()
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        meal: meals.find((meal) => meal.id === entry.meal_id) || null,
      }));
  }

  const { data, error } = await supabase
    .from('meal_logs')
    .select(`
      id,
      logged_at,
      kcal,
      grams_resolved,
      qty,
      unit_code,
      meal:meals(id, title, kcal_per_100g)
    `)
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getDailyMealLogSummary({ userId = getStoredUserId(), date = new Date() } = {}) {
  if (!userId) throw new Error('Missing user ID');

  const { start, end } = getLocalDayBounds(date);

  if (isLocalAuth()) {
    const entries = readLocalMealLogs().filter((entry) => {
      if (entry.user_id !== userId) return false;
      const loggedAt = new Date(entry.logged_at);
      return loggedAt >= start && loggedAt < end;
    });

    const calories = entries.reduce((sum, entry) => sum + Number(entry.kcal || 0), 0);
    return {
      calories: Math.round(calories * 100) / 100,
      count: entries.length,
    };
  }

  const { data, error } = await supabase
    .from('meal_logs')
    .select('id, kcal, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString());

  if (error) throw error;

  const entries = data ?? [];
  const calories = entries.reduce((sum, entry) => sum + Number(entry.kcal || 0), 0);

  return {
    calories: Math.round(calories * 100) / 100,
    count: entries.length,
  };
}
