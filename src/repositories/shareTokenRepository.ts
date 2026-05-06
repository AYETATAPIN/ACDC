import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { Diagram, SharePermission, ShareToken } from '../types.js';

type ShareTokenRow = ShareToken & {
  diagram_name?: string;
  diagram_type?: Diagram['type'];
  diagram_diagram_type_id?: string;
  diagram_owner_user_id?: string | null;
  diagram_svg_data?: string;
  diagram_created_at?: string | Date;
  diagram_updated_at?: string | Date;
};

export type ShareTokenWithDiagram = {
  token: ShareToken;
  diagram: Diagram;
};

export type OwnerShareStatus = Pick<
  ShareToken,
  'id' | 'diagram_id' | 'permission' | 'mode' | 'revoked_at' | 'expires_at' | 'created_by_user_id' | 'created_at'
>;

const toIso = (value: string | Date | null | undefined): string | null | undefined => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

const mapTokenRow = (row: ShareTokenRow): ShareToken => ({
  id: row.id,
  diagram_id: row.diagram_id,
  permission: row.permission,
  mode: row.mode,
  token_hash: row.token_hash,
  snapshot_version: row.snapshot_version ?? null,
  revoked_at: toIso(row.revoked_at) ?? null,
  expires_at: toIso(row.expires_at) ?? null,
  created_by_user_id: row.created_by_user_id ?? null,
  created_at: toIso(row.created_at) ?? new Date().toISOString(),
});

const mapDiagramFromJoinedRow = (row: ShareTokenRow): Diagram => ({
  id: row.diagram_id,
  name: row.diagram_name ?? '',
  type: row.diagram_type as Diagram['type'],
  diagram_type_id: row.diagram_diagram_type_id ?? '',
  owner_user_id: row.diagram_owner_user_id ?? null,
  svg_data: row.diagram_svg_data ?? '',
  created_at: toIso(row.diagram_created_at) ?? new Date().toISOString(),
  updated_at: toIso(row.diagram_updated_at) ?? new Date().toISOString(),
});

export class ShareTokenRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findActiveByHash(tokenHash: string): Promise<ShareTokenWithDiagram | null> {
    const res = await this.pool.query<ShareTokenRow>(
      `SELECT
         s.*,
         d.name AS diagram_name,
         d.type AS diagram_type,
         d.diagram_type_id AS diagram_diagram_type_id,
         d.owner_user_id AS diagram_owner_user_id,
         d.svg_data AS diagram_svg_data,
         d.created_at AS diagram_created_at,
         d.updated_at AS diagram_updated_at
       FROM share_tokens s
       JOIN diagrams d ON d.id = s.diagram_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.mode = 'live'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       LIMIT 1`,
      [tokenHash],
    );

    const row = res.rows[0];
    if (!row) return null;
    return {
      token: mapTokenRow(row),
      diagram: mapDiagramFromJoinedRow(row),
    };
  }

  async findActiveByDiagramAndPermission(diagramId: string, permission: SharePermission): Promise<ShareToken | null> {
    const res = await this.pool.query<ShareTokenRow>(
      `SELECT *
       FROM share_tokens
       WHERE diagram_id = $1
         AND permission = $2
         AND mode = 'live'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [diagramId, permission],
    );
    return res.rows[0] ? mapTokenRow(res.rows[0]) : null;
  }

  async listActiveForDiagram(diagramId: string): Promise<OwnerShareStatus[]> {
    const res = await this.pool.query<ShareTokenRow>(
      `SELECT *
       FROM share_tokens
       WHERE diagram_id = $1
         AND mode = 'live'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY permission ASC, created_at DESC`,
      [diagramId],
    );

    return res.rows.map((row) => {
      const token = mapTokenRow(row);
      return {
        id: token.id,
        diagram_id: token.diagram_id,
        permission: token.permission,
        mode: token.mode,
        revoked_at: token.revoked_at,
        expires_at: token.expires_at,
        created_by_user_id: token.created_by_user_id,
        created_at: token.created_at,
      };
    });
  }

  async create(input: {
    diagramId: string;
    permission: SharePermission;
    tokenHash: string;
    createdByUserId: string;
  }): Promise<ShareToken> {
    const res = await this.pool.query<ShareTokenRow>(
      `INSERT INTO share_tokens (id, diagram_id, permission, mode, token_hash, created_by_user_id)
       VALUES ($1, $2, $3, 'live', $4, $5)
       RETURNING *`,
      [uuidv4(), input.diagramId, input.permission, input.tokenHash, input.createdByUserId],
    );
    return mapTokenRow(res.rows[0]);
  }

  async revokeActiveForDiagramAndPermission(diagramId: string, permission: SharePermission): Promise<void> {
    await this.pool.query(
      `UPDATE share_tokens
       SET revoked_at = NOW()
       WHERE diagram_id = $1
         AND permission = $2
         AND mode = 'live'
         AND revoked_at IS NULL`,
      [diagramId, permission],
    );
  }
}
