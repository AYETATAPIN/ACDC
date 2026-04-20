import { apiRequest } from './http.js';

export const elementsService = {
  listByDiagramId: async (diagramId) => {
    const response = await apiRequest(`/diagram-blocks?diagramId=${encodeURIComponent(diagramId)}`);
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagram-blocks/${id}`),

  create: async (payload) => apiRequest('/diagram-blocks', { method: 'POST', body: payload }),

  update: async (id, payload) => apiRequest(`/diagram-blocks/${id}`, { method: 'PUT', body: payload }),

  remove: async (id) => apiRequest(`/diagram-blocks/${id}`, { method: 'DELETE' }),
};
