const crypto = require('node:crypto');
const { withTransaction } = require('../db');
const { validateDefinitionInput, validateLogInput } = require('../utils/exerciseValidation');

const DEFINITION_COLUMNS = `
  record_id, id, user_id, is_shared, name, description,
  estimated_calories_per_hour, archived_at, created_at, updated_at
`;
const LOG_COLUMNS = `
  id, user_id, definition_id, definition_snapshot, duration_minutes, occurred_at,
  log_date, timezone_offset_minutes, sets, repetitions, resistance_value,
  resistance_unit, distance_value, distance_unit, calories_burned, calorie_source,
  notes, source_record_id, created_at, updated_at
`;

function normalizeDefinition(row) {
  if (!row) return null;
  return {
    ...row,
    estimated_calories_per_hour: row.estimated_calories_per_hour === null
      ? null : Number(row.estimated_calories_per_hour),
  };
}

function normalizeLog(row) {
  if (!row) return null;
  const numericFields = ['resistance_value', 'distance_value', 'calories_burned'];
  const normalized = { ...row };
  numericFields.forEach((field) => {
    if (normalized[field] !== null) normalized[field] = Number(normalized[field]);
  });
  normalized.log_date = row.log_date instanceof Date ? row.log_date.toISOString().slice(0, 10) : String(row.log_date);
  normalized.serverId = row.id;
  normalized.id = row.source_record_id || row.id;
  normalized.userId = row.user_id;
  normalized.typeId = row.definition_id;
  normalized.minutes = row.duration_minutes;
  normalized.timestampISO = row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at;
  return normalized;
}

function modelError(message, status = 404) {
  const error = new Error(message);
  error.name = status === 404 ? 'NotFoundError' : 'ValidationError';
  error.status = status;
  return error;
}

async function listDefinitions(queryable, userId, includeArchived = false) {
  const result = await queryable.query(
    `SELECT ${DEFINITION_COLUMNS}
     FROM exercise_definitions
     WHERE (is_shared OR user_id = $1)
       AND ($2::boolean OR archived_at IS NULL)
     ORDER BY is_shared DESC, lower(name), id`,
    [userId, includeArchived]
  );
  return result.rows.map(normalizeDefinition);
}

async function getDefinition(queryable, userId, definitionId, { activeOnly = false } = {}) {
  const result = await queryable.query(
    `SELECT ${DEFINITION_COLUMNS}
     FROM exercise_definitions
     WHERE id = $1 AND (is_shared OR user_id = $2)
       AND ($3::boolean = false OR archived_at IS NULL)
     ORDER BY (user_id = $2) DESC NULLS LAST LIMIT 1`,
    [definitionId, userId, activeOnly]
  );
  return normalizeDefinition(result.rows[0]);
}

async function createDefinition(queryable, userId, input) {
  const result = await queryable.query(
    `INSERT INTO exercise_definitions (
       id, user_id, is_shared, name, description, estimated_calories_per_hour
     ) VALUES ($1, $2, false, $3, $4, $5)
     RETURNING ${DEFINITION_COLUMNS}`,
    [input.id, userId, input.name, input.description ?? null, input.estimated_calories_per_hour ?? null]
  );
  return normalizeDefinition(result.rows[0]);
}

async function updateDefinition(queryable, userId, definitionId, patch) {
  const fields = Object.keys(patch);
  const assignments = fields.map((field, index) => `${field} = $${index + 3}`);
  const result = await queryable.query(
    `UPDATE exercise_definitions SET ${assignments.join(', ')}
     WHERE id = $1 AND user_id = $2 AND NOT is_shared AND archived_at IS NULL
     RETURNING ${DEFINITION_COLUMNS}`,
    [definitionId, userId, ...fields.map((field) => patch[field])]
  );
  if (!result.rows[0]) throw modelError('Exercise definition was not found.');
  return normalizeDefinition(result.rows[0]);
}

async function archiveDefinition(queryable, userId, definitionId) {
  const result = await queryable.query(
    `UPDATE exercise_definitions SET archived_at = now()
     WHERE id = $1 AND user_id = $2 AND NOT is_shared AND archived_at IS NULL
     RETURNING ${DEFINITION_COLUMNS}`,
    [definitionId, userId]
  );
  if (!result.rows[0]) throw modelError('Exercise definition was not found.');
  return normalizeDefinition(result.rows[0]);
}

function snapshotDefinition(definition) {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    estimated_calories_per_hour: definition.estimated_calories_per_hour,
    is_shared: definition.is_shared,
  };
}

function resolveCalories(input, snapshot, current = null) {
  if (Object.prototype.hasOwnProperty.call(input, 'calories_burned')) {
    if (input.calories_burned !== null) return { value: input.calories_burned, source: 'user' };
    const estimate = snapshot.estimated_calories_per_hour;
    return estimate === null
      ? { value: null, source: 'none' }
      : { value: Number(((estimate * input.duration_minutes) / 60).toFixed(2)), source: 'estimate' };
  }
  if (current && current.calorie_source !== 'estimate') {
    return { value: current.calories_burned, source: current.calorie_source };
  }
  const estimate = snapshot.estimated_calories_per_hour;
  return estimate === null
    ? { value: null, source: 'none' }
    : { value: Number(((estimate * input.duration_minutes) / 60).toFixed(2)), source: 'estimate' };
}

