-- Phase 2A: Query Logging Schema for FAQ Pattern Learning System
-- This migration adds tables for tracking all queries, failed queries, pattern candidates, and sessions

-- ============================================
-- Query logging table for all queries
-- ============================================
CREATE TABLE IF NOT EXISTS llm_query_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    query_lower TEXT NOT NULL, -- Lowercase for analysis
    matched_pattern TEXT, -- Which FAQ pattern matched (if any)
    was_cached BOOLEAN DEFAULT 0,
    cache_source TEXT, -- 'faq_cache', 'trip_context', 'partial_match', etc.
    result_count INTEGER,
    execution_time_ms INTEGER,
    total_tokens_used INTEGER,
    user_satisfaction TEXT, -- To be added later: 'helpful', 'not_helpful', null
    session_id TEXT,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analysis
CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON llm_query_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_log_cached ON llm_query_log(was_cached);
CREATE INDEX IF NOT EXISTS idx_query_log_pattern ON llm_query_log(matched_pattern);

-- ============================================
-- Failed queries for pattern analysis
-- ============================================
CREATE TABLE IF NOT EXISTS llm_failed_queries (
    query_text TEXT PRIMARY KEY,
    query_lower TEXT NOT NULL,
    failure_count INTEGER DEFAULT 1,
    first_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Analysis fields
    potential_pattern TEXT, -- Suggested pattern from analysis
    suggested_sql TEXT, -- Potential SQL query
    common_terms TEXT, -- Extracted keywords
    query_category TEXT, -- 'client', 'trip', 'commission', etc.
    
    -- Status
    review_status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'promoted', 'rejected'
    reviewed_by TEXT,
    review_notes TEXT
);

-- Indexes for failed queries
CREATE INDEX IF NOT EXISTS idx_failed_count ON llm_failed_queries(failure_count DESC);
CREATE INDEX IF NOT EXISTS idx_failed_status ON llm_failed_queries(review_status);

-- ============================================
-- Pattern candidates discovered from analysis
-- ============================================
CREATE TABLE IF NOT EXISTS llm_pattern_candidates (
    candidate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE,
    sql_template TEXT NOT NULL,
    answer_template TEXT NOT NULL,
    
    -- Discovery metadata
    discovered_from TEXT, -- 'manual', 'auto-analysis', 'user-suggestion'
    example_queries TEXT, -- JSON array of example queries
    match_count INTEGER DEFAULT 0,
    accuracy_score REAL, -- Percentage of successful matches
    
    -- Testing
    test_status TEXT DEFAULT 'pending', -- 'pending', 'testing', 'approved', 'rejected'
    test_results TEXT, -- JSON object with test data
    performance_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    promoted_at TIMESTAMP
);

-- Indexes for pattern candidates
CREATE INDEX IF NOT EXISTS idx_candidate_status ON llm_pattern_candidates(test_status);
CREATE INDEX IF NOT EXISTS idx_candidate_accuracy ON llm_pattern_candidates(accuracy_score DESC);

-- ============================================
-- Session tracking for context
-- ============================================
CREATE TABLE IF NOT EXISTS llm_query_sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    query_count INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    total_time_ms INTEGER DEFAULT 0,
    context_data TEXT -- JSON with session context
);

-- ============================================
-- Commission Analytics Views
-- ============================================

-- Monthly commission summary
CREATE VIEW IF NOT EXISTS commission_summary AS
SELECT 
    strftime('%Y-%m', start_date) as month,
    COUNT(*) as trip_count,
    COUNT(DISTINCT group_name) as unique_clients,
    SUM(json_extract(financials, '$.commission_amount')) as total_commission,
    AVG(json_extract(financials, '$.commission_rate')) as avg_commission_rate,
    SUM(total_cost) as total_revenue,
    MIN(json_extract(financials, '$.commission_rate')) as min_rate,
    MAX(json_extract(financials, '$.commission_rate')) as max_rate
FROM trips_v2
WHERE status = 'confirmed'
  AND json_extract(financials, '$.commission_amount') > 0
GROUP BY month
ORDER BY month DESC;

