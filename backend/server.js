// ==================== Server bootstrap ====================
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { initCache, closeCache } from './services/cache.js';
import { initFirebase } from './services/firebaseAdmin.js';

async function main() {
  initFirebase();
  await initCache();

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info(`Mochi Hunt API listening on http://${config.host}:${config.port} (${config.env})`);
    logger.info(`on-chain validation: ${config.genlayer.requireOnchain ? 'REQUIRED' : 'disabled (local-dev)'}`);
  });

  const shutdown = (sig) => {
    logger.info(`${sig} received, shutting down`);
    server.close(async () => {
      await closeCache();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
