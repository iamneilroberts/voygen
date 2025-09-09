# TASK-0042: Data Model Alignment for Proposal System

## Overview
Update data models and interfaces to match the comprehensive schema defined in `.project/features/rendering/proposal_rendering_system.md`. This ensures our proposal system can handle all types of travel data including flights, ground transport, tours, and financials.

## Files to Modify
- `src/render/types.ts` - Core data interfaces
- `src/tools/proposal-tools.ts` - Database loading functions
- `src/render/proposal-generator.ts` - Generator integration

## New Interfaces to Implement

### Core Trip Data
```typescript
export interface TripSpec {
  party: { adults: number; children: number };
  legs: { city: string; arrive: string; nights: number }[];
  prefs: { styles: string[]; budget_per_night: number; refundable: boolean; breakfast: boolean };
}

export interface ProposalData {
  trip_spec: TripSpec;
  hotels: HotelOffering[];
  rooms?: RoomOffering[];
  flights?: FlightItin[];
  ground?: GroundItem[];
  tours?: TourItem[];
  financials?: Financials;
  next_steps?: NextSteps;
  insurance?: InsuranceBlock;
  free_panels?: FreePanel[];
}
```

### Hotel & Accommodation
```typescript
export interface HotelOffering {
  id: string; name: string; city: string;
  star_rating?: number; tags: string[];
  lead_price?: { amount: number; currency: string };
  image?: string; deeplinks?: { select_hotel?: string };
}

export interface RoomOffering {
  hotel_id: string; room_code?: string; name: string; 
  rates: RoomRate[];
}

export interface RoomRate {
  label: string; refundable: boolean;
  nightly?: number; total?: number; taxes_fees?: number; 
  currency?: string;
  commission?: { amount?: number; percent?: number };
  policy_html?: string; select_url?: string;
}
```

### Travel Components
```typescript
export interface FlightItin {
  pricing?: { total: number; currency: string; per_person?: number };
  segments: FlightSegment[];
  notes_md?: string; book_link?: string;
}

export interface GroundItem {
  type: "transfer" | "car";
  // Transfer specific
  mode?: "private" | "shared";
  route?: string; date_iso?: string; pax?: number;
  // Car rental specific  
  vendor?: string; category?: string;
  pickup?: { place: string; time_iso: string };
  dropoff?: { place: string; time_iso: string };
  // Common
  total: number; currency: string;
  insurance_included?: boolean;
}

export interface TourItem {
  title: string; date_iso?: string; duration?: string;
  total: number; currency: string;
  highlights_md?: string; inclusions_md?: string;
  book_link?: string;
}
```

### Financial & Business Logic
```typescript
export interface Financials {
  currency: string;
  price_lines: { label: string; amount: number }[];
  discounts?: { label: string; amount: number }[];
  fees?: { label: string; amount: number }[];
  subtotal?: number; taxes?: number; total_due?: number;
  deposit?: { amount: number; due_date_iso: string; refundable?: boolean };
  payment_schedule?: { label: string; amount: number; due_date_iso: string }[];
  agent_private?: { commission_total?: number; commission_pct_est?: number };
}

export interface NextSteps {
  checklist: { label: string; link?: string; due_date_iso?: string }[];
  cta_buttons?: { label: string; link: string }[];
}
```

### Template Remixing
```typescript
export interface ThemeRemix {
  colorScheme: 'professional-blue' | 'luxury-gold' | 'minimal-gray' | 'vibrant-teal' | 'sunset-orange';
  typography: 'corporate' | 'elegant' | 'modern' | 'classic';
  decorative: 'none' | 'minimal-emoji' | 'rich-emoji' | 'icons-only';
  layout: 'compact' | 'spacious' | 'magazine' | 'executive';
}

export interface ProposalRemix {
  template: 'detailed' | 'condensed' | 'fancy' | 'functional';
  theme: ThemeRemix;
  customizations?: {
    showCommissions?: boolean;
    includeEmoji?: boolean;
    colorOverrides?: Record<string, string>;
  };
}
```

## Database Mapping Strategy
1. **Maintain backward compatibility** with current `loadTripDataDirect()` function
2. **Enhance data loading** to populate new fields where data exists
3. **Graceful degradation** when optional data is missing
4. **Future-proof** for when additional data becomes available

## Acceptance Criteria
- [ ] All new interfaces implemented in `types.ts`
- [ ] Database loading functions updated to map to new schemas
- [ ] Backward compatibility maintained with existing proposals
- [ ] Type safety throughout the system
- [ ] Documentation for new data structures

## Priority: High
## Estimated Time: 1-2 hours
## Dependencies: None (foundational task)