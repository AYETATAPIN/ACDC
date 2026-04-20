-- Schema initialization for ACDC backend (Stage 2)

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

INSERT INTO diagram_types (id, key, name, description, is_builtin, is_free_mode, metadata)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'class', 'Class Diagram', 'UML class diagram', TRUE, FALSE, '{"seeded":true}'),
  ('00000000-0000-0000-0000-000000000102', 'use_case', 'Use Case Diagram', 'UML use case diagram', TRUE, FALSE, '{"seeded":true}'),
  ('00000000-0000-0000-0000-000000000103', 'activity_diagram', 'Activity Diagram', 'UML activity diagram', TRUE, FALSE, '{"seeded":true}'),
  ('00000000-0000-0000-0000-000000000104', 'free_mode', 'Free Mode', 'No restrictions', TRUE, TRUE, '{"seeded":true}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('class','use_case','activity_diagram','free_mode')),
  diagram_type_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000101' REFERENCES diagram_types(id) ON DELETE RESTRICT,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  svg_data TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagrams_diagram_type_id ON diagrams (diagram_type_id);

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

CREATE INDEX IF NOT EXISTS idx_element_types_diagram_type_id ON element_types (diagram_type_id);

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

CREATE INDEX IF NOT EXISTS idx_connection_types_diagram_type_id ON connection_types (diagram_type_id);

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

CREATE INDEX IF NOT EXISTS idx_connection_rules_diagram_type_id ON connection_rules (diagram_type_id);

CREATE TABLE IF NOT EXISTS diagram_blocks (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  element_type_id UUID REFERENCES element_types(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 100,
  height NUMERIC NOT NULL DEFAULT 60,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagram_blocks_diagram_id ON diagram_blocks (diagram_id);

CREATE TABLE IF NOT EXISTS diagram_connections (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  from_block_id UUID NOT NULL REFERENCES diagram_blocks(id) ON DELETE CASCADE,
  to_block_id UUID NOT NULL REFERENCES diagram_blocks(id) ON DELETE CASCADE,
  connection_type_id UUID REFERENCES connection_types(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]',
  properties JSONB NOT NULL DEFAULT '{}',
  label TEXT,
  rule_violation BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagram_connections_diagram_id ON diagram_connections (diagram_id);

CREATE TABLE IF NOT EXISTS diagram_history (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagram_id, version)
);

CREATE INDEX IF NOT EXISTS idx_diagram_history_diagram_version ON diagram_history (diagram_id, version);

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

CREATE INDEX IF NOT EXISTS idx_share_tokens_diagram_id ON share_tokens (diagram_id);
