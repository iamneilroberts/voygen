/**
 * Enhanced search type definitions for improved query handling
 */

export interface SearchResult {
  natural_key: string;
  context_type: string;
  formatted_response?: string;
  type_rank?: number;
  raw_data?: string;
}

export interface TripSuggestion {
  trip_id: number;
  trip_name: string;
  trip_slug?: string | null;
  status?: string | null;
  destinations?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  primary_client_name?: string | null;
  primary_client_email?: string | null;
  traveler_preview?: string[];
  score?: number;
}

export interface TripSelection extends TripSuggestion {
  traveler_emails?: string[];
  traveler_count?: number;
  matched_tokens?: string[];
  match_reasons?: string[];
}

export interface QueryPerformanceMetrics {
  queryType: string;
  duration: number;
  complexity: 'simple' | 'moderate' | 'complex';
  fallbackUsed: boolean;
  resultCount: number;
}

export interface SearchQuery {
  originalTerm: string;
  optimizedTerms: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  strategy: 'primary' | 'fallback' | 'emergency';
}

export interface FallbackStrategy {
  sql: string;
  params: any[];
  description: string;
  maxResults: number;
}

export interface SearchResponse {
  response: string;
  context_type?: string;
  natural_key?: string;
  suggestions?: SearchResult[];
  trip_suggestions?: TripSuggestion[];
  selected_trip?: TripSelection;
  search_terms?: string[];
  error?: string;
  performance?: QueryPerformanceMetrics;
  source?: string;
  complexity?: string;
}

export interface QueryComplexityLimits {
  maxSearchTerms: number;
  minTermLength: number;
  maxQueryDuration: number;
  fallbackThreshold: number;
}

export const DEFAULT_COMPLEXITY_LIMITS: QueryComplexityLimits = {
  maxSearchTerms: 3,
  minTermLength: 2,
  maxQueryDuration: 800, // ms, buffer before D1's 1000ms limit
  fallbackThreshold: 500 // ms, when to warn about slow queries
};
