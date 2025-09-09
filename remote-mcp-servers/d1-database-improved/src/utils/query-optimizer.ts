/**
 * Query optimization utilities for complex pattern handling
 * PHASE 1 ENHANCEMENT: Added weighted search capabilities
 */

import { 
  selectBestSearchTerms, 
  selectWeightedSearchTerms,
  normalizeSearchTerm, 
  removeStopWords,
  TermWeight 
} from './search-normalization';

// Maximum safe search terms - increased to 3 for better matching while staying safe
const MAX_SEARCH_TERMS = 3; // Increased from 2 to 3 with better term selection
const MIN_TERM_LENGTH = 2;

/**
 * Intelligently selects and limits search terms using smart algorithms
 * @param query Full search query string
 * @returns Optimized search terms (max 3)
 */
export function optimizeSearchQuery(query: string): string[] {
  // Use smart term selection instead of naive splitting
  const selectedTerms = selectBestSearchTerms(query, MAX_SEARCH_TERMS);
  const normalizedTerms = selectedTerms.map(normalizeSearchTerm);
  const filteredTerms = removeStopWords(normalizedTerms);
  
  // Fall back to normalized terms if filtering removed everything
  const finalTerms = filteredTerms.length > 0 ? filteredTerms : normalizedTerms.slice(0, 2);
  
  return finalTerms
    .filter(term => term.length >= MIN_TERM_LENGTH)
    .slice(0, MAX_SEARCH_TERMS)
    .map(term => term.replace(/[%_\\]/g, '\\$&')); // Escape SQLite LIKE special chars
}

/**
 * Legacy function - maintained for backward compatibility
 * @param searchTerms Array of search terms to optimize
 * @returns Optimized and limited search terms
 */
export function limitQueryComplexity(searchTerms: string[]): string[] {
  // If we get a single string that looks like a full query, optimize it properly
  if (searchTerms.length === 1 && searchTerms[0].includes(' ')) {
    return optimizeSearchQuery(searchTerms[0]);
  }
  
  return searchTerms
    .filter(term => term.length >= MIN_TERM_LENGTH)
    .slice(0, MAX_SEARCH_TERMS)
    .map(term => term.replace(/[%_\\]/g, '\\$&')); // Escape SQLite LIKE special chars
}

/**
 * Sanitizes a single search term for safe SQL LIKE operations
 * @param term The search term to sanitize
 * @returns Sanitized term ready for LIKE patterns
 */
export function sanitizeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/[%_\\]/g, '\\$&') // Escape LIKE wildcards and escape chars
    .replace(/[*+?{}()\[\]|]/g, ''); // Remove regex special chars
}

/**
 * Assesses query complexity based on various factors
 * @param query The search query to assess
 * @returns Complexity level: simple, moderate, or complex
 */
export function assessQueryComplexity(query: string): 'simple' | 'moderate' | 'complex' {
  const wordCount = query.split(/\s+/).length;
  const hasSpecialChars = /[*+?{}()\[\]|\\]/.test(query);
  const hasDatePattern = /\d{4}-\d{2}-\d{2}/.test(query);
  const hasMultipleFilters = query.includes(' and ') || query.includes(' with ') || query.includes(' in ');
  const hasAdvancedTerms = /\b(details|complete|comprehensive|all|every|total|show|display)\b/i.test(query);
  const hasComplexPatterns = query.includes(' all ') || query.includes(' me ') || query.includes('accommodations') || query.includes('transportation');
  
  if (wordCount > 6 || hasSpecialChars || hasMultipleFilters || hasComplexPatterns) return 'complex';
  if (wordCount > 4 || hasDatePattern || hasAdvancedTerms) return 'moderate';
  return 'simple';
}

/**
 * PHASE 1 NEW: Creates weighted query optimization for improved search success
 * Uses term weights to prioritize high-value search terms
 * @param query Full search query string
 * @param columns Array of column names to search
 * @returns Object with weighted SQL clause and parameters
 */
