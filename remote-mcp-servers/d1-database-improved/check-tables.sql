-- Check record counts for all tables
SELECT 'Accommodations' as table_name, COUNT(*) as record_count FROM Accommodations
UNION ALL
SELECT 'Activities', COUNT(*) FROM Activities
UNION ALL
SELECT 'ActivityLog', COUNT(*) FROM ActivityLog
UNION ALL
SELECT 'Clients', COUNT(*) FROM Clients
UNION ALL
SELECT 'Trips', COUNT(*) FROM Trips
UNION ALL
SELECT 'TripParticipants', COUNT(*) FROM TripParticipants
UNION ALL
SELECT 'TripDays', COUNT(*) FROM TripDays
UNION ALL
SELECT 'Documents', COUNT(*) FROM Documents
UNION ALL
SELECT 'instruction_sets', COUNT(*) FROM instruction_sets
UNION ALL
SELECT 'travel_searches', COUNT(*) FROM travel_searches
UNION ALL
SELECT 'user_preferences', COUNT(*) FROM user_preferences
UNION ALL
SELECT 'db_errors', COUNT(*) FROM db_errors
UNION ALL
SELECT 'WebCaptures', COUNT(*) FROM WebCaptures
UNION ALL
SELECT 'dv_searches', COUNT(*) FROM dv_searches
UNION ALL
SELECT 'dv_hotels', COUNT(*) FROM dv_hotels
ORDER BY record_count DESC;