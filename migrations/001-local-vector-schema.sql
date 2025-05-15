-- Vector functionality migration for local SQLite
-- This creates a simplified version of the vectors table for local development

-- Create vectors table with BLOB support (standard SQLite doesn't support F32_BLOB)
CREATE TABLE IF NOT EXISTS vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  vector BLOB NOT NULL,  -- Using standard BLOB instead of F32_BLOB
  created_at INTEGER NOT NULL,
  metadata TEXT
);

-- Create indexes for optimized lookup
CREATE INDEX IF NOT EXISTS idx_vectors_content ON vectors(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);

-- Note: ANN index using libsql_vector_idx is not available in standard SQLite
-- This is only available in Turso/LibSQL