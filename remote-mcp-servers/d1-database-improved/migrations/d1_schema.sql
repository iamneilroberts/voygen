PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE SessionManagement (
   session_id TEXT PRIMARY KEY,
   start_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   last_activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   session_name TEXT,
   primary_trip_id INTEGER,
   primary_client_id INTEGER,
   session_summary TEXT,
   is_active BOOLEAN DEFAULT 1,
   FOREIGN KEY (primary_trip_id) REFERENCES Trips(trip_id),
   FOREIGN KEY (primary_client_id) REFERENCES Clients(client_id)
);
CREATE TABLE email_processing_log (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  email_subject TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  intent_detected TEXT,
  confidence_score REAL,
  actions_taken TEXT, -- JSON array of actions
  original_content TEXT,
  extracted_data TEXT, -- JSON
  status TEXT DEFAULT 'processed',
  rollback_data TEXT, -- JSON for rollback
  error_message TEXT,
  user_instructions TEXT
);
CREATE TABLE processed_emails (
  message_id TEXT PRIMARY KEY,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'processed',
  log_entry_id TEXT
);
CREATE TABLE instruction_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, workflow_phase TEXT DEFAULT NULL, workflow_step INTEGER DEFAULT NULL);
CREATE TABLE commission_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE instruction_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruction_id INTEGER,
    instruction_name TEXT,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    context TEXT, -- JSON
    FOREIGN KEY (instruction_id) REFERENCES instruction_sets(id) ON DELETE SET NULL
);
CREATE TABLE db_errors (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					error_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					attempted_operation TEXT NOT NULL,
					error_message TEXT NOT NULL,
					sql_query TEXT,
					table_names TEXT,
					column_names TEXT,
					suggested_tool TEXT,
					context TEXT,
					resolved BOOLEAN DEFAULT 0,
					resolution TEXT,
					session_id TEXT,
					mcp_server TEXT DEFAULT 'd1-database-improved'
				);
