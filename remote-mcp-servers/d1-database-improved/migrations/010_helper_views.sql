-- Create a view for quick trip summaries
CREATE VIEW IF NOT EXISTS trip_summary_v2 AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.status,
    t.start_date,
    t.end_date,
    t.total_cost,
    t.group_name,
    COUNT(DISTINCT json_extract(c.value, '$.client_id')) as client_count,
    lc.access_count,
    lc.last_accessed
FROM trips_v2 t
LEFT JOIN json_each(t.clients) c
LEFT JOIN llm_trip_context lc ON lc.natural_key = t.trip_name AND lc.context_type = 'trip_full'
GROUP BY t.trip_id;

-- Create a view for client activity
CREATE VIEW IF NOT EXISTS client_activity_v2 AS
SELECT 
    c.client_id,
    c.full_name,
    c.email,
    c.total_trips,
    c.total_spent,
    c.last_trip_date,
    lc.access_count,
    lc.last_accessed
FROM clients_v2 c
LEFT JOIN llm_trip_context lc ON lc.natural_key = c.email AND lc.context_type = 'client_profile';