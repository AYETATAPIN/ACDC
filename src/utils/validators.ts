import {
  BendPointCreateInput,
  DiagramBlockCreateInput,
  DiagramBlockUpdateInput,
  DiagramConnectionCreateInput,
  DiagramConnectionUpdateInput,
  DiagramCreateInput,
  DiagramKind,
  DiagramUpdateInput,
} from '../types.js';

const TYPES: DiagramKind[] = ['class', 'use_case', 'activity_diagram', 'free_mode'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isDiagramType = (value: unknown): value is DiagramKind =>
  typeof value === 'string' && TYPES.includes(value as DiagramKind);

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

type FrontendElement = {
  id?: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  properties?: Record<string, any>;
};

type FrontendConnection = {
  id?: string;
  from: string;
  to: string;
  type: string;
  connection_type_id?: string | null;
  label?: string;
  points?: Array<{ x: number; y: number }>;
  properties?: Record<string, any>;
};

const validateElementsInput = (value: any): FrontendElement[] | null => {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return null;

  const result: FrontendElement[] = [];
  for (const el of value) {
    if (!isObject(el)) return null;
    if (typeof el.type !== 'string' || typeof el.x !== 'number' || typeof el.y !== 'number') return null;
    if (el.id !== undefined && typeof el.id !== 'string') return null;
    if (el.width !== undefined && typeof el.width !== 'number') return null;
    if (el.height !== undefined && typeof el.height !== 'number') return null;
    if (el.text !== undefined && typeof el.text !== 'string') return null;
    if (el.properties !== undefined && !isObject(el.properties)) return null;

    result.push({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      text: el.text,
      properties: el.properties,
    });
  }

  return result;
};

const validateConnectionsInput = (value: any): FrontendConnection[] | null => {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return null;

  const result: FrontendConnection[] = [];
  for (const conn of value) {
    if (!isObject(conn)) return null;
    if (typeof conn.from !== 'string' || typeof conn.to !== 'string' || typeof conn.type !== 'string') return null;
    if (conn.id !== undefined && typeof conn.id !== 'string') return null;
    if (conn.connection_type_id !== undefined && conn.connection_type_id !== null && !isUuid(conn.connection_type_id)) return null;
    if (conn.label !== undefined && typeof conn.label !== 'string') return null;
    if (conn.properties !== undefined && !isObject(conn.properties)) return null;

    if (conn.points !== undefined) {
      if (!Array.isArray(conn.points)) return null;
      for (const point of conn.points) {
        if (!isObject(point) || typeof point.x !== 'number' || typeof point.y !== 'number') return null;
      }
    }

    result.push({
      id: conn.id,
      from: conn.from,
      to: conn.to,
      type: conn.type,
      connection_type_id: conn.connection_type_id,
      label: conn.label,
      points: conn.points,
      properties: conn.properties,
    });
  }

  return result;
};

export const validateCreate = (
  body: any,
): { ok: true; data: DiagramCreateInput & { elements?: FrontendElement[]; connections?: FrontendConnection[] } } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const { name, type, diagram_type_id, svg_data } = body;
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'name is required' };
  if (type !== undefined && !isDiagramType(type)) {
    return { ok: false, error: 'type must be one of class|use_case|activity_diagram|free_mode' };
  }
  if (diagram_type_id !== undefined && !isUuid(diagram_type_id)) {
    return { ok: false, error: 'diagram_type_id must be a UUID' };
  }
  if (typeof svg_data !== 'string' || !svg_data.trim()) return { ok: false, error: 'svg_data is required' };

  const elements = validateElementsInput(body.elements);
  if (body.elements !== undefined && elements === null) return { ok: false, error: 'elements has invalid shape' };

  const connections = validateConnectionsInput(body.connections);
  if (body.connections !== undefined && connections === null) return { ok: false, error: 'connections has invalid shape' };

  return {
    ok: true,
    data: {
      name: name.trim(),
      type,
      diagram_type_id,
      svg_data,
      elements: elements ?? undefined,
      connections: connections ?? undefined,
    },
  };
};

export const validateUpdate = (
  body: any,
): { ok: true; data: DiagramUpdateInput & { elements?: FrontendElement[]; connections?: FrontendConnection[] } } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const out: DiagramUpdateInput & { elements?: FrontendElement[]; connections?: FrontendConnection[] } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return { ok: false, error: 'name must be a non-empty string' };
    out.name = body.name.trim();
  }

  if (body.type !== undefined) {
    if (!isDiagramType(body.type)) return { ok: false, error: 'type must be one of class|use_case|activity_diagram|free_mode' };
    out.type = body.type;
  }

  if (body.diagram_type_id !== undefined) {
    if (!isUuid(body.diagram_type_id)) return { ok: false, error: 'diagram_type_id must be a UUID' };
    out.diagram_type_id = body.diagram_type_id;
  }

  if (body.svg_data !== undefined) {
    if (typeof body.svg_data !== 'string' || !body.svg_data.trim()) {
      return { ok: false, error: 'svg_data must be a non-empty string' };
    }
    out.svg_data = body.svg_data;
  }

  const elements = validateElementsInput(body.elements);
  if (body.elements !== undefined && elements === null) return { ok: false, error: 'elements has invalid shape' };
  if (elements) out.elements = elements;

  const connections = validateConnectionsInput(body.connections);
  if (body.connections !== undefined && connections === null) return { ok: false, error: 'connections has invalid shape' };
  if (connections) out.connections = connections;

  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};

