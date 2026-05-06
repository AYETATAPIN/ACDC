import {Router} from 'express';
import {DiagramController} from '../controllers/diagramController.js';
import {ShareController} from '../controllers/shareController.js';
import {validateUUIDParam} from '../middleware/validateUUID.js';
import {asyncHandler} from '../middleware/asyncHandler.js';

export const createDiagramRouter = (controller: DiagramController, shareController: ShareController) => {
    const router = Router();

    router.get('/', asyncHandler(controller.list));
    router.post('/import', asyncHandler(controller.importDiagram));
    router.get('/:id/shares', validateUUIDParam('id'), asyncHandler(shareController.listOwnerShares));
    router.post('/:id/shares/:permission', validateUUIDParam('id'), asyncHandler(shareController.createOwnerShare));
    router.post('/:id/shares/:permission/rotate', validateUUIDParam('id'), asyncHandler(shareController.rotateOwnerShare));
    router.get('/:id/type-version-status', validateUUIDParam('id'), asyncHandler(controller.getTypeVersionStatus));
    router.post('/:id/type-version-update', validateUUIDParam('id'), asyncHandler(controller.updateTypeVersion));
    router.get('/:id', validateUUIDParam('id'), asyncHandler(controller.get));
    router.post('/', asyncHandler(controller.create));
    router.put('/:id', validateUUIDParam('id'), asyncHandler(controller.update));
    router.delete('/:id', validateUUIDParam('id'), asyncHandler(controller.remove));

    return router;
};
