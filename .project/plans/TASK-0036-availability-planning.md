# Task: Availability-First Planning System
**Phase**: 3 - Proposal Generation System  
**Priority**: Medium  
**Duration**: 2-3 days  
**Dependencies**: phase2-1-chrome-mcp-extraction, phase2-2-commission-engine  

## Objective
Implement an availability-first planning approach that starts with real-time hotel availability and builds itineraries around confirmed options.

## Deliverables
- [ ] L/M/H hotel selection algorithm
- [ ] Availability checking workflows
- [ ] Real-time pricing updates
- [ ] Smart recommendation engine

## Implementation Steps

### 1. Availability-First Architecture (Day 1)
**Location**: `/remote-mcp-servers/d1-database-improved/src/services/availability-planner.ts`

#### Core Concepts
```typescript
interface AvailabilityPlan {
  trip_id: string;
  
  // Search performed
  search_params: {
    destination: string;
    check_in: string;
    check_out: string;
    rooms: number;
    adults: number;
  };
  
  // Available options found
  available_hotels: HotelOption[];
  
  // Selected shortlist (L/M/H)
  shortlist: {
    luxury: HotelOption[];
    moderate: HotelOption[];
    budget: HotelOption[];
  };
  
  // Recommendation
  recommended: HotelOption;
  recommendation_reason: string;
  
  // Metadata
  search_timestamp: string;
  validity_hours: number;
  sites_searched: string[];
}
```

### 2. L/M/H Selection Algorithm (Day 1)
**Location**: `/src/services/hotel-selector.ts`

#### Price Segmentation
```typescript
export class HotelSegmentation {
  segment(hotels: HotelOption[]): SegmentedHotels {
    // Calculate price distribution
    const prices = hotels.map(h => h.lead_price.amount);
    const stats = this.calculateStats(prices);
    
    // Define segments
    const segments = {
      luxury: {
        min: stats.percentile(75),
        max: stats.max,
        target_count: 2
      },
      moderate: {
        min: stats.percentile(25),
        max: stats.percentile(75),
        target_count: 3
      },
      budget: {
        min: stats.min,
        max: stats.percentile(25),
        target_count: 1
      }
    };
    
    // Assign hotels to segments
    return this.assignToSegments(hotels, segments);
  }
  
  private assignToSegments(
    hotels: HotelOption[],
    segments: SegmentDefinition
  ): SegmentedHotels {
    const result = {
      luxury: [],
      moderate: [],
      budget: []
    };
    
    for (const hotel of hotels) {
      const price = hotel.lead_price.amount;
      
      if (price >= segments.luxury.min) {
        result.luxury.push(hotel);
      } else if (price >= segments.moderate.min) {
        result.moderate.push(hotel);
      } else {
        result.budget.push(hotel);
      }
    }
    
    // Select best from each segment
    return {
      luxury: this.selectBest(result.luxury, segments.luxury.target_count),
      moderate: this.selectBest(result.moderate, segments.moderate.target_count),
      budget: this.selectBest(result.budget, segments.budget.target_count)
    };
  }
  
  private selectBest(
    hotels: HotelOption[],
    count: number
  ): HotelOption[] {
    // Score and rank hotels
    const scored = hotels.map(hotel => ({
      hotel,
      score: this.scoreHotel(hotel)
    }));
    
    // Sort by score and take top N
    scored.sort((a, b) => b.score - a.score);
    
    return scored
      .slice(0, count)
      .map(s => s.hotel);
  }
  
  private scoreHotel(hotel: HotelOption): number {
    let score = 0;
    
    // Location score (closer to center is better)
    if (hotel.distance_to_center) {
      score += (10 - Math.min(hotel.distance_to_center, 10)) * 10;
    }
    
    // Review score
    if (hotel.review_score) {
      score += hotel.review_score * 10;
    }
    
    // Commission bonus
    if (hotel.commission_amount) {
      score += Math.min(hotel.commission_amount / 10, 20);
    }
    
    // Refundable bonus
    if (hotel.refundable) {
      score += 15;
    }
    
    // Star rating
    if (hotel.star_rating) {
      score += hotel.star_rating * 5;
    }
    
    return score;
  }
}
```

