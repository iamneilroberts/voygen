# TASK-0078: Parse Imported Trip Page + Preview Tool

## Goal
Enhance the new import pipeline by:
- Converting imported pages (HTML/text) into structured itinerary (TripDays + Activities) with a robust Day/Time parser.
- Providing a small preview tool to quickly view stored HTML/text for QA in the UI.

## Deliverables
- `import_trip_page_and_parse` tool in D1 worker
  - Inputs: `{ trip_id|trip_identifier, doc_id?, url?, dry_run=false, max_days=14, max_activities_per_day=30 }`
  - Behavior:
    - Load the specified doc (or latest for the trip)
    - Heuristically split text into Day X blocks; extract times and titles into activities
    - On `dry_run: true`, return a preview structure without DB writes
    - Otherwise, upsert `TripDays` and insert `trip_activities_enhanced` with metadata `{ source: 'import_trip_page_and_parse', doc_id }`
  - Output: `{ success, trip_id, doc_id, days_created, activities_created }` (or `{ preview }` when dry_run)
- `preview_travel_doc` tool
  - Inputs: `{ doc_id? | trip_id|trip_identifier + url? , format='text'|'html', max_chars=1200 }`
  - Returns a short snippet for QA.
- Documentation updates in repo `README` (or per-tool JSDoc) describing usage.

## Parsing Heuristics (v1)
- Split days: `/day\s*(\d+)\s*[:\-–]?/i` headings; default to one day if none found
- Activities: lines with `HH:MM( AM|PM)?` → `start_time`; title is remainder; label meals by keywords
- Limit to `max_days` and `max_activities_per_day` for guardrails

## Acceptance Criteria
- import_trip_page_and_parse writes TripDays + activities for a typical “Day X” itinerary page; returns counts.
- preview_travel_doc returns an HTML/text snippet for a stored doc.
- Tools are exported via `llm-optimized-tools` and callable in LibreChat.

## Follow-ups
- Improved venue/time parsing and date extraction.
- Rich metadata (links, costs) and location parsing.
- Idempotency improvements (hash dedupe per doc_id and day_number/title).
