-- Clear existing context to start fresh
DELETE FROM llm_trip_context;
DELETE FROM llm_faq_cache;
DELETE FROM search_index;

-- Populate trip context with proper formatting
INSERT INTO llm_trip_context (
    natural_key,
    context_type,
    formatted_response,
    raw_data,
    search_keywords,
    created_at,
    last_accessed,
    access_count
)
SELECT 
    trip_name as natural_key,
    'trip_full' as context_type,
    printf('Trip: %s
Status: %s
Dates: %s to %s
Destinations: %s
Total Cost: $%.2f
Group: %s

Clients:
%s

Notes: %s',
        trip_name,
        status,
        start_date,
        end_date,
        COALESCE(destinations, 'Various'),
        total_cost,
        COALESCE(group_name, 'Individual'),
        COALESCE(
            (SELECT GROUP_CONCAT(json_extract(value, '$.name') || ' (' || json_extract(value, '$.email') || ')', char(10))
             FROM json_each(clients)),
            'No clients listed'
        ),
        COALESCE(json_extract(notes, '$.general'), 'No notes')
    ) as formatted_response,
    json_object(
        'trip_id', trip_id,
        'trip_name', trip_name,
        'status', status,
        'clients', json(clients),
        'start_date', start_date,
        'end_date', end_date,
        'total_cost', total_cost,
        'financials', json(financials),
        'schedule', json(schedule),
        'accommodations', json(accommodations),
        'transportation', json(transportation)
    ) as raw_data,
    LOWER(trip_name || ' ' || COALESCE(destinations, '') || ' ' || COALESCE(search_text, '')) as search_keywords,
    created_at,
    created_at as last_accessed,
    0 as access_count
FROM trips_v2;

-- Populate client context
INSERT INTO llm_trip_context (
    natural_key,
    context_type,
    formatted_response,
    raw_data,
    search_keywords,
    created_at,
    last_accessed,
    access_count
)
SELECT 
    email as natural_key,
    'client_profile' as context_type,
    printf('Client: %s
Email: %s
Phone: %s
Total Trips: %d
Total Spent: $%.2f

Preferences: %s',
        full_name,
        email,
        COALESCE(json_extract(contact_info, '$.phone'), 'No phone'),
        total_trips,
        total_spent,
        COALESCE(json_extract(preferences, '$.preferences'), 'None specified')
    ) as formatted_response,
    json_object(
        'client_id', client_id,
        'full_name', full_name,
        'email', email,
        'contact_info', json(contact_info),
        'travel_docs', json(travel_docs),
        'preferences', json(preferences),
        'trip_history', json(trip_history),
        'loyalty_programs', json(loyalty_programs)
    ) as raw_data,
    LOWER(full_name || ' ' || email || ' ' || COALESCE(search_text, '')) as search_keywords,
    created_at,
    created_at as last_accessed,
    0 as access_count
FROM clients_v2;

-- Populate FAQ cache with common queries
INSERT INTO llm_faq_cache (question_pattern, answer_template, sql_query, use_count)
VALUES 
    ('%upcoming%trip%', 'Here are the upcoming trips: {results}', 
     'SELECT trip_name || " (" || start_date || ")" as summary FROM trips_v2 WHERE start_date > date("now") ORDER BY start_date', 0),
    ('%total%revenue%', 'Total revenue: {results}', 
     'SELECT "$" || printf("%.2f", SUM(total_cost)) as summary FROM trips_v2 WHERE status = "confirmed"', 0),
    ('%confirmed%trip%', 'Confirmed trips: {results}', 
     'SELECT trip_name || " - " || COALESCE(group_name, "Individual") as summary FROM trips_v2 WHERE status = "confirmed"', 0),
    ('%client%list%', 'All clients: {results}',
     'SELECT full_name || " (" || email || ")" as summary FROM clients_v2 ORDER BY full_name', 0),
    ('%trip%status%', 'Trip statuses: {results}',
     'SELECT trip_name || ": " || status as summary FROM trips_v2 ORDER BY start_date DESC', 0);

-- Populate search index
INSERT INTO search_index (entity_type, entity_id, entity_name, summary, search_tokens, relevance_score)
SELECT 
    'trip' as entity_type,
    trip_id as entity_id,
    trip_name as entity_name,
    trip_name || ' (' || start_date || ' to ' || end_date || ') - ' || status as summary,
    LOWER(trip_name || ' ' || COALESCE(destinations, '') || ' ' || COALESCE(group_name, '')) as search_tokens,
    CASE 
        WHEN status = 'confirmed' THEN 1.5
        WHEN status = 'planning' THEN 1.0
        ELSE 0.8
    END as relevance_score
FROM trips_v2;

INSERT INTO search_index (entity_type, entity_id, entity_name, summary, search_tokens, relevance_score)
SELECT 
    'client' as entity_type,
    client_id as entity_id,
    full_name as entity_name,
    full_name || ' <' || email || '> - ' || total_trips || ' trips' as summary,
    LOWER(full_name || ' ' || email) as search_tokens,
    1.0 as relevance_score
FROM clients_v2;