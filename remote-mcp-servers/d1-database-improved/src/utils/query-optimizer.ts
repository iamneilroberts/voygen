/**
 * Query optimization utilities for complex pattern handling
 */

// Maximum safe search terms before complexity issues
const MAX_SEARCH_TERMS = 3;
const MIN_TERM_LENGTH = 2;

/**
 * Limits query complexity by reducing search terms and escaping special characters
 * @param searchTerms Array of search terms to optimize
 * @returns Optimized and limited search terms
 */
export function limitQueryComplexity(searchTerms: string[]): string[] {
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
 * Creates optimized WHERE clause for search terms with fallback patterns
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
 * Monitors query performance and logs warnings for slow queries
 * @param queryType Description of the query type
 * @param duration Query execution time in milliseconds
 */
export function monitorQueryPerformance(queryType: string, duration: number): void {
  if (duration > 5000) {
    console.warn(`Slow query detected: ${queryType} took ${duration}ms`);
  } else if (duration > 2000) {
    console.log(`Query performance note: ${queryType} took ${duration}ms`);
  }
}