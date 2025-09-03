# Voygen Database Architecture Specification
## Implementation of ChatGPT Database Recommendations

**Document Version**: 1.0  
**Created**: 2025-08-31  
**Project**: Voygen Travel Assistant  
**Author**: Claude Code (System Architect)

---

## Executive Summary

This specification outlines the implementation of database architecture improvements for Voygen based on recommendations from ChatGPT analysis. The primary goal is to create a hybrid database architecture that maintains normalized data for editing while providing fast, denormalized JSON blobs for LLM consumption and UI display.

The proposed changes will transform Voygen into an availability-first travel planning system that leverages real-time hotel data extraction, intelligent commission optimization, and streamlined proposal generation.

**Key Business Value**:
- Reduce proposal generation time from hours to minutes
- Enable real-time availability checking and pricing
- Automate commission calculation and optimization
- Provide fast, flexible querying for complex travel scenarios
- Support multi-site data aggregation (Delta Vacations/Trisept, Navitrip/CPMaxx, VAX)

---

## Current State Analysis

### Existing Architecture
Voygen currently operates with:
- **LibreChat** as the primary AI interface
- **d1-database-improved** MCP server providing database access
- Cloudflare D1 database with travel_assistant schema
- **mcp-chrome** for browser automation and data extraction

### Current Database Schema
The existing schema includes:
- **Clients & Groups**: Basic client management
- **Trips & Planning**: Trip structure with TripDays and TripActivities
- **Accommodations**: Hotel booking records
- **Instructions & Configuration**: Dynamic instruction storage
- **Error Tracking**: Database error logging
- **Web Capture & Research**: Captured web content
- **Delta Vacations Search**: Basic search tracking

### Identified Limitations
1. **No hotel availability caching system**
2. **No room-level pricing data storage**
3. **No commission calculation framework**
4. **No fact-based query optimization**
5. **No multi-site data aggregation**
6. **Limited proposal generation capabilities**

---

## Proposed Database Architecture

### Core Philosophy: Hybrid Normalized + Fact Table

The new architecture implements a "hybrid" approach:
- **Normalized tables** for data entry, editing, and relational integrity
- **Denormalized fact table** with JSON blobs for fast LLM queries and UI display
- **Cached pricing data** for real-time availability checking
- **Trigger-based synchronization** between normalized and denormalized data

### New Schema Components

#### 1. Hotel and Room Caching System

