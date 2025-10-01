# Voygent

Voygent is a travel-planning assistant built on LibreChat with Model Context Protocol (MCP) servers and a small set of glue services/scripts for hosted and local workflows.

This repo contains:
- `librechat-source/` – upstream LibreChat monorepo used for local dev/tests.
- `.cache-voygent-hosted/` – build/deploy files used by the hosted Render service (clones LibreChat at build time and applies UI patches).
- `remote-mcp-servers/` & `mcp-local-servers/` – MCP servers and agents.
- `docs/` – operational docs (see `docs/voygent-hosted/*`).
- `scripts/` – helper scripts (e.g., user cleanup for MongoDB).

Quick links
- Hosted overview: `docs/voygent-hosted/voygent-hosted-overview.md`
- Migration plan: `docs/voygent-hosted/voygent-hosted-migration-plan.md`
- Hosted YAML (source of truth): `.cache-voygent-hosted/librechat.yaml`
- LibreChat UI patch script: `.cache-voygent-hosted/scripts/patch-librechat-ui.js`
- User cleanup helper: `scripts/cleanup-user.js`

## Architecture (Hosted)
- Web UI + API: Render Web Service `voygent-hosted` (clones LibreChat, applies patch, uses YAML above).
- Landing site: Render Static Site `voygent-website` (marketing/landing at `voygent.ai`).
- Custom domains
  - `voygent.ai` → landing (static site)
  - `voygent.app` → chat (LibreChat hosted service)
- Database: MongoDB Atlas (URI provided via env; current data is in DB `test` because URI omits a trailing database name).
- MCP servers (Cloudflare Workers over SSE): D1 database, template document, GitHub, prompt instructions. Endpoints are declared in the hosted YAML.

## Stack & Versions
- Node: ≥ 18 locally; Render currently uses Node 24.8.x (from logs).
- LibreChat: v0.8.0-rc4 (observed in build logs of the hosted service).
- MongoDB Atlas 7.x compatible.

## How to Run (Local)
- install deps and seed config: `npm run setup`
- run LibreChat client for local dev: `npm run dev`
- run main backend wrapper (with embedded LibreChat) in preview: `npm run preview`
- build all (client + packages): `npm run build`

See more commands in `package.json` and project guidelines in `AGENTS.md`.

## Hosted Deploy (Render)
- Build command: defined in `.cache-voygent-hosted/package.json`.
  - Clone LibreChat → apply patch → build everything → start LibreChat backend.
- Start command: runs LibreChat backend (`npm run backend` in the cloned workspace).
- Key environment variables (Render → `voygent-hosted`):
  - `CONFIG_PATH=/opt/render/project/src/librechat/librechat.yaml`
  - `ENDPOINTS=custom`
  - `DOMAIN_CLIENT=https://voygent.app`
  - `DOMAIN_SERVER=https://voygent.app`
  - `ALLOWED_ORIGINS=https://voygent.app,https://voygent-hosted.onrender.com`
  - Secrets: `MONGODB_URI`, `JWT_SECRET`, `CREDS_KEY`, `CREDS_IV`, `ANTHROPIC_API_KEY` (+ optional `OPENAI_API_KEY`)

## Recent Decisions (changelog‑lite)
- Domains: `voygent.ai` → landing; `voygent.app` → LibreChat. Removed stray static `voygent-hosted-1`. Suspended `librechat-backend`.
- Start fix: use LibreChat `backend` script rather than `npm start` (which doesn’t exist in that repo).
- CONFIG_PATH corrected to point to `librechat/librechat.yaml` inside the cloned workspace.
- Bedrock optional deps: install Smithy/AWS deps inside the cloned LibreChat workspace to avoid runtime `MODULE_NOT_FOUND`.
- Added `scripts/cleanup-user.js` to safely remove a specific user and related data in MongoDB.

## Verification
- UI loads at `https://voygent.app`.
- MCP health: `https://voygent.app/api/mcp/connection/status`.
- Model groups present: “Voygen Anthropic”, “Voygen OpenAI”.
- Patched UI bits visible: usage/cost pill, auto‑start prompt behavior, footer branding.

---

For deeper hosted details, see `docs/voygent-hosted/voygent-hosted-overview.md`.

