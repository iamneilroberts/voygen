# Hotel Data Schema for Autonomous Search Results

## Overview

This schema defines the standardized data structure for hotel search results extracted from various booking platforms (CPMaxx, VAX, Delta Vacations, etc.) via Anchor Browser automation. The schema balances completeness with flexibility to handle site variations.

## Core Hotel Result Schema

### TypeScript Interface
```typescript
export interface HotelSearchResult {
  // Core identification
  id: string;                    // Site-specific hotel ID
  externalIds?: {               // Cross-platform identification
    giataId?: string;           // GIATA global hotel ID
    chainCode?: string;         // Hotel chain code
    propertyCode?: string;      // Property-specific code
  };
  
  // Basic information
  name: string;                 // Hotel name
  description?: string;         // Hotel description/summary
  address: {
    street?: string;            // Street address
    city: string;               // City name
    state?: string;             // State/province
    country?: string;           // Country
    postalCode?: string;        // ZIP/postal code
    full: string;               // Complete formatted address
  };
  
  // Location and geography
  location: {
    latitude?: number;          // GPS coordinates
    longitude?: number;
    distanceFromAirport?: {     // Distance from main airport
      value: number;
      unit: 'miles' | 'km';
      airportCode?: string;     // Airport code (SEA, LAX, etc.)
    };
    distanceFromCity?: {        // Distance from city center
      value: number;
      unit: 'miles' | 'km';
    };
    neighborhood?: string;      // Area/district name
    landmarks?: Array<{         // Nearby points of interest
      name: string;
      distance?: {
        value: number;
        unit: 'miles' | 'km';
      };
    }>;
  };
  
  // Ratings and reviews
  rating: {
    overall?: number;           // Primary star rating (1-5)
    source?: string;            // Rating source (hotel, tripadvisor, etc.)
    scale?: number;             // Rating scale (5 for 1-5 stars)
    reviewCount?: number;       // Number of reviews
    breakdown?: {               // Detailed ratings
      cleanliness?: number;
      service?: number;
      location?: number;
      value?: number;
    };
  };
  
  // Pricing information
  pricing: {
    perNight: {
      amount: number;           // Price per night
      currency: string;         // Currency code (USD, EUR, etc.)
      original?: number;        // Original price before discounts
    };
    totalStay: {
      amount: number;           // Total price for entire stay
      currency: string;
      breakdown?: {             // Price breakdown
        room: number;
        taxes: number;
        fees: number;
      };
    };
    commission?: {              // Agent commission info
      amount: number;
      percentage: number;
    };
    cancellation?: {
      refundable: boolean;
      policy?: string;
      deadline?: string;        // Cancellation deadline
    };
  };
  
  // Room details
  room: {
    type?: string;              // Room type description
    bedType?: string;           // King, Queen, Twin, etc.
    maxOccupancy?: number;      // Maximum guests
    size?: {
      value: number;
      unit: 'sqft' | 'sqm';
    };
    features?: string[];        // Room features/amenities
  };
  
  // Hotel amenities and features
  amenities?: string[];         // Hotel amenities list
  specialFeatures?: Array<{     // Special features or badges
    type: 'luxury' | 'eco' | 'business' | 'family' | 'spa' | 'golf' | 'other';
    name: string;
    description?: string;
  }>;
  
  // Media and visuals
  images?: Array<{
    url: string;
    type: 'main' | 'room' | 'amenity' | 'exterior' | 'lobby';
    alt?: string;
    caption?: string;
  }>;
  
  // Booking and availability
  availability: {
    available: boolean;
    checkIn: string;            // YYYY-MM-DD format
    checkOut: string;           // YYYY-MM-DD format
    nights: number;
    guests: number;
    roomsRequested?: number;
  };
  
  // Source and metadata
  source: {
    platform: 'cpmaxx' | 'vax' | 'delta' | 'navitrip' | 'generic';
    url?: string;               // Booking URL
    deepLink?: string;          // Direct booking link
    lastUpdated: string;        // ISO timestamp
    searchId?: string;          // Search session ID
  };
  
  // Quality and confidence
  extraction: {
    confidence: number;         // Extraction confidence (0-1)
    completeness: number;       // Data completeness score (0-1)
    warnings?: string[];        // Data quality warnings
  };
}
```

## Database Storage Schema

