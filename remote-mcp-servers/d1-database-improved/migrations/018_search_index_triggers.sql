-- 018_search_index_triggers.sql
-- Purpose: Keep search_index in sync for trips and clients with normalized tokens

-- Trips upsert trigger
CREATE TRIGGER IF NOT EXISTS trg_search_index_trips_ai
AFTER INSERT ON trips_v2
BEGIN
  INSERT OR REPLACE INTO search_index (
    entity_type, entity_id, entity_name, summary, search_tokens, date_context, location_context, relevance_score, access_count, last_updated
  ) VALUES (
    'trip',
    NEW.trip_id,
    NEW.trip_name,
    NEW.trip_name || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') - ' || COALESCE(NEW.destinations,''),
    LOWER(
      TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(NEW.trip_name || ' ' || COALESCE(NEW.destinations,'') || ' ' || COALESCE(NEW.group_name,'') || ' ' || COALESCE(NEW.trip_slug,''),
          '&',' and '),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' '))
    ),
    NEW.start_date || ' to ' || NEW.end_date,
    NEW.destinations,
    CASE WHEN NEW.trip_slug IS NOT NULL AND NEW.trip_slug != '' THEN 1.5 ELSE 1.0 END,
    0,
    CURRENT_TIMESTAMP
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_search_index_trips_au
AFTER UPDATE ON trips_v2
BEGIN
  INSERT OR REPLACE INTO search_index (
    entity_type, entity_id, entity_name, summary, search_tokens, date_context, location_context, relevance_score, access_count, last_updated
  ) VALUES (
    'trip',
    NEW.trip_id,
    NEW.trip_name,
    NEW.trip_name || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') - ' || COALESCE(NEW.destinations,''),
    LOWER(
      TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(NEW.trip_name || ' ' || COALESCE(NEW.destinations,'') || ' ' || COALESCE(NEW.group_name,'') || ' ' || COALESCE(NEW.trip_slug,''),
          '&',' and '),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' '))
    ),
    NEW.start_date || ' to ' || NEW.end_date,
    NEW.destinations,
    CASE WHEN NEW.trip_slug IS NOT NULL AND NEW.trip_slug != '' THEN 1.5 ELSE 1.0 END,
    COALESCE((SELECT access_count FROM search_index WHERE entity_type='trip' AND entity_id=NEW.trip_id), 0),
    CURRENT_TIMESTAMP
  );
END;

-- Clients upsert trigger
CREATE TRIGGER IF NOT EXISTS trg_search_index_clients_ai
AFTER INSERT ON clients_v2
BEGIN
  INSERT OR REPLACE INTO search_index (
    entity_type, entity_id, entity_name, summary, search_tokens, relevance_score, access_count, last_updated
  ) VALUES (
    'client',
    NEW.client_id,
    NEW.full_name,
    NEW.full_name || ' <' || NEW.email || '>',
    LOWER(
      TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(NEW.full_name || ' ' || NEW.email,
          '&',' and '),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' '))
    ),
    1.0,
    0,
    CURRENT_TIMESTAMP
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_search_index_clients_au
AFTER UPDATE ON clients_v2
BEGIN
  INSERT OR REPLACE INTO search_index (
    entity_type, entity_id, entity_name, summary, search_tokens, relevance_score, access_count, last_updated
  ) VALUES (
    'client',
    NEW.client_id,
    NEW.full_name,
    NEW.full_name || ' <' || NEW.email || '>',
    LOWER(
      TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(NEW.full_name || ' ' || NEW.email,
          '&',' and '),'.',' '),',',' '),'"',' '),"'",' '),'/',' '),'\\',' '),'(', ' '),')',' '),'  ',' '))
    ),
    1.0,
    COALESCE((SELECT access_count FROM search_index WHERE entity_type='client' AND entity_id=NEW.client_id), 0),
    CURRENT_TIMESTAMP
  );
END;

