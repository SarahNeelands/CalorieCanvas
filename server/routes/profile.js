const express = require('express');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const profileModel = require('../models/profile');
const {
  validateProfilePatch,
  validateSetupPayload,
  validationError,
} = require('../utils/profileValidation');

const OWNER_PARAMETERS = new Set(['id', 'user_id', 'userId', 'owner_id', 'ownerId']);

function rejectOwnerParameters(req, res, next) {
  if (Object.keys(req.query).some((key) => OWNER_PARAMETERS.has(key))) {
    return next(validationError('Profile ownership is derived from the authenticated session.'));
  }
  return next();
}

function createProfileRouter({ pool }) {
  const router = express.Router();
  router.use(requireAuthentication, rejectOwnerParameters);

  router.get('/', async (req, res) => {
    const profile = await profileModel.getProfile(pool, req.auth.user.id);
    res.json({ data: profile, error: null });
  });

  router.put('/', requireCsrf, async (req, res) => {
    const patch = validateProfilePatch(req.body);
    const profile = await profileModel.upsertProfile(pool, req.auth.user.id, patch);
    res.json({ data: profile, error: null });
  });

  router.get('/setup', async (req, res) => {
    const progress = await profileModel.getSetupProgress(pool, req.auth.user.id);
    res.json({ data: progress, error: null });
  });

  router.put('/setup', requireCsrf, async (req, res) => {
    const setup = validateSetupPayload(req.body);
    const progress = await profileModel.saveSetupProgress(pool, req.auth.user.id, setup);
    res.json({ data: progress, error: null });
  });

  router.post('/setup/complete', requireCsrf, async (req, res) => {
    const setup = validateSetupPayload(req.body, { completing: true });
    const profile = await profileModel.completeSetup(
      pool,
      req.auth.user.id,
      { ...setup.setup_draft, completed: true, lastStep: null }
    );
    res.json({ data: profile, error: null });
  });

  router.get('/latest-weight', async (req, res) => {
    const weight = await profileModel.getLatestWeight(pool, req.auth.user.id);
    res.json({ data: weight, error: null });
  });

  return router;
}

module.exports = { createProfileRouter, rejectOwnerParameters };
