const TEST_URL = 'https://d1-database-improved.somotravel.workers.dev/sse';

async function testTool(name, args) {
  console.log(`\nTesting ${name}:`, args);
  
  const response = await fetch(TEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    console.error('❌ Error:', result.error);
    return false;
  }
  
  if (result.result?.content?.[0]) {
    const content = JSON.parse(result.result.content[0].text);
    console.log('✅ Success:', content.response ? 
      content.response.substring(0, 100) + '...' : 
      JSON.stringify(content).substring(0, 100) + '...');
    return true;
  }
  
  console.error('❌ Unexpected response:', result);
  return false;
}

async function runTests() {
  console.log('Testing Fixed LLM Tools\n' + '='.repeat(50));
  
  // Test get_anything with various queries
  const testQueries = [
    { query: 'European Adventure' },
    { query: 'upcoming trips' },
    { query: 'smith' },
    { query: 'total revenue' },
    { query: 'hawaii' },
    { query: 'confirmed trips' },
    { query: 'xyz123notfound' }
  ];
  
  let passed = 0;
  for (const test of testQueries) {
    if (await testTool('get_anything', test)) passed++;
  }
  
  // Test bulk operations
  if (await testTool('bulk_trip_operations', {
    trip_identifier: 'European Adventure',
    operations: [
      { type: 'add_note', data: { note: 'Testing bulk operations' } },
      { type: 'update_status', data: { status: 'confirmed' } }
    ]
  })) passed++;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests passed: ${passed}/${testQueries.length + 1}`);
}

runTests().catch(console.error);