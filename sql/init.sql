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

