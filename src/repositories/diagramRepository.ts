import { Pool } from 'pg';
import { Diagram, DiagramCreateInput, DiagramUpdateInput } from '../types.js';

const mapRow = (row: any): Diagram => ({
  id: row.id,
  name: row.name,
  type: row.type,
  diagram_type_id: row.diagram_type_id,
  diagram_type_version_id: row.diagram_type_version_id,
  owner_user_id: row.owner_user_id,
  svg_data: row.svg_data,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

export class DiagramRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listForOwner(ownerUserId: string): Promise<Diagram[]> {
    const res = await this.pool.query(
      `SELECT id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at
       FROM diagrams
       WHERE owner_user_id = $1
       ORDER BY created_at DESC`,
      [ownerUserId],
    );
    return res.rows.map(mapRow);
  }

  async getByIdForOwner(id: string, ownerUserId: string): Promise<Diagram | null> {
    const res = await this.pool.query(
      `SELECT id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at
       FROM diagrams
       WHERE id = $1 AND owner_user_id = $2`,
      [id, ownerUserId],
    );
    if (res.rows.length === 0) return null;
    return mapRow(res.rows[0]);
  }

  async create(id: string, ownerUserId: string, input: DiagramCreateInput): Promise<Diagram> {
    const res = await this.pool.query(
      `INSERT INTO diagrams (id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at`,
      [id, input.name, input.type, input.diagram_type_id, input.diagram_type_version_id ?? null, ownerUserId, input.svg_data],
    );
    return mapRow(res.rows[0]);
  }

  async updateForOwner(id: string, ownerUserId: string, input: DiagramUpdateInput): Promise<Diagram | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(input.type);
    }
    if (input.diagram_type_id !== undefined) {
      fields.push(`diagram_type_id = $${idx++}`);
      values.push(input.diagram_type_id);
    }
    if (input.diagram_type_version_id !== undefined) {
      fields.push(`diagram_type_version_id = $${idx++}`);
      values.push(input.diagram_type_version_id);
    }
    if (input.svg_data !== undefined) {
      fields.push(`svg_data = $${idx++}`);
      values.push(input.svg_data);
    }

    if (fields.length === 0) return null;

    const query = `UPDATE diagrams
                   SET ${fields.join(', ')},
                       updated_at = NOW()
                   WHERE id = $${idx} AND owner_user_id = $${idx + 1}
                   RETURNING id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at`;

    values.push(id);
    values.push(ownerUserId);
    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return mapRow(res.rows[0]);
  }

  async deleteForOwner(id: string, ownerUserId: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM diagrams WHERE id = $1 AND owner_user_id = $2 RETURNING id', [id, ownerUserId]);
    return res.rows.length > 0;
  }

  async isOwnedByUser(id: string, ownerUserId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM diagrams WHERE id = $1 AND owner_user_id = $2 LIMIT 1', [id, ownerUserId]);
    return res.rows.length > 0;
  }
}
