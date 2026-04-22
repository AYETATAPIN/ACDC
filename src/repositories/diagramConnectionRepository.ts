import { Pool } from 'pg';
import { DiagramConnection, DiagramConnectionCreateInput, DiagramConnectionUpdateInput, Point } from '../types.js';

const mapConnectionRow = (row: any): DiagramConnection => {
  let points: Point[] = [];
  if (row.points) {
    if (typeof row.points === 'string') {
      try {
        points = JSON.parse(row.points);
      } catch {
        points = [];
      }
    } else if (Array.isArray(row.points)) {
      points = row.points.map((p: any) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
    }
  }

  const properties = (() => {
    if (row.properties === undefined || row.properties === null) return {};
    if (typeof row.properties === 'string') {
      try {
        const parsed = JSON.parse(row.properties);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof row.properties === 'object') return row.properties;
    return {};
  })();

  return {
    id: row.id,
    diagram_id: row.diagram_id,
    from_block_id: row.from_block_id,
    to_block_id: row.to_block_id,
    connection_type_id: row.connection_type_id,
    type: row.type,
    points,
    label: row.label,
    properties,
    rule_violation: Boolean(row.rule_violation),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
};

export class DiagramConnectionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getByIdForOwner(id: string, ownerUserId: string): Promise<DiagramConnection | null> {
    const res = await this.pool.query(
      `SELECT c.*
       FROM diagram_connections c
       JOIN diagrams d ON d.id = c.diagram_id
       WHERE c.id = $1 AND d.owner_user_id = $2`,
      [id, ownerUserId],
    );
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
  }

  async getById(id: string): Promise<DiagramConnection | null> {
    const res = await this.pool.query('SELECT * FROM diagram_connections WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
  }

  async update(id: string, input: DiagramConnectionUpdateInput): Promise<DiagramConnection | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.connection_type_id !== undefined) {
      fields.push(`connection_type_id = $${idx++}`);
      values.push(input.connection_type_id ?? null);
    }

    if (input.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(input.type);
    }

    if (input.label !== undefined) {
      fields.push(`label = $${idx++}`);
      values.push(input.label);
    }

    if (input.points !== undefined) {
      fields.push(`points = $${idx++}`);
      values.push(JSON.stringify(input.points ?? []));
    }

    if (input.properties !== undefined) {
      fields.push(`properties = $${idx++}`);
      values.push(JSON.stringify(input.properties));
    }

    if (fields.length === 0) return null;

    const query = `UPDATE diagram_connections SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
  }

  async getByDiagramIdForOwner(diagramId: string, ownerUserId: string): Promise<DiagramConnection[]> {
    const res = await this.pool.query(
      `SELECT c.*
       FROM diagram_connections c
       JOIN diagrams d ON d.id = c.diagram_id
       WHERE c.diagram_id = $1 AND d.owner_user_id = $2
       ORDER BY c.created_at`,
      [diagramId, ownerUserId],
    );
    return res.rows.map(mapConnectionRow);
  }

  async create(id: string, input: DiagramConnectionCreateInput): Promise<DiagramConnection> {
    const res = await this.pool.query(
      `INSERT INTO diagram_connections (
        id,
        diagram_id,
        from_block_id,
        to_block_id,
        connection_type_id,
        type,
        points,
        label,
        properties
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        input.diagram_id,
        input.from_block_id,
        input.to_block_id,
        input.connection_type_id ?? null,
        input.type,
        JSON.stringify(input.points ?? []),
        input.label || null,
        JSON.stringify(input.properties || {}),
      ],
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
}
