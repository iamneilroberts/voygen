# TASK-0079: Schedule‑First Trip Parser Tuning + Bulk Orchestration

## Summary
Tune the v1 itinerary parser to produce clean multi‑day output from diverse travel pages including:
- https://somotravel.us/chisolm-trip-details.html (Chisholm European Adventure)
- https://somotravel.us/April-2026-Scotland-Ireland.html (Multi-country with clear dates)
- https://somotravel.us/sara-darren-jones-anniversary-itinerary.html (Anniversary trip format)
- https://somotravel.us/Breckenridge_2025.html (Ski trip with activities)
- https://somotravel.us/toronto-trip-proposal.html (Business travel format)
- https://somotravel.us/ColvinSF2025.html (City exploration itinerary)

Add a bulk one‑shot op so the assistant can: import → parse → (optionally) rename/update in a single call. Keep everything in REMOTE Cloudflare D1. Do NOT use any local database.

## Why
- The current `import_trip_page_and_parse` creates valid rows but may compress many events into a single Day when pages don't explicitly use "Day X" headings. Travel itineraries use diverse formats:
  - Formal schedule sections ("📅 Schedule", "Itinerary", "Day-by-Day")
  - Date headers ("April 20, 2026", "Sept 20", "4/20/25")
  - Mixed date/day formats ("Day 1: April 20", "Monday, April 20")
  - Activity-focused layouts (ski trips, city tours, business travel)
- Agents need a one‑shot orchestration op to reduce tool chatter and avoid Chrome entirely.
- Better parsing enables improved search, recommendations, and trip facts aggregation.

## Goals
1) Parser produces multiple Day blocks from the Chisholm schedule (and similar docs) using date/time cues.
2) Optional overwrite/dedup behavior to avoid duplicate inserts.
3) New bulk op `import_and_parse_from_url` that:
   - Imports the page (no browser),
   - Parses into TripDays + trip_activities_enhanced,
   - Optionally renames the trip with a better descriptive title.

## Constraints
- NEVER use local DB; only the remote Cloudflare D1 that the worker is bound to.
- No browser use (no MCP Chrome) for importing.
- Keep runtime < 500 ms typical for average page sizes.

## Deliverables
- Parser enhancements in `remote-mcp-servers/d1-database-improved/src/tools/import-tools.ts`:
  - New input options for `import_trip_page_and_parse`:
    - `strategy?: 'schedule_first' | 'full_text'` (default: `schedule_first`)
    - `overwrite?: 'none' | 'days' | 'all'` (default: `none`)
  - Behavior:
    - When `schedule_first`, isolate the text under the “📅 Schedule” section (or a fallback list of section labels), falling back to full text if not found.
    - Day detection: combine explicit “Day X” headings with date headers (e.g., "Sept 20", "September 21", "9/22"). Build ordered breakpoints; split into Day blocks.
    - Date mapping: map detected dates to ISO `YYYY-MM-DD` (use trip start year or explicit year on page). If missing a date for a Day block, infer by position from start_date.
    - Time extraction: support `10:00`, `10 AM`, `10:00 AM`, and ranges `10–11 AM` → `start_time`, `end_time`.
    - Type classification (rule‑based): `meal`, `lodging`, `flight`, `transfer`, `tour|attraction`, default `activity`.
    - Dedup: before insert, check existing rows by `(doc_id, day_number, title, start_time)`.
    - Overwrite:
      - `days`: delete TripDays that match the parsed Day numbers (cascade removes their activities) before re‑insert.
      - `all`: delete all TripDays/activities for the trip before insert.
- New bulk op in `src/tools/trip-tools.ts`:
  - `import_and_parse_from_url`
    - Input: `{ url, tag?, strategy?, overwrite?, rename_to?, update_slug? }`
    - Steps: call `import_trip_page`, then `import_trip_page_and_parse` (propagating options), then optionally `rename_trip`.
    - Returns combined summary (`doc_id`, counts, new name if renamed).
- Tests (Vitest) under `remote-mcp-servers/d1-database-improved/tests/`:
  - Parser unit tests with small text fixtures covering:
    - date headings splitting into ≥ 3 day blocks,
    - time extraction (12h + 24h + ranges),
    - classification (meal/flight/transfer/tour/other),
    - overwrite/dedup behavior.
  - Bulk op test stubbing the two underlying tool handlers and verifying control flow & payload.
- README updates describing new options and bulk flow.

## Implementation Guide
1) Section isolation
   - Add `findSection(text, startMarker, endMarkers[])` where `startMarker` includes variants like:
     - `📅 Schedule`, `Schedule`, `Itinerary`, `Day-by-Day`, `Daily Activities`, `Trip Schedule`
     - Anniversary/romantic: `Your Itinerary`, `Trip Details`, `Day by Day`
     - Business/city: `Agenda`, `Schedule Overview`, `Trip Outline`
     - End markers: `✈️`, `🛬`, `🏨`, `Insurance`, `Apps`, `Contact`, `Emergency`, `Packing`, etc. (treat as soft boundaries; fallback to full text if not found).

