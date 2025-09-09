-- 017_rebuild_search_index_normalized.sql
-- Purpose: Normalize search tokens (lowercase, strip punctuation, handle '&' → 'and', include trip_slug)

-- Ensure search_index table exists
CREATE TABLE IF NOT EXISTS search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('trip','client','activity','destination')),
  entity_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  search_tokens TEXT NOT NULL,
  date_context TEXT,
  location_context TEXT,
  relevance_score REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);

DELETE FROM search_index;

-- Helper normalization via nested REPLACE chains
WITH trips AS (
  SELECT 
    t.trip_id AS id,
    t.trip_name,
    t.destinations,
    t.group_name,
    t.trip_slug,
    t.start_date,
    t.end_date,
    LOWER(
      TRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          REPLACE(
            t.trip_name || ' ' || COALESCE(t.destinations,'') || ' ' || COALESCE(t.group_name,'') || ' ' || COALESCE(t.trip_slug,''),
            '&',' and '
          ),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' ')
      )
    ) AS tokens
  FROM trips_v2 t
)
INSERT OR REPLACE INTO search_index (
  entity_type, entity_id, entity_name, summary, search_tokens, date_context, location_context, relevance_score, access_count, last_updated
)
SELECT 
  'trip', 
  id, 
  trip_name,
  trip_name || ' (' || start_date || ' to ' || end_date || ') - ' || COALESCE(destinations,'') AS summary,
  tokens,
  start_date || ' to ' || end_date,
  destinations,
  CASE WHEN trip_slug IS NOT NULL AND trip_slug != '' THEN 1.5 ELSE 1.0 END,
  0,
  CURRENT_TIMESTAMP
FROM trips;

WITH clients AS (
  SELECT 
    c.client_id AS id,
    c.full_name,
    c.email,
    LOWER(
      TRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          REPLACE(
            c.full_name || ' ' || c.email,
            '&',' and '
          ),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' ')
      )
    ) AS tokens
  FROM clients_v2 c
)
INSERT OR REPLACE INTO search_index (
  entity_type, entity_id, entity_name, summary, search_tokens, relevance_score, access_count, last_updated
)
SELECT 
  'client', 
  id, 
  full_name,
  full_name || ' <' || email || '>' AS summary,
  tokens,
  1.0,
  0,
  CURRENT_TIMESTAMP
FROM clients;

