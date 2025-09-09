-- Fix facts_dirty data - convert trip names to trip_ids
-- This fixes the immediate data issue without changing schema

-- First, convert the "Sara & Darren Jones 25th Anniversary - Bristol & Bath" to trip_id 26
UPDATE facts_dirty 
SET trip_id = '26' 
WHERE trip_id = 'Sara & Darren Jones 25th Anniversary - Bristol & Bath';

-- Convert other trip names to their corresponding trip_ids if they exist
UPDATE facts_dirty 
SET trip_id = (
    SELECT CAST(tv.trip_id AS TEXT) 
    FROM trips_v2 tv 
    WHERE tv.trip_name = facts_dirty.trip_id
) 
WHERE trip_id NOT GLOB '[0-9]*' 
AND EXISTS (
    SELECT 1 FROM trips_v2 tv 
    WHERE tv.trip_name = facts_dirty.trip_id
);

-- Delete any facts_dirty records that still have non-numeric trip_ids 
-- (these would be orphaned records for non-existent trips)
DELETE FROM facts_dirty 
WHERE trip_id NOT GLOB '[0-9]*';

-- Show the cleaned up data
SELECT 'facts_dirty after cleanup' as status, COUNT(*) as count FROM facts_dirty;

SELECT fd.id, fd.trip_id, tv.trip_name, fd.reason 
FROM facts_dirty fd
LEFT JOIN trips_v2 tv ON CAST(fd.trip_id AS INTEGER) = tv.trip_id
ORDER BY fd.id;