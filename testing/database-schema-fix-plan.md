# Database Schema Fix Plan
**Date**: 2025-09-04  
**Status**: CRITICAL - Systematic schema inconsistencies causing constraint failures  
**Environment**: d1-database MCP server (remote Cloudflare Workers)

## Executive Summary

The database migration testing revealed **systematic schema inconsistencies** across 7+ core tables causing foreign key constraint failures and "Unknown tool" errors. The root cause is incomplete migration from v1 to v2 schema with mixed data types and wrong table references throughout the codebase.

## Root Cause Analysis

### Primary Issues Identified:

1. **Incomplete Schema Migration**: 
   - v2 tables (trips_v2, clients_v2) exist alongside old v1 references in code
   - Many tables still reference non-existent v1 tables (Trips, Clients)

2. **Data Type Inconsistencies**:
   - Critical mismatch: `facts_dirty.trip_id` (TEXT) vs `trips_v2.trip_id` (INTEGER)
   - Similar issues across multiple relationship tables

3. **Foreign Key Misalignment**:
   - Old foreign key references pointing to dropped v1 tables
   - Type casting issues preventing proper joins

4. **Code Reference Problems**:
   - Multiple source files still reference old table names
   - MCP tool registrations missing or incorrect

## Critical Impact Assessment

### **CRITICAL Priority** (System Breaking):
- ❌ **trip_facts generation FAILING** (foreign key constraints)
- ❌ **Hawaii Paradise Vacation test FAILING** (ID type mismatch)
- ❌ **facts_dirty processing BLOCKED** (TEXT → INTEGER conversion)

### **HIGH Priority** (Functionality Impaired):
- 🟡 **Client-trip relationships** may have similar issues
- 🟡 **Activity logging** potentially inconsistent
- 🟡 **Workflow tracking** may have constraint failures

## Affected Tables Analysis

| Table | Issue Type | Severity | Status |
|-------|------------|----------|---------|
| **trip_facts** | Foreign key + data type | CRITICAL | ✅ FIXED |
| **facts_dirty** | Data type mismatch | CRITICAL | ❌ PENDING |
| **TripParticipants** | Foreign key references | CRITICAL | ❌ PENDING |
| **TripDays** | Schema inconsistency | HIGH | ❌ PENDING |
| **ActivityLog** | Reference mismatches | HIGH | ❌ PENDING |
| **TripActivities** | Type mismatches | MEDIUM | ❌ PENDING |
| **TripCosts** | Foreign key issues | MEDIUM | ❌ PENDING |

## Detailed Fix Specifications

### **Phase 1: Critical Constraint Fixes**

#### **Fix 1: facts_dirty Table Schema**
```sql
-- Current Issue: facts_dirty.trip_id is TEXT but needs INTEGER
-- Location: Database schema
-- Impact: Blocking all trip facts generation

-- Solution:
ALTER TABLE facts_dirty 
ALTER COLUMN trip_id TYPE INTEGER USING trip_id::INTEGER;

-- Alternative if ALTER not supported in D1:
CREATE TABLE facts_dirty_new (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips_v2(trip_id),
    reason TEXT,
    created_at DATETIME
);

INSERT INTO facts_dirty_new (trip_id, reason, created_at)
SELECT CAST(trip_id AS INTEGER), reason, created_at 
FROM facts_dirty 
WHERE trip_id REGEXP '^[0-9]+$';

DROP TABLE facts_dirty;
ALTER TABLE facts_dirty_new RENAME TO facts_dirty;
```

#### **Fix 2: TripParticipants Foreign Keys**
```sql
-- Current Issue: References non-existent Clients table
-- Location: TripParticipants schema

-- Check current schema
PRAGMA foreign_key_list(TripParticipants);

-- Drop and recreate with correct references
DROP TABLE IF EXISTS TripParticipants;
CREATE TABLE TripParticipants (
    trip_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    role TEXT DEFAULT 'traveler',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, client_id),
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients_v2(client_id) ON DELETE CASCADE
);
```

#### **Fix 3: TripDays Schema Alignment**
```sql
-- Current Issue: trip_id is TEXT but should be INTEGER
-- Location: TripDays table

ALTER TABLE TripDays 
ALTER COLUMN trip_id TYPE INTEGER USING trip_id::INTEGER;

-- Add proper foreign key if missing
ALTER TABLE TripDays 
ADD CONSTRAINT fk_tripdays_trip 
FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE;
```

### **Phase 2: Code Reference Updates**

#### **File: fact-management.ts** ✅ COMPLETED
- [x] Updated table references from `Trips` to `trips_v2`
- [x] Added proper type casting for INTEGER/TEXT handling
- [x] Fixed parameter binding with parseInt() conversions

