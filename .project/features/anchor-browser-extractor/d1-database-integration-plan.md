# D1 Database Integration Plan for Travel Services Caching

## Overview

This document outlines the complete integration strategy for implementing the unified travel services caching system within the existing d1-database MCP server. The plan includes migration strategies, cache management, tool integration, and performance optimization.

## Current State Analysis

### Existing Database Structure
- **Primary Tables**: `trips_v2`, `clients_v2`, `hotel_cache`, `rooms_cache`
- **Facts System**: `trip_facts`, `facts_dirty` with automatic trigger-based updates
- **Migration System**: Robust migration runner with embedded SQL content
- **Tool Ecosystem**: Comprehensive MCP tools for querying and data management

### Integration Goals
1. Unified storage for all travel service types (hotels, flights, packages, etc.)
2. Backward compatibility with existing hotel caching
3. Integration with trip planning workflow
4. Efficient search and retrieval patterns
5. Automatic cache invalidation and refresh

## 1. Database Migration Strategy

### Migration 010: Travel Services Core Tables

```sql
-- 010_travel_services_core.sql
-- Purpose: Create unified travel services tables with migration from existing hotel_cache

BEGIN TRANSACTION;

-- Create the unified travel services table
CREATE TABLE travel_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Search context
  trip_id INTEGER,
  search_session_id TEXT,
  search_params_hash TEXT,
  
  -- Core identification
  service_id TEXT NOT NULL,
  service_category TEXT NOT NULL CHECK (service_category IN ('hotel', 'flight', 'rental_car', 'transfer', 'excursion', 'package')),
  service_name TEXT NOT NULL,
  service_description TEXT,
  
  -- Pricing (flattened for queries)
  base_price REAL NOT NULL,
  total_price REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  price_unit TEXT,              -- per night, per day, per person
  original_price REAL,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  start_date TEXT NOT NULL,     -- YYYY-MM-DD
  end_date TEXT,                -- YYYY-MM-DD (null for single-day services)
  duration_value REAL,
  duration_unit TEXT,
  max_capacity INTEGER,
  
  -- Location (for services with location)
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  latitude REAL,
  longitude REAL,
  
  -- Quality metrics
  rating_overall REAL,
  rating_source TEXT,
  rating_count INTEGER,
  extraction_confidence REAL,
  data_completeness REAL,
  
  -- Source information
  source_platform TEXT NOT NULL,
  source_url TEXT,
  booking_url TEXT,
  
  -- Full service data (JSON storage)
  service_data_json TEXT NOT NULL, -- Complete service object as JSON
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  cache_expires_at TEXT,        -- Cache expiration timestamp
  
  -- Foreign key constraints
  FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE SET NULL,
  
  -- Unique constraint to prevent duplicates
  UNIQUE(service_id, source_platform, start_date, service_category)
);

-- Indexes for efficient querying
CREATE INDEX idx_travel_services_trip_id ON travel_services(trip_id);
CREATE INDEX idx_travel_services_category ON travel_services(service_category);
CREATE INDEX idx_travel_services_location_dates ON travel_services(location_city, start_date, end_date);
CREATE INDEX idx_travel_services_price_range ON travel_services(total_price, currency);
CREATE INDEX idx_travel_services_rating ON travel_services(rating_overall DESC);
CREATE INDEX idx_travel_services_source ON travel_services(source_platform, created_at DESC);
CREATE INDEX idx_travel_services_session ON travel_services(search_session_id);
CREATE INDEX idx_travel_services_expires ON travel_services(cache_expires_at);
CREATE INDEX idx_travel_services_search_params ON travel_services(search_params_hash, service_category);

-- Cache management table
CREATE TABLE travel_search_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_params_hash TEXT NOT NULL UNIQUE,
  service_category TEXT NOT NULL,
  search_params_json TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  search_duration_ms INTEGER,
  extraction_confidence REAL,
  source_platform TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_accessed TEXT DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_travel_search_cache_hash ON travel_search_cache(search_params_hash);
CREATE INDEX idx_travel_search_cache_expires ON travel_search_cache(expires_at);
CREATE INDEX idx_travel_search_cache_category ON travel_search_cache(service_category);
CREATE INDEX idx_travel_search_cache_platform ON travel_search_cache(source_platform);

COMMIT;
```

### Migration 011: Data Migration from Existing Tables

