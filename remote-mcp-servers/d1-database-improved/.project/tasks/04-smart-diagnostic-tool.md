# Task 4: Smart Diagnostic Tool (2 hours)
**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Time**: 2 hours  

## Objective
Create ONE smart diagnostic/repair tool that detects issues and provides clear reporting to the LLM, replacing the complex repair tools that don't work.

## Design Philosophy
- **Detect, don't auto-fix** - Report issues clearly to LLM
- **Proactive detection** - Run checks on startup/demand  
- **Safe operations only** - No risky automated repairs
- **Clear actionable reports** - Tell LLM exactly what's wrong and how to fix it

## Implementation Steps

### 4.1 Create Smart Diagnostic Tool
**File**: `/src/tools/smart-diagnostics.ts`

```typescript
export interface DiagnosticResult {
  status: 'healthy' | 'warning' | 'error';
  category: string;
  issue: string;
  impact: string;
  recommendation: string;
  canAutoFix: boolean;
  sqlFix?: string;
}

export async function runComprehensiveDiagnostics(env: Env): Promise<{
  summary: string;
  issues: DiagnosticResult[];
  healthScore: number;
}> {
  const issues: DiagnosticResult[] = [];
  
  // Check 1: Schema consistency
  await checkSchemaConsistency(env, issues);
  
  // Check 2: Foreign key constraints
  await checkForeignKeyIntegrity(env, issues);
  
  // Check 3: Orphaned data
  await checkOrphanedRecords(env, issues);
  
  // Check 4: Trigger functionality
  await checkTriggerHealth(env, issues);
  
  // Check 5: Table row counts
  await checkDataConsistency(env, issues);
  
  return {
    summary: generateSummary(issues),
    issues,
    healthScore: calculateHealthScore(issues)
  };
}
```

### 4.2 Implement Specific Diagnostic Checks

#### Schema Consistency Check:
```typescript
async function checkSchemaConsistency(env: Env, issues: DiagnosticResult[]) {
  // Check if trip_facts exists with correct schema
  // Check if facts_dirty has INTEGER trip_id
  // Check if foreign keys reference correct tables
  
  const schema = await env.DB.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name IN ('trip_facts', 'facts_dirty')
  `).all();
  
  // Analyze schema and add issues if found
}
```

#### Foreign Key Integrity Check:
```typescript
async function checkForeignKeyIntegrity(env: Env, issues: DiagnosticResult[]) {
  // Check for constraint violations
  // Test foreign key relationships
  // Identify broken references
}
```

#### Orphaned Data Check:
```typescript
async function checkOrphanedRecords(env: Env, issues: DiagnosticResult[]) {
  // Find records with invalid foreign keys
  // Identify data that should be cleaned up
  // Report but don't auto-delete
}
```

### 4.3 Add Tool Registration
**File**: `/src/index.ts`

Add to tools array:
```typescript
{
  name: 'diagnose_database_health',
  description: 'Run comprehensive database diagnostics to identify schema issues, constraint problems, and data integrity issues. Provides actionable recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      run_deep_checks: {
        type: 'boolean', 
        description: 'Run detailed checks (slower but more thorough)',
        default: false
      }
    }
  }
}
```

Add handler:
```typescript
case 'diagnose_database_health': {
  const deepChecks = request.params.arguments?.run_deep_checks || false;
  const result = await runComprehensiveDiagnostics(env);
  
  return {
    content: [{
      type: 'text',
      text: `# Database Health Diagnostics

${result.summary}

## Health Score: ${result.healthScore}/100

## Issues Found:
${result.issues.map(issue => `
### ${issue.category}: ${issue.status.toUpperCase()}
**Issue**: ${issue.issue}
**Impact**: ${issue.impact}
**Recommendation**: ${issue.recommendation}
${issue.canAutoFix ? '**Auto-fixable**: Yes' : '**Requires manual intervention**'}
${issue.sqlFix ? `**SQL Fix**:\n\`\`\`sql\n${issue.sqlFix}\n\`\`\`` : ''}
`).join('\n')}

## Next Steps
1. Address ERROR level issues first
2. Fix WARNING level issues when convenient  
3. Re-run diagnostics after fixes to confirm resolution
`
    }]
  };
}
```

### 4.4 Remove Old Repair Tools
**Action**: Remove the non-working repair tools

#### Tools to Remove:
- `comprehensive_schema_fix`
- `repair_trip_facts_schema`  
- `analyze_foreign_key_issues`

### 4.5 Add Startup Health Check
**Optional Enhancement**: Add automatic health check on server startup

```typescript
// In server initialization
console.log('Running startup diagnostics...');
const health = await runComprehensiveDiagnostics(env);
if (health.healthScore < 80) {
  console.warn('Database health issues detected:', health.summary);
}
```

## Tool Design Principles

### What It DOES:
- ✅ Detects schema issues accurately
- ✅ Reports foreign key problems  
- ✅ Identifies orphaned data
- ✅ Provides clear recommendations
- ✅ Shows LLM exactly what to fix
- ✅ Includes SQL fixes where safe

### What It DOESN'T Do:
- ❌ Auto-fix complex schema issues
- ❌ Delete data without explicit instruction
- ❌ Make risky structural changes
- ❌ Patch symptoms instead of root causes

## Success Criteria
- [ ] Smart diagnostic tool created and working
- [ ] Detects the known schema issues (trip_facts INTEGER problem)
- [ ] Provides clear, actionable recommendations
- [ ] LLM can understand and act on diagnostic output
- [ ] Old broken repair tools removed
- [ ] Tool integrated into main tool set
- [ ] Diagnostic runs without errors
- [ ] Health score calculation works correctly

## Files Modified
- `/src/tools/smart-diagnostics.ts` - New diagnostic tool
- `/src/index.ts` - Tool registration and routing
- Remove old repair tool files

## Example Output
```
# Database Health Diagnostics
Found 3 critical issues affecting trip facts generation and 1 warning.

## Health Score: 65/100

## Issues Found:

### Schema Integrity: ERROR
**Issue**: trip_facts.trip_id is TEXT but should be INTEGER
**Impact**: Foreign key constraints fail, trip facts cannot be generated  
**Recommendation**: Run migration 008 to recreate tables with correct schema
**SQL Fix**:
```sql
DROP TABLE trip_facts;
CREATE TABLE trip_facts (trip_id INTEGER PRIMARY KEY, ...);
```
```

This gives the LLM exactly what it needs to understand and fix issues.