# Unified Travel Data Schema

## Overview

This document defines the comprehensive data schemas for all travel service types that will be extracted via Anchor Browser automation: hotels, flights, rental cars, transfers, excursions, and vacation packages. All schemas share common patterns for consistency while allowing service-specific details.

## Common Base Schema

### Shared Interface Elements
```typescript
// Base interface that all travel services extend
export interface BaseTravelService {
  // Core identification
  id: string;                   // Service-specific unique ID
  externalIds?: {               // Cross-platform identifiers
    [platform: string]: string;
  };
  
  // Basic information
  name: string;                 // Service name/title
  description?: string;         // Service description
  category: 'hotel' | 'flight' | 'rental_car' | 'transfer' | 'excursion' | 'package';
  
  // Pricing information
  pricing: {
    basePrice: {
      amount: number;
      currency: string;
      unit?: string;            // per night, per day, per person, etc.
    };
    totalPrice: {
      amount: number;
      currency: string;
    };
    breakdown?: {
      base?: number;
      taxes?: number;
      fees?: number;
      insurance?: number;
      extras?: number;
    };
    originalPrice?: number;     // Before discounts
    discounts?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
  };
  
  // Availability and booking
  availability: {
    available: boolean;
    startDate: string;          // YYYY-MM-DD format
    endDate?: string;           // YYYY-MM-DD format (for multi-day services)
    duration?: {
      value: number;
      unit: 'hours' | 'days' | 'nights';
    };
    capacity?: {
      maxGuests: number;
      currentBookings?: number;
    };
  };
  
  // Cancellation and policies
  policies?: {
    cancellation: {
      refundable: boolean;
      deadline?: string;        // ISO timestamp
      penalty?: number;
      terms?: string;
    };
    modification?: {
      allowed: boolean;
      fee?: number;
      deadline?: string;
    };
  };
  
  // Media and visuals
  media?: {
    images?: Array<{
      url: string;
      type: 'main' | 'gallery' | 'map' | 'amenity';
      alt?: string;
      caption?: string;
    }>;
    videos?: Array<{
      url: string;
      type: 'preview' | 'tour' | 'testimonial';
      duration?: number;
    }>;
  };
  
  // Reviews and ratings
  rating?: {
    overall?: number;           // Primary rating
    source: string;             // Rating source
    scale: number;              // Rating scale (5, 10, 100)
    reviewCount?: number;
    breakdown?: {
      [aspect: string]: number; // service, cleanliness, value, etc.
    };
  };
  
  // Source and metadata  
  source: {
    platform: string;          // cpmaxx, vax, delta, etc.
    url?: string;               // Original listing URL
    bookingUrl?: string;        // Direct booking link
    lastUpdated: string;        // ISO timestamp
    searchSessionId?: string;
  };
  
  // Quality metrics
  extraction: {
    confidence: number;         // 0-1 extraction confidence
    completeness: number;       // 0-1 data completeness
    warnings?: string[];
  };
}
```

## Service-Specific Schemas

### 1. Hotel Schema (extends BaseTravelService)
```typescript
export interface HotelResult extends BaseTravelService {
  category: 'hotel';
  
  // Hotel-specific information
  hotelDetails: {
    starRating?: number;        // Official star classification
    chainInfo?: {
      chain: string;
      brand?: string;
    };
    propertyType: 'hotel' | 'resort' | 'motel' | 'inn' | 'boutique' | 'hostel';
  };
  
  // Location details
  location: {
    address: {
      street?: string;
      city: string;
      state?: string;
      country: string;
      postalCode?: string;
      full: string;
    };
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    distanceFromAirport?: {
      value: number;
      unit: 'miles' | 'km';
      airportCode?: string;
    };
    distanceFromCity?: {
      value: number;
      unit: 'miles' | 'km';
    };
    neighborhood?: string;
    landmarks?: Array<{
      name: string;
      distance?: { value: number; unit: 'miles' | 'km' };
      type?: 'attraction' | 'business' | 'transport';
    }>;
  };
  
  // Room information
  room: {
    type: string;               // Room type description
    bedConfiguration?: string;   // King, Queen, Twin beds
    maxOccupancy: number;
    size?: {
      value: number;
      unit: 'sqft' | 'sqm';
    };
    features?: string[];        // In-room amenities
    view?: string;              // Ocean, city, garden view
  };
  
  // Hotel amenities
  amenities?: {
    dining?: string[];          // Restaurant, bar, room service
    recreation?: string[];      // Pool, gym, spa, golf
    business?: string[];        // WiFi, business center, meeting rooms
    family?: string[];          // Kids club, playground, babysitting
    accessibility?: string[];   // Wheelchair access, hearing assistance
    other?: string[];
  };
  
  // Special programs
  specialPrograms?: Array<{
    type: 'loyalty' | 'eco' | 'luxury' | 'family' | 'business';
    name: string;
    description?: string;
    benefits?: string[];
  }>;
}
```

