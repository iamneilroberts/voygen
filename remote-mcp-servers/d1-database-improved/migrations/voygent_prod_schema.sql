-- Voygent Production Schema (optimized, minimally breaking)
-- Focus: stable v2 tables, LLM context, search, proposals, hotel cache, facts
-- Notes:
-- - Keeps existing tool-visible names to avoid breaking MCP servers
-- - Removes legacy/experimental tables (Trips/Clients v1, unused engines)
-- - Consolidates facts tables to a single consistent pair

PRAGMA defer_foreign_keys=TRUE;

-- Schema tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Core: Clients (denormalized)
CREATE TABLE IF NOT EXISTS clients_v2 (
  client_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  contact_info JSON DEFAULT '{}',
  travel_docs JSON DEFAULT '{}',
  trip_history JSON DEFAULT '[]',
  preferences JSON DEFAULT '{}',
  loyalty_programs JSON DEFAULT '{}',
  search_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_trip_date TEXT,
  total_trips INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_v2_email ON clients_v2(email);
CREATE INDEX IF NOT EXISTS idx_clients_v2_name ON clients_v2(full_name);
CREATE INDEX IF NOT EXISTS idx_clients_v2_search ON clients_v2(search_text);
CREATE INDEX IF NOT EXISTS idx_clients_v2_last_trip ON clients_v2(last_trip_date DESC);

-- Core: Trips (denormalized)
CREATE TABLE IF NOT EXISTS trips_v2 (
  trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_name TEXT NOT NULL,
  status TEXT DEFAULT 'planning' CHECK(status IN ('planning','confirmed','in_progress','completed','cancelled')),
  clients JSON NOT NULL DEFAULT '[]',
  primary_client_email TEXT,
  group_name TEXT,
  schedule JSON NOT NULL DEFAULT '[]',
  accommodations JSON DEFAULT '[]',
  transportation JSON DEFAULT '[]',
  financials JSON DEFAULT '{}',
  documents JSON DEFAULT '[]',
  notes JSON DEFAULT '{}',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  destinations TEXT,
  total_cost REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  search_text TEXT,
  -- Publication/search extras used by tools
  workflow_state JSON DEFAULT NULL,
  dashboard_status TEXT CHECK(dashboard_status IN ('proposal','confirmed','deposit_paid','paid_in_full','active','past','no_sale')),
  published_url TEXT,
  last_published TIMESTAMP,
  publication_filename TEXT,
  trip_slug TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  last_modified_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_trips_v2_dates ON trips_v2(start_date,end_date);
CREATE INDEX IF NOT EXISTS idx_trips_v2_status ON trips_v2(status);
CREATE INDEX IF NOT EXISTS idx_trips_v2_email ON trips_v2(primary_client_email);
CREATE INDEX IF NOT EXISTS idx_trips_v2_search ON trips_v2(search_text);
CREATE INDEX IF NOT EXISTS idx_trips_v2_destinations ON trips_v2(destinations);
CREATE INDEX IF NOT EXISTS idx_trips_slug ON trips_v2(trip_slug);

-- Assignment bridge (normalized) + JSON sync triggers
CREATE TABLE IF NOT EXISTS trip_client_assignments (
  assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  client_email TEXT NOT NULL,
  client_role TEXT DEFAULT 'traveler',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
  FOREIGN KEY (client_email) REFERENCES clients_v2(email) ON DELETE CASCADE,
  UNIQUE(trip_id, client_email, client_role)
);

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_insert
AFTER INSERT ON trip_client_assignments
BEGIN
  UPDATE trips_v2 
  SET 
    clients = CASE
      WHEN clients = '[]' OR clients IS NULL THEN
        JSON_ARRAY(JSON_OBJECT('email', NEW.client_email,'role', NEW.client_role,'assigned_at', NEW.created_at))
      ELSE
        JSON_INSERT(clients, '$[#]', JSON_OBJECT('email', NEW.client_email,'role', NEW.client_role,'assigned_at', NEW.created_at))
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE trip_id = NEW.trip_id 
    AND NOT EXISTS (
      SELECT 1 FROM JSON_EACH(clients)
      WHERE JSON_EXTRACT(value,'$.email') = NEW.client_email
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_delete
AFTER DELETE ON trip_client_assignments
BEGIN
  UPDATE trips_v2
  SET 
    clients = (
      SELECT JSON_GROUP_ARRAY(value)
      FROM JSON_EACH(clients)
      WHERE JSON_EXTRACT(value,'$.email') != OLD.client_email
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE trip_id = OLD.trip_id;
END;

-- Activity log (used by tools for recent activity)
CREATE TABLE IF NOT EXISTS ActivityLog (
  activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  client_id INTEGER,
  trip_id INTEGER,
  activity_type TEXT,
  activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details TEXT,
  FOREIGN KEY (client_id) REFERENCES clients_v2(client_id),
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id)
);

CREATE INDEX IF NOT EXISTS idx_activitylog_trip ON ActivityLog(trip_id);
CREATE INDEX IF NOT EXISTS idx_activitylog_time ON ActivityLog(activity_timestamp);

-- Facts system (single, consistent)
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
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_facts_dirty_trip ON facts_dirty(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_facts_computed ON trip_facts(last_computed);

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_ai_dirty
AFTER INSERT ON trips_v2 BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_au_dirty
AFTER UPDATE ON trips_v2 BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_trips_v2_ad_dirty
AFTER DELETE ON trips_v2 BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_activitylog_ai_dirty
AFTER INSERT ON ActivityLog BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_activitylog_au_dirty
AFTER UPDATE ON ActivityLog BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_update');
END;

CREATE TRIGGER IF NOT EXISTS trg_activitylog_ad_dirty
AFTER DELETE ON ActivityLog BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'activity_delete');
END;

-- Publication tracking derived from status
CREATE TRIGGER IF NOT EXISTS update_publication_tracking 
AFTER UPDATE OF status ON trips_v2 
FOR EACH ROW WHEN OLD.status != NEW.status
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

-- Hotel cache (used by proposal generation)
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
  raw_json TEXT,
  trip_id INTEGER,
  giata_id TEXT,
  json TEXT,
  lead_price_amount REAL,
  lead_price_currency TEXT DEFAULT 'USD',
  refundable BOOLEAN DEFAULT 0,
  commission_amount REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_cache_provider_key ON hotel_cache(provider, provider_hotel_id);
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
  trip_id INTEGER,
  hotel_key TEXT,
  site TEXT,
  room_name TEXT,
  json TEXT,
  nightly_rate REAL,
  total_price REAL,
  commission_amount REAL,
  commission_percent REAL,
  cancellation_deadline TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotel_cache(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rooms_cache_hotel ON rooms_cache(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_cache_updated ON rooms_cache(last_updated);

-- Costs and bookings (referenced by tools and facts)
CREATE TABLE IF NOT EXISTS TripCosts (
  cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  cost_type TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  cost_date TEXT,
  vendor TEXT,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tripcosts_trip ON TripCosts(trip_id);
CREATE INDEX IF NOT EXISTS idx_tripcosts_type ON TripCosts(cost_type);
CREATE INDEX IF NOT EXISTS idx_tripcosts_status ON TripCosts(payment_status);

CREATE TRIGGER IF NOT EXISTS trg_tripcosts_ai_dirty
AFTER INSERT ON TripCosts BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'cost_insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_tripcosts_au_dirty
AFTER UPDATE ON TripCosts BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'cost_update');
END;
CREATE TRIGGER IF NOT EXISTS trg_tripcosts_ad_dirty
AFTER DELETE ON TripCosts BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'cost_delete');
END;

CREATE TABLE IF NOT EXISTS BookingHistory (
  booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  booking_type TEXT NOT NULL,
  external_booking_id TEXT,
  vendor TEXT,
  status TEXT DEFAULT 'pending',
  booking_date TEXT,
  confirmation_number TEXT,
  amount REAL,
  currency TEXT DEFAULT 'USD',
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookinghistory_trip ON BookingHistory(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookinghistory_type ON BookingHistory(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookinghistory_status ON BookingHistory(status);
CREATE INDEX IF NOT EXISTS idx_bookinghistory_vendor ON BookingHistory(vendor);

CREATE TRIGGER IF NOT EXISTS trg_bookinghistory_ai_dirty
AFTER INSERT ON BookingHistory BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'booking_insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_bookinghistory_au_dirty
AFTER UPDATE ON BookingHistory BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'booking_update');
END;
CREATE TRIGGER IF NOT EXISTS trg_bookinghistory_ad_dirty
AFTER DELETE ON BookingHistory BEGIN
  INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'booking_delete');
END;

-- LLM optimization tables
CREATE TABLE IF NOT EXISTS llm_trip_context (
  context_id INTEGER PRIMARY KEY AUTOINCREMENT,
  natural_key TEXT NOT NULL,
  formatted_response TEXT NOT NULL,
  raw_data JSON,
  search_keywords TEXT,
  context_type TEXT CHECK(context_type IN ('trip_full','client_profile','quick_answer')),
  relevance_date TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_accessed TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_natural ON llm_trip_context(natural_key);
CREATE INDEX IF NOT EXISTS idx_llm_keywords ON llm_trip_context(search_keywords);
CREATE INDEX IF NOT EXISTS idx_llm_active_date ON llm_trip_context(is_active, relevance_date);

CREATE TABLE IF NOT EXISTS llm_conversation_memory (
  memory_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  memory_context TEXT NOT NULL,
  learned_facts JSON DEFAULT '[]',
  active_entities JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS llm_faq_cache (
  question_pattern TEXT PRIMARY KEY,
  answer_template TEXT NOT NULL,
  sql_query TEXT,
  last_used TIMESTAMP,
  use_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS llm_query_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_text TEXT NOT NULL,
  query_lower TEXT NOT NULL,
  matched_pattern TEXT,
  was_cached BOOLEAN DEFAULT 0,
  cache_source TEXT,
  result_count INTEGER,
  execution_time_ms INTEGER,
  total_tokens_used INTEGER,
  user_satisfaction TEXT,
  session_id TEXT,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON llm_query_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_log_cached ON llm_query_log(was_cached);
CREATE INDEX IF NOT EXISTS idx_query_log_pattern ON llm_query_log(matched_pattern);

CREATE TABLE IF NOT EXISTS llm_failed_queries (
  query_text TEXT PRIMARY KEY,
  query_lower TEXT NOT NULL,
  failure_count INTEGER DEFAULT 1,
  first_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  potential_pattern TEXT,
  suggested_sql TEXT,
  common_terms TEXT,
  query_category TEXT,
  review_status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_count ON llm_failed_queries(failure_count DESC);
CREATE INDEX IF NOT EXISTS idx_failed_status ON llm_failed_queries(review_status);

CREATE TABLE IF NOT EXISTS llm_query_sessions (
  session_id TEXT PRIMARY KEY,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  query_count INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  total_time_ms INTEGER DEFAULT 0,
  context_data TEXT
);

CREATE TABLE IF NOT EXISTS llm_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search index (precomputed)
CREATE TABLE IF NOT EXISTS search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('trip','client','activity','destination')),
  entity_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  search_tokens TEXT NOT NULL,
  date_context TEXT,
  location_context TEXT,
  relevance_score REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_search_tokens ON search_index(search_tokens);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_relevance ON search_index(relevance_score DESC);

-- Templates used by template-document MCP
CREATE TABLE IF NOT EXISTS HtmlDocumentTemplates (
  template_id TEXT PRIMARY KEY,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  html_template TEXT NOT NULL,
  css_styles TEXT,
  javascript_code TEXT,
  variables TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_type ON HtmlDocumentTemplates(template_type);
CREATE INDEX IF NOT EXISTS idx_template_active ON HtmlDocumentTemplates(is_active);

-- Simple proposals table (used by proposal-tools save)
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT UNIQUE NOT NULL,
  trip_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  rendered_html TEXT NOT NULL,
  json_payload TEXT NOT NULL,
  total_cost REAL,
  total_commission REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Helpful composite index for confirmed upcoming trips with commission
CREATE INDEX IF NOT EXISTS idx_trips_v2_commission 
ON trips_v2(status, start_date) 
WHERE json_extract(financials, '$.commission_amount') > 0;

PRAGMA defer_foreign_keys=FALSE;

