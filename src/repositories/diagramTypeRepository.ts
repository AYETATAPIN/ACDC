import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConnectionRuleBulkUpdateInput,
  ConnectionRuleCellUpdateInput,
  ConnectionRulesMatrix,
  ConnectionTypeCreateInput,
  ConnectionTypeEntity,
  ConnectionTypeUpdateInput,
  DiagramTypeCreateInput,
  DiagramTypeEntity,
  DiagramTypeUpdateInput,
  ElementTypeCreateInput,
  ElementTypeEntity,
  ElementTypeUpdateInput,
} from '../types.js';

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value as T;
  return fallback;
};

const mapDiagramTypeRow = (row: any): DiagramTypeEntity => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  is_builtin: Boolean(row.is_builtin),
  is_free_mode: Boolean(row.is_free_mode),
  clone_source_id: row.clone_source_id,
  owner_user_id: row.owner_user_id,
  metadata: parseJson<Record<string, any>>(row.metadata, {}),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

const mapElementTypeRow = (row: any): ElementTypeEntity => ({
  id: row.id,
  diagram_type_id: row.diagram_type_id,
  key: row.key,
  name: row.name,
  shape: row.shape,
  svg_path: row.svg_path,
  default_style: parseJson<Record<string, any>>(row.default_style, {}),
  default_size: parseJson<{ width: number; height: number }>(row.default_size, { width: 120, height: 60 }),
  ports: parseJson<any[]>(row.ports, []),
  field_schema: parseJson<any[]>(row.field_schema, []),
  is_builtin: Boolean(row.is_builtin),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

const mapConnectionTypeRow = (row: any): ConnectionTypeEntity => ({
  id: row.id,
  diagram_type_id: row.diagram_type_id,
  key: row.key,
  name: row.name,
  color: row.color,
  dash: row.dash,
  arrow_start: row.arrow_start,
  arrow_end: row.arrow_end,
  directed: Boolean(row.directed),
  default_style: parseJson<Record<string, any>>(row.default_style, {}),
  is_builtin: Boolean(row.is_builtin),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

export class DiagramTypeRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listAccessibleToUser(userId: string): Promise<DiagramTypeEntity[]> {
    const res = await this.pool.query(
      `SELECT *
       FROM diagram_types
       WHERE is_builtin = TRUE OR owner_user_id = $1
       ORDER BY is_builtin DESC, created_at ASC`,
      [userId],
    );
    return res.rows.map(mapDiagramTypeRow);
  }

  async getById(id: string): Promise<DiagramTypeEntity | null> {
    const res = await this.pool.query('SELECT * FROM diagram_types WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapDiagramTypeRow(res.rows[0]);
  }

  async getAccessibleById(id: string, userId: string): Promise<DiagramTypeEntity | null> {
    const res = await this.pool.query(
      'SELECT * FROM diagram_types WHERE id = $1 AND (is_builtin = TRUE OR owner_user_id = $2)',
      [id, userId],
    );
    if (res.rows.length === 0) return null;
    return mapDiagramTypeRow(res.rows[0]);
  }

  async create(input: DiagramTypeCreateInput): Promise<DiagramTypeEntity> {
    const id = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO diagram_types (id, key, name, description, is_builtin, is_free_mode, clone_source_id, owner_user_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.key ?? null,
        input.name,
        input.description ?? null,
        Boolean(input.is_builtin),
        Boolean(input.is_free_mode),
        input.clone_source_id ?? null,
        input.owner_user_id ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapDiagramTypeRow(res.rows[0]);
  }

  async update(id: string, input: DiagramTypeUpdateInput): Promise<DiagramTypeEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.key !== undefined) {
      fields.push(`key = $${idx++}`);
      values.push(input.key);
    }
    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description);
    }
    if (input.is_free_mode !== undefined) {
      fields.push(`is_free_mode = $${idx++}`);
      values.push(input.is_free_mode);
    }
    if (input.owner_user_id !== undefined) {
      fields.push(`owner_user_id = $${idx++}`);
      values.push(input.owner_user_id);
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(input.metadata ?? {}));
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const res = await this.pool.query(`UPDATE diagram_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (res.rows.length === 0) return null;
    return mapDiagramTypeRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM diagram_types WHERE id = $1 AND is_builtin = FALSE RETURNING id', [id]);
    return res.rows.length > 0;
  }

  async clone(diagramTypeId: string, name: string, ownerUserId: string): Promise<DiagramTypeEntity | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const sourceTypeRes = await client.query('SELECT * FROM diagram_types WHERE id = $1', [diagramTypeId]);
      if (sourceTypeRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const sourceType = sourceTypeRes.rows[0];
      const clonedId = uuidv4();

      const clonedTypeRes = await client.query(
        `INSERT INTO diagram_types (
          id, key, name, description, is_builtin, is_free_mode, clone_source_id, owner_user_id, metadata
        ) VALUES ($1, NULL, $2, $3, FALSE, $4, $5, $6, $7)
        RETURNING *`,
        [
          clonedId,
          name,
          sourceType.description,
          sourceType.is_free_mode,
          sourceType.id,
          ownerUserId,
          JSON.stringify({ ...(parseJson<Record<string, any>>(sourceType.metadata, {})), clonedFrom: sourceType.id }),
        ],
      );

      const sourceElementsRes = await client.query('SELECT * FROM element_types WHERE diagram_type_id = $1', [diagramTypeId]);
      const sourceConnectionsRes = await client.query('SELECT * FROM connection_types WHERE diagram_type_id = $1', [diagramTypeId]);

      const elementIdMap = new Map<string, string>();
      const connectionIdMap = new Map<string, string>();

      for (const row of sourceElementsRes.rows) {
        const newId = uuidv4();
        elementIdMap.set(row.id, newId);
        await client.query(
          `INSERT INTO element_types (
            id, diagram_type_id, key, name, shape, svg_path, default_style, default_size, ports, field_schema, is_builtin
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)`,
          [
            newId,
            clonedId,
            row.key,
            row.name,
            row.shape,
            row.svg_path,
            JSON.stringify(parseJson(row.default_style, {})),
            JSON.stringify(parseJson(row.default_size, { width: 120, height: 60 })),
            JSON.stringify(parseJson(row.ports, [])),
            JSON.stringify(parseJson(row.field_schema, [])),
          ],
        );
      }

      for (const row of sourceConnectionsRes.rows) {
        const newId = uuidv4();
        connectionIdMap.set(row.id, newId);
        await client.query(
          `INSERT INTO connection_types (
            id, diagram_type_id, key, name, color, dash, arrow_start, arrow_end, directed, default_style, is_builtin
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)`,
          [
            newId,
            clonedId,
            row.key,
            row.name,
            row.color,
            row.dash,
            row.arrow_start,
            row.arrow_end,
            row.directed,
            JSON.stringify(parseJson(row.default_style, {})),
          ],
        );
      }

      const sourceRulesRes = await client.query('SELECT * FROM connection_rules WHERE diagram_type_id = $1', [diagramTypeId]);
      for (const row of sourceRulesRes.rows) {
        const fromId = elementIdMap.get(row.from_element_type_id);
        const toId = elementIdMap.get(row.to_element_type_id);
        const connId = connectionIdMap.get(row.connection_type_id);
        if (!fromId || !toId || !connId) continue;

        await client.query(
          `INSERT INTO connection_rules (
            id, diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id, allowed
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), clonedId, fromId, toId, connId, row.allowed],
        );
      }

      await client.query('COMMIT');
      return mapDiagramTypeRow(clonedTypeRes.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listElements(diagramTypeId: string): Promise<ElementTypeEntity[]> {
    const res = await this.pool.query('SELECT * FROM element_types WHERE diagram_type_id = $1 ORDER BY is_builtin DESC, created_at ASC', [diagramTypeId]);
    return res.rows.map(mapElementTypeRow);
  }

  async getElementById(id: string): Promise<ElementTypeEntity | null> {
    const res = await this.pool.query('SELECT * FROM element_types WHERE id = $1', [id]);
    return res.rows[0] ? mapElementTypeRow(res.rows[0]) : null;
  }

  async createElement(diagramTypeId: string, input: ElementTypeCreateInput): Promise<ElementTypeEntity> {
    const res = await this.pool.query(
      `INSERT INTO element_types (
        id, diagram_type_id, key, name, shape, svg_path, default_style, default_size, ports, field_schema, is_builtin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        uuidv4(),
        diagramTypeId,
        input.key,
        input.name,
        input.shape ?? 'rect',
        input.svg_path ?? null,
        JSON.stringify(input.default_style ?? {}),
        JSON.stringify(input.default_size ?? { width: 120, height: 60 }),
        JSON.stringify(input.ports ?? []),
        JSON.stringify(input.field_schema ?? []),
        Boolean(input.is_builtin),
      ],
    );
    return mapElementTypeRow(res.rows[0]);
  }

  async updateElement(id: string, input: ElementTypeUpdateInput): Promise<ElementTypeEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.key !== undefined) {
      fields.push(`key = $${idx++}`);
      values.push(input.key);
    }
    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.shape !== undefined) {
      fields.push(`shape = $${idx++}`);
      values.push(input.shape);
    }
    if (input.svg_path !== undefined) {
      fields.push(`svg_path = $${idx++}`);
      values.push(input.svg_path);
    }
    if (input.default_style !== undefined) {
      fields.push(`default_style = $${idx++}`);
      values.push(JSON.stringify(input.default_style));
    }
    if (input.default_size !== undefined) {
      fields.push(`default_size = $${idx++}`);
      values.push(JSON.stringify(input.default_size));
    }
    if (input.ports !== undefined) {
      fields.push(`ports = $${idx++}`);
      values.push(JSON.stringify(input.ports));
    }
    if (input.field_schema !== undefined) {
      fields.push(`field_schema = $${idx++}`);
      values.push(JSON.stringify(input.field_schema));
    }

    if (fields.length === 0) {
      const existing = await this.pool.query('SELECT * FROM element_types WHERE id = $1', [id]);
      return existing.rows[0] ? mapElementTypeRow(existing.rows[0]) : null;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const res = await this.pool.query(`UPDATE element_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (res.rows.length === 0) return null;
    return mapElementTypeRow(res.rows[0]);
  }

  async deleteElement(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM element_types WHERE id = $1 AND is_builtin = FALSE RETURNING id', [id]);
    return res.rows.length > 0;
  }

  async listConnectionTypes(diagramTypeId: string): Promise<ConnectionTypeEntity[]> {
    const res = await this.pool.query(
      'SELECT * FROM connection_types WHERE diagram_type_id = $1 ORDER BY is_builtin DESC, created_at ASC',
      [diagramTypeId],
    );
    return res.rows.map(mapConnectionTypeRow);
  }

  async getConnectionTypeById(id: string): Promise<ConnectionTypeEntity | null> {
    const res = await this.pool.query('SELECT * FROM connection_types WHERE id = $1', [id]);
    return res.rows[0] ? mapConnectionTypeRow(res.rows[0]) : null;
  }

  async createConnectionType(diagramTypeId: string, input: ConnectionTypeCreateInput): Promise<ConnectionTypeEntity> {
    const res = await this.pool.query(
      `INSERT INTO connection_types (
        id, diagram_type_id, key, name, color, dash, arrow_start, arrow_end, directed, default_style, is_builtin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        uuidv4(),
        diagramTypeId,
        input.key,
        input.name,
        input.color ?? '#34495e',
        input.dash ?? '',
        input.arrow_start ?? 'none',
        input.arrow_end ?? 'arrow',
        input.directed ?? true,
        JSON.stringify(input.default_style ?? {}),
        Boolean(input.is_builtin),
      ],
    );
    return mapConnectionTypeRow(res.rows[0]);
  }

  async updateConnectionType(id: string, input: ConnectionTypeUpdateInput): Promise<ConnectionTypeEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.key !== undefined) {
      fields.push(`key = $${idx++}`);
      values.push(input.key);
    }
    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.color !== undefined) {
      fields.push(`color = $${idx++}`);
      values.push(input.color);
    }
    if (input.dash !== undefined) {
      fields.push(`dash = $${idx++}`);
      values.push(input.dash);
    }
    if (input.arrow_start !== undefined) {
      fields.push(`arrow_start = $${idx++}`);
      values.push(input.arrow_start);
    }
    if (input.arrow_end !== undefined) {
      fields.push(`arrow_end = $${idx++}`);
      values.push(input.arrow_end);
    }
    if (input.directed !== undefined) {
      fields.push(`directed = $${idx++}`);
      values.push(input.directed);
    }
    if (input.default_style !== undefined) {
      fields.push(`default_style = $${idx++}`);
      values.push(JSON.stringify(input.default_style));
    }

    if (fields.length === 0) {
      const existing = await this.pool.query('SELECT * FROM connection_types WHERE id = $1', [id]);
      return existing.rows[0] ? mapConnectionTypeRow(existing.rows[0]) : null;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const res = await this.pool.query(`UPDATE connection_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (res.rows.length === 0) return null;
    return mapConnectionTypeRow(res.rows[0]);
  }

  async deleteConnectionType(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM connection_types WHERE id = $1 AND is_builtin = FALSE RETURNING id', [id]);
    return res.rows.length > 0;
  }

  async getRulesMatrix(diagramTypeId: string): Promise<ConnectionRulesMatrix> {
    const elements = await this.listElements(diagramTypeId);
    const connectionTypes = await this.listConnectionTypes(diagramTypeId);

    const rulesRes = await this.pool.query<{
      from_element_type_id: string;
      to_element_type_id: string;
      connection_type_id: string;
      allowed: boolean;
    }>(
      `SELECT from_element_type_id, to_element_type_id, connection_type_id, allowed
       FROM connection_rules
       WHERE diagram_type_id = $1`,
      [diagramTypeId],
    );

    const byCell = new Map<string, Map<string, boolean>>();
    for (const row of rulesRes.rows) {
      const key = `${row.from_element_type_id}:${row.to_element_type_id}`;
      const connMap = byCell.get(key) ?? new Map<string, boolean>();
      connMap.set(row.connection_type_id, row.allowed);
      byCell.set(key, connMap);
    }

    const cells: ConnectionRulesMatrix['cells'] = [];
    for (const from of elements) {
      for (const to of elements) {
        const cellKey = `${from.id}:${to.id}`;
        const connMap = byCell.get(cellKey) ?? new Map<string, boolean>();
        cells.push({
          from_element_type_id: from.id,
          to_element_type_id: to.id,
          rules: connectionTypes.map((ct) => ({
            connection_type_id: ct.id,
            allowed: connMap.get(ct.id) ?? false,
          })),
        });
      }
    }

    return {
      elements: elements.map((e) => ({ id: e.id, key: e.key, name: e.name, shape: e.shape })),
      connection_types: connectionTypes.map((c) => ({
        id: c.id,
        key: c.key,
        name: c.name,
        color: c.color,
        dash: c.dash,
        arrow_start: c.arrow_start,
        arrow_end: c.arrow_end,
        directed: c.directed,
      })),
      cells,
    };
  }

  async updateRuleCell(diagramTypeId: string, input: ConnectionRuleCellUpdateInput): Promise<void> {
    for (const rule of input.rules) {
      await this.pool.query(
        `INSERT INTO connection_rules (
          id, diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id, allowed
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id)
        DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
        [
          uuidv4(),
          diagramTypeId,
          input.from_element_type_id,
          input.to_element_type_id,
          rule.connection_type_id,
          rule.allowed,
        ],
      );
    }
  }

  async bulkUpdateRules(diagramTypeId: string, input: ConnectionRuleBulkUpdateInput): Promise<void> {
    const matrix = await this.getRulesMatrix(diagramTypeId);
    const elementIds = matrix.elements.map((e) => e.id);
    const connectionTypeIds = input.connection_type_ids?.length
      ? input.connection_type_ids
      : matrix.connection_types.map((c) => c.id);

    const apply = async (fromId: string, toId: string, connectionTypeId: string) => {
      await this.pool.query(
        `INSERT INTO connection_rules (
          id, diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id, allowed
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id)
        DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
        [uuidv4(), diagramTypeId, fromId, toId, connectionTypeId, input.allowed],
      );
    };

    if (input.mode === 'row') {
      for (const toId of elementIds) {
        for (const connectionTypeId of connectionTypeIds) {
          await apply(input.target_id, toId, connectionTypeId);
        }
      }
      return;
    }

    if (input.mode === 'column') {
      for (const fromId of elementIds) {
        for (const connectionTypeId of connectionTypeIds) {
          await apply(fromId, input.target_id, connectionTypeId);
        }
      }
      return;
    }

    if (input.mode === 'connection_type') {
      for (const fromId of elementIds) {
        for (const toId of elementIds) {
          await apply(fromId, toId, input.target_id);
        }
      }
    }
  }

  async resolveRuleByKeys(diagramTypeId: string, fromElementKey: string, toElementKey: string, connectionTypeKey: string): Promise<boolean> {
    const typeRes = await this.pool.query<{ is_free_mode: boolean }>('SELECT is_free_mode FROM diagram_types WHERE id = $1', [diagramTypeId]);
    if (typeRes.rows.length === 0) return false;
    if (typeRes.rows[0].is_free_mode) return true;

    const idsRes = await this.pool.query<{
      from_id: string | null;
      to_id: string | null;
      connection_id: string | null;
    }>(
      `SELECT
         (SELECT id FROM element_types WHERE diagram_type_id = $1 AND key = $2 LIMIT 1) AS from_id,
         (SELECT id FROM element_types WHERE diagram_type_id = $1 AND key = $3 LIMIT 1) AS to_id,
         (SELECT id FROM connection_types WHERE diagram_type_id = $1 AND key = $4 LIMIT 1) AS connection_id`,
      [diagramTypeId, fromElementKey, toElementKey, connectionTypeKey],
    );

    const ids = idsRes.rows[0];
    if (!ids?.from_id || !ids?.to_id || !ids?.connection_id) return false;

    const ruleRes = await this.pool.query<{ allowed: boolean }>(
      `SELECT allowed
       FROM connection_rules
       WHERE diagram_type_id = $1
         AND from_element_type_id = $2
         AND to_element_type_id = $3
         AND connection_type_id = $4
       LIMIT 1`,
      [diagramTypeId, ids.from_id, ids.to_id, ids.connection_id],
    );

    return Boolean(ruleRes.rows[0]?.allowed);
  }

  async getDiagramTypeIdForDiagram(diagramId: string): Promise<string | null> {
    const res = await this.pool.query<{ diagram_type_id: string | null }>('SELECT diagram_type_id FROM diagrams WHERE id = $1', [diagramId]);
    return res.rows[0]?.diagram_type_id ?? null;
  }

  async recalculateRuleViolationsByDiagramType(diagramTypeId: string): Promise<void> {
    await this.pool.query(
      `UPDATE diagram_connections c
       SET rule_violation = CASE
         WHEN dt.is_free_mode THEN FALSE
         ELSE NOT COALESCE(r.allowed, FALSE)
       END
       FROM diagram_connections cx
       JOIN diagrams d ON d.id = cx.diagram_id
       JOIN diagram_types dt ON dt.id = d.diagram_type_id
       JOIN diagram_blocks fb ON fb.id = cx.from_block_id
       JOIN diagram_blocks tb ON tb.id = cx.to_block_id
       LEFT JOIN element_types fe ON fe.diagram_type_id = d.diagram_type_id AND fe.key = fb.type
       LEFT JOIN element_types te ON te.diagram_type_id = d.diagram_type_id AND te.key = tb.type
       LEFT JOIN connection_types ct ON ct.diagram_type_id = d.diagram_type_id AND ct.key = cx.type
       LEFT JOIN connection_rules r
         ON r.diagram_type_id = d.diagram_type_id
         AND r.from_element_type_id = fe.id
         AND r.to_element_type_id = te.id
         AND r.connection_type_id = ct.id
       WHERE c.id = cx.id
         AND d.diagram_type_id = $1`,
      [diagramTypeId],
    );
  }

  async recalculateRuleViolationsByDiagram(diagramId: string): Promise<void> {
    await this.pool.query(
      `UPDATE diagram_connections c
       SET rule_violation = CASE
         WHEN dt.is_free_mode THEN FALSE
         ELSE NOT COALESCE(r.allowed, FALSE)
       END
       FROM diagram_connections cx
       JOIN diagrams d ON d.id = cx.diagram_id
       JOIN diagram_types dt ON dt.id = d.diagram_type_id
       JOIN diagram_blocks fb ON fb.id = cx.from_block_id
       JOIN diagram_blocks tb ON tb.id = cx.to_block_id
       LEFT JOIN element_types fe ON fe.diagram_type_id = d.diagram_type_id AND fe.key = fb.type
       LEFT JOIN element_types te ON te.diagram_type_id = d.diagram_type_id AND te.key = tb.type
       LEFT JOIN connection_types ct ON ct.diagram_type_id = d.diagram_type_id AND ct.key = cx.type
       LEFT JOIN connection_rules r
         ON r.diagram_type_id = d.diagram_type_id
         AND r.from_element_type_id = fe.id
         AND r.to_element_type_id = te.id
         AND r.connection_type_id = ct.id
       WHERE c.id = cx.id
         AND d.id = $1`,
      [diagramId],
    );
  }
}
