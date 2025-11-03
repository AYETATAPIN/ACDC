import { buildApp } from './app.js';
import { config } from './config.js';

const start = async () => {
  const app = await buildApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${config.port}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});

