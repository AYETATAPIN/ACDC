import { Router } from 'express';
import { ShareController } from '../controllers/shareController.js';
import { validateUUIDParam } from '../middleware/validateUUID.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const createShareRouter = (controller: ShareController) => {
  const router = Router();

  router.get('/:token/state', asyncHandler(controller.state));

  router.put('/:token/diagram', asyncHandler(controller.updateDiagram));

  router.post('/:token/diagram-blocks', asyncHandler(controller.createBlock));
  router.put('/:token/diagram-blocks/:id', validateUUIDParam('id'), asyncHandler(controller.updateBlock));
  router.delete('/:token/diagram-blocks/:id', validateUUIDParam('id'), asyncHandler(controller.deleteBlock));

  router.post('/:token/diagram-connections', asyncHandler(controller.createConnection));
  router.put('/:token/diagram-connections/:id', validateUUIDParam('id'), asyncHandler(controller.updateConnection));
  router.post('/:token/diagram-connections/:id/bend-points', validateUUIDParam('id'), asyncHandler(controller.addBendPoint));
  router.delete('/:token/diagram-connections/:id', validateUUIDParam('id'), asyncHandler(controller.deleteConnection));

  router.post('/:token/undo', asyncHandler(controller.undo));
  router.post('/:token/redo', asyncHandler(controller.redo));

  router.put('/:token/diagram-type', asyncHandler(controller.updateCurrentDiagramType));
  router.post('/:token/diagram-type/elements', asyncHandler(controller.createElement));
  router.put('/:token/diagram-type/elements/:elementId', validateUUIDParam('elementId'), asyncHandler(controller.updateElement));
  router.delete('/:token/diagram-type/elements/:elementId', validateUUIDParam('elementId'), asyncHandler(controller.deleteElement));

  router.post('/:token/diagram-type/connection-types', asyncHandler(controller.createConnectionType));
  router.put(
    '/:token/diagram-type/connection-types/:connectionTypeId',
    validateUUIDParam('connectionTypeId'),
    asyncHandler(controller.updateConnectionType),
  );
  router.delete(
    '/:token/diagram-type/connection-types/:connectionTypeId',
    validateUUIDParam('connectionTypeId'),
    asyncHandler(controller.deleteConnectionType),
  );

  router.put('/:token/diagram-type/rules/cell', asyncHandler(controller.updateRuleCell));
  router.post('/:token/diagram-type/rules/bulk', asyncHandler(controller.bulkUpdateRules));

  return router;
};
