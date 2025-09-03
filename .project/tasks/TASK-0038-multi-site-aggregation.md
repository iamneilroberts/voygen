# Task: Multi-Site Data Aggregation
**Phase**: 4 - Advanced Features  
**Priority**: Medium  
**Duration**: 2-3 days  
**Dependencies**: TASK-0033-chrome-mcp-extraction, TASK-0034-commission-engine  

## Objective
Implement parallel extraction workflows with data quality scoring and conflict resolution for duplicate hotels across multiple travel booking sites.

## Deliverables
- [ ] Parallel extraction workflows
- [ ] Data quality scoring system
- [ ] Conflict resolution for duplicate hotels
- [ ] Site performance monitoring

## Implementation Steps

### 1. Parallel Extraction Orchestrator (Day 1)
**Location**: `/mcp-local-servers/mcp-chrome/src/orchestrator/parallel-extractor.ts`

#### Multi-Site Coordinator
```typescript
export class ParallelExtractor {
  private siteExtractors: Map<string, SiteExtractor>;
  private maxConcurrency: number = 3;
  
  async extractFromAllSites(
    searchParams: SearchParams
  ): Promise<AggregatedResults> {
    const sites = ['navitrip', 'trisept', 'vax'];
    const sessionId = this.generateSessionId();
    
    // Initialize extraction session
    await this.initializeSession(sessionId, sites, searchParams);
    
    // Start parallel extractions
    const extractionPromises = sites.map(site => 
      this.extractFromSite(site, searchParams, sessionId)
        .catch(error => ({
          site,
          success: false,
          error: error.message,
          hotels: [],
          rooms: []
        }))
    );
    
    // Wait for all extractions to complete or timeout
    const results = await Promise.allSettled(extractionPromises);
    
    // Process and aggregate results
    const aggregated = await this.aggregateResults(results, sessionId);
    
    // Update session status
    await this.finalizeSession(sessionId, aggregated);
    
    return aggregated;
  }
  
  private async extractFromSite(
    site: string,
    params: SearchParams,
    sessionId: string
  ): Promise<SiteExtractionResult> {
    const extractor = this.siteExtractors.get(site);
    if (!extractor) {
      throw new Error(`No extractor available for site: ${site}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Attempt extraction with retries
      const result = await this.extractWithRetry(
        extractor,
        params,
        { maxRetries: 2, backoff: 1000 }
      );
      
      const duration = Date.now() - startTime;
      
      // Log successful extraction
      await this.logExtractionAttempt(sessionId, site, {
        status: 'success',
        hotels_found: result.hotels.length,
        rooms_found: result.rooms.length,
        duration_ms: duration
      });
      
      return {
        site,
        success: true,
        hotels: result.hotels,
        rooms: result.rooms,
        metadata: {
          duration_ms: duration,
          pages_scraped: result.pages_scraped,
          requests_made: result.requests_made
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed extraction
      await this.logExtractionAttempt(sessionId, site, {
        status: 'failed',
        error: error.message,
        duration_ms: duration
      });
      
      throw error;
    }
  }
}
```

### 2. Data Quality Scoring (Day 1-2)
**Location**: `/src/services/data-quality.ts`

#### Quality Assessment System
```typescript
export class DataQualityScorer {
  scoreHotel(hotel: HotelOption, site: string): QualityScore {
    let score = 100; // Start with perfect score
    const issues = [];
    
    // Completeness checks
    if (!hotel.name) {
      score -= 30;
      issues.push('Missing hotel name');
    }
    
    if (!hotel.lead_price?.amount) {
      score -= 25;
      issues.push('Missing price information');
    }
    
    if (!hotel.location || !hotel.city) {
      score -= 15;
      issues.push('Incomplete location data');
    }
    
    if (!hotel.images || hotel.images.length === 0) {
      score -= 10;
      issues.push('No images available');
    }
    
    // Accuracy checks
    if (hotel.lead_price?.amount < 10 || hotel.lead_price?.amount > 10000) {
      score -= 20;
      issues.push('Suspicious price range');
    }
    
    if (hotel.star_rating && (hotel.star_rating < 1 || hotel.star_rating > 5)) {
      score -= 15;
      issues.push('Invalid star rating');
    }
    
    // Site-specific adjustments
    score += this.getSiteReliabilityBonus(site);
    
    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      completeness: this.calculateCompleteness(hotel),
      reliability: this.getSiteReliability(site)
    };
  }
  
  private calculateCompleteness(hotel: HotelOption): number {
    const fields = [
      'name', 'city', 'lead_price', 'star_rating', 
      'review_score', 'images', 'amenities', 'coordinates'
    ];
    
    const completedFields = fields.filter(field => 
      hotel[field] && (
        !Array.isArray(hotel[field]) || hotel[field].length > 0
      )
    ).length;
    
    return (completedFields / fields.length) * 100;
  }
  
  private getSiteReliability(site: string): number {
    const siteScores = {
      'navitrip': 90,  // Most reliable, consistent data
      'trisept': 85,   // Good reliability
      'vax': 80        // Decent but sometimes incomplete
    };
    
    return siteScores[site] || 70;
  }
}
```

### 3. Conflict Resolution System (Day 2)
**Location**: `/src/services/conflict-resolver.ts`

#### Duplicate Detection and Resolution
```typescript
export class ConflictResolver {
  async resolveDuplicates(
    hotels: HotelOption[]
  ): Promise<ResolvedHotels> {
    // Group by potential duplicates
    const groups = this.groupPotentialDuplicates(hotels);
    
    const resolved = [];
    const conflicts = [];
    
    for (const group of groups) {
      if (group.length === 1) {
        resolved.push(group[0]);
      } else {
        const resolution = await this.resolveConflict(group);
        resolved.push(resolution.primary);
        
        if (resolution.hasConflict) {
          conflicts.push({
            primary: resolution.primary,
            alternates: resolution.alternates,
            resolution_reason: resolution.reason
          });
        }
      }
    }
    
    return {
      resolved_hotels: resolved,
      conflicts_detected: conflicts.length,
      conflict_details: conflicts
    };
  }
  
