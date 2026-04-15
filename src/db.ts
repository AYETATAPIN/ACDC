import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import {
  BUILTIN_DIAGRAM_TYPES,
  BUILTIN_DIAGRAM_TYPE_IDS,
  isBuiltinRuleAllowed,
  type BuiltinDiagramTypeKey,
} from './catalog/builtins.js';

let pool: Pool;

const ELEMENT_META: Record<string, { shape: string; color: string; border: string; textColor: string; width: number; height: number }> = {
  class: { shape: 'rect', color: '#3498db', border: '#2d83be', textColor: '#ffffff', width: 140, height: 80 },
  interface: { shape: 'rect', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 140, height: 80 },
  enum: { shape: 'rect', color: '#e67e22', border: '#d35400', textColor: '#ffffff', width: 140, height: 80 },
  component: { shape: 'rect', color: '#16a085', border: '#13856f', textColor: '#ffffff', width: 150, height: 90 },
  database: { shape: 'cylinder', color: '#34495e', border: '#2c3e50', textColor: '#ecf0f1', width: 150, height: 90 },
  note: { shape: 'rect', color: '#fff7d6', border: '#f1c40f', textColor: '#2c3e50', width: 160, height: 100 },
  package: { shape: 'rect', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 180, height: 100 },
  actor: { shape: 'actor', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 60, height: 100 },
  usecase: { shape: 'ellipse', color: '#f97316', border: '#ea580c', textColor: '#ffffff', width: 160, height: 90 },
  initial: { shape: 'circle', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 40, height: 40 },
  final: { shape: 'double-circle', color: '#e74c3c', border: '#c0392b', textColor: '#ffffff', width: 40, height: 40 },
  activity: { shape: 'roundrect', color: '#3498db', border: '#2980b9', textColor: '#ffffff', width: 120, height: 60 },
  decision: { shape: 'diamond', color: '#f39c12', border: '#d68910', textColor: '#ffffff', width: 80, height: 80 },
  merge: { shape: 'diamond', color: '#95a5a6', border: '#7f8c8d', textColor: '#ffffff', width: 80, height: 80 },
  fork: { shape: 'rect', color: '#2c3e50', border: '#2c3e50', textColor: '#ffffff', width: 100, height: 40 },
  join: { shape: 'rect', color: '#2c3e50', border: '#2c3e50', textColor: '#ffffff', width: 100, height: 40 },
  send_signal: { shape: 'pentagon', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 100, height: 60 },
  receive_signal: { shape: 'pentagon', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 100, height: 60 },
};

const CONNECTION_META: Record<
  string,
  {
    color: string;
    dash: string;
    arrowStart: 'none' | 'arrow' | 'empty_arrow' | 'filled_diamond' | 'empty_diamond';
    arrowEnd: 'none' | 'arrow' | 'empty_arrow' | 'filled_diamond' | 'empty_diamond';
    directed: boolean;
  }
