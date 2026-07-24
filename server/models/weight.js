const crypto = require('node:crypto');
const { withTransaction } = require('../db');
const { validateImportRecord, validateValue } = require('../utils/weightValidation');

const WEIGHT_COLUMNS = `
  id, user_id, date, value, unit, value_kg, source_record_id, created_at, updated_at
`;

function normalizeWeight(row) {
  if (!row) return null;
  return {
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    value: Number(row.value),
    value_kg: Number(row.value_kg),
  };
}

function modelError(message, status = 404) {
  const error = new Error(message);
  error.name = status === 404 ? 'NotFoundError' : 'ValidationError';
  error.status = status;
  return error;
}

async function listWeights(queryable, userId, { startDate, endDate, limit }) {
  const result = await queryable.query(
    `SELECT * FROM (
       SELECT ${WEIGHT_COLUMNS}
       FROM weights
       WHERE user_id = $1
         AND ($2::date IS NULL OR date >= $2::date)
         AND ($3::date IS NULL OR date <= $3::date)
       ORDER BY date DESC, created_at DESC, id DESC
       LIMIT $4
     ) recent
     ORDER BY date ASC, created_at ASC, id ASC`,
    [userId, startDate, endDate, limit]
  );
  return result.rows.map(normalizeWeight);
}

async function getLatestWeight(queryable, userId) {
  const result = await queryable.query(
    `SELECT ${WEIGHT_COLUMNS}
     FROM weights WHERE user_id = $1
     ORDER BY date DESC, created_at DESC, id DESC LIMIT 1`,
    [userId]
  );
  return normalizeWeight(result.rows[0]);
}

async function syncProfileWeight(client, userId) {
  await client.query(
    `UPDATE profiles
     SET weight_kg = (
       SELECT round(value_kg, 2)
       FROM weights
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC, id DESC
       LIMIT 1
     )
     WHERE user_id = $1`,
    [userId]
  );
}

async function createWeight(pool, userId, input) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `INSERT INTO weights (user_id, date, value, unit)
       VALUES ($1, $2, $3, $4)
       RETURNING ${WEIGHT_COLUMNS}`,
      [userId, input.date, input.value, input.unit]
    );
    await syncProfileWeight(client, userId);
    return normalizeWeight(result.rows[0]);
  });
}

async function updateWeight(pool, userId, weightId, patch) {
  return withTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT ${WEIGHT_COLUMNS} FROM weights
       WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [weightId, userId]
    );
    if (!existing.rows[0]) throw modelError('Weight entry was not found.');
    const current = normalizeWeight(existing.rows[0]);
    const unit = patch.unit ?? current.unit;
    const value = patch.value === undefined ? current.value : validateValue(patch.value, unit);
    validateValue(value, unit);
    const result = await client.query(
      `UPDATE weights SET date = $3, value = $4, unit = $5
       WHERE id = $1 AND user_id = $2
       RETURNING ${WEIGHT_COLUMNS}`,
      [weightId, userId, patch.date ?? current.date, value, unit]
    );
    await syncProfileWeight(client, userId);
    return normalizeWeight(result.rows[0]);
  });
}

async function deleteWeight(pool, userId, weightId) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `DELETE FROM weights WHERE id = $1 AND user_id = $2
       RETURNING ${WEIGHT_COLUMNS}`,
      [weightId, userId]
    );
    if (!result.rows[0]) throw modelError('Weight entry was not found.');
    await syncProfileWeight(client, userId);
    return normalizeWeight(result.rows[0]);
  });
}

function direction(change) {
  if (change === null) return 'no_data';
  if (change > 0) return 'gain';
  if (change < 0) return 'loss';
  return 'none';
}

function goalDirection(goalIntent, change) {
  if (change === null || change === 0 || goalIntent === 'maintain') return change === null ? 'unknown' : 'neutral';
  const wantsLoss = goalIntent === 'rapid_loss' || goalIntent === 'normal_loss';
  const wantsGain = goalIntent === 'rapid_gain' || goalIntent === 'normal_gain';
  if ((wantsLoss && change < 0) || (wantsGain && change > 0)) return 'toward_goal';
  if ((wantsLoss && change > 0) || (wantsGain && change < 0)) return 'away_from_goal';
  return 'unknown';
}