```sql
-- 011_migrate_hotel_data.sql
-- Purpose: Migrate existing hotel_cache data to new travel_services table

BEGIN TRANSACTION;

-- Migrate hotel data from hotel_cache to travel_services
INSERT INTO travel_services (
  service_id, service_category, service_name, service_description,
  base_price, total_price, currency,
  is_available, start_date, end_date,
  location_city, location_state, location_country,
  latitude, longitude,
  rating_overall, rating_source,
  source_platform, source_url,
  service_data_json,
  created_at, updated_at
)
SELECT 
  provider_hotel_id,
  'hotel',
  name,
  COALESCE(region, ''),
  COALESCE((
    SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id
  ), 0),
  COALESCE((
    SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id  
  ), 0),
  'USD',
  1,
  date('now'),
  date('now', '+1 day'),
  city,
  region,
  country,
  latitude,
  longitude,
  stars,
  provider,
  provider,
  NULL,
  json_object(
    'id', provider_hotel_id,
    'name', name,
    'location', json_object(
      'address', json_object(
        'city', city,
        'state', region,
        'country', country,
        'full', COALESCE(city || ', ' || region || ', ' || country, city || ', ' || country)
      ),
      'coordinates', json_object(
        'latitude', latitude,
        'longitude', longitude
      )
    ),
    'hotelDetails', json_object(
      'starRating', stars,
      'propertyType', 'hotel'
    ),
    'rooms', (
      SELECT json_group_array(
        json_object(
          'type', room_type,
          'occupancy', occupancy,
          'ratePlan', rate_plan,
          'price', price,
          'currency', currency,
          'refundable', refundable,
          'includesBreakfast', includes_breakfast
        )
      )
      FROM rooms_cache r WHERE r.hotel_id = h.id
    ),
    'source', json_object(
      'platform', provider,
      'lastUpdated', last_updated
    ),
    'extraction', json_object(
      'confidence', 0.8,
      'completeness', 0.7
    )
  ),
  last_updated,
  last_updated
FROM hotel_cache h
WHERE h.id IS NOT NULL;

-- Update extraction confidence based on data completeness
UPDATE travel_services 
SET 
  extraction_confidence = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
    WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.8
    ELSE 0.7
  END,
  data_completeness = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
    WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.7
    ELSE 0.5
  END
WHERE service_category = 'hotel';

COMMIT;
```

### Migration 012: Trigger Integration

```sql
-- 012_travel_services_triggers.sql
-- Purpose: Integrate travel services with existing facts system

BEGIN TRANSACTION;

-- Add travel services to facts dirty tracking
CREATE TRIGGER trg_travel_services_ai_dirty
AFTER INSERT ON travel_services
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_insert')
  WHERE NEW.trip_id IS NOT NULL;
END;

CREATE TRIGGER trg_travel_services_au_dirty
AFTER UPDATE ON travel_services
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_update')
  WHERE NEW.trip_id IS NOT NULL;
END;

CREATE TRIGGER trg_travel_services_ad_dirty
AFTER DELETE ON travel_services
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (OLD.trip_id, 'travel_service_delete')
  WHERE OLD.trip_id IS NOT NULL;
END;

-- Auto-update timestamps on service updates
CREATE TRIGGER trg_travel_services_update_timestamp
BEFORE UPDATE ON travel_services
BEGIN
  UPDATE travel_services 
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- Clean expired cache entries automatically
CREATE TRIGGER trg_travel_search_cache_cleanup
AFTER INSERT ON travel_search_cache
BEGIN
  DELETE FROM travel_search_cache 
  WHERE expires_at < datetime('now')
    AND id != NEW.id;
  
  DELETE FROM travel_services 
  WHERE cache_expires_at < datetime('now')
    AND trip_id IS NULL; -- Only clean unassigned cached results
END;

COMMIT;
```

## 2. Cache Management System

### Cache Policies and TTL Configuration

