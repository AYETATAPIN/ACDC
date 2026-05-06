import { apiRequest } from './http.js';
import { isSharedContext } from './sharesService.js';

const saveViaShareError = () => {
  throw new Error('Сохраните диаграмму, чтобы применить изменения по ссылке доступа');
};

export const connectionsService = {
  listByDiagramId: async (diagramId) => {
    if (isSharedContext()) return [];
    const response = await apiRequest(`/diagram-connections?diagramId=${encodeURIComponent(diagramId)}`);
    return response.items || [];
  },

  getById: async (id) => apiRequest(`/diagram-connections/${id}`),

  create: async (payload) => {
    if (isSharedContext()) saveViaShareError();
    return apiRequest('/diagram-connections', { method: 'POST', body: payload });
  },

  update: async (id, payload) => {
    if (isSharedContext()) saveViaShareError();
    return apiRequest(`/diagram-connections/${id}`, { method: 'PUT', body: payload });
  },

  remove: async (id) => {
    if (isSharedContext()) saveViaShareError();
    return apiRequest(`/diagram-connections/${id}`, { method: 'DELETE' });
  },

  addBendPoint: async (id) => {
    if (isSharedContext()) saveViaShareError();
    return apiRequest(`/diagram-connections/${id}/bend-points`, { method: 'POST', body: { position: 'middle' } });
  },
};
