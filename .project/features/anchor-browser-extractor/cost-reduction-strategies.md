# Anchor Browser Cost Reduction Strategies

## Overview

This document outlines comprehensive cost optimization strategies for Anchor Browser API usage in the Voygen travel extraction system. With Anchor's pricing model of $0.01 per browser creation + $0.05 per browser hour + $4 per GB of proxy data, implementing these strategies can reduce costs by 92-98%.

## Current Cost Analysis

### Baseline Costs (Inefficient Usage)
- **Browser Creation**: $0.01 per search
- **Browser Runtime**: $0.25 (5 minutes @ $0.05/hour)
- **Data Transfer**: $0.10 (25MB @ $4/GB)
- **Total per Search**: $0.36
- **Monthly (100 searches)**: $36

### Target Costs (Optimized Usage)
- **Browser Creation**: $0.002 (reused sessions)
- **Browser Runtime**: $0.075 (90 seconds @ $0.05/hour) 
- **Data Transfer**: $0.008 (2MB @ $4/GB)
- **Total per Search**: $0.085
- **Monthly (100 searches)**: $0.85
- **Cost Reduction**: 92%

## Strategy 1: Session Reuse & Pooling

### Problem
Creating new browser sessions for each search operation results in excessive $0.01 charges and setup overhead.

### Solution: Session Pool Management

```typescript
export class AnchorSessionPool {
  private sessions: Map<string, AnchorSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private maxSessions: number = 3,
    private sessionTTL: number = 300000 // 5 minutes
  ) {}
  
  async getSession(platform: string = 'default'): Promise<AnchorSession> {
    const sessionKey = `${platform}_session`;
    
    // Return existing session if available
    if (this.sessions.has(sessionKey)) {
      this.refreshSessionTimeout(sessionKey);
      return this.sessions.get(sessionKey)!;
    }
    
    // Create new session if under limit
    if (this.sessions.size < this.maxSessions) {
      const session = await this.createNewSession(platform);
      this.sessions.set(sessionKey, session);
      this.setSessionTimeout(sessionKey);
      return session;
    }
    
    // Reuse least recently used session
    const oldestSession = this.getOldestSession();
    await this.resetSession(oldestSession);
    return oldestSession;
  }
  
  private async createNewSession(platform: string): Promise<AnchorSession> {
    const session = await anchor.createSession({
      platform,
      stealth: true,
      proxy: { type: 'residential', country: 'US' }
    });
    
    console.log(`Created new session for ${platform} - Cost: $0.01`);
    return session;
  }
  
  private setSessionTimeout(sessionKey: string): void {
    const timeout = setTimeout(() => {
      this.cleanupSession(sessionKey);
    }, this.sessionTTL);
    
    this.sessionTimeouts.set(sessionKey, timeout);
  }
  
  private refreshSessionTimeout(sessionKey: string): void {
    const existingTimeout = this.sessionTimeouts.get(sessionKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    this.setSessionTimeout(sessionKey);
  }
  
  async cleanupSession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      await session.close();
      this.sessions.delete(sessionKey);
      
      const timeout = this.sessionTimeouts.get(sessionKey);
      if (timeout) {
        clearTimeout(timeout);
        this.sessionTimeouts.delete(sessionKey);
      }
    }
  }
  
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.sessions.keys()).map(
      key => this.cleanupSession(key)
    );
    await Promise.all(cleanupPromises);
  }
}

// Usage Example
const sessionPool = new AnchorSessionPool(3, 300000); // 3 sessions, 5 min TTL

export async function batchHotelSearch(destinations: string[]) {
  const session = await sessionPool.getSession('cpmaxx');
  const results: HotelResult[] = [];
  
  for (const destination of destinations) {
    const searchResult = await searchHotelsWithSession(session, destination);
    results.push(...searchResult);
  }
  
  // Session automatically returned to pool, not closed
  return results;
}
```

### Cost Impact
- **Before**: $0.01 × searches = $1.00 for 100 searches
- **After**: $0.01 × (searches ÷ 10) = $0.10 for 100 searches  
- **Savings**: 90%

