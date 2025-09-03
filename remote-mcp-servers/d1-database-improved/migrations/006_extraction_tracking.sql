-- 006_extraction_tracking.sql
-- Purpose: Track content extraction sessions and attempts

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS extraction_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  status TEXT DEFAULT 'running', -- running, success, failed
  stats_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_extraction_sessions_status ON extraction_sessions(status);
CREATE INDEX IF NOT EXISTS idx_extraction_sessions_time ON extraction_sessions(started_at);

CREATE TABLE IF NOT EXISTS extraction_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  item_key TEXT NOT NULL, -- URL or external id
  status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
  error TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  attempts_count INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES extraction_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_extraction_attempts_session ON extraction_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_extraction_attempts_status ON extraction_attempts(status);
CREATE INDEX IF NOT EXISTS idx_extraction_attempts_item ON extraction_attempts(item_key);

COMMIT;

