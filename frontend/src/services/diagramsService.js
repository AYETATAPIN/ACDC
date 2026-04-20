import { apiRequest } from './http.js';

export const diagramsService = {
  list: async () => {
    const response = await apiRequest('/diagrams');
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagrams/${id}`),

  create: async (payload) => apiRequest('/diagrams', { method: 'POST', body: payload }),

  update: async (id, payload) => apiRequest(`/diagrams/${id}`, { method: 'PUT', body: payload }),

  remove: async (id) => apiRequest(`/diagrams/${id}`, { method: 'DELETE' }),

  listHistory: async (diagramId) => {
    return apiRequest(`/diagrams/${diagramId}/history`);
  },

  getStateAtVersion: async (diagramId, version) =>
    apiRequest(
      typeof version === 'undefined' || version === null
        ? `/diagrams/${diagramId}/state`
        : `/diagrams/${diagramId}/state?version=${encodeURIComponent(version)}`,
    ),

  undo: async (diagramId) => apiRequest(`/diagrams/${diagramId}/undo`, { method: 'POST' }),

  redo: async (diagramId) => apiRequest(`/diagrams/${diagramId}/redo`, { method: 'POST' }),
};
