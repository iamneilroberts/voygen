# TASK-0051: CPMaxx Extractor Implementation

**Priority**: HIGH  
**Estimated Effort**: 1-2 days  
**Dependencies**: TASK-0050 (Infrastructure Setup)  
**Status**: Not Started

## Objective

Implement the CPMaxx hotel search extractor based on successful testing results. This extractor will handle authentication to cpmaxx.cruiseplannersnet.com and extract hotel search results via the HotelEngine integration.

## Background

Testing successfully extracted 20 Seattle hotels with pricing from CPMaxx using authentication credentials. The extractor proved reliable with proper session management and structured JSON output. This task converts the successful test scripts into a production-ready extractor.

**Proven Results from Testing:**
- Successfully logged into cpmaxx.cruiseplannersnet.com
- Navigated to HotelEngine search functionality  
- Extracted 20 Seattle hotels with names, prices, and details
- Structured output in JSON format suitable for LLM consumption

## Requirements

### Core Functionality
- [ ] Implement `CpmaxxtExtractor` class extending `AnchorExtractor`
- [ ] Handle authentication with kim.henderson@cruiseplanners.com credentials
- [ ] Navigate to HotelEngine search functionality
- [ ] Extract hotel results with structured data format
- [ ] Support search parameters: destination, check-in/out dates, travelers
- [ ] Return standardized hotel result format

### Data Extraction Capabilities
- [ ] Hotel names and addresses
- [ ] Room pricing (per night and total)
- [ ] Hotel ratings and reviews
- [ ] Available amenities
- [ ] Refundability status
- [ ] Booking reference information
- [ ] High-resolution hotel images

### Error Handling
- [ ] Authentication failures
- [ ] No search results scenarios
- [ ] Site navigation issues
- [ ] Timeout and session management
- [ ] Rate limiting responses

## Technical Specifications

### CPMaxx Extractor Class
```typescript
export class CpmaxxtExtractor extends AnchorExtractor {
  readonly name = 'cpmaxx';
  readonly patterns = [/cpmaxx\.cruiseplannersnet\.com/];
  readonly priority = 10; // High priority for CPMaxx sites
  readonly description = 'CPMaxx/CruisePlannersNet hotel search via HotelEngine';

  protected getDefaultConfig() {
    return {
      timeout: 120000, // 2 minutes for complex searches
      maxResults: 50,
      loginTimeout: 30000,
      searchTimeout: 90000
    };
  }

  async detect(context: ExtractionContext): Promise<number> {
    // High confidence for CPMaxx URLs
    return this.validatePatterns(context) ? 0.95 : 0.0;
  }

  async extract(context: ExtractionContext): Promise<ExtractorResult> {
    // Main extraction implementation
  }
}
```

### Search Parameters Schema
```typescript
export const CpmaxSearchSchema = z.object({
  destination: z.string().describe("Destination city and state (e.g., 'Seattle, WA')"),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Check-in date in YYYY-MM-DD format"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Check-out date in YYYY-MM-DD format"), 
  travelers: z.number().min(1).max(8).default(2).describe("Number of travelers"),
  maxResults: z.number().min(1).max(50).default(20).describe("Maximum number of results")
});
```

### Hotel Result Schema
```typescript
export interface CpmaxHotelResult {
  id: string;                    // CPMaxx internal ID
  name: string;                  // Hotel name
  address: string;               // Full address
  city: string;                  // City name
  price: {
    amount: number;              // Price per night
    currency: string;            // USD, EUR, etc.
    total: number;              // Total for stay
    taxesIncluded: boolean;
  };
  rating: {
    score: number;              // 1-5 star rating
    reviewCount: number;        // Number of reviews
    source: string;             // Rating source
  };
  amenities: string[];          // Hotel amenities
  images: string[];             // Hotel image URLs
  availability: {
    refundable: boolean;
    cancellationPolicy: string;
    roomType: string;
  };
  bookingInfo: {
    provider: 'cpmaxx';
    referenceId: string;
    deepLink: string;           // Direct booking link
  };
}
```

## Implementation Steps

### Step 1: Basic Extractor Structure (4 hours)
1. Create `CpmaxxtExtractor.ts` file in `/extractors/sites/`
2. Implement class structure extending `AnchorExtractor`
3. Add URL pattern matching and confidence detection
4. Set up configuration and initialization

### Step 2: Authentication Implementation (4 hours)
1. Implement login flow based on successful test scripts
2. Handle navigation to cpmaxx.cruiseplannersnet.com login page
3. Fill email and password fields securely
4. Verify successful authentication and session persistence
5. Add error handling for authentication failures

### Step 3: HotelEngine Navigation (2 hours)
1. Navigate to HotelEngine section after login
2. Handle dynamic page loading and JavaScript execution
3. Locate and interact with search form elements
4. Implement robust element detection and waiting

### Step 4: Search Form Interaction (4 hours)
1. Fill destination field with location normalization
2. Set check-in and check-out dates with date picker handling
3. Configure traveler count and room requirements
4. Submit search and wait for results loading
5. Handle search errors and no-results scenarios

### Step 5: Data Extraction (6 hours)
1. Parse hotel results from search results page
2. Extract hotel names, addresses, and basic information
3. Parse pricing information with currency detection
4. Extract ratings, reviews, and amenities
5. Collect hotel images and booking links
6. Handle pagination for complete result sets