  private groupPotentialDuplicates(
    hotels: HotelOption[]
  ): HotelOption[][] {
    const groups = [];
    const processed = new Set<string>();
    
    for (const hotel of hotels) {
      if (processed.has(hotel.site_id)) continue;
      
      const duplicates = hotels.filter(h => 
        h !== hotel && 
        !processed.has(h.site_id) &&
        this.isPotentialDuplicate(hotel, h)
      );
      
      if (duplicates.length > 0) {
        const group = [hotel, ...duplicates];
        groups.push(group);
        
        // Mark all as processed
        for (const h of group) {
          processed.add(h.site_id);
        }
      } else if (!processed.has(hotel.site_id)) {
        groups.push([hotel]);
        processed.add(hotel.site_id);
      }
    }
    
    return groups;
  }
  
  private isPotentialDuplicate(
    hotel1: HotelOption,
    hotel2: HotelOption
  ): boolean {
    // GIATA ID match (most reliable)
    if (hotel1.giata_id && hotel2.giata_id) {
      return hotel1.giata_id === hotel2.giata_id;
    }
    
    // Name similarity
    const nameSimilarity = this.calculateStringSimilarity(
      hotel1.name.toLowerCase(),
      hotel2.name.toLowerCase()
    );
    
    if (nameSimilarity < 0.8) return false;
    
    // Location proximity
    if (hotel1.coordinates && hotel2.coordinates) {
      const distance = this.calculateDistance(
        hotel1.coordinates,
        hotel2.coordinates
      );
      
      // Hotels within 100m are likely duplicates
      if (distance > 0.1) return false;
    }
    
    // City must match
    if (hotel1.city.toLowerCase() !== hotel2.city.toLowerCase()) {
      return false;
    }
    
    return true;
  }
  
  private async resolveConflict(
    duplicates: HotelOption[]
  ): Promise<ConflictResolution> {
    // Score each option
    const scored = duplicates.map(hotel => ({
      hotel,
      quality: new DataQualityScorer().scoreHotel(hotel, hotel.site),
      price: hotel.lead_price?.amount || 0
    }));
    
    // Sort by quality first, then by best price
    scored.sort((a, b) => {
      if (Math.abs(a.quality.score - b.quality.score) > 10) {
        return b.quality.score - a.quality.score;
      }
      return a.price - b.price; // Lower price wins if quality is similar
    });
    
    const primary = scored[0].hotel;
    const alternates = scored.slice(1).map(s => s.hotel);
    
    // Merge complementary data
    const merged = await this.mergeHotelData(primary, alternates);
    
    return {
      primary: merged,
      alternates,
      hasConflict: duplicates.length > 1,
      reason: this.explainResolution(scored)
    };
  }
  
