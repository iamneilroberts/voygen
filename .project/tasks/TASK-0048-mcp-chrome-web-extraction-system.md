# TASK-0048: MCP Chrome Web Content Extraction System

## Overview
Build a comprehensive web content extraction system into mcp-chrome that provides intelligent, context-aware data extraction from web pages. The system should start with cpmaxx/navitrip hotel search processing and expand to handle various travel-related and generic web content.

## Objectives

### Primary Goals
1. **Modular Architecture**: Create a pluggable extraction system that can handle different website types
2. **Intelligent Detection**: Automatically identify page types and select appropriate extraction methods
3. **Travel-Focused**: Prioritize travel industry websites (hotels, flights, activities, etc.)
4. **Context Awareness**: Use current session context and user instructions to guide extraction
5. **Fallback Processing**: Handle generic pages with best-effort content extraction

### Success Criteria
- [ ] Successfully extract hotel data from cpmaxx/navitrip search results
- [ ] Modular system allows easy addition of new extractors
- [ ] Automatic page type detection with 90%+ accuracy on supported sites
- [ ] Graceful fallback for unsupported pages
- [ ] Maintains compatibility with existing MCP Chrome functionality

## Technical Architecture

### 1. Fork Strategy
Create `mcp-chrome-web-extract` as a specialized fork:
```
mcp-local-servers/
├── mcp-chrome/                    # Original stock version
├── mcp-chrome-web-extract/        # Enhanced extraction version
└── mcp-chrome-bridge/             # Shared bridge if needed
```

**Benefits:**
- Keep original mcp-chrome intact for standard automation
- Allow switching between versions based on use case
- Easier maintenance and updates from upstream

### 2. Extraction System Architecture

```typescript
interface ExtractionContext {
  url: string;
  domain: string;
  pageTitle: string;
  userInstructions?: string;
  sessionContext?: Record<string, any>;
  screenshot?: string; // base64
}

interface ExtractorResult {
  success: boolean;
  data: any;
  confidence: number;
  extractor: string;
  metadata?: {
    processingTime: number;
    elementsFound: number;
    warnings?: string[];
  };
}

interface PageExtractor {
  name: string;
  patterns: RegExp[];
  detect(context: ExtractionContext): Promise<number>; // confidence 0-1
  extract(context: ExtractionContext): Promise<ExtractorResult>;
}
```

### 3. Core Components

#### A. Page Detection Engine
- **URL Pattern Matching**: Domain/path regex patterns
- **Content Analysis**: DOM structure, specific elements, text patterns
- **Screenshot Analysis**: Visual indicators (logos, layout patterns)
- **Confidence Scoring**: Multiple detection methods with weighted scores

#### B. Extractor Registry
```typescript
class ExtractorRegistry {
  private extractors: Map<string, PageExtractor> = new Map();
  
  register(extractor: PageExtractor): void;
  detect(context: ExtractionContext): Promise<PageExtractor[]>; // sorted by confidence
  extract(context: ExtractionContext): Promise<ExtractorResult>;
}
```

#### C. Specialized Extractors

##### 1. NaviTrip Hotel Extractor
```typescript
class NaviTripHotelExtractor implements PageExtractor {
  name = 'navitrip-hotels';
  patterns = [/cpmaxx\.com/, /navitrip/i];
  
  async detect(context: ExtractionContext): Promise<number> {
    // Check URL patterns
    // Look for hotel listing elements
    // Analyze page structure
  }
  
  async extract(context: ExtractionContext): Promise<ExtractorResult> {
    // Extract hotel listings with:
    // - Name, rating, price
    // - Location, amenities
    // - Availability dates
    // - Booking links
  }
}
```

##### 2. Generic Travel Extractor
- Hotel booking sites (Booking.com, Hotels.com, etc.)
- Flight search results
- Activity/tour listings
- Restaurant/dining options

##### 3. Fallback Content Extractor
- Structured data extraction (JSON-LD, microdata)
- Main content area identification
- Key information extraction based on context

