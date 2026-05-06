import { apiRequest } from './http.js';
import { getShareContext, isSharedContext, sharesService } from './sharesService.js';

export const diagramsService = {
  list: async () => {
    if (isSharedContext()) return [];
    const response = await apiRequest('/diagrams');
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagrams/${id}`),

  create: async (payload) => apiRequest('/diagrams', { method: 'POST', body: payload }),

  importDiagram: async (payload) => apiRequest('/diagrams/import', { method: 'POST', body: payload }),

  update: async (id, payload) => {
    if (isSharedContext()) return sharesService.updateDiagram(payload);
    return apiRequest(`/diagrams/${id}`, { method: 'PUT', body: payload });
  },

  remove: async (id) => apiRequest(`/diagrams/${id}`, { method: 'DELETE' }),

  getTypeVersionStatus: async (diagramId) => {
    if (isSharedContext()) return { has_update: false };
    return apiRequest(`/diagrams/${diagramId}/type-version-status`);
  },

  updateTypeVersion: async (diagramId) => {
    if (isSharedContext()) throw new Error('Обновление версии правил недоступно по ссылке доступа');
    return apiRequest(`/diagrams/${diagramId}/type-version-update`, { method: 'POST' });
  },

  listHistory: async (diagramId) => {
    if (isSharedContext()) {
      const history = getShareContext().history || {};
      return { entries: history.entries || [], current_version: history.current_version || 0 };
    }
    return apiRequest(`/diagrams/${diagramId}/history`);
  },

  getStateAtVersion: async (diagramId, version) => {
    if (isSharedContext()) {
      const state = await sharesService.getState(getShareContext().token);
      return {
        state: {
          diagram: state.diagram,
          blocks: state.blocks || [],
          connections: state.connections || [],
        },
        version: state.history?.current_version || 0,
      };
    }
    return apiRequest(
      typeof version === 'undefined' || version === null
        ? `/diagrams/${diagramId}/state`
        : `/diagrams/${diagramId}/state?version=${encodeURIComponent(version)}`,
    );
  },

  undo: async (diagramId) => {
    if (isSharedContext()) return sharesService.undo();
    return apiRequest(`/diagrams/${diagramId}/undo`, { method: 'POST' });
  },

  redo: async (diagramId) => {
    if (isSharedContext()) return sharesService.redo();
    return apiRequest(`/diagrams/${diagramId}/redo`, { method: 'POST' });
  },
};
