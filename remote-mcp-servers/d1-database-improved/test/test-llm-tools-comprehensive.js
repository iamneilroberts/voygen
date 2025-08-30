const TEST_SERVER_URL = 'https://d1-database-improved.somotravel.workers.dev/sse';

// Utility functions
async function callTool(toolName, args) {
  const response = await fetch(TEST_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });
  
  return response.json();
}

function parseToolResponse(result) {
  if (result.error) {
    return { success: false, error: result.error };
  }
  
  if (result.result?.content?.[0]) {
    try {
      const content = result.result.content[0].text;
      return { 
        success: true, 
        data: typeof content === 'string' && content.startsWith('{') ? 
          JSON.parse(content) : content 
      };
    } catch (e) {
      return { success: true, data: result.result.content[0].text };
    }
  }
  
  return { success: false, error: 'Invalid response format' };
}

// Test 1: get_anything Tool Tests
async function testGetAnything() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Testing get_anything Tool');
  console.log('='.repeat(60));
  
  const testCases = [
    // Exact matches
    { name: 'Exact trip name', query: 'European Adventure - Dublin, London & Stoneleigh' },
    { name: 'Exact email', query: 'john.smith@email.com' },
    
    // Partial matches
    { name: 'Partial trip name', query: 'European' },
    { name: 'Partial client name', query: 'Smith' },
    { name: 'Destination search', query: 'Hawaii' },
    
    // FAQ patterns
    { name: 'Upcoming trips FAQ', query: 'upcoming trips' },
    { name: 'Revenue FAQ', query: 'total revenue' },
    { name: 'Confirmed trips FAQ', query: 'confirmed trips' },
    { name: 'Client list FAQ', query: 'client list' },
    
    // Edge cases
    { name: 'Empty query', query: '' },
    { name: 'Non-existent item', query: 'xyz123notfound' },
    { name: 'Special characters', query: 'test@#$%' },
    { name: 'Very long query', query: 'a'.repeat(100) },
    
    // Multiple word searches
    { name: 'Multiple words', query: 'London Paris Rome' },
    { name: 'Client and trip', query: 'Smith Hawaii' }
  ];
  
  const results = { passed: 0, failed: 0, errors: [] };
  
  for (const test of testCases) {
    process.stdout.write(`\n📍 ${test.name.padEnd(25, '.')}: `);
    
    const start = Date.now();
    const result = await callTool('get_anything', { query: test.query });
    const duration = Date.now() - start;
    const parsed = parseToolResponse(result);
    
    if (parsed.success) {
      const hasResponse = parsed.data.response && parsed.data.response.length > 0;
      const isError = parsed.data.error === 'not_found' && test.query === 'xyz123notfound';
      const isEmpty = test.query === '' && parsed.data.error === 'missing_query';
      
      if (hasResponse || isError || isEmpty) {
        console.log(`✅ PASS (${duration}ms)`);
        if (parsed.data.response) {
          console.log(`   Response: ${parsed.data.response.substring(0, 80)}...`);
        }
        results.passed++;
      } else {
        console.log(`❌ FAIL (${duration}ms)`);
        console.log(`   Error: No response received`);
        results.failed++;
        results.errors.push({ test: test.name, error: 'No response' });
      }
    } else {
      console.log(`❌ ERROR (${duration}ms)`);
      console.log(`   Error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
      results.failed++;
      results.errors.push({ test: test.name, error: parsed.error });
    }
  }
  
  return results;
}

// Test 2: remember_context Tool Tests
async function testRememberContext() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Testing remember_context Tool');
  console.log('='.repeat(60));
  
  const sessionId = `test-session-${Date.now()}`;
  const results = { passed: 0, failed: 0 };
  
  // Test 1: Store initial context
  process.stdout.write('\n📍 Store initial context......: ');
  const storeResult = await callTool('remember_context', {
    session_id: sessionId,
    facts: [
      { type: 'preference', subject: 'destination', fact: 'Client prefers Europe' },
      { type: 'context', subject: 'budget', fact: 'Budget is $5000-7000' },
      { type: 'constraint', subject: 'dates', fact: 'Must travel in September' }
    ],
    active_context: {
      trip_name: 'European Adventure',
      current_focus: 'destination selection'
    }
  });
  
  const storeParsed = parseToolResponse(storeResult);
  if (storeParsed.success && storeParsed.data.success) {
    console.log(`✅ PASS - Stored ${storeParsed.data.facts_stored} facts`);
    results.passed++;
  } else {
    console.log('❌ FAIL');
    results.failed++;
  }
  
  // Test 2: Add more facts to existing session
  process.stdout.write('\n📍 Update existing session.....: ');
  const updateResult = await callTool('remember_context', {
    session_id: sessionId,
    facts: [
      { type: 'decision', subject: 'hotel', fact: 'Selected 4-star hotels' },
      { type: 'preference', subject: 'activities', fact: 'Interest in historical tours' }
    ]
  });
  
  const updateParsed = parseToolResponse(updateResult);
  if (updateParsed.success && updateParsed.data.success) {
    console.log(`✅ PASS - Added ${updateParsed.data.facts_stored} more facts`);
    results.passed++;
  } else {
    console.log('❌ FAIL');
    results.failed++;
  }
  
  // Test 3: Invalid session data
  process.stdout.write('\n📍 Invalid data handling......: ');
  const invalidResult = await callTool('remember_context', {
    session_id: '', // Empty session ID
    facts: []
  });
  
  const invalidParsed = parseToolResponse(invalidResult);
  if (!invalidParsed.success || (invalidParsed.data && !invalidParsed.data.success)) {
    console.log('✅ PASS - Properly handled invalid data');
    results.passed++;
  } else {
    console.log('❌ FAIL - Should have rejected invalid data');
    results.failed++;
  }
  
  return results;
}

// Test 3: bulk_trip_operations Tool Tests
async function testBulkOperations() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Testing bulk_trip_operations Tool');
  console.log('='.repeat(60));
  
  const results = { passed: 0, failed: 0 };
  
  // Test 1: Add note and update status
  process.stdout.write('\n📍 Add note & update status...: ');
  const bulkResult = await callTool('bulk_trip_operations', {
    trip_identifier: 'European Adventure - Dublin, London & Stoneleigh',
    operations: [
      { type: 'add_note', data: { note: 'Test note from comprehensive test suite' } },
      { type: 'update_status', data: { status: 'confirmed' } }
    ]
  });
  
  const bulkParsed = parseToolResponse(bulkResult);
  if (bulkParsed.success && bulkParsed.data.success) {
    const successOps = bulkParsed.data.results.filter(r => r.success).length;
    console.log(`✅ PASS - ${successOps}/${bulkParsed.data.operations_performed} operations succeeded`);
    results.passed++;
  } else {
    console.log('❌ FAIL');
    results.failed++;
  }
  
  // Test 2: Invalid trip identifier
  process.stdout.write('\n📍 Invalid trip handling......: ');
  const invalidTripResult = await callTool('bulk_trip_operations', {
    trip_identifier: 'NonExistentTrip123',
    operations: [
      { type: 'add_note', data: { note: 'This should fail' } }
    ]
  });
  
  const invalidParsed = parseToolResponse(invalidTripResult);
  if (invalidParsed.success && !invalidParsed.data.success && invalidParsed.data.error === 'Trip not found') {
    console.log('✅ PASS - Properly handled non-existent trip');
    results.passed++;
  } else {
    console.log('❌ FAIL - Should have reported trip not found');
    results.failed++;
  }
  
  // Test 3: Invalid operation type
  process.stdout.write('\n📍 Invalid operation type.....: ');
  const invalidOpResult = await callTool('bulk_trip_operations', {
    trip_identifier: 'European Adventure - Dublin, London & Stoneleigh',
    operations: [
      { type: 'invalid_operation', data: {} }
    ]
  });
  
  const invalidOpParsed = parseToolResponse(invalidOpResult);
  if (invalidOpParsed.success && invalidOpParsed.data.results?.[0]?.error) {
    console.log('✅ PASS - Properly handled invalid operation');
    results.passed++;
  } else {
    console.log('❌ FAIL - Should have reported unknown operation');
    results.failed++;
  }
  
  return results;
}

// Test 4: Performance Testing
async function performanceTest() {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ Performance Testing');
  console.log('='.repeat(60));
  
  const queries = [
    'European Adventure',
    'Smith',
    'upcoming trips',
    'total revenue',
    'Hawaii',
    'confirmed trips',
    'London'
  ];
  
  const times = [];
  
  for (const query of queries) {
    const start = Date.now();
    await callTool('get_anything', { query });
    const duration = Date.now() - start;
    times.push(duration);
    console.log(`\n📊 Query "${query}": ${duration}ms`);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log('\n📈 Performance Summary:');
  console.log(`   Average: ${avg.toFixed(2)}ms`);
  console.log(`   Min: ${min}ms`);
  console.log(`   Max: ${max}ms`);
  console.log(`   ${avg < 200 ? '✅' : '⚠️'} Target: <200ms average`);
  
  return { avg, min, max };
}

// Main test runner
async function runAllTests() {
  console.log('🚀 LLM Tools Comprehensive Test Suite');
  console.log('====================================');
  console.log(`Server: ${TEST_SERVER_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const allResults = {
    get_anything: null,
    remember_context: null,
    bulk_operations: null,
    performance: null
  };
  
  try {
    // Run all test suites
    allResults.get_anything = await testGetAnything();
    allResults.remember_context = await testRememberContext();
    allResults.bulk_operations = await testBulkOperations();
    allResults.performance = await performanceTest();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const totalPassed = allResults.get_anything.passed + 
                       allResults.remember_context.passed + 
                       allResults.bulk_operations.passed;
    
    const totalFailed = allResults.get_anything.failed + 
                       allResults.remember_context.failed + 
                       allResults.bulk_operations.failed;
    
    console.log(`\n✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⚡ Performance: ${allResults.performance.avg.toFixed(2)}ms average`);
    console.log(`⏱️  Total Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    if (allResults.get_anything.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      allResults.get_anything.errors.forEach(e => {
        console.log(`   - ${e.test}: ${JSON.stringify(e.error)}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(totalFailed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
runAllTests();