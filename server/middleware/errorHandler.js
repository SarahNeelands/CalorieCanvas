function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

function createErrorHandler(logger = console) {
  return function errorHandler(error, req, res, next) {
    void req;

    if (res.headersSent) {
      return next(error);
    }

    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
    logger.error?.('Request failed.', { errorType: error.name || 'Error', status });
    const message = status === 500 ? 'Internal server error.' : (error.message || 'Request failed.');
    return res.status(status).json({ error: message });
  };
}

const errorHandler = createErrorHandler();

module.exports = { createErrorHandler, errorHandler, notFoundHandler };
