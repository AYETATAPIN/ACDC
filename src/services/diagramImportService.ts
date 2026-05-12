import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../catalog/builtins.js';
import { HttpError } from '../middleware/errorHandler.js';
import type {
  AcdcDiagramFileV1,
  ConnectionRulesMatrix,
  Diagram,
  DiagramBlock,
  DiagramConnection,
  DiagramImportInput,
  DiagramImportResult,
  DiagramSnapshot,
  Point,
} from '../types.js';

type DiagramRow = {
  id: string;
  name: string;
  type: string;
  diagram_type_id: string;
  diagram_type_version_id?: string | null;
  owner_user_id: string | null;
  svg_data: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type TypeResolution = {
  diagramTypeId: string;
  diagramTypeVersionId: string;
  elementTypeIdByImportedId: Map<string, string>;
  connectionTypeIdByImportedId: Map<string, string>;
  elementTypeIdByKey: Map<string, string>;
  connectionTypeIdByKey: Map<string, string>;
};

const toIso = (value: string | Date | undefined | null): string =>
  value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : new Date().toISOString();

const parseJsonObject = (value: unknown): Record<string, any> => {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
};

const parsePoints = (value: unknown): Point[] => {
  const raw = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(raw)) return [];
  return raw.map((point) => ({
    x: Number((point as any)?.x) || 0,
    y: Number((point as any)?.y) || 0,
  }));
};

const mapDiagramRow = (row: DiagramRow): Diagram => ({
  id: row.id,
  name: row.name,
  type: row.type as Diagram['type'],
  diagram_type_id: row.diagram_type_id,
  diagram_type_version_id: row.diagram_type_version_id,
  owner_user_id: row.owner_user_id,
  svg_data: row.svg_data,
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
});

const mapBlockRow = (row: any): DiagramBlock => ({
  id: row.id,
  diagram_id: row.diagram_id,
  element_type_id: row.element_type_id,
  type: row.type,
  x: Number(row.x ?? 0),
  y: Number(row.y ?? 0),
  width: Number(row.width ?? 0),
  height: Number(row.height ?? 0),
  properties: parseJsonObject(row.properties),
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
});

const mapConnectionRow = (row: any): DiagramConnection => ({
  id: row.id,
  diagram_id: row.diagram_id,
  from_block_id: row.from_block_id,
  to_block_id: row.to_block_id,
  connection_type_id: row.connection_type_id,
  type: row.type,
  points: parsePoints(row.points),
  label: row.label,
  properties: parseJsonObject(row.properties),
  rule_violation: Boolean(row.rule_violation),
  created_at: toIso(row.created_at),
});

const isBuiltinKey = (value: unknown): value is keyof typeof BUILTIN_DIAGRAM_TYPE_IDS =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(BUILTIN_DIAGRAM_TYPE_IDS, value);

