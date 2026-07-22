import { supabase } from '../supabaseClient';
import { isLocalAuth } from '../config/runtime';

const EXERCISE_STORAGE_KEY = 'exercise_page_state_v3';
const LOCAL_MEAL_LOGS_KEY = 'local_meal_logs_v1';
const LOCAL_WEIGHTS_KEY = 'cc.weights';

function getExerciseState(rawState) {
  if (rawState && typeof rawState === 'object' && rawState.state && typeof rawState.state === 'object') {
    return rawState.state;
  }
  return rawState && typeof rawState === 'object' ? rawState : { logs: [], exerciseTypes: [] };
}

function extractExerciseLogs(source, seen = new Set()) {
  if (!source || typeof source !== 'object') return [];
  if (seen.has(source)) return [];
  seen.add(source);

  if (
    getExerciseMinutes(source) > 0 &&
    getExerciseTimestamp(source)
  ) {
    return [source];
  }

  if (Array.isArray(source)) {
    return source.flatMap((entry) => extractExerciseLogs(entry, seen));
  }

  return Object.values(source).flatMap((entry) => extractExerciseLogs(entry, seen));
}

function readExerciseLogsFromAllStorage() {
  if (typeof localStorage === 'undefined') return [];
  const logs = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !/exercise/i.test(key)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      logs.push(...extractExerciseLogs(parsed));
    } catch {
      continue;
    }
  }

  return logs;
}

function getExerciseTimestamp(entry) {
  return (
    entry?.timestampISO ||
    entry?.timestamp_iso ||
    entry?.logged_at ||
    entry?.created_at ||
    entry?.date ||
    entry?.datetime ||
    entry?.occurred_at ||
    null
  );
}

function getExerciseMinutes(entry) {
  const candidates = [
    entry?.minutes,
    entry?.duration_minutes,
    entry?.duration,
    entry?.durationMins,
    entry?.total_minutes,
  ];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (numeric > 0) return numeric;
  }
  return 0;
}

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
    .map((row, index) => ({ ...row, _localIndex: index }))
    .filter((row) => {
      const rowUserId = row.user_id || row.userId || null;
      return !rowUserId || rowUserId === userId;
    })
    .map((row) => ({
      id: row.id || `local-weight-${row._localIndex}`,
      date: row.date,
      label: dayLabel(row.date),
      value: Number((toKg(row.value, row.unit) || 0).toFixed(2)),
      extra: {
        rawValue: Number(row.value || 0),
        rawUnit: row.unit || 'kg',
        localIndex: row._localIndex,
      },
    }));
}

function readLocalMealLogSeries(userId) {
  const rows = readJson(LOCAL_MEAL_LOGS_KEY, []);
  const byDate = {};

  rows
    .filter((row) => (row.user_id || row.userId) === userId)
    .forEach((row) => {
      const date = toYmd(row.logged_at || new Date().toISOString());
      byDate[date] = byDate[date] || { total: 0, logIds: [] };
      byDate[date].total += Number(row.kcal || 0);
      if (row.id) {
        byDate[date].logIds.push(row.id);
      }
    });

  return Object.keys(byDate).map((date) => ({
    date,
    label: dayLabel(date),
    value: byDate[date].total,
    extra: { calories: byDate[date].total, logIds: byDate[date].logIds },
  }));
}

