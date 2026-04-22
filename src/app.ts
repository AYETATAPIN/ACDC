import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initDb } from './db.js';
import { DiagramRepository } from './repositories/diagramRepository.js';
import { DiagramBlockRepository } from './repositories/diagramBlockRepository.js';
import { DiagramConnectionRepository } from './repositories/diagramConnectionRepository.js';
import { DiagramTypeRepository } from './repositories/diagramTypeRepository.js';
import { DiagramService } from './services/diagramService.js';
import { DiagramBlockService } from './services/diagramBlockService.js';
import { DiagramConnectionService } from './services/diagramConnectionService.js';
import { DiagramHistoryService } from './services/diagramHistoryService.js';
import { DiagramTypeService } from './services/diagramTypeService.js';
import { DiagramController } from './controllers/diagramController.js';
import { DiagramBlockController } from './controllers/diagramBlockController.js';
import { DiagramConnectionController } from './controllers/diagramConnectionController.js';
import { DiagramHistoryController } from './controllers/diagramHistoryController.js';
import { DiagramTypeController } from './controllers/diagramTypeController.js';
import { AuthController } from './controllers/authController.js';
import { createDiagramRouter } from './routes/diagrams.js';
import { createDiagramBlockRouter } from './routes/diagramBlocks.js';
import { createDiagramConnectionRouter } from './routes/diagramConnections.js';
import { createDiagramHistoryRouter } from './routes/diagramHistory.js';
import { createDiagramTypeRouter } from './routes/diagramTypes.js';
import { createAuthRouter } from './routes/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { attachAuthContext, requireAuth } from './middleware/auth.js';
import { UserRepository } from './repositories/userRepository.js';
import { SessionRepository } from './repositories/sessionRepository.js';
import { AuthService } from './services/authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildApp = async () => {
  await initDb();

  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, '../public')));

  const pool = getPool();

  const diagramRepo = new DiagramRepository(pool);
  const blockRepo = new DiagramBlockRepository(pool);
  const connectionRepo = new DiagramConnectionRepository(pool);
  const diagramTypeRepo = new DiagramTypeRepository(pool);
  const userRepo = new UserRepository(pool);
  const sessionRepo = new SessionRepository(pool);

  const historyService = new DiagramHistoryService(pool);
  const diagramTypeService = new DiagramTypeService(diagramTypeRepo);
  const authService = new AuthService(userRepo, sessionRepo);
  const diagramService = new DiagramService(diagramRepo, blockRepo, connectionRepo, historyService, diagramTypeRepo);
  const blockService = new DiagramBlockService(blockRepo, diagramRepo, historyService, diagramTypeService);
  const connectionService = new DiagramConnectionService(connectionRepo, blockRepo, diagramRepo, diagramTypeService, historyService);

  const authController = new AuthController(authService);
  const diagramController = new DiagramController(diagramService);
  const blockController = new DiagramBlockController(blockService);
  const connectionController = new DiagramConnectionController(connectionService);
  const historyController = new DiagramHistoryController(historyService);
  const diagramTypeController = new DiagramTypeController(diagramTypeService);

  app.use(attachAuthContext(authService));
  app.use('/api/v1/auth', createAuthRouter(authController));
  app.use('/api/v1', requireAuth);
  app.use('/api/v1/diagrams', createDiagramRouter(diagramController));
  app.use('/api/v1/diagrams', createDiagramHistoryRouter(historyController));
  app.use('/api/v1/diagram-blocks', createDiagramBlockRouter(blockController));
  app.use('/api/v1/diagram-connections', createDiagramConnectionRouter(connectionController));
  app.use('/api/v1/diagram-types', createDiagramTypeRouter(diagramTypeController));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