#### D. Enhanced MCP Tools
```typescript
// New extraction-focused tools
'chrome_extract_content': {
  url?: string;
  extractorHint?: string;
  userInstructions?: string;
  includeScreenshot?: boolean;
}

'chrome_extract_hotels': {
  url?: string;
  searchCriteria?: {
    location?: string;
    dates?: { checkIn: string; checkOut: string };
    guests?: number;
  };
}

'chrome_list_extractors': {
  // List available extractors and their patterns
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. **Fork Setup**
   - [ ] Create mcp-chrome-web-extract fork
   - [ ] Set up development environment
   - [ ] Ensure parallel installation capability

2. **Core Architecture**
   - [ ] Implement ExtractionContext interface
   - [ ] Build ExtractorRegistry system
   - [ ] Create base PageExtractor abstract class
   - [ ] Add page detection engine

### Phase 2: NaviTrip Integration (Week 2)
1. **NaviTrip Extractor**
   - [ ] Analyze cpmaxx/navitrip page structure
   - [ ] Implement hotel data extraction
   - [ ] Handle pagination and search results
   - [ ] Add error handling and validation

2. **Testing & Validation**
   - [ ] Test with real navitrip searches
   - [ ] Validate data accuracy
   - [ ] Performance optimization

### Phase 3: Generic Extractors (Week 3)
1. **Travel Site Support**
   - [ ] Booking.com extractor
   - [ ] Hotels.com extractor
   - [ ] Expedia extractor
   - [ ] Flight search extractors

2. **Fallback System**
   - [ ] Generic content extraction
   - [ ] Structured data parsing
   - [ ] Content relevance scoring

### Phase 4: Integration & Polish (Week 4)
1. **MCP Integration**
   - [ ] New extraction tools
   - [ ] Context passing from Voygen
   - [ ] Session state management

2. **Documentation & Testing**
   - [ ] Complete documentation
   - [ ] End-to-end testing
   - [ ] Performance benchmarks

## Technical Specifications

### File Structure
```
mcp-chrome-web-extract/
├── src/
│   ├── extractors/
│   │   ├── base/
│   │   │   ├── PageExtractor.ts
│   │   │   ├── ExtractionContext.ts
│   │   │   └── ExtractorRegistry.ts
│   │   ├── travel/
│   │   │   ├── NaviTripExtractor.ts
│   │   │   ├── BookingExtractor.ts
│   │   │   └── GenericHotelExtractor.ts
│   │   ├── generic/
│   │   │   ├── StructuredDataExtractor.ts
│   │   │   └── ContentExtractor.ts
│   │   └── index.ts
│   ├── detection/
│   │   ├── PatternMatcher.ts
│   │   ├── ContentAnalyzer.ts
│   │   └── ScreenshotAnalyzer.ts
│   ├── tools/
│   │   ├── extraction-tools.ts
│   │   └── enhanced-tools.ts
│   └── utils/
│       ├── dom-utils.ts
│       └── data-validation.ts
├── extractors.config.json
├── package.json
└── README.md
```

### Configuration System
```json
{
  "extractors": [
    {
      "name": "navitrip-hotels",
      "enabled": true,
      "patterns": ["cpmaxx.com", "navitrip"],
      "priority": 10,
      "config": {
        "maxResults": 50,
        "includeImages": true,
        "timeout": 30000
      }
    }
  ],
  "detection": {
    "screenshotAnalysis": true,
    "confidenceThreshold": 0.7,
    "fallbackEnabled": true
  }
}
```

## Integration with Voygen

### Context Passing
- User search criteria from travel agent conversations
- Session state (current trip planning)
- Preferred price ranges, amenities, etc.
- Previous search history

### Workflow Integration
- Seamless integration with trip planning workflow
- Automatic data ingestion into D1 database
- Progress tracking and user feedback

### Error Handling
- Graceful degradation when extractors fail
- User notification of extraction status
- Retry mechanisms for transient failures

## Success Metrics

### Performance Targets
- **Extraction Speed**: < 5 seconds for typical hotel search pages
- **Accuracy**: > 90% for supported sites
- **Coverage**: Support for top 10 travel booking sites
- **Reliability**: < 5% failure rate under normal conditions

### Quality Measures
- Data completeness (all available fields extracted)
- Data accuracy (manual verification on sample)
- User satisfaction with extracted content
- System stability and error rates

## Risks and Mitigations

### Technical Risks
1. **Website Changes**: Sites update their structure frequently
   - *Mitigation*: Robust selectors, fallback patterns, monitoring

2. **Performance Impact**: Complex extraction may slow down browsing
   - *Mitigation*: Async processing, caching, timeout controls

3. **Anti-Bot Measures**: Sites may block automated access
   - *Mitigation*: Respect robots.txt, rate limiting, user-agent rotation

### Business Risks
1. **Maintenance Overhead**: Keeping extractors updated
   - *Mitigation*: Automated testing, community contributions

2. **Legal Concerns**: Web scraping compliance
   - *Mitigation*: Respect terms of service, fair use principles

## Next Steps

1. **Immediate**: Create the forked repository structure
2. **Week 1**: Implement core architecture and detection system  
3. **Week 2**: Build and test NaviTrip extractor
4. **Week 3**: Add generic travel site support
5. **Week 4**: Integration testing and documentation

## Dependencies

- Existing mcp-chrome functionality
- Chrome DevTools Protocol access
- DOM parsing libraries (cheerio, jsdom)
- Image analysis tools (optional for screenshot analysis)
- Voygen D1 database integration

## Resources Required

- Development time: ~4 weeks
- Testing on real travel websites
- Documentation and user guides
- Monitoring and maintenance setup

---

**Priority**: High  
**Effort**: Large (4 weeks)  
**Impact**: High (Core travel agent functionality)  
**Dependencies**: MCP Chrome stability, D1 database integration