```typescript
export interface CachePolicy {
  serviceName: 'hotel' | 'flight' | 'rental_car' | 'transfer' | 'excursion' | 'package';
  ttlHours: number;
  maxResults: number;
  refreshThreshold: number; // Hours before expiry to trigger refresh
}

export const DEFAULT_CACHE_POLICIES: Record<string, CachePolicy> = {
  hotel: {
    serviceName: 'hotel',
    ttlHours: 24, // Hotels change less frequently
    maxResults: 50,
    refreshThreshold: 6
  },
  flight: {
    serviceName: 'flight', 
    ttlHours: 4, // Flight prices change frequently
    maxResults: 30,
    refreshThreshold: 1
  },
  package: {
    serviceName: 'package',
    ttlHours: 12, // Packages moderate frequency
    maxResults: 20,
    refreshThreshold: 3
  },
  rental_car: {
    serviceName: 'rental_car',
    ttlHours: 8, // Car rental availability changes
    maxResults: 25,
    refreshThreshold: 2
  },
  transfer: {
    serviceName: 'transfer',
    ttlHours: 48, // Transfers relatively stable
    maxResults: 15,
    refreshThreshold: 12
  },
  excursion: {
    serviceName: 'excursion',
    ttlHours: 36, // Excursions moderately stable
    maxResults: 40,
    refreshThreshold: 8
  }
};
```

### Cache Key Generation

```typescript
export function generateSearchHash(params: any, serviceType: string): string {
  // Normalize search parameters to create consistent cache keys
  const normalized = {
    service: serviceType,
    destination: params.destination?.toLowerCase().trim(),
    dates: {
      start: params.checkIn || params.departureDate,
      end: params.checkOut || params.returnDate
    },
    occupancy: params.guests || params.travelers,
    rooms: params.rooms,
    // Add service-specific parameters
    ...(serviceType === 'flight' && {
      origin: params.origin?.toLowerCase().trim(),
      class: params.class || 'economy'
    }),
    ...(serviceType === 'hotel' && {
      starRating: params.starRating,
      amenities: params.amenities?.sort()
    })
  };

  // Create hash from normalized parameters
  const hashInput = JSON.stringify(normalized, Object.keys(normalized).sort());
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}
```

### Cache Invalidation Strategies

