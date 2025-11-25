// src/routes/diagramBlocks.ts
import {Router} from 'express';
import {DiagramBlockController} from '../controllers/diagramBlockController.js';
import {validateUUIDParam} from '../middleware/validateUUID.js';
import {asyncHandler} from '../middleware/asyncHandler.js';

export const createDiagramBlockRouter = (controller: DiagramBlockController) => {
    const router = Router();

    router.get('/diagram/:diagramId', validateUUIDParam('diagramId'), asyncHandler(controller.getByDiagramId));
    router.get('/:id', validateUUIDParam('id'), asyncHandler(controller.get));
    router.post('/', asyncHandler(controller.create));
    router.put('/:id', validateUUIDParam('id'), asyncHandler(controller.update));
    router.delete('/:id', validateUUIDParam('id'), asyncHandler(controller.remove));

    return router;
};