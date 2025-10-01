# D1 Database MCP - Improved Version

## Overview
This is an improved version of the D1 Database MCP that addresses the SQLite authorization errors and provides automatic initialization.

## Key Improvements

### 1. Automatic Initialization
- Database schema is automatically initialized on first use
- No need to manually run `initialize_travel_schema` first
- Initialization state is tracked to avoid redundant checks

### 2. Better Error Handling
- Clear error messages for authorization issues
- Helpful tips when D1 restrictions are encountered
- Graceful fallbacks for schema introspection

### 3. Enhanced Tools
- `check_database_status` - New tool to verify database health
- Improved `get_database_schema` with workarounds for D1 restrictions
- All tools now include automatic initialization checks

## Features

### Database Tables
- **travel_searches** - Stores travel search history
- **user_preferences** - Stores user travel preferences  
- **popular_routes** - View aggregating popular travel routes

### Available Tools (high-level)
1. `initialize_travel_schema` - Manual initialization (kept for compatibility)
2. `store_travel_search` - Store a travel search
3. `get_search_history` - Retrieve search history
4. `get_popular_routes` - Get popular travel routes
5. `store_user_preference` - Store user preferences
6. `get_user_preferences` - Retrieve user preferences
7. `execute_query` - Execute custom SELECT queries
8. `get_database_schema` - Get database schema (with D1 workarounds)
9. `check_database_status` - Check database health and stats
10. `import_trip_page` - Import a public web page into a trip (no browser). Saves FULL HTML + extracted text, adds a reference in `trips_v2.documents`.
11. `get_trip_documents` - List stored external documents for a trip (optional HTML/text preview).
12. `import_trip_page_and_parse` - Enhanced parser for imported pages with schedule-first strategy and flexible overwrite options.
13. `bulk_trip_operations` - Perform multiple trip operations including the new `import_and_parse_from_url` bulk orchestration.

## Enhanced Trip Parser (TASK-0079)

The `import_trip_page_and_parse` tool now includes powerful schedule-first parsing with support for diverse itinerary formats:

### Parsing Strategies

#### `schedule_first` (default)
- Automatically isolates schedule sections using markers like:
  - `📅 Schedule`, `Itinerary`, `Day-by-Day`, `Daily Activities`
  - Anniversary formats: `Your Itinerary`, `Trip Details`
  - Business formats: `Agenda`, `Schedule Overview`
- Falls back to full text if no schedule section found

#### `full_text`
- Processes entire document content
- Uses existing Day X detection plus enhanced date headers

### Date Detection Formats
Supports multiple date formats commonly found in travel itineraries:
- Full dates: `September 18, 2025`, `April 20, 2026`
- Abbreviated: `Sept 20`, `Apr 22, 2026`, `Mar 15`
- Numeric: `4/20/25`, `9/18/2025` (US format), `20/4/25` (EU format)
- Day combinations: `Day 1: September 18`, `Monday, April 21`

### Enhanced Activity Classification
Automatically classifies activities into types:
- **meal**: breakfast, lunch, dinner, dining, restaurant, cafe
- **lodging**: hotel, check-in, check-out, accommodation, resort
- **flight**: flight, departure, arrival, airport, airline
- **transfer**: transfer, transport, drive, taxi, shuttle
- **tour**: tour, guided, sightseeing, attraction, museum
- **activity**: general activities, entertainment, recreation
- **shopping**: shopping, market, store, boutique

### Time Extraction
Supports various time formats:
- 12-hour: `10:00 AM`, `2 PM`, `7:30 PM`
- 24-hour: `14:30`, `09:00`
- Ranges: `2 PM - 4 PM`, `10:00 AM – 12:00 PM`

### Overwrite Options
- **none** (default): Skip duplicates, preserve existing data
- **days**: Replace only matching day numbers
- **all**: Replace all trip days and activities

### Bulk Orchestration
The new `import_and_parse_from_url` operation in `bulk_trip_operations` provides one-shot workflows:

```json
{
  "trip_identifier": "1",
  "operations": [
    {
      "type": "import_and_parse_from_url",
      "data": {
        "url": "https://somotravel.us/chisolm-trip-details.html",
        "strategy": "schedule_first",
        "overwrite": "days",
        "rename_to": "Chisholm Family European Adventure",
        "update_slug": true,
        "tag": "enhanced_import"
      }
    }
  ]
}
```

This single operation:
1. Imports the web page content
2. Parses it using the enhanced schedule-first strategy
3. Optionally renames the trip and updates the slug
4. Returns combined results from all steps

### Supported Itinerary Formats
Tested and optimized for:
- **Formal schedules**: emoji markers, clear day/time structure
- **Anniversary trips**: romantic language, activity focus
- **Business travel**: agenda-style formatting, meeting schedules
- **Activity trips**: ski trips, city tours with time-based scheduling
- **Mixed formats**: various date styles and informal structure

## Deployment

1. Update `wrangler.toml` with your D1 database ID
2. Install dependencies: `npm install`
3. Deploy: `npm run deploy`

## Usage in Claude Desktop

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "d1-database-improved": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://d1-database-improved.your-domain.workers.dev/sse"
      ]
    }
  }
}
```

## Trip Import & Parsing (No Browser)

Use these tools instead of MCP Chrome for importing external trip content:

- `import_trip_page({ trip_id|trip_identifier, url, tag?, save_raw_html=true, save_text=true, overwrite=false })`
  - Server-side fetch of the page; stores HTML + text in `trip_external_docs`; appends a reference in `trips_v2.documents`.
- `get_trip_documents({ trip_id|trip_identifier, limit=10, include_text?, include_html? })`
  - Lists stored docs for QA and previews.
- `import_trip_page_and_parse({ trip_id|trip_identifier, doc_id?, url?, dry_run=false, max_days=14 })`
  - Heuristically splits into Day X blocks and extracts times → creates `TripDays` + `trip_activities_enhanced`.

Example (JSON-RPC over HTTP):
```bash
curl -s $WORKER \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"import_trip_page","arguments":{"trip_id":1,"url":"https://somotravel.us/chisolm-trip-details.html"}}}'

curl -s $WORKER \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"import_trip_page_and_parse","arguments":{"trip_id":1,"max_days":8,"max_activities_per_day":8}}}'
```

## How It Works

### Automatic Initialization Flow
1. When any tool is called, it checks if the database is initialized
2. If not initialized, it automatically creates the schema
3. The initialization state is cached to avoid repeated checks
4. If initialization fails, clear error messages are provided

### Handling D1 Restrictions
- D1 restricts access to certain SQLite system functions
- The improved schema tool uses `sqlite_master` queries instead of PRAGMA
- Fallback documentation is provided when schema access fails
- Error messages include helpful tips for working around restrictions

## Migration from v2
No migration needed - the improved version is backward compatible and will automatically initialize the database on first use.
