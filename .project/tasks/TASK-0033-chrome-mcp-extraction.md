# Task: Enhanced Chrome MCP Data Extraction
**Phase**: 2 - Data Extraction Integration  
**Priority**: High  
**Duration**: 3-4 days  
**Dependencies**: phase1-2-mcp-server-tools  

## Objective
Implement site-specific extractors for Delta/Trisept, Navitrip, and VAX using the mcp-chrome browser automation system.

## Deliverables
- [ ] Site-specific extraction scripts
- [ ] Unified HotelOption data structure
- [ ] Extraction session tracking
- [ ] Error handling and retry mechanisms

## Implementation Steps

### 1. Unified Data Structure (Day 1)
**Location**: `/mcp-local-servers/mcp-chrome/src/types/hotel-types.ts`

```typescript
interface HotelOption {
  // Core identifiers
  giata_id?: string;
  site_id: string;
  site: 'navitrip' | 'trisept' | 'vax';
  
  // Basic info
  name: string;
  city: string;
  region?: string;
  country?: string;
  
  // Location
  address?: string;
  coordinates?: { lat: number; lng: number };
  distance_to_center?: number;
  
  // Pricing
  lead_price: {
    amount: number;
    currency: string;
    per_night: boolean;
  };
  
  // Features
  star_rating?: number;
  review_score?: number;
  review_count?: number;
  amenities?: string[];
  images?: string[];
  
  // Availability
  available: boolean;
  refundable?: boolean;
  free_cancellation_until?: string;
  
  // Raw data
  raw_json?: any;
}

interface RoomOption {
  room_id: string;
  name: string;
  description?: string;
  
  // Pricing
  nightly_rate: number;
  total_price: number;
  taxes_included: boolean;
  currency: string;
  
  // Features  
  max_occupancy?: number;
  bed_types?: string[];
  room_size?: number;
  
  // Policies
  refundable: boolean;
  cancellation_deadline?: string;
  cancellation_fee?: number;
  
  // Commission
  commission_eligible: boolean;
  commission_percent?: number;
  commission_amount?: number;
}
```

### 2. Navitrip/CPMaxx Extractor (Day 1-2)
**Location**: `/mcp-local-servers/mcp-chrome/src/extractors/navitrip.ts`

#### Search Page Extraction
- [ ] Navigate to search URL with parameters
- [ ] Wait for results to load
- [ ] Extract hotel cards
  - Hotel name and ID
  - Lead price
  - Star rating
  - Location info
  - Availability status

- [ ] Handle pagination
  - Detect total pages
  - Navigate through results
  - Aggregate all hotels

#### Hotel Detail Extraction  
- [ ] Click on hotel for details
- [ ] Extract comprehensive info
  - Full description
  - All images
  - Amenities list
  - Location details
  - Reviews

#### Room Rates Extraction
- [ ] Navigate to rates section
- [ ] Extract all room options
  - Room types and prices
  - Cancellation policies
  - Commission rates
  - Availability

### 3. Delta Vacations/Trisept Extractor (Day 2)
**Location**: `/mcp-local-servers/mcp-chrome/src/extractors/trisept.ts`

#### Search Implementation
- [ ] Handle Delta's specific search flow
- [ ] Wait for AJAX results
- [ ] Extract hotel listings
  - Parse JSON responses
  - Map to HotelOption structure

#### Package Handling
- [ ] Identify package vs hotel-only
- [ ] Extract package components
- [ ] Calculate hotel portion of price

#### Commission Extraction
- [ ] Identify commission indicators
- [ ] Calculate commission amounts
- [ ] Track promotional rates

### 4. VAX VacationAccess Extractor (Day 2-3)
**Location**: `/mcp-local-servers/mcp-chrome/src/extractors/vax.ts`

#### Login and Session
- [ ] Implement secure login flow
- [ ] Handle session management
- [ ] Store session for reuse

#### Search and Results
- [ ] Navigate VAX interface
- [ ] Extract search results
- [ ] Handle VAX-specific data format

#### Booking Flow
- [ ] Navigate to booking page
- [ ] Extract detailed pricing
- [ ] Capture commission info

### 5. Extraction Orchestrator (Day 3)
**Location**: `/mcp-local-servers/mcp-chrome/src/orchestrator.ts`

#### Session Management
- [ ] Create extraction session
  - Generate session ID
  - Track search parameters
  - Initialize status

- [ ] Progress tracking
  - Update hotels found count
  - Track rooms extracted
  - Monitor duration

#### Error Handling
- [ ] Implement retry logic
  - Exponential backoff
  - Max retry limits
  - Error categorization

- [ ] Partial failure handling
  - Save successful extractions
  - Mark failed items
  - Enable resume capability

#### Data Pipeline
- [ ] Transform extracted data
  - Map to unified structure
  - Validate required fields
  - Clean and normalize

- [ ] Batch upload to database
  - Call ingest_hotels tool
  - Call ingest_rooms tool
  - Update extraction session

### 6. MCP Tool Integration (Day 3-4)
**Location**: `/mcp-local-servers/mcp-chrome/src/tools/extraction-tools.ts`

#### Tool: `extract_hotels`
```typescript
{
  name: 'extract_hotels',
  description: 'Extract hotel availability from travel sites',
  inputSchema: {
    trip_id: string;
    site: 'navitrip' | 'trisept' | 'vax';
    search_params: {
      destination: string;
      check_in: string;
      check_out: string;
      rooms: number;
      adults: number;
      children?: number;
    };
    options?: {
      max_hotels?: number;
      price_range?: { min: number; max: number };
      star_rating?: number;
      fetch_rooms?: boolean;
    };
  }
}
```

#### Tool: `extract_room_rates`
```typescript
{
  name: 'extract_room_rates',
  description: 'Extract detailed room rates for specific hotels',
  inputSchema: {
    trip_id: string;
    site: string;
    hotel_ids: string[];
    search_params: { /* same as above */ };
  }
}
```

### 7. Testing and Validation (Day 4)
- [ ] Unit tests for extractors
- [ ] Integration tests with real sites
- [ ] Data validation tests
- [ ] Performance benchmarks
- [ ] Error recovery tests

## Success Criteria
- Extract 95%+ of available hotels
- Transform data accurately to unified structure
- Handle site changes gracefully
- Complete extraction in reasonable time (<5 min per search)
- Proper error handling and recovery

## Testing Checklist
- [ ] Test with various destinations
- [ ] Test different date ranges
- [ ] Test error scenarios
- [ ] Validate data accuracy
- [ ] Test commission extraction
- [ ] Test session recovery

## Risks and Mitigations
- **Risk**: Site structure changes
  - **Mitigation**: Modular selectors, fallback strategies

- **Risk**: Rate limiting/blocking
  - **Mitigation**: Throttling, rotation, session management

- **Risk**: Data inconsistency
  - **Mitigation**: Validation, normalization, error logging

## Notes
- Consider implementing a selector configuration system
- Log all extraction attempts for debugging
- Implement screenshot capture on errors
- Consider headless vs headed mode tradeoffs
- Monitor memory usage for long extraction sessions