#### **File: Activity Logging Components**
```typescript
// Files to update:
// - /src/database/activity-logger.ts
// - /src/tools/activity-management.ts

// Current problematic references:
const oldQuery = `INSERT INTO ActivityLog (...) SELECT ... FROM Trips WHERE ...`;

// Fixed references:
const newQuery = `INSERT INTO ActivityLog (...) SELECT ... FROM trips_v2 WHERE ...`;
```

#### **File: Participant Management**
```typescript
// Update participant assignment logic
// Current: References old Clients table
// Fix: Reference clients_v2 with proper type casting

const updateParticipantQuery = `
  INSERT INTO TripParticipants (trip_id, client_id, role)
  SELECT t.trip_id, c.client_id, 'traveler'
  FROM trips_v2 t
  JOIN clients_v2 c ON c.email = ?
  WHERE t.trip_id = ?
`;
```

### **Phase 3: Data Integrity Restoration**

#### **Migration Script: Restore Missing Data**
```sql
-- Fix orphaned ActivityLog entries
UPDATE ActivityLog 
SET trip_id = (
  SELECT trip_id FROM trips_v2 
  WHERE trip_name = (
    SELECT trip_name FROM old_activity_references 
    WHERE old_trip_id = ActivityLog.trip_id
  )
)
WHERE trip_id NOT IN (SELECT trip_id FROM trips_v2);

-- Clean up invalid facts_dirty entries
DELETE FROM facts_dirty 
WHERE trip_id NOT REGEXP '^[0-9]+$' 
   OR CAST(trip_id AS INTEGER) NOT IN (SELECT trip_id FROM trips_v2);
```

## Implementation Strategy

### **Deployment Sequence**

#### **Step 1: Database Schema Fixes** (30 mins)
1. Backup current database state
2. Apply facts_dirty schema fix
3. Update TripParticipants table
4. Fix TripDays foreign keys
5. Validate schema consistency

#### **Step 2: Code Deployment** (15 mins)
1. Deploy updated fact-management.ts (already done)
2. Deploy activity logging fixes
3. Deploy participant management updates
4. Test MCP server restart

#### **Step 3: Data Migration** (20 mins)
1. Run data integrity restoration scripts
2. Clear facts_dirty table and regenerate
3. Validate all foreign key constraints
4. Test trip facts generation

#### **Step 4: Validation Testing** (15 mins)
1. Re-run Test 7 (trip facts validation)
2. Test Hawaii Paradise Vacation trip facts
3. Verify all constraint failures resolved
4. Confirm MCP tools operational

### **Rollback Plan**
```sql
-- If issues occur, restore from backup
-- Keep backup of working trip_facts data
-- Staged rollback per table if needed
```

## Success Metrics

### **Before Fix**:
- ❌ trip_facts generation: 0% success rate
- ❌ facts_dirty processing: BLOCKED
- ❌ Foreign key constraints: Multiple failures
- ❌ Test 7 status: FAILED

### **After Fix** (Target):
- ✅ trip_facts generation: 100% success rate
- ✅ facts_dirty processing: All records processed
- ✅ Foreign key constraints: All resolved
- ✅ Test 7 status: PASSED
- ✅ Hawaii Paradise Vacation: Facts generated successfully

## Monitoring and Prevention

### **Post-Fix Monitoring**:
1. Add database constraint validation checks
2. Create automated schema consistency tests
3. Implement type safety in MCP tool parameters
4. Add foreign key relationship validation

### **Prevention Measures**:
1. **Schema Change Protocol**: All schema changes must include migration scripts
2. **Type Consistency Checks**: Automated validation of ID field types
3. **Foreign Key Validation**: Regular constraint integrity checks
4. **Code Review Requirements**: All database queries must reference v2 tables

## Risk Assessment

### **High Risk** (Immediate Action Required):
- Database constraint failures preventing core functionality
- Data integrity issues with trip-client relationships
- System instability due to schema inconsistencies

### **Medium Risk**:
- Performance degradation from type casting
- Temporary data unavailability during migration
- Potential data loss if migration fails

### **Mitigation**:
- Full database backup before changes
- Staged deployment with rollback capability
- Comprehensive testing at each phase

## Timeline

**Total Estimated Time**: 80 minutes
- **Preparation**: 10 minutes (backup, validation)
- **Schema Fixes**: 30 minutes
- **Code Deployment**: 15 minutes  
- **Data Migration**: 20 minutes
- **Testing & Validation**: 15 minutes

## Approval Required

This fix plan addresses **CRITICAL** system-breaking issues. Immediate implementation recommended to restore:
- Trip facts generation functionality
- Database constraint integrity
- Test suite validation capability
- Production system stability

**Next Action**: Execute Phase 1 (Critical Constraint Fixes) immediately.