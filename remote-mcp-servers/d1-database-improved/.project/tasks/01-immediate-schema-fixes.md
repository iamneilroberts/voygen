# Task 1: Immediate Schema Fixes (30 mins)
**Priority**: CRITICAL  
**Status**: TODO  
**Estimated Time**: 30 minutes  

## Objective
Fix the root cause schema issues identified in migration 002 that are preventing trip facts generation.

## Root Cause Analysis
- Migration 002 created `trip_facts` and `facts_dirty` tables with TEXT trip_id instead of INTEGER
- Foreign key references point to old `Trips` table instead of `trips_v2`
- All triggers reference old table names

## Implementation Steps

### 1.1 Create Migration 008 - Facts Schema Fix
**File**: `/src/database/migrations.ts`
**Action**: Add new migration to fix facts tables

```sql
'008_fix_facts_schema_final.sql': `
  -- 008_fix_facts_schema_final.sql
  -- Purpose: Fix trip facts schema with correct INTEGER trip_id and v2 table references
  
  BEGIN TRANSACTION;
  
  -- Drop existing broken tables (safe since they're not working)
  DROP TABLE IF EXISTS trip_facts;
  DROP TABLE IF EXISTS facts_dirty;
  
  -- Recreate with correct schema
  CREATE TABLE trip_facts (
    trip_id INTEGER PRIMARY KEY,
    total_nights INTEGER DEFAULT 0,
    total_hotels INTEGER DEFAULT 0,
    total_activities INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    transit_minutes INTEGER DEFAULT 0,
    last_computed DATETIME,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
  );
  
  CREATE TABLE facts_dirty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
    UNIQUE(trip_id, reason, created_at)
  );
  
  CREATE INDEX idx_facts_dirty_trip ON facts_dirty(trip_id);
  CREATE INDEX idx_trip_facts_computed ON trip_facts(last_computed);
  
  -- Recreate triggers with correct table references
  DROP TRIGGER IF EXISTS trg_trips_ai_dirty;
  DROP TRIGGER IF EXISTS trg_trips_au_dirty;
  DROP TRIGGER IF EXISTS trg_trips_ad_dirty;
  DROP TRIGGER IF EXISTS trg_tripdays_ai_dirty;
  DROP TRIGGER IF EXISTS trg_tripdays_au_dirty;
  DROP TRIGGER IF EXISTS trg_tripdays_ad_dirty;
  DROP TRIGGER IF EXISTS trg_activitylog_ai_dirty;
  DROP TRIGGER IF EXISTS trg_activitylog_au_dirty;
  DROP TRIGGER IF EXISTS trg_activitylog_ad_dirty;
  
  CREATE TRIGGER trg_trips_v2_ai_dirty
  AFTER INSERT ON trips_v2
  BEGIN
    INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_insert');
  END;
  
  CREATE TRIGGER trg_trips_v2_au_dirty
  AFTER UPDATE ON trips_v2
  BEGIN
    INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'trip_update');
  END;
  
  CREATE TRIGGER trg_trips_v2_ad_dirty
  AFTER DELETE ON trips_v2
  BEGIN
    INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'trip_delete');
  END;
  
  COMMIT;
`
```

### 1.2 Update Fact Management Code References
**File**: `/src/tools/fact-management.ts` (if exists)
**Action**: Ensure all code references use trips_v2, not Trips

### 1.3 Test Basic Trip Facts Generation
**Action**: Deploy and test with known trip
- Use `refresh_trip_facts` on Hawaii Paradise Vacation
- Verify no FOREIGN KEY constraint failures
- Confirm facts are generated properly

## Success Criteria
- [x] Migration 008 created and added to migrations.ts
- [ ] Migration deploys without errors
- [ ] `refresh_trip_facts` works without constraint failures
- [ ] Hawaii Paradise Vacation facts generate successfully
- [ ] No "SQLITE_CONSTRAINT" errors in logs

## Files Modified
- `/src/database/migrations.ts` - Add migration 008
- Any fact management tool files with table references

## Notes
This fixes the fundamental root cause rather than patching symptoms.