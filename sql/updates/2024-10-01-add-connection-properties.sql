-- Add properties column for connection styles
ALTER TABLE diagram_connections
  ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}';
