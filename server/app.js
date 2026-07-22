const express = require('express');
const helmet = require('helmet');
const database = require('./db');
const { createAuthService } = require('./auth');
const { createCorsMiddleware } = require('./middleware/cors');
const { createErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { createSessionMiddleware } = require('./middleware/session');
const { createAuthRouter } = require('./routes/auth');
const { createCatalogRouter } = require('./routes/catalog');
const { createHealthRouter } = require('./routes/health');
const { createMealLogRouter } = require('./routes/mealLog');
const { createProfileRouter } = require('./routes/profile');
const { createWeightRouter } = require('./routes/weight');
const { createExerciseDefinitionRouter, createExerciseLogRouter } = require('./routes/exercise');
const { loadEnvironment } = require('./utils/env');

function createLazyPool() {
  return {
    connect: (...args) => database.getPool().connect(...args),
    query: (...args) => database.getPool().query(...args),
  };
}

function createApp({
  authConfig,
  authPool,
  databaseClient = database,
  logger = console,
  tokenDelivery,
} = {}) {
  const app = express();
  const config = authConfig || loadEnvironment().auth;
  const pool = authPool || createLazyPool();
  const authService = createAuthService({ pool, config, tokenDelivery });

  app.disable('x-powered-by');
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(createCorsMiddleware(config.appOrigins));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger(logger));

  app.use('/api', createHealthRouter(databaseClient));
  app.use(createSessionMiddleware({ pool, config }));
  app.use('/api/auth', createAuthRouter({ authService, config }));
  app.use('/api/profile', createProfileRouter({ pool }));
  app.use('/api/catalog', createCatalogRouter({ pool }));
  app.use('/api/meal-logs', createMealLogRouter({ pool }));
  app.use('/api/weights', createWeightRouter({ pool }));
  app.use('/api/exercises', createExerciseDefinitionRouter({ pool }));
  app.use('/api/exercise-logs', createExerciseLogRouter({ pool }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

module.exports = { createApp };
