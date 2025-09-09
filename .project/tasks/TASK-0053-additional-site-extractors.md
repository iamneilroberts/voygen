# TASK-0053: Additional Site Extractors (VAX & Delta Vacations)

**Priority**: MEDIUM  
**Estimated Effort**: 3-4 days  
**Dependencies**: TASK-0050 (Infrastructure), TASK-0051 (CPMaxx Success)  
**Status**: Not Started

## Objective

Implement additional travel site extractors for VAX Vacation Platform and Delta Vacations to expand autonomous search capabilities beyond CPMaxx. This extends the system's reach to package deals and airline-specific vacation offerings.

## Background

With CPMaxx extractor proven successful, we can expand to other major travel booking platforms. VAX and Delta Vacations represent different categories of travel services:

- **VAX**: Comprehensive vacation packages (flight + hotel combinations)
- **Delta Vacations**: Airline-specific packages with integrated Delta flights

These extractors will follow the same proven patterns as CPMaxx while adapting to each site's unique interface and authentication requirements.

## Requirements

### VAX Vacation Extractor
- [ ] Implement `VaxVacationExtractor` class
- [ ] Handle VAX platform authentication
- [ ] Search vacation packages (flight + hotel combinations)
- [ ] Extract package pricing with breakdown
- [ ] Support destination and date range searches
- [ ] Return structured package deal information

### Delta Vacations Extractor  
- [ ] Implement `DeltaVacationsExtractor` class
- [ ] Handle Delta.com/vacations authentication
- [ ] Search Delta-specific vacation packages
- [ ] Extract flight + hotel package deals
- [ ] Support origin/destination airport searches
- [ ] Return integrated travel package data

### NaviTrip Generic Extractor
- [ ] Implement `NaviTripExtractor` as fallback
- [ ] Handle generic booking site patterns
- [ ] Auto-detect site capabilities
- [ ] Provide basic hotel search functionality
- [ ] Support sites not covered by specific extractors

## Technical Specifications

### VAX Vacation Extractor

#### Class Structure
```typescript
export class VaxVacationExtractor extends AnchorExtractor {
  readonly name = 'vax';
  readonly patterns = [/vax\.com/, /vaxvacations\.com/];
  readonly priority = 8;
  readonly description = 'VAX vacation packages with flight + hotel combinations';

  protected getDefaultConfig() {
    return {
      timeout: 150000, // 2.5 minutes for package searches
      maxResults: 30,
      includeFlights: true,
      packageTypes: ['all-inclusive', 'flight-hotel', 'hotel-only']
    };
  }
}
```

#### Search Parameters
```typescript
export const VaxSearchSchema = z.object({
  destination: z.string().describe("Destination city/resort"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Return date"),
  travelers: z.number().min(1).max(8).default(2),
  origin: z.string().optional().describe("Departure city/airport"),
  packageType: z.enum(['all-inclusive', 'flight-hotel', 'hotel-only']).default('flight-hotel'),
  maxResults: z.number().min(1).max(30).default(20)
});
```

#### Package Result Schema
```typescript
export interface VaxPackageResult {
  id: string;
  type: 'all-inclusive' | 'flight-hotel' | 'hotel-only';
  destination: {
    name: string;
    airport: string;
    region: string;
  };
  hotel: {
    name: string;
    rating: number;
    amenities: string[];
    images: string[];
  };
  flight?: {
    outbound: FlightDetails;
    return: FlightDetails;
    airline: string;
  };
  pricing: {
    total: number;
    currency: string;
    perPerson: number;
    breakdown: {
      hotel: number;
      flight?: number;
      taxes: number;
      fees: number;
    };
  };
  inclusions: string[];
  bookingInfo: {
    provider: 'vax';
    referenceId: string;
    deepLink: string;
  };
}
```

### Delta Vacations Extractor

#### Class Structure  
```typescript
export class DeltaVacationsExtractor extends AnchorExtractor {
  readonly name = 'delta-vacations';
  readonly patterns = [/delta\.com\/vacations/, /deltavacations\.com/];
  readonly priority = 7;
  readonly description = 'Delta Vacations airline-integrated packages';

  protected getDefaultConfig() {
    return {
      timeout: 120000, // 2 minutes for Delta searches
      maxResults: 25,
      preferredClass: 'main',
      includeSkymiles: true
    };
  }
}
```

