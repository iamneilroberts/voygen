// Common types for modular web content extraction

export type PageType = 'vax' | 'wad' | 'navitrip_cp' | 'generic';
export type RouteType = 'hydration' | 'xhr' | 'dom' | 'jsonld' | 'regex';

// Results pages → NDJSON rows
export type HotelRow = {
  id?: string;
  name?: string;
  brand?: string;
  lat?: number;
  lon?: number;
  address?: string;
  star_rating?: number | string;
  review_score?: number | string;
  price_text?: string;
  currency?: string;
  taxes_fees_text?: string;
  cancel_text?: string;
  refundable?: boolean;
  package_type?: string; // Air+Hotel, Hotel-only, etc.
  image?: string;
  detail_url?: string;
};

// Post-map DTO used internally
export type HotelDTO = {
  id: string;
  name: string;
  brand?: string;
  lat?: number;
  lon?: number;
  address?: string;
  starRating?: number;
  reviewScore?: number;
  priceText?: string;
  currency?: string;
  taxesFeesText?: string;
  cancelText?: string;
  refundable?: boolean;
  packageType?: string;
  image?: string;
  detailUrl?: string;
};

export type ExtractResult = {
  ok: boolean;
  pageType?: PageType;
  route?: RouteType;
  count?: number;
  sample?: any[]; // small sample of mapped rows
  ndjson_gz_base64?: string; // gzipped NDJSON of HotelRow
  meta?: {
    endpoint?: string;
    hydrationKey?: string;
    timing_ms?: number;
    notes?: string[];
  };
  error?: string;
};

// Generic travel facts (ad-hoc pages)
export type FactKind =
  | 'flight'
  | 'hotel'
  | 'reservation'
  | 'event'
  | 'place'
  | 'generic';

export type BaseFact = {
  kind: FactKind;
  confidence: number; // 0..1
  source: {
    route: 'jsonld' | 'hydration' | 'inlineJson' | 'regex';
    hints: string[];
    selectors?: string[];
  };
  textSnippets?: string[];
};

export type FlightSegment = BaseFact & {
  kind: 'flight';
  airline?: string; // e.g., DL
  flightNumber?: string; // e.g., DL123
  depAirport?: string; // IATA
  arrAirport?: string; // IATA
  depTime?: string; // ISO
  arrTime?: string; // ISO
  recordLocator?: string; // PNR
  passengerNames?: string[];
  priceText?: string;
};

export type HotelStay = BaseFact & {
  kind: 'hotel';
  hotelName?: string;
  address?: string;
  checkIn?: string; // ISO date
  checkOut?: string; // ISO date
  confirmation?: string;
  priceText?: string;
  currency?: string;
  phone?: string;
  url?: string;
};

export type Reservation = BaseFact & {
  kind: 'reservation';
  supplier?: string;
  confirmation?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  name?: string; // e.g., "Cliffs of Moher Tour"
  location?: string;
  priceText?: string;
};

export type EventFact = BaseFact & {
  kind: 'event';
  name?: string;
  start?: string; // ISO dateTime
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  priceText?: string;
  isFree?: boolean;
};

export type PlaceFact = BaseFact & {
  kind: 'place';
  name?: string;
  category?: string;
  address?: string;
  lat?: number;
  lon?: number;
  hours?: string;
  url?: string;
  phone?: string;
};

export type GenericNote = BaseFact & {
  kind: 'generic';
  title?: string;
  body?: string;
};

export type TravelFacts = (
  | FlightSegment
  | HotelStay
  | Reservation
  | EventFact
  | PlaceFact
  | GenericNote
)[];

export type ParserResult = {
  ok: boolean;
  count?: number;
  facts_gz_base64?: string; // gzip(JSON.stringify(TravelFacts))
  sample?: TravelFacts;
  meta?: { timing_ms: number; route: string; hints: string[]; charBudget: number };
  error?: string;
};

