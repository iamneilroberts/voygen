# TASK-0056: Site-Specific Travel Data Extractors

## Task Overview
**Priority**: High  
**Estimated Time**: 3-4 days  
**Dependencies**: TASK-0055 (Foundation)  
**Assignee**: Development Team  

## Objective
Implement comprehensive site-specific extractors for travel platforms (CPMaxx, VAX, Delta Vacations, NaviTrip) with intelligent data extraction, transformation, and quality scoring capabilities.

## Success Criteria
- [ ] CPMaxx hotel extractor with commission data
- [ ] VAX vacation package extractor
- [ ] Delta Vacations flight + hotel extractor  
- [ ] NaviTrip cruise and tour extractor
- [ ] Data transformation to unified schema
- [ ] Quality scoring and confidence metrics
- [ ] Error handling and retry mechanisms
- [ ] Performance optimization with resource blocking

## Technical Requirements

### 1. Extractor Architecture
```
src/extractors/
├── base/
│   ├── base-extractor.ts           # Abstract base class
│   ├── extractor-interface.ts      # Common interfaces
│   └── quality-scorer.ts           # Quality assessment
├── platforms/
│   ├── cpmaxx-extractor.ts         # CPMaxx implementation
│   ├── vax-extractor.ts            # VAX implementation  
│   ├── delta-extractor.ts          # Delta Vacations
│   └── navitrip-extractor.ts       # NaviTrip implementation
├── transformers/
│   ├── hotel-transformer.ts        # Hotel data transformation
│   ├── flight-transformer.ts       # Flight data transformation
│   ├── package-transformer.ts      # Package data transformation
│   └── schema-validator.ts         # Schema validation
└── utils/
    ├── selector-utils.ts           # CSS selector utilities
    ├── price-parser.ts             # Price parsing utilities
    └── date-utils.ts               # Date handling utilities
```

### 2. Base Extractor Interface
```typescript
// src/extractors/base/extractor-interface.ts
export interface ExtractorConfig {
  platform: string;
  baseUrl: string;
  timeout: number;
  resourceBlocking: {
    images: boolean;
    stylesheets: boolean;
    media: boolean;
    fonts: boolean;
    scripts: boolean;
  };
  selectors: Record<string, string>;
  retryConfig: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface ExtractionResult<T> {
  data: T[];
  metadata: {
    extractionTime: number;
    dataQuality: QualityMetrics;
    warnings: string[];
    platform: string;
    searchParams: any;
  };
  cost: {
    sessionCost: number;
    dataCost: number;
    totalCost: number;
  };
}

export interface QualityMetrics {
  confidence: number;      // 0-1 extraction confidence
  completeness: number;    // 0-1 data completeness
  accuracy: number;        // 0-1 expected accuracy
  consistency: number;     // 0-1 data consistency
}

export abstract class BaseExtractor<T> {
  constructor(
    protected config: ExtractorConfig,
    protected anchorClient: AnchorBrowserClient
  ) {}

  abstract extract(params: any): Promise<ExtractionResult<T>>;
  protected abstract transformRawData(rawData: any[]): T[];
  protected abstract calculateQuality(data: any[]): QualityMetrics;
}
```

