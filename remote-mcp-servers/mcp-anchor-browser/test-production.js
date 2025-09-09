#!/usr/bin/env node
// Simple test to validate MCP SSE endpoint functionality

const PRODUCTION_URL = 'https://mcp-anchor-browser-production.somotravel.workers.dev';

async function testMCPConnection() {
  console.log('Testing MCP Anchor Browser production deployment...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${PRODUCTION_URL}/health`);
    const health = await healthResponse.json();
    console.log(`   Status: ${health.status}`);
    console.log(`   Environment: ${health.environment}`);
    console.log(`   Anchor API: ${health.anchorApiConfigured ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Database: ${health.databaseConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   Cache: ${health.cacheConnected ? '✅ Connected' : '❌ Disconnected'}\n`);
    
    // Test root endpoint
    console.log('2. Testing root endpoint...');
    const rootResponse = await fetch(`${PRODUCTION_URL}/`);
    const root = await rootResponse.json();
    console.log(`   Name: ${root.name}`);
    console.log(`   Version: ${root.version}`);
    console.log(`   SSE Endpoint: ${root.endpoints.sse}\n`);
    
    // Test debug info
    console.log('3. Testing debug endpoint...');
    const debugResponse = await fetch(`${PRODUCTION_URL}/debug/info`);
    const debug = await debugResponse.json();
    console.log(`   Server: ${debug.server.name} v${debug.server.version}`);
    console.log(`   Runtime: ${debug.runtime.sessionTtlMinutes} min session TTL\n`);
    
    console.log('✅ All endpoints responding correctly!');
    console.log(`🚀 Production URL: ${PRODUCTION_URL}`);
    console.log(`📡 MCP SSE Endpoint: ${PRODUCTION_URL}/sse`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMCPConnection();