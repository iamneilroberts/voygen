const TEST_SERVER_URL = 'https://d1-database-improved.somotravel.workers.dev/sse';

async function runLoadTest(concurrent = 10, iterations = 5) {
  console.log(`🚀 Load Testing: ${concurrent} concurrent requests, ${iterations} iterations`);
  console.log('='.repeat(60));
  
  const queries = [
    'European Adventure',
    'Smith',
    'upcoming trips',
    'Hawaii vacation',
    'total revenue',
    'john@email.com',
    'confirmed trips',
    'London',
    'September trips',
    'client list'
  ];
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\n📍 Iteration ${i + 1}/${iterations}`);
    
    const promises = [];
    const startTime = Date.now();
    
    // Launch concurrent requests
    for (let j = 0; j < concurrent; j++) {
      const query = queries[j % queries.length];
      promises.push(
        fetch(TEST_SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now() + j,
            method: 'tools/call',
            params: {
              name: 'get_anything',
              arguments: { query }
            }
          })
        }).then(r => r.json())
      );
    }
    
    // Wait for all to complete
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successful = responses.filter(r => !r.error).length;
    const avgTime = duration / concurrent;
    
    results.push({ duration, successful, avgTime });
    
    console.log(`   ✅ Successful: ${successful}/${concurrent}`);
    console.log(`   ⏱️  Total time: ${duration}ms`);
    console.log(`   📊 Avg per request: ${avgTime.toFixed(2)}ms`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST SUMMARY');
  console.log('='.repeat(60));
  
  const avgDuration = results.reduce((a, b) => a + b.avgTime, 0) / results.length;
  const totalSuccessful = results.reduce((a, b) => a + b.successful, 0);
  const totalRequests = concurrent * iterations;
  
  console.log(`\n✅ Success Rate: ${((totalSuccessful / totalRequests) * 100).toFixed(2)}%`);
  console.log(`⚡ Average Response Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`📈 Requests per Second: ${(1000 / avgDuration * concurrent).toFixed(2)}`);
}

// Run with different load levels
async function runAllLoadTests() {
  await runLoadTest(5, 3);   // Light load
  await runLoadTest(10, 3);  // Medium load
  await runLoadTest(20, 3);  // Heavy load
}

runAllLoadTests().catch(console.error);