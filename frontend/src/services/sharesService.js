import { apiRequest } from './http.js';

const emptyShareContext = () => ({
  token: null,
  access: null,
  diagramTypeBundle: null,
  history: null,
});

let shareContext = emptyShareContext();

const cloneBundle = (bundle) => {
  if (!bundle || typeof bundle !== 'object') return null;
  return {
    diagram_type: bundle.diagram_type || null,
    element_types: Array.isArray(bundle.element_types) ? bundle.element_types : [],
    connection_types: Array.isArray(bundle.connection_types) ? bundle.connection_types : [],
    rules_matrix: bundle.rules_matrix || { elements: [], connection_types: [], cells: [] },
  };
};

const updateBundle = (updater) => {
  if (!shareContext.diagramTypeBundle) return;
  const next = cloneBundle(shareContext.diagramTypeBundle);
  updater(next);
  shareContext = { ...shareContext, diagramTypeBundle: next };
};

export const setShareContext = ({ token, access = null, diagramTypeBundle = null, history = null } = {}) => {
  shareContext = {
    token: token || null,
    access: access || null,
    diagramTypeBundle: cloneBundle(diagramTypeBundle),
    history,
  };
};

export const clearShareContext = () => {
  shareContext = emptyShareContext();
};

export const getShareContext = () => shareContext;

export const isSharedContext = () => Boolean(shareContext.token && shareContext.access?.mode === 'shared');

const sharePath = (suffix) => `/shares/${encodeURIComponent(shareContext.token)}${suffix}`;