  private async mergeHotelData(
    primary: HotelOption,
    alternates: HotelOption[]
  ): Promise<HotelOption> {
    const merged = { ...primary };
    
    // Merge images from all sources
    const allImages = new Set(primary.images || []);
    for (const alt of alternates) {
      if (alt.images) {
        alt.images.forEach(img => allImages.add(img));
      }
    }
    merged.images = Array.from(allImages);
    
    // Take best review score
    const reviewScores = [primary, ...alternates]
      .map(h => h.review_score)
      .filter(Boolean);
    
    if (reviewScores.length > 0) {
      merged.review_score = Math.max(...reviewScores);
    }
    
    // Merge amenities
    const allAmenities = new Set(primary.amenities || []);
    for (const alt of alternates) {
      if (alt.amenities) {
        alt.amenities.forEach(amenity => allAmenities.add(amenity));
      }
    }
    merged.amenities = Array.from(allAmenities);
    
    // Use most complete address
    const bestAddress = [primary, ...alternates]
      .filter(h => h.address)
      .sort((a, b) => b.address.length - a.address.length)[0];
    
    if (bestAddress) {
      merged.address = bestAddress.address;
    }
    
    return merged;
  }
}
```

### 4. Site Performance Monitoring (Day 2-3)
**Location**: `/src/monitoring/site-monitor.ts`

#### Performance Tracking
```typescript
export class SitePerformanceMonitor {
  private metrics: Map<string, SiteMetrics>;
  
  async trackExtractionPerformance(
    site: string,
    result: SiteExtractionResult
  ): Promise<void> {
    const metrics = this.getOrCreateMetrics(site);
    
    metrics.total_extractions++;
    
    if (result.success) {
      metrics.successful_extractions++;
      metrics.total_hotels_found += result.hotels.length;
      metrics.total_duration_ms += result.metadata.duration_ms;
      
      // Update averages
      metrics.avg_duration_ms = metrics.total_duration_ms / metrics.successful_extractions;
      metrics.avg_hotels_per_search = metrics.total_hotels_found / metrics.successful_extractions;
    } else {
      metrics.failed_extractions++;
      this.recordFailure(site, result.error);
    }
    
    // Update success rate
    metrics.success_rate = metrics.successful_extractions / metrics.total_extractions;
    
    // Check for alerts
    await this.checkPerformanceAlerts(site, metrics);
  }
  
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const siteReports = [];
    
    for (const [site, metrics] of this.metrics) {
      siteReports.push({
        site,
        success_rate: metrics.success_rate,
        avg_duration: metrics.avg_duration_ms,
        avg_hotels_found: metrics.avg_hotels_per_search,
        reliability_score: this.calculateReliabilityScore(metrics),
        recent_issues: metrics.recent_failures.slice(-5)
      });
    }
    
    return {
      report_date: new Date().toISOString(),
      sites: siteReports,
      overall_health: this.calculateOverallHealth(siteReports),
      recommendations: this.generateRecommendations(siteReports)
    };
  }
  
  private calculateReliabilityScore(metrics: SiteMetrics): number {
    let score = 100;
    
    // Success rate impact (0-40 points)
    score -= (1 - metrics.success_rate) * 40;
    
    // Performance impact (0-30 points)
    if (metrics.avg_duration_ms > 120000) { // > 2 minutes
      score -= 30;
    } else if (metrics.avg_duration_ms > 60000) { // > 1 minute
      score -= 15;
    }
    
    // Data quality impact (0-30 points)
    if (metrics.avg_hotels_per_search < 10) {
      score -= 30;
    } else if (metrics.avg_hotels_per_search < 20) {
      score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}
```

### 5. MCP Tool Integration (Day 3)
**Location**: `/src/tools/aggregation-tools.ts`

#### Tool: `extract_from_all_sites`
```typescript
{
  name: 'extract_from_all_sites',
  description: 'Extract hotel data from all available travel sites',
  inputSchema: {
    trip_id: string;
    search_params: SearchParams;
    options?: {
      sites?: string[];
      resolve_conflicts?: boolean;
      min_quality_score?: number;
      timeout_minutes?: number;
    };
  }
}
```

#### Tool: `get_site_performance`
```typescript
{
  name: 'get_site_performance',
  description: 'Get performance metrics for extraction sites',
  inputSchema: {
    period_days?: number;
    include_details?: boolean;
  }
}
```

## Success Criteria
- Parallel extraction completes 3x faster than sequential
- Conflict resolution identifies >95% of duplicates
- Data quality scores accurately reflect completeness
- Site monitoring detects performance degradation
- System handles partial failures gracefully

## Testing Strategy

### Unit Tests
- [ ] Duplicate detection accuracy
- [ ] Data quality scoring consistency
- [ ] Conflict resolution logic
- [ ] Performance metric calculations

### Integration Tests
- [ ] Parallel extraction coordination
- [ ] Cross-site data merging
- [ ] Error recovery mechanisms
- [ ] Monitoring alert generation

### Performance Tests
- [ ] Parallel vs sequential extraction speed
- [ ] Memory usage under concurrent load
- [ ] Large dataset conflict resolution
- [ ] Site failure recovery time

## Notes
- Consider implementing site-specific rate limiting
- Add support for partial extraction recovery
- Plan for adding new sites dynamically
- Implement data freshness indicators
- Consider implementing extraction scheduling