## Strategy 2: Aggressive Timeout Management

### Problem
Long browser sessions accumulate expensive hour charges even when idle or waiting.

### Solution: Precision Timeout Control

```typescript
export interface SearchTimeoutConfig {
  navigation: number;     // Time to load page
  interaction: number;    // Time for form filling
  results: number;        // Time to wait for results  
  extraction: number;     // Time to extract data
  cleanup: number;        // Time for cleanup
  total: number;          // Maximum total time
}

const TIMEOUT_CONFIGS: Record<string, SearchTimeoutConfig> = {
  hotel: {
    navigation: 15000,    // 15 seconds
    interaction: 10000,   // 10 seconds  
    results: 45000,       // 45 seconds
    extraction: 15000,    // 15 seconds
    cleanup: 5000,        // 5 seconds
    total: 90000          // 90 seconds total
  },
  flight: {
    navigation: 10000,    // Flights load faster
    interaction: 15000,   // More complex forms
    results: 60000,       // Longer search time
    extraction: 10000,    // Simpler extraction
    cleanup: 5000,
    total: 100000         // 100 seconds total
  }
};

export class TimeoutControlledSearch {
  constructor(private config: SearchTimeoutConfig) {}
  
  async searchWithTimeouts<T>(
    session: AnchorSession,
    searchFn: (session: AnchorSession) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    // Set global timeout to prevent runaway sessions
    const globalTimeout = setTimeout(() => {
      throw new Error(`Search exceeded maximum time: ${this.config.total}ms`);
    }, this.config.total);
    
    try {
      const result = await Promise.race([
        searchFn(session),
        this.createTimeoutPromise(this.config.total)
      ]);
      
      const duration = Date.now() - startTime;
      const cost = this.calculateCost(duration);
      
      console.log(`Search completed in ${duration}ms - Cost: $${cost}`);
      return result;
      
    } finally {
      clearTimeout(globalTimeout);
    }
  }
  
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), timeout);
    });
  }
  
  private calculateCost(durationMs: number): number {
    const hours = durationMs / (1000 * 60 * 60);
    return hours * 0.05; // $0.05 per hour
  }
}

// Usage Example
const hotelTimeoutControl = new TimeoutControlledSearch(TIMEOUT_CONFIGS.hotel);

export async function optimizedHotelSearch(
  session: AnchorSession, 
  params: SearchParams
): Promise<HotelResult[]> {
  return await hotelTimeoutControl.searchWithTimeouts(session, async (session) => {
    // Navigation phase (15 seconds max)
    await session.navigate('https://cpmaxx.cruiseplannersnet.com/hotel-search', {
      timeout: TIMEOUT_CONFIGS.hotel.navigation
    });
    
    // Interaction phase (10 seconds max)  
    await session.fillForm({
      destination: params.destination,
      checkin: params.checkin,
      checkout: params.checkout,
      guests: params.guests
    }, { timeout: TIMEOUT_CONFIGS.hotel.interaction });
    
    // Results phase (45 seconds max)
    await session.waitForResults('.hotel-results', {
      timeout: TIMEOUT_CONFIGS.hotel.results
    });
    
    // Extraction phase (15 seconds max)
    const results = await session.extractHotelData({
      timeout: TIMEOUT_CONFIGS.hotel.extraction
    });
    
    return results;
  });
}
```

### Cost Impact
- **Before**: 5 minutes = $0.25
- **After**: 90 seconds = $0.075
- **Savings**: 70%

## Strategy 3: Smart Caching Strategy

### Problem
Repeated searches for similar parameters result in unnecessary Anchor API calls.

### Solution: Multi-Layer Caching System