async function insertLog(client, userId, input, { id = null } = {}) {
  const definition = await getDefinition(client, userId, input.definition_id, { activeOnly: true });
  if (!definition) throw modelError('Exercise definition was not found.', 400);
  const snapshot = snapshotDefinition(definition);
  const calories = resolveCalories(input, snapshot);
  const result = await client.query(
    `INSERT INTO exercise_logs (
       id, user_id, definition_id, definition_snapshot, duration_minutes, occurred_at,
       log_date, timezone_offset_minutes, sets, repetitions, resistance_value,
       resistance_unit, distance_value, distance_unit, calories_burned, calorie_source,
       notes, source_record_id
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5, $6, $7, $8,
       $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
     ) ON CONFLICT DO NOTHING
     RETURNING ${LOG_COLUMNS}`,
    [
      id, userId, input.definition_id, JSON.stringify(snapshot), input.duration_minutes,
      input.occurred_at, input.log_date, input.timezone_offset_minutes,
      input.sets ?? null, input.repetitions ?? null, input.resistance_value ?? null,
      input.resistance_unit ?? null, input.distance_value ?? null, input.distance_unit ?? null,
      calories.value, calories.source, input.notes ?? null, input.source_record_id ?? null,
    ]
  );
  return normalizeLog(result.rows[0]);
}

async function createLog(pool, userId, input) {
  return withTransaction(pool, (client) => insertLog(client, userId, input));
}

async function listLogs(queryable, userId, { startDate, endDate, limit }) {
  const result = await queryable.query(
    `SELECT * FROM (
       SELECT ${LOG_COLUMNS} FROM exercise_logs
       WHERE user_id = $1
         AND ($2::date IS NULL OR log_date >= $2)
         AND ($3::date IS NULL OR log_date <= $3)
       ORDER BY occurred_at DESC, id DESC LIMIT $4
     ) recent ORDER BY occurred_at DESC, id DESC`,
    [userId, startDate, endDate, limit]
  );
  return result.rows.map(normalizeLog);
}

