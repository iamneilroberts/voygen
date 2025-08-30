// Test script for new user-friendly tools
// Tests the start, status, help, and reload tools

const TEST_SERVER_URL = 'https://d1-database-improved.somotravel.workers.dev';

async function testUserFriendlyTool(toolName, description) {
  console.log(`\n🧪 Testing ${toolName} tool - ${description}...`);
  try {
    const response = await fetch(`${TEST_SERVER_URL}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1000),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {}
        }
      })
    });
    
    const data = await response.json();
    
    if (data.result && data.result.content && data.result.content[0]) {
      const content = data.result.content[0].text;
      console.log(`✅ ${toolName} tool works!`);
      console.log(`📄 Response preview: ${content.substring(0, 200)}...`);
      return true;
    } else {
      console.log(`❌ ${toolName} tool failed - no content returned`);
      console.log('Full response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.error(`❌ ${toolName} tool failed:`, error.message);
    return false;
  }
}

async function testListTools() {
  console.log('\n🔍 Testing if new tools are registered...');
  try {
    const response = await fetch(`${TEST_SERVER_URL}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    const data = await response.json();
    const tools = data.result?.tools || [];
    const toolNames = tools.map(t => t.name);
    
    console.log(`📋 Found ${tools.length} total tools`);
    
    const userFriendlyTools = ['start', 'initialize', 'status', 'help', 'reload', 'refresh'];
    const foundTools = userFriendlyTools.filter(name => toolNames.includes(name));
    const missingTools = userFriendlyTools.filter(name => !toolNames.includes(name));
    
    console.log(`✅ Found user-friendly tools: ${foundTools.join(', ')}`);
    if (missingTools.length > 0) {
      console.log(`❌ Missing tools: ${missingTools.join(', ')}`);
    }
    
    return missingTools.length === 0;
  } catch (error) {
    console.error('❌ Failed to list tools:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing User-Friendly Travel Agent Tools\n');
  
  const tests = [
    // First check if tools are registered
    { fn: testListTools, name: 'Tool Registration Check' },
    
    // Test each user-friendly tool
    { fn: () => testUserFriendlyTool('start', 'Load startup-core with welcome message'), name: 'Start Tool' },
    { fn: () => testUserFriendlyTool('initialize', 'Alternative startup command'), name: 'Initialize Tool' },
    { fn: () => testUserFriendlyTool('status', 'Show loaded instructions'), name: 'Status Tool' },
    { fn: () => testUserFriendlyTool('help', 'Show travel agent workflows'), name: 'Help Tool' },
    { fn: () => testUserFriendlyTool('reload', 'Refresh system instructions'), name: 'Reload Tool' },
    { fn: () => testUserFriendlyTool('refresh', 'Alternative reload command'), name: 'Refresh Tool' },
  ];
  
  const results = [];
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
    console.log(''); // spacing
  }
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All user-friendly tools are working correctly!');
    console.log('\n👥 Travel agents can now use simple commands:');
    console.log('   - "start" or "initialize" to load instructions');
    console.log('   - "status" to check system state');
    console.log('   - "help" to see available workflows');
    console.log('   - "reload" or "refresh" to update instructions');
  } else {
    console.log('⚠️ Some tests failed. Check the deployment and try again.');
  }
}

runTests().catch(console.error);