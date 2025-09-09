#!/usr/bin/env node

/**
 * MCP Chrome Server - Stdio Interface
 * This server provides MCP protocol access to Chrome browser automation
 * and hotel extraction capabilities.
 */

const path = require('path');
const { execSync } = require('child_process');

// Ensure Chrome extension is built and registered
function ensureChromeDeps() {
  try {
    const distPath = path.join(__dirname, 'app/chrome-extension/.output/chrome-mv3');
    const nativeServerPath = path.join(__dirname, 'app/native-server/dist');
    
    // Check if extension is built
    if (!require('fs').existsSync(distPath)) {
      console.error('[MCP Chrome] Extension not built. Run: pnpm run build');
      process.exit(1);
    }
    
    // Check if native server is built
    if (!require('fs').existsSync(nativeServerPath)) {
      console.error('[MCP Chrome] Native server not built. Run: pnpm --filter mcp-chrome-bridge build');
      process.exit(1);
    }
    
    // Register native host (idempotent)
    const cliPath = path.join(nativeServerPath, 'cli.js');
    execSync(`node "${cliPath}" register`, { stdio: 'inherit' });
    
    console.error('[MCP Chrome] Chrome extension and native host ready');
    console.error('[MCP Chrome] Make sure:');
    console.error('  1. Chrome extension is loaded (chrome://extensions)');
    console.error('  2. Extension popup shows "Connected"');
    console.error('  3. You have a hotel search results page open');
    
  } catch (error) {
    console.error('[MCP Chrome] Setup failed:', error.message);
    process.exit(1);
  }
}

// Start stdio MCP server
async function startServer() {
  ensureChromeDeps();
  
  try {
    console.error('[MCP Chrome] Starting MCP server...');
    
    // Run the built stdio server
    const serverPath = path.join(__dirname, 'app/native-server/dist/mcp/mcp-server-stdio.js');
    require(serverPath);
    
  } catch (error) {
    console.error('[MCP Chrome] Server failed to start:', error.message);
    console.error('[MCP Chrome] Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.error('[MCP Chrome] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP Chrome] Shutting down...');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('[MCP Chrome] Startup error:', error);
  process.exit(1);
});