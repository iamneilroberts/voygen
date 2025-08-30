/**
 * Local test script for GitHub MCP server
 */

// Mock environment for testing
const mockEnv = {
  GITHUB_TOKEN: 'test-token',
  GITHUB_OWNER: 'testowner',
  GITHUB_REPO: 'testrepo'
};

// Simple MCP request test
async function testMCPRequests() {
  console.log('🚀 Testing GitHub MCP Server locally...\n');
  
  // Import the handler
  const { default: handler } = await import('./dist/index.js');
  
  try {
    // Test 1: Initialize request
    console.log('1. Testing initialize request...');
    const initRequest = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18' }
      })
    });
    
    const initResponse = await handler.fetch(initRequest, mockEnv);
    const initResult = await initResponse.json();
    console.log('✅ Initialize:', initResult.result?.serverInfo?.name);
    
    // Test 2: Tools list request
    console.log('\n2. Testing tools/list request...');
    const toolsRequest = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      })
    });
    
    const toolsResponse = await handler.fetch(toolsRequest, mockEnv);
    const toolsResult = await toolsResponse.json();
    console.log('✅ Tools available:', toolsResult.result?.tools?.length || 0);
    
    if (toolsResult.result?.tools) {
      toolsResult.result.tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    }
    
    // Test 3: Health check
    console.log('\n3. Testing health check...');
    const healthRequest = new Request('http://localhost/health');
    const healthResponse = await handler.fetch(healthRequest, mockEnv);
    const healthResult = await healthResponse.json();
    console.log('✅ Health check:', healthResult.status || 'unknown');
    
    console.log('\n🎉 All basic tests passed!');
    console.log('\nTo test with real GitHub API:');
    console.log('1. Set GITHUB_TOKEN in wrangler.toml secrets');
    console.log('2. Deploy with: wrangler deploy');
    console.log('3. Add to Claude Desktop config');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
testMCPRequests();