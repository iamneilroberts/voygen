# TASK-0074: Unified Trip Search Surface

## Goal
Build a denormalized, typo-tolerant search surface that combines trip metadata, client assignments, and derived tokens so conversational queries can reliably match existing trips (even with spelling mistakes). This will become the primary lookup source for `continue_trip`, `get_anything`, and future search tooling.

## Deliverables
- A new persistent table or materialized view (e.g., `trip_search_surface`) in the D1 schema containing:
  - `trip_id`, `trip_name`, `trip_slug`, `status`, `start_date`, `end_date`
  - Primary client email/name plus all traveler names/emails from `trip_client_assignments`
  - Normalized searchable columns (lowercase, stripped punctuation) for names, destinations, emails
  - A derived `search_tokens` column containing deduplicated tokens (names, surnames, destinations, slug parts)
  - Optional `phonetic_tokens` column capturing predictable misspellings (e.g., `chisholm → chisolm`, `stonleigh → stoneleigh`)
- Migration script(s) + trigger or scheduled maintenance process to keep the surface synchronized when trips or assignments change.
- Wrangler migration applied to the remote D1 instance.
- Documentation of schema, triggers, and how to refresh the surface (`.project/database` or README entry).

## Implementation Steps
1. **Schema Design**
   - Draft the table / view definition (using SQL in `remote-mcp-servers/d1-database-improved/migrations`).
   - Define helper SQL/JS to tokenize names (lowercase, remove diacritics, split on punctuation).
   - Enumerate predictable typos/phonetic substitutions and encode as additional tokens.
2. **Data Population**
   - Write migration to backfill existing trips, joining `trips_v2`, `trip_client_assignments`, `clients_v2`.
   - Ensure re-runs are idempotent (truncate + insert or `INSERT ... ON CONFLICT`).
3. **Synchronization Hooks**
   - Add triggers or worker-side utilities so inserts/updates/deletes on trips and assignments refresh the surface row.
   - Provide a manual refresh tool (`refresh_trip_search_surface(trip_id)` or similar) callable from the MCP server.
4. **Validation**
   - Add Vitest coverage in `remote-mcp-servers/d1-database-improved/tests/` verifying:
     - Token generation (e.g., handles `Chisholm`, `Stoneleigh`).
     - Record updates when travelers change.
   - Manual QA via `wrangler d1 execute ...` confirming expected rows/tokens for the Chisholm trip.
5. **Docs & Release**
   - Update search-related documentation (`.project/tasks/TASK-0070...` or new doc) explaining how the surface is used.
   - Note deployment steps (migration + worker redeploy) and record completion in task tracker.

## Dependencies
- Existing search optimization tasks (TASK-0070/0073). This task extends them with concrete schema.

## Estimated Effort
6–8 hours (schema + migrations 3h, sync hooks 2h, tests/docs 2h).

## Acceptance Criteria
- `trip_search_surface` exists remotely and contains entries for all current trips.
- Tokens include variants that allow `Chisolm` or `Stonleigh` to map to the Chisholm trip.
- Updating/adding a traveler immediately (or via trigger run) updates the relevant search row.
- Tests covering tokenization and synchronization pass locally (`npm test`) and remotely deploy without errors.
