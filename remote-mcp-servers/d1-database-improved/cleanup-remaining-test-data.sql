-- Additional cleanup for remaining test records

-- Show what test clients/trips we still have
SELECT 'REMAINING TEST RECORDS - Clients:' as info;
SELECT client_id, email, full_name 
FROM clients_v2 
WHERE (email LIKE '%@example.com%' AND email NOT LIKE '%jones%')
   OR (full_name LIKE '%Sarah%' AND full_name NOT LIKE '%Sara Jones%' AND full_name NOT LIKE '%Sara & Darren%')
   OR email LIKE '%sarah.johnson%' 
   OR email LIKE '%sarah.thompson%'
ORDER BY full_name;

SELECT 'REMAINING TEST RECORDS - Trips:' as info;
SELECT trip_id, trip_name, status 
FROM trips_v2 
WHERE trip_name LIKE '%Johnson Family Europe%'
   OR trip_name LIKE '%Thompson%'
ORDER BY trip_name;

-- Remove remaining test clients that are clearly not legitimate
DELETE FROM clients_v2 
WHERE (email LIKE '%@example.com%' AND email NOT LIKE '%jones%')
   OR email LIKE '%sarah.johnson%' 
   OR email LIKE '%sarah.thompson%'
   OR (full_name LIKE '%Sarah%' AND full_name NOT LIKE '%Sara Jones%' AND full_name NOT LIKE '%Sara & Darren%');

-- Remove test trips that are clearly not legitimate
DELETE FROM trips_v2 
WHERE trip_name LIKE '%Johnson Family Europe%'
   OR (trip_name LIKE '%Thompson%' AND trip_name NOT LIKE '%Bristol%' AND trip_name NOT LIKE '%Bath%');

-- Clean up related context
DELETE FROM llm_trip_context 
WHERE natural_key LIKE '%Johnson Family Europe%'
   OR natural_key LIKE '%Thompson%Anniversary%';

-- Show final state - should only have legitimate Sara & Darren Jones records
SELECT 'FINAL STATE - Sara/Sarah related records:' as info;
SELECT trip_id, trip_name, status, start_date, end_date 
FROM trips_v2 
WHERE trip_name LIKE '%Sara%' OR trip_name LIKE '%Sarah%'
ORDER BY trip_name;

SELECT client_id, email, full_name 
FROM clients_v2 
WHERE full_name LIKE '%Sara%' OR full_name LIKE '%Sarah%'
ORDER BY full_name;