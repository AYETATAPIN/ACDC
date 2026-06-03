import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { DiagramTypeEntity, DiagramTypeShareGrant, DiagramTypeShareToken } from '../types.js';

type DiagramTypeShareTokenRow = DiagramTypeShareToken & {
  type_id?: string;
  type_key?: string | null;
  type_name?: string;
  type_description?: string | null;
  type_is_builtin?: boolean;
  type_is_free_mode?: boolean;
  type_clone_source_id?: string | null;
  type_owner_user_id?: string | null;
  type_metadata?: Record<string, any> | string | null;
  type_current_version_id?: string | null;
  type_created_at?: string | Date;
  type_updated_at?: string | Date;
};

export type DiagramTypeShareStatus = Pick<
  DiagramTypeShareToken,
  'id' | 'diagram_type_id' | 'permission' | 'mode' | 'revoked_at' | 'expires_at' | 'created_by_user_id' | 'created_at'
>;

export type DiagramTypeShareWithType = {
  token: DiagramTypeShareToken;
  diagramType: DiagramTypeEntity;
};

const toIso = (value: string | Date | null | undefined): string | null | undefined => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

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

const mapTokenRow = (row: DiagramTypeShareTokenRow): DiagramTypeShareToken => ({
  id: row.id,
  diagram_type_id: row.diagram_type_id,
  permission: row.permission,
  mode: row.mode,
  token_hash: row.token_hash,
  revoked_at: toIso(row.revoked_at) ?? null,
  expires_at: toIso(row.expires_at) ?? null,
  created_by_user_id: row.created_by_user_id ?? null,
  created_at: toIso(row.created_at) ?? new Date().toISOString(),
});

const mapTypeFromJoinedRow = (row: DiagramTypeShareTokenRow): DiagramTypeEntity => ({
  id: row.type_id ?? row.diagram_type_id,
  key: row.type_key ?? null,
  name: row.type_name ?? '',
  description: row.type_description ?? null,
  is_builtin: Boolean(row.type_is_builtin),
  is_free_mode: Boolean(row.type_is_free_mode),
  clone_source_id: row.type_clone_source_id ?? null,
  owner_user_id: row.type_owner_user_id ?? null,
  metadata: parseJson<Record<string, any>>(row.type_metadata, {}),
  current_version_id: row.type_current_version_id ?? null,
  created_at: toIso(row.type_created_at) ?? new Date().toISOString(),
  updated_at: toIso(row.type_updated_at) ?? new Date().toISOString(),
});

export class DiagramTypeShareRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findActiveByHash(tokenHash: string): Promise<DiagramTypeShareWithType | null> {
    const res = await this.pool.query<DiagramTypeShareTokenRow>(
      `SELECT
         s.*,
         dt.id AS type_id,
         dt.key AS type_key,
         dt.name AS type_name,
         dt.description AS type_description,
         dt.is_builtin AS type_is_builtin,
         dt.is_free_mode AS type_is_free_mode,
         dt.clone_source_id AS type_clone_source_id,
         dt.owner_user_id AS type_owner_user_id,
         dt.metadata AS type_metadata,
         dt.current_version_id AS type_current_version_id,
         dt.created_at AS type_created_at,
         dt.updated_at AS type_updated_at
       FROM diagram_type_share_tokens s
       JOIN diagram_types dt ON dt.id = s.diagram_type_id
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
      diagramType: mapTypeFromJoinedRow(row),
    };
  }

  async findActiveByTypeAndPermission(diagramTypeId: string, permission: 'read'): Promise<DiagramTypeShareToken | null> {
    const res = await this.pool.query<DiagramTypeShareTokenRow>(
      `SELECT *
       FROM diagram_type_share_tokens
       WHERE diagram_type_id = $1
         AND permission = $2
         AND mode = 'live'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [diagramTypeId, permission],
    );
    return res.rows[0] ? mapTokenRow(res.rows[0]) : null;
  }

  async listActiveForType(diagramTypeId: string): Promise<DiagramTypeShareStatus[]> {
    const res = await this.pool.query<DiagramTypeShareTokenRow>(
      `SELECT *
       FROM diagram_type_share_tokens
       WHERE diagram_type_id = $1
         AND mode = 'live'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY permission ASC, created_at DESC`,
      [diagramTypeId],
    );

    return res.rows.map((row) => {
      const token = mapTokenRow(row);
      return {
        id: token.id,
        diagram_type_id: token.diagram_type_id,
        permission: token.permission,
        mode: token.mode,
        revoked_at: token.revoked_at,
        expires_at: token.expires_at,
        created_by_user_id: token.created_by_user_id,
        created_at: token.created_at,
      };
    });
  }

  async create(input: { diagramTypeId: string; permission: 'read'; tokenHash: string; createdByUserId: string }): Promise<DiagramTypeShareToken> {
    const res = await this.pool.query<DiagramTypeShareTokenRow>(
      `INSERT INTO diagram_type_share_tokens (id, diagram_type_id, permission, mode, token_hash, created_by_user_id)
       VALUES ($1, $2, $3, 'live', $4, $5)
       RETURNING *`,
      [uuidv4(), input.diagramTypeId, input.permission, input.tokenHash, input.createdByUserId],
    );
    return mapTokenRow(res.rows[0]);
  }

  async revokeActiveForTypeAndPermission(diagramTypeId: string, permission: 'read'): Promise<void> {
    await this.pool.query(
      `UPDATE diagram_type_share_tokens
       SET revoked_at = NOW()
       WHERE diagram_type_id = $1
         AND permission = $2
         AND mode = 'live'
         AND revoked_at IS NULL`,
      [diagramTypeId, permission],
    );
  }

  async grantAccess(input: { diagramTypeId: string; userId: string; tokenId: string }): Promise<DiagramTypeShareGrant> {
    const res = await this.pool.query(
      `INSERT INTO diagram_type_share_grants (id, diagram_type_id, user_id, created_from_token_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (diagram_type_id, user_id)
       DO UPDATE SET created_from_token_id = COALESCE(diagram_type_share_grants.created_from_token_id, EXCLUDED.created_from_token_id)
       RETURNING *`,
      [uuidv4(), input.diagramTypeId, input.userId, input.tokenId],
    );
    const row = res.rows[0];
    return {
      id: row.id,
      diagram_type_id: row.diagram_type_id,
      user_id: row.user_id,
      created_from_token_id: row.created_from_token_id ?? null,
      created_at: toIso(row.created_at) ?? new Date().toISOString(),
    };
  }
}