```typescript
export class TravelCacheManager {
  constructor(private db: D1Database) {}

  async checkCacheHit(
    searchHash: string, 
    serviceCategory: string
  ): Promise<{
    hit: boolean;
    results?: any[];
    needsRefresh: boolean;
  }> {
    // Check if we have cached search results
    const searchCache = await this.db.prepare(`
      SELECT * FROM travel_search_cache 
      WHERE search_params_hash = ? 
        AND service_category = ?
        AND expires_at > datetime('now')
    `).bind(searchHash, serviceCategory).first();

    if (!searchCache) {
      return { hit: false, needsRefresh: false };
    }

    const policy = DEFAULT_CACHE_POLICIES[serviceCategory];
    const refreshTime = new Date(searchCache.created_at);
    refreshTime.setHours(refreshTime.getHours() + policy.ttlHours - policy.refreshThreshold);
    
    const needsRefresh = new Date() > refreshTime;

    // Get cached results
    const results = await this.db.prepare(`
      SELECT service_data_json, extraction_confidence, created_at
      FROM travel_services
      WHERE search_params_hash = ? 
        AND service_category = ?
        AND cache_expires_at > datetime('now')
      ORDER BY rating_overall DESC NULLS LAST, total_price ASC
    `).bind(searchHash, serviceCategory).all();

    // Update access tracking
    await this.db.prepare(`
      UPDATE travel_search_cache 
      SET last_accessed = datetime('now'), 
          access_count = access_count + 1
      WHERE search_params_hash = ?
    `).bind(searchHash).run();

    return {
      hit: true,
      results: results.map(r => JSON.parse(r.service_data_json)),
      needsRefresh
    };
  }

  async cacheSearchResults(
    searchHash: string,
    serviceCategory: string,
    searchParams: any,
    results: any[],
    platform: string,
    searchDuration: number
  ): Promise<void> {
    const policy = DEFAULT_CACHE_POLICIES[serviceCategory];
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + policy.ttlHours);

    // Cache the search metadata
    await this.db.prepare(`
      INSERT OR REPLACE INTO travel_search_cache (
        search_params_hash, service_category, search_params_json,
        result_count, search_duration_ms, source_platform, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      searchHash,
      serviceCategory,
      JSON.stringify(searchParams),
      results.length,
      searchDuration,
      platform,
      expiresAt.toISOString()
    ).run();

    // Cache individual results
    for (const result of results) {
      await this.cacheService(result, searchHash, null); // No trip_id for search cache
    }
  }

  async cacheService(
    service: any, 
    searchHash?: string, 
    tripId?: number
  ): Promise<void> {
    const policy = DEFAULT_CACHE_POLICIES[service.category];
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + policy.ttlHours);

    await this.db.prepare(`
      INSERT OR REPLACE INTO travel_services (
        trip_id, search_params_hash, service_id, service_category,
        service_name, service_description,
        base_price, total_price, currency, price_unit,
        is_available, start_date, end_date,
        location_city, location_state, location_country,
        latitude, longitude,
        rating_overall, rating_source, rating_count,
        extraction_confidence, data_completeness,
        source_platform, source_url, booking_url,
        service_data_json, cache_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tripId,
      searchHash,
      service.id,
      service.category,
      service.name,
      service.description,
      service.pricing.basePrice.amount,
      service.pricing.totalPrice.amount,
      service.pricing.basePrice.currency,
      service.pricing.basePrice.unit,
      service.availability.available,
      service.availability.startDate,
      service.availability.endDate,
      service.location?.address?.city,
      service.location?.address?.state,
      service.location?.address?.country,
      service.location?.coordinates?.latitude,
      service.location?.coordinates?.longitude,
      service.rating?.overall,
      service.rating?.source,
      service.rating?.reviewCount,
      service.extraction.confidence,
      service.extraction.completeness,
      service.source.platform,
      service.source.url,
      service.source.bookingUrl,
      JSON.stringify(service),
      expiresAt.toISOString()
    ).run();
  }

  async invalidateCache(criteria: {
    serviceCategory?: string;
    platform?: string;
    destination?: string;
    olderThan?: Date;
  }): Promise<number> {
    let sql = 'DELETE FROM travel_services WHERE 1=1';
    const bindings: any[] = [];

    if (criteria.serviceCategory) {
      sql += ' AND service_category = ?';
      bindings.push(criteria.serviceCategory);
    }

    if (criteria.platform) {
      sql += ' AND source_platform = ?';
      bindings.push(criteria.platform);
    }

    if (criteria.destination) {
      sql += ' AND location_city LIKE ?';
      bindings.push(`%${criteria.destination}%`);
    }

    if (criteria.olderThan) {
      sql += ' AND created_at < ?';
      bindings.push(criteria.olderThan.toISOString());
    }

    const result = await this.db.prepare(sql).bind(...bindings).run();
    return result.changes || 0;
  }
}
```

## 3. Updated MCP Tools Integration

### Enhanced Query Tools

```typescript
// Update existing ingest_hotels to use new system
export const ingestTravelServicesSchema = z.object({
  services: z.array(z.any()),
  tripId: z.number().optional(),
  platform: z.string().default('manual'),
  searchParams: z.object({}).optional()
});

export async function ingestTravelServices(
  env: Env,
  services: any[],
  tripId?: number,
  platform: string = 'manual',
  searchParams?: any
): Promise<{ imported: number; errors: string[] }> {
  const cacheManager = new TravelCacheManager(env.DB);
  let imported = 0;
  const errors: string[] = [];

  // Generate search hash if searchParams provided
  const searchHash = searchParams ? 
    generateSearchHash(searchParams, services[0]?.category || 'hotel') : 
    undefined;

  for (const service of services) {
    try {
      await cacheManager.cacheService(service, searchHash, tripId);
      imported++;
    } catch (error) {
      errors.push(`Failed to cache ${service.name}: ${error}`);
    }
  }

  return { imported, errors };
}

// New unified search tool
export const searchTravelServicesSchema = z.object({
  serviceCategory: z.enum(['hotel', 'flight', 'rental_car', 'transfer', 'excursion', 'package']),
  destination: z.string().optional(),
  origin: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.object({
    adults: z.number().min(1).max(10).default(2),
    children: z.number().min(0).max(8).default(0)
  }).optional(),
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  maxResults: z.number().min(1).max(50).default(20),
  tripId: z.number().optional(),
  forceRefresh: z.boolean().default(false)
});

export async function searchTravelServices(
  env: Env,
  params: z.infer<typeof searchTravelServicesSchema>
): Promise<any> {
  const cacheManager = new TravelCacheManager(env.DB);
  const searchHash = generateSearchHash(params, params.serviceCategory);

  // Check cache first unless forced refresh
  if (!params.forceRefresh) {
    const cacheResult = await cacheManager.checkCacheHit(searchHash, params.serviceCategory);
    
    if (cacheResult.hit && !cacheResult.needsRefresh) {
      return {
        results: cacheResult.results,
        fromCache: true,
        searchId: searchHash,
        serviceType: params.serviceCategory
      };
    }
  }

  // If no cache hit or forced refresh, we would trigger Anchor Browser search here
  // For now, return empty results with instruction to use Anchor Browser MCP
  return {
    results: [],
    fromCache: false,
    searchId: searchHash,
    serviceType: params.serviceCategory,
    message: "Cache miss - use mcp-anchor-browser search tools for fresh results"
  };
}
```

### Trip Association Tools

```typescript
export const associateServiceWithTripSchema = z.object({
  serviceId: z.string(),
  tripId: z.number(),
  status: z.enum(['considered', 'booked', 'confirmed']).default('considered')
});

export async function associateServiceWithTrip(
  env: Env,
  serviceId: string,
  tripId: number,
  status: string = 'considered'
): Promise<any> {
  // Update the service record to associate with trip
  const result = await env.DB.prepare(`
    UPDATE travel_services 
    SET trip_id = ?, updated_at = datetime('now')
    WHERE service_id = ?
  `).bind(tripId, serviceId).run();

  if (result.changes === 0) {
    throw new Error(`Service ${serviceId} not found in cache`);
  }

  // Record in trip history
  await env.DB.prepare(`
    INSERT INTO ActivityLog (
      trip_id, activity_type, description, timestamp, metadata
    ) VALUES (?, 'service_association', ?, datetime('now'), ?)
  `).bind(
    tripId,
    `Associated ${serviceId} with trip`,
    JSON.stringify({ serviceId, status, action: 'associate' })
  ).run();

  return { success: true, serviceId, tripId, status };
}
```

## 4. Extraction Mapping Utilities

### Site-Specific Extractors

```typescript
export interface ExtractionMapper {
  platform: string;
  mapHotelResult(rawData: any): HotelResult;
  mapFlightResult?(rawData: any): FlightResult;
  mapPackageResult?(rawData: any): PackageResult;
}

export class CPMaxxExtractor implements ExtractionMapper {
  platform = 'cpmaxx';

  mapHotelResult(rawData: any): HotelResult {
    // Map CPMaxx HTML structure to HotelResult schema
    return {
      id: rawData.giata_id || rawData.id,
      category: 'hotel',
      name: rawData.name || 'Unknown Hotel',
      description: rawData.description,
      
      pricing: {
        basePrice: {
          amount: parseFloat(rawData.min_rate) || 0,
          currency: 'USD',
          unit: 'per night'
        },
        totalPrice: {
          amount: parseFloat(rawData.total_stay) || 0,
          currency: 'USD'
        }
      },
      
      availability: {
        available: true,
        startDate: rawData.check_in,
        endDate: rawData.check_out
      },
      
      hotelDetails: {
        starRating: parseFloat(rawData.star_rating) || undefined,
        propertyType: 'hotel'
      },
      
      location: {
        address: {
          street: rawData.address?.split(' ')[0],
          city: rawData.address?.match(/\w+(?=\s+\d{5})/)?.[0] || '',
          country: 'USA',
          full: rawData.address || ''
        },
        coordinates: rawData.latitude && rawData.longitude ? {
          latitude: parseFloat(rawData.latitude),
          longitude: parseFloat(rawData.longitude)
        } : undefined
      },
      
      source: {
        platform: this.platform,
        url: rawData.source_url,
        bookingUrl: rawData.select_url,
        lastUpdated: new Date().toISOString()
      },
      
      extraction: {
        confidence: this.calculateConfidence(rawData),
        completeness: this.calculateCompleteness(rawData)
      }
    };
  }

  private calculateConfidence(data: any): number {
    let confidence = 0.5; // Base confidence
    
    if (data.name) confidence += 0.2;
    if (data.address) confidence += 0.15;
    if (data.min_rate) confidence += 0.1;
    if (data.star_rating) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }

  private calculateCompleteness(data: any): number {
    const fields = ['name', 'address', 'min_rate', 'star_rating', 'description'];
    const filledFields = fields.filter(field => data[field]).length;
    return filledFields / fields.length;
  }
}

// Registry for platform-specific extractors
export const EXTRACTION_MAPPERS: Record<string, ExtractionMapper> = {
  'cpmaxx': new CPMaxxExtractor(),
  'vax': new VAXExtractor(), // To be implemented
  'delta': new DeltaExtractor() // To be implemented
};
```

## 5. Performance Optimization Strategies

### Database Optimization

1. **Partitioning Strategy**
   - Partition `travel_services` by `service_category` for faster queries
   - Use date-based partitioning for historical data management

2. **Query Optimization**
   ```sql
   -- Optimized search query with proper index usage
   SELECT 
     service_data_json,
     extraction_confidence,
     total_price,
     rating_overall
   FROM travel_services 
   WHERE service_category = ?
     AND location_city = ?
     AND start_date >= ?
     AND end_date <= ?
     AND total_price BETWEEN ? AND ?
   ORDER BY 
     rating_overall DESC NULLS LAST,
     total_price ASC
   LIMIT ?;
   ```

3. **Background Maintenance**
   ```typescript
   export async function performCacheMaintenance(env: Env): Promise<void> {
     // Clean expired entries
     await env.DB.prepare(`
       DELETE FROM travel_services 
       WHERE cache_expires_at < datetime('now')
         AND trip_id IS NULL
     `).run();

     // Clean old search cache entries
     await env.DB.prepare(`
       DELETE FROM travel_search_cache
       WHERE expires_at < datetime('now')
     `).run();

     // Vacuum to reclaim space (if supported)
     try {
       await env.DB.prepare('VACUUM').run();
     } catch (e) {
       console.log('VACUUM not supported in this environment');
     }
   }
   ```

### Caching Optimization

1. **Result Pagination**
   ```typescript
   export interface PaginatedResults<T> {
     results: T[];
     pagination: {
       currentPage: number;
       totalPages: number;
       totalResults: number;
       hasMore: boolean;
     };
   }
   ```

2. **Lazy Loading Strategy**
   - Cache search metadata immediately
   - Load full service details only when accessed
   - Use JSON field extraction for specific queries

## 6. Integration with Anchor Browser MCP

### Workflow Integration

```typescript
export async function performAutonomousSearch(
  env: Env,
  searchParams: any,
  serviceCategory: string
): Promise<any> {
  const cacheManager = new TravelCacheManager(env.DB);
  const searchHash = generateSearchHash(searchParams, serviceCategory);

  // 1. Check cache first
  const cacheResult = await cacheManager.checkCacheHit(searchHash, serviceCategory);
  
  if (cacheResult.hit && !cacheResult.needsRefresh) {
    return {
      source: 'cache',
      results: cacheResult.results,
      searchId: searchHash
    };
  }

  // 2. If cache miss or needs refresh, delegate to Anchor Browser
  // This would be called from the mcp-anchor-browser server
  const anchorResults = await callAnchorBrowserSearch(searchParams, serviceCategory);

  // 3. Process and cache the results
  const mapper = EXTRACTION_MAPPERS[anchorResults.platform];
  const mappedResults = anchorResults.rawResults.map(raw => 
    mapper.mapHotelResult(raw) // or appropriate mapper
  );

  // 4. Cache the results
  await cacheManager.cacheSearchResults(
    searchHash,
    serviceCategory,
    searchParams,
    mappedResults,
    anchorResults.platform,
    anchorResults.searchDuration
  );

  return {
    source: 'fresh',
    results: mappedResults,
    searchId: searchHash,
    performance: {
      searchDuration: anchorResults.searchDuration,
      cacheStatus: cacheResult.hit ? 'refreshed' : 'miss'
    }
  };
}
```

## 7. Deployment Strategy

### Phase 1: Foundation (Week 1)
1. Deploy migration 010 (core tables)
2. Update existing tools to be backward compatible
3. Test with existing hotel data

### Phase 2: Integration (Week 2)  
1. Deploy migration 011 (data migration)
2. Implement cache management system
3. Update ingest tools

### Phase 3: Enhancement (Week 3)
1. Deploy migration 012 (triggers)
2. Add extraction mapping utilities
3. Performance optimization

### Phase 4: Production (Week 4)
1. Integration with Anchor Browser MCP
2. Monitoring and alerting
3. Documentation and training

This comprehensive integration plan provides a solid foundation for implementing the unified travel services caching system while maintaining backward compatibility and ensuring optimal performance.