# LibreChat In-App Status Bar and Auto-Start

Environment variables (server):

- `VOYGEN_STATUS_SOURCE_URL` (optional): Upstream JSON endpoint for status/start, e.g. a Cloudflare Worker. When set, the server proxies:
  - `GET /api/voygen/status?q=Smith%20Hawaii`
  - `GET /api/voygen/start`
- `VOYGEN_AUTO_START` (default: false): If true, `GET /api/voygen/start` returns a startup payload. Client calls this once on load.
- `VOYGEN_DEFAULT_TRIP_QUERY` (optional): If provided, the client appends `?q=<value>` to `/api/voygen/status`. If not set, the worker falls back to the most recent trip automatically.
 - `PROMPT_INSTRUCTIONS_URL` (Cloudflare Worker env): Base URL for the prompt-instructions MCP server. Worker will call `/sse` with JSON-RPC to fetch the exact `travel_agent_start` greeting for the welcome panel.

Client:

- Component: `librechat-source/client/src/components/StatusBar.tsx`
  - Polls `/api/voygen/status` every 15s and shows a bottom-right pill with: `Trip • Phase (Step) • Dates • $Cost/$Budget • Comm $ • %`.
- Bootstrap: `librechat-source/client/src/App.jsx`
  - On mount, calls `/api/voygen/start`. If `VOYGEN_AUTO_START` is false or no source configured, it’s a no-op.
  - The upstream `/start` may embed a `greeting` string (exact text from `travel_agent_start`).

Server routes:

- `librechat-source/api/server/routes/voygen.js`
  - `GET /api/voygen/status`
  - `GET /api/voygen/start`

Notes:

- Keep the upstream simple: return `{ tripName, dates, phase, step, percent, cost, budget, commission, url }` when available.
- Hosting impact: the feature is opt-in (no upstream URL → status pill stays hidden).
 - Settings → General adds:
   - Voygent Status Verbosity (Minimal/Normal/Verbose)
   - Voygent Default Query (persisted)
   - Show Welcome Panel on Startup + Reset "don’t show again"
