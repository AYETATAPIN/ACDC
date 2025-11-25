// src/app.ts
import express from 'express';
import cors from 'cors'; 
import {getPool, initDb} from './db.js';
import {DiagramRepository} from './repositories/diagramRepository.js';
import {DiagramBlockRepository} from './repositories/diagramBlockRepository.js';
import {DiagramConnectionRepository} from './repositories/diagramConnectionRepository.js';
import {DiagramService} from './services/diagramService.js';
import {DiagramBlockService} from './services/diagramBlockService.js';
import {DiagramConnectionService} from './services/diagramConnectionService.js';
import {DiagramHistoryService} from './services/diagramHistoryService.js';
import {DiagramController} from './controllers/diagramController.js';
import {DiagramBlockController} from './controllers/diagramBlockController.js';
import {DiagramConnectionController} from './controllers/diagramConnectionController.js';
import {DiagramHistoryController} from './controllers/diagramHistoryController.js';
import {createDiagramRouter} from './routes/diagrams.js';
import {createDiagramBlockRouter} from './routes/diagramBlocks.js';
import {createDiagramConnectionRouter} from './routes/diagramConnections.js';
import {createDiagramHistoryRouter} from './routes/diagramHistory.js';
import {errorHandler, notFound} from './middleware/errorHandler.js';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildApp = async () => {
    await initDb();

    const app = express();

    app.use(cors({
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true
    }));

    app.use(express.json({limit: '2mb'}));


    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '../public')));

    const pool = getPool();

    // Репозитории
    const diagramRepo = new DiagramRepository(pool);
    const blockRepo = new DiagramBlockRepository(pool);
    const connectionRepo = new DiagramConnectionRepository(pool);
    const historyService = new DiagramHistoryService(pool);

    // Сервисы
    const diagramService = new DiagramService(diagramRepo, blockRepo, connectionRepo, historyService);
    const blockService = new DiagramBlockService(blockRepo, historyService);
    const connectionService = new DiagramConnectionService(connectionRepo);

    // Контроллеры
    const diagramController = new DiagramController(diagramService);
    const blockController = new DiagramBlockController(blockService);
    const connectionController = new DiagramConnectionController(connectionService);
    const historyController = new DiagramHistoryController(historyService);

    // Роуты
    app.use('/api/v1/diagrams', createDiagramRouter(diagramController));
    app.use('/api/v1/diagrams', createDiagramHistoryRouter(historyController));
    app.use('/api/v1/diagram-blocks', createDiagramBlockRouter(blockController));
    app.use('/api/v1/diagram-connections', createDiagramConnectionRouter(connectionController));

    // Serve index.html for all other routes (SPA)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    app.use(notFound);
    app.use(errorHandler);

    return app;
};
