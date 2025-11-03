import express from 'express';
import { getPool, initDb } from './db.js';
import { getRedis, initRedis } from './cache.js';
import { DiagramRepository } from './repositories/diagramRepository.js';
import { DiagramService } from './services/diagramService.js';
import { DiagramController } from './controllers/diagramController.js';
import { createDiagramRouter } from './routes/diagrams.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const buildApp = async () => {
  await initDb();
  await initRedis();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const repo = new DiagramRepository(getPool());
  const service = new DiagramService(repo, getRedis());
  const controller = new DiagramController(service);

  app.use('/api/v1/diagrams', createDiagramRouter(controller));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

