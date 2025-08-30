# Travel Assistant Database Schema

**Database**: travel_assistant (Cloudflare D1)  
**Database ID**: e6723f99-1d99-45bb-a941-e7600a56abe9  
**Last Updated**: 2025-07-28

## Overview

The travel_assistant database is the single consolidated database for the Claude Travel Agent system. It contains all travel data, client information, trip planning details, and system instructions.

## Core Tables

### Clients & Groups

#### Clients
Primary table for storing client information.
```sql
CREATE TABLE Clients (
    client_id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'United States',
    date_of_birth TEXT,
    passport_number TEXT,
    passport_expiry TEXT,
    preferences TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### ClientGroups
For managing families or travel groups.
```sql
CREATE TABLE ClientGroups (
    group_id INTEGER PRIMARY KEY,
    group_name TEXT NOT NULL,
    primary_client_id INTEGER,
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_client_id) REFERENCES Clients(client_id)
);
```

### Trips & Planning

#### Trips
Main trip records.
```sql
CREATE TABLE Trips (
    trip_id INTEGER PRIMARY KEY,
    trip_name TEXT NOT NULL,
    group_id INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    duration INTEGER,
    status TEXT DEFAULT 'Planned',
    description TEXT,
    total_cost REAL,
    currency TEXT DEFAULT 'USD',
    paid_amount REAL DEFAULT 0,
    balance_due REAL,
    agent_name TEXT,
    agent_contact TEXT,
    special_requests TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES ClientGroups(group_id)
);
```

#### TripParticipants
Links clients to trips.
```sql
CREATE TABLE TripParticipants (
    trip_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    role TEXT DEFAULT 'traveler',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, client_id),
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES Clients(client_id) ON DELETE CASCADE
);
```

#### TripDays
Daily itinerary structure.
```sql
CREATE TABLE TripDays (
    day_id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    date TEXT,
    day_name TEXT,
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id)
);
```

### Accommodations & Activities

#### Accommodations
Hotel and lodging details.
```sql
CREATE TABLE Accommodations (
    accommodation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    trip_day_id INTEGER,
    accommodation_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    phone TEXT,
    check_in_date TEXT,
    check_out_date TEXT,
    room_type TEXT,
    confirmation_number TEXT,
    total_cost REAL,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE
);
```

#### TripActivities
Daily activities and attractions.
```sql
CREATE TABLE TripActivities (
    activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    day_id INTEGER NOT NULL,
    start_time TEXT,
    end_time TEXT,
    activity_type TEXT NOT NULL,
    activity_title TEXT NOT NULL,
    description TEXT,
    location_name TEXT,
    destination_id INTEGER,
    notes TEXT,
    is_hidden_gem BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (day_id) REFERENCES TripDays(day_id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES Trips(trip_id) ON DELETE CASCADE
);
```

### Instructions & Configuration

#### instruction_sets
Dynamic instruction storage (migrated from prompt-instructions-d1-db).
```sql
CREATE TABLE instruction_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,        -- Unique identifier like 'startup-core'
    title TEXT NOT NULL,              -- Human-readable title
    content TEXT NOT NULL,            -- Markdown instruction content
    category TEXT DEFAULT 'general',  -- Category: modes, tools, workflows, etc.
    active BOOLEAN DEFAULT 1,         -- Active flag
    version INTEGER DEFAULT 1,        -- Version number
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### commission_config
Commission rates and targets.
```sql
CREATE TABLE commission_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Error Tracking

#### db_errors
Database error logging for continuous improvement.
```sql
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
```

### Web Capture & Research

#### WebCaptures
Stores captured web content for research.
```sql
CREATE TABLE WebCaptures (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    capture_type TEXT DEFAULT 'manual',
    content_type TEXT,
    confidence_score REAL,
    raw_html TEXT,
    raw_text TEXT,
    screenshot_url TEXT,
    metadata JSON,
    session_id TEXT,
    trip_id TEXT REFERENCES Trips(id),
    client_id TEXT REFERENCES Clients(id),
    created_by TEXT
);
```

### Delta Vacations Search

#### dv_searches
Delta Vacations search tracking.
```sql
CREATE TABLE dv_searches (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    search_origin TEXT NOT NULL,
    search_destination TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    return_date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 2,
    children INTEGER DEFAULT 0,
    rooms INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_hotels INTEGER,
    total_flights INTEGER
);
```

#### dv_hotels
Delta Vacations hotel results.
```sql
CREATE TABLE dv_hotels (
    id TEXT PRIMARY KEY,
    search_id TEXT NOT NULL,
    hotel_code TEXT,
    name TEXT NOT NULL,
    star_rating TEXT,
    location TEXT,
    price REAL,
    commission_rate REAL DEFAULT 15.0,
    estimated_commission REAL,
    amenities TEXT,
    description TEXT,
    FOREIGN KEY (search_id) REFERENCES dv_searches(id) ON DELETE CASCADE
);
```

## Key Relationships

1. **Clients → Trips**: Via TripParticipants (many-to-many)
2. **Trips → TripDays**: One-to-many (daily itinerary)
3. **TripDays → Activities**: One-to-many (daily activities)
4. **Trips → Accommodations**: One-to-many
5. **WebCaptures → Trips/Clients**: Optional associations

## Important Notes

1. **Consolidated Database**: This is now the ONLY database for the travel agent system
2. **No More Split Databases**: We've migrated from:
   - ~~prompt-instructions-d1-db~~ → Merged into travel_assistant
   - ~~delta-vacations-db~~ → Removed (unused)
   - ~~travel-gallery~~ → Removed (unused)
   - ~~prompt-instructions-db~~ → Removed (duplicate)

3. **Correct Column Names**:
   - instruction_sets uses `id` (not `instruction_id`)
   - instruction_sets uses `active` (not `is_active`)
   - This matches the original design spec

4. **MCP Server Access**: The d1-database-improved server provides tools for all tables

## Migration History

1. **2025-07-28**: Consolidated multiple databases into travel_assistant
2. **2025-07-28**: Fixed instruction_sets schema to match design spec
3. **2025-07-28**: Added db_errors table for error tracking
4. **2025-07-28**: Added commission_config table