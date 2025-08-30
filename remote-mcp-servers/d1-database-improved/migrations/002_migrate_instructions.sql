-- Migration: Consolidate instruction tables from prompt-instructions-d1-db to travel_assistant
-- Date: 2025-07-28

-- Step 1: Drop the old instruction_sets table with wrong schema
DROP TABLE IF EXISTS instruction_sets;

-- Step 2: Create the correct instruction_sets table matching prompt-instructions-d1-db
CREATE TABLE IF NOT EXISTS instruction_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_instruction_name ON instruction_sets(name);
CREATE INDEX IF NOT EXISTS idx_instruction_category ON instruction_sets(category);
CREATE INDEX IF NOT EXISTS idx_instruction_active ON instruction_sets(active);

-- Step 4: Create commission_config table
CREATE TABLE IF NOT EXISTS commission_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create instruction_metadata table
CREATE TABLE IF NOT EXISTS instruction_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_id INTEGER NOT NULL,
    meta_key TEXT NOT NULL,
    meta_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instruction_id) REFERENCES instruction_sets(id) ON DELETE CASCADE,
    UNIQUE(instruction_id, meta_key)
);

-- Step 6: Create confidence_mappings table
CREATE TABLE IF NOT EXISTS confidence_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confidence_level TEXT NOT NULL UNIQUE,
    instruction_names TEXT NOT NULL, -- JSON array
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 7: Create instruction_access_log table
CREATE TABLE IF NOT EXISTS instruction_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_id INTEGER,
    instruction_name TEXT,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    context TEXT, -- JSON
    FOREIGN KEY (instruction_id) REFERENCES instruction_sets(id) ON DELETE SET NULL
);

-- Note: The actual data will be inserted via the application after this migration runs