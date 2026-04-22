import { Pool } from 'pg';
import { DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput } from '../types.js';

const toNumber = (value: any): number => Number(value ?? 0);

const parseProperties = (value: any): Record<string, any> => {
  if (value === undefined || value === null) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value;
  return {};
};

const mapBlockRow = (row: any): DiagramBlock => ({
  id: row.id,
  diagram_id: row.diagram_id,
  element_type_id: row.element_type_id,
  type: row.type,
  x: toNumber(row.x),
  y: toNumber(row.y),
  width: toNumber(row.width),
  height: toNumber(row.height),
  properties: parseProperties(row.properties),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

export class DiagramBlockRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getByDiagramIdForOwner(diagramId: string, ownerUserId: string): Promise<DiagramBlock[]> {
    const res = await this.pool.query(
      `SELECT b.*
       FROM diagram_blocks b
       JOIN diagrams d ON d.id = b.diagram_id
       WHERE b.diagram_id = $1 AND d.owner_user_id = $2
       ORDER BY b.created_at`,
      [diagramId, ownerUserId],
    );
    return res.rows.map(mapBlockRow);
  }

  async getById(id: string): Promise<DiagramBlock | null> {
    const res = await this.pool.query('SELECT * FROM diagram_blocks WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapBlockRow(res.rows[0]);
  }

  async getByIdForOwner(id: string, ownerUserId: string): Promise<DiagramBlock | null> {
    const res = await this.pool.query(
      `SELECT b.*
       FROM diagram_blocks b
       JOIN diagrams d ON d.id = b.diagram_id
       WHERE b.id = $1 AND d.owner_user_id = $2`,
      [id, ownerUserId],
    );
    if (res.rows.length === 0) return null;
    return mapBlockRow(res.rows[0]);
  }

  async create(id: string, input: DiagramBlockCreateInput): Promise<DiagramBlock> {
    const properties = input.properties || {};
    if (typeof properties !== 'object' || properties === null) {
      throw new Error('Properties must be an object');
    }

    const res = await this.pool.query(
      `INSERT INTO diagram_blocks (id, diagram_id, element_type_id, type, x, y, width, height, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.diagram_id,
        input.element_type_id ?? null,
        input.type,
        input.x,
        input.y,
        input.width || 100,
        input.height || 60,
        JSON.stringify(properties),
      ],
    );

    return mapBlockRow(res.rows[0]);
  }

  async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.element_type_id !== undefined) {
      fields.push(`element_type_id = $${idx++}`);
      values.push(input.element_type_id ?? null);
    }
    if (input.x !== undefined) {
      fields.push(`x = $${idx++}`);
      values.push(input.x);
    }
    if (input.y !== undefined) {
      fields.push(`y = $${idx++}`);
      values.push(input.y);
    }
    if (input.width !== undefined) {
      fields.push(`width = $${idx++}`);
      values.push(input.width);
    }
    if (input.height !== undefined) {
      fields.push(`height = $${idx++}`);
      values.push(input.height);
    }
    if (input.properties !== undefined) {
      if (typeof input.properties !== 'object' || input.properties === null) {
        throw new Error('Properties must be an object');
      }
      fields.push(`properties = $${idx++}`);
      values.push(JSON.stringify(input.properties));
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(id);

    const res = await this.pool.query(`UPDATE diagram_blocks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (res.rows.length === 0) return null;
    return mapBlockRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM diagram_blocks WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  }

  async deleteByDiagramId(diagramId: string): Promise<void> {
    await this.pool.query('DELETE FROM diagram_blocks WHERE diagram_id = $1', [diagramId]);
  }
}
