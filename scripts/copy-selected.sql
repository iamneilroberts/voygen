-- Build clean.sqlite from old.sqlite by copying only selected data
-- Usage: sqlite3 clean.sqlite < scripts/copy-selected.sql

ATTACH 'old.sqlite' AS old;

-- Copy SELECTED trips
INSERT INTO trips_v2 (
  trip_id, trip_name, status, clients, primary_client_email, group_name,
  schedule, accommodations, transportation, financials, documents, notes,
  start_date, end_date, destinations, total_cost, paid_amount, search_text,
  workflow_state, dashboard_status, published_url, last_published, publication_filename,
  trip_slug, created_at, updated_at, created_by, last_modified_by
)
SELECT 
  trip_id, trip_name, status, clients, primary_client_email, group_name,
  schedule, accommodations, transportation, financials, documents, notes,
  start_date, end_date, destinations, total_cost, paid_amount, search_text,
  workflow_state, dashboard_status, published_url, last_published, publication_filename,
  trip_slug, created_at, updated_at, created_by, last_modified_by
FROM old.trips_v2 WHERE trip_id IN (1,3,4,6,9,13,14,44);

-- Copy assignments
INSERT INTO trip_client_assignments (trip_id, client_email, client_role, created_at, updated_at)
SELECT trip_id, client_email, client_role, created_at, updated_at
FROM old.trip_client_assignments WHERE trip_id IN (1,3,4,6,9,13,14,44);

-- Derive allowed client emails
WITH emails AS (
  SELECT client_email AS email FROM old.trip_client_assignments WHERE trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT primary_client_email FROM old.trips_v2 WHERE trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT json_extract(value, '$.email') FROM old.trips_v2 t, json_each(t.clients) WHERE t.trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT 'sara.jones@email.com'
  UNION SELECT 'darren.jones@email.com'
)
INSERT INTO clients_v2 (
  client_id, email, full_name, contact_info, travel_docs, trip_history, preferences, loyalty_programs,
  search_text, created_at, updated_at, last_trip_date, total_trips, total_spent
)
SELECT client_id, email, full_name, contact_info, travel_docs, trip_history, preferences, loyalty_programs,
       search_text, created_at, updated_at, last_trip_date, total_trips, total_spent
FROM old.clients_v2 WHERE email IN (SELECT email FROM emails WHERE email IS NOT NULL AND email <> '');

-- LLM context: keep those matching kept trip names or kept client emails
WITH emails AS (
  SELECT client_email AS email FROM old.trip_client_assignments WHERE trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT primary_client_email FROM old.trips_v2 WHERE trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT json_extract(value, '$.email') FROM old.trips_v2 t, json_each(t.clients) WHERE t.trip_id IN (1,3,4,6,9,13,14,44)
  UNION SELECT 'sara.jones@email.com'
  UNION SELECT 'darren.jones@email.com'
),
trip_names AS (
  SELECT trip_name FROM old.trips_v2 WHERE trip_id IN (1,3,4,6,9,13,14,44)
)
INSERT INTO llm_trip_context (
  context_id, natural_key, formatted_response, raw_data, search_keywords,
  context_type, relevance_date, is_active, last_accessed, access_count, created_at, expires_at
)
SELECT context_id, natural_key, formatted_response, raw_data, search_keywords,
       context_type, relevance_date, is_active, last_accessed, access_count, created_at, expires_at
FROM old.llm_trip_context
WHERE natural_key IN (SELECT trip_name FROM trip_names)
   OR natural_key IN (SELECT email FROM emails WHERE email IS NOT NULL AND email <> '');

-- FAQ patterns are generic; copy all
INSERT INTO llm_faq_cache (question_pattern, answer_template, sql_query, last_used, use_count)
SELECT question_pattern, answer_template, sql_query, last_used, use_count
FROM old.llm_faq_cache;

-- Templates are shared; copy all
INSERT INTO HtmlDocumentTemplates (
  template_id, template_name, template_type, html_template, css_styles, javascript_code, variables, description,
  is_active, created_by, created_at, updated_at
)
SELECT template_id, template_name, template_type, html_template, css_styles, javascript_code, variables, description,
       is_active, created_by, created_at, updated_at
FROM old.HtmlDocumentTemplates;

-- Copy hotel caches only for selected trips and generic rows
INSERT INTO hotel_cache (
  id, provider, provider_hotel_id, name, city, region, country, stars, latitude, longitude,
  last_updated, raw_json, trip_id, giata_id, json, lead_price_amount, lead_price_currency,
  refundable, created_at, updated_at
)
SELECT id, provider, provider_hotel_id, name, city, region, country, stars, latitude, longitude,
       last_updated, raw_json, trip_id, giata_id, json, lead_price_amount, lead_price_currency,
       refundable, created_at, updated_at
FROM old.hotel_cache
WHERE trip_id IN (1,3,4,6,9,13,14,44) OR trip_id IS NULL;

INSERT INTO rooms_cache (
  id, hotel_id, room_type, occupancy, rate_plan, price, currency, refundable, includes_breakfast,
  last_updated, raw_json, trip_id, hotel_key, site, room_name, json, nightly_rate, total_price,
  created_at, updated_at
)
SELECT id, hotel_id, room_type, occupancy, rate_plan, price, currency, refundable, includes_breakfast,
       last_updated, raw_json, trip_id, hotel_key, site, room_name, json, nightly_rate, total_price,
       created_at, updated_at
FROM old.rooms_cache
WHERE trip_id IN (1,3,4,6,9,13,14,44) OR trip_id IS NULL;

-- Costs and bookings for selected trips (if exist)
INSERT INTO TripCosts (
  cost_id, trip_id, cost_type, description, amount, currency, cost_date, vendor, payment_status, notes, created_at, updated_at
)
SELECT cost_id, trip_id, cost_type, description, amount, currency, cost_date, vendor, payment_status, notes, created_at, updated_at
FROM old.TripCosts WHERE trip_id IN (1,3,4,6,9,13,14,44);

INSERT INTO BookingHistory (
  booking_id, trip_id, booking_type, external_booking_id, vendor, status, booking_date, confirmation_number, amount, currency,
  details_json, created_at, updated_at
)
SELECT booking_id, trip_id, booking_type, external_booking_id, vendor, status, booking_date, confirmation_number, amount, currency,
       details_json, created_at, updated_at
FROM old.BookingHistory WHERE trip_id IN (1,3,4,6,9,13,14,44);

DETACH old;
