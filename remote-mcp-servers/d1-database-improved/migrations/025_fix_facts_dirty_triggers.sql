-- 025_fix_facts_dirty_triggers.sql
-- Fix UNIQUE constraint issues by updating triggers to use INSERT OR IGNORE

-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_trip_client_assignments_ai_facts;
DROP TRIGGER IF EXISTS trg_trip_client_assignments_au_facts;
DROP TRIGGER IF EXISTS trg_trip_client_assignments_ad_facts;

-- Recreate with INSERT OR IGNORE
CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ai_facts
AFTER INSERT ON trip_client_assignments
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_au_facts
AFTER UPDATE ON trip_client_assignments
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ad_facts
AFTER DELETE ON trip_client_assignments
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'traveler_delete');
END;

-- Also update the main triggers from the base migration
DROP TRIGGER IF EXISTS trg_trips_v2_ai_dirty;
DROP TRIGGER IF EXISTS trg_trips_v2_au_dirty;
DROP TRIGGER IF EXISTS trg_trips_v2_ad_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_ai_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_au_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_ad_dirty;

CREATE TRIGGER trg_trips_v2_ai_dirty
AFTER INSERT ON trips_v2
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
END;

CREATE TRIGGER trg_trips_v2_au_dirty
AFTER UPDATE ON trips_v2
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
END;

CREATE TRIGGER trg_trips_v2_ad_dirty
AFTER DELETE ON trips_v2
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
END;

CREATE TRIGGER trg_tripdays_ai_dirty
AFTER INSERT ON TripDays
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_insert');
END;

CREATE TRIGGER trg_tripdays_au_dirty
AFTER UPDATE ON TripDays
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_update');
END;

CREATE TRIGGER trg_tripdays_ad_dirty
AFTER DELETE ON TripDays
BEGIN
  INSERT OR IGNORE INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'tripday_delete');
END;