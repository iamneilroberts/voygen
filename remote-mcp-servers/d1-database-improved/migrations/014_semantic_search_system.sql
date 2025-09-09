-- PHASE 3: Semantic Search System Implementation
-- Adds component-based indexing for natural language query processing
-- Migration: 014_semantic_search_system.sql

-- Step 1: Create trip_components table for semantic indexing
CREATE TABLE trip_components (
  component_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
  component_type TEXT NOT NULL, -- 'client', 'destination', 'date', 'activity', 'cost', 'descriptor'
  component_value TEXT NOT NULL,
  search_weight REAL DEFAULT 1.0,
  synonyms TEXT, -- JSON array of synonyms
  metadata TEXT, -- JSON metadata for component
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create indexes for efficient component search
CREATE INDEX idx_trip_components_trip_id ON trip_components(trip_id);
CREATE INDEX idx_trip_components_type ON trip_components(component_type);
CREATE INDEX idx_trip_components_value ON trip_components(component_value);
CREATE INDEX idx_trip_components_weight ON trip_components(search_weight DESC);

-- Step 3: Create search_analytics table for learning system
CREATE TABLE search_analytics (
  analytics_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  search_method TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  success_score REAL, -- 0.0 to 1.0 based on user interaction
  response_time_ms INTEGER,
  components_matched TEXT, -- JSON array of matched components
  search_metadata TEXT, -- JSON metadata about search execution
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create index for search analytics
CREATE INDEX idx_search_analytics_session ON search_analytics(session_id);
CREATE INDEX idx_search_analytics_query ON search_analytics(search_query);
CREATE INDEX idx_search_analytics_method ON search_analytics(search_method);
CREATE INDEX idx_search_analytics_success ON search_analytics(success_score DESC);

-- Step 5: Create suggestion_cache table for intelligent suggestions
CREATE TABLE suggestion_cache (
  suggestion_id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_pattern TEXT NOT NULL,
  suggested_query TEXT NOT NULL,
  suggestion_type TEXT NOT NULL, -- 'autocomplete', 'typo_correction', 'semantic_expansion'
  confidence_score REAL NOT NULL, -- 0.0 to 1.0
  usage_count INTEGER DEFAULT 0,
  last_used DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 6: Create indexes for suggestion system
CREATE INDEX idx_suggestion_cache_pattern ON suggestion_cache(query_pattern);
CREATE INDEX idx_suggestion_cache_type ON suggestion_cache(suggestion_type);
CREATE INDEX idx_suggestion_cache_confidence ON suggestion_cache(confidence_score DESC);
CREATE INDEX idx_suggestion_cache_usage ON suggestion_cache(usage_count DESC);

-- Step 7: Create trigger to auto-update component updated_at
CREATE TRIGGER tr_trip_components_updated_at
  AFTER UPDATE ON trip_components
BEGIN
  UPDATE trip_components 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE component_id = NEW.component_id;
END;

-- Step 8: Create view for semantic search results
CREATE VIEW semantic_search_results AS
SELECT 
  t.trip_id,
  t.trip_name,
  t.trip_slug,
  t.destinations,
  t.start_date,
  t.end_date,
  t.status,
  t.total_cost,
  t.primary_client_email,
  GROUP_CONCAT(
    tc.component_type || ':' || tc.component_value || ':' || tc.search_weight, 
    '|'
  ) as components,
  MAX(tc.search_weight) as max_component_weight,
  COUNT(tc.component_id) as component_count
FROM trips_v2 t
LEFT JOIN trip_components tc ON t.trip_id = tc.trip_id
GROUP BY t.trip_id, t.trip_name, t.trip_slug, t.destinations, t.start_date, t.end_date, t.status, t.total_cost, t.primary_client_email;

-- Note: Component population will be handled by the semantic indexing system