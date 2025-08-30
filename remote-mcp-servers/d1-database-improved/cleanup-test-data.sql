-- Database cleanup script for Sara/Sarah test records
-- IMPORTANT: This preserves the legitimate "Sara & Darren Jones 25th Anniversary - Bristol & Bath" trip

-- First, let's see what we have
SELECT 'BEFORE CLEANUP - Trips:' as info;
SELECT trip_id, trip_name, status, start_date, end_date 
FROM trips_v2 
WHERE trip_name LIKE '%Sara%' OR trip_name LIKE '%Sarah%'
ORDER BY trip_name;

SELECT 'BEFORE CLEANUP - Clients:' as info;
SELECT client_id, email, full_name 
FROM clients_v2 
WHERE full_name LIKE '%Sara%' OR full_name LIKE '%Sarah%'
ORDER BY full_name;

-- Remove Sarah & Michael test trips (but keep Sara & Darren Jones legitimate trip)
DELETE FROM trips_v2 
WHERE trip_name LIKE '%Sarah & Michael%';

-- Clean up related context records for these trips
DELETE FROM llm_trip_context 
WHERE natural_key LIKE '%Sarah & Michael%';

-- Remove test clients that are clearly not the legitimate Sara Jones
DELETE FROM clients_v2 
WHERE (full_name LIKE '%Sarah%' OR email LIKE '%sarah%') 
  AND full_name NOT LIKE '%Sara & Darren%' 
  AND email NOT LIKE '%jones%'
  AND full_name NOT LIKE '%Sara Jones%';

-- Show what remains after cleanup
SELECT 'AFTER CLEANUP - Trips:' as info;
SELECT trip_id, trip_name, status, start_date, end_date 
FROM trips_v2 
WHERE trip_name LIKE '%Sara%' OR trip_name LIKE '%Sarah%'
ORDER BY trip_name;

SELECT 'AFTER CLEANUP - Clients:' as info;
SELECT client_id, email, full_name 
FROM clients_v2 
WHERE full_name LIKE '%Sara%' OR full_name LIKE '%Sarah%'
ORDER BY full_name;