### 3. CPMaxx Hotel Extractor
```typescript
// src/extractors/platforms/cpmaxx-extractor.ts
export class CPMaxxExtractor extends BaseExtractor<HotelResult> {
  private static readonly CONFIG: ExtractorConfig = {
    platform: 'cpmaxx',
    baseUrl: 'https://cpmaxx.cruiseplannersnet.com',
    timeout: 90000,
    resourceBlocking: {
      images: true,
      stylesheets: true,
      media: true,
      fonts: true,
      scripts: false // Keep scripts for search functionality
    },
    selectors: {
      searchForm: '#hotel-search-form',
      destinationInput: '[name="location_search"]',
      checkinInput: '[name="checkin"]',
      checkoutInput: '[name="checkout"]',
      guestsSelect: '[name="num_adults"]',
      roomsSelect: '[name="rooms"]',
      searchButton: '#search-button',
      resultsContainer: '.results-container',
      hotelCard: '.result.rounded',
      hotelName: '.hotel-details .title a',
      hotelAddress: '.hotel-details .address',
      starRating: '.hotel-details .star',
      description: '.hotel-details p:nth-of-type(3)',
      pricePerNight: '.pricing-box .min-rate',
      totalPrice: '.pricing-box p:contains("Total:")',
      commission: '.commission b',
      selectButton: '.select-button',
      giataId: '[data-giata-id]',
      coordinates: '[data-marker]'
    },
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 2000
    }
  };

  async extract(params: HotelSearchParams): Promise<ExtractionResult<HotelResult>> {
    const startTime = Date.now();
    let session: AnchorSession | null = null;

    try {
      // 1. Create optimized session
      session = await this.anchorClient.createOptimizedSession({
        platform: this.config.platform,
        resourceBlocking: this.config.resourceBlocking,
        timeout: this.config.timeout
      });

      // 2. Navigate to search page
      await session.navigate(`${this.config.baseUrl}/HotelEngine`, {
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      });

      // 3. Perform search with form filling
      await this.performSearch(session, params);

      // 4. Wait for and extract results
      const rawResults = await this.extractHotelData(session);

      // 5. Transform to standard format
      const transformedData = this.transformRawData(rawResults);

      // 6. Calculate quality metrics
      const quality = this.calculateQuality(rawResults);

      const extractionTime = Date.now() - startTime;
      const cost = this.calculateCost(extractionTime);

      return {
        data: transformedData,
        metadata: {
          extractionTime,
          dataQuality: quality,
          warnings: this.generateWarnings(rawResults),
          platform: this.config.platform,
          searchParams: params
        },
        cost
      };

    } catch (error) {
      throw new ExtractionError(`CPMaxx extraction failed: ${error.message}`, {
        platform: this.config.platform,
        params,
        duration: Date.now() - startTime
      });
    } finally {
      if (session) {
        await session.cleanup();
      }
    }
  }

  private async performSearch(session: AnchorSession, params: HotelSearchParams): Promise<void> {
    // Fill search form with timeout protection
    await session.fillForm({
      [this.config.selectors.destinationInput]: params.destination,
      [this.config.selectors.checkinInput]: params.checkin,
      [this.config.selectors.checkoutInput]: params.checkout,
      [this.config.selectors.guestsSelect]: params.guests?.toString() || '2',
      [this.config.selectors.roomsSelect]: params.rooms?.toString() || '1'
    }, { timeout: 10000 });

    // Submit search
    await session.click(this.config.selectors.searchButton, { timeout: 5000 });

    // Wait for results with retry logic
    await this.waitForResults(session);
  }

  private async waitForResults(session: AnchorSession): Promise<void> {
    const { maxAttempts, backoffMs } = this.config.retryConfig;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await session.waitForSelector(this.config.selectors.hotelCard, {
          timeout: 30000,
          visible: true
        });
        return; // Success
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new ExtractionError('No hotel results found after maximum retries');
        }
        
        console.log(`Results not ready, attempt ${attempt}/${maxAttempts}, retrying in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  private async extractHotelData(session: AnchorSession): Promise<any[]> {
    return await session.extractMultiple({
      selector: this.config.selectors.hotelCard,
      timeout: 15000,
      maxResults: 50,
      fields: {
        name: this.config.selectors.hotelName,
        address: this.config.selectors.hotelAddress,
        starRating: this.config.selectors.starRating,
        description: this.config.selectors.description,
        pricing: {
          perNight: this.config.selectors.pricePerNight,
          total: this.config.selectors.totalPrice
        },
        commission: this.config.selectors.commission,
        booking: {
          selectUrl: `${this.config.selectors.selectButton}@href`,
          giataId: `${this.config.selectors.giataId}@data-giata-id`
        },
        location: {
          coordinates: `${this.config.selectors.coordinates}@data-marker`
        }
      }
    });
  }

  protected transformRawData(rawData: any[]): HotelResult[] {
    return rawData.map((raw, index) => {
      try {
        return {
          id: raw.booking?.giataId || `cpmaxx_${Date.now()}_${index}`,
          category: 'hotel' as const,
          name: this.cleanText(raw.name) || 'Unknown Hotel',
          description: this.cleanText(raw.description),

          pricing: {
            basePrice: {
              amount: this.parsePrice(raw.pricing?.perNight) || 0,
              currency: 'USD',
              unit: 'per night'
            },
            totalPrice: {
              amount: this.parsePrice(raw.pricing?.total) || 0,
              currency: 'USD'
            }
          },

          availability: {
            available: true,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
          },

          hotelDetails: {
            starRating: this.parseStarRating(raw.starRating),
            propertyType: 'hotel' as const,
            chainInfo: this.extractChainInfo(raw.name)
          },

          location: {
            address: {
              full: this.cleanText(raw.address) || '',
              city: this.extractCity(raw.address),
              state: this.extractState(raw.address),
              country: 'USA'
            },
            coordinates: this.parseCoordinates(raw.location?.coordinates)
          },

          specialPrograms: [{
            type: 'business' as const,
            name: 'Travel Agent Commission',
            description: 'Commission available for travel agents',
            benefits: [this.cleanText(raw.commission) || 'Commission available']
          }],

          source: {
            platform: 'cpmaxx',
            url: raw.booking?.selectUrl,
            bookingUrl: raw.booking?.selectUrl,
            lastUpdated: new Date().toISOString()
          },

          extraction: {
            confidence: this.calculateItemConfidence(raw),
            completeness: this.calculateItemCompleteness(raw),
            warnings: this.generateItemWarnings(raw)
          }
        };
      } catch (error) {
        console.error(`Error transforming hotel data at index ${index}:`, error);
        return null;
      }
    }).filter(Boolean);
  }

  protected calculateQuality(data: any[]): QualityMetrics {
    if (data.length === 0) {
      return { confidence: 0, completeness: 0, accuracy: 0, consistency: 0 };
    }

    const confidenceSum = data.reduce((sum, item) => 
      sum + this.calculateItemConfidence(item), 0
    );
    
    const completenessSum = data.reduce((sum, item) => 
      sum + this.calculateItemCompleteness(item), 0
    );

    return {
      confidence: confidenceSum / data.length,
      completeness: completenessSum / data.length,
      accuracy: this.estimateAccuracy(data),
      consistency: this.measureConsistency(data)
    };
  }

  private calculateItemConfidence(item: any): number {
    let score = 0.5; // Base confidence

    if (item.name) score += 0.2;
    if (item.address) score += 0.15;
    if (item.pricing?.perNight) score += 0.1;
    if (item.pricing?.total) score += 0.05;
    if (item.starRating) score += 0.05;
    if (item.booking?.giataId) score += 0.05;

    return Math.min(score, 1.0);
  }

  private calculateItemCompleteness(item: any): number {
    const requiredFields = ['name', 'address', 'pricing'];
    const optionalFields = ['starRating', 'description', 'commission', 'booking'];
    
    const requiredScore = requiredFields.filter(field => 
      this.hasValidValue(item, field)
    ).length / requiredFields.length;
    
    const optionalScore = optionalFields.filter(field => 
      this.hasValidValue(item, field)
    ).length / optionalFields.length;
    
    return (requiredScore * 0.8) + (optionalScore * 0.2);
  }

  // Utility methods for data parsing and validation
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;
    const cleanPrice = priceText.replace(/[^0-9.]/g, '');
    return parseFloat(cleanPrice) || 0;
  }

  private parseStarRating(starElement: any): number {
    if (!starElement) return 0;
    // Count star elements or parse rating text
    const starCount = starElement.match(/fa-star/g)?.length || 0;
    return Math.min(starCount, 5);
  }

  private parseCoordinates(coordsText: string): { latitude: number; longitude: number } | undefined {
    try {
      const coords = JSON.parse(coordsText || '{}');
      if (coords.lat && coords.lng) {
        return {
          latitude: parseFloat(coords.lat),
          longitude: parseFloat(coords.lng)
        };
      }
    } catch {}
    return undefined;
  }

  private extractChainInfo(hotelName: string): { chain: string; brand?: string } | undefined {
    const chains = {
      'Marriott': ['Marriott', 'Courtyard', 'Residence Inn', 'SpringHill'],
      'Hilton': ['Hilton', 'Hampton Inn', 'Embassy Suites', 'Homewood'],
      'IHG': ['Holiday Inn', 'Candlewood', 'Staybridge', 'Crown Plaza'],
      'Hyatt': ['Hyatt', 'Grand Hyatt', 'Hyatt Place', 'Hyatt House']
    };

    for (const [chain, brands] of Object.entries(chains)) {
      for (const brand of brands) {
        if (hotelName?.includes(brand)) {
          return { chain, brand };
        }
      }
    }
    return undefined;
  }

  private cleanText(text: any): string {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  private extractCity(address: string): string {
    if (!address) return '';
    // Extract city from "123 Main St, CityName, ST 12345" format
    const parts = address.split(',');
    return parts[1]?.trim() || '';
  }

  private extractState(address: string): string {
    if (!address) return '';
    // Extract state from address format
    const stateMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
    return stateMatch?.[1] || '';
  }

  private hasValidValue(obj: any, path: string): boolean {
    const value = this.getNestedValue(obj, path);
    return value !== null && value !== undefined && value !== '';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateCost(durationMs: number): any {
    const hours = durationMs / (1000 * 60 * 60);
    const sessionCost = 0.01; // Creation cost
    const runtimeCost = hours * 0.05; // Runtime cost
    const dataCost = 0.005; // Estimated data transfer cost
    
    return {
      sessionCost,
      dataCost,
      totalCost: sessionCost + runtimeCost + dataCost
    };
  }

  private generateWarnings(data: any[]): string[] {
    const warnings: string[] = [];
    
    if (data.length === 0) {
      warnings.push('No hotel results found');
    }
    
    if (data.length < 5) {
      warnings.push('Limited results returned - search may be too specific');
    }
    
    const missingPrices = data.filter(item => !item.pricing?.perNight).length;
    if (missingPrices > 0) {
      warnings.push(`${missingPrices} hotels missing price information`);
    }

    return warnings;
  }

  private generateItemWarnings(item: any): string[] {
    const warnings: string[] = [];
    
    if (!item.name) warnings.push('Missing hotel name');
    if (!item.address) warnings.push('Missing address information');
    if (!item.pricing?.perNight) warnings.push('Missing price per night');
    if (!item.starRating) warnings.push('Missing star rating');
    
    return warnings;
  }
}
```

### 4. VAX Extractor (Vacation Packages)
```typescript
// src/extractors/platforms/vax-extractor.ts
export class VAXExtractor extends BaseExtractor<PackageResult> {
  private static readonly CONFIG: ExtractorConfig = {
    platform: 'vax',
    baseUrl: 'https://vax.com',
    timeout: 120000, // Longer timeout for package searches
    resourceBlocking: {
      images: true,
      stylesheets: false, // Keep CSS for better element detection
      media: true,
      fonts: true,
      scripts: false
    },
    selectors: {
      searchForm: '.search-form',
      destinationInput: '[name="destination"]',
      departureInput: '[name="departure"]',
      returnInput: '[name="return"]',
      travelerSelect: '[name="travelers"]',
      searchButton: '.search-btn',
      packageCard: '.package-result',
      packageName: '.package-title',
      destination: '.destination-info',
      duration: '.duration',
      price: '.package-price',
      originalPrice: '.original-price',
      savings: '.savings-amount',
      inclusions: '.inclusions li',
      flightInfo: '.flight-details',
      hotelInfo: '.hotel-details',
      bookingButton: '.book-now'
    },
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 3000
    }
  };

  async extract(params: PackageSearchParams): Promise<ExtractionResult<PackageResult>> {
    // Implementation similar to CPMaxx but for vacation packages
    // Focus on extracting flight+hotel combinations, all-inclusive deals
    // Transform to PackageResult schema with component breakdown
  }

  protected transformRawData(rawData: any[]): PackageResult[] {
    return rawData.map(raw => ({
      id: `vax_${Date.now()}_${Math.random()}`,
      category: 'package' as const,
      name: raw.packageName,
      
      packageType: this.determinePackageType(raw),
      
      components: {
        flights: this.extractFlightComponents(raw.flightInfo),
        hotels: this.extractHotelComponents(raw.hotelInfo),
        // Additional components...
      },
      
      packageDetails: {
        destination: {
          primary: this.extractPrimaryDestination(raw.destination),
          // ...
        },
        duration: this.parseDuration(raw.duration),
        // ...
      },
      
      // Standard fields...
      pricing: this.transformPricing(raw),
      source: { platform: 'vax', /* ... */ },
      extraction: this.calculateExtractionMetrics(raw)
    }));
  }
}
```

### 5. Quality Scoring System
```typescript
// src/extractors/base/quality-scorer.ts
export class QualityScorer {
  static calculateOverallQuality(results: any[], platform: string): QualityMetrics {
    if (results.length === 0) {
      return { confidence: 0, completeness: 0, accuracy: 0, consistency: 0 };
    }

    return {
      confidence: this.calculateConfidence(results, platform),
      completeness: this.calculateCompleteness(results, platform), 
      accuracy: this.estimateAccuracy(results, platform),
      consistency: this.measureConsistency(results)
    };
  }