### 2. Flight Schema
```typescript
export interface FlightResult extends BaseTravelService {
  category: 'flight';
  
  // Flight routing
  itinerary: {
    roundTrip: boolean;
    outbound: FlightSegment;
    return?: FlightSegment;
    connections?: number;       // Total connections both ways
  };
  
  // Airline information
  airline: {
    code: string;               // Airline code (DL, AA, UA)
    name: string;               // Delta, American, United
    logo?: string;              // Airline logo URL
  };
  
  // Flight class and service
  service: {
    class: 'economy' | 'premium_economy' | 'business' | 'first';
    cabin?: string;             // Main Cabin, Delta Comfort+, etc.
    fareType?: string;          // Basic, Main, Flexible
    mileageProgram?: {
      program: string;
      milesEarned?: number;
      status?: string;
    };
  };
  
  // Baggage and fees
  baggage?: {
    carryon: {
      included: boolean;
      fee?: number;
      weight?: { value: number; unit: 'lbs' | 'kg' };
    };
    checked: Array<{
      number: number;           // 1st bag, 2nd bag, etc.
      included: boolean;
      fee?: number;
      weight?: { value: number; unit: 'lbs' | 'kg' };
    }>;
  };
  
  // Seat and amenities
  aircraft?: {
    type: string;               // Boeing 737, Airbus A320
    features?: string[];        // WiFi, power outlets, entertainment
    seatMap?: string;           // URL to seat map
  };
}

interface FlightSegment {
  departure: {
    airport: {
      code: string;             // Airport code
      name: string;             // Airport name
      city: string;
      terminal?: string;
    };
    dateTime: string;           // ISO timestamp
    gate?: string;
  };
  arrival: {
    airport: {
      code: string;
      name: string;
      city: string;
      terminal?: string;
    };
    dateTime: string;
    gate?: string;
  };
  duration: {
    total: number;              // Total minutes
    flying: number;             // Flying time minutes
    layover?: number;           // Layover minutes if connecting
  };
  flightNumber: string;
  aircraft?: {
    type: string;
    registration?: string;
  };
}
```

### 3. Rental Car Schema
```typescript
export interface RentalCarResult extends BaseTravelService {
  category: 'rental_car';
  
  // Vehicle information
  vehicle: {
    make: string;               // Toyota, Ford, BMW
    model: string;              // Camry, Focus, X3
    category: string;           // Economy, Compact, SUV, Luxury
    year?: number;
    features: {
      transmission: 'automatic' | 'manual';
      fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid';
      airConditioning: boolean;
      doors: number;
      seats: number;
      luggage: number;          // Number of large bags
    };
    image?: string;             // Vehicle image URL
  };
  
  // Rental company
  company: {
    name: string;               // Hertz, Avis, Enterprise
    code?: string;              // Company code
    logo?: string;
  };
  
  // Pickup and return
  locations: {
    pickup: RentalLocation;
    return: RentalLocation;
  };
  
  // Mileage and fuel
  mileage: {
    unlimited: boolean;
    limit?: number;             // Miles allowed
    overage?: number;           // Fee per extra mile
  };
  
  fuel: {
    policy: 'full_to_full' | 'prepaid' | 'partial';
    prepaidPrice?: number;
    refuelFee?: number;
  };
  
  // Insurance and extras
  insurance?: Array<{
    type: 'collision' | 'liability' | 'comprehensive';
    included: boolean;
    dailyRate?: number;
    description?: string;
  }>;
  
  extras?: Array<{
    type: 'gps' | 'child_seat' | 'additional_driver' | 'wifi';
    dailyRate: number;
    description: string;
  }>;
}

interface RentalLocation {
  name: string;
  address: string;
  airport?: boolean;
  hours?: {
    open: string;               // HH:MM format
    close: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
```