### Step 6: Result Processing (4 hours)
1. Transform raw extracted data into standardized format
2. Validate data completeness and accuracy
3. Apply price parsing and normalization
4. Generate confidence scores for each hotel result
5. Create structured JSON output matching schema

## Testing Strategy

### Unit Tests
- Authentication flow with valid/invalid credentials
- Search parameter validation and normalization
- Data extraction accuracy with mock HTML
- Error handling for various failure scenarios

### Integration Tests  
- End-to-end search with real CPMaxx site
- Session management and cleanup
- Multiple concurrent searches
- Rate limiting and timeout handling

### Data Validation Tests
- Extracted hotel data completeness
- Price accuracy and currency handling
- Image URL validity and accessibility
- Booking reference information correctness

## Proven Implementation Patterns

### From Successful Testing Scripts

#### Authentication Flow
```typescript
const authPrompt = `
1. Login to cpmaxx.cruiseplannersnet.com with ${email} / ${password}
2. Navigate to HotelEngine
3. Verify successful login and navigation
`;
```

#### Hotel Search Implementation
```typescript
const searchPrompt = `
Complete hotel search workflow:
1. Go to HotelEngine search
2. Search ${destination} for ${checkIn} to ${checkOut}
3. Extract ALL hotel results with names, prices, addresses
4. Return complete structured JSON data
`;
```

#### Result Parsing Pattern
```typescript
// Based on successful extraction pattern
const actualResult = response.data?.result?.result || response.data?.result;

if (typeof actualResult === 'object' && actualResult.hotels) {
  return {
    success: true,
    hotels: actualResult.hotels,
    total: actualResult.hotels.length
  };
}
```

## Error Scenarios & Handling

### Authentication Errors
- Invalid credentials → Retry with error logging
- Site maintenance → Return temporary failure status
- Session expired → Re-authenticate automatically

### Search Errors
- No results found → Return empty results with metadata
- Invalid destination → Return validation error
- Date range issues → Return parameter error with suggestions

### Extraction Errors  
- Page load failures → Retry with exponential backoff
- Missing data elements → Continue with partial data
- Malformed HTML → Apply alternative extraction strategies

## Integration Points

### d1-database Integration
```typescript
// Auto-cache results after successful extraction
const cacheResult = await env.DB.prepare(`
  INSERT INTO hotel_cache (trip_id, site, json, created_at)
  VALUES (?, 'cpmaxx', ?, datetime('now'))
`).bind(tripId, JSON.stringify(hotels)).run();
```

### MCP Tool Integration
```typescript
// search_hotels tool implementation
export async function searchHotels(args: CpmaxSearchArgs, env: Env) {
  const extractor = new CpmaxxtExtractor();
  const session = new SafeAnchorSession(env.ANCHORBROWSER_API_KEY);
  
  try {
    const context = new ExtractionContext({
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      searchParams: args
    });
    
    const result = await extractor.extract(context);
    
    // Cache results in d1-database
    if (result.success && args.trip_id) {
      await cacheHotelResults(result.data, args.trip_id, env);
    }
    
    return result;
  } finally {
    await session.cleanup();
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] Successfully authenticate with CPMaxx using provided credentials
- [ ] Navigate to HotelEngine and perform hotel searches
- [ ] Extract minimum 15 hotels per search (based on testing results)
- [ ] Return structured JSON matching defined schema
- [ ] Handle authentication persistence across searches

### Data Quality Requirements
- [ ] Hotel names accurately extracted (>95% accuracy)
- [ ] Pricing information complete with currency
- [ ] Addresses and location data accurate
- [ ] Images and booking links functional
- [ ] Rating and review data when available

### Performance Requirements
- [ ] Complete search and extraction within 2 minutes
- [ ] Handle up to 3 concurrent searches
- [ ] Memory usage under 100MB per extraction
- [ ] Session cleanup completes within 10 seconds

### Reliability Requirements
- [ ] 95% success rate for valid search parameters
- [ ] Graceful failure handling with informative error messages
- [ ] No memory leaks or hanging sessions
- [ ] Consistent results across multiple searches

## Dependencies & Blockers

### External Dependencies
- CPMaxx site availability and stability
- Anchor Browser API quota and performance
- Valid authentication credentials maintained

### Internal Dependencies  
- TASK-0050 infrastructure must be completed
- Base AnchorExtractor class implementation
- SafeAnchorSession utility functions

## Follow-up Tasks

### Immediate Next Steps
- **TASK-0055**: LibreChat integration testing with CPMaxx extractor
- **TASK-0056**: d1-database hotel caching integration
- **TASK-0057**: Performance optimization and monitoring

### Future Enhancements
- Multiple room type support
- Advanced filtering (amenities, rating, price range)  
- Availability calendar integration
- Real-time price tracking
- Comparison with other booking sites

## Notes

### Testing Results Summary
- **Search Success**: 20 Seattle hotels extracted successfully
- **Data Quality**: Complete hotel names, prices, and basic details
- **Session Management**: Reliable authentication and cleanup
- **Performance**: ~2 minute search completion time
- **Cost**: ~$0.20 per search based on testing usage

### Known Limitations
- CPMaxx-specific authentication required
- HotelEngine interface may change requiring updates
- Rate limiting at ~3-5 searches per hour observed
- Site maintenance windows affect availability

### Security Considerations
- Credentials stored securely in Cloudflare Workers environment  
- No credential logging or exposure in responses
- Session tokens properly cleaned up after use
- HTTPS-only communication with booking sites