export function createWeightedWhereClause(query: string, columns: string[]) {
  const weightedTerms = selectWeightedSearchTerms(query, MAX_SEARCH_TERMS);
  
  if (weightedTerms.length === 0) {
    return createOptimizedWhereClause([query], columns);
  }
  
  // Strategy 1: High-weight terms (2.0+) - use comprehensive multi-column search
  const highWeightTerms = weightedTerms.filter(wt => wt.weight >= 2.0);
  
  // Strategy 2: Medium-weight terms (1.5+) - use targeted search
  const mediumWeightTerms = weightedTerms.filter(wt => wt.weight >= 1.5 && wt.weight < 2.0);
  
  // Strategy 3: Low-weight terms (< 1.5) - use basic search
  const lowWeightTerms = weightedTerms.filter(wt => wt.weight < 1.5);
  
  const conditions: string[] = [];
  const params: string[] = [];
  
  // High-weight terms: Search across all columns
  if (highWeightTerms.length > 0) {
    const highWeightConditions = highWeightTerms.map(wt => 
      `(${columns.map(col => `${col} LIKE ?`).join(' OR ')})`
    ).join(' AND ');
    conditions.push(`(${highWeightConditions})`);
    params.push(...highWeightTerms.flatMap(wt => columns.map(() => `%${wt.term}%`)));
  }
  
  // Medium-weight terms: Search primary columns (first 2)
  if (mediumWeightTerms.length > 0) {
    const primaryColumns = columns.slice(0, 2);
    const mediumWeightConditions = mediumWeightTerms.map(wt => 
      `(${primaryColumns.map(col => `${col} LIKE ?`).join(' OR ')})`
    ).join(' OR ');
    if (conditions.length > 0) {
      conditions.push(`OR (${mediumWeightConditions})`);
    } else {
      conditions.push(`(${mediumWeightConditions})`);
    }
    params.push(...mediumWeightTerms.flatMap(wt => primaryColumns.map(() => `%${wt.term}%`)));
  }
  
  // Low-weight terms: Search primary column only
  if (lowWeightTerms.length > 0) {
    const primaryColumn = columns[0];
    const lowWeightConditions = lowWeightTerms.map(() => `${primaryColumn} LIKE ?`).join(' OR ');
    if (conditions.length > 0) {
      conditions.push(`OR (${lowWeightConditions})`);
    } else {
      conditions.push(`(${lowWeightConditions})`);
    }
    params.push(...lowWeightTerms.map(wt => `%${wt.term}%`));
  }
  
  return { 
    clause: conditions.length > 0 ? conditions.join(' ') : '1=0', 
    params,
    weights: weightedTerms
  };
}

/**
 * Creates optimized WHERE clause for search terms with fallback patterns
 * PHASE 1 ENHANCED: Now supports weighted queries as fallback
 * @param searchTerms Array of search terms
 * @param columns Array of column names to search
 * @returns Object with SQL clause and parameters
 */
export function createOptimizedWhereClause(searchTerms: string[], columns: string[]) {
  const optimizedTerms = limitQueryComplexity(searchTerms);
  
  // Strategy 1: If only 1-2 terms, use comprehensive search
  if (optimizedTerms.length <= 2) {
    const conditions = optimizedTerms.map(term => 
      `(${columns.map(col => `${col} LIKE ?`).join(' OR ')})`
    ).join(' AND ');
    
    const params = optimizedTerms.flatMap(term => 
      columns.map(() => `%${term}%`)
    );
    
    return { clause: conditions, params };
  }
  
  // Strategy 2: If 3+ terms, use simplified single-column primary search
  const primaryColumn = columns[0]; // Use first column as primary
  const conditions = optimizedTerms.map(() => `${primaryColumn} LIKE ?`).join(' OR ');
  const params = optimizedTerms.map(term => `%${term}%`);
  
  return { clause: conditions, params };
}

/**
 * PHASE 1 NEW: Performance timing wrapper for search preprocessing
 * Ensures preprocessing stays under 50ms target
 */
export function measurePreprocessingPerformance<T>(
  operation: () => T,
  operationName: string
): { result: T; duration: number } {
  const startTime = performance.now();
  const result = operation();
  const duration = performance.now() - startTime;
  
  if (duration > 50) {
    console.warn(`PHASE 1 TARGET MISS: ${operationName} preprocessing took ${duration.toFixed(1)}ms (target: <50ms)`);
  } else if (duration > 25) {
    console.log(`PHASE 1 PERFORMANCE: ${operationName} preprocessing took ${duration.toFixed(1)}ms`);
  }
  
  return { result, duration };
}

/**
 * Monitors query performance and logs warnings for slow queries
 * PHASE 1 ENHANCED: Added preprocessing performance tracking
 * @param queryType Description of the query type
 * @param duration Query execution time in milliseconds
 */
export function monitorQueryPerformance(queryType: string, duration: number): void {
  if (duration > 5000) {
    console.warn(`Slow query detected: ${queryType} took ${duration}ms`);
  } else if (duration > 2000) {
    console.log(`Query performance note: ${queryType} took ${duration}ms`);
  }
  
  // Phase 1: Log preprocessing vs total query time ratio
  if (queryType.includes('preprocessing')) {
    const totalTime = duration;
    const preprocessingRatio = (totalTime / 50) * 100; // Compare to 50ms target
    console.log(`PHASE 1 METRICS: Preprocessing efficiency: ${preprocessingRatio.toFixed(1)}% of target`);
  }
}