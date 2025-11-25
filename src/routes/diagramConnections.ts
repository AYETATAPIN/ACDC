import {Router} from 'express';
import {DiagramConnectionController} from '../controllers/diagramConnectionController.js';
import {validateUUIDParam} from '../middleware/validateUUID.js';
import {asyncHandler} from '../middleware/asyncHandler.js';

export const createDiagramConnectionRouter = (controller: DiagramConnectionController) => {
    const router = Router();

  router.get('/diagram/:diagramId', validateUUIDParam('diagramId'), asyncHandler(controller.getByDiagramId));
  router.post('/', asyncHandler(controller.create));
  router.put('/:id', validateUUIDParam('id'), asyncHandler(controller.update));
  router.post('/:id/bend-points', validateUUIDParam('id'), asyncHandler(controller.addBendPoint)); // ДОБАВЛЯЕМ
  router.delete('/:id', validateUUIDParam('id'), asyncHandler(controller.remove));

    return router;
};