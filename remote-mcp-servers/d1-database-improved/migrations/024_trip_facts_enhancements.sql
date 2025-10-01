-- 024_trip_facts_enhancements.sql
-- Extend trip_facts schema with traveler details and ensure dirty triggers

-- Add new columns if they do not already exist
ALTER TABLE trip_facts ADD COLUMN traveler_count INTEGER DEFAULT 0;
ALTER TABLE trip_facts ADD COLUMN traveler_names TEXT;
ALTER TABLE trip_facts ADD COLUMN traveler_emails TEXT;
ALTER TABLE trip_facts ADD COLUMN primary_client_email TEXT;
ALTER TABLE trip_facts ADD COLUMN primary_client_name TEXT;

CREATE INDEX IF NOT EXISTS idx_trip_facts_primary_email
  ON trip_facts(primary_client_email);

-- Ensure changes to traveler assignments mark trip_facts dirty
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
