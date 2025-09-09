# Task 2: Tool Audit and Cleanup (2 hours)
**Priority**: HIGH  
**Status**: TODO  
**Estimated Time**: 2 hours  

## Objective
Test all workflow tools, remove/disable broken tools, and document final working tool set.

## Implementation Steps

### 2.1 Test Workflow Tools Status
**Action**: Test each workflow tool to determine functionality

#### Test List:
- [ ] `advance_workflow_phase` - Test with sample trip
- [ ] `set_workflow_step` - Test step progression  
- [ ] `get_workflow_status` - Verify status retrieval
- [ ] `initialize_workflow` - Test workflow initialization
- [ ] `get_workflow_instructions` - Test instruction retrieval

#### Test Script:
```bash
# Test workflow tools with "Hawaii Paradise Vacation" trip
mcp__d1-database__initialize_workflow trip_identifier="Hawaii Paradise Vacation"
mcp__d1-database__get_workflow_status trip_identifier="Hawaii Paradise Vacation"
mcp__d1-database__advance_workflow_phase trip_identifier="Hawaii Paradise Vacation" new_phase="planning"
```

### 2.2 Disable Broken Tools Temporarily
**File**: `/src/index.ts`
**Action**: Comment out broken tools from the tools array

#### Tools to Disable:
```typescript
// TEMPORARILY DISABLED - Schema Issues
// 'refresh_trip_facts',
// 'mark_facts_dirty', 
// 'query_trip_facts',
// 'query_hotels',
// 'ingest_hotels',
// 'ingest_rooms',
```

### 2.3 Remove Non-Working Repair Tools
**Action**: Remove or fix repair tools that aren't routing correctly

#### Tools to Address:
- `comprehensive_schema_fix` - Fix routing or remove
- `repair_trip_facts_schema` - Fix routing or remove  
- `analyze_foreign_key_issues` - Fix routing or remove

### 2.4 Test Commission Tools
**Action**: Determine if commission tools are actually used

#### Test Commission Tools:
- [ ] `configure_commission_rates` - Test configuration
- [ ] `optimize_commission` - Test optimization logic
- [ ] `calculate_trip_commission` - Test calculation

**Decision**: If not used by travel agents, remove from tool list.

### 2.5 Document Final Core Tool Set
**Action**: Create definitive list of working tools

#### Core Tool Categories:

**✅ ESSENTIAL (Must Work)**:
```
health_check - System monitoring
get_anything - Primary search interface  
create_trip_with_client - Combined trip/client creation
get_recent_activities - /continue workflow support
continue_trip - Resume previous work
```

**🔧 MAINTENANCE (Keep)**:
```
explore_database - Debugging
update_activitylog_clients - Data integrity
reset_activitylog_from_trips - Migration support
cleanup_duplicate_clients - Utility
cleanup_duplicate_trips - Utility
```

**📋 WORKFLOW (Test Results Dependent)**:
```
advance_workflow_phase - If working
get_workflow_status - If working  
initialize_workflow - If working
set_workflow_step - If working
```

**❌ DISABLED (Until Fixed)**:
```
refresh_trip_facts - Schema issues
mark_facts_dirty - Schema issues
query_trip_facts - Schema issues
query_hotels - Column reference issues
ingest_hotels - Schema issues
ingest_rooms - Schema issues
```

## Success Criteria
- [ ] All workflow tools tested and status documented
- [ ] Broken tools disabled in code
- [ ] Non-working repair tools removed/fixed
- [ ] Commission tools evaluated (keep or remove)
- [ ] Final tool set documented (~10-15 reliable tools)
- [ ] Updated tool list deployed and tested

## Files Modified
- `/src/index.ts` - Tool array and routing
- `/src/tools/` - Individual tool files as needed
- Documentation files with final tool set

## Deliverables
1. **Tool Test Results** - Status of each workflow tool
2. **Updated Tool List** - Clean list of working tools only
3. **Deployment** - Updated server with clean tool set