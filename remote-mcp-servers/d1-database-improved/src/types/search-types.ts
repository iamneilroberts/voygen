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