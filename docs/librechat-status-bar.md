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
  - Polls `/api/voygen/status` every 15s and shows a bottom-right pill.
  - If no server data is available, it falls back to a local estimator updated on each completed message.
  - Supports two payload shapes:
    - Trip/workflow style: `{ tripName, phase, step, dates, cost, budget, commission, percent, url }`
    - Token-usage style: `{ model, inputTokens, outputTokens, price, approximate }` → renders like `Haiku • in 0 • out ~0 • $0.0000`
- Bootstrap: `librechat-source/client/src/App.jsx`
  - On mount, calls `/api/voygen/start`. If `VOYGEN_AUTO_START` is false or no source configured, it’s a no-op.
  - The upstream `/start` may embed a `greeting` string (exact text from `travel_agent_start`).

Server routes:

- `librechat-source/api/server/routes/voygen.js`
  - `GET /api/voygen/status`
  - `GET /api/voygen/start`

Notes:

- Keep the upstream simple: return either the trip/workflow fields or the token-usage fields.
- Local estimator uses a simple heuristic: ~4 characters per token on the last user+assistant exchange. Pricing defaults to $0 unless you wire a map.
 - Built-in pricing map (per 1M tokens → per token) includes:
   - Anthropic: Haiku (0.8/4), Sonnet (3/15), Opus (15/75)
   - OpenAI: GPT‑4o mini (0.15/0.6), GPT‑4o (2.5/10), GPT‑4o 2024‑05‑13 (5/15), o4 mini (1.1/4.4), o4 (2.5/10), o3 mini (1.1/4.4), o3 (2/8), GPT‑4.1 nano (0.1/0.4), GPT‑4.1 mini (0.4/1.6), GPT‑4.1 (2/8), GPT‑4.5 (75/150), GPT‑4 Turbo (10/30), GPT‑3.5 (0.5/1.5)
   - Values are indicative and may change; update the map as needed.
- Hosting impact: the feature is opt-in (no upstream URL → status pill stays hidden).
 - Settings → General adds:
   - Voygent Status Verbosity (Minimal/Normal/Verbose)
   - Voygent Default Query (persisted)
   - Show Welcome Panel on Startup + Reset "don’t show again"
