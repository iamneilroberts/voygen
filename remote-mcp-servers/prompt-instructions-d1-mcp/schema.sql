-- Prompt Instructions D1 Database Schema
-- Create tables for dynamic instruction management

-- Main instruction sets table
CREATE TABLE IF NOT EXISTS instruction_sets (
    instruction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Instruction metadata and relationships
CREATE TABLE IF NOT EXISTS instruction_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    confidence_level TEXT,
    tags TEXT, -- JSON array of tags
    related_tasks TEXT, -- JSON array of related task names
    priority INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    FOREIGN KEY (set_id) REFERENCES instruction_sets(instruction_id) ON DELETE CASCADE
);

-- Confidence level mappings for dynamic instruction loading
CREATE TABLE IF NOT EXISTS confidence_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confidence_level TEXT NOT NULL,
    instruction_names TEXT NOT NULL, -- JSON array of instruction names
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Instruction usage analytics (optional)
CREATE TABLE IF NOT EXISTS instruction_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_name TEXT NOT NULL,
    access_type TEXT NOT NULL, -- 'read', 'create', 'update'
    user_context TEXT, -- JSON with session/user info
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_instruction_sets_name ON instruction_sets(name);
CREATE INDEX IF NOT EXISTS idx_instruction_sets_category ON instruction_sets(category);
CREATE INDEX IF NOT EXISTS idx_instruction_sets_active ON instruction_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_metadata_set_id ON instruction_metadata(set_id);
CREATE INDEX IF NOT EXISTS idx_metadata_confidence ON instruction_metadata(confidence_level);
CREATE INDEX IF NOT EXISTS idx_confidence_level ON confidence_mappings(confidence_level);
CREATE INDEX IF NOT EXISTS idx_access_log_name ON instruction_access_log(instruction_name);
CREATE INDEX IF NOT EXISTS idx_access_log_time ON instruction_access_log(accessed_at);

-- Insert default confidence level mappings
INSERT OR REPLACE INTO confidence_mappings (confidence_level, instruction_names, description) VALUES
('high', '["three-tier-pricing", "budget_optimization", "advanced_search"]', 'Advanced techniques for experienced users'),
('medium', '["trip_discovery", "destination_selection", "hotel_selection"]', 'Specific techniques for common tasks'),
('low', '["workflows", "trip_discovery", "cpmaxx_search", "daily_planning"]', 'Comprehensive step-by-step workflows'),
('error', '["error_recovery", "troubleshooting", "workflows"]', 'Error handling and recovery procedures');