### 3. Availability Checking Workflow (Day 2)
**Location**: `/src/workflows/availability-check.ts`

#### Real-time Availability Check
```typescript
export class AvailabilityChecker {
  private extractors: Map<string, SiteExtractor>;
  
  async checkAvailability(
    trip: Trip,
    options?: CheckOptions
  ): Promise<AvailabilityResult> {
    const sites = options?.sites || ['navitrip', 'trisept', 'vax'];
    const results = [];
    
    // Parallel extraction from multiple sites
    const promises = sites.map(site => 
      this.extractFromSite(site, trip.search_params)
        .catch(error => ({
          site,
          error: error.message,
          hotels: []
        }))
    );
    
    const siteResults = await Promise.all(promises);
    
    // Merge and deduplicate results
    const merged = this.mergeResults(siteResults);
    
    // Segment into L/M/H
    const segmented = new HotelSegmentation().segment(merged);
    
    // Store in cache
    await this.cacheResults(trip.id, merged);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(segmented, trip);
    
    return {
      hotels_found: merged.length,
      shortlist: segmented,
      recommendations,
      search_timestamp: new Date().toISOString(),
      validity_hours: 24
    };
  }
  
  private mergeResults(
    siteResults: SiteResult[]
  ): HotelOption[] {
    const hotelMap = new Map<string, HotelOption>();
    
    for (const result of siteResults) {
      for (const hotel of result.hotels) {
        const key = hotel.giata_id || `${hotel.site}_${hotel.site_id}`;
        
        // Keep best price if duplicate
        if (hotelMap.has(key)) {
          const existing = hotelMap.get(key)!;
          if (hotel.lead_price.amount < existing.lead_price.amount) {
            hotelMap.set(key, hotel);
          }
        } else {
          hotelMap.set(key, hotel);
        }
      }
    }
    
    return Array.from(hotelMap.values());
  }
}
```

### 4. Smart Recommendation Engine (Day 2)
**Location**: `/src/services/recommendation-engine.ts`

#### Recommendation Logic
```typescript
export class RecommendationEngine {
  generateRecommendations(
    segmented: SegmentedHotels,
    trip: Trip,
    client?: Client
  ): Recommendation[] {
    const recommendations = [];
    
    // Primary recommendation based on client history
    const primary = this.selectPrimary(segmented, client);
    recommendations.push({
      hotel: primary,
      type: 'primary',
      reason: this.explainPrimary(primary, client)
    });
    
    // Value recommendation (best commission/price ratio)
    const value = this.selectBestValue(segmented);
    if (value && value.id !== primary.id) {
      recommendations.push({
        hotel: value,
        type: 'value',
        reason: 'Best value with excellent commission potential'
      });
    }
    
    // Luxury upsell if appropriate
    if (this.shouldSuggestUpsell(client, trip)) {
      const luxury = segmented.luxury[0];
      if (luxury && luxury.id !== primary.id) {
        recommendations.push({
          hotel: luxury,
          type: 'upsell',
          reason: 'Premium experience for special occasion'
        });
      }
    }
    
    return recommendations;
  }
  
  private selectPrimary(
    segmented: SegmentedHotels,
    client?: Client
  ): HotelOption {
    // Use client preferences and history
    if (client?.preferences?.preferred_tier) {
      const tier = client.preferences.preferred_tier;
      const options = segmented[tier];
      if (options.length > 0) {
        return options[0];
      }
    }
    
    // Default to best moderate option
    return segmented.moderate[0] || segmented.luxury[0] || segmented.budget[0];
  }
  
  private selectBestValue(
    segmented: SegmentedHotels
  ): HotelOption | null {
    const allHotels = [
      ...segmented.luxury,
      ...segmented.moderate,
      ...segmented.budget
    ];
    
    let bestValue = null;
    let bestScore = 0;
    
    for (const hotel of allHotels) {
      const score = this.calculateValueScore(hotel);
      if (score > bestScore) {
        bestScore = score;
        bestValue = hotel;
      }
    }
    
    return bestValue;
  }
  
  private calculateValueScore(hotel: HotelOption): number {
    const price = hotel.lead_price.amount;
    const commission = hotel.commission_amount || 0;
    const rating = hotel.star_rating || 3;
    const review = hotel.review_score || 7;
    
    // Value = (Quality * Commission) / Price
    const quality = (rating * 20) + (review * 10);
    const value = (quality * (1 + commission / price)) / Math.log(price);
    
    return value;
  }
}
```

