# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voygen is an AI-powered travel assistant system built on LibreChat with Model Context Protocol (MCP) integration. It provides travel agents with a chat interface and AI capabilities including browser automation, client management, and travel data extraction.

## Key Architecture Components

### MCP Server Architecture
The system uses four core MCP servers that communicate via the Model Context Protocol:

1. **mcp-chrome** (Local): Browser automation for real-time web data extraction
   - Location: `mcp-local-servers/mcp-chrome/`
   - Provides screenshot capture, form filling, and live price monitoring

2. **d1-database** (Remote - Cloudflare Workers): Client and trip database management
   - Location: `remote-mcp-servers/d1-database-improved/`
   - Handles all data persistence, client records, and trip information
   - Use `get_anything` for broad searches, `find_*` and `list_*` for targeted queries

3. **prompt-instructions** (Remote - Cloudflare Workers): Workflow and conversation management
   - Location: `remote-mcp-servers/prompt-instructions-d1-mcp/`
   - Manages workflow state and conversation flow
   - Use `continue_trip` from this server for `/continue` commands

4. **github-mcp** (Remote - Cloudflare Workers): Document publishing
   - Location: `remote-mcp-servers/github-mcp-cta/`
   - Publishes HTML documents to GitHub Pages (somotravel.us and voygen.app)

### LibreChat Integration
- Configuration: `config/librechat-minimal.yaml`
- LibreChat source directory: `librechat-source/` (needs to be populated with actual LibreChat installation)
- The system extends LibreChat with MCP servers for travel-specific functionality

## Common Development Commands

### Build and Run
```bash
# Initial setup (installs deps, builds mcp-chrome)
npm run setup
./scripts/setup.sh

# Development mode (runs LibreChat in dev mode)
npm run dev

# Production build and start
npm run build
npm run start

# Preview (build frontend + start server)
npm run preview
```

### Testing
```bash
# Run all tests
npm test

# Unit tests (MCP Chrome tests)
npm run test:unit
npm run test:mcp

# Integration tests (not yet implemented)
npm run test:integration

# E2E tests (not yet implemented)
npm run test:e2e
```

### Code Quality
```bash
# Lint code (runs LibreChat's linter)
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Deployment
```bash
# Deploy all remote MCP servers to Cloudflare Workers
npm run deploy:mcp

# Deploy individual servers
cd remote-mcp-servers/d1-database-improved && npm run deploy
cd remote-mcp-servers/prompt-instructions-d1-mcp && npm run deploy
cd remote-mcp-servers/github-mcp-cta && npm run deploy
```

### Dependencies Installation
```bash
# Install all dependencies (LibreChat + MCP Chrome)
npm run install-deps
```

## MCP Server Development

### Tool Selection Guidelines
- **Database queries**: Use `d1-database` server
  - `get_anything`: Broad search across clients, trips, bookings
  - `find_*` and `list_*`: Targeted database queries
  - Prefer `trip_id` over textual identifiers when available

- **Workflow management**: Use `prompt-instructions` server
  - `travel_agent_start`: Initialize startup instructions
  - `continue_trip`: Resume work on existing trips (for `/continue` commands)

- **Web automation**: Use `mcp-chrome` server
  - Real-time price extraction from travel websites
  - Screenshot capture for visual confirmation
  - Form filling and booking interface interaction

- **Document publishing**: Use `github-mcp` server
  - `publish_travel_document`: Publish HTML to GitHub Pages
  - Creates professional travel proposals and documents

### Remote MCP Server Structure
Each remote MCP server follows this pattern:
- `src/index.ts`: Main server implementation
- `wrangler.toml`: Cloudflare Workers configuration
- TypeScript with Zod for schema validation
- Deployed to Cloudflare Workers with D1 database support

## Environment Configuration

Required environment variables in `.env`:
```bash
# AI Model API Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...

# LibreChat Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/voygen
JWT_SECRET=your-secret-key-here

# Chrome Path (auto-detected on most systems)
CHROME_PATH=/usr/bin/google-chrome
```

## Cost Optimization Strategy

The system uses intelligent model routing:
- **Haiku 3.5** ($0.25/1M tokens): Routine tasks, data lookups, simple operations
- **Sonnet 3.5** ($3.00/1M tokens): Complex planning, multi-step reasoning
- This provides 12x cost savings compared to premium-only solutions

## Testing MCP Servers

```bash
# Test local MCP Chrome server
cd mcp-local-servers/mcp-chrome
npm test

# Test remote server connectivity
npx mcp-remote https://d1-database-improved.somotravel.workers.dev/sse
npx mcp-remote https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse
npx mcp-remote https://github-mcp-cta.somotravel.workers.dev/sse
```

## Important Notes

1. **LibreChat Installation**: The `librechat-source/` directory needs to be populated with an actual LibreChat installation. Currently it's empty.

2. **MongoDB Requirement**: LibreChat requires MongoDB to be running. Ensure it's installed and accessible at the URI specified in `.env`.

3. **Chrome/Chromium**: Required for mcp-chrome browser automation. Must be installed and path configured in `.env`.

4. **MCP Server Priority**: When multiple servers offer similar tools, follow the serverInstructions in `config/librechat-minimal.yaml` for correct tool selection.

5. **Workflow Commands**:
   - `/start`: Initialize travel agent system
   - `/continue [trip]`: Resume work on existing trip
   - `/publish`: Generate and publish travel documents