### hotel_cache Table Enhancement
```sql
-- Enhanced hotel_cache table for comprehensive data
CREATE TABLE hotel_cache_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Search context
  trip_id TEXT,
  search_session_id TEXT,
  search_params_hash TEXT,      -- Hash of search parameters
  
  -- Hotel identification
  hotel_id TEXT NOT NULL,       -- Site-specific hotel ID
  giata_id TEXT,               -- Global hotel identifier
  chain_code TEXT,
  
  -- Basic information
  hotel_name TEXT NOT NULL,
  hotel_description TEXT,
  
  -- Location data
  address_full TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude REAL,
  longitude REAL,
  distance_from_airport REAL,
  airport_code TEXT,
  neighborhood TEXT,
  
  -- Ratings
  rating_overall REAL,
  rating_source TEXT,
  rating_scale INTEGER DEFAULT 5,
  review_count INTEGER,
  
  -- Pricing
  price_per_night REAL NOT NULL,
  price_total_stay REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  original_price REAL,
  taxes_fees REAL,
  commission_amount REAL,
  commission_percent REAL,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  check_in_date TEXT NOT NULL,  -- YYYY-MM-DD
  check_out_date TEXT NOT NULL, -- YYYY-MM-DD
  nights INTEGER,
  guests INTEGER,
  
  -- Room information
  room_type TEXT,
  bed_type TEXT,
  max_occupancy INTEGER,
  room_size_value REAL,
  room_size_unit TEXT,
  
  -- Source information
  source_platform TEXT NOT NULL,
  source_url TEXT,
  booking_link TEXT,
  
  -- Quality metrics
  extraction_confidence REAL,
  data_completeness REAL,
  
  -- JSON storage for complex nested data
  amenities_json TEXT,          -- JSON array of amenities
  images_json TEXT,             -- JSON array of image objects
  special_features_json TEXT,   -- JSON array of special features
  location_details_json TEXT,   -- JSON object with detailed location info
  pricing_breakdown_json TEXT,  -- JSON object with detailed pricing
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Indexes for efficient querying
  UNIQUE(hotel_id, source_platform, check_in_date, check_out_date, guests)
);

-- Indexes for performance
CREATE INDEX idx_hotel_cache_trip_id ON hotel_cache_v2(trip_id);
CREATE INDEX idx_hotel_cache_city_dates ON hotel_cache_v2(city, check_in_date, check_out_date);
CREATE INDEX idx_hotel_cache_price_range ON hotel_cache_v2(price_per_night, currency);
CREATE INDEX idx_hotel_cache_rating ON hotel_cache_v2(rating_overall DESC);
CREATE INDEX idx_hotel_cache_source ON hotel_cache_v2(source_platform, created_at DESC);
```

## Site-Specific Mapping Examples

### CPMaxx Extraction Mapping
```typescript
export function mapCpmaxHotelResult(htmlElement: any): HotelSearchResult {
  return {
    id: extractText(htmlElement, '[data-giata-id]', 'data-giata-id'),
    externalIds: {
      giataId: extractText(htmlElement, '[data-giata-id]', 'data-giata-id')
    },
    name: extractText(htmlElement, '.title a'),
    description: extractText(htmlElement, 'p:nth-of-type(4)'), // Hotel description paragraph
    
    address: {
      full: extractText(htmlElement, '.address'),
      city: extractCityFromAddress(extractText(htmlElement, '.address')),
      state: extractStateFromAddress(extractText(htmlElement, '.address'))
    },
    
    location: {
      latitude: parseFloat(extractAttribute(htmlElement, '[data-marker]', 'data-marker', 'lat')),
      longitude: parseFloat(extractAttribute(htmlElement, '[data-marker]', 'data-marker', 'lng'))
    },
    
    rating: {
      overall: countStars(htmlElement.querySelectorAll('.adzicon-star.fas')),
      source: 'hotel',
      scale: 5
    },
    
    pricing: {
      perNight: {
        amount: parsePrice(extractText(htmlElement, '.min-rate')),
        currency: 'USD'
      },
      totalStay: {
        amount: parsePrice(extractText(htmlElement, 'p:contains("Total:")')),
        currency: 'USD'
      },
      commission: {
        amount: parseCommissionAmount(extractText(htmlElement, 'b:contains("Commission:")')),
        percentage: parseCommissionPercent(extractText(htmlElement, 'b:contains("Commission:")'))
      }
    },
    
    images: [{
      url: extractBackgroundImage(htmlElement, '.hotel-image'),
      type: 'main'
    }],
    
    source: {
      platform: 'cpmaxx',
      url: extractAttribute(htmlElement, '.title a', 'href'),
      lastUpdated: new Date().toISOString()
    },
    
    availability: {
      available: true,
      checkIn: extractAttribute(htmlElement, '[data-check-in]', 'data-check-in'),
      checkOut: extractAttribute(htmlElement, '[data-check-out]', 'data-check-out'),
      nights: 1, // Calculate from dates
      guests: 2  // From search parameters
    }
  };
}
```

