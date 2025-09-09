# Voygent Real-World E2E Tests (MCP Chrome)

This suite drives the LibreChat UI in Chrome via MCP Chrome, simulating a human travel agent and asserting outcomes from visible page content. It also stores a JSON report per run.

## Prerequisites
- LibreChat running (appCE stack): `./voygent start` then open http://localhost:8080
- MCP Chrome server running locally on `http://127.0.0.1:12306/mcp`
  - If you use the appCE Chrome MCP, start it per your existing instructions
- Node 18+

## Run
```
# from repo root
node scripts/e2e/voygent-e2e-runner.mjs
```

Environment overrides:
- `VOYGENT_BASE_URL` (default: `http://localhost:8080`)
- `MCP_CHROME_URL` (default: `http://127.0.0.1:12306/mcp`)
- `VOYGENT_E2E_OUT` (default: `tests/e2e/results`)

## What it does
1. Navigate to the app URL and wait for `#prompt-textarea`
2. Type `travel_agent_start` and submit → detect the greeting
3. Type `check database health` → look for "healthy/ok"
4. Type `show me Sara and Darren's trip` → detect trip content
5. Type `show me daily details` → detect itinerary/day numbering
6. If daily details not found, send `/debug` and assert diagnostics
7. Save a JSON report under `tests/e2e/results/`

## Extending tests
- Edit `scripts/e2e/voygent-e2e-runner.mjs` and add more steps
- Typical flows to add next:
  - Add a traveler to an existing trip
  - Create a new trip and set dates
  - Generate proposal and publish (assert GitHub URL appears)
  - Validate workflow phase transitions

## Notes
- This uses `mcp-remote` to speak JSON-RPC to MCP Chrome over stdio. No Playwright required.
- Assertions operate on visible page text via `chrome_get_web_content` (robust to UI CSS changes).
- For reproducibility, keep your worker endpoints healthy (D1 + prompt-instructions), otherwise `/start` may not include the greeting.

