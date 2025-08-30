-- LLM-Optimized Database Design
-- Throws out all traditional database design principles in favor of LLM efficiency

-- Single "universal" table that answers 90% of queries
CREATE TABLE IF NOT EXISTS llm_trip_context (
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

-- Indexes designed for LLM access patterns
CREATE INDEX idx_llm_natural ON llm_trip_context(natural_key);
CREATE INDEX idx_llm_keywords ON llm_trip_context(search_keywords);
CREATE INDEX idx_llm_active_date ON llm_trip_context(is_active, relevance_date);

-- Even more radical: A conversation memory table
CREATE TABLE IF NOT EXISTS llm_conversation_memory (
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

-- The "answer any question" view
CREATE VIEW llm_universal_answer AS
SELECT 
    'For "' || natural_key || '": ' || chr(10) || chr(10) || formatted_response as complete_answer,
    context_type,
    search_keywords
FROM llm_trip_context
WHERE is_active = 1;

-- Pre-computed common questions table
CREATE TABLE IF NOT EXISTS llm_faq_cache (
    question_pattern TEXT PRIMARY KEY,
    answer_template TEXT NOT NULL,
    sql_query TEXT, -- Query to fill in the template
    last_used TIMESTAMP,
    use_count INTEGER DEFAULT 0
);

-- Seed with common patterns
INSERT OR REPLACE INTO llm_faq_cache (question_pattern, answer_template, sql_query) VALUES
('what trips are coming up', 
 'Upcoming trips:
{results}',
 'SELECT natural_key, substr(formatted_response, 1, 200) || "..." as summary FROM llm_trip_context WHERE context_type = "trip_full" AND relevance_date > date("now") ORDER BY relevance_date LIMIT 10'),

('tell me about * trip',
 '{results}',
 'SELECT formatted_response FROM llm_trip_context WHERE natural_key LIKE ? AND context_type = "trip_full" LIMIT 1'),

('what is * email',
 '{results}',
 'SELECT formatted_response FROM llm_trip_context WHERE search_keywords LIKE ? AND context_type = "client_profile" LIMIT 1');

-- The ultimate LLM helper: Single response for everything
CREATE TABLE IF NOT EXISTS llm_smart_responses (
    response_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_phrase TEXT NOT NULL, -- "trip summary", "client info", "daily schedule"
    
    -- The complete response with all possible variations
    mega_response TEXT NOT NULL,
    /* Example for "trip summary":
    "Here's the trip information you might need:

    === BASIC INFO ===
    {trip_name} ({start_date} to {end_date})
    Status: {status} | Total Cost: ${total_cost:,} ({currency})
    Paid: ${paid_amount:,} | Balance Due: ${balance_due:,}

    === TRAVELERS ===
    {travelers_formatted}

    === QUICK STATS ===
    - {num_days} days, {num_nights} nights
    - {num_activities} planned activities
    - {num_destinations} destinations
    - Hotels booked: {hotels_booked}
    - Flights booked: {flights_booked}

    === FULL ITINERARY ===
    {full_itinerary}

    === ACCOMMODATIONS ===
    {accommodations_detail}

    === TRANSPORTATION ===
    {transportation_detail}

    === IMPORTANT NOTES ===
    {notes_and_preferences}

    === DOCUMENTS ===
    {documents_list}

    === FINANCIAL BREAKDOWN ===
    {financial_detail}

    === ACTION ITEMS ===
    {pending_items}
    "
    */
    
    -- Variables that can be replaced
    variable_mappings JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document this madness
INSERT OR REPLACE INTO db_documentation (object_type, object_name, description, usage_examples) VALUES
('table', 'llm_trip_context', 
 'LLM-optimized table with pre-formatted responses. Returns complete trip info as formatted text - no processing needed!',
 'Just search by any natural identifier and get a complete, formatted response ready for display'),

('table', 'llm_conversation_memory',
 'Maintains conversation context between tool calls - reduces need to re-query same data',
 'Automatically updated to track what the LLM has already learned in this session'),

('table', 'llm_faq_cache',
 'Pre-computed answers to common question patterns - instant responses',
 'Pattern matching for frequent queries to avoid any database work'),

('table', 'llm_smart_responses',
 'Mega-responses that include ALL possible information user might want next',
 'Return everything at once to avoid follow-up tool calls');