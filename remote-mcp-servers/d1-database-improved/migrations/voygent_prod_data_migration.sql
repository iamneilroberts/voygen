-- Voygent Production Data Migration (from existing D1)
-- Strategy: export/import essentials (clients_v2, trips_v2, trip_client_assignments,
--          llm_trip_context, llm_faq_cache, HtmlDocumentTemplates, hotel_cache/rooms_cache)
-- Assumptions:
-- - Old DB binding/name: travel_assistant
-- - New DB name: voygent-prod
-- - Use wrangler export/import to move data safely

-- 1) Export from old DB (run in shell)
--   wrangler d1 export travel_assistant --remote --output=old_export.sqlite
--   # Or CSV/JSON extracts for specific tables:
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM clients_v2" --json > clients_v2.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM trips_v2" --json > trips_v2.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM trip_client_assignments" --json > tca.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM llm_trip_context" --json > llm_trip_context.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM llm_faq_cache" --json > llm_faq_cache.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM HtmlDocumentTemplates" --json > templates.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM hotel_cache" --json > hotel_cache.json
--   wrangler d1 execute travel_assistant --remote --command "SELECT * FROM rooms_cache" --json > rooms_cache.json

-- 2) Prepare new DB
--   wrangler d1 create voygent-prod
--   wrangler d1 execute voygent-prod --file=remote-mcp-servers/d1-database-improved/migrations/voygent_prod_schema.sql

-- 3) Import data (choose JSON or sqlite import)
-- Option A: import the sqlite file then clean legacy tables (fastest)
--   wrangler d1 import voygent-prod --remote --file=old_export.sqlite
--   -- then run cleanup to drop legacy/unused tables if desired

-- Option B: targeted JSON import into clean schema (safer)
-- Use a small Worker/script to read JSON and insert. Example inserts follow for SQL-only imports.

-- Clients
-- INSERT INTO clients_v2 (client_id, email, full_name, contact_info, travel_docs, trip_history, preferences, loyalty_programs, search_text, created_at, updated_at, last_trip_date, total_trips, total_spent)
-- SELECT client_id, email, full_name, contact_info, travel_docs, trip_history, preferences, loyalty_programs, search_text, created_at, updated_at, last_trip_date, total_trips, total_spent
-- FROM old_db.clients_v2;

-- Trips
-- INSERT INTO trips_v2 (trip_id, trip_name, status, clients, primary_client_email, group_name, schedule, accommodations, transportation, financials, documents, notes, start_date, end_date, destinations, total_cost, paid_amount, search_text, workflow_state, dashboard_status, published_url, last_published, publication_filename, trip_slug, created_at, updated_at, created_by, last_modified_by)
-- SELECT trip_id, trip_name, status, clients, primary_client_email, group_name, schedule, accommodations, transportation, financials, documents, notes, start_date, end_date, destinations, total_cost, paid_amount, search_text, workflow_state, dashboard_status, published_url, last_published, publication_filename, trip_slug, created_at, updated_at, created_by, last_modified_by
-- FROM old_db.trips_v2;

-- Assignments
-- INSERT OR IGNORE INTO trip_client_assignments (trip_id, client_email, client_role, created_at, updated_at)
-- SELECT trip_id, client_email, client_role, created_at, updated_at FROM old_db.trip_client_assignments;

-- LLM context/cache
-- INSERT OR REPLACE INTO llm_trip_context (natural_key, context_type, formatted_response, raw_data, search_keywords, relevance_date, is_active, last_accessed, access_count, created_at, expires_at)
-- SELECT natural_key, context_type, formatted_response, raw_data, search_keywords, relevance_date, is_active, last_accessed, access_count, created_at, expires_at FROM old_db.llm_trip_context;
-- INSERT OR REPLACE INTO llm_faq_cache (question_pattern, answer_template, sql_query, last_used, use_count)
-- SELECT question_pattern, answer_template, sql_query, last_used, use_count FROM old_db.llm_faq_cache;

-- Templates
-- INSERT OR REPLACE INTO HtmlDocumentTemplates (template_id, template_name, template_type, html_template, css_styles, javascript_code, variables, description, is_active, created_by, created_at, updated_at)
-- SELECT template_id, template_name, template_type, html_template, css_styles, javascript_code, variables, description, is_active, created_by, created_at, updated_at FROM old_db.HtmlDocumentTemplates;

-- Hotel cache
-- INSERT OR REPLACE INTO hotel_cache (id, provider, provider_hotel_id, name, city, region, country, stars, latitude, longitude, last_updated, raw_json, trip_id, giata_id, json, lead_price_amount, lead_price_currency, refundable, commission_amount, created_at, updated_at)
-- SELECT id, provider, provider_hotel_id, name, city, region, country, stars, latitude, longitude, last_updated, raw_json, trip_id, giata_id, json, lead_price_amount, lead_price_currency, refundable, commission_amount, created_at, updated_at FROM old_db.hotel_cache;
-- INSERT OR REPLACE INTO rooms_cache (id, hotel_id, room_type, occupancy, rate_plan, price, currency, refundable, includes_breakfast, last_updated, raw_json, trip_id, hotel_key, site, room_name, json, nightly_rate, total_price, commission_amount, commission_percent, cancellation_deadline, created_at, updated_at)
-- SELECT id, hotel_id, room_type, occupancy, rate_plan, price, currency, refundable, includes_breakfast, last_updated, raw_json, trip_id, hotel_key, site, room_name, json, nightly_rate, total_price, commission_amount, commission_percent, cancellation_deadline, created_at, updated_at FROM old_db.rooms_cache;

-- 4) Rebuild computed/search artifacts
--   -- If using search_index, rebuild from trips/clients to ensure freshness
--   DELETE FROM search_index;
--   -- Example rebuilds exist in migrations/008_populate_llm_context.sql and src/tools/migration-tools.ts

-- 5) Validate counts
--   -- Run quick sanity checks post-import
--   SELECT COUNT(*) AS trips FROM trips_v2;
--   SELECT COUNT(*) AS clients FROM clients_v2;
--   SELECT COUNT(*) AS assigns FROM trip_client_assignments;
--   SELECT COUNT(*) AS ctx FROM llm_trip_context;