> = {
  association: { color: '#34495e', dash: '', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
  dependency: { color: '#7f8c8d', dash: '6 4', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
  inheritance: { color: '#8e44ad', dash: '10 6', arrowStart: 'none', arrowEnd: 'empty_arrow', directed: true },
  composition: { color: '#27ae60', dash: '', arrowStart: 'none', arrowEnd: 'filled_diamond', directed: true },
  realization: { color: '#9b59b6', dash: '10 6', arrowStart: 'none', arrowEnd: 'empty_arrow', directed: true },
  aggregation: { color: '#e67e22', dash: '', arrowStart: 'none', arrowEnd: 'empty_diamond', directed: true },
  extend: { color: '#c0392b', dash: '4 4', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
  include: { color: '#3498db', dash: '4 4', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
  control_flow: { color: '#2c3e50', dash: '', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
  object_flow: { color: '#e67e22', dash: '6 4', arrowStart: 'none', arrowEnd: 'arrow', directed: true },
};

const toLabel = (key: string): string =>
  key
    .split('_')
    .map((part) => (part.length > 1 ? part[0].toUpperCase() + part.slice(1) : part.toUpperCase()))
    .join(' ');

export const getPool = (): Pool => {
  if (pool) return pool;

  if (config.db.url) {
    pool = new Pool({ connectionString: config.db.url, ssl: config.db.ssl });
  } else {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      ssl: config.db.ssl,
    });
  }
  return pool;
};

const runSchemaMigrations = async (p: Pool): Promise<void> => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS diagram_types (
      id UUID PRIMARY KEY,
      key TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
      is_free_mode BOOLEAN NOT NULL DEFAULT FALSE,
      clone_source_id UUID REFERENCES diagram_types(id) ON DELETE SET NULL,
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `ALTER TABLE diagrams DROP CONSTRAINT IF EXISTS diagrams_type_check`,
    `ALTER TABLE diagrams ADD CONSTRAINT diagrams_type_check CHECK (type IN ('class','use_case','free_mode','activity_diagram'))`,
    `ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS diagram_type_id UUID`,
    `ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS owner_user_id UUID`,

    `DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_diagram_type_id_fkey') THEN
          ALTER TABLE diagrams ADD CONSTRAINT diagrams_diagram_type_id_fkey
          FOREIGN KEY (diagram_type_id) REFERENCES diagram_types(id) ON DELETE RESTRICT;
        END IF;
      END
    $$`,

    `DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_owner_user_id_fkey') THEN
          ALTER TABLE diagrams ADD CONSTRAINT diagrams_owner_user_id_fkey
          FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END
    $$`,

    `CREATE TABLE IF NOT EXISTS element_types (
      id UUID PRIMARY KEY,
      diagram_type_id UUID NOT NULL REFERENCES diagram_types(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      shape TEXT NOT NULL DEFAULT 'rect',
      svg_path TEXT,
      default_style JSONB NOT NULL DEFAULT '{}',
      default_size JSONB NOT NULL DEFAULT '{"width":120,"height":60}',
      ports JSONB NOT NULL DEFAULT '[]',
      field_schema JSONB NOT NULL DEFAULT '[]',
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(diagram_type_id, key)
    )`,

    `CREATE TABLE IF NOT EXISTS connection_types (
      id UUID PRIMARY KEY,
      diagram_type_id UUID NOT NULL REFERENCES diagram_types(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#34495e',
      dash TEXT NOT NULL DEFAULT '',
      arrow_start TEXT NOT NULL DEFAULT 'none',
      arrow_end TEXT NOT NULL DEFAULT 'arrow',
      directed BOOLEAN NOT NULL DEFAULT TRUE,
      default_style JSONB NOT NULL DEFAULT '{}',
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(diagram_type_id, key)
    )`,

    `CREATE TABLE IF NOT EXISTS connection_rules (
      id UUID PRIMARY KEY,
      diagram_type_id UUID NOT NULL REFERENCES diagram_types(id) ON DELETE CASCADE,
      from_element_type_id UUID NOT NULL REFERENCES element_types(id) ON DELETE CASCADE,
      to_element_type_id UUID NOT NULL REFERENCES element_types(id) ON DELETE CASCADE,
      connection_type_id UUID NOT NULL REFERENCES connection_types(id) ON DELETE CASCADE,
      allowed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id)
    )`,

    `ALTER TABLE diagram_blocks ADD COLUMN IF NOT EXISTS element_type_id UUID`,

    `DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_blocks_element_type_id_fkey') THEN
          ALTER TABLE diagram_blocks ADD CONSTRAINT diagram_blocks_element_type_id_fkey
          FOREIGN KEY (element_type_id) REFERENCES element_types(id) ON DELETE SET NULL;
        END IF;
      END
    $$`,

    `ALTER TABLE diagram_connections ADD COLUMN IF NOT EXISTS connection_type_id UUID`,
    `ALTER TABLE diagram_connections ADD COLUMN IF NOT EXISTS rule_violation BOOLEAN NOT NULL DEFAULT FALSE`,

    `DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_connections_connection_type_id_fkey') THEN
          ALTER TABLE diagram_connections ADD CONSTRAINT diagram_connections_connection_type_id_fkey
          FOREIGN KEY (connection_type_id) REFERENCES connection_types(id) ON DELETE SET NULL;
        END IF;
      END
    $$`,

    `CREATE TABLE IF NOT EXISTS share_tokens (
      id UUID PRIMARY KEY,
      diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('snapshot', 'live')),
      token_hash TEXT NOT NULL UNIQUE,
      snapshot_version INTEGER,
      revoked_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_diagram_types_owner ON diagram_types(owner_user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_element_types_diagram_type ON element_types(diagram_type_id)`,
    `CREATE INDEX IF NOT EXISTS idx_connection_types_diagram_type ON connection_types(diagram_type_id)`,
    `CREATE INDEX IF NOT EXISTS idx_connection_rules_diagram_type ON connection_rules(diagram_type_id)`,
    `CREATE INDEX IF NOT EXISTS idx_diagrams_diagram_type ON diagrams(diagram_type_id)`,
    `CREATE INDEX IF NOT EXISTS idx_share_tokens_diagram ON share_tokens(diagram_id)`,
  ];

  for (const sql of statements) {
    await p.query(sql);
  }
};

const seedBuiltins = async (p: Pool): Promise<void> => {
  for (const item of BUILTIN_DIAGRAM_TYPES) {
    await p.query(
      `INSERT INTO diagram_types (id, key, name, description, is_builtin, is_free_mode, metadata)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET key = EXCLUDED.key,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_free_mode = EXCLUDED.is_free_mode`,
      [item.id, item.key, item.name, item.description, item.is_free_mode, JSON.stringify({ seeded: true })],
    );
  }

  await p.query(
    `UPDATE diagrams
     SET diagram_type_id = CASE type
       WHEN 'class' THEN $1::uuid
       WHEN 'use_case' THEN $2::uuid
       WHEN 'activity_diagram' THEN $3::uuid
       WHEN 'free_mode' THEN $4::uuid
       ELSE $1::uuid
     END
     WHERE diagram_type_id IS NULL`,
    [
      BUILTIN_DIAGRAM_TYPE_IDS.class,
      BUILTIN_DIAGRAM_TYPE_IDS.use_case,
      BUILTIN_DIAGRAM_TYPE_IDS.activity_diagram,
      BUILTIN_DIAGRAM_TYPE_IDS.free_mode,
    ],
  );

  await p.query(`ALTER TABLE diagrams ALTER COLUMN diagram_type_id SET DEFAULT '${BUILTIN_DIAGRAM_TYPE_IDS.class}'`);

  for (const diagramType of BUILTIN_DIAGRAM_TYPES) {
    for (const key of diagramType.elements) {
      const meta = ELEMENT_META[key] ?? {
        shape: 'rect',
        color: '#95a5a6',
        border: '#2c3e50',
        textColor: '#ffffff',
        width: 120,
        height: 60,
      };
      await p.query(
        `INSERT INTO element_types (
          id,
          diagram_type_id,
          key,
          name,
          shape,
          default_style,
          default_size,
          ports,
          field_schema,
          is_builtin
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', '[]', TRUE)
        ON CONFLICT (diagram_type_id, key) DO NOTHING`,
        [
          uuidv4(),
          diagramType.id,
          key,
          toLabel(key),
          meta.shape,
          JSON.stringify({ color: meta.color, border: meta.border, textColor: meta.textColor }),
          JSON.stringify({ width: meta.width, height: meta.height }),
        ],
      );
    }

    for (const key of diagramType.connections) {
      const meta = CONNECTION_META[key] ?? {
        color: '#34495e',
        dash: '',
        arrowStart: 'none' as const,
        arrowEnd: 'arrow' as const,
        directed: true,
      };
      await p.query(
        `INSERT INTO connection_types (
          id,
          diagram_type_id,
          key,
          name,
          color,
          dash,
          arrow_start,
          arrow_end,
          directed,
          default_style,
          is_builtin
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}', TRUE)
        ON CONFLICT (diagram_type_id, key) DO NOTHING`,
        [
          uuidv4(),
          diagramType.id,
          key,
          toLabel(key),
          meta.color,
          meta.dash,
          meta.arrowStart,
          meta.arrowEnd,
          meta.directed,
        ],
      );
    }

    const elementsRes = await p.query<{ id: string; key: string }>(
      'SELECT id, key FROM element_types WHERE diagram_type_id = $1',
      [diagramType.id],
    );
    const connectionsRes = await p.query<{ id: string; key: string }>(
      'SELECT id, key FROM connection_types WHERE diagram_type_id = $1',
      [diagramType.id],
    );

    const elementByKey = new Map(elementsRes.rows.map((row) => [row.key, row.id]));
    const connectionByKey = new Map(connectionsRes.rows.map((row) => [row.key, row.id]));
    const diagramKey = diagramType.key as BuiltinDiagramTypeKey;

    for (const fromKey of diagramType.elements) {
      for (const toKey of diagramType.elements) {
        const fromId = elementByKey.get(fromKey);
        const toId = elementByKey.get(toKey);
        if (!fromId || !toId) continue;

        for (const connectionKey of diagramType.connections) {
          const connectionId = connectionByKey.get(connectionKey);
          if (!connectionId) continue;
          const allowed = isBuiltinRuleAllowed(diagramKey, fromKey, toKey, connectionKey);

          await p.query(
            `INSERT INTO connection_rules (
              id,
              diagram_type_id,
              from_element_type_id,
              to_element_type_id,
              connection_type_id,
              allowed
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id) DO NOTHING`,
            [uuidv4(), diagramType.id, fromId, toId, connectionId, allowed],
          );
        }
      }
    }
  }
};

export const initDb = async (): Promise<void> => {
  const p = getPool();
  await p.query('SELECT 1');
  await runSchemaMigrations(p);
  await seedBuiltins(p);
};