async function updateLog(pool, userId, logId, patch) {
  return withTransaction(pool, async (client) => {
    const found = await client.query(
      `SELECT ${LOG_COLUMNS} FROM exercise_logs WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [logId, userId]
    );
    if (!found.rows[0]) throw modelError('Exercise log was not found.');
    const current = normalizeLog(found.rows[0]);
    const input = {
      definition_id: patch.definition_id ?? current.definition_id,
      duration_minutes: patch.duration_minutes ?? current.duration_minutes,
      occurred_at: patch.occurred_at ?? current.timestampISO,
      log_date: patch.log_date ?? current.log_date,
      timezone_offset_minutes: patch.timezone_offset_minutes ?? current.timezone_offset_minutes,
      sets: patch.sets === undefined ? current.sets : patch.sets,
      repetitions: patch.repetitions === undefined ? current.repetitions : patch.repetitions,
      resistance_value: patch.resistance_value === undefined ? current.resistance_value : patch.resistance_value,
      resistance_unit: patch.resistance_unit === undefined ? current.resistance_unit : patch.resistance_unit,
      distance_value: patch.distance_value === undefined ? current.distance_value : patch.distance_value,
      distance_unit: patch.distance_unit === undefined ? current.distance_unit : patch.distance_unit,
      notes: patch.notes === undefined ? current.notes : patch.notes,
    };
    let snapshot = current.definition_snapshot;
    if (patch.definition_id !== undefined) {
      const definition = await getDefinition(client, userId, input.definition_id, { activeOnly: true });
      if (!definition) throw modelError('Exercise definition was not found.', 400);
      snapshot = snapshotDefinition(definition);
    }
    const calorieInput = { ...input };
    if (Object.prototype.hasOwnProperty.call(patch, 'calories_burned')) calorieInput.calories_burned = patch.calories_burned;
    const calories = resolveCalories(calorieInput, snapshot, current);
    const result = await client.query(
      `UPDATE exercise_logs SET
         definition_id = $3, definition_snapshot = $4::jsonb, duration_minutes = $5,
         occurred_at = $6, log_date = $7, timezone_offset_minutes = $8, sets = $9,
         repetitions = $10, resistance_value = $11, resistance_unit = $12,
         distance_value = $13, distance_unit = $14, calories_burned = $15,
         calorie_source = $16, notes = $17
       WHERE id = $1 AND user_id = $2 RETURNING ${LOG_COLUMNS}`,
      [
        logId, userId, input.definition_id, JSON.stringify(snapshot), input.duration_minutes,
        input.occurred_at, input.log_date, input.timezone_offset_minutes, input.sets,
        input.repetitions, input.resistance_value, input.resistance_unit, input.distance_value,
        input.distance_unit, calories.value, calories.source, input.notes,
      ]
    );
    return normalizeLog(result.rows[0]);
  });
}

async function deleteLog(queryable, userId, logId) {
  const result = await queryable.query(
    'DELETE FROM exercise_logs WHERE id = $1 AND user_id = $2 RETURNING id', [logId, userId]
  );
  if (!result.rowCount) throw modelError('Exercise log was not found.');
}

async function deleteDay(pool, userId, date) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      'DELETE FROM exercise_logs WHERE user_id = $1 AND log_date = $2 RETURNING id', [userId, date]
    );
    return result.rowCount;
  });
}

async function getSummary(queryable, userId, { startDate, endDate }) {
  const result = await queryable.query(
    `SELECT log_date, definition_id, definition_snapshot->>'name' AS name,
       duration_minutes, calories_burned, sets, repetitions, distance_value, distance_unit
     FROM exercise_logs
     WHERE user_id = $1
       AND ($2::date IS NULL OR log_date >= $2)
       AND ($3::date IS NULL OR log_date <= $3)
     ORDER BY log_date, occurred_at, id`,
    [userId, startDate, endDate]
  );
  const days = new Map();
  for (const row of result.rows) {
    const date = row.log_date instanceof Date ? row.log_date.toISOString().slice(0, 10) : String(row.log_date);
    if (!days.has(date)) days.set(date, {
      date, minutes: 0, calories: 0, sets: 0, repetitions: 0,
      entries: 0, distanceByUnit: {}, types: [],
    });
    const day = days.get(date);
    day.minutes += row.duration_minutes;
    day.calories = Number((day.calories + Number(row.calories_burned || 0)).toFixed(2));
    day.sets += row.sets || 0;
    day.repetitions += row.repetitions || 0;
    day.entries += 1;
    if (row.distance_unit) {
      day.distanceByUnit[row.distance_unit] = Number(
        ((day.distanceByUnit[row.distance_unit] || 0) + Number(row.distance_value)).toFixed(4)
      );
    }
    const type = day.types.find((item) => item.id === row.definition_id);
    if (type) type.minutes += row.duration_minutes;
    else day.types.push({ id: row.definition_id, name: row.name, minutes: row.duration_minutes });
  }
  const daily = Array.from(days.values());
  return {
    startDate, endDate, daily,
    totals: daily.reduce((total, day) => ({
      minutes: total.minutes + day.minutes,
      calories: Number((total.calories + day.calories).toFixed(2)),
      sets: total.sets + day.sets,
      repetitions: total.repetitions + day.repetitions,
      entries: total.entries + day.entries,
      distanceByUnit: Object.entries(day.distanceByUnit).reduce((distances, [unit, value]) => ({
        ...distances,
        [unit]: Number(((distances[unit] || 0) + value).toFixed(4)),
      }), total.distanceByUnit),
    }), { minutes: 0, calories: 0, sets: 0, repetitions: 0, entries: 0, distanceByUnit: {} }),
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function syncLocalState(pool, userId, operationId, definitions, logs) {
  const requestDigest = digest({ definitions, logs });
  return withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`exercise-sync:${userId}:${operationId}`]);
    const replay = await client.query(
      'SELECT request_digest, result FROM exercise_sync_operations WHERE user_id = $1 AND operation_id = $2',
      [userId, operationId]
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_digest !== requestDigest) throw modelError('Synchronization operation was already used.', 409);
      return { ...replay.rows[0].result, replayed: true };
    }
    let definitionsImported = 0;
    for (const raw of definitions) {
      const input = validateDefinitionInput(raw);
      const result = await client.query(
        `INSERT INTO exercise_definitions (id, user_id, is_shared, name, description, estimated_calories_per_hour)
         VALUES ($1, $2, false, $3, $4, $5)
         ON CONFLICT (user_id, id) WHERE NOT is_shared DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description,
           estimated_calories_per_hour = EXCLUDED.estimated_calories_per_hour,
           archived_at = NULL
         RETURNING id`,
        [input.id, userId, input.name, input.description ?? null, input.estimated_calories_per_hour ?? null]
      );
      definitionsImported += result.rowCount;
    }
    let logsImported = 0;
    let duplicates = 0;
    for (const raw of logs) {
      const input = validateLogInput(raw);
      const preservedId = input.source_record_id
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.source_record_id)
        ? input.source_record_id : null;
      const log = await insertLog(client, userId, input, { id: preservedId });
      if (log) logsImported += 1;
      else duplicates += 1;
    }
    const result = { definitionsImported, logsImported, duplicates, committed: true, localDataRetained: true, replayed: false };
    await client.query(
      `INSERT INTO exercise_sync_operations (user_id, operation_id, request_digest, result)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, operationId, requestDigest, JSON.stringify(result)]
    );
    return result;
  });
}

module.exports = {
  archiveDefinition, createDefinition, createLog, deleteDay, deleteLog, getDefinition,
  getSummary, listDefinitions, listLogs, normalizeDefinition, normalizeLog,
  syncLocalState, updateDefinition, updateLog,
};