function readLocalExerciseSeries(userId) {
  const rawState = readJson(EXERCISE_STORAGE_KEY, { logs: [], exerciseTypes: [] });
  const state = getExerciseState(rawState);
  const typesById = Object.fromEntries((state.exerciseTypes || []).map((type) => [type.id, type.name]));
  const byDate = {};
  const directLogs = Array.isArray(state.logs)
    ? state.logs
    : Array.isArray(state.entries)
      ? state.entries
      : Array.isArray(state.history)
        ? state.history
        : [];
  const fallbackLogs = extractExerciseLogs(rawState);
  const logs = directLogs.length ? directLogs : (fallbackLogs.length ? fallbackLogs : readExerciseLogsFromAllStorage());
  const matchingLogs = logs.filter((log) => {
    const logUserId = log.userId || log.user_id || state.userId || state.user_id || null;
    return logUserId === userId;
  });
  const candidateLogs = userId
    ? (matchingLogs.length ? matchingLogs : logs)
    : logs;

  candidateLogs
    .forEach((log) => {
      const timestamp = getExerciseTimestamp(log) || new Date().toISOString();
      const date = toYmd(timestamp);
      byDate[date] = byDate[date] || { total: 0, types: {} };
      const minutes = getExerciseMinutes(log);
      byDate[date].total += minutes;
      const typeId = log.typeId || log.type_id || log.exercise_type_id || 'other';
      const name = typesById[typeId] || log.typeName || log.type_name || typeId || 'Other';
      byDate[date].types[name] = (byDate[date].types[name] || 0) + minutes;
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

function getDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function deleteWeightEntry(userId, point) {
  if (!userId || !point) return;

  if (isLocalAuth()) {
    const rows = readJson(LOCAL_WEIGHTS_KEY, []);
    const localIndex = point?.extra?.localIndex;
    const nextRows = rows.filter((_, index) => index !== localIndex);
    localStorage.setItem(LOCAL_WEIGHTS_KEY, JSON.stringify(nextRows));
    return;
  }

  if (point.id) {
    const { error } = await supabase.from('weights').delete().eq('id', point.id).eq('user_id', userId);
    if (error) throw error;
  }
}

export async function deleteCalorieEntry(userId, point) {
  if (!userId || !point?.date) return;

  if (isLocalAuth()) {
    const rows = readJson(LOCAL_MEAL_LOGS_KEY, []);
    const nextRows = rows.filter((row) => {
      const rowUserId = row.user_id || row.userId;
      return !(rowUserId === userId && toYmd(row.logged_at) === point.date);
    });
    localStorage.setItem(LOCAL_MEAL_LOGS_KEY, JSON.stringify(nextRows));
    return;
  }

  const { start, end } = getDayBounds(point.date);
  const { error } = await supabase
    .from('meal_logs')
    .delete()
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString());
  if (error) throw error;
}

export async function deleteExerciseEntry(userId, point) {
  if (!userId || !point?.date) return;

  if (isLocalAuth()) {
    const rawState = readJson(EXERCISE_STORAGE_KEY, { logs: [], exerciseTypes: [] });
    const state = getExerciseState(rawState);
    const logs = Array.isArray(state.logs) ? state.logs : [];
    const nextState = {
      ...state,
      logs: logs.filter((log) => toYmd(log.timestampISO || log.timestamp_iso || log.logged_at || log.created_at) !== point.date),
    };
    localStorage.setItem(EXERCISE_STORAGE_KEY, JSON.stringify(nextState));
    return;
  }

  const { start, end } = getDayBounds(point.date);
  const { error } = await supabase
    .from('exercise_logs')
    .delete()
    .eq('user_id', userId)
    .gte('timestamp_iso', start.toISOString())
    .lt('timestamp_iso', end.toISOString());
  if (error) throw error;
}

export async function fetchWeightSeries(userId, scope = 'all') {
  try {
    if (!userId) return [];

    if (isLocalAuth()) {
      return sortAscending(applyScope(readLocalWeights(userId), scope));
    }

    const { data, error } = await supabase
      .from('weights')
      .select('id,date,value,unit')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(365);

    if (error) throw error;

    const points = (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      label: dayLabel(row.date),
      value: Number((toKg(row.value, row.unit) || 0).toFixed(2)),
      extra: {
        rawValue: Number(row.value || 0),
        rawUnit: row.unit || 'kg',
      },
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
    const localPoints = readLocalExerciseSeries(userId);

    if (isLocalAuth()) {
      return sortAscending(applyScope(localPoints, scope));
    }

    if (!userId) {
      return sortAscending(applyScope(localPoints, scope));
    }

    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    const byDate = {};
    (data || []).forEach((row) => {
      const timestamp = getExerciseTimestamp(row) || new Date().toISOString();
      const date = toYmd(timestamp);
      byDate[date] = byDate[date] || { total: 0, types: {} };
      const minutes = getExerciseMinutes(row);
      byDate[date].total += minutes;
      const type = row.type_id || row.typeId || row.exercise_type_id || row.type_name || 'other';
      byDate[date].types[type] = (byDate[date].types[type] || 0) + minutes;
    });

    const remotePoints = Object.keys(byDate).map((date) => ({
      date,
      label: dayLabel(date),
      value: byDate[date].total,
      extra: {
        types: Object.entries(byDate[date].types).map(([name, minutes]) => ({ name, minutes })),
      },
    }));

    const mergedByDate = {};

    [...localPoints, ...remotePoints].forEach((point) => {
      const date = point.date;
      if (!date) return;
      if (!mergedByDate[date]) {
        mergedByDate[date] = {
          date,
          label: point.label || dayLabel(date),
          value: 0,
          extra: { types: [] },
        };
      }

      mergedByDate[date].value += Number(point.value || 0);
      const currentTypes = new Map(
        (mergedByDate[date].extra?.types || []).map((item) => [item.name, Number(item.minutes || 0)])
      );
      (point.extra?.types || []).forEach((item) => {
        currentTypes.set(item.name, (currentTypes.get(item.name) || 0) + Number(item.minutes || 0));
      });
      mergedByDate[date].extra.types = Array.from(currentTypes.entries()).map(([name, minutes]) => ({ name, minutes }));
    });

    return sortAscending(applyScope(Object.values(mergedByDate), scope));
  } catch (error) {
    console.warn('fetchExerciseSeries failed', error);
    return sortAscending(applyScope(readLocalExerciseSeries(userId), scope));
  }
}
