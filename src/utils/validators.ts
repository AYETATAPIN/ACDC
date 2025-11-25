import { 
  DiagramCreateInput, 
  DiagramType, 
  DiagramUpdateInput,
  DiagramBlockCreateInput,
  DiagramBlockUpdateInput,        
  DiagramConnectionCreateInput,     
  DiagramConnectionUpdateInput,  
  BendPointCreateInput
} from '../types.js';

const TYPES: DiagramType[] = ['class', 'use_case', 'free_mode'];

const isDiagramType = (value: unknown): value is DiagramType =>
    typeof value === 'string' && (TYPES as ReadonlyArray<DiagramType>).includes(value as DiagramType);

export const validateCreate = (body: any): { ok: true; data: DiagramCreateInput } | { ok: false; error: string } => {
    if (!body || typeof body !== 'object') return {ok: false, error: 'Body must be an object'};
    const {name, type, svg_data} = body;
    if (typeof name !== 'string' || !name.trim()) return {ok: false, error: 'name is required'};
    if (!isDiagramType(type)) return {ok: false, error: 'type must be one of class|use_case|free_mode'};
    if (typeof svg_data !== 'string' || !svg_data.trim()) return {ok: false, error: 'svg_data is required'};
    return {ok: true, data: {name: name.trim(), type, svg_data}};
};

export const validateUpdate = (body: any): { ok: true; data: DiagramUpdateInput } | { ok: false; error: string } => {
    if (!body || typeof body !== 'object') return {ok: false, error: 'Body must be an object'};
    const {name, type, svg_data} = body;
    const out: DiagramUpdateInput = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return {ok: false, error: 'name must be a non-empty string'};
        out.name = name.trim();
    }
    if (type !== undefined) {
        if (!isDiagramType(type)) return {ok: false, error: 'type must be one of class|use_case|free_mode'};
        out.type = type;
    }
    if (svg_data !== undefined) {
        if (typeof svg_data !== 'string' || !svg_data.trim()) return {
            ok: false,
            error: 'svg_data must be a non-empty string'
        };
        out.svg_data = svg_data;
    }
    if (Object.keys(out).length === 0) return {ok: false, error: 'At least one field must be provided'};
    return {ok: true, data: out};
};

export const validateBlockCreate = (body: any): { ok: true; data: DiagramBlockCreateInput } | {
    ok: false;
    error: string
} => {
    if (!body || typeof body !== 'object') return {ok: false, error: 'Body must be an object'};
    const {diagram_id, type, x, y, width, height, properties} = body;

    if (typeof diagram_id !== 'string' || !diagram_id.trim()) return {ok: false, error: 'diagram_id is required'};
    if (typeof type !== 'string' || !type.trim()) return {ok: false, error: 'type is required'};
    if (typeof x !== 'number') return {ok: false, error: 'x must be a number'};
    if (typeof y !== 'number') return {ok: false, error: 'y must be a number'};

    const data: DiagramBlockCreateInput = {
        diagram_id: diagram_id.trim(),
        type: type.trim(),
        x,
        y,
    };

    if (width !== undefined) {
        if (typeof width !== 'number') return {ok: false, error: 'width must be a number'};
        data.width = width;
    }

    if (height !== undefined) {
        if (typeof height !== 'number') return {ok: false, error: 'height must be a number'};
        data.height = height;
    }

    if (properties !== undefined) {
        if (typeof properties !== 'object' || properties === null) return {
            ok: false,
            error: 'properties must be an object'
        };
        data.properties = properties;
    }

    return {ok: true, data};
};

// В src/utils/validators.ts обновим validateBlockUpdate
export const validateBlockUpdate = (body: any): { ok: true; data: DiagramBlockUpdateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { x, y, width, height, properties } = body;
  const out: DiagramBlockUpdateInput = {};
  
  if (x !== undefined) {
    if (typeof x !== 'number') return { ok: false, error: 'x must be a number' };
    out.x = x;
  }
  
  if (y !== undefined) {
    if (typeof y !== 'number') return { ok: false, error: 'y must be a number' };
    out.y = y;
  }
  
  if (width !== undefined) {
    if (typeof width !== 'number' || width <= 0) 
      return { ok: false, error: 'width must be a positive number' };
    out.width = width;
  }
  
  if (height !== undefined) {
    if (typeof height !== 'number' || height <= 0) 
      return { ok: false, error: 'height must be a positive number' };
    out.height = height;
  }
  
  if (properties !== undefined) {
    if (typeof properties !== 'object' || properties === null) 
      return { ok: false, error: 'properties must be an object' };
    out.properties = properties;
  }
  
  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};

export const validateConnectionCreate = (body: any): { ok: true; data: DiagramConnectionCreateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { diagram_id, from_block_id, to_block_id, type, points, label } = body;
  
  if (typeof diagram_id !== 'string' || !diagram_id.trim()) return { ok: false, error: 'diagram_id is required' };
  if (typeof from_block_id !== 'string' || !from_block_id.trim()) return { ok: false, error: 'from_block_id is required' };
  if (typeof to_block_id !== 'string' || !to_block_id.trim()) return { ok: false, error: 'to_block_id is required' };
  if (typeof type !== 'string' || !type.trim()) return { ok: false, error: 'type is required' };
  
  const data: DiagramConnectionCreateInput = {
    diagram_id: diagram_id.trim(),
    from_block_id: from_block_id.trim(),
    to_block_id: to_block_id.trim(),
    type: type.trim(),
  };
  
  if (points !== undefined) {
    if (!Array.isArray(points)) return { ok: false, error: 'points must be an array' };
    data.points = points;
  }
  
  if (label !== undefined) {
    if (typeof label !== 'string') return { ok: false, error: 'label must be a string' };
    data.label = label;
  }
  
  return { ok: true, data };
};


export const validateConnectionUpdate = (body: any): { ok: true; data: DiagramConnectionUpdateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { label, points } = body;
  const out: DiagramConnectionUpdateInput = {};
  
  if (label !== undefined) {
    if (typeof label !== 'string') return { ok: false, error: 'label must be a string' };
    out.label = label;
  }
  
  if (points !== undefined) {
    if (!Array.isArray(points)) return { ok: false, error: 'points must be an array' };
    // Проверим что каждая точка имеет x и y
    for (const point of points) {
      if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        return { ok: false, error: 'each point must have x and y as numbers' };
      }
    }
    out.points = points;
  }
  
  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};

export const validateBendPointCreate = (body: any): { ok: true; data: BendPointCreateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { position } = body;
  
  if (position !== 'middle') {
    return { ok: false, error: 'Only middle position is supported for bend points' };
  }
  
  return { ok: true, data: { position } };
};