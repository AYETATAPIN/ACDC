const emptyMatrix = () => ({
  elements: [],
  connection_types: [],
  cells: [],
});

const safeArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeRulesMatrix = (matrix) => {
  if (!matrix || typeof matrix !== 'object') return emptyMatrix();
  return {
    elements: safeArray(matrix.elements),
    connection_types: safeArray(matrix.connection_types),
    cells: safeArray(matrix.cells),
  };
};

export const getCellKey = (fromElementTypeId, toElementTypeId) => `${fromElementTypeId}:${toElementTypeId}`;

export const buildCellLookup = (matrix) => {
  const normalized = normalizeRulesMatrix(matrix);
  const lookup = new Map();
  for (const cell of normalized.cells) {
    lookup.set(getCellKey(cell.from_element_type_id, cell.to_element_type_id), cell);
  }
  return lookup;
};

export const getRulesForCell = (matrix, fromElementTypeId, toElementTypeId) => {
  const lookup = buildCellLookup(matrix);
  const cell = lookup.get(getCellKey(fromElementTypeId, toElementTypeId));
  return safeArray(cell?.rules);
};

export const isConnectionAllowedByMatrix = ({
  matrix,
  fromElementTypeId,
  toElementTypeId,
  connectionTypeId,
  isFreeMode = false,
}) => {
  if (isFreeMode) return true;
  const rules = getRulesForCell(matrix, fromElementTypeId, toElementTypeId);
  const rule = rules.find((item) => item.connection_type_id === connectionTypeId);
  return Boolean(rule?.allowed);
};

export const matrixCellToPayload = ({ fromElementTypeId, toElementTypeId, rules }) => ({
  from_element_type_id: fromElementTypeId,
  to_element_type_id: toElementTypeId,
  rules: safeArray(rules).map((rule) => ({
    connection_type_id: rule.connection_type_id,
    allowed: Boolean(rule.allowed),
  })),
});

export const buildMatrixRows = (matrix) => {
  const normalized = normalizeRulesMatrix(matrix);
  const lookup = buildCellLookup(normalized);

  return normalized.elements.map((fromElement) => {
    const row = { fromElement };
    for (const toElement of normalized.elements) {
      const cell = lookup.get(getCellKey(fromElement.id, toElement.id));
      row[toElement.id] = safeArray(cell?.rules);
    }
    return row;
  });
};

