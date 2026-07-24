import { apiRequest } from './apiClient';
import { deleteExerciseDay, listExerciseLogs } from './exerciseClient';

const EXERCISE_STORAGE_KEY = 'exercise_page_state_v3';
const LOCAL_WEIGHTS_KEY = 'cc.weights';
const LOCAL_WEIGHT_IMPORT_OPERATION_KEY = 'cc.weights.import-operation.v1';
const KG_PER_POUND = 0.45359237;

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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
      ? new Date(`${iso}T12:00:00`)
      : new Date(iso);
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
    const date = new Date(`${point.date}T12:00:00`);
    return date >= start;
  });
}

function sortAscending(points) {
  return [...points].sort((a, b) => (
    String(a.date).localeCompare(String(b.date))
    || String(a.extra?.createdAt || '').localeCompare(String(b.extra?.createdAt || ''))
    || String(a.id || '').localeCompare(String(b.id || ''))
  ));
}

function toKg(value, unit) {
  const numeric = Number(value || 0);
  if (!(numeric > 0)) return null;
  const normalizedUnit = String(unit || 'kg').trim().toLowerCase();
  if (normalizedUnit === 'lb' || normalizedUnit === 'lbs' || normalizedUnit === 'pounds') {
    return numeric * KG_PER_POUND;
  }
  return numeric;
}

function normalizeWeightPoint(row) {
  return {
    id: row.id,
    date: row.date,
    label: dayLabel(row.date),
    value: Number((row.value_kg ?? toKg(row.value, row.unit) ?? 0).toFixed(2)),
    extra: {
      rawValue: Number(row.value || 0),
      rawUnit: row.unit || 'kg',
      createdAt: row.created_at || null,
    },
  };
}

function throwApiError(error) {
  if (error) throw new Error(error.message || 'Weight request failed.');
}

function localCalendarDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getImportableLocalWeights(userId) {
  const rows = readJson(LOCAL_WEIGHTS_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return true;
    const owner = row.user_id || row.userId || null;
    return !owner || owner === userId;
  });
}

function createOperationId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function createWeightEntry(userId, input) {
  const entry = {
    date: input.date || localCalendarDate(),
    value: Number(input.value),
    unit: input.unit || 'kg',
  };
  const { payload, error } = await apiRequest('/weights', { method: 'POST', csrf: true, body: entry });
  throwApiError(error);
  return payload.data;
}

export async function updateWeightEntry(userId, weightId, patch) {
  const { payload, error } = await apiRequest(`/weights/${encodeURIComponent(weightId)}`, {
    method: 'PUT', csrf: true, body: patch,
  });
  throwApiError(error);
  return payload.data;
}

export function getLocalWeightImportState(userId) {
  const records = getImportableLocalWeights(userId);
  return { available: records.length > 0, count: records.length };
}

export async function importLocalWeightHistory(userId) {
  const records = getImportableLocalWeights(userId).map((row) => ({
    ...(row?.id ? { id: row.id } : {}),
    date: row?.date,
    value: row?.value,
    unit: row?.unit,
  }));
  if (!records.length) return null;
  const snapshot = JSON.stringify(records);
  const previous = readJson(LOCAL_WEIGHT_IMPORT_OPERATION_KEY, null);
  const operation = previous?.snapshot === snapshot
    ? previous
    : { operationId: createOperationId(), snapshot };
  localStorage.setItem(LOCAL_WEIGHT_IMPORT_OPERATION_KEY, JSON.stringify(operation));
  const { payload, error } = await apiRequest('/weights/import/browser', {
    method: 'POST', csrf: true, body: { operationId: operation.operationId, records },
  });
  throwApiError(error);
  return payload.data;
}

export async function fetchWeightSummary({ startDate = null, endDate = null } = {}) {
  const query = new URLSearchParams();
  if (startDate && endDate) {
    query.set('start_date', startDate);
    query.set('end_date', endDate);
  }
  const queryString = query.toString();
  const { payload, error } = await apiRequest(`/weights/summary${queryString ? `?${queryString}` : ''}`);
  throwApiError(error);
  return payload.data;
}

