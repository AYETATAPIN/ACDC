import { apiRequest } from './http.js';
import { getShareContext, isSharedContext, sharesService } from './sharesService.js';

const sharedBundle = () => getShareContext().diagramTypeBundle || null;
const assertOwnerOnly = () => {
  if (isSharedContext()) throw new Error('Действие недоступно по ссылке доступа');
};

export const diagramTypesService = {
  list: async () => {
    if (isSharedContext()) {
      const type = sharedBundle()?.diagram_type;
      return type ? [type] : [];
    }
    const response = await apiRequest('/diagram-types');
    return response.items || [];
  },

  getById: async (id) => {
    if (isSharedContext()) {
      const type = sharedBundle()?.diagram_type;
      if (type && (!id || type.id === id)) return type;
      throw new Error('Тип диаграммы недоступен по этой ссылке');
    }
    return apiRequest(`/diagram-types/${id}`);
  },

  create: async (payload) => {
    assertOwnerOnly();
    return apiRequest('/diagram-types', { method: 'POST', body: payload });
  },

  update: async (id, payload) => {
    if (isSharedContext()) return sharesService.updateCurrentDiagramType(payload);
    return apiRequest(`/diagram-types/${id}`, { method: 'PUT', body: payload });
  },

  remove: async (id) => {
    assertOwnerOnly();
    return apiRequest(`/diagram-types/${id}`, { method: 'DELETE' });
  },

  clone: async (id, name) => {
    assertOwnerOnly();
    return apiRequest(`/diagram-types/${id}/clone`, { method: 'POST', body: { name } });
  },

  listElements: async (diagramTypeId) => {
    if (isSharedContext()) return sharedBundle()?.element_types || [];
    const response = await apiRequest(`/diagram-types/${diagramTypeId}/elements`);
    return response.items || [];
  },

  createElement: async (diagramTypeId, payload) =>
    isSharedContext()
      ? sharesService.createElement(payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/elements`, { method: 'POST', body: payload }),

  updateElement: async (diagramTypeId, elementTypeId, payload) =>
    isSharedContext()
      ? sharesService.updateElement(elementTypeId, payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/elements/${elementTypeId}`, { method: 'PUT', body: payload }),

  deleteElement: async (diagramTypeId, elementTypeId) =>
    isSharedContext()
      ? sharesService.deleteElement(elementTypeId)
      : apiRequest(`/diagram-types/${diagramTypeId}/elements/${elementTypeId}`, { method: 'DELETE' }),

  listConnectionTypes: async (diagramTypeId) => {
    if (isSharedContext()) return sharedBundle()?.connection_types || [];
    const response = await apiRequest(`/diagram-types/${diagramTypeId}/connection-types`);
    return response.items || [];
  },

  createConnectionType: async (diagramTypeId, payload) =>
    isSharedContext()
      ? sharesService.createConnectionType(payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/connection-types`, { method: 'POST', body: payload }),

  updateConnectionType: async (diagramTypeId, connectionTypeId, payload) =>
    isSharedContext()
      ? sharesService.updateConnectionType(connectionTypeId, payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/connection-types/${connectionTypeId}`, {
          method: 'PUT',
          body: payload,
        }),

  deleteConnectionType: async (diagramTypeId, connectionTypeId) =>
    isSharedContext()
      ? sharesService.deleteConnectionType(connectionTypeId)
      : apiRequest(`/diagram-types/${diagramTypeId}/connection-types/${connectionTypeId}`, { method: 'DELETE' }),

  getRulesMatrix: async (diagramTypeId) => {
    if (isSharedContext()) return sharedBundle()?.rules_matrix || { elements: [], connection_types: [], cells: [] };
    return apiRequest(`/diagram-types/${diagramTypeId}/rules/matrix`);
  },

  updateRuleCell: async (diagramTypeId, payload) =>
    isSharedContext()
      ? sharesService.updateRuleCell(payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/rules/cell`, { method: 'PUT', body: payload }),

  bulkUpdateRules: async (diagramTypeId, payload) =>
    isSharedContext()
      ? sharesService.bulkUpdateRules(payload)
      : apiRequest(`/diagram-types/${diagramTypeId}/rules/bulk`, { method: 'POST', body: payload }),
};
