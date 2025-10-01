# TASK-0075: Trip Facts Aggregation Pipeline

## Goal
Populate and maintain the `trip_facts` table so conversational agents can retrieve quick summaries (travelers, nights, hotels, activities, costs) without scanning raw tables. This provides a consistent data source for the new search surface and downstream tools.

## Deliverables
- Migration(s) that define or update `trip_facts` with necessary columns:
  - `trip_id`, `traveler_count`, `traveler_names`, `total_nights`, `total_hotels`, `total_activities`, `total_cost`, `transit_minutes`, `last_computed`, `version`
- Worker-side utilities or SQL procedures to recompute facts for a single trip and in batch.
- Trigger or scheduler strategy ensuring `trip_facts` stays current when bookings/travelers change.
- MCP tool or internal function (`refresh_trip_facts`) that can be invoked by the assistant for on-demand refresh.
- Tests verifying aggregation math and data freshness.

## Implementation Steps
1. **Schema Review & Enhancement**
   - Confirm existing structure of `trip_facts`; adjust types/indexes as needed.
   - Add missing columns (e.g., `traveler_names`, `primary_client_email`).
2. **Aggregation Query**
   - Implement SQL/JS to compute aggregated values from `trips_v2`, `trip_client_assignments`, `confirmed_items`, etc.
   - Handle null-safe counts (no bookings yet) and cost rollups.
3. **Update Hooks**
   - Choose approach: triggers (on trips/assignments/confirmed_items) or worker job invoked by MCP tools.
   - Ensure the refresh runs on trip creation, traveler assignment, itinerary updates.
4. **MCP Tool Exposure**
   - Add a new tool in `remote-mcp-servers/d1-database-improved` (e.g., `refresh_trip_facts`) so the assistant can trigger recomputation when needed.
   - Return a summary payload (counts, cost) for immediate use.
5. **Testing**
   - Vitest coverage for aggregation logic and tool handler.
   - Manual validation: compute facts for Chisholm trip and confirm traveler names/costs populate correctly.
6. **Documentation & Deployment**
   - Document pipeline in `.project/database` or `d1-database-improved/README`.
   - Run migrations against remote D1 and redeploy worker.

## Dependencies
- TASK-0074 (search surface) benefits from populated facts but can proceed independently.
- Existing booking/itinerary tables should be stable.

## Estimated Effort
5–7 hours (schema + aggregation 3h, hooks/tools 2h, tests/docs 2h).

## Acceptance Criteria
- `trip_facts` contains rows for all current trips with accurate counts and cost data.
- Recomputing facts after modifying traveler assignments updates `traveler_count` and names.
- `refresh_trip_facts` tool responds within acceptable time (<300ms typical data set) with updated payload.
- Tests covering core scenarios pass.

## Current Progress
- Migration `024_trip_facts_enhancements.sql` adds traveler metadata columns and dirty triggers on `trip_client_assignments`.
- `FactTableManager.refreshTripFacts` now hydrates traveler names/emails (with email-derived fallbacks), primary client details, activity/hotel counts, costs, and transit minutes; nights default to TripDays span with a start/end fallback.
- `refresh_trip_facts` MCP tool (in `fact-management.ts`) refreshes single trips, dirty queues, or forced batches and returns per-trip summaries.
- Vitest coverage (`tests/trip-facts-manager.test.ts`) verifies aggregation math and JSON encoding for traveler details.
