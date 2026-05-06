import { apiRequest } from './http.js';
import { isSharedContext } from './sharesService.js';

const readOnlySharedError = () => {
  throw new Error('Сохраните диаграмму, чтобы применить изменения по ссылке доступа');
};

export const elementsService = {
  listByDiagramId: async (diagramId) => {
    if (isSharedContext()) return [];
    const response = await apiRequest(`/diagram-blocks?diagramId=${encodeURIComponent(diagramId)}`);
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagram-blocks/${id}`),

  create: async (payload) => {
    if (isSharedContext()) readOnlySharedError();
    return apiRequest('/diagram-blocks', { method: 'POST', body: payload });
  },

  update: async (id, payload) => {
    if (isSharedContext()) readOnlySharedError();
    return apiRequest(`/diagram-blocks/${id}`, { method: 'PUT', body: payload });
  },

  remove: async (id) => {
    if (isSharedContext()) readOnlySharedError();
    return apiRequest(`/diagram-blocks/${id}`, { method: 'DELETE' });
  },
};