```typescript
export interface CachePolicy {
  serviceType: 'hotel' | 'flight' | 'package' | 'rental_car';
  ttlHours: number;
  refreshThreshold: number; // Hours before expiry to trigger background refresh
  maxResults: number;
  compressionLevel: number; // 0-9, higher = smaller storage
}

const CACHE_POLICIES: Record<string, CachePolicy> = {
  hotel: {
    serviceType: 'hotel',
    ttlHours: 24,         // Hotels change slowly
    refreshThreshold: 6,   // Refresh 6 hours before expiry
    maxResults: 50,
    compressionLevel: 6
  },
  flight: {
    serviceType: 'flight', 
    ttlHours: 2,          // Flights change rapidly
    refreshThreshold: 0.5, // Refresh 30 min before expiry
    maxResults: 30,
    compressionLevel: 8
  },
  package: {
    serviceType: 'package',
    ttlHours: 12,         // Packages moderate frequency
    refreshThreshold: 3,   // Refresh 3 hours before expiry  
    maxResults: 20,
    compressionLevel: 7
  }
};

export class SmartCacheManager {
  constructor(
    private db: D1Database,
    private sessionPool: AnchorSessionPool
  ) {}
  
  async searchWithCache<T>(
    serviceType: keyof typeof CACHE_POLICIES,
    searchParams: any,
    searchFn: () => Promise<T>
  ): Promise<{ results: T; cost: number; source: string }> {
    
    const cacheKey = this.generateCacheKey(serviceType, searchParams);
    const policy = CACHE_POLICIES[serviceType];
    
    // 1. Check cache first
    const cached = await this.getCachedResults(cacheKey, policy);
    if (cached) {
      // Background refresh if near expiry
      if (this.shouldBackgroundRefresh(cached, policy)) {
        this.scheduleBackgroundRefresh(cacheKey, searchParams, searchFn);
      }
      
      return {
        results: cached.results,
        cost: 0,
        source: 'cache'
      };
    }
    
    // 2. Cache miss - perform expensive search
    console.log(`Cache miss for ${cacheKey} - performing Anchor search`);
    const startTime = Date.now();
    
    try {
      const results = await searchFn();
      const duration = Date.now() - startTime;
      const cost = this.calculateSearchCost(duration);
      
      // 3. Cache the results
      await this.cacheResults(cacheKey, results, policy);
      
      return {
        results,
        cost,
        source: 'anchor_api'
      };
      
    } catch (error) {
      console.error(`Anchor search failed for ${cacheKey}:`, error);
      
      // Return stale cache as fallback if available
      const staleCache = await this.getStaleCache(cacheKey);
      if (staleCache) {
        return {
          results: staleCache.results,
          cost: 0,
          source: 'stale_cache'
        };
      }
      
      throw error;
    }
  }
  
  private generateCacheKey(serviceType: string, params: any): string {
    // Create deterministic cache key
    const normalized = {
      type: serviceType,
      destination: params.destination?.toLowerCase().trim(),
      dates: {
        start: params.checkin || params.departureDate,
        end: params.checkout || params.returnDate
      },
      occupancy: params.guests || params.travelers || 2,
      // Add service-specific params
      ...(serviceType === 'flight' && {
        origin: params.origin?.toLowerCase().trim(),
        class: params.class || 'economy'
      }),
      ...(serviceType === 'hotel' && {
        starRating: params.starRating,
        maxPrice: params.maxPrice
      })
    };
    
    const hashInput = JSON.stringify(normalized, Object.keys(normalized).sort());
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }
  
  private async getCachedResults(cacheKey: string, policy: CachePolicy): Promise<any> {
    const cached = await this.db.prepare(`
      SELECT results_json, created_at, access_count
      FROM travel_search_cache 
      WHERE cache_key = ? 
        AND service_category = ?
        AND expires_at > datetime('now')
    `).bind(cacheKey, policy.serviceType).first();
    
    if (cached) {
      // Update access tracking
      await this.db.prepare(`
        UPDATE travel_search_cache 
        SET access_count = access_count + 1,
            last_accessed = datetime('now')
        WHERE cache_key = ?
      `).bind(cacheKey).run();
      
      return {
        results: JSON.parse(cached.results_json),
        createdAt: cached.created_at,
        accessCount: cached.access_count
      };
    }
    
    return null;
  }
  
  private shouldBackgroundRefresh(cached: any, policy: CachePolicy): boolean {
    const cacheAge = (Date.now() - new Date(cached.createdAt).getTime()) / (1000 * 60 * 60);
    const refreshThreshold = policy.ttlHours - policy.refreshThreshold;
    return cacheAge >= refreshThreshold;
  }
  
  private async scheduleBackgroundRefresh(
    cacheKey: string,
    searchParams: any,
    searchFn: () => Promise<any>
  ): Promise<void> {
    // Run in background without blocking current request
    setTimeout(async () => {
      try {
        console.log(`Background refresh for ${cacheKey}`);
        const results = await searchFn();
        await this.cacheResults(cacheKey, results, CACHE_POLICIES[searchParams.serviceType]);
      } catch (error) {
        console.error(`Background refresh failed for ${cacheKey}:`, error);
      }
    }, 0);
  }
  
  private calculateSearchCost(durationMs: number): number {
    const hours = durationMs / (1000 * 60 * 60);
    return 0.01 + (hours * 0.05); // Creation + runtime cost
  }
}

// Usage Example
const cacheManager = new SmartCacheManager(env.DB, sessionPool);

export async function cachedHotelSearch(params: SearchParams): Promise<HotelResult[]> {
  const { results, cost, source } = await cacheManager.searchWithCache(
    'hotel',
    params,
    () => performAnchorHotelSearch(params)
  );
  
  console.log(`Hotel search completed - Source: ${source}, Cost: $${cost}`);
  return results;
}
```