CREATE TABLE db_documentation (
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
CREATE TABLE trips_v2 (
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
, workflow_state JSON DEFAULT NULL, dashboard_status TEXT CHECK(dashboard_status IN ('proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past', 'no_sale')), published_url TEXT, last_published TIMESTAMP, publication_filename TEXT, trip_slug TEXT);
CREATE TABLE clients_v2 (
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
CREATE TABLE llm_trip_context (
    context_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Natural language identifiers (LLMs don't care about IDs)
    natural_key TEXT NOT NULL, -- "Smith family Hawaii trip" or "john@email.com"
    
    -- The entire context as a single formatted text block
    formatted_response TEXT NOT NULL,
    /* Example:
    "TRIP: Smith Family Hawaii Vacation (Dec 15-22, 2024)
    STATUS: Confirmed | COST: $12,500 (Paid: $7,500, Due: $5,000)
    
    TRAVELERS: John Smith (john@email.com), Jane Smith, Kids: Emma (12), Lucas (10)
    
    ITINERARY:
    Day 1 (Dec 15): Arrival
    - 10:00 AM: Depart JFK on UA123
    - 2:00 PM: Arrive HNL
    - 3:30 PM: Check in Grand Wailea Resort (Conf: GW123456)
    - 6:00 PM: Welcome dinner at hotel
    
    Day 2 (Dec 16): Pearl Harbor & Honolulu
    - 8:00 AM: Pearl Harbor tour (prepaid, conf: PH789)
    - 1:00 PM: Lunch at Rainbow Drive-In
    - 3:00 PM: Waikiki Beach time
    - 7:00 PM: Dinner at Alan Wong's (reservation needed)
    
    [... complete itinerary ...]
    
    ACCOMMODATIONS:
    - Grand Wailea Resort: Dec 15-22, Ocean View Suite, $650/night
    
    FLIGHTS:
    - UA123: JFK-HNL Dec 15, 10:00 AM
    - UA456: HNL-JFK Dec 22, 11:00 PM
    
    NOTES:
    - Dietary: Jane is vegetarian, Lucas has nut allergy
    - Preferences: High floor rooms, aisle seats
    - Special: Celebrating John's 40th birthday on Dec 18"
    */
    
    -- Structured data for when we need it (but try not to)
    raw_data JSON,
    
    -- Search optimization
    search_keywords TEXT, -- "smith hawaii december waikiki pearl harbor"
    
    -- Context type for filtering
    context_type TEXT CHECK(context_type IN ('trip_full', 'client_profile', 'quick_answer')),
    
    -- Temporal relevance
    relevance_date TEXT, -- Start date for trips, last trip date for clients
    is_active BOOLEAN DEFAULT 1,
    
    -- Metadata
    last_accessed TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Auto-cleanup old contexts
);
CREATE TABLE llm_conversation_memory (
    memory_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    
    -- What the LLM should "remember" about this conversation
    memory_context TEXT NOT NULL,
    /* Example:
    "Working with: Smith family Hawaii trip
    Recent actions:
    - Added snorkeling activity on Day 3
    - Changed hotel to ocean view
    - Noted Lucas's nut allergy
    Current focus: Planning Day 4 activities
    Preferences discovered: Family prefers active mornings, relaxed afternoons"
    */
    
    -- Facts extracted from conversation
    learned_facts JSON DEFAULT '[]',
    /* Example:
    [
        {"type": "preference", "subject": "Smith family", "fact": "prefers beaches over hiking"},
        {"type": "constraint", "subject": "Lucas Smith", "fact": "nut allergy"},
        {"type": "budget", "subject": "trip", "fact": "trying to stay under $15k total"}
    ]
    */
    
    -- Quick lookup cache
    active_entities JSON DEFAULT '{}',
    /* Example:
    {
        "trip_id": 123,
        "trip_name": "Smith Family Hawaii",
        "client_emails": ["john@email.com", "jane@email.com"],
        "current_day": 4,
        "last_activity": "snorkeling"
    }
    */
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE llm_faq_cache (
    question_pattern TEXT PRIMARY KEY,
    answer_template TEXT NOT NULL,
    sql_query TEXT, -- Query to fill in the template
    last_used TIMESTAMP,
    use_count INTEGER DEFAULT 0
);
CREATE TABLE migration_status (
    migration_id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    records_processed INTEGER
);
CREATE TABLE system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE llm_query_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    query_lower TEXT NOT NULL, -- Lowercase for analysis
    matched_pattern TEXT, -- Which FAQ pattern matched (if any)
    was_cached BOOLEAN DEFAULT 0,
    cache_source TEXT, -- 'faq_cache', 'trip_context', 'partial_match', etc.
    result_count INTEGER,
    execution_time_ms INTEGER,
    total_tokens_used INTEGER,
    user_satisfaction TEXT, -- To be added later: 'helpful', 'not_helpful', null
    session_id TEXT,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE llm_failed_queries (
    query_text TEXT PRIMARY KEY,
    query_lower TEXT NOT NULL,
    failure_count INTEGER DEFAULT 1,
    first_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_failed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Analysis fields
    potential_pattern TEXT, -- Suggested pattern from analysis
    suggested_sql TEXT, -- Potential SQL query
    common_terms TEXT, -- Extracted keywords
    query_category TEXT, -- 'client', 'trip', 'commission', etc.
    
    -- Status
    review_status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'promoted', 'rejected'
    reviewed_by TEXT,
    review_notes TEXT
);
CREATE TABLE llm_query_sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    query_count INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    total_time_ms INTEGER DEFAULT 0,
    context_data TEXT -- JSON with session context
);
CREATE TABLE llm_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE system_status (
    session_id TEXT PRIMARY KEY,
    current_mode TEXT DEFAULT 'llm_optimized' 
        CHECK(current_mode IN ('llm_optimized', 'traditional_sql', 'compare_both')),
    active_trip_id INTEGER,
    active_trip_name TEXT,
    current_stage TEXT CHECK(current_stage IN 
        ('idle', 'planning', 'booking_flights', 'booking_hotels', 'booking_activities', 'finalizing', 'complete') OR current_stage IS NULL),
    progress_percentage INTEGER DEFAULT 0 CHECK(progress_percentage >= 0 AND progress_percentage <= 100),
    performance_metrics TEXT DEFAULT '{}',  -- JSON stored as TEXT
    context_summary TEXT DEFAULT '{}',      -- JSON stored as TEXT
    last_activity TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE session_indicator_state (
    session_id TEXT PRIMARY KEY,
    total_queries INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    total_response_time_ms INTEGER DEFAULT 0,
    learned_facts TEXT DEFAULT '[]',     -- JSON array stored as TEXT
    recent_actions TEXT DEFAULT '[]',    -- JSON array stored as TEXT
    active_since DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_indicator_shown DATETIME,
    FOREIGN KEY (session_id) REFERENCES system_status(session_id)
);
CREATE TABLE query_performance_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    query_type TEXT NOT NULL,
    method_used TEXT CHECK(method_used IN (
        'faq_cache', 
        'llm_context', 
        'direct_query', 
        'traditional_sql',
        'word_search',
        'not_found',
        'error',
        'memory_store',
        'bulk_operations',
        'partial_match'
    )),
    response_time_ms INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT FALSE,
    rows_returned INTEGER DEFAULT 0,
    error_occurred BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE HtmlDocumentTemplates (
    template_id TEXT PRIMARY KEY,
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    html_template TEXT NOT NULL,
    css_styles TEXT,
    javascript_code TEXT,
    variables TEXT, -- JSON array of required variables
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE maintenance_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_type TEXT NOT NULL,
          report_data TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE provider_knowledge (
  provider_id INTEGER PRIMARY KEY,
  provider_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  provider_type TEXT NOT NULL, -- 'hotel', 'flight', 'activity', 'restaurant', 'transport'
  
  -- Site Patterns
  url_patterns JSON NOT NULL, -- Array of URL pattern objects with regex/glob patterns
  extraction_rules JSON NOT NULL, -- XPath/CSS selectors for data extraction
  rate_limits JSON, -- Rate limiting configuration
  
  -- Progressive Learning
  success_rate REAL DEFAULT 0.0, -- Success rate for extractions (0.0-1.0)
  total_attempts INTEGER DEFAULT 0,
  successful_extractions INTEGER DEFAULT 0,
  last_extraction_at TIMESTAMP,
  
  -- Content Patterns
  content_selectors JSON, -- CSS/XPath selectors for key content
  price_patterns JSON, -- Regex patterns for price extraction
  availability_patterns JSON, -- Patterns for availability detection
  
  -- Quality Metrics
  data_quality_score REAL DEFAULT 0.0, -- Quality score (0.0-1.0)
  confidence_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  validation_rules JSON, -- Rules for validating extracted data
  
  -- Metadata
  search_text TEXT, -- For FTS queries
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  last_modified_by TEXT
);
CREATE TABLE trip_products (
  product_id INTEGER PRIMARY KEY,
  trip_id INTEGER,
  provider_id INTEGER,
  
  -- Product Identification
  product_type TEXT NOT NULL, -- 'hotel', 'flight', 'activity', 'restaurant', 'transport'
  external_product_id TEXT, -- Provider's product ID
  product_name TEXT NOT NULL,
  product_url TEXT,
  
  -- Location Data
  destination_city TEXT,
  destination_country TEXT,
  coordinates TEXT, -- "lat,lng" format for mapping
  
  -- Date/Time Information
  search_date TEXT, -- When this was searched (YYYY-MM-DD)
  travel_date TEXT, -- When travel occurs (YYYY-MM-DD)
  search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 3-Tier Pricing Structure
  pricing_tiers JSON NOT NULL, -- Structure: {"budget": {price, currency, features}, "standard": {...}, "premium": {...}}
  budget_price REAL, -- Extracted for quick filtering
  standard_price REAL,
  premium_price REAL,
  currency TEXT DEFAULT 'USD',
  
  -- Product Details
  product_details JSON, -- Full product information (description, amenities, etc.)
  availability_status TEXT DEFAULT 'available', -- 'available', 'limited', 'unavailable', 'unknown'
  capacity_info JSON, -- {"available_slots": 10, "total_capacity": 50, "waitlist": false}
  
  -- Quality and Validation
  data_quality_score REAL DEFAULT 0.0, -- 0.0-1.0 quality score
  last_validated_at TIMESTAMP,
  validation_status TEXT DEFAULT 'pending', -- 'pending', 'validated', 'failed', 'stale'
  
  -- Search Context
  search_parameters JSON, -- Original search criteria that found this product
  relevance_score REAL DEFAULT 0.0, -- How well this matches the search (0.0-1.0)
  recommendation_tier TEXT, -- 'highly_recommended', 'recommended', 'alternative', 'fallback'
  
  -- Cache Management
  cache_expiry TIMESTAMP, -- When this data expires
  refresh_priority INTEGER DEFAULT 5, -- 1-10 priority for refresh (10 = high priority)
  view_count INTEGER DEFAULT 0, -- How many times this has been viewed
  last_viewed_at TIMESTAMP,
  
  -- Metadata
  search_text TEXT, -- For FTS queries
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  
  -- Foreign Keys
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id),
  FOREIGN KEY (provider_id) REFERENCES provider_knowledge(provider_id)
);
CREATE TABLE verification_checks (
  check_id INTEGER PRIMARY KEY,
  
  -- Target Information
  target_type TEXT NOT NULL, -- 'url', 'product', 'provider', 'trip_data', 'client_data'
  target_id TEXT NOT NULL, -- URL, product_id, provider_id, etc.
  related_table TEXT, -- Which table this relates to (trip_products, provider_knowledge, etc.)
  related_record_id INTEGER, -- ID of the related record
  
  -- Check Configuration
  check_type TEXT NOT NULL, -- 'url_validation', 'data_sanity', 'price_validation', 'availability_check', 'content_verification'
  check_subtype TEXT, -- More specific type like 'ssl_certificate', 'price_range', 'required_fields'
  check_parameters JSON, -- Configuration for the specific check
  
  -- Check Execution
  check_status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
  last_checked_at TIMESTAMP,
  next_check_at TIMESTAMP,
  check_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'monthly', 'on_demand'
  
  -- Results
  is_valid BOOLEAN,
  confidence_score REAL DEFAULT 0.0, -- 0.0-1.0 confidence in the validation result
  check_results JSON, -- Detailed results of the check
  error_details JSON, -- Error information if check failed
  
  -- URL-Specific Validations
  url_status_code INTEGER, -- HTTP status code for URL checks
  url_response_time_ms INTEGER, -- Response time for URL checks
  url_ssl_valid BOOLEAN, -- SSL certificate validity
  url_content_hash TEXT, -- Hash of content for change detection
  url_redirect_chain JSON, -- Array of redirects if any
  
  -- Data Quality Checks
  data_completeness_score REAL, -- Percentage of required fields present
  data_accuracy_score REAL, -- Score for data accuracy (0.0-1.0)
  data_consistency_score REAL, -- Score for internal consistency
  anomaly_flags JSON, -- Array of detected anomalies
  
  -- Performance Metrics
  validation_duration_ms INTEGER, -- How long the validation took
  retry_count INTEGER DEFAULT 0, -- Number of retries attempted
  max_retries INTEGER DEFAULT 3, -- Maximum retries allowed
  
  -- Quality Assurance
  manual_review_required BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Metadata
  priority INTEGER DEFAULT 5, -- 1-10 priority (10 = critical)
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Alerts and Notifications
  alert_on_failure BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  notification_details JSON
);
CREATE TABLE proposal_versions (
  version_id INTEGER PRIMARY KEY,
  
  -- Proposal Identification
  proposal_base_id TEXT NOT NULL, -- Base identifier that links all versions
  version_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  version_label TEXT, -- "Initial Draft", "Client Revision", "Final", etc.
  trip_id INTEGER,
  
  -- Version Metadata
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by TEXT,
  modified_at TIMESTAMP,
  
  -- Status and Workflow
  status TEXT DEFAULT 'draft', -- 'draft', 'review', 'client_review', 'approved', 'rejected', 'superseded', 'final'
  is_current_version BOOLEAN DEFAULT false, -- Only one version should be current
  is_baseline BOOLEAN DEFAULT false, -- Mark significant versions as baselines
  
  -- Content Structure
  proposal_content JSON NOT NULL, -- Full proposal content structure
  content_hash TEXT, -- Hash of content for change detection
  content_summary TEXT, -- Brief summary of this version
  
  -- Document Generation
  document_template_id TEXT, -- Which template was used
  generated_html TEXT, -- Generated HTML document
  document_url TEXT, -- Published document URL (GitHub Pages)
  document_metadata JSON, -- Document generation metadata
  
  -- Changes and Differences
  changes_from_previous JSON, -- Structured diff from previous version
  change_summary TEXT, -- Human-readable summary of changes
  change_reason TEXT, -- Why this version was created
  
  -- Client Interaction
  client_feedback JSON, -- Client comments and feedback
  client_approval_status TEXT, -- 'pending', 'approved', 'rejected', 'changes_requested'
  client_approved_by TEXT,
  client_approved_at TIMESTAMP,
  
  -- Collaboration
  review_notes JSON, -- Internal review notes
  reviewer_assignments JSON, -- Who should review this version
  review_deadline TIMESTAMP,
  
  -- Performance Metrics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP,
  client_view_count INTEGER DEFAULT 0,
  client_last_viewed_at TIMESTAMP,
  
  -- Comparison and Analytics
  word_count INTEGER,
  page_count INTEGER,
  estimated_read_time_minutes INTEGER,
  complexity_score REAL, -- 0.0-1.0 complexity rating
  
  -- Backup and Recovery
  backup_location TEXT, -- Path to backup copy
  backup_created_at TIMESTAMP,
  recovery_point BOOLEAN DEFAULT false, -- Mark as recovery point
  
  -- Integration Points
  external_references JSON, -- Links to external docs, emails, etc.
  source_data_version TEXT, -- Version of source data used
  
  -- Search and Organization
  search_text TEXT,
  tags JSON, -- Array of tags for organization
  
  -- Constraints
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id),
  UNIQUE(proposal_base_id, version_number)
);
CREATE TABLE parser_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,           -- 'delta.com'
    page_type TEXT NOT NULL,        -- 'hotel_search'
    script_key TEXT NOT NULL,       -- KV storage key
    version TEXT DEFAULT '1.0',
    success_rate REAL DEFAULT 1.0,
    last_validated DATETIME,
    structure_hash TEXT,            -- Page structure fingerprint
    extraction_patterns TEXT,       -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, execution_type TEXT DEFAULT 'python', js_patterns TEXT, memory_selectors TEXT, injection_timing TEXT DEFAULT 'domready', fallback_strategy TEXT,
    UNIQUE(domain, page_type, version)
);
CREATE TABLE js_extraction_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    pattern_name TEXT NOT NULL,           -- 'hotel_data_layer', 'flight_window_object'
    js_code TEXT NOT NULL,                -- Actual JavaScript injection code
    memory_paths TEXT,                    -- JSON: ["window.HOTEL_INFO_MAP", "dataLayer.hotels"]
    validation_checks TEXT,               -- JSON: Required properties to validate
    success_indicators TEXT,              -- JSON: How to know extraction worked
    failure_patterns TEXT,                -- JSON: Common failure signatures
    performance_data TEXT,               -- JSON: Timing and efficiency metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain, pattern_name)
);
CREATE TABLE portal_plugins (
    plugin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin_name TEXT NOT NULL UNIQUE, -- 'delta', 'vax', 'aa', 'cruise_planners'
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    portal_type TEXT NOT NULL, -- 'agent_portal', 'consumer_site', 'hybrid'
    
    -- URL Pattern Configuration
    url_patterns JSON NOT NULL, -- {details, photos, amenities, booking}
    url_parameters JSON, -- Parameter requirements and encoding rules
    
    -- Capabilities
    capabilities JSON NOT NULL, -- {embedded_content, separate_detail_pages, photo_galleries, commission_data}
    extraction_methods JSON, -- {javascript, html, api}
    
    -- JavaScript Memory Paths
    memory_objects JSON, -- ['window.HOTEL_INFO_MAP', 'dataLayer']
    js_extraction_code TEXT, -- Custom JavaScript for this portal
    
    -- Commission & Agent Features
    commission_structure JSON, -- {rate, tiers, calculation_method}
    agent_features JSON, -- {bulk_booking, group_rates, special_inventory}
    
    -- Performance & Quality
    success_rate REAL DEFAULT 0.0,
    avg_extraction_time_ms INTEGER,
    last_successful_extraction TIMESTAMP,
    data_quality_score REAL DEFAULT 0.0,
    
    -- Schema Configuration
    output_schema JSON NOT NULL, -- Standardized output format
    field_mappings JSON, -- Portal-specific to standard field mapping
    validation_rules JSON, -- Data validation requirements
    
    -- Metadata
    is_active BOOLEAN DEFAULT 1,
    priority INTEGER DEFAULT 5, -- 1-10, higher = more important
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    last_modified_by TEXT
);
CREATE TABLE hotel_output_schema (
    schema_id INTEGER PRIMARY KEY AUTOINCREMENT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    schema_definition JSON NOT NULL,
    
    -- Core Fields (minimal token usage)
    core_fields JSON NOT NULL DEFAULT '["id", "name", "price", "commission", "rating", "urls"]',
    
    -- Extended Fields (on-demand)
    extended_fields JSON,
    
    -- Validation Rules
    field_validators JSON,
    required_fields JSON,
    
    is_current BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Clients (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				email TEXT,
				phone TEXT,
				address TEXT,
				city TEXT,
				state TEXT,
				postal_code TEXT,
				country TEXT DEFAULT 'United States',
				notes TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
CREATE TABLE Trips (
				id TEXT PRIMARY KEY,
				trip_name TEXT NOT NULL,
				destination TEXT,
				start_date TEXT,
				end_date TEXT,
				trip_type TEXT DEFAULT 'leisure',
				status TEXT DEFAULT 'planning',
				trip_cost_total REAL DEFAULT 0,
				trip_notes TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
CREATE TABLE travel_searches (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				search_type TEXT NOT NULL,
				origin TEXT,
				destination TEXT,
				departure_date TEXT,
				return_date TEXT,
				passengers INTEGER DEFAULT 1,
				budget_limit REAL,
				search_parameters TEXT,
				results_summary TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				user_id TEXT DEFAULT 'anonymous'
			);
CREATE TABLE user_preferences (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				preference_type TEXT NOT NULL,
				preference_value TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
CREATE TABLE ActivityLog (
   activity_id INTEGER PRIMARY KEY,
   session_id TEXT,
   client_id INTEGER,
   trip_id INTEGER,
   activity_type TEXT,
   activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   details TEXT,
   FOREIGN KEY (client_id) REFERENCES clients_v2(client_id),
   FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id)
);
CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE hotel_cache (
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
    , trip_id TEXT, giata_id TEXT, json TEXT, lead_price_amount REAL, lead_price_currency TEXT DEFAULT 'USD', refundable BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE rooms_cache (
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
      raw_json TEXT, trip_id TEXT, hotel_key TEXT, site TEXT, room_name TEXT, json TEXT, nightly_rate REAL, total_price REAL, commission_amount REAL, commission_percent REAL, cancellation_deadline TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotel_cache(id) ON DELETE CASCADE
    );
CREATE TABLE commission_rates (
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
CREATE TABLE commission_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      priority INTEGER DEFAULT 100,
      criteria_json TEXT NOT NULL,
      rate_id INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rate_id) REFERENCES commission_rates(id) ON DELETE SET NULL
    );
CREATE TABLE proposal_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (proposal_id) REFERENCES proposals_enhanced(id) ON DELETE CASCADE
    );
CREATE TABLE extraction_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT DEFAULT 'running', -- running, success, failed
      stats_json TEXT
    );
CREATE TABLE extraction_attempts (
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
CREATE TABLE publication_log (
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
CREATE TABLE facts_dirty_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
      UNIQUE(trip_id, reason, created_at)
    );
CREATE TABLE trip_facts_v2 (
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
CREATE TABLE TripCosts (
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
CREATE TABLE BookingHistory (
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
CREATE TABLE proposals (
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
CREATE TABLE trip_client_assignments (assignment_id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, client_email TEXT NOT NULL, client_role TEXT DEFAULT 'traveler', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE, FOREIGN KEY (client_email) REFERENCES clients_v2(email) ON DELETE CASCADE, UNIQUE(trip_id, client_email, client_role));
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
DELETE FROM sqlite_sequence;
CREATE INDEX idx_sessions_active ON SessionManagement(is_active, last_activity_timestamp);
CREATE INDEX idx_processed_emails_message_id 
ON processed_emails(message_id);
CREATE INDEX idx_email_processing_log_message_id 
ON email_processing_log(message_id);
CREATE INDEX idx_email_processing_log_processed_at 
ON email_processing_log(processed_at);
CREATE INDEX idx_instruction_name ON instruction_sets(name);
CREATE INDEX idx_instruction_category ON instruction_sets(category);
CREATE INDEX idx_instruction_active ON instruction_sets(active);
CREATE INDEX idx_db_errors_timestamp ON db_errors(error_timestamp);
CREATE INDEX idx_db_errors_operation ON db_errors(attempted_operation);
CREATE INDEX idx_db_errors_resolved ON db_errors(resolved);
CREATE INDEX idx_session_active ON SessionManagement(is_active);
CREATE INDEX idx_session_trip ON SessionManagement(primary_trip_id);
CREATE UNIQUE INDEX idx_db_doc_unique ON db_documentation(
    object_type, 
    object_name, 
    COALESCE(parent_object, '')
);
CREATE INDEX idx_db_doc_type ON db_documentation(object_type);
CREATE INDEX idx_db_doc_parent ON db_documentation(parent_object);
CREATE INDEX idx_db_doc_tools ON db_documentation(related_tools);
CREATE INDEX idx_trips_v2_dates ON trips_v2(start_date, end_date);
CREATE INDEX idx_trips_v2_status ON trips_v2(status);
CREATE INDEX idx_trips_v2_email ON trips_v2(primary_client_email);
CREATE INDEX idx_trips_v2_search ON trips_v2(search_text);
CREATE INDEX idx_trips_v2_destinations ON trips_v2(destinations);
CREATE INDEX idx_clients_v2_email ON clients_v2(email);
CREATE INDEX idx_clients_v2_name ON clients_v2(full_name);
CREATE INDEX idx_clients_v2_search ON clients_v2(search_text);
CREATE INDEX idx_clients_v2_last_trip ON clients_v2(last_trip_date DESC);
CREATE INDEX idx_llm_natural ON llm_trip_context(natural_key);
CREATE INDEX idx_llm_keywords ON llm_trip_context(search_keywords);
CREATE INDEX idx_llm_active_date ON llm_trip_context(is_active, relevance_date);
CREATE INDEX idx_llm_context_keywords ON llm_trip_context(search_keywords);
CREATE INDEX idx_llm_context_natural_key ON llm_trip_context(natural_key);
CREATE INDEX idx_llm_context_type ON llm_trip_context(context_type);
CREATE INDEX idx_llm_context_access ON llm_trip_context(access_count DESC);
CREATE INDEX idx_faq_pattern ON llm_faq_cache(question_pattern);
CREATE INDEX idx_faq_usage ON llm_faq_cache(use_count DESC);
CREATE INDEX idx_query_log_timestamp ON llm_query_log(timestamp);
CREATE INDEX idx_query_log_cached ON llm_query_log(was_cached);
CREATE INDEX idx_query_log_pattern ON llm_query_log(matched_pattern);
CREATE INDEX idx_failed_count ON llm_failed_queries(failure_count DESC);
CREATE INDEX idx_failed_status ON llm_failed_queries(review_status);
CREATE INDEX idx_trips_v2_commission 
ON trips_v2(status, start_date) 
WHERE json_extract(financials, '$.commission_amount') > 0;
CREATE INDEX idx_query_log_analysis 
ON llm_query_log(query_lower, was_cached, timestamp);
CREATE INDEX idx_status_session ON system_status(session_id);
CREATE INDEX idx_query_performance_session ON query_performance_log(session_id);
CREATE INDEX idx_query_performance_timestamp ON query_performance_log(timestamp);
CREATE INDEX idx_template_type ON HtmlDocumentTemplates(template_type);
CREATE INDEX idx_template_active ON HtmlDocumentTemplates(is_active);
CREATE INDEX idx_trips_v2_start_date ON trips_v2(start_date);
CREATE INDEX idx_trips_v2_primary_client_email ON trips_v2(primary_client_email);
CREATE INDEX idx_clients_v2_full_name ON clients_v2(full_name);
CREATE INDEX idx_provider_knowledge_type ON provider_knowledge(provider_type);
CREATE INDEX idx_provider_knowledge_base_url ON provider_knowledge(base_url);
CREATE INDEX idx_provider_knowledge_active ON provider_knowledge(is_active);
CREATE INDEX idx_provider_knowledge_success_rate ON provider_knowledge(success_rate);
CREATE INDEX idx_provider_knowledge_search ON provider_knowledge(search_text);
CREATE INDEX idx_provider_knowledge_updated ON provider_knowledge(updated_at);
CREATE INDEX idx_trip_products_trip_id ON trip_products(trip_id);
CREATE INDEX idx_trip_products_provider_id ON trip_products(provider_id);
CREATE INDEX idx_trip_products_type ON trip_products(product_type);
CREATE INDEX idx_trip_products_destination ON trip_products(destination_city, destination_country);
CREATE INDEX idx_trip_products_travel_date ON trip_products(travel_date);
CREATE INDEX idx_trip_products_search_date ON trip_products(search_date);
CREATE INDEX idx_trip_products_budget_price ON trip_products(budget_price);
CREATE INDEX idx_trip_products_standard_price ON trip_products(standard_price);
CREATE INDEX idx_trip_products_premium_price ON trip_products(premium_price);
CREATE INDEX idx_trip_products_quality_score ON trip_products(data_quality_score);
CREATE INDEX idx_trip_products_relevance_score ON trip_products(relevance_score);
CREATE INDEX idx_trip_products_cache_expiry ON trip_products(cache_expiry);
CREATE INDEX idx_trip_products_recommendation_tier ON trip_products(recommendation_tier);
CREATE INDEX idx_trip_products_availability ON trip_products(availability_status);
CREATE INDEX idx_trip_products_type_date ON trip_products(product_type, travel_date);
CREATE INDEX idx_trip_products_destination_type ON trip_products(destination_city, product_type);
CREATE INDEX idx_trip_products_active_quality ON trip_products(is_active, data_quality_score);
CREATE INDEX idx_trip_products_search_text ON trip_products(search_text);
CREATE INDEX idx_verification_checks_target ON verification_checks(target_type, target_id);
CREATE INDEX idx_verification_checks_status ON verification_checks(check_status);
CREATE INDEX idx_verification_checks_type ON verification_checks(check_type, check_subtype);
CREATE INDEX idx_verification_checks_last_checked ON verification_checks(last_checked_at);
CREATE INDEX idx_verification_checks_next_check ON verification_checks(next_check_at);
CREATE INDEX idx_verification_checks_priority ON verification_checks(priority);
CREATE INDEX idx_verification_checks_valid ON verification_checks(is_valid);
CREATE INDEX idx_verification_checks_related ON verification_checks(related_table, related_record_id);
CREATE INDEX idx_verification_checks_confidence ON verification_checks(confidence_score);
CREATE INDEX idx_verification_checks_completeness ON verification_checks(data_completeness_score);
CREATE INDEX idx_verification_checks_manual_review ON verification_checks(manual_review_required);
CREATE INDEX idx_verification_checks_alert_failure ON verification_checks(alert_on_failure);
CREATE INDEX idx_verification_checks_status_next ON verification_checks(check_status, next_check_at);
CREATE INDEX idx_verification_checks_type_status ON verification_checks(check_type, check_status);
CREATE INDEX idx_proposal_versions_base_id ON proposal_versions(proposal_base_id);
CREATE INDEX idx_proposal_versions_version_number ON proposal_versions(proposal_base_id, version_number);
CREATE INDEX idx_proposal_versions_trip_id ON proposal_versions(trip_id);
CREATE INDEX idx_proposal_versions_status ON proposal_versions(status);
CREATE INDEX idx_proposal_versions_current ON proposal_versions(is_current_version);
CREATE INDEX idx_proposal_versions_created_at ON proposal_versions(created_at);
CREATE INDEX idx_proposal_versions_created_by ON proposal_versions(created_by);
CREATE INDEX idx_proposal_versions_client_approval ON proposal_versions(client_approval_status);
CREATE INDEX idx_proposal_versions_client_approved_at ON proposal_versions(client_approved_at);
CREATE INDEX idx_proposal_versions_template ON proposal_versions(document_template_id);
CREATE INDEX idx_proposal_versions_content_hash ON proposal_versions(content_hash);
CREATE INDEX idx_proposal_versions_search_text ON proposal_versions(search_text);
CREATE INDEX idx_proposal_versions_view_count ON proposal_versions(view_count);
CREATE INDEX idx_proposal_versions_base_current ON proposal_versions(proposal_base_id, is_current_version);
CREATE INDEX idx_proposal_versions_trip_status ON proposal_versions(trip_id, status);
CREATE INDEX idx_proposal_versions_status_created ON proposal_versions(status, created_at);
CREATE INDEX idx_trips_v2_workflow_phase ON trips_v2(json_extract(workflow_state, '$.current_phase'));
CREATE INDEX idx_instruction_sets_workflow ON instruction_sets(workflow_phase, workflow_step);
CREATE INDEX idx_parser_domain_type ON parser_scripts(domain, page_type);
CREATE INDEX idx_parser_success_rate ON parser_scripts(success_rate);
CREATE INDEX idx_parser_validated ON parser_scripts(last_validated);
CREATE INDEX idx_js_patterns_domain ON js_extraction_patterns(domain);
CREATE INDEX idx_js_patterns_domain_pattern ON js_extraction_patterns(domain, pattern_name);
CREATE INDEX idx_portal_plugins_name ON portal_plugins(plugin_name);
CREATE INDEX idx_portal_plugins_active ON portal_plugins(is_active);
CREATE INDEX idx_activitylog_session ON ActivityLog(session_id);
CREATE INDEX idx_activitylog_timestamp ON ActivityLog(activity_timestamp);
CREATE INDEX idx_activitylog_type ON ActivityLog(activity_type);
CREATE INDEX idx_activitylog_trip ON ActivityLog(trip_id);
CREATE INDEX idx_activitylog_client ON ActivityLog(client_id);
CREATE UNIQUE INDEX idx_hotel_cache_provider_key
      ON hotel_cache(provider, provider_hotel_id);
CREATE INDEX idx_hotel_cache_city ON hotel_cache(city);
CREATE INDEX idx_hotel_cache_country ON hotel_cache(country);
CREATE INDEX idx_rooms_cache_hotel ON rooms_cache(hotel_id);
CREATE INDEX idx_rooms_cache_updated ON rooms_cache(last_updated);
CREATE INDEX idx_commission_rates_lookup
      ON commission_rates(supplier, product_type, active);
CREATE INDEX idx_commission_rules_active
      ON commission_rules(active, priority);
CREATE INDEX idx_proposal_images_proposal ON proposal_images(proposal_id);
CREATE INDEX idx_extraction_sessions_status ON extraction_sessions(status);
CREATE INDEX idx_extraction_sessions_time ON extraction_sessions(started_at);
CREATE INDEX idx_extraction_attempts_session ON extraction_attempts(session_id);
CREATE INDEX idx_extraction_attempts_status ON extraction_attempts(status);
CREATE INDEX idx_extraction_attempts_item ON extraction_attempts(item_key);
CREATE INDEX idx_publication_log_trip ON publication_log(trip_id, published_at DESC);
CREATE INDEX idx_publication_log_status ON publication_log(status, published_at DESC);
CREATE INDEX idx_facts_dirty_v2_trip ON facts_dirty_v2(trip_id);
CREATE INDEX idx_trip_facts_v2_computed ON trip_facts_v2(last_computed);
CREATE INDEX idx_facts_dirty_trip ON facts_dirty(trip_id);
CREATE INDEX idx_trip_facts_computed ON trip_facts(last_computed);
CREATE INDEX idx_hotel_cache_trip_id ON hotel_cache(trip_id);
CREATE INDEX idx_hotel_cache_site ON hotel_cache(provider);
CREATE INDEX idx_hotel_cache_giata ON hotel_cache(giata_id);
CREATE INDEX idx_hotel_cache_price ON hotel_cache(lead_price_amount);
CREATE INDEX idx_rooms_cache_trip_id ON rooms_cache(trip_id);
CREATE INDEX idx_rooms_cache_hotel_key ON rooms_cache(hotel_key);
CREATE INDEX idx_rooms_cache_site ON rooms_cache(site);
CREATE INDEX idx_rooms_cache_price ON rooms_cache(total_price);
CREATE INDEX idx_tripdays_trip ON TripDays(trip_id);
CREATE INDEX idx_tripdays_date ON TripDays(date);
CREATE INDEX idx_tripparticipants_trip ON TripParticipants(trip_id);
CREATE INDEX idx_tripparticipants_client ON TripParticipants(client_id);
CREATE INDEX idx_trip_activities_enhanced_trip ON trip_activities_enhanced(trip_id);
CREATE INDEX idx_trip_activities_enhanced_day ON trip_activities_enhanced(day_id);
CREATE INDEX idx_trip_legs_trip ON trip_legs(trip_id);
CREATE INDEX idx_trip_legs_order ON trip_legs(trip_id, leg_order);
CREATE INDEX idx_proposals_enhanced_trip ON proposals_enhanced(trip_id);
CREATE INDEX idx_proposals_enhanced_status ON proposals_enhanced(status);
CREATE INDEX idx_proposals_enhanced_created ON proposals_enhanced(created_at);
CREATE INDEX idx_tripcosts_trip ON TripCosts(trip_id);
CREATE INDEX idx_tripcosts_type ON TripCosts(cost_type);
CREATE INDEX idx_tripcosts_status ON TripCosts(payment_status);
CREATE INDEX idx_bookinghistory_trip ON BookingHistory(trip_id);
CREATE INDEX idx_bookinghistory_type ON BookingHistory(booking_type);
CREATE INDEX idx_bookinghistory_status ON BookingHistory(status);
CREATE INDEX idx_bookinghistory_vendor ON BookingHistory(vendor);
CREATE INDEX idx_trips_slug ON trips_v2(trip_slug);
CREATE INDEX idx_trip_client_assignments_trip_id ON trip_client_assignments(trip_id);
CREATE INDEX idx_trip_client_assignments_client_email ON trip_client_assignments(client_email);
CREATE INDEX idx_trip_client_assignments_role ON trip_client_assignments(client_role);
CREATE INDEX idx_travel_services_trip_id ON travel_services(trip_id);
CREATE INDEX idx_travel_services_category ON travel_services(service_category);
CREATE INDEX idx_travel_services_location_dates ON travel_services(location_city, start_date, end_date);
CREATE INDEX idx_travel_services_price_range ON travel_services(total_price, currency);
CREATE INDEX idx_travel_services_rating ON travel_services(rating_overall DESC);
CREATE INDEX idx_travel_services_source ON travel_services(source_platform, created_at DESC);
CREATE INDEX idx_travel_services_session ON travel_services(search_session_id);
CREATE INDEX idx_travel_services_expires ON travel_services(cache_expires_at);
CREATE INDEX idx_travel_services_search_params ON travel_services(search_params_hash, service_category);
CREATE INDEX idx_travel_search_cache_hash ON travel_search_cache(search_params_hash);
CREATE INDEX idx_travel_search_cache_expires ON travel_search_cache(expires_at);
CREATE INDEX idx_travel_search_cache_category ON travel_search_cache(service_category);
CREATE INDEX idx_travel_search_cache_platform ON travel_search_cache(source_platform);
CREATE INDEX idx_trip_components_trip_id ON trip_components(trip_id);
CREATE INDEX idx_trip_components_type ON trip_components(component_type);
CREATE INDEX idx_trip_components_value ON trip_components(component_value);
CREATE INDEX idx_trip_components_weight ON trip_components(search_weight DESC);
CREATE INDEX idx_search_analytics_session ON search_analytics(session_id);
CREATE INDEX idx_search_analytics_query ON search_analytics(search_query);
CREATE INDEX idx_search_analytics_method ON search_analytics(search_method);
CREATE INDEX idx_search_analytics_success ON search_analytics(success_score DESC);
CREATE INDEX idx_suggestion_cache_pattern ON suggestion_cache(query_pattern);
CREATE INDEX idx_suggestion_cache_type ON suggestion_cache(suggestion_type);
CREATE INDEX idx_suggestion_cache_confidence ON suggestion_cache(confidence_score DESC);
CREATE INDEX idx_suggestion_cache_usage ON suggestion_cache(usage_count DESC);
CREATE TRIGGER auto_create_product_verification
AFTER INSERT ON trip_products
BEGIN
  -- Create URL validation check if product has a URL
  INSERT INTO verification_checks (
    target_type, target_id, related_table, related_record_id,
    check_type, check_subtype, check_parameters,
    check_frequency, priority, alert_on_failure
  )
  SELECT 
    'url', NEW.product_url, 'trip_products', NEW.product_id,
    'url_validation', 'availability_check',
    json_object(
      'timeout_ms', 5000,
      'follow_redirects', true,
      'validate_ssl', true
    ),
    'daily', 7, true
  WHERE NEW.product_url IS NOT NULL AND NEW.product_url != '';
  
  -- Create data sanity check for pricing
  INSERT INTO verification_checks (
    target_type, target_id, related_table, related_record_id,
    check_type, check_subtype, check_parameters,
    check_frequency, priority, alert_on_failure
  )
  VALUES (
    'product', CAST(NEW.product_id AS TEXT), 'trip_products', NEW.product_id,
    'data_sanity', 'price_validation',
    json_object(
      'min_price', 
      CASE NEW.product_type 
        WHEN 'hotel' THEN 20
        WHEN 'flight' THEN 50
        WHEN 'activity' THEN 10
        WHEN 'restaurant' THEN 5
        WHEN 'transport' THEN 15
        ELSE 10
      END,
      'max_price',
      CASE NEW.product_type 
        WHEN 'hotel' THEN 2000
        WHEN 'flight' THEN 5000
        WHEN 'activity' THEN 500
        WHEN 'restaurant' THEN 200
        WHEN 'transport' THEN 1000
        ELSE 1000
      END,
      'currency', NEW.currency,
      'price_change_threshold', 0.3
    ),
    'daily', 6, false
  );
END;
CREATE TRIGGER auto_update_product_search_text
AFTER INSERT ON trip_products
WHEN NEW.search_text IS NULL OR NEW.search_text = ''
BEGIN
  UPDATE trip_products 
  SET search_text = 
    NEW.product_name || ' ' || 
    COALESCE(NEW.destination_city, '') || ' ' || 
    COALESCE(NEW.destination_country, '') || ' ' ||
    NEW.product_type || ' ' ||
    COALESCE(NEW.notes, '') || ' ' ||
    CASE NEW.product_type 
      WHEN 'hotel' THEN 'accommodation lodging hotel resort stay'
      WHEN 'flight' THEN 'airline flight aviation ticket travel'
      WHEN 'activity' THEN 'tour experience attraction activity sightseeing'
      WHEN 'restaurant' THEN 'dining food restaurant cuisine meal'
      WHEN 'transport' THEN 'transportation vehicle rental car bus train'
      ELSE ''
    END
  WHERE product_id = NEW.product_id;
END;
CREATE TRIGGER auto_version_proposal_updates
AFTER UPDATE ON proposal_versions
WHEN OLD.proposal_content != NEW.proposal_content
BEGIN
  -- Mark old version as no longer current
  UPDATE proposal_versions 
  SET is_current_version = false 
  WHERE proposal_base_id = NEW.proposal_base_id 
    AND version_id != NEW.version_id;
  
  -- Update change tracking
  UPDATE proposal_versions
  SET 
    modified_at = datetime('now'),
    content_hash = hex(randomblob(16)),
    changes_from_previous = json_object(
      'content_changed', true,
      'change_timestamp', datetime('now'),
      'previous_hash', OLD.content_hash
    )
  WHERE version_id = NEW.version_id;
END;
CREATE TRIGGER update_session_activity
AFTER INSERT ON ActivityLog
BEGIN
   UPDATE SessionManagement
   SET last_activity_timestamp = CURRENT_TIMESTAMP
   WHERE session_id = NEW.session_id;
END;
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
CREATE TRIGGER sync_trips_to_v2
AFTER INSERT ON Trips
BEGIN
  INSERT INTO trips_v2 (trip_id, trip_data, search_vector, created_at, updated_at)
  VALUES (
    NEW.trip_id,
    json_object('trip_name', NEW.trip_name, 'client_name', NEW.client_name),
    NEW.trip_name || ' ' || NEW.client_name,
    NEW.created_at,
    NEW.updated_at
  );
END;
CREATE TRIGGER trg_travel_services_ai_dirty
AFTER INSERT ON travel_services
WHEN NEW.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_insert');
END;
CREATE TRIGGER trg_travel_services_au_dirty
AFTER UPDATE ON travel_services
WHEN NEW.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_update');
END;
CREATE TRIGGER trg_travel_services_ad_dirty
AFTER DELETE ON travel_services
WHEN OLD.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (OLD.trip_id, 'travel_service_delete');
END;
CREATE TRIGGER trg_travel_services_update_timestamp
BEFORE UPDATE ON travel_services
BEGIN
  UPDATE travel_services 
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;
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
CREATE TRIGGER trg_travel_search_cache_update_access
BEFORE UPDATE ON travel_search_cache
WHEN NEW.last_accessed != OLD.last_accessed
BEGIN
  UPDATE travel_search_cache
  SET access_count = access_count + 1
  WHERE id = NEW.id;
END;
CREATE TRIGGER tr_trip_components_updated_at
  AFTER UPDATE ON trip_components
BEGIN
  UPDATE trip_components 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE component_id = NEW.component_id;
END;
CREATE TRIGGER trg_trip_client_assignments_insert
AFTER INSERT ON trip_client_assignments
BEGIN
    -- Update the clients JSON field in trips_v2 to include this assignment
    UPDATE trips_v2 
    SET 
        clients = CASE
            WHEN clients = '[]' OR clients IS NULL THEN
                JSON_ARRAY(JSON_OBJECT(
                    'email', NEW.client_email,
                    'role', NEW.client_role,
                    'assigned_at', NEW.created_at
                ))
            ELSE
                JSON_INSERT(clients, '$[#]', JSON_OBJECT(
                    'email', NEW.client_email,
                    'role', NEW.client_role,
                    'assigned_at', NEW.created_at
                ))
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE trip_id = NEW.trip_id
    AND NOT EXISTS (
        SELECT 1 FROM JSON_EACH(clients) 
        WHERE JSON_EXTRACT(value, '$.email') = NEW.client_email
    );
END;
CREATE TRIGGER trg_trip_client_assignments_delete
AFTER DELETE ON trip_client_assignments
BEGIN
    -- Remove the client from the clients JSON field
    UPDATE trips_v2 
    SET 
        clients = (
            SELECT JSON_GROUP_ARRAY(value) 
            FROM JSON_EACH(clients) 
            WHERE JSON_EXTRACT(value, '$.email') != OLD.client_email
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE trip_id = OLD.trip_id;
END;
CREATE VIEW popular_routes AS
						SELECT
							origin,
							destination,
							COUNT(*) as search_count,
							AVG(budget_limit) as avg_budget,
							MAX(created_at) as last_searched
						FROM travel_searches
						WHERE origin IS NOT NULL AND destination IS NOT NULL
						GROUP BY origin, destination
						ORDER BY search_count DESC;
CREATE VIEW RecentCaptures AS
SELECT 
  wc.id,
  wc.url,
  wc.captured_at,
  wc.content_type,
  wc.confidence_score,
  pc.structured_data,
  wc.trip_id,
  wc.client_id,
  wc.metadata
FROM WebCaptures wc
LEFT JOIN ProcessedContent pc ON wc.id = pc.capture_id
WHERE wc.captured_at > datetime('now', '-7 days')
ORDER BY wc.captured_at DESC;
CREATE VIEW ResearchSummary AS
SELECT 
  ri.folder_name,
  ri.item_type,
  COUNT(*) as item_count,
  AVG(ri.rating) as avg_rating,
  MIN(ri.created_at) as first_added,
  MAX(ri.created_at) as last_added
FROM ResearchItems ri
WHERE ri.assigned_trip_id IS NULL
GROUP BY ri.folder_name, ri.item_type;
CREATE VIEW MonitorStatus AS
SELECT 
  cm.id,
  cm.url,
  cm.frequency,
  cm.monitor_type,
  cm.next_check_at,
  cm.is_active,
  wc.captured_at as last_capture_at,
  wc.content_type as last_content_type
FROM CaptureMonitors cm
LEFT JOIN WebCaptures wc ON cm.last_capture_id = wc.id
WHERE cm.is_active = true
ORDER BY cm.next_check_at ASC;
CREATE VIEW llm_universal_answer AS
SELECT 
    'For "' || natural_key || '": ' || chr(10) || chr(10) || formatted_response as complete_answer,
    context_type,
    search_keywords
FROM llm_trip_context
WHERE is_active = 1;
CREATE VIEW trip_summary_v2 AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.status,
    t.start_date,
    t.end_date,
    t.total_cost,
    t.group_name,
    COUNT(DISTINCT json_extract(c.value, '$.client_id')) as client_count,
    lc.access_count,
    lc.last_accessed
FROM trips_v2 t
LEFT JOIN json_each(t.clients) c
LEFT JOIN llm_trip_context lc ON lc.natural_key = t.trip_name AND lc.context_type = 'trip_full'
GROUP BY t.trip_id;
CREATE VIEW client_activity_v2 AS
SELECT 
    c.client_id,
    c.full_name,
    c.email,
    c.total_trips,
    c.total_spent,
    c.last_trip_date,
    lc.access_count,
    lc.last_accessed
FROM clients_v2 c
LEFT JOIN llm_trip_context lc ON lc.natural_key = c.email AND lc.context_type = 'client_profile';
CREATE VIEW trip_summary_with_clients AS
SELECT 
  t.trip_id,
  t.trip_name,
  t.status,
  t.start_date,
  t.end_date,
  t.total_cost,
  COALESCE(t.group_name, 
    COALESCE(
      (SELECT GROUP_CONCAT(json_extract(value, '$.name'), ', ') 
       FROM json_each(t.clients) 
       WHERE json_extract(value, '$.name') IS NOT NULL),
      'No clients assigned'
    )
  ) as client_names,
  (SELECT COUNT(*) FROM json_each(t.clients)) as client_count,
  t.updated_at,
  datetime(t.updated_at, 'localtime') as last_modified_local
FROM trips_v2 t;
CREATE VIEW pattern_performance AS
SELECT 
    matched_pattern,
    COUNT(*) as usage_count,
    AVG(execution_time_ms) as avg_time_ms,
    MIN(execution_time_ms) as min_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    SUM(CASE WHEN was_cached THEN 1 ELSE 0 END) as cache_hits,
    CAST(SUM(CASE WHEN was_cached THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as cache_hit_rate
FROM llm_query_log
WHERE matched_pattern IS NOT NULL
GROUP BY matched_pattern
ORDER BY usage_count DESC;
CREATE VIEW session_performance_summary AS
SELECT 
    s.session_id,
    s.current_mode,
    s.active_trip_name,
    s.current_stage,
    s.progress_percentage,
    COUNT(p.log_id) as total_queries,
    SUM(CASE WHEN p.cache_hit THEN 1 ELSE 0 END) as cache_hits,
    ROUND(AVG(p.response_time_ms), 2) as avg_response_ms,
    ROUND((CAST(SUM(CASE WHEN p.cache_hit THEN 1 ELSE 0 END) AS FLOAT) / 
           NULLIF(COUNT(p.log_id), 0)) * 100, 1) as cache_hit_rate,
    MAX(p.timestamp) as last_query_time
FROM system_status s
LEFT JOIN query_performance_log p ON s.session_id = p.session_id
GROUP BY s.session_id;
CREATE VIEW trip_search_view AS
SELECT 
    trip_id,
    trip_name,
    destinations,
    start_date,
    end_date,
    status,
    total_cost,
    group_name,
    primary_client_email,
    created_at,
    updated_at,
    -- Extract basic client info using string functions (D1 compatible)
    CASE 
        WHEN clients LIKE '%"name"%' THEN
            substr(clients, 
                instr(clients, '"name":"') + 8,
                instr(substr(clients, instr(clients, '"name":"') + 8), '"') - 1
            )
        ELSE NULL
    END as primary_client_name,
    -- Count clients by counting occurrences of "client_id"
    (length(clients) - length(replace(clients, '"client_id"', ''))) / 11 as client_count,
    -- Full clients JSON for advanced queries
    clients as clients_json,
    -- Search text combining trip and client data
    trip_name || ' ' || COALESCE(destinations, '') || ' ' || 
    COALESCE(group_name, '') || ' ' || COALESCE(clients, '') as search_text
FROM trips_v2;
CREATE VIEW verification_checks_due AS
SELECT 
  check_id,
  target_type,
  target_id,
  check_type,
  check_subtype,
  priority,
  last_checked_at,
  next_check_at,
  CASE 
    WHEN next_check_at IS NULL OR next_check_at <= datetime('now') THEN 'due'
    WHEN next_check_at <= datetime('now', '+1 hour') THEN 'upcoming'
    ELSE 'scheduled'
  END as urgency_status
FROM verification_checks 
WHERE check_status IN ('pending', 'completed') 
  AND (next_check_at IS NULL OR next_check_at <= datetime('now', '+1 day'))
ORDER BY 
  CASE 
    WHEN next_check_at IS NULL OR next_check_at <= datetime('now') THEN 1
    ELSE 2 
  END,
  priority DESC,
  next_check_at ASC;
CREATE VIEW verification_status_summary AS
SELECT 
  check_type,
  check_subtype,
  COUNT(*) as total_checks,
  SUM(CASE WHEN is_valid = true THEN 1 ELSE 0 END) as valid_checks,
  SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid_checks,
  SUM(CASE WHEN is_valid IS NULL THEN 1 ELSE 0 END) as pending_checks,
  AVG(confidence_score) as avg_confidence,
  MAX(last_checked_at) as last_check_time,
  SUM(CASE WHEN manual_review_required = true THEN 1 ELSE 0 END) as needs_review
FROM verification_checks
GROUP BY check_type, check_subtype
ORDER BY check_type, check_subtype;
CREATE VIEW current_proposal_versions AS
SELECT 
  pv.*,
  t.trip_name,
  t.primary_client_email,
  t.status as trip_status
FROM proposal_versions pv
LEFT JOIN trips_v2 t ON pv.trip_id = t.trip_id
WHERE pv.is_current_version = true
ORDER BY pv.created_at DESC;
CREATE VIEW proposal_version_history AS
SELECT 
  proposal_base_id,
  COUNT(*) as total_versions,
  MIN(created_at) as first_created,
  MAX(created_at) as last_updated,
  MAX(CASE WHEN is_current_version = true THEN version_number END) as current_version,
  MAX(version_number) as latest_version,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_versions,
  COUNT(CASE WHEN client_approval_status = 'approved' THEN 1 END) as client_approved_versions,
  AVG(word_count) as avg_word_count,
  SUM(view_count) as total_views,
  SUM(client_view_count) as total_client_views
FROM proposal_versions
GROUP BY proposal_base_id
ORDER BY last_updated DESC;
CREATE VIEW proposal_version_comparison AS
SELECT 
  current.proposal_base_id,
  current.version_number as current_version,
  previous.version_number as previous_version,
  current.created_at as current_created,
  previous.created_at as previous_created,
  current.word_count - COALESCE(previous.word_count, 0) as word_count_change,
  current.change_summary,
  current.change_reason,
  CASE 
    WHEN current.word_count > COALESCE(previous.word_count, 0) * 1.2 THEN 'major_expansion'
    WHEN current.word_count < COALESCE(previous.word_count, 0) * 0.8 THEN 'major_reduction'
    WHEN current.word_count != COALESCE(previous.word_count, 0) THEN 'moderate_change'
    ELSE 'minimal_change'
  END as change_magnitude
FROM proposal_versions current
LEFT JOIN proposal_versions previous ON 
  current.proposal_base_id = previous.proposal_base_id 
  AND previous.version_number = current.version_number - 1
WHERE current.version_number > 1
ORDER BY current.proposal_base_id, current.version_number;
CREATE VIEW transportation_compat AS
SELECT 
  tp.product_id as transportation_id,
  tp.trip_id,
  NULL as trip_day_id,
  CASE 
    WHEN tp.product_type = 'flight' THEN 'Flight'
    ELSE json_extract(tp.product_details, '$.transport_type')
  END as transport_type,
  json_extract(tp.product_details, '$.provider_name') as provider_name,
  json_extract(tp.product_details, '$.reference_number') as reference_number,
  json_extract(tp.product_details, '$.confirmation_number') as confirmation_number,
  json_extract(tp.product_details, '$.departure_location') as departure_location,
  json_extract(tp.product_details, '$.departure_time') as departure_time,
  tp.travel_date as departure_datetime,
  json_extract(tp.product_details, '$.arrival_location') as arrival_location,
  json_extract(tp.product_details, '$.arrival_time') as arrival_time,
  NULL as arrival_datetime,
  json_extract(tp.product_details, '$.duration') as duration,
  tp.product_name as details,
  tp.standard_price as cost,
  tp.currency,
  tp.notes,
  CASE 
    WHEN tp.availability_status = 'available' THEN 'confirmed'
    ELSE 'pending'
  END as status,
  tp.created_at,
  tp.updated_at
FROM trip_products tp
WHERE tp.product_type IN ('flight', 'transport');
CREATE VIEW trip_products_fast AS
SELECT 
  product_id,
  trip_id,
  product_type,
  product_name,
  destination_city,
  travel_date,
  standard_price,
  currency,
  availability_status,
  recommendation_tier,
  data_quality_score,
  created_at
FROM trip_products
WHERE is_active = true
  AND (cache_expiry IS NULL OR cache_expiry > datetime('now'));
CREATE VIEW verification_status_fast AS
SELECT 
  related_table,
  related_record_id,
  COUNT(*) as total_checks,
  SUM(CASE WHEN is_valid = true THEN 1 ELSE 0 END) as valid_checks,
  MAX(last_checked_at) as last_check,
  AVG(confidence_score) as avg_confidence
FROM verification_checks
WHERE check_status = 'completed'
GROUP BY related_table, related_record_id;
CREATE VIEW proposal_summary_fast AS
SELECT 
  proposal_base_id,
  MAX(version_number) as latest_version,
  MAX(CASE WHEN is_current_version = true THEN version_number END) as current_version,
  MAX(created_at) as last_updated,
  MAX(CASE WHEN client_approval_status = 'approved' THEN 1 ELSE 0 END) as is_approved,
  COUNT(*) as total_versions
FROM proposal_versions
GROUP BY proposal_base_id;
CREATE VIEW workflow_status_v2 AS
SELECT 
  t.trip_id,
  t.trip_name,
  t.status,
  t.start_date,
  t.end_date,
  json_extract(t.workflow_state, '$.current_phase') as current_phase,
  json_extract(t.workflow_state, '$.current_step') as current_step,
  json_extract(t.workflow_state, '$.last_transition') as last_transition,
  json_extract(t.workflow_state, '$.workflow_metadata.total_duration') as total_duration,
  json_extract(t.workflow_state, '$.workflow_metadata.phase_count') as phase_count,
  CASE 
    WHEN t.workflow_state IS NULL THEN 'not_initialized'
    ELSE 'initialized'
  END as workflow_status
FROM trips_v2 t;
CREATE VIEW active_portal_plugins AS
SELECT 
    plugin_name,
    display_name,
    base_url,
    json_extract(capabilities, '$.commission_data') as has_commission,
    json_extract(capabilities, '$.embedded_content') as is_embedded,
    success_rate,
    avg_extraction_time_ms
FROM portal_plugins
WHERE is_active = 1
ORDER BY priority DESC;
CREATE VIEW portal_performance_stats AS
SELECT 
    p.plugin_name,
    p.display_name,
    COUNT(h.history_id) as total_extractions,
    AVG(h.extraction_time_ms) as avg_time_ms,
    AVG(h.tokens_used) as avg_tokens,
    SUM(CASE WHEN h.success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
    MAX(h.extraction_timestamp) as last_extraction
FROM portal_plugins p
LEFT JOIN portal_extraction_history h ON p.plugin_id = h.plugin_id
GROUP BY p.plugin_id;
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
CREATE VIEW trip_client_relationships AS
SELECT DISTINCT
    t.trip_id,
    t.trip_name,
    -- From normalized junction table
    tca.client_email as assigned_email,
    tca.client_role as assigned_role,
    tca.created_at as assigned_at,
    'junction_table' as source
FROM trips_v2 t
JOIN trip_client_assignments tca ON t.trip_id = tca.trip_id

UNION ALL

SELECT DISTINCT
    t.trip_id,
    t.trip_name,
    -- From denormalized JSON field
    JSON_EXTRACT(client.value, '$.email') as assigned_email,
    JSON_EXTRACT(client.value, '$.role') as assigned_role,
    JSON_EXTRACT(client.value, '$.assigned_at') as assigned_at,
    'json_field' as source
FROM trips_v2 t,
     JSON_EACH(t.clients) as client
WHERE JSON_EXTRACT(client.value, '$.email') IS NOT NULL;