### 4. Transfer Schema
```typescript
export interface TransferResult extends BaseTravelService {
  category: 'transfer';
  
  // Transfer type
  transferType: 'airport' | 'hotel' | 'port' | 'station' | 'custom';
  
  // Route information
  route: {
    origin: TransferLocation;
    destination: TransferLocation;
    distance?: {
      value: number;
      unit: 'miles' | 'km';
    };
    estimatedDuration: {
      value: number;
      unit: 'minutes' | 'hours';
    };
  };
  
  // Vehicle and service
  vehicle: {
    type: 'sedan' | 'suv' | 'van' | 'bus' | 'limousine' | 'shuttle';
    capacity: {
      passengers: number;
      luggage: number;
    };
    features?: string[];        // WiFi, water, child seats
    description?: string;
  };
  
  // Service details
  service: {
    type: 'private' | 'shared' | 'shuttle';
    meetAndGreet?: boolean;
    flightTracking?: boolean;
    waitTime?: number;          // Minutes of included wait time
    driverInfo?: {
      provided: boolean;
      uniform?: boolean;
      language?: string[];
    };
  };
  
  // Scheduling
  schedule: {
    flexible: boolean;
    advanceBooking?: {
      required: boolean;
      minimumHours?: number;
    };
    cancellationDeadline?: number; // Hours before service
  };
}

interface TransferLocation {
  type: 'airport' | 'hotel' | 'address' | 'landmark';
  name: string;
  address?: string;
  terminal?: string;           // For airports
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
```

### 5. Excursion/Activity Schema
```typescript
export interface ExcursionResult extends BaseTravelService {
  category: 'excursion';
  
  // Activity details
  activity: {
    type: 'tour' | 'adventure' | 'cultural' | 'dining' | 'entertainment' | 'outdoor' | 'educational';
    subtype?: string;           // City tour, snorkeling, cooking class
    difficulty?: 'easy' | 'moderate' | 'challenging' | 'expert';
    ageRestrictions?: {
      minimum?: number;
      maximum?: number;
      childFriendly: boolean;
    };
    physicalRequirements?: string[];
  };
  
  // Duration and schedule
  duration: {
    total: {
      value: number;
      unit: 'hours' | 'days';
    };
    active?: {                  // Active participation time
      value: number;
      unit: 'hours';
    };
  };
  
  // Location and meeting
  location: {
    destination: string;        // Primary destination/attraction
    meetingPoint?: {
      name: string;
      address: string;
      instructions?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    coverage?: string[];        // Areas/attractions visited
  };
  
  // What's included
  inclusions?: {
    transportation?: boolean;
    meals?: string[];           // breakfast, lunch, snacks
    equipment?: string[];       // snorkel gear, helmets, etc.
    guide?: {
      included: boolean;
      language: string[];
      certified?: boolean;
    };
    entrance?: boolean;         // Entrance fees included
    other?: string[];
  };
  
  // Group size and booking
  group: {
    type: 'private' | 'small_group' | 'large_group';
    maxSize?: number;
    minSize?: number;
    currentBookings?: number;
  };
  
  // Safety and requirements
  requirements?: {
    fitness?: string;
    equipment?: string[];       // What to bring
    clothing?: string[];        // Dress requirements
    restrictions?: string[];    // Medical, dietary, etc.
  };
  
  // Operator information
  operator?: {
    name: string;
    certified?: boolean;
    experience?: string;
    languages?: string[];
  };
}
```

### 6. Vacation Package Schema
```typescript
export interface PackageResult extends BaseTravelService {
  category: 'package';
  
  // Package composition
  packageType: 'flight_hotel' | 'all_inclusive' | 'cruise' | 'tour_package' | 'custom';
  
  // Included services
  components: {
    flights?: FlightResult[];
    hotels?: HotelResult[];
    transfers?: TransferResult[];
    excursions?: ExcursionResult[];
    rentalCars?: RentalCarResult[];
    other?: Array<{
      type: string;
      name: string;
      description?: string;
      included: boolean;
    }>;
  };
  
  // Package details
  packageDetails: {
    destination: {
      primary: string;          // Main destination
      secondary?: string[];     // Additional destinations
      region?: string;          // Caribbean, Europe, etc.
    };
    duration: {
      nights: number;
      days: number;
    };
    travelDates: {
      departure: string;        // YYYY-MM-DD
      return: string;           // YYYY-MM-DD
      flexible?: boolean;
    };
    travelers: {
      adults: number;
      children?: number;
      infants?: number;
    };
  };
  
  // All-inclusive specifics (if applicable)
  allInclusive?: {
    meals: {
      breakfast: boolean;
      lunch: boolean;
      dinner: boolean;
      snacks: boolean;
      roomService: boolean;
    };
    beverages: {
      alcoholic: boolean;
      nonAlcoholic: boolean;
      premium?: boolean;
    };
    activities: string[];       // Included activities
    amenities: string[];        // Included amenities
  };
  
  // Package benefits
  benefits?: {
    upgrades?: string[];        // Free upgrades included
    credits?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    perks?: string[];           // Special perks
  };
  
  // Booking information
  booking: {
    deposit?: {
      amount: number;
      dueDate?: string;
    };
    finalPayment?: {
      dueDate: string;          // Days before departure
    };
    travelInsurance?: {
      available: boolean;
      recommended?: boolean;
      cost?: number;
    };
  };
}
```