### Cost Impact
- **Before**: 100% API calls = $36/month
- **After**: 20% API calls (80% cache hit) = $7.20/month
- **Savings**: 80%

## Strategy 4: Minimize Data Transfer

### Problem
Downloading full web pages with images, CSS, and JavaScript results in expensive proxy data charges.

### Solution: Targeted Data Extraction

```typescript
export class MinimalDataExtractor {
  async optimizedExtraction(
    session: AnchorSession,
    extractionConfig: ExtractionConfig
  ): Promise<ExtractedData> {
    
    // 1. Block unnecessary content before navigation
    await session.setResourceBlocking({
      images: true,      // Block all images
      stylesheets: true, // Block CSS files  
      media: true,       // Block videos/audio
      fonts: true,       // Block font downloads
      scripts: extractionConfig.blockScripts || false // Conditional script blocking
    });
    
    // 2. Navigate with minimal content loading
    await session.navigate(extractionConfig.url, {
      waitUntil: 'domcontentloaded', // Don't wait for full page load
      timeout: 15000
    });
    
    // 3. Extract only specific data elements
    const extractedData = await session.extractStructuredData({
      selectors: extractionConfig.selectors,
      timeout: 10000
    });
    
    // 4. Get data size for cost tracking
    const dataSize = JSON.stringify(extractedData).length;
    const transferCost = (dataSize / 1024 / 1024 / 1024) * 4; // $4/GB
    
    console.log(`Data extracted: ${dataSize} bytes, Transfer cost: $${transferCost}`);
    
    return {
      data: extractedData,
      metadata: {
        dataSize,
        transferCost,
        blocked: ['images', 'stylesheets', 'media', 'fonts']
      }
    };
  }
}

// CPMaxx-specific extraction configuration
const CPMAXX_EXTRACTION_CONFIG: ExtractionConfig = {
  url: 'https://cpmaxx.cruiseplannersnet.com/hotel-search',
  blockScripts: false, // Need scripts for search functionality
  selectors: {
    hotelName: '.hotel-details .title a',
    price: '.pricing-box .min-rate',
    totalPrice: '.pricing-box p:contains("Total:")', 
    rating: '.hotel-details .star',
    address: '.hotel-details .address',
    amenities: '.hotel-details .amenities li',
    commission: '.commission b',
    bookingUrl: '.select-button',
    giataId: '[data-giata-id]'
  }
};

export async function extractCPMaxxHotels(
  session: AnchorSession,
  searchParams: SearchParams
): Promise<HotelResult[]> {
  
  const extractor = new MinimalDataExtractor();
  
  // Fill search form
  await session.fillForm({
    destination: searchParams.destination,
    checkin: searchParams.checkin,
    checkout: searchParams.checkout
  });
  
  await session.submitAndWait('.hotel-results');
  
  // Extract minimal required data only
  const extracted = await extractor.optimizedExtraction(session, CPMAXX_EXTRACTION_CONFIG);
  
  // Transform to standard format
  return transformCPMaxxResults(extracted.data);
}
```

