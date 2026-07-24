function createCorsMiddleware(trustedOrigins) {
  const allowed = new Set(trustedOrigins);

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (!allowed.has(origin)) {
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'Request origin is not allowed.' });
      }
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.vary('Origin');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
}

module.exports = { createCorsMiddleware };
