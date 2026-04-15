-- Stage 2 schema migration

ALTER TABLE diagrams DROP CONSTRAINT IF EXISTS diagrams_type_check;
ALTER TABLE diagrams
  ADD CONSTRAINT diagrams_type_check CHECK (type IN ('class','use_case','activity_diagram','free_mode'));

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagram_types (
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
);

ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS diagram_type_id UUID;
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE diagrams ALTER COLUMN diagram_type_id SET DEFAULT '00000000-0000-0000-0000-000000000101';

UPDATE diagrams
SET diagram_type_id = CASE type
  WHEN 'class' THEN '00000000-0000-0000-0000-000000000101'::uuid
  WHEN 'use_case' THEN '00000000-0000-0000-0000-000000000102'::uuid
  WHEN 'activity_diagram' THEN '00000000-0000-0000-0000-000000000103'::uuid
  WHEN 'free_mode' THEN '00000000-0000-0000-0000-000000000104'::uuid
  ELSE '00000000-0000-0000-0000-000000000101'::uuid
END
WHERE diagram_type_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_diagram_type_id_fkey') THEN
    ALTER TABLE diagrams
      ADD CONSTRAINT diagrams_diagram_type_id_fkey
      FOREIGN KEY (diagram_type_id) REFERENCES diagram_types(id) ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_owner_user_id_fkey') THEN
    ALTER TABLE diagrams
      ADD CONSTRAINT diagrams_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS element_types (
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
);

CREATE TABLE IF NOT EXISTS connection_types (
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
);

CREATE TABLE IF NOT EXISTS connection_rules (
  id UUID PRIMARY KEY,
  diagram_type_id UUID NOT NULL REFERENCES diagram_types(id) ON DELETE CASCADE,
  from_element_type_id UUID NOT NULL REFERENCES element_types(id) ON DELETE CASCADE,
  to_element_type_id UUID NOT NULL REFERENCES element_types(id) ON DELETE CASCADE,
  connection_type_id UUID NOT NULL REFERENCES connection_types(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagram_type_id, from_element_type_id, to_element_type_id, connection_type_id)
);

ALTER TABLE diagram_blocks ADD COLUMN IF NOT EXISTS element_type_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_blocks_element_type_id_fkey') THEN
    ALTER TABLE diagram_blocks
      ADD CONSTRAINT diagram_blocks_element_type_id_fkey
      FOREIGN KEY (element_type_id) REFERENCES element_types(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE diagram_connections ADD COLUMN IF NOT EXISTS connection_type_id UUID;
ALTER TABLE diagram_connections ADD COLUMN IF NOT EXISTS rule_violation BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_connections_connection_type_id_fkey') THEN
    ALTER TABLE diagram_connections
      ADD CONSTRAINT diagram_connections_connection_type_id_fkey
      FOREIGN KEY (connection_type_id) REFERENCES connection_types(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('snapshot', 'live')),
  token_hash TEXT NOT NULL UNIQUE,
  snapshot_version INTEGER,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
