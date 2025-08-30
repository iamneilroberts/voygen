-- Create db_errors table for tracking database access issues
-- This helps identify missing tools and schema documentation needs

CREATE TABLE IF NOT EXISTS db_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    attempted_operation TEXT NOT NULL,
    error_message TEXT NOT NULL,
    sql_query TEXT,
    table_names TEXT,
    column_names TEXT,
    suggested_tool TEXT,
    context TEXT,
    resolved BOOLEAN DEFAULT 0,
    resolution TEXT,
    session_id TEXT,
    mcp_server TEXT DEFAULT 'd1-database-improved'
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_db_errors_timestamp ON db_errors(error_timestamp);
CREATE INDEX IF NOT EXISTS idx_db_errors_operation ON db_errors(attempted_operation);
CREATE INDEX IF NOT EXISTS idx_db_errors_resolved ON db_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_db_errors_session ON db_errors(session_id);

-- View for recent unresolved errors
CREATE VIEW IF NOT EXISTS recent_unresolved_errors AS
SELECT 
    id,
    error_timestamp,
    attempted_operation,
    error_message,
    suggested_tool,
    COUNT(*) OVER (PARTITION BY attempted_operation) as occurrence_count
FROM db_errors
WHERE resolved = 0 
    AND error_timestamp > datetime('now', '-7 days')
ORDER BY error_timestamp DESC;

-- View for error summary by operation
CREATE VIEW IF NOT EXISTS error_summary_by_operation AS
SELECT 
    attempted_operation,
    COUNT(*) as total_errors,
    COUNT(DISTINCT session_id) as affected_sessions,
    MAX(error_timestamp) as last_occurrence,
    COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved_count,
    GROUP_CONCAT(DISTINCT suggested_tool) as suggested_tools
FROM db_errors
WHERE error_timestamp > datetime('now', '-30 days')
GROUP BY attempted_operation
ORDER BY total_errors DESC;