import { Pool } from 'pg';
import { DiagramConnection, DiagramConnectionCreateInput, DiagramConnectionUpdateInput } from '../types.js';

const mapConnectionRow = (row: any): DiagramConnection => ({
    id: row.id,
    diagram_id: row.diagram_id,
    from_block_id: row.from_block_id,
    to_block_id: row.to_block_id,
    type: row.type,
    points: row.points,
    label: row.label,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export class DiagramConnectionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }
  async update(id: string, input: DiagramConnectionUpdateInput): Promise<DiagramConnection | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.label !== undefined) { 
      fields.push(`label = $${idx++}`); 
      values.push(input.label); 
    }
    if (input.points !== undefined) { 
      fields.push(`points = $${idx++}`); 
      values.push(JSON.stringify(input.points)); 
    }

    if (fields.length === 0) return null;

    const query = `UPDATE diagram_connections SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);
    
    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
  }

  async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
    const res = await this.pool.query(
      'SELECT * FROM diagram_connections WHERE diagram_id = $1 ORDER BY created_at',
      [diagramId]
    );
    return res.rows.map(mapConnectionRow);
  }

  async create(id: string, input: DiagramConnectionCreateInput): Promise<DiagramConnection> {
    const res = await this.pool.query(
      `INSERT INTO diagram_connections (id, diagram_id, from_block_id, to_block_id, type, points, label)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [id, input.diagram_id, input.from_block_id, input.to_block_id, input.type, JSON.stringify(input.points || []), input.label] 
    );
    return mapConnectionRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM diagram_connections WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  }

  async deleteByDiagramId(diagramId: string): Promise<void> {
    await this.pool.query('DELETE FROM diagram_connections WHERE diagram_id = $1', [diagramId]);
  }

  async getById(id: string): Promise<DiagramConnection | null> {
    const res = await this.pool.query('SELECT * FROM diagram_connections WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
  }
}
