# Trip Search Surface Overview

## Purpose
`trip_search_surface` provides a denormalized view of each trip for conversational search. It merges trip metadata, traveler assignments, and precomputed tokens so fuzzy queries can resolve to the correct trip quickly.

## Schema
- **trip_id** – primary key matching `trips_v2.trip_id`
- **trip_name**, **trip_slug**, **status**, **start_date**, **end_date**, **destinations**
- **primary_client_name**, **primary_client_email**
- **traveler_names**, **traveler_emails** – JSON arrays captured from `trip_client_assignments`
- **normalized_* columns** – lowercase, diacritic-free strings for name, destinations, traveler names, and emails
- **search_tokens** – space-delimited list of unique tokens extracted from trip name, slug, destinations, traveler names/emails, and numeric identifiers
- **phonetic_tokens** – additional tokens capturing common misspellings (e.g., `chisholm → chisolm`, `stoneleigh → stonleigh`)
- **last_synced** – timestamp of last refresh

Supporting tables and indexes:
- `trip_search_surface_dirty` queue of trip ids requiring refresh
- Indices on `search_tokens`, `status`, `primary_client_email`, and dirty queue

## Synchronization
SQLite triggers ensure the surface stays in sync:
- `trips_v2` insert/update/deletes enqueue rows in `trip_search_surface_dirty`
- `trip_client_assignments` insert/update/deletes enqueue affected trip ids
- Deletes from `trips_v2` also remove surface rows immediately

The worker exposes a `refresh_trip_search_surface` tool which:
1. Processes queued dirty rows (`refreshDirty`)
2. Allows manual refresh for a specific trip (`trip_id`)
3. Supports batch rebuilds (`refresh_all` with optional limit)

`TripSearchSurfaceManager` handles token generation, phonetic expansion, and persistence. It derives traveler fallback names from email addresses when needed.

## Usage
- After deploying new migrations, run:
  ```bash
  wrangler d1 execute DB --remote --command "DELETE FROM trip_search_surface_dirty"
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":"seed","method":"tools/call","params":{"name":"refresh_trip_search_surface","arguments":{"refresh_all":true}}}' \
    https://d1-database-improved.somotravel.workers.dev/sse
  ```
  (or call the MCP tool via LibreChat) to backfill existing trips.
- Automated refresh: call `refresh_trip_search_surface` periodically (e.g., via cron) or when the assistant notices stale results. The dirty queue ensures only changed trips are refreshed.
- Future search logic (`continue_trip`, `get_anything`) should query `trip_search_surface` / `phonetic_tokens` for typo resilience.

## Testing
`trip-search-surface.test.ts` uses a mock D1 database to verify:
- Token generation includes slug/destination tokens and phonetic variants.
- Refreshing dirty rows clears the queue and populates surface rows.

## Deployment Notes
- Migration file: `migrations/023_trip_search_surface.sql`
- Worker integration: `TripSearchSurfaceManager`, `refresh_trip_search_surface` tool.
- Ensure Cloudflare deployment runs the migration (e.g., `wrangler d1 migrations apply DB --remote`). After deployment, run the refresh tool once to seed existing data.
