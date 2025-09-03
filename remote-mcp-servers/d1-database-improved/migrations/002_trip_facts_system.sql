-- 002_trip_facts_system.sql
-- Purpose: Introduce fact table and dirty-tracking for computed trip metrics

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS trip_facts (
  trip_id TEXT PRIMARY KEY,
  total_nights INTEGER DEFAULT 0,
  total_hotels INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  transit_minutes INTEGER DEFAULT 0,
  last_computed DATETIME,
  version INTEGER DEFAULT 1,
  FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facts_dirty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trip_id, reason, created_at)
);

CREATE INDEX IF NOT EXISTS idx_facts_dirty_trip ON facts_dirty(trip_id);

-- Triggers to mark facts dirty on relevant table changes
CREATE TRIGGER IF NOT EXISTS trg_trips_ai_dirty
AFTER INSERT ON Trips
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_au_dirty
AFTER UPDATE ON Trips
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_ad_dirty
AFTER DELETE ON Trips
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.id, 'trip_delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_tripdays_ai_dirty
AFTER INSERT ON TripDays
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_tripdays_au_dirty
AFTER UPDATE ON TripDays
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_tripdays_ad_dirty
AFTER DELETE ON TripDays
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'tripday_delete');
END;

-- ActivityLog also affects derived metrics
CREATE TRIGGER IF NOT EXISTS trg_activitylog_ai_dirty
AFTER INSERT ON ActivityLog
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_activitylog_au_dirty
AFTER UPDATE ON ActivityLog
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_activitylog_ad_dirty
AFTER DELETE ON ActivityLog
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'activity_delete');
END;

COMMIT;

