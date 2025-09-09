# MCP Anchor Browser Autonomous Search System

## Overview

A complete replacement for mcp-chrome's search functionality using Anchor Browser's AI-powered automation. This system enables the LLM to autonomously perform travel searches and data extraction without human intervention, while maintaining the existing mcp-chrome for over-the-shoulder user assistance tasks.

## Business Context

Based on successful testing, Anchor Browser has proven superior to the current Chrome DevTools Protocol approach for autonomous travel searches. The current mcp-chrome implementation has incomplete extractors with mock data, while Anchor Browser successfully extracted real hotel data from protected sites like cpmaxx.cruiseplannersnet.com.

### Current State Analysis
- **mcp-chrome**: Complex architecture requiring Chrome extension + native messaging host
- **NaviTripExtractor**: Contains only mock data implementation
- **Memory Impact**: ~100-150MB with incomplete functionality
- **Authentication**: Manual login required, sessions not persistent

### Target State
- **mcp-anchor-browser**: Cloud-based serverless automation via Cloudflare Workers
- **Real Data Extraction**: Proven success with 20+ Seattle hotels extracted from CPMaxx
- **Session Management**: Automatic authentication and cleanup
- **Cost Controls**: Timeout safeguards prevent runaway costs

## Architecture

### Server Infrastructure
- **Platform**: Cloudflare Workers (following existing remote MCP pattern)
- **Technology**: TypeScript + Anchor Browser SDK + Zod validation
- **Deployment**: Remote MCP server accessible via SSE endpoint
- **Cost Model**: Per-search pricing with built-in limits

### Modular Extractor System
```
remote-mcp-servers/mcp-anchor-browser/
├── src/
│   ├── extractors/
│   │   ├── base/
│   │   │   ├── AnchorExtractor.ts         # Base extractor class
│   │   │   ├── ExtractionSession.ts       # Session management
│   │   │   └── ExtractionResult.ts        # Standardized results
│   │   ├── sites/
│   │   │   ├── CpmaxxtExtractor.ts        # CPMaxx (proven working)
│   │   │   ├── VaxVacationExtractor.ts    # VAX vacation platform
│   │   │   ├── DeltaVacationsExtractor.ts # Delta vacation packages
│   │   │   └── NaviTripExtractor.ts       # Generic booking sites
│   │   └── utils/
│   │       ├── PriceParser.ts
│   │       ├── DateParser.ts
│   │       └── LocationNormalizer.ts
│   ├── tools/
│   │   ├── search-hotels.ts
│   │   ├── search-packages.ts
│   │   └── session-management.ts
│   └── index.ts                           # Main MCP server
├── wrangler.toml
└── package.json
```

## Site-Specific Extractors

### 1. CPMaxx Extractor (Priority 1 - Proven)
- **Site**: cpmaxx.cruiseplannersnet.com
- **Status**: Successfully tested with real data extraction
- **Authentication**: kim.henderson@cruiseplanners.com / SomoTravel2022!
- **Capabilities**: 
  - Hotel search via HotelEngine integration
  - Real-time pricing and availability
  - 20+ hotels extracted successfully in testing
- **Output Schema**:
  ```json
  {
    "hotels": [
      {
        "name": "Hotel Name",
        "price": "$123",
        "address": "123 Main St",
        "amenities": ["wifi", "pool"],
        "rating": 4.2
      }
    ],
    "total": 20,
    "searchParams": {
      "destination": "Seattle, WA",
      "checkIn": "2026-03-15",
      "checkOut": "2026-03-16"
    }
  }
  ```

### 2. VAX Vacation Extractor (Priority 2)
- **Site**: VAX vacation booking platform
- **Capabilities**: Complete vacation packages, hotel + flight combinations
- **Target Output**: Package deals with pricing breakdown

### 3. Delta Vacations Extractor (Priority 3)
- **Site**: Delta Vacations booking platform  
- **Capabilities**: Airline-specific vacation packages with Delta flights
- **Target Output**: Integrated flight + hotel packages

