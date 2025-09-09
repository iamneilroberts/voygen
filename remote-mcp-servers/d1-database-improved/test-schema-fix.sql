-- Test script to validate the schema fix solution
-- This script tests both the junction table approach and JSON compatibility

-- 1. Test that trip_client_assignments table exists and has correct structure
SELECT 'Testing trip_client_assignments table structure...' as test_status;
SELECT 
    sql 
FROM sqlite_master 
WHERE type='table' AND name='trip_client_assignments';

-- 2. Test that facts_dirty has been fixed to use INTEGER trip_id
SELECT 'Testing facts_dirty table structure...' as test_status;
SELECT 
    sql 
FROM sqlite_master 
WHERE type='table' AND name='facts_dirty';

-- 3. Create a test trip to validate dual-write functionality
INSERT OR REPLACE INTO trips_v2 (
    trip_id, trip_name, start_date, end_date, destinations, status,
    clients, created_at, updated_at
) VALUES (
    9999, 'Test Schema Fix Trip', '2025-06-01', '2025-06-07', 'Test Destination', 'planning',
    '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- 4. Create a test client
INSERT OR REPLACE INTO clients_v2 (
    client_id, email, full_name, created_at, updated_at
) VALUES (
    9999, 'test@schemafix.com', 'Test Schema Client', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- 5. Test the dual-write assignment (junction table insertion should trigger JSON update)
INSERT OR REPLACE INTO trip_client_assignments (
    trip_id, client_email, client_role
) VALUES (
    9999, 'test@schemafix.com', 'primary_traveler'
);

-- 6. Verify both sources show the client assignment
SELECT 'Testing junction table assignment...' as test_status;
SELECT * FROM trip_client_assignments WHERE trip_id = 9999;

SELECT 'Testing JSON field was updated by trigger...' as test_status;
SELECT trip_id, trip_name, clients FROM trips_v2 WHERE trip_id = 9999;

-- 7. Test the unified view
SELECT 'Testing unified relationship view...' as test_status;
SELECT * FROM trip_client_relationships WHERE trip_id = 9999;

-- 8. Test facts_dirty INSERT OR IGNORE functionality
SELECT 'Testing facts_dirty constraint fix...' as test_status;
INSERT INTO facts_dirty (trip_id, reason) VALUES (9999, 'test_insert');
INSERT INTO facts_dirty (trip_id, reason) VALUES (9999, 'test_insert'); -- Should be ignored
INSERT INTO facts_dirty (trip_id, reason) VALUES (9999, 'test_update'); -- Should succeed

SELECT COUNT(*) as facts_dirty_count FROM facts_dirty WHERE trip_id = 9999;

-- 9. Test bulk operations would work (simulate the operation structure)
SELECT 'Testing bulk operation compatibility...' as test_status;
-- This simulates what bulk_trip_operations does
UPDATE trips_v2 
SET clients = JSON_INSERT(
    COALESCE(clients, '[]'), 
    '$[#]', 
    JSON_OBJECT(
        'email', 'bulk@test.com',
        'role', 'secondary_traveler',
        'assigned_at', CURRENT_TIMESTAMP
    )
) 
WHERE trip_id = 9999;

-- Verify the JSON was updated correctly
SELECT trip_id, JSON_PRETTY(clients) as formatted_clients FROM trips_v2 WHERE trip_id = 9999;

-- 10. Clean up test data
DELETE FROM trip_client_assignments WHERE trip_id = 9999;
DELETE FROM trips_v2 WHERE trip_id = 9999;
DELETE FROM clients_v2 WHERE client_id = 9999;
DELETE FROM facts_dirty WHERE trip_id = 9999;

SELECT 'Schema fix validation complete!' as final_status;