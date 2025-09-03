-- 004_enhanced_trip_structure.sql
-- Purpose: Add trip legs and enhanced activities tables

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS trip_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  leg_order INTEGER NOT NULL,
  from_location TEXT,
  to_location TEXT,
  depart_datetime TEXT,
  arrive_datetime TEXT,
  transport_mode TEXT, -- flight, train, car, ferry, walk
  distance_km REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_legs_unique
  ON trip_legs(trip_id, leg_order);

CREATE INDEX IF NOT EXISTS idx_trip_legs_trip ON trip_legs(trip_id);

CREATE TABLE IF NOT EXISTS trip_activities_enhanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  day_id INTEGER, -- optional link to TripDays.id
  activity_type TEXT, -- attraction, tour, meal, transfer, misc
  title TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  cost REAL,
  currency TEXT DEFAULT 'USD',
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE,
  FOREIGN KEY (day_id) REFERENCES TripDays(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_trip ON trip_activities_enhanced(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_day ON trip_activities_enhanced(day_id);

COMMIT;

