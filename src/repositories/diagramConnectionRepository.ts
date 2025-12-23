import { Pool } from 'pg';
import {DiagramConnection, DiagramConnectionCreateInput, DiagramConnectionUpdateInput, Point} from '../types.js';

const mapConnectionRow = (row: any): DiagramConnection => {
    // Преобразуем points в массив Point
    let points: Point[] = [];
    if (row.points) {
        if (typeof row.points === 'string') {
            try {
                points = JSON.parse(row.points);
            } catch (e) {
                console.error('Error parsing points JSON:', e);
                points = [];
            }
        } else if (Array.isArray(row.points)) {
            points = row.points.map((p: any) => ({
                x: Number(p.x) || 0,
                y: Number(p.y) || 0
            }));
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
        type: row.type,
        points: points, // Теперь это всегда массив
        label: row.label,
        properties,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
};

export class DiagramConnectionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Добавляем недостающие методы
  async getById(id: string): Promise<DiagramConnection | null> {
    const res = await this.pool.query('SELECT * FROM diagram_connections WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapConnectionRow(res.rows[0]);
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

            // Преобразуем points в JSON строку
            let pointsJson = '[]';
            if (input.points) {
                if (Array.isArray(input.points)) {
                    pointsJson = JSON.stringify(input.points);
                } else if (typeof input.points === 'string') {
                    try {
                        JSON.parse(input.points);
                        pointsJson = input.points;
                    } catch {
                        pointsJson = '[]';
                    }
                }
            }
            values.push(pointsJson);
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

  async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
    const res = await this.pool.query(
      'SELECT * FROM diagram_connections WHERE diagram_id = $1 ORDER BY created_at',
      [diagramId]
    );
    return res.rows.map(mapConnectionRow);
  }

// В методе create исправьте:
    async create(id: string, input: DiagramConnectionCreateInput): Promise<DiagramConnection> {
        // Преобразуем points в JSON строку
        let pointsJson = '[]';
        if (input.points) {
            if (Array.isArray(input.points)) {
                pointsJson = JSON.stringify(input.points);
            } else if (typeof input.points === 'string') {
                // Проверяем, что это валидный JSON
                try {
                    JSON.parse(input.points);
                    pointsJson = input.points;
                } catch {
                    pointsJson = '[]';
                }
            }
        }

        const propertiesJson = JSON.stringify(input.properties || {});

        const res = await this.pool.query(
            `INSERT INTO diagram_connections (id, diagram_id, from_block_id, to_block_id, type, points, label, properties)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
            [id, input.diagram_id, input.from_block_id, input.to_block_id, input.type,
                pointsJson, input.label || null, propertiesJson]
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
