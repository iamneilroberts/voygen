# Voygent Hosted Migration Plan

Owner: Neil Roberts  
Target: Make `iamneilroberts/voygent-hosted` on Render match local `/home/neil/dev/voygent.appCE` functionality.

Last updated: TODO

## Links
- Hosted LibreChat (Render): https://librechat-backend-x29b.onrender.com/c/new
- Hosted repo: https://github.com/iamneilroberts/voygent-hosted
- Local reference: `/home/neil/dev/voygent.appCE` (Dockerized)
- This workspace (source of truth for planning): `voygen` repo

## Goal & Acceptance Criteria
- End-to-end parity with local appCE for sign-in, chat, MCP tools, prompts, and model menus.
- Voygent Auto Start prompt loads automatically for new chats and can be toggled in the Prompts panel.
- Usage meter bug is fixed and visible in the client footer/status as in appCE.
- Remote MCP servers are integrated and callable from hosted LibreChat.
- Configuration is documented and reproducible (env vars, librechat.yaml, build/deploy steps).
- Basic smoke tests pass in Render (login, send message, call at least one MCP tool).

## Workstreams
1) Baseline & Config
2) Client features (Auto Start prompt, usage meter fix, model menus)
3) Backend integration (providers, MCP bridge, routes, config)
4) MCP servers (deploy + connect)
5) Render infrastructure (services, env, build, scaling)
6) Testing & validation (local and hosted)
7) Documentation & operational notes

---

## 1) Baseline & Config

- [ ] Confirm LibreChat version/tag parity between hosted and appCE  
  - Screenshot shows v0.8.8-rc3 in footer; verify both sides.  
  - Action: record exact git SHA/tag for both.
- [ ] Inventory `.env` used by hosted vs. appCE (auth, providers, MCP, Mongo)  
  - Action: list all required secrets and non-secret flags here. See Section 7.
- [ ] Align `librechat.yaml` (in hosted) with appCE  
  - Action: copy over Voygent-specific blocks (models, prompt defaults, MCP config).  
  - File: `librechat-source/librechat.yaml` (or project path in hosted repo).
- [ ] Validate MongoDB connection and session/auth settings on Render  
  - Action: confirm `MONGODB_URI`, JWT/session secrets, OAuth if used.

## 2) Client Features

### Voygent Auto Start Prompt
- [x] Auto-send behavior implemented in client  
  - File: `librechat-source/client/src/components/Chat/Input/ChatForm.tsx`  
  - Logic: on `newConversation` and `Auto-send Prompts` enabled, resolves the configured startup prompt by prompt group `name` or `command` (slug) using `useGetAllPromptGroups`, then submits its `productionPrompt.prompt` automatically.  
  - Config: optional `localStorage['voygentStartupPrompt']` (e.g., `travel-agent-start` or `travel_agent_start`); default is `travel_agent_start`.
- [ ] Port/create the prompt group in hosted with production prompt set  
  - Visible as: Prompts panel → "Voygent Auto Start" (e.g., `travel-agent-start`).  
  - Behavior: Preload for new chats; toggle in the right panel.
- [ ] Persist setting in user prefs (if applicable)  
  - Action: confirm local implementation (Redux/store or settings slice) and port.
- [ ] Ensure prompt seeding/import on first run (or via migration)  
  - Action: include a safe migration to create/update the prompt in hosted.

### Usage Meter Bug Fix
- [x] Implemented local estimator pill (no Worker required)  
  - Client: `client/src/components/StatusBar.tsx` with fallback to `store.voygentLastUsage`  
  - SSE: `hooks/SSE/useEventHandlers.ts` computes approximate tokens after each response (4 chars ≈ 1 token)  
  - Pricing map included (Anthropic + OpenAI common models) to estimate cost; shows: `Model • in N • out ~M • $X.YYYY`  
- [ ] Optional: Add price map for target models (Anthropic/OpenAI) when ready
- [ ] Verify on hosted: send a message; pill updates within a second after response

### Model Menus & Branding
- [ ] Ensure "Voygent Anthropic" and "Voygent OpenAI" groups show as in appCE  
  - Action: replicate grouping and naming from local.  
  - Likely files: client model registry/config.
- [ ] Footer/status visuals match (e.g., Haiku usage meter location)
- [ ] Any Voygent-specific theming/strings migrated (optional, if present)

## 3) Backend Integration

- [ ] Providers enabled and configured (Anthropic, OpenAI, others as used)
- [ ] MCP bridge enabled (if using LibreChat MCP integration)
- [ ] Any custom routes/services in appCE ported to hosted
- [ ] Confirm rate limiting and file upload behavior match expectations
- [ ] Ensure search/tools toggles match local defaults

