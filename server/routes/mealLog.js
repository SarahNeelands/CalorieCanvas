const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const mealLogModel = require('../models/mealLog');
const {
  validateEntryId,
  validateListQuery,
  validateMealLogInput,
  validationError,
} = require('../utils/mealLogValidation');

function validateDateParam(value) {
  return validateListQuery({ start_date: value, end_date: value, limit: 1 }).startDate;
}

function createMealLogRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/', async (req, res) => {
    const filters = validateListQuery(req.query);
    const entries = await mealLogModel.listMealLogs(pool, req.auth.user.id, filters);
    res.json({ data: entries, error: null });
  });

  router.get('/days/:date', async (req, res) => {
    const date = validateDateParam(req.params.date);
    const day = await mealLogModel.getMealLogDay(pool, req.auth.user.id, date);
    res.json({ data: day, error: null });
  });

  router.get('/days/:date/summary', async (req, res) => {
    const date = validateDateParam(req.params.date);
    const totals = await mealLogModel.getDailyTotals(pool, req.auth.user.id, date);
    res.json({ data: totals, error: null });
  });

  router.get('/summary', async (req, res) => {
    const totals = await mealLogModel.getDailyTotalsRange(pool, req.auth.user.id);
    res.json({ data: totals, error: null });
  });

  router.post('/entries', requireCsrf, async (req, res) => {
    const input = validateMealLogInput(req.body);
    const entry = await mealLogModel.createMealLog(pool, req.auth.user.id, input);
    res.status(201).json({ data: entry, error: null });
  });

  router.post('/batch', requireCsrf, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
        || Object.keys(req.body).some((key) => key !== 'entries')
        || !Array.isArray(req.body.entries)
        || req.body.entries.length < 1
        || req.body.entries.length > 50) {
      throw validationError('entries must contain between 1 and 50 meal logs.');
    }
    const inputs = req.body.entries.map((entry) => validateMealLogInput(entry));
    const entries = await mealLogModel.createMealLogsBatch(pool, req.auth.user.id, inputs);
    res.status(201).json({ data: entries, error: null });
  });

  router.put('/entries/:entryId', requireCsrf, async (req, res) => {
    const entryId = validateEntryId(req.params.entryId);
    const patch = validateMealLogInput(req.body, { partial: true });
    if ((patch.logged_at || patch.log_date || patch.timezone_offset_minutes !== undefined)
        && !(patch.logged_at && patch.log_date && patch.timezone_offset_minutes !== undefined)) {
      throw validationError('logged_at, log_date, and timezone_offset_minutes must be updated together.');
    }
    const entry = await mealLogModel.updateMealLog(pool, req.auth.user.id, entryId, patch);
    res.json({ data: entry, error: null });
  });

  router.delete('/entries/:entryId', requireCsrf, async (req, res) => {
    const entryId = validateEntryId(req.params.entryId);
    await mealLogModel.deleteMealLog(pool, req.auth.user.id, entryId);
    res.status(204).end();
  });

  router.delete('/day/:date', requireCsrf, async (req, res) => {
    const date = validateDateParam(req.params.date);
    await mealLogModel.deleteMealLogDay(pool, req.auth.user.id, date);
    res.status(204).end();
  });

  return router;
}

module.exports = { createMealLogRouter };