### Cost Impact
- **Before**: 25MB full page = $0.10 per search
- **After**: 2MB data only = $0.008 per search  
- **Savings**: 92%

## Strategy 5: Intelligent Batch Operations

### Problem
Multiple individual searches create redundant session setup and navigation overhead.

### Solution: Smart Batching System

```typescript
export class BatchSearchOptimizer {
  constructor(private sessionPool: AnchorSessionPool) {}
  
  async batchOptimizedSearch(
    requests: SearchRequest[]
  ): Promise<BatchSearchResult[]> {
    
    // 1. Group requests by platform and session requirements
    const platformGroups = this.groupByPlatform(requests);
    
    const results: BatchSearchResult[] = [];
    
    // 2. Process each platform group with dedicated session
    for (const [platform, platformRequests] of platformGroups) {
      const session = await this.sessionPool.getSession(platform);
      
      try {
        // 3. Batch process requests on same session
        const platformResults = await this.processplatformBatch(
          session, 
          platform,
          platformRequests
        );
        
        results.push(...platformResults);
        
      } catch (error) {
        console.error(`Batch processing failed for ${platform}:`, error);
        
        // Fallback to individual processing
        const fallbackResults = await this.fallbackProcessing(
          session, 
          platformRequests
        );
        results.push(...fallbackResults);
      }
    }
    
    return results;
  }
  
  private groupByPlatform(requests: SearchRequest[]): Map<string, SearchRequest[]> {
    const groups = new Map<string, SearchRequest[]>();
    
    for (const request of requests) {
      const platform = this.determinePlatform(request);
      
      if (!groups.has(platform)) {
        groups.set(platform, []);
      }
      
      groups.get(platform)!.push(request);
    }
    
    return groups;
  }
  
  private async processplatformBatch(
    session: AnchorSession,
    platform: string,
    requests: SearchRequest[]
  ): Promise<BatchSearchResult[]> {
    
    const results: BatchSearchResult[] = [];
    
    // Navigate to platform once
    await session.navigate(this.getPlatformBaseUrl(platform));
    
    for (const request of requests) {
      const startTime = Date.now();
      
      try {
        // Perform search without full page reload
        const searchResult = await this.performIncrementalSearch(
          session, 
          request
        );
        
        const duration = Date.now() - startTime;
        
        results.push({
          request,
          result: searchResult,
          success: true,
          duration,
          cost: this.calculateIncrementalCost(duration)
        });
        
      } catch (error) {
        results.push({
          request,
          error,
          success: false,
          duration: Date.now() - startTime,
          cost: 0
        });
      }
    }
    
    return results;
  }
  
  private async performIncrementalSearch(
    session: AnchorSession,
    request: SearchRequest
  ): Promise<any> {
    
    // Update search form without page reload
    await session.updateForm({
      destination: request.destination,
      checkin: request.checkin,
      checkout: request.checkout
    });
    
    // Submit and wait for results
    await session.submitForm();
    await session.waitForUpdate('.results-container');
    
    // Extract results
    return await session.extractData(request.extractionConfig);
  }
  
  private calculateIncrementalCost(durationMs: number): number {
    // Only runtime cost, no creation cost for batched searches
    const hours = durationMs / (1000 * 60 * 60);
    return hours * 0.05;
  }
}

// Usage Example
const batchOptimizer = new BatchSearchOptimizer(sessionPool);

export async function searchMultipleDestinations(
  destinations: string[],
  dates: { checkin: string; checkout: string }
): Promise<HotelResult[]> {
  
  const requests: SearchRequest[] = destinations.map(destination => ({
    destination,
    checkin: dates.checkin,
    checkout: dates.checkout,
    serviceType: 'hotel',
    extractionConfig: CPMAXX_EXTRACTION_CONFIG
  }));
  
  const batchResults = await batchOptimizer.batchOptimizedSearch(requests);
  
  // Flatten and combine results
  return batchResults
    .filter(result => result.success)
    .flatMap(result => result.result);
}
```