  private static calculateConfidence(results: any[], platform: string): number {
    const platformWeights = this.getPlatformWeights(platform);
    
    return results.reduce((sum, result) => {
      let score = 0.5; // Base confidence
      
      for (const [field, weight] of Object.entries(platformWeights)) {
        if (this.hasValidData(result, field)) {
          score += weight;
        }
      }
      
      return sum + Math.min(score, 1.0);
    }, 0) / results.length;
  }

  private static getPlatformWeights(platform: string): Record<string, number> {
    const weights = {
      cpmaxx: {
        'name': 0.2,
        'pricing.perNight': 0.15,
        'address': 0.1,
        'starRating': 0.05,
        'commission': 0.1
      },
      vax: {
        'name': 0.2,
        'components.flights': 0.15,
        'components.hotels': 0.15,
        'pricing.totalPrice': 0.1
      }
      // Add other platforms...
    };
    
    return weights[platform] || {};
  }
}
```

## Implementation Steps

### Step 1: Base Architecture (Day 1)
1. Create base extractor classes and interfaces
2. Implement quality scoring system
3. Set up data transformation utilities
4. Create error handling framework

### Step 2: CPMaxx Extractor (Day 2)
1. Implement CPMaxx-specific extraction logic
2. Create hotel data transformation
3. Add commission data extraction
4. Test with real CPMaxx searches

### Step 3: VAX Extractor (Day 2-3)
1. Implement VAX package extraction
2. Handle flight + hotel combinations
3. Transform to unified package schema
4. Test package search scenarios

### Step 4: Additional Platforms (Day 3-4)
1. Implement Delta Vacations extractor
2. Create NaviTrip cruise extractor
3. Add platform-specific optimizations
4. Cross-platform testing and validation

### Step 5: Integration & Testing (Day 4)
1. Integration with session pool manager
2. End-to-end testing with cache system
3. Performance optimization
4. Error handling and recovery testing

## Testing Strategy

### Unit Tests
- [ ] Individual extractor implementations
- [ ] Data transformation accuracy
- [ ] Quality scoring algorithms
- [ ] Price parsing and validation

### Integration Tests
- [ ] Multi-platform extraction workflows
- [ ] Cache integration with extractors
- [ ] Error handling and retry logic
- [ ] Performance under various load conditions

### Manual Testing
- [ ] Real search scenarios for each platform
- [ ] Edge cases and error conditions
- [ ] Data quality validation
- [ ] Cost tracking accuracy

## Performance Targets

- **Extraction Time**: < 90 seconds per platform
- **Success Rate**: > 95% for valid searches
- **Data Quality**: > 0.8 confidence score average
- **Cost per Search**: < $0.10 including retries
- **Memory Usage**: < 100MB per extraction

## Risk Mitigation

### Platform Changes
- Implement selector fallbacks
- Add structure change detection
- Create manual override capabilities
- Monitor extraction success rates

### Data Quality Issues  
- Multi-level validation
- Confidence scoring thresholds
- Manual quality review triggers
- Error reporting and alerting

## Deliverables

1. **Complete Extractor Suite** for all target platforms
2. **Quality Scoring System** with confidence metrics
3. **Data Transformation Pipeline** to unified schemas  
4. **Error Handling Framework** with retry logic
5. **Performance Monitoring** and optimization
6. **Test Suite** covering all extraction scenarios

## Next Steps

After completion:
- TASK-0057: Session Pool Management Integration
- TASK-0058: Cost Optimization Engine
- TASK-0059: Cache System Integration
- TASK-0060: Production Deployment