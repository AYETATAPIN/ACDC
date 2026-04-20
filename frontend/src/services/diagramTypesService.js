import { apiRequest } from './http.js';

export const diagramTypesService = {
  list: async () => {
    const response = await apiRequest('/diagram-types');
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagram-types/${id}`),

  create: async (payload) => apiRequest('/diagram-types', { method: 'POST', body: payload }),

  update: async (id, payload) => apiRequest(`/diagram-types/${id}`, { method: 'PUT', body: payload }),

  remove: async (id) => apiRequest(`/diagram-types/${id}`, { method: 'DELETE' }),

  clone: async (id, name) => apiRequest(`/diagram-types/${id}/clone`, { method: 'POST', body: { name } }),

  listElements: async (diagramTypeId) => {
    const response = await apiRequest(`/diagram-types/${diagramTypeId}/elements`);
    return response.items || [];
  },

  createElement: async (diagramTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/elements`, { method: 'POST', body: payload }),

  updateElement: async (diagramTypeId, elementTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/elements/${elementTypeId}`, { method: 'PUT', body: payload }),

  deleteElement: async (diagramTypeId, elementTypeId) =>
    apiRequest(`/diagram-types/${diagramTypeId}/elements/${elementTypeId}`, { method: 'DELETE' }),

  listConnectionTypes: async (diagramTypeId) => {
    const response = await apiRequest(`/diagram-types/${diagramTypeId}/connection-types`);
    return response.items || [];
  },

  createConnectionType: async (diagramTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/connection-types`, { method: 'POST', body: payload }),

  updateConnectionType: async (diagramTypeId, connectionTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/connection-types/${connectionTypeId}`, {
      method: 'PUT',
      body: payload,
    }),

  deleteConnectionType: async (diagramTypeId, connectionTypeId) =>
    apiRequest(`/diagram-types/${diagramTypeId}/connection-types/${connectionTypeId}`, { method: 'DELETE' }),

  getRulesMatrix: async (diagramTypeId) => apiRequest(`/diagram-types/${diagramTypeId}/rules/matrix`),

  updateRuleCell: async (diagramTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/rules/cell`, { method: 'PUT', body: payload }),

  bulkUpdateRules: async (diagramTypeId, payload) =>
    apiRequest(`/diagram-types/${diagramTypeId}/rules/bulk`, { method: 'POST', body: payload }),
};
