Voygent-Prod Database Plan

Scope
- Create a new Cloudflare D1 database `voygent-prod` with a simplified, consistent schema that preserves current tool expectations while removing unstable/unused parts.
- Migrate essential data (clients, trips, assignments, LLM context, templates, hotel cache) from the current DB.
- Keep external-facing table names: `trips_v2`, `clients_v2`, `trip_client_assignments`, `ActivityLog`, `llm_*`, `search_index`, `HtmlDocumentTemplates`, `proposals`, `hotel_cache`, `rooms_cache`.

What changes vs. current DB
- Remove legacy v1 tables (`Trips`, `Clients`, `TripDays`, `TripParticipants`, etc.).
- Consolidate facts to `trip_facts` + `facts_dirty` only; drop duplicate variants.
- Retain publication/search extras on `trips_v2` (`trip_slug`, `dashboard_status`, `published_url`, etc.).
- Keep hotel cache (used by proposal generation) and indexes.
- Exclude experimental provider/commission engines for now (can be re-added later without data coupling).

Files
- `remote-mcp-servers/d1-database-improved/migrations/voygent_prod_schema.sql`: authoritative schema.
- `remote-mcp-servers/d1-database-improved/migrations/voygent_prod_data_migration.sql`: export/import guidance and insert skeletons.

Cutover Steps (Cloudflare)
1) Create new DB and apply schema
   - `wrangler d1 create voygent-prod`
   - `wrangler d1 execute voygent-prod --file=remote-mcp-servers/d1-database-improved/migrations/voygent_prod_schema.sql`

2) Export required data from old DB
   - Use the commands in `voygent_prod_data_migration.sql` to export JSON or a full sqlite dump.

3) Import to new DB
   - For full import: `wrangler d1 import voygent-prod --remote --file=old_export.sqlite` then drop legacy tables.
   - For targeted import: write a tiny Worker or CLI script to stream JSON files into batched INSERTs.

4) Rebuild computed artifacts
   - Recreate `search_index` and (optionally) repopulate `llm_trip_context` using `migrations/008_populate_llm_context.sql` or `src/tools/migration-tools.ts` utilities.

5) Point MCP servers to `voygent-prod`
   - Option A (no code change): replace the DB binding in `wrangler.toml` to target the new DB (keeps binding as `DB`).
   - Option B (dual DBs for staged cutover): add a second binding (e.g., `DB_PROD`) and update server init to use it; remove the old binding after verification.

Verification Checklist
- Health checks run: `health_check`, `explore_database`, `refresh_trip_facts`.
- End-to-end: create trip, assign client, generate proposal, publish, verify slug search.
- Performance: `llm_query_log` entries record search flow; success rate improves with slug/normalization.

Next Focus (from analysis)
- Search normalization and slugs (punctuation/order-insensitive matching).
- Stabilize facts refresh (keep single trigger chain only).
- Defer commission/provider engines until core flows are stable.

