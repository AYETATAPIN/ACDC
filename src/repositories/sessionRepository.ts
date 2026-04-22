import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { UserSession } from '../types.js';

const mapRow = (row: any): UserSession => ({
  id: row.id,
  user_id: row.user_id,
  token_hash: row.token_hash,
  expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  last_used_at: row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at,
});

export class SessionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(input: { token_hash: string; user_id: string; expires_at: Date }): Promise<UserSession> {
    const res = await this.pool.query(
      `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [uuidv4(), input.user_id, input.token_hash, input.expires_at],
    );
    return mapRow(res.rows[0]);
  }

  async getActiveByTokenHash(tokenHash: string): Promise<UserSession | null> {
    const res = await this.pool.query(
      `SELECT *
       FROM user_sessions
       WHERE token_hash = $1
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async touch(id: string, expiresAt: Date): Promise<void> {
    await this.pool.query('UPDATE user_sessions SET last_used_at = NOW(), expires_at = $2 WHERE id = $1', [id, expiresAt]);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpired(): Promise<void> {
    await this.pool.query('DELETE FROM user_sessions WHERE expires_at <= NOW()');
  }
}