### 4. NaviTrip Extractor (Priority 4)
- **Site**: Generic booking sites, NaviTrip platform
- **Purpose**: Fallback extractor for sites not covered by specific extractors
- **Capabilities**: Generic hotel search functionality

## MCP Tool Interface

### Core Tools for LLM Interaction

#### `search_hotels`
Autonomous hotel search across multiple booking platforms.

**Input Schema:**
```typescript
{
  destination: string,        // "Seattle, WA"
  checkIn: string,           // "2026-03-15" (YYYY-MM-DD)
  checkOut: string,          // "2026-03-16" (YYYY-MM-DD)  
  site?: 'cpmaxx' | 'vax' | 'delta' | 'navitrip' | 'auto',
  travelers?: number,        // default 2
  maxResults?: number,       // default 20, max 50
  timeout?: number,          // default 120 seconds, max 300
  priceRange?: {
    min?: number,
    max?: number
  }
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  hotels: HotelResult[],
  metadata: {
    searchDuration: number,
    site: string,
    totalFound: number,
    cached: boolean
  },
  error?: string
}
```

#### `search_vacation_packages`
Search for complete vacation packages including flights and hotels.

**Input Schema:**
```typescript
{
  destination: string,
  departureDate: string,
  returnDate: string,
  travelers: number,
  site?: 'vax' | 'delta' | 'auto',
  includeFlights?: boolean,  // default true
  maxResults?: number,       // default 10
  budget?: {
    min?: number,
    max?: number
  }
}
```

#### `search_flights`
Flight-specific search functionality.

**Input Schema:**
```typescript
{
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,       // optional for one-way
  travelers: number,
  site?: 'delta' | 'auto',
  class?: 'economy' | 'business' | 'first'
}
```

#### `get_session_status`
Monitor active sessions and costs.

**Input Schema:**
```typescript
{
  sessionId?: string,        // Check specific session or all active
  includeHistory?: boolean   // Include recent session history
}
```

## Integration Points

### d1-database Integration
- **Hotel Caching**: Search results automatically cached via existing `ingest_hotels` tool
- **Trip Linking**: Search results associated with trip_id for context
- **Fact Updates**: Triggers `refresh_trip_facts` when new hotel data is ingested
- **Data Flow**: search_hotels → ingest_hotels → trip_facts refresh

### LibreChat Configuration
New MCP server configuration in `config/librechat-minimal.yaml`:

```yaml
mcp-anchor-browser:
  command: "npx"
  args:
    - "-y"
    - "mcp-remote"
    - "https://mcp-anchor-browser.somotravel.workers.dev/sse"
  timeout: 180000  # 3 minutes for complex searches
  env: {}
  description: "AI-powered autonomous travel search and data extraction"
  serverInstructions: |
    Autonomous travel search capabilities for LLM-driven operations:
    - search_hotels: Get real-time hotel availability and pricing from booking sites
    - search_vacation_packages: Find complete vacation packages with flights
    - search_flights: Flight search across airline platforms
    - get_session_status: Monitor search sessions and costs
    
    Integration features:
    - Automatically caches results in d1-database hotel_cache
    - Links search results to trip context via trip_id
    - Built-in session management and cost controls
    - Supports CPMaxx, VAX, Delta Vacations, and generic booking sites
    
    Use cases:
    - When LLM needs real hotel pricing for trip planning
    - Autonomous price comparison across multiple sites
    - Real-time availability checks for specific dates
    - Package deal research for vacation planning
```

### Session Management & Cost Controls

#### Automatic Session Cleanup
Based on successful testing patterns:
```typescript
class SafeAnchorSession {
  constructor() {
    // Auto-cleanup after 5 minutes as safety net
    setTimeout(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  async performSearch(prompt, timeout = 90000) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), timeout);
    });
    
    return Promise.race([searchPromise, timeoutPromise]);
  }
  
  async cleanup() {
    await this.anchor.sessions.delete('all');
  }
}
```

#### Cost Protection Features
- **Timeout Controls**: Hard limits at 90-300 seconds per search
- **Session Monitoring**: Track active sessions and accumulated costs
- **Rate Limiting**: Respect Anchor Browser quota limits
- **Error Recovery**: Graceful handling of 429 rate limit responses
- **Budget Alerts**: Configurable spending limits and notifications