export const sharesService = {
  listOwnerShares: async (diagramId) => apiRequest(`/diagrams/${encodeURIComponent(diagramId)}/shares`),

  createOwnerShare: async (diagramId, permission) =>
    apiRequest(`/diagrams/${encodeURIComponent(diagramId)}/shares/${encodeURIComponent(permission)}`, { method: 'POST' }),

  rotateOwnerShare: async (diagramId, permission) =>
    apiRequest(`/diagrams/${encodeURIComponent(diagramId)}/shares/${encodeURIComponent(permission)}/rotate`, { method: 'POST' }),

  getState: async (token) => apiRequest(`/shares/${encodeURIComponent(token)}/state`),

  updateDiagram: async (payload) => apiRequest(sharePath('/diagram'), { method: 'PUT', body: payload }),

  undo: async () => apiRequest(sharePath('/undo'), { method: 'POST' }),

  redo: async () => apiRequest(sharePath('/redo'), { method: 'POST' }),

  updateCurrentDiagramType: async (payload) => {
    const updated = await apiRequest(sharePath('/diagram-type'), { method: 'PUT', body: payload });
    updateBundle((bundle) => {
      bundle.diagram_type = updated;
    });
    return updated;
  },

  createElement: async (payload) => {
    const created = await apiRequest(sharePath('/diagram-type/elements'), { method: 'POST', body: payload });
    updateBundle((bundle) => {
      bundle.element_types = [...bundle.element_types.filter((item) => item.id !== created.id), created];
    });
    return created;
  },

  updateElement: async (elementTypeId, payload) => {
    const updated = await apiRequest(sharePath(`/diagram-type/elements/${encodeURIComponent(elementTypeId)}`), {
      method: 'PUT',
      body: payload,
    });
    updateBundle((bundle) => {
      bundle.element_types = bundle.element_types.map((item) => (item.id === elementTypeId ? updated : item));
    });
    return updated;
  },

  deleteElement: async (elementTypeId) => {
    const result = await apiRequest(sharePath(`/diagram-type/elements/${encodeURIComponent(elementTypeId)}`), { method: 'DELETE' });
    updateBundle((bundle) => {
      bundle.element_types = bundle.element_types.filter((item) => item.id !== elementTypeId);
    });
    return result;
  },

  createConnectionType: async (payload) => {
    const created = await apiRequest(sharePath('/diagram-type/connection-types'), { method: 'POST', body: payload });
    updateBundle((bundle) => {
      bundle.connection_types = [...bundle.connection_types.filter((item) => item.id !== created.id), created];
    });
    return created;
  },

  updateConnectionType: async (connectionTypeId, payload) => {
    const updated = await apiRequest(sharePath(`/diagram-type/connection-types/${encodeURIComponent(connectionTypeId)}`), {
      method: 'PUT',
      body: payload,
    });
    updateBundle((bundle) => {
      bundle.connection_types = bundle.connection_types.map((item) => (item.id === connectionTypeId ? updated : item));
    });
    return updated;
  },

  deleteConnectionType: async (connectionTypeId) => {
    const result = await apiRequest(sharePath(`/diagram-type/connection-types/${encodeURIComponent(connectionTypeId)}`), {
      method: 'DELETE',
    });
    updateBundle((bundle) => {
      bundle.connection_types = bundle.connection_types.filter((item) => item.id !== connectionTypeId);
    });
    return result;
  },

  updateRuleCell: async (payload) => {
    const result = await apiRequest(sharePath('/diagram-type/rules/cell'), { method: 'PUT', body: payload });
    updateBundle((bundle) => {
      const matrix = bundle.rules_matrix || { elements: [], connection_types: [], cells: [] };
      const cells = Array.isArray(matrix.cells) ? matrix.cells : [];
      const key = `${payload.from_element_type_id}:${payload.to_element_type_id}`;
      const nextCell = {
        from_element_type_id: payload.from_element_type_id,
        to_element_type_id: payload.to_element_type_id,
        rules: Array.isArray(payload.rules) ? payload.rules : [],
      };
      bundle.rules_matrix = {
        ...matrix,
        cells: [...cells.filter((cell) => `${cell.from_element_type_id}:${cell.to_element_type_id}` !== key), nextCell],
      };
    });
    return result;
  },

  bulkUpdateRules: async (payload) => {
    const result = await apiRequest(sharePath('/diagram-type/rules/bulk'), { method: 'POST', body: payload });
    updateBundle((bundle) => {
      const matrix = bundle.rules_matrix || { elements: [], connection_types: [], cells: [] };
      const elements = Array.isArray(matrix.elements) ? matrix.elements : [];
      const connectionTypes = Array.isArray(matrix.connection_types) ? matrix.connection_types : [];
      const targetIds = Array.isArray(payload.connection_type_ids) && payload.connection_type_ids.length
        ? payload.connection_type_ids
        : connectionTypes.map((item) => item.id);
      const cellsByKey = new Map((Array.isArray(matrix.cells) ? matrix.cells : []).map((cell) => [
        `${cell.from_element_type_id}:${cell.to_element_type_id}`,
        { ...cell, rules: Array.isArray(cell.rules) ? [...cell.rules] : [] },
      ]));

      for (const from of elements) {
        for (const to of elements) {
          const applies =
            (payload.mode === 'row' && from.id === payload.target_id) ||
            (payload.mode === 'column' && to.id === payload.target_id) ||
            payload.mode === 'connection_type';
          if (!applies) continue;
          const key = `${from.id}:${to.id}`;
          const cell = cellsByKey.get(key) || { from_element_type_id: from.id, to_element_type_id: to.id, rules: [] };
          const rulesByType = new Map(cell.rules.map((rule) => [rule.connection_type_id, rule]));
          for (const connectionTypeId of targetIds) {
            if (payload.mode === 'connection_type' && connectionTypeId !== payload.target_id) continue;
            rulesByType.set(connectionTypeId, { connection_type_id: connectionTypeId, allowed: Boolean(payload.allowed) });
          }
          cell.rules = [...rulesByType.values()];
          cellsByKey.set(key, cell);
        }
      }

      bundle.rules_matrix = { ...matrix, cells: [...cellsByKey.values()] };
    });
    return result;
  },
};

export const ruleSharesService = {
  listOwnerShares: async (diagramTypeId) => apiRequest(`/diagram-types/${encodeURIComponent(diagramTypeId)}/shares`),

  createOwnerShare: async (diagramTypeId) =>
    apiRequest(`/diagram-types/${encodeURIComponent(diagramTypeId)}/shares/read`, { method: 'POST' }),

  rotateOwnerShare: async (diagramTypeId) =>
    apiRequest(`/diagram-types/${encodeURIComponent(diagramTypeId)}/shares/read/rotate`, { method: 'POST' }),

  getState: async (token) => apiRequest(`/rule-shares/${encodeURIComponent(token)}/state`),

  accept: async (token) => apiRequest(`/rule-shares/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
};
