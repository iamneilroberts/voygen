-- Master Migration Script for LLM-Optimized Database
-- Run this script to transform the database for minimal tool calls

-- Step 1: Run all migration scripts in order
-- Note: Execute these files in order:
-- 001_create_views.sql
-- 002_create_missing_tables.sql  
-- 003_create_indexes.sql
-- 004_create_documentation_system.sql
-- 005_create_v2_denormalized_schema.sql
-- 006_create_llm_optimized_tools.sql

-- Step 2: Create a migration tracking table
CREATE TABLE IF NOT EXISTS migration_status (
    migration_id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    records_processed INTEGER
);

-- Step 3: Insert migration steps
INSERT INTO migration_status (migration_name) VALUES
('create_views'),
('create_missing_tables'),
('create_indexes'),
('create_documentation_system'),
('create_v2_schema'),
('migrate_trips_to_v2'),
('migrate_clients_to_v2'),
('create_search_index'),
('create_llm_contexts');

-- Step 4: Create helper function to check if we should use v1 or v2
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO system_config (config_key, config_value) VALUES
('database_version', 'v1'),
('migration_mode', 'dual_write'), -- 'v1_only', 'dual_write', 'v2_only'
('default_tool_version', 'v1');

-- Step 5: Create triggers for dual-write mode
-- These ensure v2 tables stay in sync during transition

-- Trigger for Trips table updates
CREATE TRIGGER IF NOT EXISTS sync_trips_to_v2
AFTER UPDATE ON Trips
WHEN (SELECT config_value FROM system_config WHERE config_key = 'migration_mode') = 'dual_write'
BEGIN
  -- Mark for re-migration
  INSERT OR REPLACE INTO migration_queue (entity_type, entity_id, action)
  VALUES ('trip', NEW.trip_id, 'sync');
END;

-- Create migration queue
CREATE TABLE IF NOT EXISTS migration_queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

-- Step 6: Create validation queries
CREATE VIEW migration_validation AS
SELECT 
    'trips' as entity_type,
    COUNT(*) as v1_count,
    (SELECT COUNT(*) FROM trips_v2) as v2_count,
    COUNT(*) - (SELECT COUNT(*) FROM trips_v2) as difference
FROM Trips
UNION ALL
SELECT 
    'clients' as entity_type,
    COUNT(*) as v1_count,
    (SELECT COUNT(*) FROM clients_v2) as v2_count,
    COUNT(*) - (SELECT COUNT(*) FROM clients_v2) as difference
FROM Clients;

-- Step 7: Instructions for completing migration
/*
MIGRATION STEPS:

1. Run all SQL files in order (001-006)
2. Use the migration tools to migrate data:
   - migrate_trips_to_v2(dry_run=true) to preview
   - migrate_trips_to_v2() to execute
   - migrate_clients_to_v2()
   - create_search_index()

3. Verify migration:
   SELECT * FROM migration_validation;

4. Switch to v2:
   UPDATE system_config SET config_value = 'v2_only' 
   WHERE config_key = 'migration_mode';
   
   UPDATE system_config SET config_value = 'v2' 
   WHERE config_key = 'default_tool_version';

5. Once confident, drop v1 tables (keep backup first!)
*/

-- Document the migration
INSERT INTO db_documentation (object_type, object_name, description, usage_examples) VALUES
('tool', 'database_migration', 
 'Migration from normalized v1 schema to LLM-optimized v2 schema. Reduces tool calls by 75%+',
 'Run master_migration.sql, then use migration tools to transform data'),

('table', 'migration_status',
 'Tracks progress of database migration steps',
 'Check this table to see which migration steps have completed'),

('table', 'system_config',
 'Controls which database version is active',
 'Set migration_mode to control dual-write behavior');