## Benefits Over Current System

### Functionality Improvements
- **Real Data**: Replaces mock data with actual hotel search results
- **Authentication**: Automatic login handling vs manual Chrome extension setup
- **Reliability**: Cloud-based execution vs local Chrome dependency
- **Scalability**: Serverless architecture handles multiple concurrent searches

### Operational Benefits
- **Cost Predictability**: Per-search pricing vs unpredictable local resource usage
- **Maintenance**: No local Chrome extension updates or native messaging host issues
- **Security**: Centralized credential management vs local storage
- **Monitoring**: Built-in session tracking and cost monitoring

### Developer Experience
- **Debugging**: Clear session logs and error reporting
- **Testing**: Programmatic testing without Chrome setup
- **Deployment**: Serverless deployment vs complex local installation
- **Integration**: Direct API integration vs Chrome extension messaging

## Migration Strategy

### Phase 1: Parallel Operation
- **mcp-chrome**: Continue handling user-assisted tasks
  - Import existing trips from browser
  - Extract confirmation numbers from emails
  - Screenshot capture for verification
- **mcp-anchor-browser**: Handle autonomous LLM searches
  - Hotel searches for trip planning
  - Price comparisons and availability checks
  - Package research for vacation planning

### Phase 2: Gradual Transition
- Monitor performance and reliability of autonomous searches
- Compare data quality between Chrome extension and Anchor Browser results
- Optimize cost per search and session management
- Gather user feedback on search speed and accuracy

### Phase 3: Full Deployment
- Update LibreChat configuration to prioritize mcp-anchor-browser
- Maintain mcp-chrome as fallback for specific user-assisted scenarios
- Document usage patterns and best practices
- Establish monitoring and alerting for cost and performance

## Success Metrics

### Technical Metrics
- **Search Success Rate**: >95% successful hotel data extraction
- **Response Time**: <2 minutes average search completion
- **Data Accuracy**: Structured JSON output matching expected schemas
- **Cost Efficiency**: <$0.30 per hotel search on average

### Integration Metrics
- **Cache Hit Rate**: Search results properly stored in d1-database
- **Trip Linking**: Results correctly associated with trip_id context
- **Fact Refresh**: Automatic trip_facts updates when new data ingested
- **Error Handling**: Graceful degradation when searches fail

### Business Metrics
- **LLM Autonomy**: AI can complete trip planning without human intervention
- **Data Freshness**: Real-time pricing vs stale mock data
- **User Experience**: Faster trip planning with accurate information
- **Operational Efficiency**: Reduced manual data entry and verification

## Risk Mitigation

### Cost Control Risks
- **Mitigation**: Hard timeout limits, session cleanup, budget alerts
- **Monitoring**: Real-time cost tracking per search and per day
- **Fallback**: Emergency session termination capabilities

### Reliability Risks
- **Mitigation**: Graceful error handling, retry logic, fallback extractors
- **Monitoring**: Success rate tracking, performance metrics
- **Fallback**: mcp-chrome remains available for critical searches

### Data Quality Risks
- **Mitigation**: Schema validation, data consistency checks
- **Monitoring**: Output format validation, price reasonability checks
- **Fallback**: Manual verification tools for critical trip planning

## Future Enhancements

### Additional Site Support
- **Booking.com**: Major hotel booking platform
- **Expedia**: Comprehensive travel search
- **Hotels.com**: Hotel-specific search capabilities
- **Airbnb**: Alternative accommodation options

### Advanced Features
- **Price Tracking**: Monitor price changes over time
- **Availability Alerts**: Notify when specific hotels become available
- **Comparison Analytics**: Multi-site price and feature comparison
- **Smart Recommendations**: AI-powered hotel suggestions based on trip context

### Performance Optimizations
- **Caching Strategies**: Smart result caching to reduce search costs
- **Parallel Searches**: Concurrent multi-site searches for comparison
- **Session Pooling**: Reuse authenticated sessions across multiple searches
- **Regional Optimization**: Deploy closer to booking site servers