## Database Storage Schema

### Unified travel_services Table
```sql
CREATE TABLE travel_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Search context
  trip_id TEXT,
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
  
  -- Constraints
  UNIQUE(service_id, source_platform, start_date, service_category)
);

-- Indexes for efficient querying
CREATE INDEX idx_travel_services_trip_id ON travel_services(trip_id);
CREATE INDEX idx_travel_services_category ON travel_services(service_category);
CREATE INDEX idx_travel_services_location_dates ON travel_services(location_city, start_date, end_date);
CREATE INDEX idx_travel_services_price_range ON travel_services(total_price, currency);
CREATE INDEX idx_travel_services_rating ON travel_services(rating_overall DESC);
CREATE INDEX idx_travel_services_source ON travel_services(source_platform, created_at DESC);
```

## Search Response Format

### Unified Search Response
```typescript
export interface TravelSearchResponse<T extends BaseTravelService> {
  searchId: string;
  serviceType: 'hotel' | 'flight' | 'rental_car' | 'transfer' | 'excursion' | 'package';
  
  searchParams: {
    [key: string]: any;         // Service-specific search parameters
  };
  
  results: T[];
  
  performance: {
    searchDuration: number;
    extractionDuration: number;
    totalDuration: number;
  };
  
  quality: {
    successRate: number;
    averageConfidence: number;
    averageCompleteness: number;
    warnings: string[];
  };
  
  source: {
    platform: string;
    extractor: string;
    version: string;
    sessionId?: string;
  };
  
  pagination?: {
    currentPage: number;
    totalPages: number;
    resultsPerPage: number;
    totalResults: number;
  };
  
  searchedAt: string;
  cachedUntil?: string;
}
```

## MCP Tool Schema

### Unified Search Tools
```typescript
// Hotel search tool
export const searchHotelsSchema = z.object({
  destination: z.string(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().min(1).max(20).default(2),
  rooms: z.number().min(1).max(10).default(1),
  maxResults: z.number().min(1).max(50).default(20),
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  starRating: z.number().min(1).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  tripId: z.string().optional()
});

// Flight search tool
export const searchFlightsSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.object({
    adults: z.number().min(1).max(9).default(1),
    children: z.number().min(0).max(8).default(0),
    infants: z.number().min(0).max(2).default(0)
  }),
  class: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
  maxResults: z.number().min(1).max(30).default(15),
  tripId: z.string().optional()
});

// Package search tool  
export const searchPackagesSchema = z.object({
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.object({
    adults: z.number().min(1).max(10).default(2),
    children: z.number().min(0).max(8).default(0)
  }),
  packageType: z.enum(['flight_hotel', 'all_inclusive', 'cruise', 'tour_package']).optional(),
  origin: z.string().optional(),
  budget: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  maxResults: z.number().min(1).max(20).default(10),
  tripId: z.string().optional()
});
```

## Usage Examples

### Caching Multi-Service Results
```typescript
export async function cacheTravelServices(
  searchResponse: TravelSearchResponse<any>,
  tripId?: string,
  db?: D1Database
): Promise<void> {
  for (const service of searchResponse.results) {
    await db.prepare(`
      INSERT OR REPLACE INTO travel_services (
        trip_id, service_id, service_category, service_name, 
        base_price, total_price, currency, start_date, end_date,
        location_city, rating_overall, source_platform,
        extraction_confidence, data_completeness, service_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tripId,
      service.id,
      service.category,
      service.name,
      service.pricing.basePrice.amount,
      service.pricing.totalPrice.amount,
      service.pricing.basePrice.currency,
      service.availability.startDate,
      service.availability.endDate,
      service.location?.address?.city || null,
      service.rating?.overall || null,
      service.source.platform,
      service.extraction.confidence,
      service.extraction.completeness,
      JSON.stringify(service)
    ).run();
  }
}
```

This unified schema provides consistency across all travel service types while maintaining the flexibility needed for service-specific details and future platform expansions.