2) Day + date detection
   - Keep existing "Day X" regex.
   - Add `detectDateHeaders()` with patterns:
     - `/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-3]?\d)(?:,\s*(\d{4}))?/i`
     - `/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d)(?:,\s*(\d{4}))?/i`
     - `/\b([0-1]?\d)\/([0-3]?\d)(?:\/(\d{2,4}))?\b/` (US format)
     - `/\b([0-3]?\d)\/([0-1]?\d)(?:\/(\d{2,4}))?\b/` (EU format)
     - `/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-3]?\d)/i`
     - `/Day\s+(\d+):?\s+(.*)/i` (captures "Day 1: April 20" format)
   - Merge matches with Day headings to build breakpoints.
   - Handle overlapping dates by preferring more specific formats.

3) Date mapping
   - Use trip start year unless a year is present; if the mapped date falls outside the trip range, clamp to range but keep day_number.
   - Add optional `TripDays.date` insert when available.

4) Time parsing
   - Regex for 12h and 24h plus ranges (`–`, `—`, `-`).
   - Normalize to strings as currently stored; we are not converting to TZ.

5) Type/classification
   - Enhanced keyword lists for diverse travel types:
     - `meal`: breakfast, lunch, dinner, brunch, snack, coffee, dining, restaurant, cafe, food, cuisine
     - `lodging`: hotel, check-in, check-out, accommodation, stay, room, resort, inn, lodge, bed
     - `flight`: flight, departure, arrival, airport, airline, boarding, takeoff, landing, plane
     - `transfer`: transfer, transport, drive, taxi, uber, bus, train, shuttle, pickup, dropoff
     - `tour`: tour, guided, sightseeing, attraction, museum, gallery, monument, landmark, visit, explore
     - `activity`: activity, experience, adventure, excursion, recreation, entertainment, show, event
     - `shopping`: shopping, market, store, boutique, souvenir, purchase, mall, shop
   - Keep metadata_json `{ source: 'import_trip_page_and_parse', doc_id, strategy: 'schedule_first|full_text' }`.

6) Overwrite/dedup logic
   - If `overwrite==='all'`: delete from `TripDays` for `trip_id` before insert.
   - If `overwrite==='days'`: delete TripDays where `day_number IN (...)` for this `trip_id`.
   - Dedup: `SELECT 1 FROM trip_activities_enhanced WHERE trip_id=? AND (metadata_json LIKE '%"doc_id": <doc_id>%') AND day_id=? AND title=? AND COALESCE(start_time,'')=? LIMIT 1`.

7) Bulk op orchestration
   - In `bulk_trip_operations`, add case `import_and_parse_from_url` that:
     1. Calls `importTripPageTool.handler()`
     2. Calls `importTripPageAndParseTool.handler()` with `trip_id` + options
     3. If `rename_to`, call the existing `rename_trip` branch
   - Return a combined response: `{ imported: {...}, parsed: {...}, renamed?: true }`.

8) Tests
   - Add diverse fixture strings covering different itinerary formats:
     - Formal schedule with "📅 Schedule" section and date headers
     - Anniversary trip with romantic language and activity focus
     - Business travel with agenda-style formatting
     - Ski/activity trip with time-based scheduling
     - City exploration with day-by-day breakdown
   - Verify ≥ 3 TripDays created on parse; verify time extraction and activity classification.
   - Verify `dry_run` returns a structured preview without DB writes.
   - Verify `overwrite='days'` replaces only the targeted day rows.
   - Test edge cases: overlapping dates, missing years, mixed formats.

9) Docs
   - Update worker README tool list with the new `import_and_parse_from_url` description & examples.

## Acceptance Criteria
- `import_trip_page_and_parse({ trip_id: 1, strategy: 'schedule_first', overwrite: 'days' })` splits the Chisholm page into multiple Day blocks (≥ 3), creates TripDays and inserts activities for each.
- `bulk_trip_operations({ trip_identifier: '1', operations: [{ type: 'import_and_parse_from_url', data: { url: 'https://somotravel.us/chisolm-trip-details.html', strategy: 'schedule_first', overwrite: 'days', rename_to: 'Chisholm Family – European Adventure: Dublin, London & Stoneleigh', update_slug: true } }] })` returns success with import + parse summary.
- Unit tests pass (`vitest`), and the README section reflects new options and example calls.

## Risks & Mitigations
- Over‑parsing free text → keep max limits and prefer `schedule_first`.
- Duplicate inserts → dedup keys + overwrite modes.
- Schema FK mismatches in prod → TripDays and trip_activities_enhanced must reference `trips_v2(trip_id)`; fail gracefully with a clear error if not.

## Non‑Goals
- Full NLP (venues/addresses) or timezone normalization.
- Chrome automation (MCP Chrome) for imports — strictly prohibited.

## Ops Checklist
- [ ] Implement & test locally (`vitest`).
- [ ] Deploy worker via `wrangler deploy`.
- [ ] Verify on prod with trip ID 1 (Chisholm) using `schedule_first`.
- [ ] Confirm LibreChat can call `import_and_parse_from_url` end‑to‑end.
