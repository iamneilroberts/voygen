# Voygent Mobile MVP – Streamlined Implementation Plan

> Goal: Ship a minimal-but-usable mobile interface that lets you **view trips, edit them, preview proposals, and publish to somotravel.us**—while deferring mcp‑chrome page extraction and advanced chat orchestration.

---

## 1) Scope & Non‑Goals

**In‑scope (MVP):**
- Mobile web page (single file) to list trips, open a trip, edit fields/JSON, and **Publish**.
- Cloudflare Worker endpoints: `/trips`, `/trips/:id`, `/proposals/:id/render`, `/publish/:id`.
- D1 schema already defined (`trips`, optional `tasks`), no changes required for MVP.
- Auth: temporary bearer (dev) → ready path to Cloudflare Access/JWT.

**Out‑of‑scope (for now):**
- mcp‑chrome extraction/validation tasks.
- Full chat orchestration on mobile.
- Advanced templates & theme switching (basic template pass‑through only).
- Multi‑tenant RBAC beyond simple `owner` field.

---

## 2) Architecture Overview

**Client:**
- `mobile/index.html` (vanilla JS) → configurable **Base URL** + **Auth token**.
- Features: list trips, filter, edit (title/dates/status/JSON), preview proposal (HTML), publish.

**Worker (Cloudflare):**
- `/trips` `GET` (list), `POST` (create minimal)
- `/trips/:id` `GET`, `PATCH`
- `/proposals/:id/render` `POST` → returns HTML payload
- `/publish/:id` `POST` → proxies to **Publisher MCP Worker** (GitHub Pages update)
- CORS + auth gate (Access/JWT later).

**Publisher MCP Worker (existing):**
- Accepts `{ action:"publish_trip", trip, filename, template }`.
- Renders HTML via Handlebars, commits HTML and edits `trips.json` on GitHub → returns `{ html_url, commit_sha, trips_json_commit_sha }`.

**Data:**
- D1 `trips` table; `trip.data` is JSON (clients, itinerary, notes, filename, etc.).

---

## 3) Deliverables

- **D1:** Existing `trips` schema + seed (no change).
- **Worker:** Implement/polish the 4 endpoints & env vars for Publisher MCP.
- **Mobile page:** `mobile/index.html` single‑file client.
- **Docs:** Quick start + How‑to‑publish from phone.

---

## 4) Configuration

**`wrangler.toml` (Worker):**
- `AUTH_SECRET` (dev only)
- `PUBLISH_MCP_URL` (your publisher Worker URL)
- `PUBLISH_MCP_TOKEN` (bearer for publisher Worker)
- `PUBLISH_TEMPLATE` (default: `default`)
- `SITE_BASE_URL` (`https://somotravel.us`)

**Mobile page:**
- On first load, set **Base URL** to Worker and **Auth token** (e.g., `Bearer dev-secret`).

---

## 5) Implementation Plan (Phased)

### Phase 0 — Repo Setup (0.5 day)
- [ ] Confirm D1 database exists and schema applied.
- [ ] Ensure Worker builds/runs (`wrangler dev`).
- [ ] Add env vars to `wrangler.toml`.

### Phase 1 — Trips CRUD API (0.5 day)
- [ ] `/trips` `GET` list by `owner` with limit.
- [ ] `/trips` `POST` creates minimal trip.
- [ ] `/trips/:id` `GET` fetches full trip.
- [ ] `/trips/:id` `PATCH` updates title/dates/status/data.
- [ ] Add CORS headers; simple bearer auth.
- **Acceptance:** `curl` flows work end‑to‑end.

### Phase 2 — Proposal Preview (0.25 day)
- [ ] `/proposals/:id/render` returns HTML string (inline) using minimal CSS.
- [ ] Optionally record `last_rendered_at` in `trip.data`.
- **Acceptance:** curl returns valid HTML; opens and looks reasonable on phone.

### Phase 3 — Mobile Page (0.5 day)
- [ ] Build `mobile/index.html` with: config inputs, list view, detail editor, Save, Preview.
- [ ] Host via Cloudflare Pages or static server.
- **Acceptance:** Load on iOS/Android; edit/save round‑trip under 2s locally.

### Phase 4 — Publish to GitHub Pages (0.5 day)
- [ ] `/publish/:id` Worker route proxies to Publisher MCP Worker.
- [ ] Handle response, return `html_url` + commits; stamp `last_published_*` in `trip.data`.
- [ ] Mobile: add **Publish** button; open live URL on success.
- **Acceptance:** Live page appears on `somotravel.us/proposals/<file>.html`; `trips.json` updated.

### Phase 5 — PWA Polish (optional, 0.5 day)
- [ ] Add `manifest.json` + service worker (cache shell + last N trips).
- [ ] Home‑screen install; basic offline read‑only.
- **Acceptance:** App installs; loads instantly; edits still go online.

---

## 6) Testing Plan

**API:**
- `curl` tests for all endpoints (200/4xx paths, invalid JSON, missing fields).
- Verify CORS and auth rejections.

**Mobile UI:**
- iOS Safari + Android Chrome
- Create → Edit → Save → Preview → Publish
- Large JSON in `trip.data` (copy/paste itinerary) works without lag.

**Publisher:**
- 3 successive publishes should upsert the same trip entry in `trips.json` (idempotent).
- Bad token returns 502 with error pass‑through.

---

## 7) Success Criteria (MVP)
- From phone: list loads < 1.5s (Wi‑Fi), detail opens < 1s, save round‑trip < 2s.
- Preview opens as HTML and renders legibly on mobile.
- Publish returns `html_url` and page is visible on GitHub Pages within expected propagation time.
- No secrets stored on device beyond temporary bearer; mobile never touches GitHub directly.

---

## 8) Risks & Mitigations
- **JSON editing on mobile is clunky** → keep fields for common edits (title/dates/status); JSON textarea for power users.
- **GitHub API rate/commit limits** → ensure Publisher MCP batches updates where possible; return commit SHAs for traceability.
- **CORS or Access misconfig** → start with permissive CORS in dev; switch to allow‑list domains in prod.
- **Filename collisions** → respect `data.filename` if present; slugify fallback; MCP should upsert `trips.json` entry.

---

## 9) Post‑MVP Next Steps
- Add **Queued Extraction** with `tasks` + desktop/VPS runner (mcp‑chrome).
- Chat SSE pass‑through to orchestrator.
- Template selector on mobile (`data.template`).
- Push notifications for publish/render completion.
- Switch to Access/JWT; derive `owner` from claims.

---

## 10) Quick Start (Recap)

```bash
# 1) D1 ready? If not, create + migrate
wrangler d1 create voygent_ce
wrangler d1 execute voygent_ce --file=./migrations/001_init.sql

# 2) Worker dev
wrangler dev

# 3) Mobile page
wrangler pages deploy mobile --project-name=voygent-mobile
# or: npx serve mobile

# 4) Test
curl -H "Authorization: Bearer dev-secret" http://127.0.0.1:8787/trips
```

— End —

