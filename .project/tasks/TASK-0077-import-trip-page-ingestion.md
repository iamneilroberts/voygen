# TASK-0077: Import Trip Page (No-Browser Ingestion)

## Goal
Allow the assistant to ingest the FULL contents of a public trip web page (HTML + extracted text) and store it in Voygen without using MCP Chrome. This enables reliable bulk imports for trips planned elsewhere and avoids browser automation errors.

## Deliverables
- New MCP tool in the D1 worker: `import_trip_page`
  - Inputs: `{ trip_id | trip_identifier, url, tag?, save_raw_html=true, save_text=true, overwrite=false }`
  - Behavior:
    - Server-side `fetch(url)` (no browser), follow redirects
    - Create table `trip_external_docs` if missing
    - Insert row with `{trip_id, url, content_type, size_bytes, html?, text?, tag, created_at}`
    - Append a reference entry to `trips_v2.documents` array: `{doc_id, url, content_type, size_bytes, tag, fetched_at}`
    - Log `ActivityLog: ExternalDocImported`
  - Output: `{ success, trip_id, doc_id, url, content_type, bytes_saved, saved_html, saved_text }`
- Wiring: expose in `llm-optimized-tools` for general use
- Startup instructions update: explicitly prefer `import_trip_page` over MCP Chrome even when a URL is provided
- Tests: Vitest test that fetches sample HTML and verifies storage
- Docs: short README note in worker and task update here

## Implementation Notes
- Storage table (created on demand):
  ```sql
  CREATE TABLE IF NOT EXISTS trip_external_docs (
    doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    html TEXT,
    text TEXT,
    tag TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
  );
  ```
- Append-only references in `trips_v2.documents` keep the main row small while docs live in `trip_external_docs`.
- Defaults for `save_raw_html` and `save_text` are TRUE and enforced inside the handler (not relying on client defaults).

## Acceptance Criteria
- Calling `import_trip_page({ trip_id, url })` fetches and stores HTML+text; returns `success: true` with a `doc_id > 0` and positive `bytes_saved`.
- `trips_v2.documents` JSON array includes a new reference pointing to `doc_id` with `url` and `size_bytes`.
- No MCP Chrome calls are made by the agent for generic imports.
- Unit test passes and worker is deployed.

## Rollout & Verification
- Deploy worker; run a live call for an existing trip, e.g.:
  ```bash
  curl -s $WORKER -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"import_trip_page","arguments":{"trip_id":1,"url":"https://somotravel.us/chisolm-trip-details.html"}}}'
  ```
- Verify ActivityLog and `trips_v2.documents` updated for that trip.

## Follow-ups (optional)
- `import_trip_page_and_parse`: extract itinerary structure (Day 1/2, times, venues) into `TripDays` and `trip_activities_enhanced`.
- Add size limits and streaming to handle very large pages.
