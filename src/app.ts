// src/app.ts
import express from 'express';
import { getPool, initDb } from './db.js';
import { DiagramRepository } from './repositories/diagramRepository.js';
import { DiagramBlockRepository } from './repositories/diagramBlockRepository.js';
import { DiagramConnectionRepository } from './repositories/diagramConnectionRepository.js';
import { DiagramService } from './services/diagramService.js';
import { DiagramBlockService } from './services/diagramBlockService.js';
import { DiagramConnectionService } from './services/diagramConnectionService.js';
import { DiagramController } from './controllers/diagramController.js';
import { DiagramBlockController } from './controllers/diagramBlockController.js';
import { DiagramConnectionController } from './controllers/diagramConnectionController.js';
import { createDiagramRouter } from './routes/diagrams.js';
import { createDiagramBlockRouter } from './routes/diagramBlocks.js';
import { createDiagramConnectionRouter } from './routes/diagramConnections.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const buildApp = async () => {
  await initDb();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const pool = getPool();
  
  // Репозитории
  const diagramRepo = new DiagramRepository(pool);
  const blockRepo = new DiagramBlockRepository(pool);
  const connectionRepo = new DiagramConnectionRepository(pool);
  
  // Сервисы
  const diagramService = new DiagramService(diagramRepo, blockRepo, connectionRepo);
  const blockService = new DiagramBlockService(blockRepo);
  const connectionService = new DiagramConnectionService(connectionRepo);
  
  // Контроллеры
  const diagramController = new DiagramController(diagramService);
  const blockController = new DiagramBlockController(blockService);
  const connectionController = new DiagramConnectionController(connectionService);

  // Роуты
  app.use('/api/v1/diagrams', createDiagramRouter(diagramController));
  app.use('/api/v1/diagram-blocks', createDiagramBlockRouter(blockController));
  app.use('/api/v1/diagram-connections', createDiagramConnectionRouter(connectionController));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};