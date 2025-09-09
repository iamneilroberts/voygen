-- 021_refresh_itinerary_context.sql
-- Purpose: Rebuild llm_trip_context 'trip_full' entries using itinerary helper views

-- Remove existing trip_full contexts to avoid duplication
DELETE FROM llm_trip_context WHERE context_type = 'trip_full';

-- Recreate formatted responses from views
INSERT INTO llm_trip_context (
  natural_key,
  context_type,
  formatted_response,
  raw_data,
  search_keywords,
  relevance_date,
  is_active,
  last_accessed,
  access_count,
  created_at
)
SELECT 
  t.trip_name AS natural_key,
  'trip_full' AS context_type,
  (
    'TRIP: ' || t.trip_name || char(10) ||
    'DATES: ' || t.start_date || ' to ' || t.end_date || char(10) ||
    'STATUS: ' || t.status || char(10) ||
    'COSTS: Total $' || printf('%.2f', COALESCE(t.total_cost,0)) ||
      ', Paid $' || printf('%.2f', COALESCE(t.paid_amount,0)) ||
      ', Balance $' || printf('%.2f', COALESCE(t.balance_due,0)) || char(10) ||
    'CLIENTS: ' || COALESCE(t.client_emails,'None') || char(10) || char(10) ||
    'CONFIRMED ITEMS:' || char(10) ||
      COALESCE((
        SELECT GROUP_CONCAT(line, char(10)) FROM (
          SELECT 
            (ci.booking_type || ' - ' || COALESCE(ci.vendor,'') ||
             CASE WHEN ci.confirmation_number IS NOT NULL THEN ' #' || ci.confirmation_number ELSE '' END ||
             ' $' || printf('%.2f', COALESCE(ci.amount,0)) || ' ' || COALESCE(ci.currency,'') ||
             CASE WHEN ci.booking_date IS NOT NULL THEN ' (' || ci.booking_date || ')' ELSE '' END
            ) AS line
          FROM confirmed_items_v ci
          WHERE ci.trip_id = t.trip_id
          ORDER BY ci.booking_date
        ) x
      ), 'None') || char(10) || char(10) ||
    'DAILY SCHEDULE (concise):' || char(10) ||
      COALESCE((
        SELECT GROUP_CONCAT(line, char(10)) FROM (
          SELECT (
            'Day ' || COALESCE(ds.day_number,'') || ': ' || COALESCE(ds.day_name, '') ||
            CASE WHEN COALESCE(ds.activities_count,0) > 0 THEN ' (' || CAST(ds.activities_count AS TEXT) || ' activities)' ELSE '' END
          ) AS line
          FROM trip_daily_schedule_v ds
          WHERE ds.trip_id = t.trip_id
          ORDER BY CAST(ds.day_number AS INTEGER)
        ) y
      ), 'None')
  ) AS formatted_response,
  json_object(
    'trip_id', t.trip_id,
    'trip_name', t.trip_name,
    'status', t.status,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'destinations', t.destinations
  ) AS raw_data,
  LOWER(t.trip_name || ' ' || COALESCE(t.destinations,'') ) AS search_keywords,
  t.start_date AS relevance_date,
  1 AS is_active,
  CURRENT_TIMESTAMP AS last_accessed,
  0 AS access_count,
  CURRENT_TIMESTAMP AS created_at
FROM trip_overview_v t;