#### Search Parameters
```typescript
export const DeltaSearchSchema = z.object({
  origin: z.string().describe("Origin airport code or city"),
  destination: z.string().describe("Destination airport code or city"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.number().min(1).max(9).default(2),
  class: z.enum(['main', 'comfort+', 'first']).default('main'),
  skymiles: z.string().optional().describe("SkyMiles member number"),
  maxResults: z.number().min(1).max(25).default(15)
});
```

### NaviTrip Generic Extractor

#### Class Structure
```typescript
export class NaviTripExtractor extends AnchorExtractor {
  readonly name = 'navitrip-generic';
  readonly patterns = [/booking\.com/, /expedia\.com/, /hotels\.com/, /.*hotel.*/, /.*travel.*/];
  readonly priority = 3; // Lower priority - fallback option
  readonly description = 'Generic booking site fallback extractor';

  async detect(context: ExtractionContext): Promise<number> {
    // Auto-detect common booking site patterns
    const indicators = [
      'hotel', 'booking', 'reservation', 'travel',
      'check-in', 'check-out', 'destination'
    ];
    
    let confidence = 0.1; // Base confidence for unknown sites
    
    // Check for common booking site elements in page content
    for (const indicator of indicators) {
      if (context.pageContent?.toLowerCase().includes(indicator)) {
        confidence += 0.1;
      }
    }
    
    return Math.min(confidence, 0.6); // Cap at 60% - prefer specific extractors
  }
}
```

## Implementation Strategy

### Phase 1: VAX Vacation Extractor (Days 1-2)
1. **Research & Analysis (4 hours)**
   - Study VAX platform interface and authentication
   - Identify search form elements and navigation patterns
   - Document package result page structure
   - Test authentication requirements

2. **Authentication Implementation (4 hours)**  
   - Implement VAX login flow
   - Handle account creation if needed
   - Verify session persistence
   - Add error handling for auth failures

3. **Package Search Implementation (6 hours)**
   - Navigate to vacation search interface
   - Fill search form with destination, dates, travelers
   - Handle package type selection
   - Submit search and wait for results

4. **Data Extraction (6 hours)**
   - Parse package results with hotel + flight details
   - Extract pricing breakdown and inclusions
   - Collect images and booking information
   - Handle pagination for complete results

### Phase 2: Delta Vacations Extractor (Days 2-3)  
1. **Delta Platform Research (4 hours)**
   - Study Delta.com/vacations interface
   - Understand SkyMiles integration
   - Document search and results structure
   - Test authentication options

2. **Search Implementation (4 hours)**
   - Navigate Delta vacation search
   - Fill flight + hotel search criteria
   - Handle class selection and preferences
   - Submit search with proper parameters

3. **Results Extraction (6 hours)**
   - Parse integrated flight + hotel packages
   - Extract Delta flight details and schedules
   - Collect hotel information and amenities
   - Calculate total package pricing

### Phase 3: NaviTrip Generic Extractor (Day 4)
1. **Generic Pattern Detection (3 hours)**
   - Implement site capability auto-detection  
   - Create common booking site patterns
   - Handle various page layouts and structures
   - Add confidence scoring for unknown sites

2. **Fallback Extraction Logic (4 hours)**
   - Generic hotel search functionality
   - Basic price and availability extraction
   - Common element selectors for booking sites
   - Error handling for unsupported sites

3. **Testing & Validation (1 hour)**
   - Test against common booking sites
   - Verify fallback behavior works correctly
   - Validate confidence scoring accuracy

## Testing Strategy

### Site-Specific Testing

#### VAX Platform Tests
```typescript
// Test vacation package search
{
  destination: "Cancun, Mexico",
  departureDate: "2026-04-15",
  returnDate: "2026-04-22", 
  travelers: 2,
  packageType: "all-inclusive"
}

// Expected: 15+ all-inclusive packages with pricing
// Validation: Hotel + flight details, total cost breakdown
```

#### Delta Vacations Tests  
```typescript
// Test Delta integrated package
{
  origin: "ATL",
  destination: "LAX", 
  departureDate: "2026-05-01",
  returnDate: "2026-05-08",
  travelers: 2,
  class: "main"
}

// Expected: 10+ Delta flight + hotel packages
// Validation: Delta flight details, integrated pricing
```

#### Generic Fallback Tests
```typescript
// Test unknown booking site
{
  url: "https://some-travel-site.com",
  destination: "Paris, France",
  checkIn: "2026-06-01",
  checkOut: "2026-06-05"
}

// Expected: Basic hotel extraction or graceful failure
// Validation: Confidence scoring, fallback behavior
```

### Integration Testing
- Multiple concurrent extractors
- Site availability and error handling
- Authentication persistence across searches
- d1-database caching integration

