-- Fix Trip Facts Schema Issues
-- This script fixes critical data type mismatches and foreign key issues

-- Step 1: Drop existing trip_facts table (it's empty anyway)
DROP TABLE IF EXISTS trip_facts;

-- Step 2: Create corrected trip_facts table with proper INTEGER type and foreign key
CREATE TABLE trip_facts (
    trip_id INTEGER PRIMARY KEY,
    total_nights INTEGER DEFAULT 0,
    total_hotels INTEGER DEFAULT 0,
    total_activities INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    transit_minutes INTEGER DEFAULT 0,
    last_computed DATETIME,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
);

-- Step 3: Create a new facts_dirty table with INTEGER type
CREATE TABLE facts_dirty_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, reason, created_at),
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
);

-- Step 4: Insert valid trip_ids from facts_dirty (only those that are numeric and exist in trips_v2)
INSERT INTO facts_dirty_new (trip_id, reason, created_at)
SELECT CAST(fd.trip_id AS INTEGER) as trip_id, fd.reason, fd.created_at
FROM facts_dirty fd
INNER JOIN trips_v2 tv ON CAST(fd.trip_id AS INTEGER) = tv.trip_id
WHERE fd.trip_id GLOB '[0-9]*'  -- Only numeric values
AND CAST(fd.trip_id AS INTEGER) = CAST(fd.trip_id AS TEXT);  -- Ensure it's actually a number

-- Step 5: Handle trip names that were incorrectly stored as trip_id
-- Find trip_id for "Sara & Darren Jones 25th Anniversary - Bristol & Bath" and add to facts_dirty_new
INSERT INTO facts_dirty_new (trip_id, reason, created_at)
SELECT tv.trip_id, 'schema_migration_recovery', CURRENT_TIMESTAMP
FROM trips_v2 tv
WHERE tv.trip_name = 'Sara & Darren Jones 25th Anniversary - Bristol & Bath'
AND tv.trip_id NOT IN (SELECT trip_id FROM facts_dirty_new);

-- Step 6: Handle any other trip names that might be in facts_dirty
INSERT INTO facts_dirty_new (trip_id, reason, created_at)
SELECT tv.trip_id, 'schema_migration_recovery', CURRENT_TIMESTAMP  
FROM trips_v2 tv
INNER JOIN facts_dirty fd ON tv.trip_name = fd.trip_id
WHERE fd.trip_id NOT GLOB '[0-9]*'  -- Non-numeric values (trip names)
AND tv.trip_id NOT IN (SELECT trip_id FROM facts_dirty_new);

-- Step 7: Drop old facts_dirty and rename new one
DROP TABLE facts_dirty;
ALTER TABLE facts_dirty_new RENAME TO facts_dirty;

-- Step 8: Create index for better performance
CREATE INDEX idx_facts_dirty_trip_id ON facts_dirty(trip_id);
CREATE INDEX idx_trip_facts_computed ON trip_facts(last_computed);

-- Verification queries
SELECT 'trips_v2 count' as table_name, COUNT(*) as count FROM trips_v2
UNION ALL
SELECT 'facts_dirty count', COUNT(*) FROM facts_dirty
UNION ALL
SELECT 'trip_facts count', COUNT(*) FROM trip_facts;

-- Show corrected facts_dirty contents
SELECT fd.id, fd.trip_id, tv.trip_name, fd.reason, fd.created_at
FROM facts_dirty fd
LEFT JOIN trips_v2 tv ON fd.trip_id = tv.trip_id
ORDER BY fd.id;