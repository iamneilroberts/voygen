import { Env } from '../types';

// Embedded migration SQL content for Cloudflare Workers compatibility
const MIGRATIONS = {
  '001_hotel_cache_tables.sql': `
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
  `,
  
  '002_trip_facts_system.sql': `
    -- 002_trip_facts_system.sql
    -- Purpose: Introduce fact table and dirty-tracking for computed trip metrics
    -- FIXED: Use INTEGER trip_id and reference trips_v2 table

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS trip_facts (
      trip_id INTEGER PRIMARY KEY,
      total_nights INTEGER DEFAULT 0,
      total_hotels INTEGER DEFAULT 0,
      total_activities INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      transit_minutes INTEGER DEFAULT 0,
      last_computed DATETIME,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS facts_dirty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, reason, created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_facts_dirty_trip ON facts_dirty(trip_id);

    -- Triggers to mark facts dirty on relevant table changes
    -- NOTE: These triggers reference trips_v2, not the old Trips table
    CREATE TRIGGER IF NOT EXISTS trg_trips_ai_dirty
    AFTER INSERT ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_trips_au_dirty
    AFTER UPDATE ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_trips_ad_dirty
    AFTER DELETE ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
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
  `,
  
  '003_commission_system.sql': `
    -- 003_commission_system.sql
    -- Purpose: Commission rates and rule engine scaffolding

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS commission_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier TEXT,
      product_type TEXT, -- hotel, flight, tour, transfer, package
      rate_type TEXT CHECK(rate_type IN ('percent','fixed')) NOT NULL DEFAULT 'percent',
      rate_value REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      start_date TEXT,
      end_date TEXT,
      active BOOLEAN DEFAULT 1,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_commission_rates_lookup
      ON commission_rates(supplier, product_type, active);

    CREATE TABLE IF NOT EXISTS commission_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      priority INTEGER DEFAULT 100,
      criteria_json TEXT NOT NULL,
      rate_id INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rate_id) REFERENCES commission_rates(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commission_rules_active
      ON commission_rules(active, priority);

    -- Default data
    INSERT INTO commission_rates (supplier, product_type, rate_type, rate_value, notes)
    VALUES
      ('Generic', 'hotel', 'percent', 10.0, 'Default hotel commission'),
      ('Generic', 'tour', 'percent', 12.0, 'Default tour commission')
    ON CONFLICT DO NOTHING;

    INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
    SELECT 'Default hotel rule', 100, '{"product_type":"hotel"}', id, 1
      FROM commission_rates WHERE supplier='Generic' AND product_type='hotel'
    ON CONFLICT DO NOTHING;

    INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
    SELECT 'Default tour rule', 100, '{"product_type":"tour"}', id, 1
      FROM commission_rates WHERE supplier='Generic' AND product_type='tour'
    ON CONFLICT DO NOTHING;

    COMMIT;
  `,
  
  '004_enhanced_trip_structure.sql': `
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
  `,
  
  '005_proposal_system.sql': `
    -- 005_proposal_system.sql
    -- Purpose: Enhanced proposals with versioning and image attachments

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS proposals_enhanced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'draft', -- draft, sent, accepted, rejected
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_ver
      ON proposals_enhanced(trip_id, version);

    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals_enhanced(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals_enhanced(created_at);

    CREATE TABLE IF NOT EXISTS proposal_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (proposal_id) REFERENCES proposals_enhanced(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_proposal_images_proposal ON proposal_images(proposal_id);

    COMMIT;
  `,
  
  '006_extraction_tracking.sql': `
    -- 006_extraction_tracking.sql
    -- Purpose: Track content extraction sessions and attempts

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS extraction_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT DEFAULT 'running', -- running, success, failed
      stats_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_extraction_sessions_status ON extraction_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_extraction_sessions_time ON extraction_sessions(started_at);

    CREATE TABLE IF NOT EXISTS extraction_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      item_key TEXT NOT NULL, -- URL or external id
      status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
      error TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      attempts_count INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES extraction_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_session ON extraction_attempts(session_id);
    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_status ON extraction_attempts(status);
    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_item ON extraction_attempts(item_key);

    COMMIT;
  `,

  '007_fix_trip_facts_schema.sql': `
    -- 007_fix_trip_facts_schema.sql
    -- Purpose: Safely recreate facts tables with correct schema
    -- This is a conservative approach that just ensures tables exist with correct schema

    BEGIN TRANSACTION;

    -- Ensure facts_dirty table exists with correct schema
    CREATE TABLE IF NOT EXISTS facts_dirty_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, reason, created_at)
    );

    -- Ensure trip_facts table exists with correct schema  
    CREATE TABLE IF NOT EXISTS trip_facts_v2 (
      trip_id INTEGER PRIMARY KEY,
      total_nights INTEGER DEFAULT 0,
      total_hotels INTEGER DEFAULT 0,
      total_activities INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      transit_minutes INTEGER DEFAULT 0,
      last_computed DATETIME,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
    );

    -- Create indexes for v2 tables
    CREATE INDEX IF NOT EXISTS idx_facts_dirty_v2_trip ON facts_dirty_v2(trip_id);
    CREATE INDEX IF NOT EXISTS idx_trip_facts_v2_computed ON trip_facts_v2(last_computed);

    COMMIT;
  `,
  
  '008_fix_facts_schema_final.sql': `
    -- 008_fix_facts_schema_final.sql
    -- Purpose: Fix trip facts schema with correct INTEGER trip_id and v2 table references
    -- This replaces the broken tables from migration 002 with working ones

    BEGIN TRANSACTION;

    -- Drop existing broken tables if they exist (safe since they're not working)
    DROP TABLE IF EXISTS trip_facts;
    DROP TABLE IF EXISTS facts_dirty;

    -- Recreate with correct schema using standard names (not _v2)
    CREATE TABLE trip_facts (
      trip_id INTEGER PRIMARY KEY,
      total_nights INTEGER DEFAULT 0,
      total_hotels INTEGER DEFAULT 0,
      total_activities INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      transit_minutes INTEGER DEFAULT 0,
      last_computed DATETIME,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
    );

    CREATE TABLE facts_dirty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, reason, created_at)
    );

    -- Create indexes
    CREATE INDEX idx_facts_dirty_trip ON facts_dirty(trip_id);
    CREATE INDEX idx_trip_facts_computed ON trip_facts(last_computed);

    -- Recreate triggers with correct table references
    DROP TRIGGER IF EXISTS trg_trips_ai_dirty;
    DROP TRIGGER IF EXISTS trg_trips_au_dirty;
    DROP TRIGGER IF EXISTS trg_trips_ad_dirty;
    DROP TRIGGER IF EXISTS trg_tripdays_ai_dirty;
    DROP TRIGGER IF EXISTS trg_tripdays_au_dirty;
    DROP TRIGGER IF EXISTS trg_tripdays_ad_dirty;
    DROP TRIGGER IF EXISTS trg_activitylog_ai_dirty;
    DROP TRIGGER IF EXISTS trg_activitylog_au_dirty;
    DROP TRIGGER IF EXISTS trg_activitylog_ad_dirty;

    CREATE TRIGGER trg_trips_v2_ai_dirty
    AFTER INSERT ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
    END;

    CREATE TRIGGER trg_trips_v2_au_dirty
    AFTER UPDATE ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
    END;

    CREATE TRIGGER trg_trips_v2_ad_dirty
    AFTER DELETE ON trips_v2
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
    END;

    -- Update TripDays triggers to use trips_v2 schema (assuming TripDays.trip_id is INTEGER)
    CREATE TRIGGER trg_tripdays_ai_dirty
    AFTER INSERT ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_insert');
    END;

    CREATE TRIGGER trg_tripdays_au_dirty
    AFTER UPDATE ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_update');
    END;

    CREATE TRIGGER trg_tripdays_ad_dirty
    AFTER DELETE ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'tripday_delete');
    END;

    -- Update ActivityLog triggers (assuming ActivityLog.trip_id is INTEGER)
    CREATE TRIGGER trg_activitylog_ai_dirty
    AFTER INSERT ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_insert');
    END;

    CREATE TRIGGER trg_activitylog_au_dirty
    AFTER UPDATE ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_update');
    END;

    CREATE TRIGGER trg_activitylog_ad_dirty
    AFTER DELETE ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'activity_delete');
    END;

    COMMIT;
  `,

  '009_fix_remaining_schema_issues.sql': `
    -- 009_fix_remaining_schema_issues.sql
    -- Purpose: Fix remaining tables with TEXT trip_id fields and old table references
    -- Completes the schema consistency fixes started in migration 008

    BEGIN TRANSACTION;

    -- Fix TripDays: TEXT trip_id -> INTEGER trip_id
    DROP TABLE IF EXISTS TripDays;
    CREATE TABLE TripDays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      date TEXT,
      location TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, day_number)
    );

    CREATE INDEX idx_tripdays_trip ON TripDays(trip_id);
    CREATE INDEX idx_tripdays_date ON TripDays(date);

    -- Fix TripParticipants: TEXT trip_id -> INTEGER trip_id
    DROP TABLE IF EXISTS TripParticipants;
    CREATE TABLE TripParticipants (
      participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      role TEXT DEFAULT 'traveler',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients_v2(client_id) ON DELETE CASCADE,
      UNIQUE(trip_id, client_id)
    );

    CREATE INDEX idx_tripparticipants_trip ON TripParticipants(trip_id);
    CREATE INDEX idx_tripparticipants_client ON TripParticipants(client_id);

    -- Fix trip_activities_enhanced: TEXT trip_id -> INTEGER trip_id
    DROP TABLE IF EXISTS trip_activities_enhanced;
    CREATE TABLE trip_activities_enhanced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      day_id INTEGER,
      activity_type TEXT,
      title TEXT,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      cost REAL,
      currency TEXT DEFAULT 'USD',
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      FOREIGN KEY (day_id) REFERENCES TripDays(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_trip_activities_enhanced_trip ON trip_activities_enhanced(trip_id);
    CREATE INDEX idx_trip_activities_enhanced_day ON trip_activities_enhanced(day_id);

    -- Fix trip_legs: TEXT trip_id -> INTEGER trip_id  
    DROP TABLE IF EXISTS trip_legs;
    CREATE TABLE trip_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      leg_order INTEGER NOT NULL,
      from_location TEXT,
      to_location TEXT,
      depart_datetime TEXT,
      arrive_datetime TEXT,
      transport_mode TEXT,
      distance_km REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, leg_order)
    );

    CREATE INDEX idx_trip_legs_trip ON trip_legs(trip_id);
    CREATE INDEX idx_trip_legs_order ON trip_legs(trip_id, leg_order);

    -- Fix proposals_enhanced: TEXT trip_id -> INTEGER trip_id
    DROP TABLE IF EXISTS proposals_enhanced;
    CREATE TABLE proposals_enhanced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'draft',
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, version)
    );

    CREATE INDEX idx_proposals_enhanced_trip ON proposals_enhanced(trip_id);
    CREATE INDEX idx_proposals_enhanced_status ON proposals_enhanced(status);
    CREATE INDEX idx_proposals_enhanced_created ON proposals_enhanced(created_at);

    -- Add missing core tables for completeness

    -- TripCosts: Essential for financial tracking
    CREATE TABLE IF NOT EXISTS TripCosts (
      cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      cost_type TEXT NOT NULL, -- accommodation, transport, activity, meal, misc
      description TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      cost_date TEXT,
      vendor TEXT,
      payment_status TEXT DEFAULT 'pending', -- pending, paid, cancelled
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_tripcosts_trip ON TripCosts(trip_id);
    CREATE INDEX idx_tripcosts_type ON TripCosts(cost_type);
    CREATE INDEX idx_tripcosts_status ON TripCosts(payment_status);

    -- BookingHistory: Essential for booking status tracking
    CREATE TABLE IF NOT EXISTS BookingHistory (
      booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      booking_type TEXT NOT NULL, -- hotel, flight, tour, transfer, package
      external_booking_id TEXT,
      vendor TEXT,
      status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled, completed
      booking_date TEXT,
      confirmation_number TEXT,
      amount REAL,
      currency TEXT DEFAULT 'USD',
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_bookinghistory_trip ON BookingHistory(trip_id);
    CREATE INDEX idx_bookinghistory_type ON BookingHistory(booking_type);
    CREATE INDEX idx_bookinghistory_status ON BookingHistory(status);
    CREATE INDEX idx_bookinghistory_vendor ON BookingHistory(vendor);

    -- Update fact triggers to use correct table names (they were already mostly correct)
    -- ActivityLog already has INTEGER trip_id, so its triggers in migration 008 are correct

    -- Add new triggers for the fixed tables
    CREATE TRIGGER trg_tripcosts_ai_dirty
    AFTER INSERT ON TripCosts
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'cost_insert');
    END;

    CREATE TRIGGER trg_tripcosts_au_dirty
    AFTER UPDATE ON TripCosts
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'cost_update');
    END;

    CREATE TRIGGER trg_tripcosts_ad_dirty
    AFTER DELETE ON TripCosts
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'cost_delete');
    END;

    CREATE TRIGGER trg_bookinghistory_ai_dirty
    AFTER INSERT ON BookingHistory
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'booking_insert');
    END;

    CREATE TRIGGER trg_bookinghistory_au_dirty
    AFTER UPDATE ON BookingHistory
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'booking_update');
    END;

    CREATE TRIGGER trg_bookinghistory_ad_dirty
    AFTER DELETE ON BookingHistory
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'booking_delete');
    END;

    CREATE TRIGGER trg_trip_activities_enhanced_ai_dirty
    AFTER INSERT ON trip_activities_enhanced
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_insert');
    END;

    CREATE TRIGGER trg_trip_activities_enhanced_au_dirty
    AFTER UPDATE ON trip_activities_enhanced
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_update');
    END;

    CREATE TRIGGER trg_trip_activities_enhanced_ad_dirty
    AFTER DELETE ON trip_activities_enhanced
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'activity_delete');
    END;

    COMMIT;
  `,

  '010_travel_services_core.sql': `
    -- 010_travel_services_core.sql
    -- Purpose: Create unified travel services tables with migration from existing hotel_cache

    BEGIN TRANSACTION;

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

    COMMIT;
  `,

  '011_migrate_hotel_data.sql': `
    -- 011_migrate_hotel_data.sql
    -- Purpose: Migrate existing hotel_cache data to new travel_services table

    BEGIN TRANSACTION;

    -- Migrate hotel data from hotel_cache to travel_services
    INSERT INTO travel_services (
      service_id, service_category, service_name, service_description,
      base_price, total_price, currency,
      is_available, start_date, end_date,
      location_city, location_state, location_country,
      latitude, longitude,
      rating_overall, rating_source,
      source_platform, source_url,
      service_data_json,
      created_at, updated_at, cache_expires_at
    )
    SELECT 
      provider_hotel_id,
      'hotel',
      name,
      COALESCE(region, ''),
      COALESCE((
        SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id
      ), 0),
      COALESCE((
        SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id  
      ), 0),
      'USD',
      1,
      date('now'),
      date('now', '+1 day'),
      city,
      region,
      country,
      latitude,
      longitude,
      stars,
      provider,
      provider,
      NULL,
      json_object(
        'id', provider_hotel_id,
        'category', 'hotel',
        'name', name,
        'description', COALESCE(region, ''),
        'location', json_object(
          'address', json_object(
            'city', city,
            'state', region,
            'country', country,
            'full', COALESCE(city || ', ' || region || ', ' || country, city || ', ' || country)
          ),
          'coordinates', CASE 
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
            THEN json_object('latitude', latitude, 'longitude', longitude)
            ELSE NULL
          END
        ),
        'hotelDetails', json_object(
          'starRating', stars,
          'propertyType', 'hotel'
        ),
        'pricing', json_object(
          'basePrice', json_object(
            'amount', COALESCE((SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id), 0),
            'currency', 'USD',
            'unit', 'per night'
          ),
          'totalPrice', json_object(
            'amount', COALESCE((SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id), 0),
            'currency', 'USD'
          )
        ),
        'availability', json_object(
          'available', true,
          'startDate', date('now'),
          'endDate', date('now', '+1 day')
        ),
        'rooms', COALESCE((
          SELECT json_group_array(
            json_object(
              'type', room_type,
              'maxOccupancy', occupancy,
              'pricing', json_object(
                'amount', price,
                'currency', currency
              ),
              'policies', json_object(
                'refundable', refundable
              ),
              'amenities', CASE WHEN includes_breakfast = 1 THEN json_array('breakfast') ELSE json_array() END
            )
          )
          FROM rooms_cache r WHERE r.hotel_id = h.id
        ), json_array()),
        'source', json_object(
          'platform', provider,
          'lastUpdated', last_updated
        ),
        'extraction', json_object(
          'confidence', 0.8,
          'completeness', 0.7
        )
      ),
      last_updated,
      last_updated,
      datetime('now', '+24 hours') -- 24 hour cache expiry for migrated data
    FROM hotel_cache h
    WHERE h.id IS NOT NULL;

    -- Update extraction confidence based on data completeness
    UPDATE travel_services 
    SET 
      extraction_confidence = CASE
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
        WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.8
        ELSE 0.7
      END,
      data_completeness = CASE
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
        WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.7
        ELSE 0.5
      END
    WHERE service_category = 'hotel'
      AND created_at >= datetime('now', '-1 minute'); -- Only update newly migrated records

    COMMIT;
  `,

  '012_travel_services_triggers.sql': `
    -- 012_travel_services_triggers.sql
    -- Purpose: Integrate travel services with existing facts system

    BEGIN TRANSACTION;

    -- Add travel services to facts dirty tracking
    CREATE TRIGGER trg_travel_services_ai_dirty
    AFTER INSERT ON travel_services
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) 
      VALUES (NEW.trip_id, 'travel_service_insert')
      WHERE NEW.trip_id IS NOT NULL;
    END;

    CREATE TRIGGER trg_travel_services_au_dirty
    AFTER UPDATE ON travel_services
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) 
      VALUES (NEW.trip_id, 'travel_service_update')
      WHERE NEW.trip_id IS NOT NULL;
    END;

    CREATE TRIGGER trg_travel_services_ad_dirty
    AFTER DELETE ON travel_services
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) 
      VALUES (OLD.trip_id, 'travel_service_delete')
      WHERE OLD.trip_id IS NOT NULL;
    END;

    -- Auto-update timestamps on service updates
    CREATE TRIGGER trg_travel_services_update_timestamp
    BEFORE UPDATE ON travel_services
    BEGIN
      UPDATE travel_services 
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;

    -- Clean expired cache entries automatically (run occasionally)
    CREATE TRIGGER trg_travel_search_cache_cleanup
    AFTER INSERT ON travel_search_cache
    WHEN NEW.id % 100 = 0  -- Only run cleanup every 100 inserts
    BEGIN
      DELETE FROM travel_search_cache 
      WHERE expires_at < datetime('now')
        AND id != NEW.id;
      
      DELETE FROM travel_services 
      WHERE cache_expires_at < datetime('now')
        AND trip_id IS NULL; -- Only clean unassigned cached results
    END;

    -- Update search cache access tracking
    CREATE TRIGGER trg_travel_search_cache_update_access
    BEFORE UPDATE ON travel_search_cache
    WHEN NEW.last_accessed != OLD.last_accessed
    BEGIN
      UPDATE travel_search_cache
      SET access_count = access_count + 1
      WHERE id = NEW.id;
    END;

    COMMIT;
  `
};

