-- Migration 007: Publication Tracking for Voygen-SoMoTravel Integration
-- Adds fields to track travel document publishing and dashboard status

-- Add publication tracking fields to trips_v2 table
ALTER TABLE trips_v2 ADD COLUMN dashboard_status TEXT CHECK(dashboard_status IN ('proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past', 'no_sale'));
ALTER TABLE trips_v2 ADD COLUMN published_url TEXT;
ALTER TABLE trips_v2 ADD COLUMN last_published TIMESTAMP;
ALTER TABLE trips_v2 ADD COLUMN publication_filename TEXT;

-- Create publication log table for detailed tracking
CREATE TABLE IF NOT EXISTS publication_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER REFERENCES trips_v2(trip_id),
  filename TEXT NOT NULL,
  published_url TEXT NOT NULL,
  dashboard_updated BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  commit_hash TEXT,
  status TEXT DEFAULT 'success' CHECK(status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  dashboard_commit_hash TEXT,
  backup_created BOOLEAN DEFAULT FALSE,
  backup_path TEXT
);

-- Create index on publication log
CREATE INDEX idx_publication_log_trip ON publication_log(trip_id, published_at DESC);
CREATE INDEX idx_publication_log_status ON publication_log(status, published_at DESC);

-- Update trip_complete_v2 view to include publication info
DROP VIEW IF EXISTS trip_complete_v2;
CREATE VIEW trip_complete_v2 AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.status,
    t.start_date,
    t.end_date,
    t.destinations,
    t.total_cost,
    t.paid_amount,
    t.total_cost - t.paid_amount as balance_due,
    -- JSON fields returned as-is for parsing
    t.clients,
    t.schedule,
    t.accommodations,
    t.transportation,
    t.financials,
    t.documents,
    t.notes,
    -- Publication tracking fields
    t.dashboard_status,
    t.published_url,
    t.last_published,
    t.publication_filename,
    -- Calculated fields
    CAST(julianday(t.start_date) - julianday('now') AS INTEGER) as days_until_departure,
    CAST(julianday(t.end_date) - julianday(t.start_date) + 1 AS INTEGER) as trip_duration_days,
    -- Publication status calculated field
    CASE 
        WHEN t.published_url IS NOT NULL THEN 'published'
        WHEN t.dashboard_status IS NOT NULL THEN 'draft'
        ELSE 'unpublished'
    END as publication_status,
    t.search_text,
    t.created_at,
    t.updated_at
FROM trips_v2 t;

-- Create trigger to update publication tracking on status changes
CREATE TRIGGER update_publication_tracking 
AFTER UPDATE OF status ON trips_v2 
FOR EACH ROW 
WHEN OLD.status != NEW.status
BEGIN
    UPDATE trips_v2 
    SET dashboard_status = CASE 
        WHEN NEW.status = 'planning' THEN 'proposal'
        WHEN NEW.status = 'confirmed' THEN 'confirmed'
        WHEN NEW.status = 'in_progress' THEN 'active'
        WHEN NEW.status = 'completed' THEN 'past'
        WHEN NEW.status = 'cancelled' THEN 'no_sale'
        ELSE dashboard_status
    END,
    updated_at = CURRENT_TIMESTAMP
    WHERE trip_id = NEW.trip_id;
END;

-- Add documentation for new fields (skip if documentation table has constraints)
-- Only insert documentation if table allows these object types

-- Update the master migration status
INSERT OR IGNORE INTO migration_status (migration_name) VALUES ('publication_tracking_system');