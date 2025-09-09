-- 020_itinerary_views.sql
-- Purpose: Helper views for semi-detailed itinerary generation using D1-safe JSON

-- Trip overview (finance and metadata)
CREATE VIEW IF NOT EXISTS trip_overview_v AS
SELECT 
  t.trip_id,
  t.trip_name,
  t.status,
  t.start_date,
  t.end_date,
  t.destinations,
  t.primary_client_email,
  (
    SELECT GROUP_CONCAT(email, ', ')
    FROM (
      SELECT json_extract(value, '$.email') AS email
      FROM json_each(t.clients)
      WHERE json_extract(value, '$.email') IS NOT NULL
    ) e
  ) AS client_emails,
  t.total_cost,
  t.paid_amount,
  (COALESCE(t.total_cost, 0) - COALESCE(t.paid_amount, 0)) AS balance_due,
  t.last_published,
  t.published_url
FROM trips_v2 t;

-- Flattened daily schedule
CREATE VIEW IF NOT EXISTS trip_daily_schedule_v AS
SELECT 
  t.trip_id,
  json_extract(day.value, '$.day_number') AS day_number,
  json_extract(day.value, '$.date') AS day_date,
  json_extract(day.value, '$.day_name') AS day_name,
  json_extract(day.value, '$.activities') AS activities_json,
  json_array_length(json_extract(day.value, '$.activities')) AS activities_count
FROM trips_v2 t,
     json_each(t.schedule) AS day;

-- Confirmed/completed bookings
CREATE VIEW IF NOT EXISTS confirmed_items_v AS
SELECT 
  b.trip_id,
  b.booking_type,
  b.vendor,
  b.confirmation_number,
  b.amount,
  b.currency,
  b.booking_date
FROM BookingHistory b
WHERE b.status IN ('confirmed','completed');