-- Commission by booking source
CREATE VIEW IF NOT EXISTS commission_by_source AS
SELECT 
    json_extract(financials, '$.booking_source') as booking_source,
    COUNT(*) as trip_count,
    SUM(json_extract(financials, '$.commission_amount')) as total_commission,
    AVG(json_extract(financials, '$.commission_rate')) as avg_rate,
    SUM(total_cost) as total_revenue
FROM trips_v2
WHERE status = 'confirmed'
  AND json_extract(financials, '$.commission_amount') > 0
GROUP BY booking_source
ORDER BY total_commission DESC;

-- Commission by client
CREATE VIEW IF NOT EXISTS commission_by_client AS
SELECT 
    group_name,
    primary_client_email,
    COUNT(*) as trip_count,
    SUM(json_extract(financials, '$.commission_amount')) as lifetime_commission,
    AVG(json_extract(financials, '$.commission_rate')) as avg_rate,
    SUM(total_cost) as lifetime_revenue,
    MIN(start_date) as first_trip,
    MAX(start_date) as last_trip
FROM trips_v2
WHERE status = 'confirmed'
GROUP BY group_name, primary_client_email
HAVING lifetime_commission > 0
ORDER BY lifetime_commission DESC;

-- Query pattern performance
CREATE VIEW IF NOT EXISTS pattern_performance AS
SELECT 
    matched_pattern,
    COUNT(*) as usage_count,
    AVG(execution_time_ms) as avg_time_ms,
    MIN(execution_time_ms) as min_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    SUM(CASE WHEN was_cached THEN 1 ELSE 0 END) as cache_hits,
    CAST(SUM(CASE WHEN was_cached THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as cache_hit_rate
FROM llm_query_log
WHERE matched_pattern IS NOT NULL
GROUP BY matched_pattern
ORDER BY usage_count DESC;

-- ============================================
-- Additional Performance Indexes
-- ============================================

-- Index for commission queries on trips_v2
CREATE INDEX IF NOT EXISTS idx_trips_v2_commission 
ON trips_v2(status, start_date) 
WHERE json_extract(financials, '$.commission_amount') > 0;

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_trips_v2_dates 
ON trips_v2(start_date, end_date);

-- Index for query log analysis
CREATE INDEX IF NOT EXISTS idx_query_log_analysis 
ON llm_query_log(query_lower, was_cached, timestamp);

-- ============================================
-- Configuration Table
-- ============================================

-- Configuration for pattern learning system
CREATE TABLE IF NOT EXISTS llm_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial configuration values
INSERT OR REPLACE INTO llm_config (config_key, config_value, description) VALUES
('pattern_promotion_threshold', '0.9', 'Minimum accuracy score for auto-promotion'),
('query_log_retention_days', '90', 'Days to keep query logs'),
('min_pattern_frequency', '5', 'Minimum occurrences before pattern consideration'),
('commission_calculation_method', 'from_financials_json', 'How to calculate commissions'),
('enable_query_logging', 'true', 'Enable/disable query logging'),
('enable_pattern_learning', 'false', 'Enable/disable automatic pattern learning'),
('max_failed_query_retries', '3', 'Maximum retries for failed queries'),
('pattern_test_sample_size', '10', 'Number of queries to test new patterns'),
('auto_cleanup_enabled', 'true', 'Enable automatic cleanup of old logs'),
('commission_default_rate', '10.0', 'Default commission rate if not specified');

-- ============================================
-- Rollback Script (commented out for safety)
-- ============================================
/*
-- To rollback this migration, uncomment and run:
DROP VIEW IF EXISTS pattern_performance;
DROP VIEW IF EXISTS commission_by_client;
DROP VIEW IF EXISTS commission_by_source;
DROP VIEW IF EXISTS commission_summary;
DROP TABLE IF EXISTS llm_config;
DROP TABLE IF EXISTS llm_query_sessions;
DROP TABLE IF EXISTS llm_pattern_candidates;
DROP TABLE IF EXISTS llm_failed_queries;
DROP TABLE IF EXISTS llm_query_log;
DROP INDEX IF EXISTS idx_query_log_analysis;
DROP INDEX IF EXISTS idx_trips_v2_dates;
DROP INDEX IF EXISTS idx_trips_v2_commission;
*/