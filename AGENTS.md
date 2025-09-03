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
