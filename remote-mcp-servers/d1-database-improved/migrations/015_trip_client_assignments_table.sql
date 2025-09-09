-- 015_trip_client_assignments_table.sql
-- Purpose: Clean up broken city_airports view and add any missing trip_client_assignments components
-- Most components already exist in remote database, so this is mainly cleanup

-- Drop the broken city_airports view that references missing cities table
DROP VIEW IF EXISTS city_airports;

-- The trip_client_assignments table already exists, so we only need to ensure triggers exist

-- Create triggers for trip_client_assignments if they don't exist
-- These maintain dual-write compatibility between junction table and trips_v2.clients JSON

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_insert
AFTER INSERT ON trip_client_assignments
BEGIN
    -- Update the clients JSON field in trips_v2 to include this assignment
    UPDATE trips_v2 
    SET 
        clients = CASE
            WHEN clients = '[]' OR clients IS NULL THEN
                JSON_ARRAY(JSON_OBJECT(
                    'email', NEW.client_email,
                    'role', NEW.client_role,
                    'assigned_at', NEW.created_at
                ))
            ELSE
                JSON_INSERT(clients, '$[#]', JSON_OBJECT(
                    'email', NEW.client_email,
                    'role', NEW.client_role,
                    'assigned_at', NEW.created_at
                ))
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE trip_id = NEW.trip_id
    AND NOT EXISTS (
        SELECT 1 FROM JSON_EACH(clients) 
        WHERE JSON_EXTRACT(value, '$.email') = NEW.client_email
    );
END;

-- Trigger to remove client from JSON when removed from junction table
CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_delete
AFTER DELETE ON trip_client_assignments
BEGIN
    -- Remove the client from the clients JSON field
    UPDATE trips_v2 
    SET 
        clients = (
            SELECT JSON_GROUP_ARRAY(value) 
            FROM JSON_EACH(clients) 
            WHERE JSON_EXTRACT(value, '$.email') != OLD.client_email
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE trip_id = OLD.trip_id;
END;

-- Create a view to easily see trip-client relationships from both sources
CREATE VIEW IF NOT EXISTS trip_client_relationships AS
SELECT DISTINCT
    t.trip_id,
    t.trip_name,
    -- From normalized junction table
    tca.client_email as assigned_email,
    tca.client_role as assigned_role,
    tca.created_at as assigned_at,
    'junction_table' as source
FROM trips_v2 t
JOIN trip_client_assignments tca ON t.trip_id = tca.trip_id

UNION ALL

SELECT DISTINCT
    t.trip_id,
    t.trip_name,
    -- From denormalized JSON field
    JSON_EXTRACT(client.value, '$.email') as assigned_email,
    JSON_EXTRACT(client.value, '$.role') as assigned_role,
    JSON_EXTRACT(client.value, '$.assigned_at') as assigned_at,
    'json_field' as source
FROM trips_v2 t,
     JSON_EACH(t.clients) as client
WHERE JSON_EXTRACT(client.value, '$.email') IS NOT NULL;

-- Clean up any duplicate facts_dirty tables (facts_dirty_new exists but shouldn't)
DROP TABLE IF EXISTS facts_dirty_new;

-- Verification queries
SELECT 'city_airports view dropped' as status;
SELECT 'trip_client_assignments triggers ensured' as status;
SELECT 'Cleanup complete' as status, COUNT(*) as trigger_count FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_trip_client_%';