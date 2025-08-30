/**
 * Fallback query strategies for handling complex pattern failures
 */

import { D1Database } from '@cloudflare/workers-types';

/**
 * Executes a query with automatic fallback to simpler patterns on complexity errors
 * @param db Database instance
 * @param primaryQuery Primary query to attempt
 * @param fallbackQuery Simplified fallback query
 * @param params Query parameters
 * @param description Query description for monitoring
 * @returns Query results or fallback results
 */
export async function executeWithFallback(
  db: D1Database,
  primaryQuery: string,
  fallbackQuery: string,
  params: any[],
  description: string
): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Attempt primary query
    const result = await db.prepare(primaryQuery).bind(...params).all();
    const duration = Date.now() - startTime;
    
    if (duration > 800) {
      console.warn(`Primary query "${description}" took ${duration}ms (near timeout)`);
    }
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Check for complexity-related errors
    if (error.message.includes('too complex') || 
        error.message.includes('LIKE or GLOB pattern too complex') ||
        error.message.includes('timeout')) {
      
      console.warn(`Primary query failed (${description}), attempting fallback after ${duration}ms`);
      
      try {
        // Attempt fallback query
        const fallbackResult = await db.prepare(fallbackQuery).bind(...params.slice(0, 2)).all();
        const fallbackDuration = Date.now() - startTime;
        
        console.log(`Fallback query succeeded for "${description}" in ${fallbackDuration}ms`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`Both primary and fallback queries failed for "${description}":`, fallbackError);
        throw new Error(`Query complexity too high: ${error.message}`);
      }
    }
    
    // Re-throw non-complexity errors
    throw error;
  }
}

/**
 * Creates simplified fallback queries for common search patterns
 * FIXED: Use only simple, single-column LIKE patterns to avoid D1 complexity limits
 * @param searchTerm Main search term
 * @returns Object with primary and fallback query configurations
 */
export function createFallbackQueries(searchTerm: string) {
  const safeTerm = searchTerm.replace(/[%_\\]/g, '\\$&');
  
  return {
    // Primary: Simple single-table search (no complex patterns)
    primary: {
      sql: `
        SELECT 
          natural_key,
          context_type,
          formatted_response,
          1 as type_rank
        FROM llm_trip_context
        WHERE natural_key LIKE ?
        ORDER BY access_count DESC
        LIMIT 5
      `,
      params: [`%${safeTerm}%`]
    },
    
    // Fallback: Direct trips table search (bypass views)
    fallback: {
      sql: `
        SELECT 
          trip_name as natural_key,
          'trip_basic' as context_type,
          trip_name || ' (' || status || ')' as formatted_response,
          1 as type_rank
        FROM trips_v2 
        WHERE trip_name LIKE ?
        ORDER BY updated_at DESC
        LIMIT 3
      `,
      params: [`%${safeTerm}%`]
    },
    
    // Emergency: Client table search
    emergency: {
      sql: `
        SELECT 
          email as natural_key,
          'client_basic' as context_type,
          full_name || ' (' || email || ')' as formatted_response,
          2 as type_rank
        FROM clients_v2 
        WHERE email LIKE ? OR full_name LIKE ?
        ORDER BY updated_at DESC
        LIMIT 3
      `,
      params: [`%${safeTerm}%`, `%${safeTerm}%`]
    }
  };
}

/**
 * Executes query with progressive fallback strategy
 * FIXED: Use simple single-term searches to avoid D1 complexity issues
 * @param db Database instance  
 * @param searchTerm Search term to query
 * @param description Query description
 * @returns Query results using the most suitable strategy
 */
export async function executeWithProgressiveFallback(
  db: D1Database,
  searchTerm: string,
  description: string
): Promise<any> {
  // For multi-word queries, extract first meaningful term to avoid complexity
  const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  const primaryTerm = words.find(w => !['create', 'new', 'all', 'show', 'get', 'find'].includes(w)) || words[0] || searchTerm;
  
  const queries = createFallbackQueries(primaryTerm);
  
  // Try simple primary query first
  try {
    const result = await db.prepare(queries.primary.sql)
      .bind(...queries.primary.params).all();
    
    if (result.results.length > 0) {
      console.log(`Primary query succeeded for "${description}" with term "${primaryTerm}"`);
      return result;
    }
  } catch (primaryError: any) {
    console.warn(`Primary query failed for "${description}":`, primaryError.message);
  }
  
  // Try trips table fallback
  try {
    const result = await db.prepare(queries.fallback.sql)
      .bind(...queries.fallback.params).all();
    
    if (result.results.length > 0) {
      console.log(`Trips fallback succeeded for "${description}" with term "${primaryTerm}"`);
      return result;
    }
  } catch (fallbackError: any) {
    console.warn(`Trips fallback failed for "${description}":`, fallbackError.message);
  }
  
  // Try clients table emergency search
  try {
    const result = await db.prepare(queries.emergency.sql)
      .bind(...queries.emergency.params).all();
    
    if (result.results.length > 0) {
      console.log(`Client emergency search succeeded for "${description}" with term "${primaryTerm}"`);
      return result;
    }
  } catch (emergencyError: any) {
    console.warn(`Client emergency search failed for "${description}":`, emergencyError.message);
  }
  
  // All searches failed - return suggestion response
  console.log(`All searches failed for "${description}" - returning suggestions`);
  return {
    results: [],
    error: 'no_results_found',
    message: `No results found for "${searchTerm}". Try specific terms like:\n- Trip names (e.g., "Paris Honeymoon")\n- Client names or emails\n- Single keywords like "planning" or "confirmed"`,
    suggestion: 'Use specific trip names or client emails for best results',
    searchTerm: primaryTerm
  };
}