## 4) MCP Servers

Target remote MCP servers (from this repo):
- d1-database-improved
- github-mcp-cta (aka github-mcp-data)
- prompt-instructions-d1-mcp
- template-document-mcp

Hosting decision: Use Cloudflare Workers (existing deployments) rather than new Render services.

Tasks:
- [ ] Decide hosting model: all separate Render services vs. one multi-app service
- [x] Confirmed: continue using Cloudflare Workers for MCP servers
- [ ] For each server: containerize/build command + healthcheck
- [ ] Configure env for each server (API keys, repos, DB)
- [ ] Expose stable URLs for hosted LibreChat to call
- [ ] Wire into LibreChat MCP config (client + api as required by version)
- [ ] Validate from hosted: call each tool at least once

## 5) Render Infrastructure

- [ ] Confirm service name(s) and region  
  - Current: `librechat-backend-x29b`
- [ ] Build command, start command, and Node version set correctly
- [ ] Env vars and secrets set in Render  
  - Include model API keys, Mongo URI, JWT/session secrets, MCP endpoints, feature flags.
- [ ] Autoscaling and instance class adequate for usage
- [ ] Logs/metrics accessible; add brief runbook

## 6) Testing & Validation

- [ ] Local dev smoke test (hosted repo)  
  - `npm run setup`, `npm run dev` (or project equivalents)
- [ ] Hosted smoke test  
  - Login, new chat, Auto Start prompt appears, send message, usage meter updates, MCP tool call works.
- [ ] Optional e2e check (Playwright) for happy path
- [ ] Regression checks for appCE-only changes

## 7) Configuration Reference (WIP)

Document the exact env vars and config required in hosted:

Backend/General:
- [ ] `MONGODB_URI` (Render/Atlas)
- [ ] `JWT_SECRET` / `SESSION_SECRET`
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` (Render provides)

Providers:
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] Others as used (Groq, etc.)

MCP:
- [ ] `MCP_D1_DATABASE_URL` (or server-specific)
- [ ] `MCP_GITHUB_*` (token/repo scope)
- [ ] `MCP_PROMPT_INSTRUCTIONS_*`
- [ ] `MCP_TEMPLATE_DOCUMENT_*`
- [ ] Public base URLs for each MCP server

LibreChat:
- [ ] `librechat.yaml` parity (models, MCP, prompts, feature flags)
- [ ] Status bar env (optional):
  - `VOYGEN_STATUS_SOURCE_URL` → Cloudflare Worker base URL for status JSON
  - `VOYGEN_AUTO_START` → `true|false` to enable `/api/voygen/start` bootstrap
  - `VOYGEN_DEFAULT_TRIP_QUERY` → default `?q=` value for status source
  - Upstream may return either trip/workflow fields or token-usage fields.

## 8) Mapping: Files to Port (to be filled as we diff)

Client:
- [ ] Auto Start prompt toggle UI (Prompts panel)
- [ ] Auto Start behavior for new chat
- [ ] Usage meter components/utils  
  - Files: TODO (add from appCE diff)
- [ ] Model menu/registry tweaks

Backend/API:
- [ ] MCP bridge config/registration
- [ ] Any custom routes or middlewares (usage calc, prompt seeding)
- [ ] Job/cron or seed scripts if used

Config:
- [ ] `.env` parity list
- [ ] `librechat.yaml` differences

## 9) Execution Plan (working list)

- [ ] Capture exact diffs from `/home/neil/dev/voygent.appCE` → hosted repo  
  - Approach A: copy the hosted repo locally and run a structured diff against appCE.  
  - Approach B: identify commits that implemented the features in appCE and cherry-pick/port.
- [ ] Port usage meter fix (client and/or api side)
- [ ] Port Auto Start prompt + seeding/migration
- [ ] Add/enable MCP servers; deploy to Render; wire into hosted
- [ ] Validate locally; then deploy to Render and re-test
- [ ] Update this document with file paths, commits, and verification notes

## 10) Open Questions / Notes

- Confirm whether MCP is connected via client-only config or requires api-side bridge in current LibreChat version.
- Are the remote MCP servers already running anywhere (dev/prod)? If yes, capture their URLs and versions.
- Any OAuth providers enabled in appCE that need to be ported to Render?
- Any data migrations needed for prompts or memories?

---

## Changelog

- Seeded initial migration plan with task checklists and placeholders.
