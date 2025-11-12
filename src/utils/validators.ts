import { DiagramCreateInput, DiagramType, DiagramUpdateInput } from '../types.js';

const TYPES: DiagramType[] = ['class', 'use_case', 'free_mode'];

const isDiagramType = (value: unknown): value is DiagramType =>
  typeof value === 'string' && (TYPES as ReadonlyArray<DiagramType>).includes(value as DiagramType);

export const validateCreate = (body: any): { ok: true; data: DiagramCreateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { name, type, svg_data } = body;
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'name is required' };
  if (!isDiagramType(type)) return { ok: false, error: 'type must be one of class|use_case|free_mode' };
  if (typeof svg_data !== 'string' || !svg_data.trim()) return { ok: false, error: 'svg_data is required' };
  return { ok: true, data: { name: name.trim(), type, svg_data } };
};

export const validateUpdate = (body: any): { ok: true; data: DiagramUpdateInput } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const { name, type, svg_data } = body;
  const out: DiagramUpdateInput = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'name must be a non-empty string' };
    out.name = name.trim();
  }
  if (type !== undefined) {
    if (!isDiagramType(type)) return { ok: false, error: 'type must be one of class|use_case|free_mode' };
    out.type = type;
  }
  if (svg_data !== undefined) {
    if (typeof svg_data !== 'string' || !svg_data.trim()) return { ok: false, error: 'svg_data must be a non-empty string' };
    out.svg_data = svg_data;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'At least one field must be provided' };
  return { ok: true, data: out };
};
