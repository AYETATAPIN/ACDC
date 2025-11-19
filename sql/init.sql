-- Schema initialization for ACDC backend

CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('class','use_case','free_mode')),
  svg_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams (created_at DESC);

-- Новая таблица для блоков диаграмм
CREATE TABLE IF NOT EXISTS diagram_blocks (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 100,
  height INTEGER NOT NULL DEFAULT 60,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Новая таблица для связей между блоками
CREATE TABLE IF NOT EXISTS diagram_connections (
  id UUID PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  from_block_id UUID NOT NULL REFERENCES diagram_blocks(id) ON DELETE CASCADE,
  to_block_id UUID NOT NULL REFERENCES diagram_blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagram_blocks_diagram_id ON diagram_blocks (diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_connections_diagram_id ON diagram_connections (diagram_id);