### VAX Extraction Mapping
```typescript
export function mapVaxHotelResult(htmlElement: any): HotelSearchResult {
  return {
    id: extractHotelId(htmlElement.querySelector('a').href),
    name: extractText(htmlElement, 'h2 a'),
    
    address: {
      full: extractText(htmlElement, '.hotel-location-info'),
      city: extractCityFromLocation(extractText(htmlElement, '.hotel-location-info'))
    },
    
    location: {
      distanceFromAirport: {
        value: parseFloat(extractText(htmlElement, 'strong:contains("miles")')),
        unit: 'miles',
        airportCode: extractAirportCode(htmlElement)
      }
    },
    
    rating: {
      overall: extractStarRating(htmlElement, '.hotel-rating-btn'),
      source: 'hotel',
      scale: 5,
      breakdown: {
        // TripAdvisor rating if available
      }
    },
    
    pricing: {
      perNight: {
        amount: parsePrice(extractText(htmlElement, '.avail-price strong')),
        currency: 'USD'
      },
      totalStay: {
        amount: parsePrice(extractText(htmlElement, '.avail-price strong')),
        currency: 'USD'
      }
    },
    
    room: {
      type: extractText(htmlElement, '.hotel-avail-room-type-wrap a'),
      features: extractRoomFeatures(extractText(htmlElement, '.hotel-avail-room-type-wrap a'))
    },
    
    specialFeatures: extractSpecialFeatures(htmlElement, '.cleaning-badge img'),
    
    source: {
      platform: 'vax',
      lastUpdated: new Date().toISOString()
    }
  };
}
```

### Delta Vacations Mapping  
```typescript
export function mapDeltaHotelResult(htmlElement: any): HotelSearchResult {
  return {
    id: extractAttribute(htmlElement, '.hotelItem', 'data-hotel-code'),
    name: extractText(htmlElement, '.bold a'),
    
    rating: {
      overall: extractStarRatingFromImage(htmlElement, 'img[alt*="Stars"]'),
      source: 'hotel',
      scale: 5,
      // SkyMiles member rating
      breakdown: {
        service: parseFloat(extractText(htmlElement, '.smPick_rating span:contains("/5")'))
      }
    },
    
    address: {
      full: extractText(htmlElement, 'td:contains("Hotel Location/Area:")'),
      neighborhood: extractNeighborhood(htmlElement)
    },
    
    amenities: extractAmenities(htmlElement, 'img[alt*="Access"], img[alt*="Conditioning"], img[alt*="Center"]'),
    
    images: [{
      url: extractAttribute(htmlElement, 'img[height="85"]', 'src'),
      type: 'main'
    }],
    
    specialFeatures: [{
      type: 'other',
      name: 'SkyMiles Members Pick',
      description: 'Selected hotel for SkyMiles members'
    }],
    
    source: {
      platform: 'delta',
      lastUpdated: new Date().toISOString()
    }
  };
}
```

## Search Result Collection Schema

### Complete Search Response
```typescript
export interface HotelSearchResponse {
  // Search metadata
  searchId: string;
  searchParams: {
    destination: string;
    checkIn: string;           // YYYY-MM-DD
    checkOut: string;          // YYYY-MM-DD
    guests: number;
    rooms?: number;
    maxResults?: number;
  };
  
  // Results data
  results: HotelSearchResult[];
  
  // Performance and quality metrics
  performance: {
    searchDuration: number;    // Milliseconds
    extractionDuration: number;
    totalDuration: number;
  };
  
  quality: {
    successRate: number;       // Successful extractions / total found
    averageConfidence: number; // Average extraction confidence
    averageCompleteness: number; // Average data completeness
    warnings: string[];
  };
  
  // Source information
  source: {
    platform: string;
    extractor: string;
    version: string;
    sessionId?: string;
  };
  
  // Pagination (if applicable)
  pagination?: {
    currentPage: number;
    totalPages: number;
    resultsPerPage: number;
    totalResults: number;
  };
  
  // Timestamps
  searchedAt: string;         // ISO timestamp
  cachedUntil?: string;       // Cache expiration
}
```

