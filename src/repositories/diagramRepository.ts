import { Pool } from 'pg';
import { Diagram, DiagramCreateInput, DiagramUpdateInput } from '../types.js';

const mapRow = (row: any): Diagram => ({
  id: row.id,
  name: row.name,
  type: row.type,
  svg_data: row.svg_data,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

export class DiagramRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(): Promise<Diagram[]> {
    const res = await this.pool.query('SELECT id, name, type, svg_data, created_at, updated_at FROM diagrams ORDER BY created_at DESC');
    return res.rows.map(mapRow);
  }

  async getById(id: string): Promise<Diagram | null> {
    const res = await this.pool.query('SELECT id, name, type, svg_data, created_at, updated_at FROM diagrams WHERE id = $1', [id]);
    if (res.rowCount === 0) return null;
    return mapRow(res.rows[0]);
  }

  async create(id: string, input: DiagramCreateInput): Promise<Diagram> {
    const res = await this.pool.query(
      `INSERT INTO diagrams (id, name, type, svg_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, type, svg_data, created_at, updated_at`,
      [id, input.name, input.type, input.svg_data]
    );
    return mapRow(res.rows[0]);
  }

  async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.type !== undefined) { fields.push(`type = $${idx++}`); values.push(input.type); }
    if (input.svg_data !== undefined) { fields.push(`svg_data = $${idx++}`); values.push(input.svg_data); }

    if (fields.length === 0) return null;

    const query = `UPDATE diagrams SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, name, type, svg_data, created_at, updated_at`;
    values.push(id);
    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) return null;
    return mapRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM diagrams WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

