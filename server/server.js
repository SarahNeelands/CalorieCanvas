const { createApp } = require('./app');
const { closeDatabase } = require('./db');
const { loadEnvironment } = require('./utils/env');

const config = loadEnvironment();
const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.info(`Calorie Canvas API listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.info(`${signal} received; shutting down.`);

  server.close(async (error) => {
    try {
      await closeDatabase();
    } finally {
      process.exitCode = error ? 1 : 0;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
