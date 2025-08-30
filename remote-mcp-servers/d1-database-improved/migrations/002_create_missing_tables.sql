-- Delta Vacations Search Results Table
CREATE TABLE IF NOT EXISTS dv_searches (
    search_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    search_type TEXT NOT NULL DEFAULT 'package', -- package, hotel_only, flight_only
    origin_airport TEXT,
    destination_airport TEXT,
    departure_date TEXT,
    return_date TEXT,
    adults INTEGER DEFAULT 2,
    children INTEGER DEFAULT 0,
    rooms INTEGER DEFAULT 1,
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    results_count INTEGER,
    min_price REAL,
    max_price REAL,
    currency TEXT DEFAULT 'USD',
    search_parameters JSON, -- Store all search params
    results_summary JSON,   -- Store top results
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delta Vacations Hotel Details Table
CREATE TABLE IF NOT EXISTS dv_hotels (
    hotel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dv_hotel_code TEXT UNIQUE NOT NULL,
    hotel_name TEXT NOT NULL,
    destination TEXT,
    address TEXT,
    city TEXT,
    state_province TEXT,
    country TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    star_rating TEXT,
    amenities JSON,
    room_types JSON,
    description TEXT,
    images JSON,
    price_range_min REAL,
    price_range_max REAL,
    currency TEXT DEFAULT 'USD',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link searches to trips for context
CREATE TABLE IF NOT EXISTS trip_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    search_id INTEGER NOT NULL,
    search_purpose TEXT, -- initial_planning, alternative_options, price_comparison
    selected_option JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id),
    FOREIGN KEY (search_id) REFERENCES dv_searches(search_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dv_searches_session ON dv_searches(session_id);
CREATE INDEX IF NOT EXISTS idx_dv_searches_dates ON dv_searches(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_dv_searches_destination ON dv_searches(destination_airport);
CREATE INDEX IF NOT EXISTS idx_dv_hotels_destination ON dv_hotels(destination);
CREATE INDEX IF NOT EXISTS idx_dv_hotels_code ON dv_hotels(dv_hotel_code);
CREATE INDEX IF NOT EXISTS idx_trip_searches_trip ON trip_searches(trip_id);