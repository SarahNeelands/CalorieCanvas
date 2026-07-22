const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const exerciseModel = require('../models/exercise');
const {
  stableId,
  uuid,
  validateDefinitionInput,
  validateListQuery,
  validateLogInput,
  validateSyncPayload,
} = require('../utils/exerciseValidation');

function createExerciseDefinitionRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/', async (req, res) => {
    const filters = validateListQuery(req.query);
    const definitions = await exerciseModel.listDefinitions(pool, req.auth.user.id, filters.includeArchived);
    res.json({ data: definitions, error: null });
  });

  router.post('/sync', requireCsrf, async (req, res) => {
    const payload = validateSyncPayload(req.body);
    const result = await exerciseModel.syncLocalState(
      pool, req.auth.user.id, payload.operationId, payload.definitions, payload.logs
    );
    res.json({ data: result, error: null });
  });

  router.get('/:exerciseId', async (req, res) => {
    const definition = await exerciseModel.getDefinition(pool, req.auth.user.id, stableId(req.params.exerciseId));
    if (!definition) return res.status(404).json({ error: 'Exercise definition was not found.' });
    return res.json({ data: definition, error: null });
  });

  router.post('/', requireCsrf, async (req, res) => {
    const input = validateDefinitionInput(req.body);
    const definition = await exerciseModel.createDefinition(pool, req.auth.user.id, input);
    res.status(201).json({ data: definition, error: null });
  });

  router.put('/:exerciseId', requireCsrf, async (req, res) => {
    const definition = await exerciseModel.updateDefinition(
      pool, req.auth.user.id, stableId(req.params.exerciseId), validateDefinitionInput(req.body, { partial: true })
    );
    res.json({ data: definition, error: null });
  });

  router.delete('/:exerciseId', requireCsrf, async (req, res) => {
    const definition = await exerciseModel.archiveDefinition(pool, req.auth.user.id, stableId(req.params.exerciseId));
    res.json({ data: definition, error: null });
  });

  return router;
}

function createExerciseLogRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/', async (req, res) => {
    const filters = validateListQuery(req.query);
    const logs = await exerciseModel.listLogs(pool, req.auth.user.id, filters);
    res.json({ data: logs, error: null });
  });

  router.get('/summary', async (req, res) => {
    const filters = validateListQuery(req.query);
    const summary = await exerciseModel.getSummary(pool, req.auth.user.id, filters);
    res.json({ data: summary, error: null });
  });

  router.post('/', requireCsrf, async (req, res) => {
    const input = validateLogInput(req.body);
    const log = await exerciseModel.createLog(pool, req.auth.user.id, input);
    res.status(log ? 201 : 200).json({ data: log, error: null });
  });

  router.put('/:logId', requireCsrf, async (req, res) => {
    const log = await exerciseModel.updateLog(
      pool, req.auth.user.id, uuid(req.params.logId, 'logId'), validateLogInput(req.body, { partial: true })
    );
    res.json({ data: log, error: null });
  });

  router.delete('/day/:date', requireCsrf, async (req, res) => {
    const date = validateListQuery({ start_date: req.params.date, end_date: req.params.date }).startDate;
    const deleted = await exerciseModel.deleteDay(pool, req.auth.user.id, date);
    res.json({ data: { deleted }, error: null });
  });

  router.delete('/:logId', requireCsrf, async (req, res) => {
    await exerciseModel.deleteLog(pool, req.auth.user.id, uuid(req.params.logId, 'logId'));
    res.status(204).end();
  });

  return router;
}

module.exports = { createExerciseDefinitionRouter, createExerciseLogRouter };
