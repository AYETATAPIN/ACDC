import { apiRequest } from './http.js';

export const connectionsService = {
  listByDiagramId: async (diagramId) => {
    const response = await apiRequest(`/diagram-connections?diagramId=${encodeURIComponent(diagramId)}`);
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagram-connections/${id}`),

  create: async (payload) => apiRequest('/diagram-connections', { method: 'POST', body: payload }),

  update: async (id, payload) => apiRequest(`/diagram-connections/${id}`, { method: 'PUT', body: payload }),

  remove: async (id) => apiRequest(`/diagram-connections/${id}`, { method: 'DELETE' }),

  addBendPoint: async (id) => apiRequest(`/diagram-connections/${id}/bend-points`, { method: 'POST', body: { position: 'middle' } }),
};
