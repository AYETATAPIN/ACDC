import { Router } from 'express';
import { DiagramController } from '../controllers/diagramController.js';
import { validateUUIDParam } from '../middleware/validateUUID.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const createDiagramRouter = (controller: DiagramController) => {
  const router = Router();

  router.get('/', asyncHandler(controller.list));
  router.get('/:id', validateUUIDParam('id'), asyncHandler(controller.get));
  router.post('/', asyncHandler(controller.create));
  router.put('/:id', validateUUIDParam('id'), asyncHandler(controller.update));
  router.delete('/:id', validateUUIDParam('id'), asyncHandler(controller.remove));
  router.post('/:id/undo', validateUUIDParam('id'), asyncHandler(controller.undo));
  router.post('/:id/redo', validateUUIDParam('id'), asyncHandler(controller.redo));

  return router;
};
