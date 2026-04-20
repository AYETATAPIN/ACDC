import { diagramTypesService } from './diagramTypesService.js';

export const rulesService = {
  getMatrix: async (diagramTypeId) => diagramTypesService.getRulesMatrix(diagramTypeId),

  updateCell: async (diagramTypeId, payload) => diagramTypesService.updateRuleCell(diagramTypeId, payload),

  bulkUpdate: async (diagramTypeId, payload) => diagramTypesService.bulkUpdateRules(diagramTypeId, payload),
};