export class DiagramImportService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async importDiagram(ownerUserId: string, input: DiagramImportInput): Promise<DiagramImportResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const resolution = await this.resolveDiagramType(client, ownerUserId, input.file);
      const diagramId = input.mode === 'replace'
        ? await this.prepareReplace(client, ownerUserId, input.target_diagram_id!)
        : uuidv4();

      const diagramRow = await this.upsertDiagram(client, ownerUserId, diagramId, input, resolution);
      await this.insertBlocksAndConnections(client, diagramId, input.file, resolution);
      await this.recalculateRuleViolations(client, diagramId);
      const snapshot = await this.buildSnapshot(client, diagramRow.id);
      const version = await this.recordImportedSnapshot(client, diagramId, snapshot);

      await client.query('COMMIT');
      return { id: diagramId, mode: input.mode, version };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async resolveDiagramType(client: PoolClient, ownerUserId: string, file: AcdcDiagramFileV1): Promise<TypeResolution> {
    const bundle = file.diagram_type_bundle;
    const importedType = bundle.diagram_type;
    const typeKey = importedType.key ?? file.diagram.type;

    if (importedType.is_builtin && isBuiltinKey(typeKey)) {
      return this.resolveBuiltinDiagramType(client, typeKey, bundle.element_types, bundle.connection_types);
    }

    return this.cloneImportedDiagramType(client, ownerUserId, file);
  }

  private async resolveBuiltinDiagramType(
    client: PoolClient,
    typeKey: keyof typeof BUILTIN_DIAGRAM_TYPE_IDS,
    importedElements: AcdcDiagramFileV1['diagram_type_bundle']['element_types'],
    importedConnections: AcdcDiagramFileV1['diagram_type_bundle']['connection_types'],
  ): Promise<TypeResolution> {
    const diagramTypeId = BUILTIN_DIAGRAM_TYPE_IDS[typeKey];
    const versionRes = await client.query<{ current_version_id: string | null }>('SELECT current_version_id FROM diagram_types WHERE id = $1', [
      diagramTypeId,
    ]);
    const diagramTypeVersionId = versionRes.rows[0]?.current_version_id;
    if (!diagramTypeVersionId) throw new HttpError(400, 'Diagram type version not found');
    const elementRes = await client.query<{ id: string; key: string }>('SELECT id, key FROM element_types WHERE diagram_type_id = $1', [
      diagramTypeId,
    ]);
    const connectionRes = await client.query<{ id: string; key: string }>('SELECT id, key FROM connection_types WHERE diagram_type_id = $1', [
      diagramTypeId,
    ]);

    const elementTypeIdByKey = new Map(elementRes.rows.map((row) => [row.key, row.id]));
    const connectionTypeIdByKey = new Map(connectionRes.rows.map((row) => [row.key, row.id]));
    const elementTypeIdByImportedId = new Map<string, string>();
    const connectionTypeIdByImportedId = new Map<string, string>();

    for (const item of importedElements) {
      const resolved = elementTypeIdByKey.get(item.key);
      if (resolved) elementTypeIdByImportedId.set(item.id, resolved);
    }

    for (const item of importedConnections) {
      const resolved = connectionTypeIdByKey.get(item.key);
      if (resolved) connectionTypeIdByImportedId.set(item.id, resolved);
    }

    return { diagramTypeId, diagramTypeVersionId, elementTypeIdByImportedId, connectionTypeIdByImportedId, elementTypeIdByKey, connectionTypeIdByKey };
  }

  private async cloneImportedDiagramType(client: PoolClient, ownerUserId: string, file: AcdcDiagramFileV1): Promise<TypeResolution> {
    const bundle = file.diagram_type_bundle;
    const importedType = bundle.diagram_type;
    const diagramTypeId = uuidv4();
    const metadata = {
      ...parseJsonObject(importedType.metadata),
      importedFrom: importedType.id ?? null,
      importedAt: new Date().toISOString(),
      originalKey: importedType.key ?? null,
    };

    await client.query(
      `INSERT INTO diagram_types (id, key, name, description, is_builtin, is_free_mode, clone_source_id, owner_user_id, metadata)
       VALUES ($1, NULL, $2, $3, FALSE, $4, NULL, $5, $6)`,
      [
        diagramTypeId,
        importedType.name || `${file.diagram.name} type`,
        importedType.description ?? null,
        Boolean(importedType.is_free_mode),
        ownerUserId,
        JSON.stringify(metadata),
      ],
    );

    const elementTypeIdByImportedId = new Map<string, string>();
    const connectionTypeIdByImportedId = new Map<string, string>();
    const elementTypeIdByKey = new Map<string, string>();
    const connectionTypeIdByKey = new Map<string, string>();

    for (const item of bundle.element_types) {
      const id = uuidv4();
      elementTypeIdByImportedId.set(item.id, id);
      elementTypeIdByKey.set(item.key, id);
      await client.query(
        `INSERT INTO element_types (
          id, diagram_type_id, key, name, shape, svg_path, default_style, default_size, ports, field_schema, is_builtin
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)`,
        [
          id,
          diagramTypeId,
          item.key,
          item.name,
          item.shape ?? 'rect',
          item.svg_path ?? null,
          JSON.stringify(parseJsonObject(item.default_style)),
          JSON.stringify(item.default_size ?? { width: 120, height: 60 }),
          JSON.stringify(Array.isArray(item.ports) ? item.ports : []),
          JSON.stringify(Array.isArray(item.field_schema) ? item.field_schema : []),
        ],
      );
    }

    for (const item of bundle.connection_types) {
      const id = uuidv4();
      connectionTypeIdByImportedId.set(item.id, id);
      connectionTypeIdByKey.set(item.key, id);
      await client.query(
        `INSERT INTO connection_types (
          id, diagram_type_id, key, name, color, dash, arrow_start, arrow_end, directed, default_style, is_builtin
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)`,
        [
          id,
          diagramTypeId,
          item.key,
          item.name,
          item.color ?? '#34495e',
          item.dash ?? '',
          item.arrow_start ?? 'none',
          item.arrow_end ?? 'arrow',
          item.directed ?? true,
          JSON.stringify(parseJsonObject(item.default_style)),
        ],
      );
    }

    await this.insertImportedRules(client, diagramTypeId, bundle.rules_matrix, elementTypeIdByImportedId, connectionTypeIdByImportedId);
    const diagramTypeVersionId = await this.createDiagramTypeVersion(client, diagramTypeId);

    return { diagramTypeId, diagramTypeVersionId, elementTypeIdByImportedId, connectionTypeIdByImportedId, elementTypeIdByKey, connectionTypeIdByKey };
  }

  private async createDiagramTypeVersion(client: PoolClient, diagramTypeId: string): Promise<string> {
    const snapshot = await this.buildDiagramTypeVersionSnapshot(client, diagramTypeId);
    const versionId = uuidv4();
    await client.query(
      `INSERT INTO diagram_type_versions (id, diagram_type_id, version_number, snapshot)
       VALUES ($1, $2, 1, $3)`,
      [versionId, diagramTypeId, JSON.stringify(snapshot)],
    );
    await client.query('UPDATE diagram_types SET current_version_id = $1 WHERE id = $2', [versionId, diagramTypeId]);
    return versionId;
  }

  private async buildDiagramTypeVersionSnapshot(client: PoolClient, diagramTypeId: string): Promise<Record<string, any>> {
    const typeRes = await client.query('SELECT id, key, is_free_mode, metadata FROM diagram_types WHERE id = $1', [diagramTypeId]);
    const elementsRes = await client.query(
      `SELECT id, key, name, shape, svg_path, default_style, default_size, ports, field_schema
       FROM element_types
       WHERE diagram_type_id = $1
       ORDER BY created_at ASC`,
      [diagramTypeId],
    );
    const connectionsRes = await client.query(
      `SELECT id, key, name, color, dash, arrow_start, arrow_end, directed, default_style
       FROM connection_types
       WHERE diagram_type_id = $1
       ORDER BY created_at ASC`,
      [diagramTypeId],
    );
    const rulesRes = await client.query(
      `SELECT fe.key AS from_element_key,
              te.key AS to_element_key,
              ct.key AS connection_type_key,
              r.allowed
       FROM connection_rules r
       JOIN element_types fe ON fe.id = r.from_element_type_id
       JOIN element_types te ON te.id = r.to_element_type_id
       JOIN connection_types ct ON ct.id = r.connection_type_id
       WHERE r.diagram_type_id = $1`,
      [diagramTypeId],
    );
    const type = typeRes.rows[0];
    return {
      diagram_type: {
        id: type.id,
        key: type.key,
        is_free_mode: Boolean(type.is_free_mode),
        metadata: parseJsonObject(type.metadata),
      },
      element_types: elementsRes.rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        shape: row.shape,
        svg_path: row.svg_path,
        default_style: parseJsonObject(row.default_style),
        default_size: typeof row.default_size === 'object' ? row.default_size : parseJsonObject(row.default_size),
        ports: Array.isArray(row.ports) ? row.ports : [],
        field_schema: Array.isArray(row.field_schema) ? row.field_schema : [],
      })),
      connection_types: connectionsRes.rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        color: row.color,
        dash: row.dash,
        arrow_start: row.arrow_start,
        arrow_end: row.arrow_end,
        directed: Boolean(row.directed),
        default_style: parseJsonObject(row.default_style),
      })),
      rules: rulesRes.rows.map((row) => ({
        from_element_key: row.from_element_key,
        to_element_key: row.to_element_key,
        connection_type_key: row.connection_type_key,
        allowed: Boolean(row.allowed),
      })),
    };
  }

  private async insertImportedRules(
    client: PoolClient,
    diagramTypeId: string,
    matrix: ConnectionRulesMatrix,
    elementTypeIdByImportedId: Map<string, string>,
    connectionTypeIdByImportedId: Map<string, string>,
  ): Promise<void> {
    for (const cell of matrix.cells || []) {
      const fromId = elementTypeIdByImportedId.get(cell.from_element_type_id);
      const toId = elementTypeIdByImportedId.get(cell.to_element_type_id);
      if (!fromId || !toId) continue;

      for (const rule of cell.rules || []) {
        const connectionTypeId = connectionTypeIdByImportedId.get(rule.connection_type_id);
        if (!connectionTypeId) continue;
        await client.query(
          `INSERT INTO connection_rules (
            id, diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id, allowed
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id)
          DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
          [uuidv4(), diagramTypeId, fromId, toId, connectionTypeId, Boolean(rule.allowed)],
        );
      }
    }
  }

  private async prepareReplace(client: PoolClient, ownerUserId: string, diagramId: string): Promise<string> {
    const existing = await client.query('SELECT id FROM diagrams WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [diagramId, ownerUserId]);
    if (existing.rows.length === 0) {
      throw new HttpError(404, 'Diagram not found');
    }

    await client.query('DELETE FROM diagram_connections WHERE diagram_id = $1', [diagramId]);
    await client.query('DELETE FROM diagram_blocks WHERE diagram_id = $1', [diagramId]);
    await client.query('DELETE FROM diagram_history WHERE diagram_id = $1', [diagramId]);
    await client.query('UPDATE diagrams SET current_version = 0 WHERE id = $1', [diagramId]);
    return diagramId;
  }

  private async upsertDiagram(
    client: PoolClient,
    ownerUserId: string,
    diagramId: string,
    input: DiagramImportInput,
    resolution: TypeResolution,
  ): Promise<Diagram> {
    const file = input.file;
    if (input.mode === 'create') {
      const res = await client.query<DiagramRow>(
        `INSERT INTO diagrams (id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, current_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
         RETURNING id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at`,
        [
          diagramId,
          file.diagram.name.trim(),
          file.diagram.type,
          resolution.diagramTypeId,
          resolution.diagramTypeVersionId,
          ownerUserId,
          file.diagram.svg_data || '<svg/>',
        ],
      );
      return mapDiagramRow(res.rows[0]);
    }

    const res = await client.query<DiagramRow>(
      `UPDATE diagrams
       SET name = $1,
           type = $2,
           diagram_type_id = $3,
           diagram_type_version_id = $4,
           svg_data = $5,
           updated_at = NOW(),
           current_version = 0
       WHERE id = $6 AND owner_user_id = $7
       RETURNING id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at`,
      [
        file.diagram.name.trim(),
        file.diagram.type,
        resolution.diagramTypeId,
        resolution.diagramTypeVersionId,
        file.diagram.svg_data || '<svg/>',
        diagramId,
        ownerUserId,
      ],
    );
    if (res.rows.length === 0) throw new HttpError(404, 'Diagram not found');
    return mapDiagramRow(res.rows[0]);
  }

  private async insertBlocksAndConnections(
    client: PoolClient,
    diagramId: string,
    file: AcdcDiagramFileV1,
    resolution: TypeResolution,
  ): Promise<void> {
    const blockIdMap = new Map<string, string>();

    for (const block of file.blocks) {
      const id = uuidv4();
      blockIdMap.set(block.id, id);
      const elementTypeId =
        (block.element_type_id ? resolution.elementTypeIdByImportedId.get(block.element_type_id) : undefined) ??
        resolution.elementTypeIdByKey.get(block.type) ??
        null;

      await client.query(
        `INSERT INTO diagram_blocks (id, diagram_id, element_type_id, type, x, y, width, height, properties)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          diagramId,
          elementTypeId,
          block.type,
          Number(block.x) || 0,
          Number(block.y) || 0,
          Number(block.width) || 100,
          Number(block.height) || 60,
          JSON.stringify(parseJsonObject(block.properties)),
        ],
      );
    }

    for (const connection of file.connections) {
      const fromBlockId = blockIdMap.get(connection.from_block_id);
      const toBlockId = blockIdMap.get(connection.to_block_id);
      if (!fromBlockId || !toBlockId) {
        throw new HttpError(400, 'Connection references an unknown block');
      }

      const connectionTypeId =
        (connection.connection_type_id ? resolution.connectionTypeIdByImportedId.get(connection.connection_type_id) : undefined) ??
        resolution.connectionTypeIdByKey.get(connection.type) ??
        null;

      await client.query(
        `INSERT INTO diagram_connections (
          id, diagram_id, from_block_id, to_block_id, connection_type_id, type, points, label, properties, rule_violation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          diagramId,
          fromBlockId,
          toBlockId,
          connectionTypeId,
          connection.type,
          JSON.stringify(connection.points ?? []),
          connection.label || null,
          JSON.stringify(parseJsonObject(connection.properties)),
          Boolean(connection.rule_violation),
        ],
      );
    }
  }

  private async recalculateRuleViolations(client: PoolClient, diagramId: string): Promise<void> {
    await client.query(
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

  private async buildSnapshot(client: PoolClient, diagramId: string): Promise<DiagramSnapshot> {
    const diagramRes = await client.query<DiagramRow>(
      `SELECT id, name, type, diagram_type_id, diagram_type_version_id, owner_user_id, svg_data, created_at, updated_at
       FROM diagrams
       WHERE id = $1`,
      [diagramId],
    );
    if (diagramRes.rows.length === 0) throw new HttpError(404, 'Diagram not found');

    const blocksRes = await client.query(
      `SELECT id, diagram_id, element_type_id, type, x, y, width, height, properties, created_at, updated_at
       FROM diagram_blocks
       WHERE diagram_id = $1
       ORDER BY created_at`,
      [diagramId],
    );
    const connectionsRes = await client.query(
      `SELECT id, diagram_id, from_block_id, to_block_id, connection_type_id, type, points, label, properties, rule_violation, created_at
       FROM diagram_connections
       WHERE diagram_id = $1
       ORDER BY created_at`,
      [diagramId],
    );

    return {
      diagram: mapDiagramRow(diagramRes.rows[0]),
      blocks: blocksRes.rows.map(mapBlockRow),
      connections: connectionsRes.rows.map(mapConnectionRow),
    };
  }

  private async recordImportedSnapshot(client: PoolClient, diagramId: string, snapshot: DiagramSnapshot): Promise<number> {
    const version = 1;
    await client.query('INSERT INTO diagram_history (id, diagram_id, version, state) VALUES ($1, $2, $3, $4)', [
      uuidv4(),
      diagramId,
      version,
      snapshot,
    ]);
    await client.query('UPDATE diagrams SET current_version = $1 WHERE id = $2', [version, diagramId]);
    return version;
  }
}
