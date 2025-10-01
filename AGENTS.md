# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Project glue/helpers for Voygen.
- `librechat-source/`: Upstream LibreChat monorepo (`api`, `client`, `packages/*`).
- `mcp-local-servers/`, `remote-mcp-servers/`: Model Context Protocol (MCP) agents and deployments.
- `tests/`: Empty scaffolding for `unit/`, `integration/`, `e2e/` in this repo.
- `assets/`, `examples/`, `docs/`, `config/`, `scripts/`, `zen-mcp-server/`: Supporting resources and scripts.
- Config lives in `.env` and `librechat-source/librechat.yaml` (created by `scripts/setup.sh`).

## Build, Test, and Development Commands
- `npm run setup`: One-time local setup (installs deps, seeds config).
- `npm run dev`: Run LibreChat client in dev mode.
- `npm run start`: Start LibreChat backend (production mode).
- `npm run build` / `npm run preview`: Build client + packages; preview locally.
- `npm test`: Run LibreChat workspace tests; `npm run test:mcp` for local MCP.
- `npm run lint` | `lint:fix` | `format`: Lint, auto-fix, format.
- Helpful scripts: `install-mongodb.sh` (MongoDB 7), `start-voygen.sh`.

## Coding Style & Naming Conventions
- Language: TypeScript/JavaScript, Node ≥ 18.
- Formatting: Prettier; 2‑space indent; LF line endings.
- Linting: ESLint (TS + React rules) aligned with LibreChat.
- Naming: `camelCase` variables/functions, `PascalCase` React components, kebab‑case utility filenames.

## Testing Guidelines
- Frameworks: Vitest/Jest in LibreChat workspaces; Playwright for e2e.
- Local structure here: place tests under `tests/unit|integration|e2e` using `*.test.ts(x)`.
- Run: `npm test` (top level) or inside `librechat-source/` use `npm run test:client` / `test:api`.
- Coverage: prefer adding meaningful unit tests; use c8/coverage from workspace when applicable.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: add itinerary export`).
- PRs: clear description, linked issues, test plan, and screenshots for UI changes.
- Requirements: passing `npm test` and `npm run lint`, updated docs when behavior changes.

## Security & Configuration Tips
- Never commit secrets. Copy `.env.example` → `.env` and edit locally.
- MongoDB is required; use `./install-mongodb.sh` on Debian/Ubuntu.
- App settings: adjust `librechat-source/librechat.yaml` for local features.

## Agent-Specific Instructions (MCP)
- Local agents: add under `mcp-local-servers/<agent-name>` with README and tests; run `npm run test:mcp`.
- Remote agents: place under `remote-mcp-servers/`; deploy via `npm run deploy:mcp` (see package scripts).

## Handoff Workflow (for Codex / Agents)
- Purpose: keep `HANDOFF.md` always current so a fresh session can resume seamlessly.
- Command:
  - Quick entry: `npm run handoff -- --status "<short status>" --next "<next steps>" --notes "<optional notes>"`
  - Example: `npm run handoff -- --status "Deploying" --next "Verify login & MCP" --notes "Domains verified; ALLOWED_ORIGINS updated"`
- Behavior: updates `HANDOFF.md` under the `## Handoff Log` section with timestamp, status, next steps, and latest commit (including `.cache-voygent-hosted` if present).
- Variant (done): `npm run handoff:done -- --status "<final status>" --next "<handoff next>" --notes "<notes>"`
  - Also updates the `## Current Status` section by inserting/updating a `- Current status: <text> (<timestamp>)` bullet.
- Convention: when the user types `/handoff ...` in chat, the agent should reflect that by running the command above with the provided text. If the user types `/handoff done ...`, use `npm run handoff:done` instead.

### Chat Commands
- `/handoff status="..." next="..." notes="..."`
  - Run: `npm run handoff -- --status "..." --next "..." --notes "..."`
- `/handoff done status="..." next="..." notes="..."`
  - Run: `npm run handoff:done -- --status "..." --next "..." --notes "..."`
  - Effect: updates both the Handoff Log and the Current Status bullet.

## Changelog Workflow
- Purpose: capture significant changes over time in `CHANGELOG.md` using a simple, consistent flow.
- File: `CHANGELOG.md` (Keep a Changelog style with Unreleased → Added/Changed/Fixed).
- Command:
  - `npm run changelog:add -- --type feat|fix|docs|chore --scope "<area>" --summary "<short description>"`
  - Example: `npm run changelog:add -- --type feat --scope "handoff" --summary "Add \"handoff:done\" to update Current Status"`
- Behavior: appends a bullet under the appropriate Unreleased section with a date stamp.

## Git Hooks (Changelog Reminder)
- Purpose: nudge contributors to update `CHANGELOG.md` when committing code changes.
- Install: `npm run setup:hooks` (or re-run `npm run setup` after cloning).
- Behavior: a local `commit-msg` hook prints a friendly reminder if `CHANGELOG.md` isn’t staged while code/ops files changed.
- Opt-out: set env `SKIP_CHANGELOG_CHECK=1` for a commit if needed.
