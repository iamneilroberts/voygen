-- Denormalized V2 Schema for Minimal Tool Calls
-- Designed specifically for Claude Desktop to reduce conversation length

-- Main trips table with all data embedded as JSON
CREATE TABLE IF NOT EXISTS trips_v2 (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_name TEXT NOT NULL,
    status TEXT DEFAULT 'planning' CHECK(status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    
    -- Embedded client data (no joins needed)
    clients JSON NOT NULL DEFAULT '[]', -- Array of {client_id, name, email, role, preferences}
    primary_client_email TEXT, -- For quick lookup
    group_name TEXT, -- Traveling group name
    
    -- Complete schedule embedded (no day/activity tables needed)
    schedule JSON NOT NULL DEFAULT '[]', -- Array of days with embedded activities
    /* Example schedule structure:
    [{
        "day_number": 1,
        "date": "2024-03-15",
        "day_name": "Arrival in Paris",
        "activities": [
            {
                "time": "09:00",
                "type": "transportation",
                "title": "Flight from NYC",
                "description": "...",
                "location": "JFK Airport"
            }
        ],
        "accommodation": {
            "name": "Hotel Le Marais",
            "check_in": "15:00",
            "address": "..."
        },
        "meals": [...],
        "notes": "..."
    }] */
    
    -- All accommodations for the trip
    accommodations JSON DEFAULT '[]',
    
    -- All transportation for the trip  
    transportation JSON DEFAULT '[]',
    
    -- Complete financial breakdown
    financials JSON DEFAULT '{}',
    /* Example structure:
    {
        "quoted_total": 5000,
        "paid_amount": 2500,
        "balance_due": 2500,
        "currency": "USD",
        "breakdown": {
            "accommodations": 1500,
            "transportation": 1000,
            "tours": 800,
            "meals": 500,
            "other": 1200
        },
        "payment_history": [...]
    } */
    
    -- Documents and confirmations
    documents JSON DEFAULT '[]', -- Array of {type, name, url, uploaded_date}
    
    -- Notes and special requests
    notes JSON DEFAULT '{}', -- {agent_notes, client_requests, dietary, medical, etc}
    
    -- Indexed fields for searching/filtering
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    destinations TEXT, -- Comma-separated list for LIKE queries
    total_cost REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    
    -- Full text search field (auto-populated)
    search_text TEXT, -- Concatenation of all searchable content
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    last_modified_by TEXT
);

-- Indexes for performance
CREATE INDEX idx_trips_v2_dates ON trips_v2(start_date, end_date);
CREATE INDEX idx_trips_v2_status ON trips_v2(status);
CREATE INDEX idx_trips_v2_email ON trips_v2(primary_client_email);
CREATE INDEX idx_trips_v2_search ON trips_v2(search_text);
CREATE INDEX idx_trips_v2_destinations ON trips_v2(destinations);

-- Denormalized clients table
CREATE TABLE IF NOT EXISTS clients_v2 (
    client_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    
    -- All contact info in one JSON field
    contact_info JSON DEFAULT '{}',
    /* Structure:
    {
        "phone": "...",
        "address": "...",
        "city": "...",
        "state": "...",
        "postal_code": "...",
        "country": "...",
        "emergency_contact": {...}
    } */
    
    -- Travel documents
    travel_docs JSON DEFAULT '{}',
    /* Structure:
    {
        "passport": {
            "number": "encrypted...",
            "expiry": "2025-12-31",
            "country": "USA"
        },
        "visas": [...],
        "travel_insurance": {...}
    } */
    
    -- Complete trip history embedded
    trip_history JSON DEFAULT '[]',
    /* Auto-updated array of:
    [{
        "trip_id": 123,
        "trip_name": "Paris Adventure",
        "dates": "2024-03-15 to 2024-03-22",
        "destinations": "Paris, Versailles",
        "total_cost": 5000,
        "role": "primary",
        "status": "completed"
    }] */
    
    -- Preferences and notes
    preferences JSON DEFAULT '{}',
    /* Structure:
    {
        "dietary": ["vegetarian"],
        "room": ["non-smoking", "high-floor"],
        "seat": ["aisle"],
        "activities": ["museums", "walking-tours"],
        "pace": "moderate",
        "budget": "mid-range"
    } */
    
    -- Loyalty programs
    loyalty_programs JSON DEFAULT '{}',
    
    -- Search text
    search_text TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_trip_date TEXT, -- For quick sorting
    total_trips INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_clients_v2_email ON clients_v2(email);
CREATE INDEX idx_clients_v2_name ON clients_v2(full_name);
CREATE INDEX idx_clients_v2_search ON clients_v2(search_text);
CREATE INDEX idx_clients_v2_last_trip ON clients_v2(last_trip_date DESC);

-- Search acceleration table
CREATE TABLE IF NOT EXISTS search_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('trip', 'client', 'activity', 'destination')),
    entity_id INTEGER NOT NULL,
    entity_name TEXT NOT NULL,
    
    -- Pre-formatted summary for display
    summary TEXT NOT NULL,
    
    -- Search tokens (lowercase, stemmed)
    search_tokens TEXT NOT NULL,
    
    -- Context for relevance
    date_context TEXT, -- Associated dates
    location_context TEXT, -- Associated locations
    
    -- Scoring
    relevance_score REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    
    -- Metadata
    last_accessed TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(entity_type, entity_id)
);

-- Indexes for search
CREATE INDEX idx_search_tokens ON search_index(search_tokens);
CREATE INDEX idx_search_type ON search_index(entity_type);
CREATE INDEX idx_search_relevance ON search_index(relevance_score DESC);

-- Session context table (reduces repeated lookups)
CREATE TABLE IF NOT EXISTS session_context (
    session_id TEXT PRIMARY KEY,
    active_trip_id INTEGER,
    active_client_id INTEGER,
    context_data JSON DEFAULT '{}', -- Recent queries, preferences, etc
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create a super-view that returns EVERYTHING about a trip
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
    -- Calculated fields
    CAST(julianday(t.start_date) - julianday('now') AS INTEGER) as days_until_departure,
    CAST(julianday(t.end_date) - julianday(t.start_date) + 1 AS INTEGER) as trip_duration_days,
    t.search_text,
    t.created_at,
    t.updated_at
FROM trips_v2 t;

-- Document the V2 schema
INSERT OR REPLACE INTO db_documentation (object_type, object_name, parent_object, description, related_tools) VALUES
('table', 'trips_v2', NULL, 'Denormalized trips table with all data embedded as JSON - designed for single-query retrieval', 'get_trip_complete'),
('table', 'clients_v2', NULL, 'Denormalized clients table with embedded trip history and preferences', 'get_client_complete'),
('table', 'search_index', NULL, 'Pre-computed search index for instant natural language queries', 'search_everything'),
('table', 'session_context', NULL, 'Maintains context between tool calls to reduce repeated lookups', 'auto-used');

INSERT OR REPLACE INTO db_documentation (object_type, object_name, parent_object, description, data_type, is_required, related_tools) VALUES
('column', 'schedule', 'trips_v2', 'Complete trip itinerary as JSON array - no joins needed', 'JSON', 1, NULL),
('column', 'clients', 'trips_v2', 'All trip participants with their info embedded', 'JSON', 1, NULL),
('column', 'search_text', 'trips_v2', 'Pre-computed searchable text for instant full-text search', 'TEXT', 0, NULL),
('column', 'trip_history', 'clients_v2', 'Complete trip history embedded - no joins needed', 'JSON', 0, NULL);