```sql
-- Hotel availability cache
CREATE TABLE hotel_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,                    -- Links to trips.id or search key
  city TEXT,
  giata_id TEXT,                           -- Universal hotel identifier
  site TEXT NOT NULL,                       -- 'navitrip', 'trisept', 'vax'
  json TEXT NOT NULL,                       -- Full hotel JSON document
  lead_price_amount REAL,                   -- Extracted for fast sorting
  lead_price_currency TEXT DEFAULT 'USD',
  refundable BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Room-level pricing cache
CREATE TABLE rooms_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  hotel_key TEXT NOT NULL,                  -- giata_id or site-specific ID
  site TEXT NOT NULL,                       -- 'navitrip', 'trisept', 'vax'
  room_name TEXT,
  json TEXT NOT NULL,                       -- Full room details JSON
  nightly_rate REAL,
  total_price REAL,
  commission_amount REAL,
  commission_percent REAL,
  refundable BOOLEAN DEFAULT 0,
  cancellation_deadline TEXT,               -- Free cancellation until date
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### 2. Trip Fact Table for Fast Queries

```sql
-- Materialized trip facts for fast LLM queries
CREATE TABLE trip_facts (
  trip_id TEXT PRIMARY KEY REFERENCES Trips(trip_id) ON DELETE CASCADE,
  facts TEXT NOT NULL,                      -- Complete JSON snapshot
  lead_price_min REAL,                      -- Cached minimum price for sorting
  total_commission_potential REAL,          -- Total possible commission
  availability_status TEXT DEFAULT 'unknown', -- 'available', 'limited', 'unavailable'
  last_availability_check TEXT,             -- Last time availability was verified
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Trigger support table for dirty tracking
CREATE TABLE facts_dirty (
  trip_id TEXT PRIMARY KEY
);
```

#### 3. Commission Configuration and Tracking

```sql
-- Enhanced commission configuration
CREATE TABLE commission_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,                       -- 'navitrip', 'trisept', 'vax'
  accommodation_type TEXT DEFAULT 'hotel',  -- 'hotel', 'resort', 'villa'
  rate_type TEXT,                          -- 'standard', 'refundable', 'promo'
  commission_percent REAL NOT NULL,
  min_commission_amount REAL DEFAULT 0,
  effective_from TEXT,
  effective_until TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Commission optimization rules
CREATE TABLE commission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,                  -- 'prefer_refundable', 'min_commission', 'max_budget'
  conditions TEXT NOT NULL,                 -- JSON conditions
  priority INTEGER DEFAULT 0,              -- Higher number = higher priority
  active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### 4. Enhanced Trip Structure

```sql
-- Enhanced trip legs for multi-city itineraries
CREATE TABLE trip_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES Trips(trip_id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  city TEXT NOT NULL,
  region TEXT,
  country TEXT,
  arrive_date TEXT NOT NULL,               -- ISO date
  depart_date TEXT NOT NULL,               -- ISO date
  nights INTEGER NOT NULL,
  preferences TEXT,                        -- JSON preferences for this city
  hotel_shortlist_count INTEGER DEFAULT 6, -- Number of hotels to shortlist
  budget_min REAL,
  budget_max REAL,
  style_tags TEXT,                         -- JSON array: ['historic', 'walkable', 'luxury']
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Enhanced trip activities with pricing
CREATE TABLE trip_activities_enhanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES Trips(trip_id) ON DELETE CASCADE,
  trip_leg_id INTEGER REFERENCES trip_legs(id),
  day_index INTEGER NOT NULL,
  date TEXT,                               -- ISO date
  city TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  activity_type TEXT,                      -- 'attraction', 'restaurant', 'transport', 'tour'
  title TEXT,
  description_md TEXT,                     -- Markdown description
  location_name TEXT,
  location_address TEXT,
  location_coordinates TEXT,               -- JSON: {lat, lng}
  start_time TEXT,
  end_time TEXT,
  cost_amount REAL,
  cost_currency TEXT DEFAULT 'USD',
  booking_required BOOLEAN DEFAULT 0,
  booking_url TEXT,
  tags TEXT,                              -- JSON array of tags
  is_hidden_gem BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### 5. Proposal Generation System

```sql
-- Proposal snapshots for version control
CREATE TABLE proposals_enhanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES Trips(trip_id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',    -- 'draft', 'review', 'final', 'sent'
  template_name TEXT DEFAULT 'standard',
  json_payload TEXT NOT NULL,              -- Complete template data
  rendered_html TEXT,                      -- Final rendered HTML
  rendered_pdf_path TEXT,                  -- Path to generated PDF
  images_saved BOOLEAN DEFAULT 0,          -- Images downloaded and saved locally
  total_cost REAL,
  total_commission REAL,
  created_at TEXT DEFAULT (datetime('now')),
  generated_by TEXT                        -- Agent or system identifier
);

-- Image management for proposals
CREATE TABLE proposal_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES proposals_enhanced(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,              -- SHA1 hash for deduplication
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### 6. Site-Specific Extraction Tracking

```sql
-- Track extraction sessions and performance
CREATE TABLE extraction_sessions (
  id TEXT PRIMARY KEY,                     -- UUID
  trip_id TEXT REFERENCES Trips(trip_id),
  session_type TEXT NOT NULL,              -- 'search', 'detail_fetch', 'room_fetch'
  site TEXT NOT NULL,                      -- 'navitrip', 'trisept', 'vax'
  search_params TEXT,                      -- JSON search parameters
  status TEXT DEFAULT 'running',           -- 'running', 'completed', 'failed', 'partial'
  hotels_found INTEGER DEFAULT 0,
  rooms_found INTEGER DEFAULT 0,
  duration_seconds REAL,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Track individual extraction attempts
CREATE TABLE extraction_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES extraction_sessions(id),
  attempt_type TEXT NOT NULL,              -- 'hotel_list', 'hotel_detail', 'room_rates'
  target_url TEXT,
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',           -- 'pending', 'success', 'failed', 'retry'
  response_size INTEGER,
  processing_time_ms INTEGER,
  error_details TEXT,
  retry_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Database Schema Migration

**Priority: Critical**

- Create new tables: `hotel_cache`, `rooms_cache`, `trip_facts`, `commission_rates`
- Implement trigger system for `trip_facts` updates
- Add fact refresh stored procedures

**Deliverables:**
- Migration SQL scripts for all new tables
- Trigger definitions for automatic fact table updates
- Schema validation scripts

**Implementation Steps:**
1. Create migration files in `/remote-mcp-servers/d1-database-improved/migrations/`
2. Update `DatabaseManager` class to handle new tables
3. Add schema validation to MCP server startup
4. Test migration on development database

#### 1.2 MCP Server Tool Extensions

**Priority: Critical**

Add new MCP tools to `d1-database-improved`:
- `ingest_hotels` - Store hotel availability data
- `ingest_rooms` - Store room-level pricing data  
- `refresh_trip_facts` - Trigger fact table updates
- `query_trip_facts` - Fast JSON-based queries
- `optimize_commission` - Apply commission rules

**Implementation Steps:**
1. Create new tool definitions in `/src/tools/hotel-management.ts`
2. Implement handlers with proper error handling and logging
3. Add comprehensive input validation using Zod schemas
4. Update tool registration in main `index.ts`

### Phase 2: Data Extraction Integration (Week 2-3)

#### 2.1 Enhanced Chrome MCP Integration

**Priority: High**

- Implement site-specific extractors for Delta/Trisept, Navitrip, VAX
- Create unified `HotelOption` data structure
- Add extraction session tracking

**Deliverables:**
- Site-specific extraction scripts for `mcp-chrome evaluate`
- Unified data transformation pipeline
- Error handling and retry mechanisms

#### 2.2 Commission Calculation Engine

**Priority: High**

- Implement commission rule engine
- Add refundable vs non-refundable optimization
- Create commission reporting tools

**Implementation Steps:**
1. Create `/src/tools/commission-engine.ts`
2. Implement rule evaluation system
3. Add commission optimization algorithms
4. Create reporting and analytics tools

### Phase 3: Proposal Generation System (Week 3-4)

#### 3.1 Template Rendering Pipeline

**Priority: High**

- Set up Nunjucks template rendering
- Implement image download and caching
- Create PDF generation pipeline (Puppeteer)

**Deliverables:**
- Template rendering system with image optimization
- PDF generation with proper styling
- Version control for proposals

**Implementation Steps:**
1. Create `/src/render/` directory with template system
2. Implement image download and hash-based deduplication
3. Set up Puppeteer for PDF generation
4. Create proposal versioning system

#### 3.2 Availability-First Planning

**Priority: Medium**

- Implement L/M/H hotel selection algorithm
- Create availability checking workflows
- Add real-time pricing updates

### Phase 4: Advanced Features (Week 4-5)

#### 4.1 Intent-Based Query System

**Priority: Medium**

- Create templated query system for common patterns
- Implement fallback to fact table queries
- Add admin ad-hoc SQL interface (dev only)

#### 4.2 Multi-Site Data Aggregation

**Priority: Medium**

- Implement parallel extraction workflows
- Add data quality scoring
- Create conflict resolution for duplicate hotels

---

## Database Migration Strategy

### Migration Approach: Incremental with Rollback Support

#### Step 1: Schema Extension (Non-Breaking)
- Add new tables without modifying existing structure
- Implement new MCP tools alongside existing ones
- Test new functionality in parallel with current system

#### Step 2: Data Population
- Populate new tables from existing data where applicable
- Run fact table generation for all existing trips
- Validate data consistency

#### Step 3: Feature Integration
- Update LibreChat workflows to use new tools
- Implement new proposal generation alongside existing
- Gradual cutover with feature flags

#### Step 4: Legacy Cleanup (Optional)
- Remove unused columns and tables after successful migration
- Optimize indexes for new query patterns
- Archive historical data if needed

### Rollback Plan
- All new tables are independent of existing schema
- New MCP tools don't modify existing functionality
- Can disable new features and revert to current system immediately
- Database triggers can be disabled without affecting core functionality

---

## Risk Assessment and Mitigation

### High-Risk Items

#### 1. Database Performance Impact
**Risk**: New triggers and fact table updates could slow down writes
**Mitigation**: 
- Use async trigger processing where possible
- Implement batch updates for fact tables
- Add database monitoring and performance alerts

#### 2. Data Consistency Issues
**Risk**: Normalized and denormalized data getting out of sync
**Mitigation**:
- Comprehensive trigger testing
- Data validation checkpoints
- Automated consistency checking tools

#### 3. Site Extraction Reliability
**Risk**: Website changes breaking extraction logic
**Mitigation**:
- Robust error handling and fallback mechanisms
- Site monitoring and alert system
- Modular extractor design for easy updates

### Medium-Risk Items

#### 1. Commission Calculation Accuracy
**Risk**: Incorrect commission calculations affecting business
**Mitigation**:
- Extensive testing with real data
- Manual verification workflows
- Audit trail for all calculations

#### 2. Image Storage and Management
**Risk**: Image downloads failing or consuming excessive storage
**Mitigation**:
- Implement storage quotas and cleanup policies
- Use CDN or external storage for production
- Fallback to external URLs if local storage fails

---

## Resource Requirements

### Development Resources
- **Database Developer**: 2-3 weeks for schema design and migrations
- **Backend Developer**: 3-4 weeks for MCP server enhancements
- **Frontend Integration**: 1-2 weeks for LibreChat integration
- **Testing and QA**: 1 week comprehensive testing

### Infrastructure Requirements
- **Additional Database Storage**: ~50-100MB per 1000 trips (including cached hotel data)
- **Image Storage**: ~10-20MB per proposal (if images saved locally)
- **Processing Power**: Minimal increase, mostly I/O bound operations

### Timeline Estimate: 4-5 weeks for full implementation

---

## Success Metrics

### Technical Metrics
- **Query Performance**: Trip fact queries <100ms
- **Extraction Success Rate**: >95% for hotel data extraction
- **Data Accuracy**: <1% variance in commission calculations
- **System Availability**: >99.5% uptime for database operations

### Business Metrics
- **Proposal Generation Time**: Reduce from hours to <30 minutes
- **Commission Optimization**: Increase average commission by 10-15%
- **Agent Productivity**: 3x faster trip planning and proposal creation
- **Data Quality**: Real-time availability checking for >90% of searches

---

## Testing Strategy

### Unit Testing
- Database schema validation
- MCP tool input/output validation
- Commission calculation accuracy
- Data transformation logic

### Integration Testing
- End-to-end extraction workflows
- Fact table update consistency
- Proposal generation pipeline
- Cross-site data aggregation

### Performance Testing
- Database query performance under load
- Fact table update timing
- Image processing and storage
- Concurrent extraction sessions

### User Acceptance Testing
- Agent workflow validation
- Proposal quality assessment
- Commission calculation verification
- System reliability under normal usage

---

## Monitoring and Maintenance

### Automated Monitoring
- Database performance metrics
- Extraction success/failure rates
- Commission calculation accuracy
- Storage usage and cleanup

### Regular Maintenance Tasks
- Fact table consistency checks
- Image storage cleanup
- Database statistics updates
- Site extractor validation

### Alert Conditions
- Database query performance degradation
- Extraction failure rates >5%
- Storage usage >80% of allocated
- Data consistency violations

---

## Conclusion

This specification provides a comprehensive roadmap for implementing the ChatGPT database recommendations in Voygen. The hybrid architecture approach balances the need for normalized data integrity with the performance requirements of LLM-based queries and rapid proposal generation.

The phased implementation plan allows for gradual rollout while maintaining system stability. The risk mitigation strategies address the main concerns around performance, consistency, and reliability.

Upon successful implementation, Voygen will transform from a basic trip planning tool into a sophisticated, availability-first travel assistant capable of real-time data aggregation, intelligent commission optimization, and rapid proposal generation.

**Next Steps:**
1. Review and approve this specification
2. Begin Phase 1 implementation with database schema migration
3. Set up development environment for testing new features
4. Establish monitoring and success metrics tracking

---

**Document Status**: Ready for Implementation  
**Last Updated**: 2025-08-31  
**File Path**: `/home/neil/dev/voygen/.project/specs/database-architecture-specification.md`