export const validateBlockCreate = (body: any): { ok: true; data: DiagramBlockCreateInput } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const { diagram_id, element_type_id, type, x, y, width, height, properties } = body;
  if (!isUuid(diagram_id)) return { ok: false, error: 'diagram_id must be a UUID' };
  if (element_type_id !== undefined && element_type_id !== null && !isUuid(element_type_id)) {
    return { ok: false, error: 'element_type_id must be a UUID' };
  }
  if (typeof type !== 'string' || !type.trim()) return { ok: false, error: 'type is required' };
  if (typeof x !== 'number') return { ok: false, error: 'x must be a number' };
  if (typeof y !== 'number') return { ok: false, error: 'y must be a number' };
  if (width !== undefined && typeof width !== 'number') return { ok: false, error: 'width must be a number' };
  if (height !== undefined && typeof height !== 'number') return { ok: false, error: 'height must be a number' };
  if (properties !== undefined && !isObject(properties)) return { ok: false, error: 'properties must be an object' };

  return {
    ok: true,
    data: {
      diagram_id,
      element_type_id: element_type_id ?? null,
      type: type.trim(),
      x,
      y,
      width,
      height,
      properties,
    },
  };
};

export const validateBlockUpdate = (body: any): { ok: true; data: DiagramBlockUpdateInput } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const out: DiagramBlockUpdateInput = {};
  if (body.element_type_id !== undefined) {
    if (body.element_type_id !== null && !isUuid(body.element_type_id)) return { ok: false, error: 'element_type_id must be a UUID' };
    out.element_type_id = body.element_type_id;
  }
  if (body.x !== undefined) {
    if (typeof body.x !== 'number') return { ok: false, error: 'x must be a number' };
    out.x = body.x;
  }
  if (body.y !== undefined) {
    if (typeof body.y !== 'number') return { ok: false, error: 'y must be a number' };
    out.y = body.y;
  }
  if (body.width !== undefined) {
    if (typeof body.width !== 'number' || body.width <= 0) return { ok: false, error: 'width must be a positive number' };
    out.width = body.width;
  }
  if (body.height !== undefined) {
    if (typeof body.height !== 'number' || body.height <= 0) return { ok: false, error: 'height must be a positive number' };
    out.height = body.height;
  }
  if (body.properties !== undefined) {
    if (!isObject(body.properties)) return { ok: false, error: 'properties must be an object' };
    out.properties = body.properties;
  }

  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};

export const validateConnectionCreate = (
  body: any,
): { ok: true; data: DiagramConnectionCreateInput } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const { diagram_id, from_block_id, to_block_id, connection_type_id, type, points, label, properties } = body;
  if (!isUuid(diagram_id)) return { ok: false, error: 'diagram_id must be a UUID' };
  if (!isUuid(from_block_id)) return { ok: false, error: 'from_block_id must be a UUID' };
  if (!isUuid(to_block_id)) return { ok: false, error: 'to_block_id must be a UUID' };
  if (connection_type_id !== undefined && connection_type_id !== null && !isUuid(connection_type_id)) {
    return { ok: false, error: 'connection_type_id must be a UUID' };
  }
  if (typeof type !== 'string' || !type.trim()) return { ok: false, error: 'type is required' };

  if (points !== undefined) {
    if (!Array.isArray(points)) return { ok: false, error: 'points must be an array' };
    for (const point of points) {
      if (!isObject(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return { ok: false, error: 'each point must be an object with x and y as numbers' };
      }
    }
  }

  if (label !== undefined && typeof label !== 'string') return { ok: false, error: 'label must be a string' };
  if (properties !== undefined && !isObject(properties)) return { ok: false, error: 'properties must be an object' };

  return {
    ok: true,
    data: {
      diagram_id,
      from_block_id,
      to_block_id,
      connection_type_id: connection_type_id ?? null,
      type: type.trim(),
      points,
      label,
      properties,
    },
  };
};

export const validateConnectionUpdate = (
  body: any,
): { ok: true; data: DiagramConnectionUpdateInput } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };

  const out: DiagramConnectionUpdateInput = {};

  if (body.connection_type_id !== undefined) {
    if (body.connection_type_id !== null && !isUuid(body.connection_type_id)) {
      return { ok: false, error: 'connection_type_id must be a UUID' };
    }
    out.connection_type_id = body.connection_type_id;
  }

  if (body.type !== undefined) {
    if (typeof body.type !== 'string' || !body.type.trim()) return { ok: false, error: 'type must be a non-empty string' };
    out.type = body.type.trim();
  }

  if (body.label !== undefined) {
    if (typeof body.label !== 'string') return { ok: false, error: 'label must be a string' };
    out.label = body.label;
  }

  if (body.points !== undefined) {
    if (!Array.isArray(body.points)) return { ok: false, error: 'points must be an array' };
    for (const point of body.points) {
      if (!isObject(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return { ok: false, error: 'each point must be an object with x and y as numbers' };
      }
    }
    out.points = body.points;
  }

  if (body.properties !== undefined) {
    if (!isObject(body.properties)) return { ok: false, error: 'properties must be an object' };
    out.properties = body.properties;
  }

  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};

export const validateBendPointCreate = (body: any): { ok: true; data: BendPointCreateInput } | { ok: false; error: string } => {
  if (!isObject(body)) return { ok: false, error: 'Body must be an object' };
  if (body.position !== 'middle') return { ok: false, error: 'Only middle position is supported for bend points' };
  return { ok: true, data: { position: 'middle' } };
};
