# Trip Facts Pipeline

## Purpose
`trip_facts` stores lightweight aggregates so the assistant can answer “How many travelers?”, “What’s the total trip cost?”, or “When was this last computed?” without scanning raw itinerary tables. The data also feeds the new trip search surface.

## Schema Changes
- Added columns via `migrations/024_trip_facts_enhancements.sql`:
  - `traveler_count`
  - `traveler_names` (JSON array)
  - `traveler_emails` (JSON array)
  - `primary_client_email`
  - `primary_client_name`
- Index on `primary_client_email` for direct lookups.
- New triggers on `trip_client_assignments` so traveler changes enqueue rows in `facts_dirty`.

## Refresh Logic
`FactTableManager.refreshTripFacts(trip_id)` now:
1. Loads the trip + primary client info from `trips_v2` / `clients_v2`.
2. Collects traveler names/emails (falling back to title-cased email when name absent).
3. Aggregates totals from:
   - `TripDays` (nights)
   - `trip_activities_enhanced` (activities/hotels, costs)
   - `trip_legs` (transit minutes, if table exists)
4. Writes JSON-encoded traveler data alongside numeric totals and timestamps.
5. Returns a summary object for tool responses.

`FactTableManager.refreshDirty()` processes the `facts_dirty` queue, calling `refreshTripFacts` and clearing entries.

## Tooling
The existing MCP tool `refresh_trip_facts` now reports:
- `refreshed_count` / `error_count`
- Per-trip summaries (traveler names, counts, totals)
- Optional `error_details`

Usage examples:
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"facts","method":"tools/call","params":{"name":"refresh_trip_facts","arguments":{"refresh_all":true,"limit":100}}}' \
  https://d1-database-improved.somotravel.workers.dev/sse
```

## Testing
- `tests/trip-facts-manager.test.ts` exercises the aggregation using a mock D1 adapter.
- Existing Vitest suite (`npx vitest run tests/trip-facts-manager.test.ts`) must stay green before deployment.

## Deployment
1. Apply migration: `wrangler d1 execute DB --remote --file migrations/024_trip_facts_enhancements.sql`
2. Redeploy worker: `npx wrangler deploy`
3. Seed facts: call `refresh_trip_facts` with `refresh_all:true`

## Follow-Up
- TASK-0076 will consume `trip_facts` and `trip_search_surface` together.
- Consider a periodic cron job invoking `refresh_trip_facts` dirty queue mode in production.
