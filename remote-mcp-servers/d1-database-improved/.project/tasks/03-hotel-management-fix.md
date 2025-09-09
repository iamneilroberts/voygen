# Task 3: Hotel Management Tools Investigation (Future)
**Priority**: LOW (Future Enhancement)  
**Status**: DOCUMENTED  
**Estimated Time**: 4-6 hours when prioritized  

## Current Status: DISABLED
Hotel management tools are currently **disabled** and marked for future investigation.

## Root Cause Analysis ✅ COMPLETED
**Investigation Date**: 2025-09-04

### Schema Mismatch Issues Identified:

**hotel_cache table missing columns:**
- `trip_id` (expected by tools but doesn't exist)
- `giata_id` (universal hotel identifier)
- `json` (full hotel data storage)
- `lead_price_amount`, `lead_price_currency` (pricing fields)
- `refundable` (booking policy flag)
- `created_at`, `updated_at` (timestamp fields)

**rooms_cache table missing columns:**
- `trip_id`, `hotel_key`, `site` (linking fields)
- `room_name`, `json` (room data storage) 
- `nightly_rate`, `total_price` (pricing fields)
- `commission_amount`, `commission_percent` (commission data)
- `cancellation_deadline` (booking policy)
- `created_at`, `updated_at` (timestamp fields)

### Tool Handler Issues:
- Tools reference `handleIngestHotels()` etc. but handlers don't exist
- Uses old MCP SDK pattern instead of current architecture
- Switch statement calls non-existent functions

## Tool Functionality & Use Cases

### `ingest_hotels`
- **Purpose**: Cache hotel search results from booking sites (navitrip, trisept, vax)
- **Value**: Avoid repeated API calls, faster hotel comparisons
- **Input**: Trip ID + array of hotel data from booking sites
- **Storage**: Structured hotel data with pricing, location, amenities

### `ingest_rooms` 
- **Purpose**: Cache detailed room options and pricing for specific hotels
- **Value**: Detailed comparison of room types, rates, policies
- **Input**: Hotel key + array of room data with pricing/policies
- **Storage**: Room-level data with commission tracking

### `query_hotels`
- **Purpose**: Search cached hotel data with filters
- **Value**: Fast hotel searches by location, price, rating, commission
- **Features**: Price range filters, refundable options, sorting
- **Output**: Filtered and sorted hotel results

## Decision: DEFER FOR FUTURE IMPLEMENTATION

### Rationale:
1. **Not Critical**: Core travel agent functionality works without hotel caching
2. **Complex Fix**: Requires significant schema changes + handler implementation
3. **Unclear Value**: No evidence these tools are actively used
4. **Resource Focus**: Better to focus on core functionality first

### If Prioritized Later, Implementation Would Require:

#### Phase 1: Schema Updates (2-3 hours)
- Add missing columns to hotel_cache and rooms_cache tables
- Create proper indexes for query performance
- Test schema changes don't break existing functionality

#### Phase 2: Handler Implementation (2-3 hours)
- Implement `handleIngestHotels`, `handleIngestRooms`, `handleQueryHotels`
- Adapt hotel-management.ts code to current MCP architecture
- Add proper error handling and validation

#### Phase 3: Testing & Documentation (1 hour)
- Test full hotel ingestion → query workflow
- Document hotel management features for users
- Create examples of typical hotel search workflows

### 3.2 Option A: Fix Hotel Schema
**If hotel functionality is needed**

#### Fix Migration 001:
```sql
-- Update hotel_cache table to include trip_id if needed
ALTER TABLE hotel_cache ADD COLUMN trip_id INTEGER;
ALTER TABLE hotel_cache ADD COLUMN session_id TEXT;
```

#### Update Hotel Tool Code:
- Fix column references in queries
- Ensure proper foreign key relationships
- Update tool parameter validation

### 3.3 Option B: Remove Hotel Tools (Recommended)
**If hotel functionality is not actively used**

#### Tools to Remove:
```typescript
// Remove from tools array in /src/index.ts
// 'query_hotels',
// 'ingest_hotels', 
// 'ingest_rooms',
// 'optimize_commission',
// 'calculate_trip_commission',
// 'configure_commission_rates',
```

#### Benefits of Removal:
- Eliminates maintenance burden
- Reduces API surface area  
- Focuses on core travel agent functionality
- Can be re-added later if needed

### 3.4 Clean Up Hotel-Related Tables
**If removing hotel functionality**

#### Optional Migration 009:
```sql
'009_remove_hotel_tables.sql': `
  -- 009_remove_hotel_tables.sql
  -- Purpose: Clean up unused hotel cache tables
  
  BEGIN TRANSACTION;
  
  DROP TABLE IF EXISTS rooms_cache;
  DROP TABLE IF EXISTS hotel_cache;
  DROP TABLE IF EXISTS commission_rates;
  DROP TABLE IF EXISTS commission_rules;
  
  COMMIT;
`
```

### 3.5 Alternative: Minimal Hotel Fix
**Middle ground approach**

#### Keep Minimal Hotel Support:
- Fix only the schema mismatch
- Keep basic hotel cache functionality
- Remove complex commission/optimization logic
- Focus on simple hotel storage/retrieval

## Decision Matrix

| Option | Effort | Risk | Benefit |
|--------|---------|------|---------|
| **Fix Full Hotel System** | High (4h) | Medium | Full functionality |
| **Remove Hotel Tools** | Low (1h) | Low | Clean, focused system |
| **Minimal Hotel Fix** | Medium (2h) | Low | Basic hotel support |

## Recommended Approach: Remove Hotel Tools

### Justification:
1. **No evidence of active use** in audit
2. **High maintenance cost** for complex hotel/commission logic
3. **Core travel agent functionality doesn't require it**
4. **Can focus resources on essential tools**
5. **Can be re-added later if needed**

## Success Criteria
- [ ] Hotel schema issues investigated and documented
- [ ] Decision made on fix vs remove approach
- [ ] Implementation completed (fix or removal)
- [ ] No hotel-related errors in tool execution
- [ ] Tool list updated to reflect final state
- [ ] Changes tested and deployed

## Files Modified
- `/src/index.ts` - Remove hotel tools from array
- `/src/database/migrations.ts` - Optional cleanup migration
- `/src/tools/hotel-management.ts` - Remove or fix
- `/src/tools/commission-system.ts` - Remove or fix

## Notes
Recommend **removal** unless hotel functionality is actively used by travel agents. This follows the audit recommendation to focus on core functionality.