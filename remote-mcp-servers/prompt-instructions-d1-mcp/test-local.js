// Simple test script for the prompt-instructions-d1-mcp server
// Tests basic functionality before deployment

const TEST_SERVER_URL = 'https://prompt-instructions-d1-mcp.neil-travel-agent.workers.dev';

async function testHealthEndpoint() {
  console.log('Testing health endpoint...');
  try {
    const response = await fetch(`${TEST_SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
    return data.status === 'ok';
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testMCPInitialize() {
  console.log('Testing MCP initialize...');
  try {
    const response = await fetch(`${TEST_SERVER_URL}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      })
    });
    const data = await response.json();
    console.log('✅ MCP Initialize:', data);
    return data.result && data.result.serverInfo;
  } catch (error) {
    console.error('❌ MCP Initialize failed:', error.message);
    return false;
  }
}

async function testListTools() {
  console.log('Testing list tools...');
  try {
    const response = await fetch(`${TEST_SERVER_URL}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });
    const data = await response.json();
    console.log('✅ List Tools:', `${data.result?.tools?.length || 0} tools found`);
    return data.result?.tools?.length > 0;
  } catch (error) {
    console.error('❌ List Tools failed:', error.message);
    return false;
  }
}

async function testGetInstruction() {
  console.log('Testing get instruction...');
  try {
    const response = await fetch(`${TEST_SERVER_URL}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_instruction',
          arguments: { name: 'mobile-mode' }
        }
      })
    });
    const data = await response.json();
    console.log('✅ Get Instruction:', data.result?.content?.[0]?.text?.substring(0, 100) + '...');
    return data.result?.content?.[0]?.text?.includes('Mobile Mode');
  } catch (error) {
    console.error('❌ Get Instruction failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing prompt-instructions-d1-mcp server...\n');
  
  const tests = [
    testHealthEndpoint,
    testMCPInitialize,
    testListTools,
    testGetInstruction
  ];
  
  const results = [];
  for (const test of tests) {
    const result = await test();
    results.push(result);
    console.log('');
  }
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Server is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the deployment.');
  }
}

runTests().catch(console.error);