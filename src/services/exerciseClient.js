import { apiRequest } from './apiClient';

const SYNC_OPERATION_KEY = 'exercise_sync_operation_v1';

function throwApiError(error) {
  if (error) throw new Error(error.message || 'Exercise request failed.');
}

export function formatLocalDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeDefinition(row) {
  return {
    ...row,
    id: row.id,
    name: row.name,
    isShared: Boolean(row.is_shared),
  };
}

export function normalizeExerciseLog(row) {
  return {
    ...row,
    id: row.id,
    serverId: row.serverId || row.server_id || row.id,
    userId: row.userId || row.user_id,
    typeId: row.typeId || row.definition_id || row.type_id,
    minutes: Number(row.minutes ?? row.duration_minutes ?? 0),
    timestampISO: row.timestampISO || row.occurred_at || row.timestamp_iso,
    logDate: row.logDate || row.log_date || formatLocalDate(row.timestampISO || new Date()),
  };
}

function expressLogPayload(log, { partial = false } = {}) {
  const body = {};
  const copy = (target, ...sources) => {
    const source = sources.find((name) => log[name] !== undefined);
    if (source) body[target] = log[source];
  };
  copy('definition_id', 'definition_id', 'typeId', 'type_id');
  copy('duration_minutes', 'duration_minutes', 'minutes');
  copy('sets', 'sets');
  copy('repetitions', 'repetitions', 'reps');
  copy('resistance_value', 'resistance_value', 'resistanceValue');
  copy('resistance_unit', 'resistance_unit', 'resistanceUnit');
  copy('distance_value', 'distance_value', 'distanceValue');
  copy('distance_unit', 'distance_unit', 'distanceUnit');
  copy('calories_burned', 'calories_burned', 'caloriesBurned', 'calories');
  copy('notes', 'notes');
  copy('source_record_id', 'source_record_id', 'sourceRecordId');
  const rawTimestamp = log.occurred_at || log.timestampISO || log.timestamp_iso;
  if (rawTimestamp !== undefined) {
    const occurredAt = new Date(rawTimestamp);
    body.occurred_at = occurredAt.toISOString();
    body.log_date = log.log_date || log.logDate || formatLocalDate(occurredAt);
    body.timezone_offset_minutes = log.timezone_offset_minutes ?? -occurredAt.getTimezoneOffset();
  } else if (!partial) {
    const occurredAt = new Date();
    body.occurred_at = occurredAt.toISOString();
    body.log_date = formatLocalDate(occurredAt);
    body.timezone_offset_minutes = -occurredAt.getTimezoneOffset();
  }
  return body;
}

export async function listExerciseDefinitions(userId, { includeArchived = false } = {}) {
  const { payload, error } = await apiRequest(`/exercises${includeArchived ? '?include_archived=true' : ''}`);
  throwApiError(error);
  return (payload.data || []).map(normalizeDefinition);
}

export async function createExerciseDefinition(userId, input) {
  const { payload, error } = await apiRequest('/exercises', { method: 'POST', csrf: true, body: input });
  throwApiError(error);
  return normalizeDefinition(payload.data);
}

export async function updateExerciseDefinition(userId, exerciseId, patch) {
  const { payload, error } = await apiRequest(`/exercises/${encodeURIComponent(exerciseId)}`, {
    method: 'PUT', csrf: true, body: patch,
  });
  throwApiError(error);
  return normalizeDefinition(payload.data);
}

export async function archiveExerciseDefinition(userId, exerciseId) {
  const { payload, error } = await apiRequest(`/exercises/${encodeURIComponent(exerciseId)}`, {
    method: 'DELETE', csrf: true,
  });
  throwApiError(error);
  return normalizeDefinition(payload.data);
}

export async function listExerciseLogs(userId, { startDate, endDate, limit = 200 } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (startDate && endDate) {
    query.set('start_date', startDate);
    query.set('end_date', endDate);
  }
  const { payload, error } = await apiRequest(`/exercise-logs?${query}`);
  throwApiError(error);
  return (payload.data || []).map(normalizeExerciseLog);
}

export async function createExerciseLog(userId, log) {
  const body = expressLogPayload({ ...log, sourceRecordId: log.sourceRecordId || log.id });
  const { payload, error } = await apiRequest('/exercise-logs', { method: 'POST', csrf: true, body });
  throwApiError(error);
  return normalizeExerciseLog(payload.data || log);
}

export async function updateExerciseLog(userId, logId, patch) {
  const { payload, error } = await apiRequest(`/exercise-logs/${encodeURIComponent(logId)}`, {
    method: 'PUT', csrf: true, body: expressLogPayload(patch, { partial: true }),
  });
  throwApiError(error);
  return normalizeExerciseLog(payload.data);
}

export async function deleteExerciseLog(userId, logId) {
  const { error } = await apiRequest(`/exercise-logs/${encodeURIComponent(logId)}`, { method: 'DELETE', csrf: true });
  throwApiError(error);
}

export async function deleteExerciseDay(userId, date) {
  const { error } = await apiRequest(`/exercise-logs/day/${encodeURIComponent(date)}`, { method: 'DELETE', csrf: true });
  throwApiError(error);
  return true;
}

export async function fetchExerciseSummary({ startDate = null, endDate = null } = {}) {
  const query = new URLSearchParams();
  if (startDate && endDate) {
    query.set('start_date', startDate);
    query.set('end_date', endDate);
  }
  const suffix = query.toString();
  const { payload, error } = await apiRequest(`/exercise-logs/summary${suffix ? `?${suffix}` : ''}`);
  throwApiError(error);
  return payload.data;
}

function operationId() {
  return window.crypto.randomUUID();
}

export async function syncLocalExerciseState(userId, { definitions, logs }) {
  if (!definitions.length && !logs.length) return null;
  const normalizedDefinitions = definitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    ...(definition.estimated_calories_per_hour !== undefined
      ? { estimated_calories_per_hour: definition.estimated_calories_per_hour }
      : {}),
  }));
  const normalizedLogs = logs.map((log) => expressLogPayload({ ...log, sourceRecordId: log.id }));
  const bodySnapshot = JSON.stringify({ definitions: normalizedDefinitions, logs: normalizedLogs });
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(SYNC_OPERATION_KEY) || 'null'); } catch {}
  const operation = stored?.snapshot === bodySnapshot
    ? stored : { operationId: operationId(), snapshot: bodySnapshot };
  localStorage.setItem(SYNC_OPERATION_KEY, JSON.stringify(operation));
  const { payload, error } = await apiRequest('/exercises/sync', {
    method: 'POST', csrf: true,
    body: { operationId: operation.operationId, definitions: normalizedDefinitions, logs: normalizedLogs },
  });
  throwApiError(error);
  return payload.data;
}