const MIGRATION_FILES = Object.keys(MIGRATIONS);

export class MigrationRunner {
  constructor(private env: Env) {}

  async ensureTrackingTable(): Promise<void> {
    await this.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }

  async appliedMigrations(): Promise<Set<string>> {
    await this.ensureTrackingTable();
    const rows: { name: string }[] = await this.env.DB.prepare(
      'SELECT name FROM schema_migrations'
    ).all().then((r: any) => r.results || r)
      .catch(() => []);
    return new Set((rows || []).map((r) => r.name));
  }

  async applyPending(): Promise<{ applied: string[] }> {
    const applied = await this.appliedMigrations();
    const did: string[] = [];

    console.log(`Checking migrations. Applied migrations:`, Array.from(applied));
    console.log(`Available migrations:`, MIGRATION_FILES);

    for (const file of MIGRATION_FILES) {
      if (applied.has(file)) {
        console.log(`Migration ${file} already applied, skipping`);
        continue;
      }
      const sql = MIGRATIONS[file as keyof typeof MIGRATIONS];
      if (!sql) {
        console.log(`No SQL content found for ${file}, skipping`);
        continue;
      }
      
      try {
        console.log(`Applying migration ${file}...`);
        await this.executeScript(sql);
        await this.env.DB.prepare('INSERT INTO schema_migrations(name) VALUES (?)').bind(file).run();
        console.log(`Successfully applied migration ${file}`);
        did.push(file);
      } catch (error) {
        console.error(`Failed to apply migration ${file}:`, error);
        throw new Error(`Migration ${file} failed: ${error}`);
      }
    }
    return { applied: did };
  }

