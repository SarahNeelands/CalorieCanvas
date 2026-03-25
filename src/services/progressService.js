import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';

const EXERCISE_STORAGE_KEY = 'exercise_page_state_v3';
const LOCAL_MEAL_LOGS_KEY = 'local_meal_logs_v1';
const LOCAL_WEIGHTS_KEY = 'cc.weights';

function dayLabel(iso) {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  } catch {
    return iso;
  }
}

function toYmd(iso) {
  return String(iso || '').slice(0, 10);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function applyScope(points, scope) {
  if (scope === 'all') return points;
  const now = new Date();
  const daysBack = scope === 'week' ? 7 : 30;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysBack - 1));

  return points.filter((point) => {
    const date = new Date(point.date);
    return date >= start;
  });
}

function sortAscending(points) {
  return [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function toKg(value, unit) {
  const numeric = Number(value || 0);
  if (!(numeric > 0)) return null;
  const normalizedUnit = String(unit || 'kg').trim().toLowerCase();
  if (normalizedUnit === 'lb' || normalizedUnit === 'lbs' || normalizedUnit === 'pounds') {
    return numeric * 0.45359237;
  }
  return numeric;
}

function readLocalWeights(userId) {
  const rows = readJson(LOCAL_WEIGHTS_KEY, []);
  return rows
    .filter((row) => !row.user_id || row.user_id === userId)
    .map((row) => ({
      date: row.date,
      label: dayLabel(row.date),
      value: Number((toKg(row.value, row.unit) || 0).toFixed(2)),
    }));
}

function readLocalMealLogSeries(userId) {
  const rows = readJson(LOCAL_MEAL_LOGS_KEY, []);
  const byDate = {};

  rows
    .filter((row) => row.user_id === userId)
    .forEach((row) => {
      const date = toYmd(row.logged_at || new Date().toISOString());
      byDate[date] = (byDate[date] || 0) + Number(row.kcal || 0);
    });

  return Object.keys(byDate).map((date) => ({
    date,
    label: dayLabel(date),
    value: byDate[date],
    extra: { calories: byDate[date] },
  }));
}

function readLocalExerciseSeries(userId) {
  const state = readJson(EXERCISE_STORAGE_KEY, { logs: [], exerciseTypes: [] });
  const typesById = Object.fromEntries((state.exerciseTypes || []).map((type) => [type.id, type.name]));
  const byDate = {};

  (state.logs || [])
    .filter((log) => log.userId === userId)
    .forEach((log) => {
      const date = toYmd(log.timestampISO || new Date().toISOString());
      byDate[date] = byDate[date] || { total: 0, types: {} };
      byDate[date].total += Number(log.minutes || 0);
      const name = typesById[log.typeId] || log.typeId || 'Other';
      byDate[date].types[name] = (byDate[date].types[name] || 0) + Number(log.minutes || 0);
    });

  return Object.keys(byDate).map((date) => ({
    date,
    label: dayLabel(date),
    value: byDate[date].total,
    extra: {
      types: Object.entries(byDate[date].types).map(([name, minutes]) => ({ name, minutes })),
    },
  }));
}

export async function fetchWeightSeries(userId, scope = 'all') {
  try {
    if (!userId) return [];

    if (isLocalAuth()) {
      return sortAscending(applyScope(readLocalWeights(userId), scope));
    }

    const { data, error } = await supabase
      .from('weights')
      .select('date,value,unit')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(365);

    if (error) throw error;

    const points = (data || []).map((row) => ({
      date: row.date,
      label: dayLabel(row.date),
      value: Number((toKg(row.value, row.unit) || 0).toFixed(2)),
    }));

    return applyScope(points, scope);
  } catch (error) {
    console.warn('fetchWeightSeries failed', error);
    return [];
  }
}

export async function fetchCalorieSeries(userId, scope = 'all') {
  try {
    if (!userId) return [];

    if (isLocalAuth()) {
      return sortAscending(applyScope(readLocalMealLogSeries(userId), scope));
    }

    const { data, error } = await supabase.rpc('daily_calorie_totals', { p_user_id: userId });
    if (error || !data) {
      const { data: rows, error: fallbackError } = await supabase
        .from('meal_logs')
        .select('logged_at,kcal')
        .eq('user_id', userId);

      if (fallbackError) throw fallbackError;

      const byDate = {};
      (rows || []).forEach((row) => {
        const date = toYmd(row.logged_at || new Date().toISOString());
        byDate[date] = (byDate[date] || 0) + Number(row.kcal || 0);
      });

      return sortAscending(applyScope(Object.keys(byDate).map((date) => ({
        date,
        label: dayLabel(date),
        value: byDate[date],
        extra: { calories: byDate[date] },
      })), scope));
    }

    return sortAscending(applyScope((data || []).map((row) => ({
      date: row.date,
      label: dayLabel(row.date),
      value: Number(row.total_kcal),
      extra: { calories: Number(row.total_kcal) },
    })), scope));
  } catch (error) {
    console.warn('fetchCalorieSeries failed', error);
    return [];
  }
}

export async function fetchExerciseSeries(userId, scope = 'all') {
  try {
    if (!userId) return [];

    if (isLocalAuth()) {
      return sortAscending(applyScope(readLocalExerciseSeries(userId), scope));
    }

    const { data, error } = await supabase
      .from('exercise_logs')
      .select('timestamp_iso,minutes,type_id')
      .eq('user_id', userId);

    if (error) throw error;

    const byDate = {};
    (data || []).forEach((row) => {
      const date = toYmd(row.timestamp_iso || new Date().toISOString());
      byDate[date] = byDate[date] || { total: 0, types: {} };
      byDate[date].total += Number(row.minutes || 0);
      const type = row.type_id || 'other';
      byDate[date].types[type] = (byDate[date].types[type] || 0) + Number(row.minutes || 0);
    });

    const points = Object.keys(byDate).map((date) => ({
      date,
      label: dayLabel(date),
      value: byDate[date].total,
      extra: {
        types: Object.entries(byDate[date].types).map(([name, minutes]) => ({ name, minutes })),
      },
    }));

    return sortAscending(applyScope(points, scope));
  } catch (error) {
    console.warn('fetchExerciseSeries failed', error);
    return sortAscending(applyScope(readLocalExerciseSeries(userId), scope));
  }
}