function readLocalExerciseLogs(userId) {
  const rawState = readJson(EXERCISE_STORAGE_KEY, { logs: [], exerciseTypes: [] });
  const state = getExerciseState(rawState);
  const directLogs = Array.isArray(state.logs) ? state.logs : [];
  const logs = directLogs.length ? directLogs : extractExerciseLogs(rawState);
  return logs.filter((log) => {
    const owner = log.userId || log.user_id || state.userId || state.user_id || null;
    return !owner || owner === userId;
  });
}

function exerciseSeriesFromLogs(logs, localTypes = []) {
  const typesById = Object.fromEntries(localTypes.map((type) => [type.id, type.name]));
  const byDate = {};
  logs.forEach((log) => {
    const timestamp = getExerciseTimestamp(log);
    if (!timestamp) return;
    const date = log.logDate || log.log_date || toYmd(timestamp);
    const minutes = getExerciseMinutes(log);
    if (!(minutes > 0)) return;
    const typeId = log.typeId || log.type_id || log.definition_id || log.exercise_type_id || 'other';
    const typeName = log.definition_snapshot?.name || typesById[typeId] || log.type_name || typeId;
    byDate[date] = byDate[date] || { total: 0, types: {} };
    byDate[date].total += minutes;
    byDate[date].types[typeName] = (byDate[date].types[typeName] || 0) + minutes;
  });
  return Object.entries(byDate).map(([date, value]) => ({
    date,
    label: dayLabel(date),
    value: value.total,
    extra: { types: Object.entries(value.types).map(([name, minutes]) => ({ name, minutes })) },
  }));
}

export async function deleteWeightEntry(userId, point) {
  if (!userId || !point) return;

  const { error } = await apiRequest(`/weights/${encodeURIComponent(point.id)}`, {
    method: 'DELETE', csrf: true,
  });
  throwApiError(error);
}

export async function deleteCalorieEntry(userId, point) {
  if (!userId || !point?.date) return;

  const { error } = await apiRequest(`/meal-logs/day/${encodeURIComponent(point.date)}`, {
    method: 'DELETE', csrf: true,
  });
  throwApiError(error);
}

export async function deleteExerciseEntry(userId, point) {
  if (!userId || !point?.date) return;

  await deleteExerciseDay(userId, point.date);
  const rawState = readJson(EXERCISE_STORAGE_KEY, { logs: [], exerciseTypes: [] });
  const state = getExerciseState(rawState);
  localStorage.setItem(EXERCISE_STORAGE_KEY, JSON.stringify({
    ...state,
    logs: (state.logs || []).filter((log) => {
      const timestamp = getExerciseTimestamp(log);
      return (log.logDate || log.log_date || toYmd(timestamp)) !== point.date;
    }),
  }));
}

export async function fetchWeightSeries(userId, scope = 'all') {
  if (!userId) return [];
  const { payload, error } = await apiRequest('/weights?limit=365');
  throwApiError(error);
  return sortAscending(applyScope((payload.data || []).map(normalizeWeightPoint), scope));
}

export async function fetchCalorieSeries(userId, scope = 'all') {
  if (!userId) return [];
  const { payload, error } = await apiRequest('/meal-logs/summary');
  throwApiError(error);
  return sortAscending(applyScope((payload.data || []).map((row) => ({
    date: row.date,
    label: dayLabel(row.date),
    value: Number(row.total_kcal),
    extra: { calories: Number(row.total_kcal) },
  })), scope));
}

export async function fetchExerciseSeries(userId, scope = 'all') {
  if (!userId) return [];
  const remoteLogs = await listExerciseLogs(userId, { limit: 500 });
  const localLogs = readLocalExerciseLogs(userId);
  const merged = new Map();
  [...localLogs, ...remoteLogs].forEach((log) => {
    const id = log?.id || log?.source_record_id || log?.serverId;
    if (id) merged.set(id, log);
  });
  const rawState = getExerciseState(readJson(EXERCISE_STORAGE_KEY, {}));
  const mergedPoints = exerciseSeriesFromLogs(Array.from(merged.values()), rawState.exerciseTypes || []);
  return sortAscending(applyScope(mergedPoints, scope));
}
