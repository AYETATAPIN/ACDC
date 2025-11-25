import {Router} from 'express';
import {DiagramHistoryController} from '../controllers/diagramHistoryController.js';
import {validateUUIDParam} from '../middleware/validateUUID.js';
import {asyncHandler} from '../middleware/asyncHandler.js';

export const createDiagramHistoryRouter = (controller: DiagramHistoryController) => {
    const router = Router();

    router.get('/:diagramId/history', validateUUIDParam('diagramId'), asyncHandler(controller.history));
    router.post('/:diagramId/undo', validateUUIDParam('diagramId'), asyncHandler(controller.undo));
    router.post('/:diagramId/redo', validateUUIDParam('diagramId'), asyncHandler(controller.redo));

    return router;
};
