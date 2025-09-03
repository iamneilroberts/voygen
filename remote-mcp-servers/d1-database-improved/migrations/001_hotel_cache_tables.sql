-- 001_hotel_cache_tables.sql
-- Purpose: Add normalized cache tables for hotels and room offers

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS hotel_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_hotel_id TEXT NOT NULL,
  name TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  stars REAL,
  latitude REAL,
  longitude REAL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_cache_provider_key
  ON hotel_cache(provider, provider_hotel_id);

CREATE INDEX IF NOT EXISTS idx_hotel_cache_city ON hotel_cache(city);
CREATE INDEX IF NOT EXISTS idx_hotel_cache_country ON hotel_cache(country);

CREATE TABLE IF NOT EXISTS rooms_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id INTEGER NOT NULL,
  room_type TEXT,
  occupancy INTEGER,
  rate_plan TEXT,
  price REAL,
  currency TEXT DEFAULT 'USD',
  refundable BOOLEAN,
  includes_breakfast BOOLEAN,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT,
  FOREIGN KEY (hotel_id) REFERENCES hotel_cache(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rooms_cache_hotel ON rooms_cache(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_cache_updated ON rooms_cache(last_updated);

COMMIT;