### 5. Real-time Pricing Updates (Day 3)
**Location**: `/src/services/price-monitor.ts`

#### Price Monitoring Service
```typescript
export class PriceMonitor {
  private updateQueue: UpdateQueue;
  
  async schedulePriceUpdate(
    tripId: string,
    hotelIds: string[]
  ): Promise<void> {
    // Add to update queue
    await this.updateQueue.add({
      trip_id: tripId,
      hotel_ids: hotelIds,
      scheduled_at: new Date().toISOString(),
      priority: 'normal'
    });
  }
  
  async processPriceUpdates(): Promise<void> {
    const updates = await this.updateQueue.getNext(10);
    
    for (const update of updates) {
      try {
        await this.updatePrices(update);
        await this.updateQueue.markComplete(update.id);
      } catch (error) {
        await this.updateQueue.markFailed(update.id, error.message);
      }
    }
  }
  
  private async updatePrices(
    update: PriceUpdate
  ): Promise<void> {
    // Fetch current prices
    const currentPrices = await this.fetchCurrentPrices(
      update.hotel_ids
    );
    
    // Compare with cached prices
    const changes = await this.detectPriceChanges(
      update.trip_id,
      currentPrices
    );
    
    // Update cache if changed
    if (changes.length > 0) {
      await this.updateCache(changes);
      
      // Notify if significant change
      if (this.isSignificantChange(changes)) {
        await this.notifyPriceChange(update.trip_id, changes);
      }
    }
  }
}
```

### 6. Availability-First Workflow Integration (Day 3)
**Location**: `/src/tools/availability-tools.ts`

#### Tool: `check_availability`
```typescript
{
  name: 'check_availability',
  description: 'Check real-time hotel availability for a trip',
  inputSchema: {
    trip_id: string;
    sites?: string[];
    force_refresh?: boolean;
    return_shortlist_only?: boolean;
  }
}
```

#### Tool: `update_prices`
```typescript
{
  name: 'update_prices',
  description: 'Update prices for selected hotels',
  inputSchema: {
    trip_id: string;
    hotel_ids: string[];
    notify_changes?: boolean;
  }
}
```

#### Tool: `get_recommendations`
```typescript
{
  name: 'get_recommendations',
  description: 'Get AI-powered hotel recommendations',
  inputSchema: {
    trip_id: string;
    client_id?: string;
    preferences?: {
      max_budget?: number;
      preferred_tier?: 'luxury' | 'moderate' | 'budget';
      must_have_amenities?: string[];
      location_preference?: string;
    };
  }
}
```

## Success Criteria
- Availability checks complete in <60 seconds
- L/M/H segmentation accurately reflects market
- Recommendations align with client preferences
- Price updates detect >90% of changes
- System handles site failures gracefully

## Testing Strategy

### Unit Tests
- [ ] Segmentation algorithm accuracy
- [ ] Scoring logic validation
- [ ] Recommendation engine logic
- [ ] Price comparison accuracy

### Integration Tests
- [ ] End-to-end availability checking
- [ ] Multi-site result merging
- [ ] Cache update workflows
- [ ] Price monitoring system

### Performance Tests
- [ ] Parallel site extraction speed
- [ ] Large dataset segmentation
- [ ] Cache query performance
- [ ] Price update throughput

## Notes
- Consider implementing availability alerts
- Add support for date flexibility searching
- Plan for group booking availability
- Consider seasonal pricing patterns
- Implement availability prediction based on historical data