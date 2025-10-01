-- 023_trip_search_surface.sql
-- Create table to support unified trip search surface

CREATE TABLE IF NOT EXISTS trip_search_surface (
  trip_id INTEGER PRIMARY KEY,
  trip_name TEXT NOT NULL,
  trip_slug TEXT,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  destinations TEXT,
  primary_client_name TEXT,
  primary_client_email TEXT,
  traveler_names TEXT,
  traveler_emails TEXT,
  normalized_trip_name TEXT,
  normalized_destinations TEXT,
  normalized_travelers TEXT,
  normalized_emails TEXT,
  search_tokens TEXT NOT NULL,
  phonetic_tokens TEXT,
  last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_search_surface_tokens
  ON trip_search_surface(search_tokens);

CREATE INDEX IF NOT EXISTS idx_trip_search_surface_status
  ON trip_search_surface(status);

CREATE INDEX IF NOT EXISTS idx_trip_search_surface_primary_email
  ON trip_search_surface(primary_client_email);

CREATE TABLE IF NOT EXISTS trip_search_surface_dirty (
  trip_id INTEGER NOT NULL,
  reason TEXT DEFAULT 'unspecified',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_search_surface_dirty_trip
  ON trip_search_surface_dirty(trip_id);

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_ai_search_surface
AFTER INSERT ON trips_v2
BEGIN
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_au_search_surface
AFTER UPDATE ON trips_v2
BEGIN
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_ad_search_surface
AFTER DELETE ON trips_v2
BEGIN
  DELETE FROM trip_search_surface WHERE trip_id = OLD.trip_id;
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ai_search_surface
AFTER INSERT ON trip_client_assignments
BEGIN
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_au_search_surface
AFTER UPDATE ON trip_client_assignments
BEGIN
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ad_search_surface
AFTER DELETE ON trip_client_assignments
BEGIN
  INSERT INTO trip_search_surface_dirty(trip_id, reason) VALUES (OLD.trip_id, 'traveler_delete');
END;
