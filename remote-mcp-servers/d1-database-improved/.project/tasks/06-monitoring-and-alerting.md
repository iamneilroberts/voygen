# Task 6: Monitoring and Alerting (1.5 hours)
**Priority**: LOW  
**Status**: TODO  
**Estimated Time**: 1.5 hours  

## Objective
Add monitoring for schema drift and system health to prevent future issues from accumulating undetected.

## Implementation Steps

### 6.1 Schema Drift Detection
**File**: `/src/monitoring/schema-monitor.ts`

```typescript
export interface SchemaIssue {
  table: string;
  issue: string;
  severity: 'warning' | 'error';
  detected_at: string;
}

export async function detectSchemaDrift(env: Env): Promise<SchemaIssue[]> {
  const issues: SchemaIssue[] = [];
  
  // Check 1: Verify trip_facts has INTEGER trip_id
  const tripFactsSchema = await env.DB.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='trip_facts'
  `).first();
  
  if (tripFactsSchema && !tripFactsSchema.sql.includes('trip_id INTEGER')) {
    issues.push({
      table: 'trip_facts',
      issue: 'trip_id should be INTEGER not TEXT',
      severity: 'error',
      detected_at: new Date().toISOString()
    });
  }
  
  // Check 2: Verify foreign key references use v2 tables
  const foreignKeys = await env.DB.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND sql LIKE '%REFERENCES Trips%'
  `).all();
  
  if (foreignKeys.results.length > 0) {
    issues.push({
      table: 'multiple',
      issue: 'Foreign keys reference old "Trips" table instead of "trips_v2"',
      severity: 'error',
      detected_at: new Date().toISOString()
    });
  }
  
  // Check 3: Verify triggers use correct table names
  const badTriggers = await env.DB.prepare(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='trigger' AND sql LIKE '%ON Trips %'
  `).all();
  
  if (badTriggers.results.length > 0) {
    issues.push({
      table: 'triggers',
      issue: 'Triggers reference old "Trips" table instead of "trips_v2"',
      severity: 'error',
      detected_at: new Date().toISOString()
    });
  }
  
  return issues;
}
```

### 6.2 Health Monitoring Tool
**File**: `/src/tools/health-monitoring.ts`

```typescript
export async function runHealthMonitoring(env: Env) {
  const results = {
    timestamp: new Date().toISOString(),
    overall_health: 'unknown' as 'healthy' | 'warning' | 'error',
    checks: [] as any[],
    recommendations: [] as string[]
  };
  
  // Schema checks
  const schemaIssues = await detectSchemaDrift(env);
  results.checks.push({
    category: 'schema_drift',
    status: schemaIssues.length === 0 ? 'healthy' : 'error',
    issues_found: schemaIssues.length,
    details: schemaIssues
  });
  
  // Data integrity checks
  const dataCheck = await checkDataIntegrity(env);
  results.checks.push({
    category: 'data_integrity',
    status: dataCheck.issues.length === 0 ? 'healthy' : 'warning',
    issues_found: dataCheck.issues.length,
    details: dataCheck.issues
  });
  
  // Performance checks
  const perfCheck = await checkPerformance(env);
  results.checks.push({
    category: 'performance',
    status: perfCheck.response_time < 1000 ? 'healthy' : 'warning',
    response_time: perfCheck.response_time
  });
  
  // Determine overall health
  const hasErrors = results.checks.some(c => c.status === 'error');
  const hasWarnings = results.checks.some(c => c.status === 'warning');
  
  results.overall_health = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';
  
  // Generate recommendations
  if (schemaIssues.length > 0) {
    results.recommendations.push('Run migration 008 to fix schema issues');
  }
  if (dataCheck.orphaned_records > 0) {
    results.recommendations.push('Clean up orphaned records');
  }
  
  return results;
}
```

### 6.3 Automated Health Reporting
**Add to existing tools array in `/src/index.ts`**:

```typescript
{
  name: 'system_health_report',
  description: 'Generate comprehensive system health report including schema drift detection, data integrity checks, and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      include_details: {
        type: 'boolean',
        description: 'Include detailed diagnostic information',
        default: false
      }
    }
  }
}
```

Handler:
```typescript
case 'system_health_report': {
  const includeDetails = request.params.arguments?.include_details || false;
  const health = await runHealthMonitoring(env);
  
  return {
    content: [{
      type: 'text',
      text: `# System Health Report
Generated: ${health.timestamp}
Overall Status: **${health.overall_health.toUpperCase()}**

## Check Results:
${health.checks.map(check => `
### ${check.category}: ${check.status.toUpperCase()}
${check.issues_found > 0 ? `Issues Found: ${check.issues_found}` : 'No issues detected'}
${includeDetails && check.details ? JSON.stringify(check.details, null, 2) : ''}
`).join('\n')}

## Recommendations:
${health.recommendations.map(r => `- ${r}`).join('\n')}

${health.overall_health !== 'healthy' ? '⚠️ **Action Required**: System issues detected that may affect functionality.' : '✅ **System Healthy**: All checks passed.'}
`
    }]
  };
}
```

### 6.4 Startup Health Check
**File**: `/src/startup/health-check.ts`

```typescript
export async function runStartupHealthCheck(env: Env) {
  console.log('🔍 Running startup health check...');
  
  const health = await runHealthMonitoring(env);
  
  if (health.overall_health === 'error') {
    console.error('❌ Critical health issues detected:');
    health.checks
      .filter(c => c.status === 'error')
      .forEach(check => {
        console.error(`  - ${check.category}: ${check.issues_found} issues`);
      });
    console.error('⚠️  System may not function correctly until issues are resolved');
  } else if (health.overall_health === 'warning') {
    console.warn('⚠️  Health warnings detected:');
    health.checks
      .filter(c => c.status === 'warning')
      .forEach(check => {
        console.warn(`  - ${check.category}: ${check.issues_found} issues`);
      });
  } else {
    console.log('✅ System health check passed');
  }
  
  return health;
}
```

Integrate into server startup:
```typescript
// In main server file
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Run health check on first request (or periodically)
    if (!globalThis.healthCheckRun) {
      await runStartupHealthCheck(env);
      globalThis.healthCheckRun = true;
    }
    
    // ... rest of server logic
  }
}
```

### 6.5 Error Tracking and Alerting
**File**: `/src/monitoring/error-tracker.ts`

```typescript
export async function logError(env: Env, error: {
  tool: string;
  error_message: string;
  stack_trace?: string;
  request_params?: any;
}) {
  const errorLog = {
    ...error,
    timestamp: new Date().toISOString(),
    session_id: crypto.randomUUID()
  };
  
  // Store in database for analysis
  await env.DB.prepare(`
    INSERT INTO error_logs (tool, error_message, stack_trace, request_params, timestamp, session_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    error.tool,
    error.error_message,
    error.stack_trace || null,
    error.request_params ? JSON.stringify(error.request_params) : null,
    errorLog.timestamp,
    errorLog.session_id
  ).run();
  
  // Check if this is a pattern (same error multiple times)
  const recentSimilar = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM error_logs 
    WHERE tool = ? AND error_message = ? 
    AND timestamp > datetime('now', '-1 hour')
  `).bind(error.tool, error.error_message).first();
  
  if (recentSimilar.count > 3) {
    console.error(`🚨 Error pattern detected: ${error.tool} - ${error.error_message} (${recentSimilar.count} times in last hour)`);
  }
}
```

### 6.6 Create Error Logs Table Migration
**Add to migrations.ts**:

```sql
'010_error_logging.sql': `
  -- 010_error_logging.sql
  -- Purpose: Error tracking and monitoring
  
  BEGIN TRANSACTION;
  
  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_params TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    resolved_at DATETIME
  );
  
  CREATE INDEX IF NOT EXISTS idx_error_logs_tool ON error_logs(tool);
  CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_error_logs_message ON error_logs(error_message);
  
  COMMIT;
`
```

### 6.7 Monitoring Dashboard Tool
**Add tool for analyzing system health trends**:

```typescript
{
  name: 'monitoring_dashboard',
  description: 'View system health trends, error patterns, and performance metrics over time',
  inputSchema: {
    type: 'object',
    properties: {
      time_range: {
        type: 'string',
        enum: ['1hour', '24hours', '7days', '30days'],
        default: '24hours'
      }
    }
  }
}
```

## Success Criteria
- [ ] Schema drift detection implemented and working
- [ ] Health monitoring runs automatically on startup
- [ ] System health report tool available to LLM
- [ ] Error logging captures and patterns detect issues
- [ ] Performance monitoring tracks response times
- [ ] Monitoring dashboard provides trend analysis
- [ ] Integration with existing diagnostic tools
- [ ] Alerts generated for critical issues
- [ ] Documentation for monitoring features

## Files Modified/Created
- `/src/monitoring/schema-monitor.ts` - Schema drift detection
- `/src/tools/health-monitoring.ts` - Health check tools
- `/src/startup/health-check.ts` - Startup health validation
- `/src/monitoring/error-tracker.ts` - Error pattern detection
- `/src/index.ts` - Tool registration for monitoring tools
- `/src/database/migrations.ts` - Error logging table

## Benefits
1. **Early Issue Detection** - Catches problems before they cause failures
2. **Pattern Recognition** - Identifies recurring issues automatically  
3. **Performance Tracking** - Monitors system performance over time
4. **Automated Alerts** - Notifies when critical issues arise
5. **Trend Analysis** - Shows system health improvements/degradation
6. **Proactive Maintenance** - Enables preventive maintenance

## Integration with Existing Systems
- Works with smart diagnostic tool (Task 4)
- Complements comprehensive testing (Task 5)
- Uses same database health principles
- Provides ongoing validation of schema fixes

## Notes
This monitoring system prevents the accumulation of issues that led to the current schema problems. It's designed to be lightweight but comprehensive, providing early warning of problems before they impact functionality.