# TASK-0049: MCP Chrome Container Integration Issue

## Status: OPEN
## Priority: HIGH
## Created: 2025-09-06
## Category: Infrastructure/MCP Integration

## Problem Statement

The mcp-chrome server fails to load in the VoygentCE Docker container environment, preventing browser automation features from being available in LibreChat. While the d1_database and prompt_instructions MCP servers load successfully via SSE/HTTP transport, the chrome MCP server which uses stdio/command transport fails with module resolution errors.

## Current Symptoms

1. **Module Resolution Failures**: The container repeatedly shows errors:
   ```
   Error: Cannot find module 'fastify'
   Error: Cannot find module '@fastify/cors'
   Require stack: /mcp-chrome/server/index.js
   ```

2. **Connection Failures**: After module errors, the MCP connection fails:
   ```
   [MCP][chrome] Connection failed: MCP error -32000: Connection closed
   [MCP][chrome] Failed to connect after 3 attempts
   ```

3. **UI Impact**: LibreChat UI only shows 2 MCP servers (d1_database, prompt_instructions) instead of the expected 3.

## Root Cause Analysis

### Issue 1: Module Dependencies in Container
- The mcp-chrome native-server is built with TypeScript compilation but requires runtime dependencies
- Dependencies are installed in the build environment but not bundled into the dist folder
- Container volume mount at `/mcp-chrome` doesn't include node_modules from the host

### Issue 2: Build vs Runtime Environment Mismatch
- Build process (via pnpm/npm) compiles TypeScript to JavaScript
- Runtime expects all dependencies to be available at `/mcp-chrome/`
- Current build script doesn't bundle dependencies (uses plain tsc compilation)

### Issue 3: Configuration Structure
- Chrome MCP server was initially only in endpoint-specific config, not global config
- Fixed by adding to global `mcpServers` section, but module issue persists

## Attempted Solutions (Failed)

1. **Manual dependency installation in dist**:
   ```bash
   cd mcp-chrome/app/native-server/dist
   npm init -y
   npm install fastify @modelcontextprotocol/sdk zod @fastify/cors chrome-launcher puppeteer-core
   ```
   - Result: Dependencies installed locally but container still can't find them

2. **Copying modified mcp-chrome from voygen**:
   ```bash
   cp -r /home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract /home/neil/dev/voygent.appCE/mcp-chrome
   ```
   - Result: Successfully copied but same module resolution issues

## Technical Details

### Working Configuration (d1_database, prompt_instructions)
```yaml
mcpServers:
  d1_database:
    type: "streamable-http"
    url: "https://d1-database-improved.somotravel.workers.dev/sse"
```
- Uses HTTP/SSE transport (no local process spawning)
- No local dependencies required

### Failing Configuration (chrome)
```yaml
mcpServers:
  chrome:
    command: "node"
    args: ["/mcp-chrome/index.js"]
```
- Uses stdio transport (spawns local Node.js process)
- Requires all Node.js dependencies available in container

### Docker Volume Mount
```yaml
volumes:
  - ./mcp-chrome/app/native-server/dist:/mcp-chrome:ro
```
- Mounts only the dist folder, not node_modules
- Read-only mount prevents runtime installation

## Proposed Solutions

### Solution 1: Bundle Dependencies (Recommended)
Use a bundler like esbuild or webpack to create a self-contained bundle:

1. Modify build process in `mcp-chrome/app/native-server/src/scripts/build.ts`:
   ```typescript
   // Add esbuild or webpack bundling
   await esbuild.build({
     entryPoints: ['src/index.ts'],
     bundle: true,
     platform: 'node',
     target: 'node18',
     outfile: 'dist/index.js',
     external: ['chrome-launcher', 'puppeteer-core'] // Keep large binaries external
   })
   ```

2. Include minimal runtime dependencies in dist:
   ```bash
   cp -r node_modules/chrome-launcher dist/node_modules/
   cp -r node_modules/puppeteer-core dist/node_modules/
   ```

### Solution 2: Multi-stage Docker Build
Create a proper Docker image for mcp-chrome:

1. Create `mcp-chrome/Dockerfile`:
   ```dockerfile
   FROM node:18-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY dist/ ./
   CMD ["node", "index.js"]
   ```

2. Update docker-compose.yml to include chrome service:
   ```yaml
   chrome-mcp:
     build: ./mcp-chrome
     volumes:
       - /tmp/.X11-unix:/tmp/.X11-unix:rw
   ```

### Solution 3: Include node_modules in Volume Mount
Simplest but less clean approach:

1. Build with dependencies:
   ```bash
   cd mcp-chrome/app/native-server
   npm run build
   cp -r node_modules dist/
   ```

2. Update docker-compose volume:
   ```yaml
   volumes:
     - ./mcp-chrome/app/native-server/dist:/mcp-chrome:ro
   ```

## Testing Requirements

After implementing solution:

1. Restart LibreChat container
2. Check logs for successful MCP chrome initialization:
   ```
   [MCP][chrome] Tools: chrome_navigate, chrome_screenshot, chrome_get_content, ...
   ```
3. Verify chrome appears in LibreChat UI (3 MCP servers total)
4. Test a chrome tool like screenshot capture

## Related Files

- `/home/neil/dev/voygent.appCE/config/librechat.yaml` - LibreChat configuration
- `/home/neil/dev/voygent.appCE/docker-compose.yml` - Container orchestration
- `/home/neil/dev/voygent.appCE/mcp-chrome/` - Chrome MCP server code
- `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract/` - Source with extractors

## Dependencies

- Node.js 18+ in container
- Chrome/Chromium binary accessible in container
- Fastify and related web server dependencies
- Puppeteer for browser automation

## Notes

- The 34 MCP tools currently available are only from d1_database and prompt_instructions
- Chrome MCP would add approximately 15-20 additional browser automation tools
- This is blocking advanced hotel extraction features developed in TASK-0048

## Next Steps

1. Implement Solution 1 (bundling) as it's most container-friendly
2. Test in local environment first
3. Update build scripts to automate bundling
4. Document the build process for future maintenance
5. Consider long-term migration to Solution 2 (containerized service) for better isolation

## References

- MCP SDK Documentation: https://modelcontextprotocol.io/docs
- Original mcp-chrome: https://github.com/modelcontextprotocol/mcp-chrome
- LibreChat MCP Integration: https://www.librechat.ai/docs/configuration/mcp