### Cost Impact
- **Before**: $0.01 + $0.075 per search = $0.085 × 10 destinations = $0.85
- **After**: $0.01 + ($0.075 × 10 destinations) = $0.76
- **Savings**: 11% per batch (adds up significantly)

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
1. **Timeout Implementation**: Set 90-second maximum timeouts
2. **Basic Session Reuse**: Implement simple session pooling  
3. **Resource Blocking**: Block images, CSS, media during extraction
4. **Expected Savings**: 70-80%

### Phase 2: Advanced Optimization (Week 2)
1. **Smart Caching**: Implement multi-layer cache with TTL policies
2. **Background Refresh**: Proactive cache warming
3. **Batch Operations**: Group similar searches together
4. **Expected Savings**: 85-92%

### Phase 3: Fine-Tuning (Week 3)  
1. **Predictive Caching**: Pre-warm popular search combinations
2. **Dynamic Timeout Adjustment**: Adjust timeouts based on historical performance
3. **Cost Monitoring**: Real-time cost tracking and alerting
4. **Expected Savings**: 92-98%

## Monitoring & Alerting

### Cost Tracking Dashboard

```typescript
export interface CostMetrics {
  dailyCost: number;
  searchCount: number;
  averageCostPerSearch: number;
  cacheHitRate: number;
  sessionReuseRate: number;
  averageSearchDuration: number;
  topExpensiveSearches: SearchMetric[];
  costTrend: DailyCost[];
}

export class CostMonitor {
  async generateDailyReport(): Promise<CostMetrics> {
    const today = new Date().toISOString().split('T')[0];
    
    const metrics = await this.db.prepare(`
      SELECT 
        SUM(cost) as total_cost,
        COUNT(*) as search_count,
        AVG(cost) as avg_cost,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN source = 'cache' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as cache_hit_rate
      FROM search_metrics 
      WHERE date(created_at) = ?
    `).bind(today).first();
    
    return {
      dailyCost: metrics.total_cost || 0,
      searchCount: metrics.search_count || 0,
      averageCostPerSearch: metrics.avg_cost || 0,
      cacheHitRate: metrics.cache_hit_rate || 0,
      averageSearchDuration: metrics.avg_duration || 0,
      // ... additional metrics
    };
  }
  
  async checkBudgetAlerts(): Promise<void> {
    const monthlySpend = await this.getMonthlySpend();
    const dailyBudget = 5.00; // $5/day budget
    const monthlyBudget = 100.00; // $100/month budget
    
    if (monthlySpend > monthlyBudget * 0.8) {
      await this.sendAlert('BUDGET_WARNING', {
        current: monthlySpend,
        budget: monthlyBudget,
        percentage: (monthlySpend / monthlyBudget) * 100
      });
    }
  }
}
```

## Expected Results

### Monthly Cost Projection (1000 searches)

| Strategy | Cost/Search | Monthly Total | Savings |
|----------|-------------|---------------|---------|
| **Baseline (No Optimization)** | $0.36 | $360 | 0% |
| **+ Session Reuse** | $0.32 | $320 | 11% |
| **+ Timeout Control** | $0.12 | $120 | 67% |
| **+ Smart Caching (80% hit rate)** | $0.024 | $24 | 93% |
| **+ Minimal Data Transfer** | $0.018 | $18 | 95% |
| **+ Batch Operations** | $0.012 | $12 | **97%** |

### ROI Analysis
- **Development Time**: 2-3 weeks
- **Monthly Savings**: $348 (at 1000 searches)
- **Annual Savings**: $4,176
- **Break-even**: Immediate (savings start from day 1)

The combination of these strategies transforms Anchor Browser from an expensive per-search tool into a cost-effective, high-performance travel data extraction system.