// Test script to verify query logging schema
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runQuery(query) {
  try {
    const { stdout, stderr } = await execPromise(
      `wrangler d1 execute travel_assistant --remote --command="${query}"`
    );
    
    if (stderr && !stderr.includes('wrangler')) {
      console.error('Error:', stderr);
      return null;
    }
    
    // Parse the JSON output
    const lines = stdout.split('\n');
    const jsonStart = lines.findIndex(line => line.trim().startsWith('['));
    if (jsonStart >= 0) {
      const jsonStr = lines.slice(jsonStart).join('\n');
      const result = JSON.parse(jsonStr);
      return result[0];
    }
    
    return null;
  } catch (error) {
    console.error('Query failed:', error.message);
    return null;
  }
}

async function testQueryLoggingSchema() {
  console.log('🧪 Testing Query Logging Schema\n');
  console.log('='.repeat(60));
  
  const tests = [
    {
      name: 'Query Log Table',
      query: `INSERT INTO llm_query_log (query_text, query_lower, was_cached, execution_time_ms, session_id) 
              VALUES ('Test query', 'test query', 0, 125, 'test-session-1')
              RETURNING log_id`
    },
    {
      name: 'Failed Queries Table',
      query: `INSERT INTO llm_failed_queries (query_text, query_lower, common_terms, query_category) 
              VALUES ('Unknown commission query', 'unknown commission query', 'commission query', 'commission')
              ON CONFLICT(query_text) DO UPDATE SET failure_count = failure_count + 1
              RETURNING failure_count`
    },
    {
      name: 'Pattern Candidates Table',
      query: `INSERT INTO llm_pattern_candidates (pattern, sql_template, answer_template, discovered_from) 
              VALUES ('%test%pattern%', 'SELECT 1', 'Test result: {results}', 'manual')
              RETURNING candidate_id`
    },
    {
      name: 'Session Tracking',
      query: `INSERT INTO llm_query_sessions (session_id, query_count, cache_hits) 
              VALUES ('test-session-2', 5, 3)
              ON CONFLICT(session_id) DO UPDATE SET query_count = query_count + 1
              RETURNING session_id, query_count`
    },
    {
      name: 'Configuration Check',
      query: `SELECT COUNT(*) as config_count FROM llm_config`
    },
    {
      name: 'Commission Summary View',
      query: `SELECT COUNT(*) as month_count FROM commission_summary`
    },
    {
      name: 'Index Verification',
      query: `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%log%'`
    }
  ];
  
  let passCount = 0;
  let failCount = 0;
  
  for (const test of tests) {
    process.stdout.write(`\n${test.name}: `);
    const result = await runQuery(test.query);
    
    if (result && result.success) {
      console.log('✅ PASS');
      if (result.results && result.results.length > 0) {
        console.log('  Result:', JSON.stringify(result.results[0], null, 2));
      }
      passCount++;
    } else {
      console.log('❌ FAIL');
      if (result && result.error) {
        console.log('  Error:', result.error);
      }
      failCount++;
    }
  }
  
  // Clean up test data
  console.log('\n🧹 Cleaning up test data...');
  await runQuery(`DELETE FROM llm_query_log WHERE session_id LIKE 'test-%'`);
  await runQuery(`DELETE FROM llm_failed_queries WHERE query_text = 'Unknown commission query'`);
  await runQuery(`DELETE FROM llm_pattern_candidates WHERE pattern = '%test%pattern%'`);
  await runQuery(`DELETE FROM llm_query_sessions WHERE session_id LIKE 'test-%'`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / tests.length) * 100).toFixed(1)}%`);
  
  if (passCount === tests.length) {
    console.log('\n✅ All schema tests passed! Phase 2A schema is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the schema.');
  }
}

// Run the tests
testQueryLoggingSchema().catch(console.error);