-- Database Documentation System
-- This table stores metadata about all database objects for self-documentation

CREATE TABLE IF NOT EXISTS db_documentation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type TEXT NOT NULL CHECK(object_type IN ('table', 'column', 'view', 'index', 'tool')),
    object_name TEXT NOT NULL,
    parent_object TEXT, -- table name for columns, null for tables
    description TEXT NOT NULL,
    usage_examples TEXT,
    related_tools TEXT, -- comma-separated list of MCP tools that use this object
    data_type TEXT, -- for columns
    is_required BOOLEAN DEFAULT 0, -- for columns
    default_value TEXT, -- for columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to prevent duplicate documentation
CREATE UNIQUE INDEX idx_db_doc_unique ON db_documentation(
    object_type, 
    object_name, 
    COALESCE(parent_object, '')
);

-- Performance indexes
CREATE INDEX idx_db_doc_type ON db_documentation(object_type);
CREATE INDEX idx_db_doc_parent ON db_documentation(parent_object);
CREATE INDEX idx_db_doc_tools ON db_documentation(related_tools);

-- Insert documentation for existing core tables
INSERT OR REPLACE INTO db_documentation (object_type, object_name, description, related_tools) VALUES
-- Tables
('table', 'Trips', 'Core table storing all trip information including itinerary, costs, and status', 'get_trip_summary, get_daily_itinerary, search_trips_full_text'),
('table', 'Clients', 'Stores client personal information, contact details, and preferences', 'get_client_trip_history, search_trips_full_text'),
('table', 'TripDays', 'Individual days within a trip, linking to daily activities and accommodations', 'get_daily_itinerary, add_quick_activity'),
('table', 'TripActivities', 'Detailed activities for each trip day including timing and locations', 'get_daily_itinerary, add_quick_activity, search_trips_full_text'),
('table', 'Accommodations', 'Hotel and lodging information linked to specific trips and days', 'get_daily_itinerary, get_trip_financials'),
('table', 'Transportation', 'Flight, train, car, and other transportation details for trips', 'get_daily_itinerary, get_trip_financials'),
('table', 'Documents', 'Trip-related documents including itineraries, confirmations, and travel docs', 'get_active_trips_dashboard'),
('table', 'ClientGroups', 'Groups of clients traveling together (families, friends, etc)', 'get_trip_summary, get_client_trip_history'),
('table', 'ActivityLog', 'Audit trail of all system activities for debugging and history', 'health_check'),
('table', 'db_documentation', 'Self-documenting metadata for all database objects', 'explore_database');

-- Document important columns
INSERT OR REPLACE INTO db_documentation (object_type, object_name, parent_object, description, data_type, is_required) VALUES
-- Trips columns
('column', 'trip_id', 'Trips', 'Unique identifier for each trip', 'INTEGER', 1),
('column', 'trip_name', 'Trips', 'Human-readable name for the trip', 'TEXT', 1),
('column', 'start_date', 'Trips', 'Trip start date in YYYY-MM-DD format', 'TEXT', 1),
('column', 'end_date', 'Trips', 'Trip end date in YYYY-MM-DD format', 'TEXT', 1),
('column', 'status', 'Trips', 'Current trip status: planning, confirmed, in_progress, completed, cancelled', 'TEXT', 0),
('column', 'total_cost', 'Trips', 'Total quoted cost for the trip', 'REAL', 0),
('column', 'currency', 'Trips', 'Currency code (USD, EUR, etc)', 'TEXT', 0),
('column', 'group_id', 'Trips', 'Links to ClientGroups for group travel', 'INTEGER', 0),

-- TripActivities columns
('column', 'activity_type', 'TripActivities', 'Type: sightseeing, dining, transportation, accommodation, tour, free_time, other', 'TEXT', 1),
('column', 'is_hidden_gem', 'TripActivities', 'Boolean flag for special local recommendations', 'BOOLEAN', 0),

-- Clients columns
('column', 'email', 'Clients', 'Primary contact email address', 'TEXT', 0),
('column', 'passport_number', 'Clients', 'Encrypted passport number for international travel', 'TEXT', 0),
('column', 'preferences', 'Clients', 'JSON object storing client travel preferences', 'TEXT', 0);

-- Document the views
INSERT OR REPLACE INTO db_documentation (object_type, object_name, description, related_tools) VALUES
('view', 'trip_summary', 'Aggregated view of trips with participant counts and activity metrics', 'get_trip_summary'),
('view', 'daily_itinerary', 'Complete daily schedule joining all trip components', 'get_daily_itinerary'),
('view', 'trip_financial_summary', 'Financial breakdown by category with variance analysis', 'get_trip_financials'),
('view', 'client_trip_history', 'All trips for each client with relationship context', 'get_client_trip_history'),
('view', 'active_trips_dashboard', 'Real-time view of upcoming trips with progress metrics', 'get_active_trips_dashboard');

-- Document the tools
INSERT OR REPLACE INTO db_documentation (object_type, object_name, description, usage_examples) VALUES
('tool', 'get_trip_summary', 'Retrieves complete trip overview including participants and metrics', 'get_trip_summary(trip_id=123) or get_trip_summary(trip_name="Paris Adventure")'),
('tool', 'get_daily_itinerary', 'Returns day-by-day schedule with all activities and bookings', 'get_daily_itinerary(trip_id=123, day_number=3)'),
('tool', 'search_trips_full_text', 'Natural language search across all trip data', 'search_trips_full_text(search_query="beaches in December")'),
('tool', 'add_quick_activity', 'Quickly add an activity to a specific trip day', 'add_quick_activity(trip_id=123, day_number=2, activity_title="Eiffel Tower Visit")');