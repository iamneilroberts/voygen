// ============================================================================
// Core Trip Data Models - Based on proposal_rendering_system.md
// ============================================================================

export interface TripSpec {
  party: { adults: number; children: number };
  legs: { city: string; arrive: string; nights: number }[];
  prefs: { 
    styles: string[]; 
    budget_per_night: number; 
    refundable: boolean; 
    breakfast: boolean; 
  };
}

// ============================================================================
// Hotel & Accommodation Models
// ============================================================================

export interface HotelOffering {
  id: string; 
  name: string; 
  city: string;
  star_rating?: number; 
  tags: string[];
  lead_price?: { amount: number; currency: string };
  image?: string; 
  deeplinks?: { select_hotel?: string };
  // Additional fields for compatibility with existing system
  location?: string; // alias for city
  amenities?: string[];
  refundable?: boolean;
  cancellation_deadline?: string;
  commission_amount?: number;
  site: string; // booking site/provider
  images?: ImageData[];
}

export interface RoomRate {
  label: string; 
  refundable: boolean;
  nightly?: number; 
  total?: number; 
  taxes_fees?: number; 
  currency?: string;
  commission?: { amount?: number; percent?: number };
  policy_html?: string; 
  select_url?: string;
}

export interface RoomOffering {
  hotel_id: string; 
  room_code?: string; 
  name: string; 
  rates: RoomRate[];
}

// ============================================================================
// Travel Components
// ============================================================================

export interface FlightSegment {
  carrier: string; 
  flight: string; 
  cabin: string;
  dep_airport: string; 
  dep_time_iso: string;
  arr_airport: string; 
  arr_time_iso: string;
}

export interface FlightItin {
  pricing?: { total: number; currency: string; per_person?: number };
  segments: FlightSegment[];
  notes_md?: string; 
  book_link?: string;
}

export interface GroundItem {
  type: "transfer" | "car";
  // Transfer specific
  mode?: "private" | "shared";
  route?: string; 
  date_iso?: string; 
  pax?: number;
  // Car rental specific  
  vendor?: string; 
  category?: string;
  pickup?: { place: string; time_iso: string };
  dropoff?: { place: string; time_iso: string };
  // Common
  total: number; 
  currency: string;
  insurance_included?: boolean;
}

export interface TourItem {
  title: string; 
  date_iso?: string; 
  duration?: string;
  total: number; 
  currency: string;
  highlights_md?: string; 
  inclusions_md?: string;
  book_link?: string;
}

// ============================================================================
// Financial & Business Logic
// ============================================================================

export interface Financials {
  currency: string;
  price_lines: { label: string; amount: number }[];
  discounts?: { label: string; amount: number }[];
  fees?: { label: string; amount: number }[];
  subtotal?: number; 
  taxes?: number; 
  total_due?: number;
  deposit?: { amount: number; due_date_iso: string; refundable?: boolean };
  payment_schedule?: { label: string; amount: number; due_date_iso: string }[];
  agent_private?: { commission_total?: number; commission_pct_est?: number };
}

export interface NextSteps {
  checklist: { label: string; link?: string; due_date_iso?: string }[];
  cta_buttons?: { label: string; link: string }[];
}

export interface InsuranceBlock {
  recommended?: boolean;
  options: { 
    plan_name: string; 
    coverage_highlights_md: string; 
    price_pp?: number; 
    currency?: string; 
  }[];
  disclaimer_md?: string;
}

export interface FreePanel {
  title: string; 
  body_md: string; 
  icon?: string;
}

// ============================================================================
// Template Remixing System
// ============================================================================

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

// ============================================================================
// Comprehensive Proposal Data Model
// ============================================================================

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
  
  // Metadata
  trip_id: string;
  title?: string;
  destinations?: string;
  start_date?: string;
  end_date?: string;
  client?: {
    name: string;
    email: string;
  };
  generated_at?: string;
}

// ============================================================================
// Legacy Compatibility & Utilities
// ============================================================================

// Keep existing interfaces for backward compatibility
export interface TripData {
  trip_id: string;
  title?: string;
  destinations?: string;
  start_date?: string;
  end_date?: string;
  client?: {
    name: string;
    email: string;
  };
  hotels?: HotelData[];
  activities?: ActivityData[];
  total_cost?: number;
  total_commission?: number;
}

export interface HotelData {
  id: string;
  name: string;
  city: string;
  location?: string;
  star_rating?: number;
  lead_price?: {
    amount: number;
    currency: string;
  };
  images?: ImageData[];
  amenities?: string[];
  refundable?: boolean;
  cancellation_deadline?: string;
  commission_amount?: number;
  site: string;
}

export interface ActivityData {
  name: string;
  description?: string;
  location?: string;
  price?: number;
  duration?: string;
  images?: ImageData[];
}

export interface ImageData {
  url: string;
  local_path?: string;
  alt_text?: string;
}

export interface TemplateOptions {
  include_images?: boolean;
  image_quality?: number;
  custom_data?: any;
}

export interface GeneratedProposal {
  proposal_id: string;
  trip_id: string;
  template_name: string;
  rendered_html: string;
  json_payload: string;
  total_cost?: number;
  total_commission?: number;
  created_at: string;
}

// ============================================================================
// Data Conversion Utilities
// ============================================================================

export interface DataConversionOptions {
  preserveOriginalData?: boolean;
  enhanceWithDefaults?: boolean;
  validateRequired?: boolean;
}

// Helper type for backward compatibility mapping
export interface LegacyTripMapping {
  tripData: TripData;
  proposalData: ProposalData;
  conversionLog: string[];
}