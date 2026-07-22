const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const weightModel = require('../models/weight');
const {
  validateImportPayload,
  validateListQuery,
  validateUuid,
  validateWeightInput,
} = require('../utils/weightValidation');

function createWeightRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/', async (req, res) => {
    const filters = validateListQuery(req.query);
    const weights = await weightModel.listWeights(pool, req.auth.user.id, filters);
    res.json({ data: weights, error: null });
  });

  router.get('/latest', async (req, res) => {
    validateListQuery(req.query);
    const weight = await weightModel.getLatestWeight(pool, req.auth.user.id);
    res.json({ data: weight, error: null });
  });

  router.get('/summary', async (req, res) => {
    const filters = validateListQuery(req.query);
    const summary = await weightModel.getSummary(pool, req.auth.user.id, filters);
    res.json({ data: summary, error: null });
  });

  router.post('/', requireCsrf, async (req, res) => {
    const input = validateWeightInput(req.body);
    const weight = await weightModel.createWeight(pool, req.auth.user.id, input);
    res.status(201).json({ data: weight, error: null });
  });

  router.put('/:weightId', requireCsrf, async (req, res) => {
    const weightId = validateUuid(req.params.weightId);
    const patch = validateWeightInput(req.body, { partial: true });
    const weight = await weightModel.updateWeight(pool, req.auth.user.id, weightId, patch);
    res.json({ data: weight, error: null });
  });

  router.delete('/:weightId', requireCsrf, async (req, res) => {
    const weightId = validateUuid(req.params.weightId);
    await weightModel.deleteWeight(pool, req.auth.user.id, weightId);
    res.status(204).end();
  });

  router.post('/import/browser', requireCsrf, async (req, res) => {
    const payload = validateImportPayload(req.body);
    const result = await weightModel.importWeights(
      pool,
      req.auth.user.id,
      payload.operationId,
      payload.records
    );
    res.json({ data: result, error: null });
  });

  return router;
}

module.exports = { createWeightRouter };
