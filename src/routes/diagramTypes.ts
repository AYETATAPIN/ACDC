import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateUUIDParam } from '../middleware/validateUUID.js';
import { DiagramTypeController } from '../controllers/diagramTypeController.js';
import { DiagramTypeShareController } from '../controllers/diagramTypeShareController.js';

export const createDiagramTypeRouter = (controller: DiagramTypeController, shareController: DiagramTypeShareController) => {
  const router = Router();

  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));

  router.get('/:id/shares', validateUUIDParam('id'), asyncHandler(shareController.listOwnerShares));
  router.post('/:id/shares/:permission', validateUUIDParam('id'), asyncHandler(shareController.createOwnerShare));
  router.post('/:id/shares/:permission/rotate', validateUUIDParam('id'), asyncHandler(shareController.rotateOwnerShare));

  router.get('/:id', validateUUIDParam('id'), asyncHandler(controller.get));
  router.put('/:id', validateUUIDParam('id'), asyncHandler(controller.update));
  router.delete('/:id', validateUUIDParam('id'), asyncHandler(controller.remove));
  router.post('/:id/clone', validateUUIDParam('id'), asyncHandler(controller.clone));

  router.get('/:id/elements', validateUUIDParam('id'), asyncHandler(controller.listElements));
  router.post('/:id/elements', validateUUIDParam('id'), asyncHandler(controller.createElement));
  router.put('/:id/elements/:elementId', validateUUIDParam('id'), validateUUIDParam('elementId'), asyncHandler(controller.updateElement));
  router.delete('/:id/elements/:elementId', validateUUIDParam('id'), validateUUIDParam('elementId'), asyncHandler(controller.deleteElement));

  router.get('/:id/connection-types', validateUUIDParam('id'), asyncHandler(controller.listConnectionTypes));
  router.post('/:id/connection-types', validateUUIDParam('id'), asyncHandler(controller.createConnectionType));
  router.put(
    '/:id/connection-types/:connectionTypeId',
    validateUUIDParam('id'),
    validateUUIDParam('connectionTypeId'),
    asyncHandler(controller.updateConnectionType),
  );
  router.delete(
    '/:id/connection-types/:connectionTypeId',
    validateUUIDParam('id'),
    validateUUIDParam('connectionTypeId'),
    asyncHandler(controller.deleteConnectionType),
  );

  router.get('/:id/rules/matrix', validateUUIDParam('id'), asyncHandler(controller.getRulesMatrix));
  router.put('/:id/rules/cell', validateUUIDParam('id'), asyncHandler(controller.updateRuleCell));
  router.post('/:id/rules/bulk', validateUUIDParam('id'), asyncHandler(controller.bulkUpdateRules));

  return router;
};
