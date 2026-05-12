import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConnectionRuleBulkUpdateInput,
  ConnectionRuleCellUpdateInput,
  ConnectionRulesMatrix,
  DiagramTypeUpgradeIssue,
  ConnectionTypeCreateInput,
  ConnectionTypeEntity,
  ConnectionTypeUpdateInput,
  DiagramTypeCreateInput,
  DiagramTypeEntity,
  DiagramTypeVersionEntity,
  DiagramTypeVersionSnapshot,
  DiagramTypeVersionStatus,
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
  current_version_id: row.current_version_id,
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

const mapDiagramTypeVersionRow = (row: any): DiagramTypeVersionEntity => ({
  id: row.id,
  diagram_type_id: row.diagram_type_id,
  version_number: Number(row.version_number),
  snapshot: parseJson<DiagramTypeVersionSnapshot>(row.snapshot, {
    diagram_type: { id: row.diagram_type_id, key: null, is_free_mode: false, metadata: {} },
    element_types: [],
    connection_types: [],
    rules: [],
  }),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
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
        ) VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $8)
        RETURNING *`,
        [
          clonedId,
          `type_${uuidv4()}`,
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

  async buildVersionSnapshot(diagramTypeId: string): Promise<DiagramTypeVersionSnapshot> {
    const typeRes = await this.pool.query('SELECT id, key, is_free_mode, metadata FROM diagram_types WHERE id = $1', [diagramTypeId]);
    const type = typeRes.rows[0];
    if (!type) {
      throw new Error('Diagram type not found');
    }

    const elements = await this.listElements(diagramTypeId);
    const connectionTypes = await this.listConnectionTypes(diagramTypeId);
    const rulesRes = await this.pool.query(
      `SELECT fe.key AS from_element_key,
              te.key AS to_element_key,
              ct.key AS connection_type_key,
              r.allowed
       FROM connection_rules r
       JOIN element_types fe ON fe.id = r.from_element_type_id
       JOIN element_types te ON te.id = r.to_element_type_id
       JOIN connection_types ct ON ct.id = r.connection_type_id
       WHERE r.diagram_type_id = $1
       ORDER BY fe.key, te.key, ct.key`,
      [diagramTypeId],
    );

    return {
      diagram_type: {
        id: type.id,
        key: type.key,
        is_free_mode: Boolean(type.is_free_mode),
        metadata: parseJson<Record<string, any>>(type.metadata, {}),
      },
      element_types: elements.map((item) => ({
        id: item.id,
        key: item.key,
        name: item.name,
        shape: item.shape,
        svg_path: item.svg_path,
        default_style: item.default_style,
        default_size: item.default_size,
        ports: item.ports,
        field_schema: item.field_schema,
      })),
      connection_types: connectionTypes.map((item) => ({
        id: item.id,
        key: item.key,
        name: item.name,
        color: item.color,
        dash: item.dash,
        arrow_start: item.arrow_start,
        arrow_end: item.arrow_end,
        directed: item.directed,
        default_style: item.default_style,
      })),
      rules: rulesRes.rows.map((row) => ({
        from_element_key: row.from_element_key,
        to_element_key: row.to_element_key,
        connection_type_key: row.connection_type_key,
        allowed: Boolean(row.allowed),
      })),
    };
  }

  async createVersionFromCurrentState(diagramTypeId: string): Promise<DiagramTypeVersionEntity> {
    const snapshot = await this.buildVersionSnapshot(diagramTypeId);
    const nextRes = await this.pool.query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM diagram_type_versions WHERE diagram_type_id = $1',
      [diagramTypeId],
    );
    const versionId = uuidv4();
    const versionNumber = Number(nextRes.rows[0]?.next_version ?? 1);
    const res = await this.pool.query(
      `INSERT INTO diagram_type_versions (id, diagram_type_id, version_number, snapshot)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [versionId, diagramTypeId, versionNumber, JSON.stringify(snapshot)],
    );
    await this.pool.query('UPDATE diagram_types SET current_version_id = $1, updated_at = NOW() WHERE id = $2', [versionId, diagramTypeId]);
    return mapDiagramTypeVersionRow(res.rows[0]);
  }

  async ensureCurrentVersion(diagramTypeId: string): Promise<DiagramTypeVersionEntity> {
    const currentRes = await this.pool.query(
      `SELECT v.*
       FROM diagram_types dt
       JOIN diagram_type_versions v ON v.id = dt.current_version_id
       WHERE dt.id = $1`,
      [diagramTypeId],
    );
    if (currentRes.rows[0]) {
      return mapDiagramTypeVersionRow(currentRes.rows[0]);
    }

    const latestRes = await this.pool.query(
      `SELECT *
       FROM diagram_type_versions
       WHERE diagram_type_id = $1
       ORDER BY version_number DESC
       LIMIT 1`,
      [diagramTypeId],
    );
    if (latestRes.rows[0]) {
      await this.pool.query('UPDATE diagram_types SET current_version_id = $1 WHERE id = $2', [latestRes.rows[0].id, diagramTypeId]);
      return mapDiagramTypeVersionRow(latestRes.rows[0]);
    }

    return this.createVersionFromCurrentState(diagramTypeId);
  }

  async getVersionById(id: string): Promise<DiagramTypeVersionEntity | null> {
    const res = await this.pool.query('SELECT * FROM diagram_type_versions WHERE id = $1', [id]);
    return res.rows[0] ? mapDiagramTypeVersionRow(res.rows[0]) : null;
  }

  async pinDiagramToCurrentVersion(diagramId: string): Promise<DiagramTypeVersionEntity | null> {
    const diagramTypeId = await this.getDiagramTypeIdForDiagram(diagramId);
    if (!diagramTypeId) return null;
    const version = await this.ensureCurrentVersion(diagramTypeId);
    await this.pool.query('UPDATE diagrams SET diagram_type_version_id = $1 WHERE id = $2 AND diagram_type_version_id IS NULL', [
      version.id,
      diagramId,
    ]);
    return version;
  }

  async getDiagramTypeVersionStatusForDiagram(diagramId: string): Promise<DiagramTypeVersionStatus | null> {
    await this.pinDiagramToCurrentVersion(diagramId);
    const res = await this.pool.query(
      `SELECT d.diagram_type_id,
              cv.id AS current_version_id,
              cv.version_number AS current_version_number,
              lv.id AS latest_version_id,
              lv.version_number AS latest_version_number
       FROM diagrams d
       LEFT JOIN diagram_type_versions cv ON cv.id = d.diagram_type_version_id
       LEFT JOIN diagram_types dt ON dt.id = d.diagram_type_id
       LEFT JOIN diagram_type_versions lv ON lv.id = dt.current_version_id
       WHERE d.id = $1`,
      [diagramId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const currentVersionNumber = row.current_version_number === null ? null : Number(row.current_version_number);
    const latestVersionNumber = row.latest_version_number === null ? null : Number(row.latest_version_number);
    return {
      diagram_type_id: row.diagram_type_id,
      current_version_id: row.current_version_id,
      current_version_number: currentVersionNumber,
      latest_version_id: row.latest_version_id,
      latest_version_number: latestVersionNumber,
      has_update: Boolean(
        row.current_version_id &&
          row.latest_version_id &&
          row.current_version_id !== row.latest_version_id &&
          latestVersionNumber !== null &&
          currentVersionNumber !== null &&
          latestVersionNumber > currentVersionNumber,
      ),
    };
  }

  private isAllowedBySnapshot(
    snapshot: DiagramTypeVersionSnapshot,
    fromElementKey: string,
    toElementKey: string,
    connectionTypeKey: string,
  ): boolean {
    if (snapshot.diagram_type.is_free_mode) return true;
    const hasFrom = snapshot.element_types.some((item) => item.key === fromElementKey);
    const hasTo = snapshot.element_types.some((item) => item.key === toElementKey);
    const hasConnection = snapshot.connection_types.some((item) => item.key === connectionTypeKey);
    if (!hasFrom || !hasTo || !hasConnection) return false;
    const rule = snapshot.rules.find(
      (item) =>
        item.from_element_key === fromElementKey &&
        item.to_element_key === toElementKey &&
        item.connection_type_key === connectionTypeKey,
    );
    return rule ? rule.allowed : true;
  }

  async resolveRuleByKeysForDiagram(
    diagramId: string,
    fromElementKey: string,
    toElementKey: string,
    connectionTypeKey: string,
  ): Promise<boolean> {
    await this.pinDiagramToCurrentVersion(diagramId);
    const res = await this.pool.query(
      `SELECT v.snapshot
       FROM diagrams d
       JOIN diagram_type_versions v ON v.id = d.diagram_type_version_id
       WHERE d.id = $1`,
      [diagramId],
    );
    if (!res.rows[0]) return false;
    const snapshot = parseJson<DiagramTypeVersionSnapshot>(res.rows[0].snapshot, {
      diagram_type: { id: '', key: null, is_free_mode: false, metadata: {} },
      element_types: [],
      connection_types: [],
      rules: [],
    });
    return this.isAllowedBySnapshot(snapshot, fromElementKey, toElementKey, connectionTypeKey);
  }

  async validateDiagramAgainstVersion(diagramId: string, versionId: string): Promise<DiagramTypeUpgradeIssue[]> {
    const version = await this.getVersionById(versionId);
    if (!version) return [{ kind: 'unknown_element_type', message: 'Версия типа диаграммы не найдена' }];
    const snapshot = version.snapshot;
    if (snapshot.diagram_type.is_free_mode) return [];

    const blocksRes = await this.pool.query<{ id: string; type: string }>('SELECT id, type FROM diagram_blocks WHERE diagram_id = $1', [
      diagramId,
    ]);
    const connectionsRes = await this.pool.query<{
      id: string;
      from_block_id: string;
      to_block_id: string;
      type: string;
      from_type: string;
      to_type: string;
    }>(
      `SELECT c.id, c.from_block_id, c.to_block_id, c.type, fb.type AS from_type, tb.type AS to_type
       FROM diagram_connections c
       JOIN diagram_blocks fb ON fb.id = c.from_block_id
       JOIN diagram_blocks tb ON tb.id = c.to_block_id
       WHERE c.diagram_id = $1
       ORDER BY c.created_at ASC, c.id ASC`,
      [diagramId],
    );
    const elementKeys = new Set(snapshot.element_types.map((item) => item.key));
    const connectionKeys = new Set(snapshot.connection_types.map((item) => item.key));
    const issues: DiagramTypeUpgradeIssue[] = [];

    for (const block of blocksRes.rows) {
      if (!elementKeys.has(block.type)) {
        issues.push({
          kind: 'unknown_element_type',
          block_id: block.id,
          from_element_type: block.type,
          message: `Тип элемента ${block.type} отсутствует в новой версии`,
        });
      }
    }

    for (const connection of connectionsRes.rows) {
      if (!connectionKeys.has(connection.type)) {
        issues.push({
          kind: 'unknown_connection_type',
          connection_id: connection.id,
          connection_type: connection.type,
          message: `Тип связи ${connection.type} отсутствует в новой версии`,
        });
        continue;
      }
      if (!elementKeys.has(connection.from_type) || !elementKeys.has(connection.to_type)) {
        continue;
      }
      if (!this.isAllowedBySnapshot(snapshot, connection.from_type, connection.to_type, connection.type)) {
        issues.push({
          kind: 'connection_rule_violation',
          connection_id: connection.id,
          from_block_id: connection.from_block_id,
          to_block_id: connection.to_block_id,
          from_element_type: connection.from_type,
          to_element_type: connection.to_type,
          connection_type: connection.type,
          message: `Связь ${connection.type} между ${connection.from_type} и ${connection.to_type} запрещена в версии ${version.version_number}`,
        });
      }
    }

    return issues;
  }

  async updateDiagramTypeVersion(diagramId: string, versionId: string): Promise<void> {
    await this.pool.query('UPDATE diagrams SET diagram_type_version_id = $1, updated_at = NOW() WHERE id = $2', [versionId, diagramId]);
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
            allowed: connMap.get(ct.id) ?? true,
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

    return ruleRes.rows.length === 0 ? true : Boolean(ruleRes.rows[0]?.allowed);
  }

  async getDiagramTypeIdForDiagram(diagramId: string): Promise<string | null> {
    const res = await this.pool.query<{ diagram_type_id: string | null }>('SELECT diagram_type_id FROM diagrams WHERE id = $1', [diagramId]);
    return res.rows[0]?.diagram_type_id ?? null;
  }

  async recalculateRuleViolationsByDiagramType(diagramTypeId: string): Promise<void> {
    const diagramsRes = await this.pool.query<{ id: string }>('SELECT id FROM diagrams WHERE diagram_type_id = $1', [diagramTypeId]);
    for (const row of diagramsRes.rows) {
      await this.recalculateRuleViolationsByDiagram(row.id);
    }
  }

  async recalculateRuleViolationsByDiagram(diagramId: string): Promise<void> {
    await this.pinDiagramToCurrentVersion(diagramId);
    const versionRes = await this.pool.query(
      `SELECT v.snapshot
       FROM diagrams d
       JOIN diagram_type_versions v ON v.id = d.diagram_type_version_id
       WHERE d.id = $1`,
      [diagramId],
    );
    const snapshot = parseJson<DiagramTypeVersionSnapshot>(versionRes.rows[0]?.snapshot, {
      diagram_type: { id: '', key: null, is_free_mode: false, metadata: {} },
      element_types: [],
      connection_types: [],
      rules: [],
    });
    const connectionsRes = await this.pool.query<{
      id: string;
      type: string;
      from_type: string;
      to_type: string;
    }>(
      `SELECT c.id, c.type, fb.type AS from_type, tb.type AS to_type
       FROM diagram_connections c
       JOIN diagram_blocks fb ON fb.id = c.from_block_id
       JOIN diagram_blocks tb ON tb.id = c.to_block_id
       WHERE c.diagram_id = $1`,
      [diagramId],
    );

    for (const connection of connectionsRes.rows) {
      const allowed = this.isAllowedBySnapshot(snapshot, connection.from_type, connection.to_type, connection.type);
      await this.pool.query('UPDATE diagram_connections SET rule_violation = $1 WHERE id = $2', [!allowed, connection.id]);
    }
  }
}
