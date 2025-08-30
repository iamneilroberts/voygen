-- Migration 003: Add instruction versioning support
-- This migration adds version tracking for instruction sets

-- 1. Create instruction_versions table to store historical versions
CREATE TABLE IF NOT EXISTS instruction_versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    version INTEGER NOT NULL,
    version_tag TEXT, -- 'stable', 'draft', 'deprecated'
    change_summary TEXT,
    changed_by TEXT, -- session_id or user identifier
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_major_version BOOLEAN DEFAULT 0,
    parent_version_id INTEGER,
    FOREIGN KEY (instruction_id) REFERENCES instruction_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_version_id) REFERENCES instruction_versions(version_id)
);

-- 2. Create instruction_changelog table for detailed change tracking
CREATE TABLE IF NOT EXISTS instruction_changelog (
    changelog_id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_id INTEGER NOT NULL,
    version_id INTEGER,
    action TEXT NOT NULL, -- 'created', 'updated', 'restored', 'deleted'
    field_changed TEXT, -- specific field that changed
    old_value TEXT,
    new_value TEXT,
    change_description TEXT,
    changed_by TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    FOREIGN KEY (instruction_id) REFERENCES instruction_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES instruction_versions(version_id)
);

-- 3. Add new columns to instruction_sets table
ALTER TABLE instruction_sets ADD COLUMN version_count INTEGER DEFAULT 1;
ALTER TABLE instruction_sets ADD COLUMN last_major_version INTEGER DEFAULT 1;
ALTER TABLE instruction_sets ADD COLUMN change_summary TEXT;
ALTER TABLE instruction_sets ADD COLUMN version_tag TEXT DEFAULT 'stable';
ALTER TABLE instruction_sets ADD COLUMN last_changed_by TEXT;
ALTER TABLE instruction_sets ADD COLUMN auto_archive BOOLEAN DEFAULT 1;
ALTER TABLE instruction_sets ADD COLUMN max_versions INTEGER DEFAULT 10;

-- 4. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_instruction_versions_instruction_id ON instruction_versions(instruction_id);
CREATE INDEX IF NOT EXISTS idx_instruction_versions_name ON instruction_versions(name);
CREATE INDEX IF NOT EXISTS idx_instruction_versions_created_at ON instruction_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_instruction_changelog_instruction_id ON instruction_changelog(instruction_id);
CREATE INDEX IF NOT EXISTS idx_instruction_changelog_changed_at ON instruction_changelog(changed_at);

-- 5. Create a view for easy access to version history
CREATE VIEW IF NOT EXISTS instruction_version_history AS
SELECT 
    iv.version_id,
    iv.instruction_id,
    iv.name,
    iv.title,
    iv.version,
    iv.version_tag,
    iv.change_summary,
    iv.changed_by,
    iv.created_at,
    iv.is_major_version,
    i.name as current_name,
    i.version as current_version
FROM instruction_versions iv
JOIN instruction_sets i ON iv.instruction_id = i.id
ORDER BY iv.instruction_id, iv.version DESC;

-- 6. Archive existing instructions as version 1
INSERT INTO instruction_versions (
    instruction_id,
    name,
    title,
    content,
    category,
    version,
    version_tag,
    change_summary,
    created_at,
    is_major_version
)
SELECT 
    id,
    name,
    title,
    content,
    category,
    version,
    'stable',
    'Initial version (migrated)',
    created_at,
    1
FROM instruction_sets
WHERE active = 1;

-- 7. Log the migration in changelog
INSERT INTO instruction_changelog (
    instruction_id,
    action,
    change_description,
    changed_by,
    changed_at
)
SELECT 
    id,
    'created',
    'Initial version archived during migration',
    'migration_003',
    CURRENT_TIMESTAMP
FROM instruction_sets
WHERE active = 1;