function requestLogger(logger = console) {
  return function logRequest(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
    });

    next();
  };
}

module.exports = { requestLogger };
