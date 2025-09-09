-- 010_travel_services_core.sql
-- Purpose: Create unified travel services tables with migration from existing hotel_cache



-- Create the unified travel services table
CREATE TABLE travel_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Search context
  trip_id INTEGER,
  search_session_id TEXT,
  search_params_hash TEXT,
  
  -- Core identification
  service_id TEXT NOT NULL,
  service_category TEXT NOT NULL CHECK (service_category IN ('hotel', 'flight', 'rental_car', 'transfer', 'excursion', 'package')),
  service_name TEXT NOT NULL,
  service_description TEXT,
  
  -- Pricing (flattened for queries)
  base_price REAL NOT NULL,
  total_price REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  price_unit TEXT,              -- per night, per day, per person
  original_price REAL,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  start_date TEXT NOT NULL,     -- YYYY-MM-DD
  end_date TEXT,                -- YYYY-MM-DD (null for single-day services)
  duration_value REAL,
  duration_unit TEXT,
  max_capacity INTEGER,
  
  -- Location (for services with location)
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  latitude REAL,
  longitude REAL,
  
  -- Quality metrics
  rating_overall REAL,
  rating_source TEXT,
  rating_count INTEGER,
  extraction_confidence REAL,
  data_completeness REAL,
  
  -- Source information
  source_platform TEXT NOT NULL,
  source_url TEXT,
  booking_url TEXT,
  
  -- Full service data (JSON storage)
  service_data_json TEXT NOT NULL, -- Complete service object as JSON
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  cache_expires_at TEXT,        -- Cache expiration timestamp
  
  -- Foreign key constraints
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE SET NULL,
  
  -- Unique constraint to prevent duplicates
  UNIQUE(service_id, source_platform, start_date, service_category)
);

-- Indexes for efficient querying
CREATE INDEX idx_travel_services_trip_id ON travel_services(trip_id);
CREATE INDEX idx_travel_services_category ON travel_services(service_category);
CREATE INDEX idx_travel_services_location_dates ON travel_services(location_city, start_date, end_date);
CREATE INDEX idx_travel_services_price_range ON travel_services(total_price, currency);
CREATE INDEX idx_travel_services_rating ON travel_services(rating_overall DESC);
CREATE INDEX idx_travel_services_source ON travel_services(source_platform, created_at DESC);
CREATE INDEX idx_travel_services_session ON travel_services(search_session_id);
CREATE INDEX idx_travel_services_expires ON travel_services(cache_expires_at);
CREATE INDEX idx_travel_services_search_params ON travel_services(search_params_hash, service_category);

-- Cache management table
CREATE TABLE travel_search_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_params_hash TEXT NOT NULL UNIQUE,
  service_category TEXT NOT NULL,
  search_params_json TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  search_duration_ms INTEGER,
  extraction_confidence REAL,
  source_platform TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_accessed TEXT DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_travel_search_cache_hash ON travel_search_cache(search_params_hash);
CREATE INDEX idx_travel_search_cache_expires ON travel_search_cache(expires_at);
CREATE INDEX idx_travel_search_cache_category ON travel_search_cache(service_category);
CREATE INDEX idx_travel_search_cache_platform ON travel_search_cache(source_platform);

