const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const catalogModel = require('../models/catalog');
const {
  validateCatalogInput,
  validateCatalogQuery,
  validateItemId,
  validateSyncBody,
  validateSyncOperation,
} = require('../utils/catalogValidation');

function createCatalogRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication);

  router.get('/items', async (req, res) => {
    const filters = validateCatalogQuery(req.query);
    const items = await catalogModel.listCatalogItems(pool, req.auth.user.id, filters);
    res.json({ data: items, error: null });
  });

  router.get('/items/:itemId', async (req, res) => {
    const itemId = validateItemId(req.params.itemId);
    const item = await catalogModel.getCatalogItem(pool, req.auth.user.id, itemId);
    if (!item) return res.status(404).json({ error: 'Catalog item not found.' });
    return res.json({ data: item, error: null });
  });

  router.post('/items', requireCsrf, async (req, res) => {
    const input = validateCatalogInput(req.body);
    const item = await catalogModel.createCatalogItem(pool, req.auth.user.id, input);
    res.status(201).json({ data: item, error: null });
  });

  router.put('/items/:itemId', requireCsrf, async (req, res) => {
    const itemId = validateItemId(req.params.itemId);
    const input = validateCatalogInput(req.body);
    const item = await catalogModel.updateCatalogItem(pool, req.auth.user.id, itemId, input);
    res.json({ data: item, error: null });
  });

  router.delete('/items/:itemId', requireCsrf, async (req, res) => {
    const itemId = validateItemId(req.params.itemId);
    await catalogModel.deleteCatalogItem(pool, req.auth.user.id, itemId);
    res.status(204).end();
  });

  router.post('/items/:itemId/archive', requireCsrf, async (req, res) => {
    const itemId = validateItemId(req.params.itemId);
    const item = await catalogModel.archiveCatalogItem(pool, req.auth.user.id, itemId);
    res.json({ data: item, error: null });
  });

  router.post('/sync', requireCsrf, async (req, res) => {
    const rawOperations = validateSyncBody(req.body);
    const results = [];
    for (const rawOperation of rawOperations) {
      try {
        const operation = validateSyncOperation(rawOperation);
        results.push(await catalogModel.applySyncOperation(pool, req.auth.user.id, operation));
      } catch (error) {
        const permanent = Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
        results.push({
          status: permanent ? 'permanently_invalid' : 'retryable',
          operationId: rawOperation?.operationId || null,
          kind: rawOperation?.kind || null,
          error: permanent ? error.message : 'Catalog synchronization could not be completed.',
          ...(error.name === 'ConflictError' ? { errorCode: 'conflict' } : {}),
        });
      }
    }
    res.json({ data: { operations: results }, error: null });
  });

  return router;
}

module.exports = { createCatalogRouter };
