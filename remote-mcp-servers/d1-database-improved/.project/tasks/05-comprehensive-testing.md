# Task 5: Comprehensive Testing Suite (3 hours)
**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Time**: 3 hours  

## Objective
Create comprehensive test suite to prevent regression and ensure all fixes work correctly.

## Implementation Steps

### 5.1 Create Core Functionality Test Suite
**File**: `/tests/core-functionality.test.js`

```javascript
const { testMCPTool } = require('./test-helpers');

describe('Core D1 Database Tools', () => {
  
  describe('Essential Tools', () => {
    test('health_check returns database status', async () => {
      const result = await testMCPTool('health_check');
      expect(result.status).toBe('healthy');
    });
    
    test('get_anything handles basic queries', async () => {
      const result = await testMCPTool('get_anything', {
        query: 'trips in database'
      });
      expect(result.results).toBeDefined();
    });
    
    test('create_client_v2 creates client successfully', async () => {
      const result = await testMCPTool('create_client_v2', {
        email: 'test@example.com',
        full_name: 'Test Client'
      });
      expect(result.client_id).toBeDefined();
    });
  });
  
  describe('Trip Facts System', () => {
    test('refresh_trip_facts works without constraint errors', async () => {
      const result = await testMCPTool('refresh_trip_facts', {
        limit: 1
      });
      expect(result.error).toBeUndefined();
    });
    
    test('mark_facts_dirty accepts INTEGER trip_id', async () => {
      const result = await testMCPTool('mark_facts_dirty', {
        trip_ids: [1, 2, 3],
        reason: 'test'
      });
      expect(result.success).toBe(true);
    });
  });
});
```

### 5.2 Schema Validation Test Suite  
**File**: `/tests/schema-validation.test.js`

