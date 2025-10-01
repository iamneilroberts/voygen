# Voygent Hosted (Render) — System Overview

This document captures the current architecture, build/deploy settings, configuration, and verification steps for the hosted Voygent AI assistant that runs LibreChat with integrated MCP servers.

## Repo, Service, And URLs
- Hosted repo: `iamneilroberts/voygent-hosted` (cached copy: `.cache-voygent-hosted/`)
- Render service: Web Service (Node)
- Full UI domain: your Render URL and custom domain (e.g., `voygent.ai`)
- Upstream LibreChat is cloned at build time into `librechat/`

## High‑Level Architecture
- LibreChat UI + API runs inside the Render Web Service.
- MongoDB Atlas (or external) is used by LibreChat for auth, conversations, prompts, etc.
- Four Cloudflare Workers provide MCP servers over SSE:
  - d1_database → `https://d1-database-improved.somotravel.workers.dev/sse`
  - template_document → `https://template-document-mcp.somotravel.workers.dev/sse`
  - github_mcp_cta → `https://github-mcp-cta.somotravel.workers.dev/sse`
  - prompt_instructions → `https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse`
- MCP servers are declared in a single YAML: `.cache-voygent-hosted/librechat.yaml`

## Build, Start, And Patch Pipeline
- Build Command: `npm run build`
  - Steps:
    1) Clone LibreChat → `npm run install-librechat`
    2) Apply UI patch → `npm run patch-librechat-ui`
    3) Build everything → `npm run build-all`
- Start Command: `npm run start`
  - Starts the embedded LibreChat with the copied `librechat.yaml`.
- Patch script: `.cache-voygent-hosted/scripts/patch-librechat-ui.js`
  - Adds usage/cost pill (StatusBar)
  - Adds auto‑start prompt behavior
  - Adds footer “Powered by Voygent.ai — Try for free” (UI)

## Configuration (Environment)
Set these on the Render service:
- Core
  - `NODE_ENV=production`
  - `CONFIG_PATH=/opt/render/project/src/librechat/librechat.yaml`
  - `ENDPOINTS=custom`
- Database & Security
  - `MONGODB_URI` (Atlas connection string)
  - `JWT_SECRET` (>=32 chars), `CREDS_KEY` (32 chars), `CREDS_IV` (16 chars)
- Providers
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY` (optional)
- Optional status bootstrap (pill still works without these)
  - `VOYGEN_STATUS_SOURCE_URL` (if using external status/start worker)
  - `VOYGEN_AUTO_START=true|false`
  - `VOYGEN_DEFAULT_TRIP_QUERY` (optional default `?q=` for status calls)

## LibreChat YAML (Models + MCP)
- Source of truth: `.cache-voygent-hosted/librechat.yaml`
- Declares global `mcpServers` and endpoint‑specific MCP blocks for both:
  - “Voygen Anthropic” (Claude Sonnet + Haiku)
  - “Voygen OpenAI” (GPT‑4o/mini/Turbo)

## Client Features (Patched In)
- Usage/Cost Pill
  - Shows `Model • in N • out ~M • $X.YYYY`
  - Local estimate (~4 chars per token) with Anthropic/OpenAI rate map
  - Falls back to server `/api/voygen/status` when available
- Auto‑Start Prompt
  - On new chats, resolves the Prompt Group by `name` or `command` and auto‑sends its production prompt
  - Local override: `localStorage['voygentStartupPrompt']` (default `travel_agent_start`)
  - Requires “Auto‑send Prompts” toggle enabled in the Prompts panel
  - One‑time setup: create Prompt Group “Voygent Auto Start” with command `travel_agent_start` and set a production prompt
- UI Footer Branding
  - Adds “Powered by Voygent.ai — Try for free” to the chat footer (links to pricing)

## Proposal/Document Branding (Template MCP)
- Injected at render time in the Template Document MCP:
  - File: `remote-mcp-servers/template-document-mcp/src/index.ts`
  - Default link: `https://voygent.ai/pricing?utm_source=proposal&utm_medium=footer`
  - Override via Worker env: `BRANDING_URL`
- Worker config has a default in `remote-mcp-servers/template-document-mcp/wrangler.toml`.

## Billing & Usage (D1 MCP)
- New migration: `remote-mcp-servers/d1-database-improved/migrations/026_billing_and_usage.sql`
  - Tables: `advisors`, `subscription_tiers`, `subscriptions`, `entitlement_overrides`, `usage_events`, `usage_monthly_rollup`
  - View: `billing_overview`
  - Trigger: upserts monthly rollups on each `usage_events` insert
- Tools (D1 MCP):
  - `record_usage_event` → logs `trip_created`, `trip_published`, or `ai_request` with optional cost/tokens; auto-updates rollup
  - `check_entitlement` → returns current tier/limits, usage, and allowed/remaining for an action
  - Advisor identity: pass `advisor_id` or `advisor_email`; email will upsert an advisor row on first use

## Verification After Deploy
- UI
  - Model groups “Voygen Anthropic” and “Voygen OpenAI” appear
  - New chat auto‑sends startup text after Prompt Group setup
  - Footer shows Voygent link; pill appears after first response
- API
  - `GET /api/mcp/connection/status` → each MCP server shows `connected` (or briefly `connecting`)
  - Per server: `GET /api/mcp/connection/status/d1_database`
- Logs
  - Look for patch messages during build:
    - `[voygent patch] Added StatusBar.tsx`
    - `[voygent patch] Added footer branding link`
    - `[voygent patch] Completed UI patches`

## Troubleshooting
- No models visible
  - Ensure `ENDPOINTS=custom` and API keys present
  - Confirm `CONFIG_PATH` points to `/opt/render/project/src/librechat.yaml`
- No pill / no auto‑start
  - Hard refresh (clear cached assets)
  - Check build logs for patch messages
  - Ensure Prompt Group exists and “Auto‑send Prompts” is ON
- MCP not connecting
  - Verify YAML contains SSE URLs; re‑deploy; then check `/api/mcp/connection/status`
- Build error about `require`
  - Patch script is ESM; ensure repository is on `main` with the fix committed

## Useful Paths
- Hosted YAML: `.cache-voygent-hosted/librechat.yaml`
- Build patch script: `.cache-voygent-hosted/scripts/patch-librechat-ui.js`
- Status pill (source, local dev): `librechat-source/client/src/components/StatusBar.tsx`
- Auto‑start hook (source, local dev): `librechat-source/client/src/components/Chat/Input/ChatForm.tsx`
- API status/start routes: `librechat-source/api/server/routes/voygen.js`
- MCP routes (OAuth, status): `librechat-source/api/server/routes/mcp.js`

## One‑Page Deploy (Recap)
- Build: `npm run build`
- Start: `npm run start`
- Env: set `CONFIG_PATH`, `ENDPOINTS=custom`, `MONGODB_URI`, `JWT_SECRET`, `CREDS_KEY`, `CREDS_IV`, `ANTHROPIC_API_KEY` (+ optional `OPENAI_API_KEY`)
- Prompt: create “Voygent Auto Start” group, command `travel_agent_start`, set Production
- Verify: UI model groups + pill + footer; `/api/mcp/connection/status`

---

This file is intended as conversation context for new sessions. It summarizes the hosted system, how it is built, configured, and verified, and where to look when something needs attention.
