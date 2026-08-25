const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const usualModel = require('../models/usual');
const { validateUsualId, validateUsualInput } = require('../utils/usualValidation');

function createUsualRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/', async (req, res) => {
    const usuals = await usualModel.listUsuals(pool, req.auth.user.id);
    res.json({ data: usuals, error: null });
  });

  router.post('/', requireCsrf, async (req, res) => {
    const input = validateUsualInput(req.body);
    const usual = await usualModel.upsertUsual(pool, req.auth.user.id, input);
    res.status(201).json({ data: usual, error: null });
  });

  router.put('/:usualId', requireCsrf, async (req, res) => {
    const usualId = validateUsualId(req.params.usualId);
    const patch = validateUsualInput(req.body, { partial: true });
    const usual = await usualModel.updateUsual(pool, req.auth.user.id, usualId, patch);
    res.json({ data: usual, error: null });
  });

  router.delete('/:usualId', requireCsrf, async (req, res) => {
    const usualId = validateUsualId(req.params.usualId);
    await usualModel.deleteUsual(pool, req.auth.user.id, usualId);
    res.status(204).end();
  });

  return router;
}

module.exports = { createUsualRouter };