## MCP Tool Extensions

### New Tools for Package Search

#### `search_vacation_packages`
```typescript
export async function searchVacationPackages(args: VacationSearchArgs, env: Env) {
  const extractors = [
    new VaxVacationExtractor(),
    new DeltaVacationsExtractor()
  ];
  
  // Auto-select best extractor based on search parameters
  const extractor = selectBestExtractor(extractors, args);
  
  const session = new SafeAnchorSession(env.ANCHORBROWSER_API_KEY);
  const result = await extractor.extract(context);
  
  // Cache package results
  if (result.success && args.trip_id) {
    await cachePackageResults(result.data, args.trip_id, env);
  }
  
  return result;
}
```

#### `search_flights`  
```typescript
export async function searchFlights(args: FlightSearchArgs, env: Env) {
  const extractor = new DeltaVacationsExtractor();
  
  // Focus on flight-only search
  const context = new ExtractionContext({
    searchType: 'flights-only',
    ...args
  });
  
  const result = await extractor.extract(context);
  return result;
}
```

## Success Criteria

### VAX Extractor Requirements
- [ ] Successfully search vacation packages with flight + hotel
- [ ] Extract minimum 10 packages per search
- [ ] Parse pricing breakdown (hotel, flight, taxes, fees)
- [ ] Handle all-inclusive vs flight-hotel packages
- [ ] Return structured data matching schema

### Delta Extractor Requirements  
- [ ] Authenticate and search Delta vacation packages
- [ ] Extract Delta flight details with schedules
- [ ] Parse integrated package pricing
- [ ] Handle SkyMiles integration when provided
- [ ] Support multiple cabin classes

### Generic Extractor Requirements
- [ ] Auto-detect booking site capabilities with 70%+ accuracy
- [ ] Provide fallback extraction for unknown sites  
- [ ] Handle graceful failure for unsupported sites
- [ ] Maintain consistent output format across sites

### Integration Requirements
- [ ] All extractors work with existing session management
- [ ] Results cached in d1-database with proper categorization
- [ ] Trip linking via trip_id parameter  
- [ ] No conflicts with CPMaxx extractor functionality

## Risk Mitigation

### Authentication Challenges
- **Risk**: VAX/Delta authentication more complex than CPMaxx
- **Mitigation**: Thorough research phase, fallback to manual credential entry
- **Contingency**: Implement guest/non-authenticated search modes

### Site Complexity  
- **Risk**: Package search interfaces more complex than hotel-only
- **Mitigation**: Longer timeout periods, robust error handling  
- **Contingency**: Simplified search parameters, step-by-step navigation

### Data Structure Variations
- **Risk**: Package data more complex than simple hotel listings
- **Mitigation**: Flexible schema design, graceful handling of missing fields
- **Contingency**: Fallback to basic information extraction

## Future Enhancements

### Additional Sites
- **Expedia Packages**: Major travel platform with comprehensive packages
- **Costco Travel**: Member-exclusive vacation deals  
- **AAA Travel**: Member benefits and exclusive packages
- **Booking.com Packages**: Global hotel + flight combinations

### Advanced Features  
- **Multi-site Comparison**: Compare packages across VAX, Delta, and others
- **Price Tracking**: Monitor package prices over time
- **Availability Alerts**: Notify when specific packages become available
- **Custom Packages**: Mix and match flights/hotels from different providers

## Dependencies & Blockers

### External Dependencies
- VAX platform availability and authentication policies
- Delta.com vacation section accessibility  
- Anchor Browser quota sufficient for additional site testing
- Site stability during development and testing

### Internal Dependencies
- TASK-0050 infrastructure fully operational
- TASK-0051 CPMaxx extractor working as reference implementation
- Session management and cost controls proven reliable
- d1-database schema supports package data caching

## Notes

### Research Phase Importance
Unlike CPMaxx where we had proven success, VAX and Delta require thorough upfront research to understand:
- Authentication requirements and processes
- Search interface navigation and form handling
- Result page structure and data extraction patterns
- Rate limiting and usage policies

### Gradual Rollout Strategy
1. **Week 1**: Focus on VAX extractor with thorough testing
2. **Week 2**: Implement Delta extractor using VAX lessons learned  
3. **Week 3**: Add generic extractor and comprehensive integration testing
4. **Week 4**: Performance optimization and production deployment

### Monitoring Requirements
Each extractor needs individual monitoring for:
- Success rates and error patterns
- Response times and timeout rates  
- Data quality and completeness
- Cost per search and session management