```javascript
describe('Database Schema Validation', () => {
  
  test('trip_facts has INTEGER trip_id', async () => {
    const schema = await testQuery(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='trip_facts'
    `);
    expect(schema).toContain('trip_id INTEGER');
  });
  
  test('facts_dirty references trips_v2 correctly', async () => {
    const constraints = await testQuery(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='facts_dirty'
    `);
    expect(constraints).toContain('trips_v2(trip_id)');
  });
  
  test('triggers reference v2 tables not old tables', async () => {
    const triggers = await testQuery(`
      SELECT sql FROM sqlite_master 
      WHERE type='trigger' AND sql LIKE '%trips_v2%'
    `);
    expect(triggers.length).toBeGreaterThan(0);
  });
});
```

### 5.3 Integration Test Suite
**File**: `/tests/integration.test.js`

```javascript
describe('End-to-End Integration Tests', () => {
  
  test('Complete trip creation and facts generation flow', async () => {
    // Create client
    const client = await testMCPTool('create_client_v2', {
      email: 'integration@test.com',
      full_name: 'Integration Test Client'
    });
    
    // Create trip with client
    const trip = await testMCPTool('create_trip_with_client', {
      trip_name: 'Integration Test Trip',
      start_date: '2025-10-01',
      end_date: '2025-10-07',
      client_email: 'integration@test.com'
    });
    
    // Generate trip facts
    const facts = await testMCPTool('refresh_trip_facts', {
      limit: 1
    });
    
    expect(client.client_id).toBeDefined();
    expect(trip.trip_id).toBeDefined(); 
    expect(facts.error).toBeUndefined();
  });
  
  test('Workflow tools integration', async () => {
    const init = await testMCPTool('initialize_workflow', {
      trip_identifier: 'Integration Test Trip',
      starting_phase: 'interview'
    });
    
    const status = await testMCPTool('get_workflow_status', {
      trip_identifier: 'Integration Test Trip'
    });
    
    expect(init.success).toBe(true);
    expect(status.current_phase).toBe('interview');
  });
});
```

### 5.4 Error Handling Test Suite
**File**: `/tests/error-handling.test.js`

```javascript
describe('Error Handling and Edge Cases', () => {
  
  test('Invalid queries handled gracefully', async () => {
    const result = await testMCPTool('get_anything', {
      query: 'completely invalid nonsense query'
    });
    expect(result.error || result.results).toBeDefined();
    // Should not crash, should return meaningful response
  });
  
  test('Constraint violations reported clearly', async () => {
    // Try to create trip with invalid client
    const result = await testMCPTool('create_trip_with_client', {
      trip_name: 'Invalid Test',
      start_date: '2025-10-01',
      end_date: '2025-10-07',
      client_email: 'nonexistent@email.com'
    });
    // Should either create client or give clear error
  });
  
  test('SQL injection prevented', async () => {
    const result = await testMCPTool('get_anything', {
      query: "'; DROP TABLE trips_v2; --"
    });
    // Should not crash database, should handle safely
    expect(result).toBeDefined();
  });
});
```

### 5.5 Performance Test Suite
**File**: `/tests/performance.test.js`

```javascript
describe('Performance Tests', () => {
  
  test('Large query results within reasonable time', async () => {
    const start = Date.now();
    const result = await testMCPTool('get_anything', {
      query: 'trips in database'
    });
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(5000); // 5 second limit
    expect(result.results).toBeDefined();
  });
  
  test('Fact generation completes within time limit', async () => {
    const start = Date.now();
    const result = await testMCPTool('refresh_trip_facts', {
      limit: 10
    });
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(10000); // 10 second limit
  });
});
```

### 5.6 Test Utilities
**File**: `/tests/test-helpers.js`

```javascript
const { spawn } = require('child_process');

async function testMCPTool(toolName, params = {}) {
  // Implementation to call MCP server tools for testing
  // Could use direct API calls or spawn process to test
  
  return new Promise((resolve, reject) => {
    // Call the MCP server tool and return result
    // This would need to be implemented based on server setup
  });
}

async function testQuery(sql) {
  // Direct database query for schema validation
}

module.exports = { testMCPTool, testQuery };
```

### 5.7 Automated Test Runner
**File**: `/package.json` - Add test scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:core": "jest tests/core-functionality",
    "test:schema": "jest tests/schema-validation", 
    "test:integration": "jest tests/integration",
    "test:errors": "jest tests/error-handling",
    "test:perf": "jest tests/performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 5.8 Continuous Integration Test
**File**: `/tests/ci-smoke-test.sh`

```bash
#!/bin/bash
# Quick smoke test for CI/CD pipeline

echo "Running smoke tests..."

# Test 1: Server starts without errors
npm run start:test &
SERVER_PID=$!
sleep 5

# Test 2: Health check passes
curl -f http://localhost:3000/health || exit 1

# Test 3: Basic MCP call works
# (Implementation depends on server setup)

# Cleanup
kill $SERVER_PID

echo "Smoke tests passed!"
```

### 5.9 Regression Prevention Tests
**File**: `/tests/regression.test.js`

```javascript
describe('Regression Prevention', () => {
  
  test('Trip facts generation does not fail with FOREIGN KEY constraint', async () => {
    // This specifically tests the issue we fixed
    const result = await testMCPTool('refresh_trip_facts', {
      limit: 1
    });
    expect(result.toString()).not.toContain('SQLITE_CONSTRAINT');
    expect(result.toString()).not.toContain('FOREIGN KEY constraint failed');
  });
  
  test('Tools array contains only working tools', async () => {
    const tools = await getMCPToolList();
    const brokenTools = [
      'comprehensive_schema_fix',
      'repair_trip_facts_schema', 
      'analyze_foreign_key_issues'
    ];
    
    brokenTools.forEach(tool => {
      expect(tools).not.toContain(tool);
    });
  });
});
```

## Success Criteria
- [ ] Test suites created for all major functionality
- [ ] Schema validation tests ensure correct structure
- [ ] Integration tests cover end-to-end workflows  
- [ ] Error handling tests prevent crashes
- [ ] Performance tests ensure reasonable response times
- [ ] Regression tests prevent known issues from returning
- [ ] All tests pass after implementing fixes
- [ ] Test runner integrated into development workflow
- [ ] CI smoke test prevents broken deployments

## Files Created
- `/tests/core-functionality.test.js`
- `/tests/schema-validation.test.js`
- `/tests/integration.test.js`
- `/tests/error-handling.test.js`
- `/tests/performance.test.js`
- `/tests/test-helpers.js`
- `/tests/regression.test.js`
- `/tests/ci-smoke-test.sh`

## Benefits
1. **Prevents regressions** - Catches issues before they reach production
2. **Validates fixes** - Ensures schema fixes actually work
3. **Performance monitoring** - Alerts to performance degradation
4. **Error prevention** - Tests edge cases and error conditions
5. **CI/CD integration** - Automated testing in deployment pipeline

## Notes
Testing framework assumes Jest but can be adapted to other frameworks. Test implementation will need to be customized based on actual MCP server setup and deployment environment.