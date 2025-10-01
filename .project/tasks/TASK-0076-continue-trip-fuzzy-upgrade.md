# TASK-0076: Continue Trip Fuzzy Matching Upgrade

## Goal
Leverage the new search surface (TASK-0074) and trip facts (TASK-0075) to overhaul `continue_trip` and `get_anything` so they gracefully handle fuzzy queries, present relevant suggestions, and return traveler details without manual digging.

## Deliverables
- Updated `continue_trip` handler in `remote-mcp-servers/d1-database-improved/src/tools/search-tools.ts` that:
  - Queries `trip_search_surface` when ActivityLog search misses
  - Scores and returns the best match plus up to N alternates in a structured payload
  - Includes traveler list (from `trip_facts` / `trip_client_assignments`) in the success response
- `get_anything` enhancements to use the same surface for fuzzy matching and to surface traveler/phase data in formatted responses.
- Assistant-facing response contract updates (documented) so the prompt knows how to render suggestions.
- New Vitest integration tests covering typos (`Chisolm`, `Stonleigh`), slug lookups, and traveler retrieval.

## Implementation Steps
1. **Data Integration**
   - Adapt SQL queries to join `trip_search_surface` and `trip_facts` for both `continue_trip` and `get_anything` flows.
   - Implement scoring: e.g., exact slug > token match count > date proximity.
2. **Suggestion Handling**
   - Ensure failure responses include `suggestions` with `trip_id`, `trip_name`, `slug`, `traveler_preview`.
   - Update startup-core instructions (already partially done) to describe how to present suggestions.
3. **Traveler Payload**
   - On success, include traveler names/emails (from facts or assignments) in the returned context so the assistant can answer “Who are the travelers?” instantly.
4. **Tests**
   - Unit coverage for scoring/selection logic.
   - Integration tests verifying typos resolve to the intended trip.
5. **Performance Check**
   - Benchmark queries (e.g., `wrangler d1 execute --remote`) to ensure sub-100ms execution on typical data.
6. **Docs & Deployment**
   - Update tool documentation (`d1-database-improved/README.md`) with new schema dependencies and response shapes.
   - Redeploy worker and confirm via `travel_agent_start` + manual queries that Chisholm flows succeed.

## Dependencies
- TASK-0074 (search surface) and TASK-0075 (facts) should be complete or at least stubbed.

## Estimated Effort
4–6 hours (query logic 3h, tests 1.5h, docs/deploy 1h).

## Acceptance Criteria
- `continue_trip` resolves “Chisolm Dublin London Stonleigh” to the correct trip or offers suggestions that include it.
- `get_anything({ query: 'Chisolm travelers' })` returns traveler details without referencing unrelated trips.
- All new tests pass and existing suites remain green.

## Current Progress
- Added unified trip search surface integration (`searchTripSurface`) leveraged by both `continue_trip` and `get_anything` for fuzzy matching, slug detection, and traveler hydration.
- `continue_trip` now returns structured suggestions, selected-match metadata, and traveler lists sourced from `trip_facts` while logging matches back to conversation memory.
- `get_anything` surfaces the same traveler/context payload on fuzzy matches, with markdown-ready summaries and alternative suggestions.
- Introduced Vitest coverage (`tests/trip-surface-search.test.ts`) validating typo handling (`Chisolm`/`Stonleigh`) and slug resolution via the new search helper.
