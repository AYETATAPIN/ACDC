import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { User } from '../types.js';

const mapRow = (row: any): User => ({
  id: row.id,
  email: row.email,
  password_hash: row.password_hash,
  display_name: row.display_name,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

export class UserRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getById(id: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async create(input: { email: string; password_hash: string; display_name?: string | null }): Promise<User> {
    const res = await this.pool.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [uuidv4(), input.email, input.password_hash, input.display_name ?? null],
    );
    return mapRow(res.rows[0]);
  }
}
