const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { requireCsrf } = require('../middleware/csrf');
const { requireAuthentication } = require('../middleware/session');
const {
  clearAuthenticationCookies,
  setAuthenticationCookies,
} = require('../utils/cookies');

function createOriginMiddleware(appOrigins) {
  const trustedOrigins = new Set(appOrigins);
  return function validateOrigin(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (trustedOrigins.size === 0 || trustedOrigins.has(req.headers.origin)) return next();
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  };
}

function createLimiter(config, maximum) {
  return rateLimit({
    windowMs: config.rateLimits.windowMinutes * 60 * 1000,
    limit: maximum,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });
}

function createAuthRouter({ authService, config }) {
  const router = express.Router();
  router.use(createOriginMiddleware(config.appOrigins));
  const loginLimiter = createLimiter(config, config.rateLimits.login);
  const signupLimiter = createLimiter(config, config.rateLimits.signup);
  const forgotPasswordLimiter = createLimiter(config, config.rateLimits.passwordAction);
  const resendVerificationLimiter = createLimiter(config, config.rateLimits.passwordAction);
  const resetPasswordLimiter = createLimiter(config, config.rateLimits.passwordAction);

  router.post('/signup', signupLimiter, async (req, res) => {
    await authService.signUp(req.body || {});
    res.status(202).json({ message: 'If the address can be registered, verification instructions will be sent.' });
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const result = await authService.login({
      ...(req.body || {}),
      previousSessionDigest: req.auth.sessionDigest,
    });
    setAuthenticationCookies(res, config, result.session);
    res.json({
      data: { user: result.user, session: { user: result.user } },
      error: null,
      csrfToken: result.session.rawCsrfToken,
    });
  });

  router.post('/logout', requireAuthentication, requireCsrf, async (req, res) => {
    await authService.logout(req.auth.sessionDigest);
    clearAuthenticationCookies(res, config);
    res.status(204).end();
  });

  router.get('/session', (req, res) => {
    const user = req.auth.user ? { id: req.auth.user.id, email: req.auth.user.email } : null;
    res.json({ session: user ? { user } : null, csrfToken: user ? req.auth.csrfToken : null });
  });

  router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    await authService.requestPasswordReset(req.body?.email);
    res.status(202).json({ message: 'If the account exists, password reset instructions will be sent.' });
  });

  router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
    const result = await authService.completePasswordReset(req.body || {});
    setAuthenticationCookies(res, config, result.session);
    res.json({
      data: { user: result.user, session: result.session ? { user: result.user } : null },
      error: null,
      csrfToken: result.session?.rawCsrfToken || null,
    });
  });

  router.post('/change-password', requireAuthentication, requireCsrf, async (req, res) => {
    const result = await authService.changePassword({
      userId: req.auth.user.id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
    });
    setAuthenticationCookies(res, config, result.session);
    res.json({
      data: { user: result.user, session: { user: result.user } },
      error: null,
      csrfToken: result.session.rawCsrfToken,
    });
  });

  router.post('/verify-email', async (req, res) => {
    const result = await authService.verifyEmail({
      token: req.body?.token,
      previousSessionDigest: req.auth.sessionDigest,
    });
    setAuthenticationCookies(res, config, result.session);
    res.json({
      data: { user: result.user, session: result.session ? { user: result.user } : null },
      error: null,
      csrfToken: result.session?.rawCsrfToken || null,
    });
  });

  router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
    await authService.requestEmailVerification(req.body?.email);
    res.status(202).json({ message: 'If verification is needed, instructions will be sent.' });
  });

  return router;
}

module.exports = { createAuthRouter, createLimiter, createOriginMiddleware };