  private async executeScript(sql: string) {
    // First, remove transaction control statements entirely
    const cleanedSql = sql
      .replace(/^\s*BEGIN TRANSACTION\s*;?\s*$/gm, '')
      .replace(/^\s*COMMIT\s*;?\s*$/gm, '');
    
    // Split into statements, but handle triggers specially
    const statements: string[] = [];
    let current = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    const lines = cleanedSql.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('--')) continue;
      
      current += line + '\n';
      
      // Track trigger blocks
      if (trimmed.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
        triggerDepth = 0;
      }
      
      if (inTrigger) {
        if (trimmed.toUpperCase() === 'BEGIN') {
          triggerDepth++;
        } else if (trimmed.toUpperCase() === 'END' || trimmed.toUpperCase() === 'END;') {
          triggerDepth--;
          if (triggerDepth <= 0) {
            inTrigger = false;
            // Complete trigger statement
            statements.push(current.trim());
            current = '';
          }
        }
      } else if (trimmed.endsWith(';')) {
        // Regular statement ending with semicolon
        statements.push(current.trim());
        current = '';
      }
    }
    
    // Add any remaining statement
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    for (const stmt of statements) {
      if (!stmt) continue;
      // Remove trailing semicolon for consistency
      const cleanStmt = stmt.replace(/;\s*$/, '');
      if (!cleanStmt.trim()) continue;
      
      try {
        console.log(`Executing: ${cleanStmt.substring(0, 100).replace(/\n/g, ' ')}...`);
        await this.env.DB.prepare(cleanStmt).run();
      } catch (e) {
        console.error(`Failed to execute statement: ${cleanStmt}`);
        console.error(`Error details:`, e);
        throw e;
      }
    }
  }
}