## Validation and Quality Scoring

### Data Completeness Scoring
```typescript
export function calculateCompletenessScore(hotel: HotelSearchResult): number {
  const requiredFields = [
    'id', 'name', 'address.full', 'pricing.perNight.amount', 
    'pricing.totalStay.amount', 'availability.checkIn', 'availability.checkOut'
  ];
  
  const optionalFields = [
    'rating.overall', 'location.latitude', 'location.longitude',
    'images', 'amenities', 'room.type', 'description'
  ];
  
  let score = 0;
  
  // Required fields (70% of score)
  const requiredScore = requiredFields.reduce((acc, field) => {
    return acc + (getNestedValue(hotel, field) ? 1 : 0);
  }, 0) / requiredFields.length * 0.7;
  
  // Optional fields (30% of score)
  const optionalScore = optionalFields.reduce((acc, field) => {
    return acc + (getNestedValue(hotel, field) ? 1 : 0);
  }, 0) / optionalFields.length * 0.3;
  
  return requiredScore + optionalScore;
}
```

### Confidence Scoring
```typescript
export function calculateExtractionConfidence(
  extractedData: any,
  extractionAttempts: number,
  fieldSuccessRate: number
): number {
  // Base confidence from field success rate
  let confidence = fieldSuccessRate;
  
  // Adjust based on extraction attempts (more attempts = lower confidence)
  if (extractionAttempts > 1) {
    confidence *= Math.max(0.5, 1 - (extractionAttempts - 1) * 0.2);
  }
  
  // Boost confidence for high-value fields
  if (extractedData.pricing && extractedData.rating && extractedData.images) {
    confidence = Math.min(1.0, confidence * 1.2);
  }
  
  return Math.round(confidence * 100) / 100;
}
```

## Usage Examples

### Caching Search Results
```typescript
export async function cacheHotelResults(
  searchResponse: HotelSearchResponse,
  tripId?: string,
  db?: D1Database
): Promise<void> {
  for (const hotel of searchResponse.results) {
    await db.prepare(`
      INSERT OR REPLACE INTO hotel_cache_v2 (
        trip_id, hotel_id, giata_id, hotel_name, address_full,
        city, state, price_per_night, price_total_stay, currency,
        rating_overall, source_platform, check_in_date, check_out_date,
        nights, guests, extraction_confidence, data_completeness,
        amenities_json, images_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      tripId,
      hotel.id,
      hotel.externalIds?.giataId,
      hotel.name,
      hotel.address.full,
      hotel.address.city,
      hotel.address.state,
      hotel.pricing.perNight.amount,
      hotel.pricing.totalStay.amount,
      hotel.pricing.perNight.currency,
      hotel.rating.overall,
      hotel.source.platform,
      hotel.availability.checkIn,
      hotel.availability.checkOut,
      hotel.availability.nights,
      hotel.availability.guests,
      hotel.extraction.confidence,
      hotel.extraction.completeness,
      JSON.stringify(hotel.amenities || []),
      JSON.stringify(hotel.images || [])
    ).run();
  }
}
```

### LLM Consumption Format
```typescript
export function formatForLLM(hotels: HotelSearchResult[]): string {
  return hotels.map((hotel, index) => {
    const priceInfo = `$${hotel.pricing.perNight.amount}/night ($${hotel.pricing.totalStay.amount} total)`;
    const ratingInfo = hotel.rating.overall ? `${hotel.rating.overall}/5 stars` : 'No rating';
    const locationInfo = hotel.address.city + (hotel.location.neighborhood ? `, ${hotel.location.neighborhood}` : '');
    
    return `${index + 1}. ${hotel.name}
   Location: ${locationInfo}
   Price: ${priceInfo}
   Rating: ${ratingInfo}
   Address: ${hotel.address.full}
   ${hotel.amenities?.length ? `Amenities: ${hotel.amenities.slice(0, 5).join(', ')}` : ''}`;
  }).join('\n\n');
}
```

This comprehensive schema provides the foundation for consistent hotel data extraction across all booking platforms while maintaining the flexibility needed for site-specific variations and future enhancements.