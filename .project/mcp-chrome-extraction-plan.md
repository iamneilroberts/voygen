# MCP Chrome – Incremental Web Content Extraction Plan

## Goal
- Start from pristine hangwin/mcp-chrome.
- Verify stock end‑to‑end behavior.
- Add hotel content extraction in small, testable slices without breaking core.

## Phase 0 — Clean Baseline
- Clone upstream:
  ```bash
  git clone https://github.com/hangwin/mcp-chrome mcp-upstream
  cd mcp-upstream
  corepack enable && pnpm i --ignore-scripts
  pnpm run build
  ```
- Register native host:
  ```bash
  node app/native-server/dist/cli.js register
  ```
- Load extension (chrome://extensions → Developer Mode → Load unpacked → `app/chrome-extension/dist`).
- Connect in the popup; confirm a port is listening:
  ```bash
  ss -ltnp | grep -E ':(12306|56889)'
  ```

## Phase 1 — Stock E2E Check
- Minimal client `scripts/smoke-min.js`:
  - Connect to `http://127.0.0.1:<port>/mcp`.
  - `listTools()` and `callTool('get_windows_and_tabs')`.
- Acceptance: tools list returns and reads the active CP Maxx tab.

## Phase 2 — DOM‑Only Extractor (Extension)
- Shared schema: add `chrome_extract_hotels_dom` to `packages/shared/src/tools.ts` with args `{ domSelector?: string; maxRows?: number }`.
- Build shared: `pnpm --filter chrome-mcp-shared build`.
- Extension background: new tool under `entrypoints/background/tools/browser/` that:
  - Injects a small script into the active tab.
  - Selects hotel cards (stable selectors), extracts: `name, detailUrl, priceText, image, starRating, reviewScore` (best‑effort).
  - Returns ≤ `maxRows`.
- Native host: stock `register-tools.ts` already forwards tool calls; no server changes.
- Acceptance: `callTool('chrome_extract_hotels_dom')` returns ≥ 1 row on CP Maxx results.

## Phase 3 — Normalize Output
- Map rows to DTO `{ id, name, detailUrl, priceText, image, starRating, reviewScore }`.
- Include metadata `{ route: 'dom', pageType: 'cpmaxx' }` and `count`.
- Optional later: support `ndjson_gz_base64` for large datasets (keep plain JSON first).

## Phase 4 — Network‑Assisted Variant (Optional, Guarded)
- Add `chrome_extract_hotels_network` that:
  - Runs short `network_capture_debugger_start()` window, triggers refresh, then `debugger_stop()`.
  - Parses JSON responses for arrays like `hotels|properties|results`.
- Timeouts/try‑catch everywhere; if empty → fall back to DOM.
- Acceptance: either path yields rows; calls finish within ≤ 30s.

## Phase 5 — Orchestrator Wrapper (Native Server)
- Introduce `app/native-server/src/mcp/orchestrator-tools.ts`:
  - `extract_hotels` calls `chrome_extract_hotels_dom` first; if empty and `enableNetwork` then network variant.
  - Optional Mongo ingest behind `MONGODB_URI` flag (default off).
- Keep server startup unmodified to avoid regressions.

## Phase 6 — Smoke + Tests
- `app/native-server/src/scripts/smoke.ts`:
  - Ensure tools list; optionally navigate to `--page`.
  - Call `chrome_extract_hotels_dom` and log first 3 rows.
- Unit: pure function test for DOM mapping with sample HTML (Vitest/Jest).
- Manual e2e on CP Maxx results tab.

## Phase 7 — Hardening
- Timeouts: 20–30s per call; clear error messages.
- Permissions: manifest limited to the active extension ID only.
- Port: read from popup; server uses provided START port (no hard‑coding).
- Logging: extension `console.debug` for 0‑matches; native host `stderr` for MCP errors.

## Phase 8 — Documentation
- README updates:
  - Setup (pnpm install/build, registration, load unpacked, connect).
  - Commands and smoke usage (`MCP_HTTP_URL` examples).
  - Troubleshooting: “Connected, Service Not Started” (manifest ID/port/reload).

## Phase 9 — Incremental Delivery (PRs)
1) Baseline import + smoke‑min client.
2) `chrome_extract_hotels_dom` + shared schema + docs.
3) Orchestrator wrapper (DOM only).
4) Network‑assisted variant behind flag + tests.

## Success Criteria
- Stock tools work unchanged: `listTools`, `get_windows_and_tabs`, `chrome_screenshot`, etc.
- DOM extractor returns normalized rows on CP Maxx results in ≤ 5s.
- Network path (if enabled) improves coverage without breaking DOM path.
- Connection UX unchanged (popup Connect works; host starts; tools respond).