async function getSummary(queryable, userId, { startDate, endDate }) {
  const result = await queryable.query(
    `WITH ordered AS (
       SELECT value_kg, date, created_at, id
       FROM weights WHERE user_id = $1
     ), overall AS (
       SELECT
         (array_agg(value_kg ORDER BY date ASC, created_at ASC, id ASC))[1] AS starting,
         (array_agg(value_kg ORDER BY date DESC, created_at DESC, id DESC))[1] AS latest,
         count(*)::integer AS count
       FROM ordered
     ), period AS (
       SELECT
         (array_agg(value_kg ORDER BY date ASC, created_at ASC, id ASC))[1] AS starting,
         (array_agg(value_kg ORDER BY date DESC, created_at DESC, id DESC))[1] AS latest,
         count(*)::integer AS count
       FROM ordered
       WHERE ($2::date IS NULL OR date >= $2::date)
         AND ($3::date IS NULL OR date <= $3::date)
     )
     SELECT overall.starting, overall.latest, overall.count,
       period.starting AS period_starting, period.latest AS period_latest,
       period.count AS period_count, p.goal_weight_intent, p.target_weight_kg
     FROM overall CROSS JOIN period
     LEFT JOIN profiles p ON p.user_id = $1`,
    [userId, startDate, endDate]
  );
  const row = result.rows[0];
  const starting = row.starting === null ? null : Number(row.starting);
  const latest = row.latest === null ? null : Number(row.latest);
  const periodStarting = row.period_starting === null ? null : Number(row.period_starting);
  const periodLatest = row.period_latest === null ? null : Number(row.period_latest);
  const totalChange = starting === null ? null : Number((latest - starting).toFixed(6));
  const periodChange = periodStarting === null ? null : Number((periodLatest - periodStarting).toFixed(6));
  const target = row.target_weight_kg === null ? null : Number(row.target_weight_kg);
  const initialDistance = target === null || starting === null ? null : Math.abs(starting - target);
  const goalProgressPct = initialDistance === null
    ? null
    : initialDistance === 0
      ? (latest === target ? 100 : 0)
      : Number((((initialDistance - Math.abs(latest - target)) / initialDistance) * 100).toFixed(2));
  return {
    count: row.count,
    startingWeightKg: starting,
    latestWeightKg: latest,
    totalChangeKg: totalChange,
    direction: direction(totalChange),
    period: {
      startDate,
      endDate,
      count: row.period_count,
      startingWeightKg: periodStarting,
      latestWeightKg: periodLatest,
      changeKg: periodChange,
      direction: direction(periodChange),
    },
    goal: {
      intent: row.goal_weight_intent || null,
      targetWeightKg: target,
      direction: goalDirection(row.goal_weight_intent, totalChange),
      progressPct: goalProgressPct,
    },
  };
}

function stableJson(records) {
  return JSON.stringify(records.map((record) => ({
    id: record?.id ?? null,
    date: record?.date ?? null,
    value: record?.value ?? null,
    unit: record?.unit ?? null,
  })));
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function importWeights(pool, userId, operationId, records) {
  const requestDigest = digest(stableJson(records));
  return withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`weight-import:${userId}:${operationId}`]);
    const replay = await client.query(
      `SELECT request_digest, result FROM weight_import_operations
       WHERE user_id = $1 AND operation_id = $2`,
      [userId, operationId]
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_digest !== requestDigest) {
        throw modelError('Import operation ID has already been used for different data.', 409);
      }
      return { ...replay.rows[0].result, replayed: true };
    }

    const existingRows = await client.query(
      `SELECT date, value, unit FROM weights WHERE user_id = $1
       ORDER BY date, created_at, id`,
      [userId]
    );
    const existingCounts = new Map();
    existingRows.rows.forEach((row) => {
      const key = `${row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date}|${Number(row.value)}|${row.unit}`;
      existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
    });
    const seenCounts = new Map();
    const statuses = [];
    let imported = 0;
    let duplicate = 0;
    let invalid = 0;

    for (let index = 0; index < records.length; index += 1) {
      let record;
      try {
        record = validateImportRecord(records[index]);
      } catch (error) {
        invalid += 1;
        statuses.push({ index, status: 'invalid', message: error.message });
        continue;
      }
      const signature = `${record.date}|${record.value}|${record.unit}`;
      const occurrence = seenCounts.get(signature) || 0;
      seenCounts.set(signature, occurrence + 1);
      const sourceRecordId = `local:${digest(record.id ? `id:${record.id}` : `${signature}|${occurrence}`)}`;
      if (occurrence < (existingCounts.get(signature) || 0)) {
        duplicate += 1;
        statuses.push({ index, status: 'duplicate' });
        continue;
      }
      const preservedId = record.id
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id)
        ? record.id
        : crypto.randomUUID();
      const inserted = await client.query(
        `INSERT INTO weights (id, user_id, date, value, unit, source_record_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [preservedId, userId, record.date, record.value, record.unit, sourceRecordId]
      );
      if (inserted.rowCount === 0) {
        duplicate += 1;
        statuses.push({ index, status: 'duplicate' });
      } else {
        imported += 1;
        statuses.push({ index, status: 'imported', id: inserted.rows[0].id });
      }
    }

    await syncProfileWeight(client, userId);
    const result = {
      imported,
      skipped: duplicate + invalid,
      duplicate,
      invalid,
      records: statuses,
      committed: true,
      localDataMayBeRemoved: true,
      replayed: false,
    };
    await client.query(
      `INSERT INTO weight_import_operations (user_id, operation_id, request_digest, result)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, operationId, requestDigest, JSON.stringify(result)]
    );
    return result;
  });
}

module.exports = {
  createWeight,
  deleteWeight,
  getLatestWeight,
  getSummary,
  importWeights,
  listWeights,
  normalizeWeight,
  syncProfileWeight,
  updateWeight,
};
