# HANDOFF

## Handoff Log
### 2025-09-23 03:22:03.251 UTC
- Status: Patching rollup configs
- Next: Verify voygent-hosted deploy logs for @rollup/plugin-typescript patch; confirm data-provider build proceeds
- Notes: Forced unconditional replacement in data-provider and data-schemas; commit 7d9c2d7
- voygent-hosted commit: 7d9c2d7
### 2025-09-23 02:57:26.000 UTC
- Status: Build failing on Render (rollup-plugin-typescript2 missing)
- Next: Force patch LibreChat rollup configs to use @rollup/plugin-typescript; or add devDeps for rollup-plugin-typescript2 in data-provider and data-schemas; redeploy and verify
- Notes: Analysis file saved at `handoff/2025-09-23T02-57-26Z_001/analysis.md`. Latest commit: 8fb0167 (remove verify steps; rely on @rollup/plugin-typescript). Build fails in `librechat/packages/data-provider` rollup step requiring `rollup-plugin-typescript2`.

### 2025-09-22 06:30:25.996 UTC
- Status: Deploy failing on Render
- Next: Retry deploy; monitor logs; fix; repeat until green
- Notes: voygent-hosted deploy failing on Render. Ensure Smithy/AWS deps installed in cloned LibreChat; watch for MODULE_NOT_FOUND '@smithy/signature-v4' and peers. Verify MCP status after deploy (GET /api/mcp/connection/status).
- voygent-hosted commit: d4b13ed


Operational snapshot for continuing work on Voygent hosted (Render) + related tooling. This file is the living state of the project so a fresh instance can continue seamlessly.

## Current Status
- Current status: Build failing on Render (2025-09-23 02:57:26.000 UTC)

- Render services
  - `voygent-website` (static): landing site for `voygent.ai` — deployed.
  - `voygent-hosted` (web): LibreChat + MCP — deploy in progress for commit `d4b13ed` (installs Smithy/AWS deps inside cloned LibreChat to fix Bedrock optional import).
  - `librechat-backend`: suspended (not used for Voygent customizations).
- Custom domains (Render → `voygent-hosted`)
  - `voygent.app` (and `www.voygent.app`) — domain verified, certificate issued.
- DNS (Cloudflare)
  - Apex CNAME flattening in use for both `voygent.ai` (landing) and `voygent.app` (chat).
- Login testing
  - `ALLOW_UNVERIFIED_EMAIL_LOGIN=true` enabled for testing (can register/login without email verification).
  - User cleanup helper available: `scripts/cleanup-user.js`.

## Open Issues & Next Steps
1) Deploy health
   - Confirm current deploy finishes without `MODULE_NOT_FOUND` (`@smithy/signature-v4`). Root fix: install deps inside `librechat/` during build.
   - If any additional Smithy/AWS peer deps surface, install similarly in the same step.
2) Login
   - Register fresh account and login at `https://voygent.app`.
   - If you need to reuse an existing email, run the cleanup helper (see Commands).
3) MCP connectivity
   - Verify `https://voygent.app/api/mcp/connection/status` — all declared servers should be `connected`.
4) Prompt and UI
   - Ensure “Voygent Auto Start” prompt group exists and is set to Production; verify auto‑start behavior on new chat.
   - Confirm usage/cost pill appears after first response and footer branding renders.
5) DB naming
   - Current `MONGODB_URI` writes to DB `test` (no database segment in URI). Decide whether to move to a named DB (e.g., `/librechat`) going forward.

## Key Paths & Artifacts
- Hosted YAML (MCP, models): `.cache-voygent-hosted/librechat.yaml`
- Patch script (adds StatusBar, auto‑start, footer): `.cache-voygent-hosted/scripts/patch-librechat-ui.js`
- Render build scripts/config: `.cache-voygent-hosted/package.json`
- Cleanup single user: `scripts/cleanup-user.js`
- Deep docs: `docs/voygent-hosted/voygent-hosted-overview.md`

## Verification Checklist
- UI: `https://voygent.app` loads; model groups show “Voygen Anthropic” and “Voygen OpenAI”.
- API: `GET /api/mcp/connection/status` returns `connected` for D1, template_document, github_mcp_cta, prompt_instructions.
- UI patches: usage pill after first response; “Powered by Voygent.ai — Try for free” footer; auto‑start prompt works when group is present.

## Commands
- Cleanup one user (dry‑run by default; add `--confirm` to execute):
  - Install driver isolated under `scripts/` (avoids root workspace deps):
    - `npm install --prefix scripts --no-save mongodb@6`
  - Dry‑run:
    - `node scripts/cleanup-user.js --uri "<MONGODB_URI>" --db test --email "user@example.com" --dry-run`
  - Execute:
    - `node scripts/cleanup-user.js --uri "<MONGODB_URI>" --db test --email "user@example.com" --confirm`

## Environment Snapshot (Hosted: `voygent-hosted`)
- Node runtime (Render logs): 24.8.x
- Key envs (no secrets):
  - `CONFIG_PATH=/opt/render/project/src/librechat/librechat.yaml`
  - `ENDPOINTS=custom`
  - `DOMAIN_CLIENT=https://voygent.app`
  - `DOMAIN_SERVER=https://voygent.app`
  - `ALLOWED_ORIGINS=https://voygent.app,https://voygent-hosted.onrender.com`
  - Secrets present: `MONGODB_URI`, `JWT_SECRET`, `CREDS_KEY`, `CREDS_IV`, `ANTHROPIC_API_KEY` (+ optional `OPENAI_API_KEY`)
- DNS: Cloudflare CNAME flattening at apex for both domains; orange cloud proxied; SSL Full (strict) recommended.

## Footguns & Notes
- LibreChat `npm start` doesn’t exist; start backend with `npm run backend` in the cloned `librechat/` workspace.
- Bedrock support via LangChain requires Smithy/AWS deps. Install them in the cloned LibreChat workspace during build to avoid runtime `MODULE_NOT_FOUND`.
- Without a database name in `MONGODB_URI`, Mongo will use database `test` — that’s current behavior.
- CORS: keep `ALLOWED_ORIGINS` tight to `https://voygent.app` and `https://voygent-hosted.onrender.com`.

---

If this status diverges from reality, update this file immediately after each deploy/env/DNS change so future instances can pick up with minimal context.
