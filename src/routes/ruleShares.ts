import { Router } from 'express';
import { DiagramTypeShareController } from '../controllers/diagramTypeShareController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const createRuleShareRouter = (controller: DiagramTypeShareController) => {
  const router = Router();

  router.get('/:token/state', asyncHandler(controller.state));
  router.post('/:token/accept', asyncHandler(controller.accept));

  return router;
};
