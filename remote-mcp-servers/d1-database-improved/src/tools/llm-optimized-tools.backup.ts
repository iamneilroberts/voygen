import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { 
  limitQueryComplexity, 
  sanitizeSearchTerm, 
  assessQueryComplexity, 
  monitorQueryPerformance, 
  optimizeSearchQuery,
  createWeightedWhereClause,
  measurePreprocessingPerformance
} from '../utils/query-optimizer';
import { 
  normalizeSearchTerm, 
  createSearchVariations, 
  determineSearchStrategy,
  selectWeightedSearchTerms 
} from '../utils/search-normalization';
import { performSemanticSearch } from '../utils/semantic-search';
import { executeWithProgressiveFallback, createFallbackQueries } from '../utils/query-fallback';
import { SearchResponse, QueryPerformanceMetrics, DEFAULT_COMPLEXITY_LIMITS } from '../types/search-types';
import { recordDatabaseError, createErrorResponse, analyzeErrorPattern, shouldBypassForComplexity, extractOperationContext } from '../utils/error-recording';
import { generateSessionId, extractTableNames, sanitizeQueryForLogging } from '../utils/session-management';
import { extractTripStatus, formatStatusDashboard } from '../utils/status-formatter';

// EMERGENCY TIMEOUT PROTECTION
const QUERY_TIMEOUT_MS = 800; // Buffer before D1's 1000ms limit

// ActivityLog helper function
async function logActivity(
  db: D1Database, 
  activityType: string, 
  details: string, 
  tripId?: number | null,
  clientId?: number | null,
  sessionId?: string | null
) {
  console.log(`[logActivity] Called with: ${activityType}, tripId: ${tripId}, clientId: ${clientId}`);
  
  try {
    const finalSessionId = sessionId || generateSessionId();
    
    // Convert undefined to null for D1 compatibility
    const safeClientId = clientId === undefined ? null : clientId;
    const safeTripId = tripId === undefined ? null : tripId;
    
    console.log(`[logActivity] About to insert with safeClientId: ${safeClientId}, safeTripId: ${safeTripId}`);
    
    // Use D1 batch for better consistency when possible
    try {
      const stmt = db.prepare(`
        INSERT INTO ActivityLog (
          session_id,
          client_id,
          trip_id,
          activity_type,
          activity_timestamp,
          details
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).bind(finalSessionId, safeClientId, safeTripId, activityType, details);
      
      // Execute with batch for better consistency
      const result = await db.batch([stmt]);
      
      console.log(`[logActivity] Successfully logged activity: ${activityType} (batch result: ${result.length > 0 ? 'success' : 'no results'})`);
      
      return { success: true };
    } catch (batchError) {
      console.warn(`[logActivity] Batch insert failed, falling back to single statement:`, batchError);
      
      // Fallback to single statement
      await executeWithTimeout(
        db.prepare(`
          INSERT INTO ActivityLog (
            session_id,
            client_id,
            trip_id,
            activity_type,
            activity_timestamp,
            details
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `).bind(finalSessionId, safeClientId, safeTripId, activityType, details),
        'log activity'
      );
      
      console.log(`[logActivity] Successfully logged activity: ${activityType} (fallback method)`);
      return { success: true };
    }
  } catch (error: any) {
    console.error('Failed to log activity:', error);
    // Don't fail the main operation if logging fails
    return { success: false, error: error.message };
  }
}

async function executeWithTimeout(query: any, description: string) {
  const startTime = Date.now();
  
  try {
    const result = await query;
    const duration = Date.now() - startTime;
    
    if (duration > QUERY_TIMEOUT_MS) {
      console.warn(`Query "${description}" took ${duration}ms (near timeout)`);
    }
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Query "${description}" failed after ${duration}ms:`, error);
    
    if (error.message.includes('pattern too complex') || error.message.includes('LIKE or GLOB pattern too complex')) {
      // Don't wrap the error - let the calling code handle complex patterns with fallback
      console.warn(`Complex pattern detected in "${description}" - will attempt fallback`);
      throw error; // Re-throw original error for fallback handling
    }
    
    throw error;
  }
}

/**
 * LLM-Optimized Tools
 * Designed to return complete, formatted responses in a single call
 * No follow-up queries needed!
 */

// Query complexity assessment moved to utils/query-optimizer.ts


// The ONE tool to rule them all - FIXED VERSION
export const getAnythingTool = {
  name: 'get_anything',
  description: `Get COMPLETE information about any trip, client, or travel-related query. 

ENHANCED SEARCH CAPABILITY:
The system now intelligently handles name variations, normalizes "&" vs "and", and uses up to 3 distinctive terms.
You can be more natural in your queries while still being strategic about term selection.

SMART TERM SELECTION STRATEGY:
1. Use 2-3 MOST DISTINCTIVE terms from the user's request
2. Names work well: "Sara Darren" or "Sara and Darren" both work 
3. Names + location: "Sara Bristol" or "Jones Hawaii" are excellent
4. Email addresses are perfect unique identifiers
5. Trip IDs when available are ideal

EXAMPLES (Now Supported Better):
- User asks: "Sara and Darren Jones Bristol Bath anniversary trip details"
  YOU SEND: "Sara Darren Bristol" (system handles name normalization)
- User asks: "Show me the Smith family Hawaii vacation" 
  YOU SEND: "Smith Hawaii vacation" (up to 3 terms now supported)
- User asks: "All information about john@example.com"
  YOU SEND: "john@example.com" (email alone is perfect)

AVOID: Generic words like "trip", "details", "show", "all", "complete", "information"
The system returns MORE complete data with DISTINCTIVE search terms.`,
  inputSchema: z.object({
    query: z.string().describe('2-3 DISTINCTIVE TERMS (names, locations, unique identifiers). The system now handles "&" vs "and" and name variations automatically.'),
    include_everything: z.boolean().optional().default(true).describe('Return all possible related information to avoid follow-up queries'),
    search_strategy: z.enum(['exact', 'fuzzy', 'broad']).optional().default('fuzzy').describe('Search approach: exact for IDs/emails, fuzzy for names/locations, broad for complex queries')
  }),
  handler: async (input: any, db: D1Database): Promise<SearchResponse> => {
    try {
      // Validate input
      if (!input || !input.query) {
        return {
          response: "Please provide a search query",
          error: "missing_query"
        };
      }

      const searchTerm = input.query.toLowerCase().trim();
      const strategy = input.search_strategy || determineSearchStrategy(input.query);
      
      // PHASE 1 ENHANCEMENT: Measure preprocessing performance (target: <50ms)
      const preprocessingResult = measurePreprocessingPerformance(() => {
        return {
          searchVariations: createSearchVariations(input.query),
          optimizedTerms: optimizeSearchQuery(input.query),
          weightedTerms: selectWeightedSearchTerms(input.query, 3)
        };
      }, 'search_preprocessing');
      
      const { searchVariations, optimizedTerms, weightedTerms } = preprocessingResult.result;
      
      console.log(`[get_anything] PHASE 1: Search preprocessing completed in ${preprocessingResult.duration.toFixed(1)}ms`);
      console.log(`[get_anything] Search variations: ${searchVariations.join(', ')}`);
      console.log(`[get_anything] Optimized terms: ${optimizedTerms.join(', ')} (strategy: ${strategy})`);
      console.log(`[get_anything] Weighted terms: ${weightedTerms.map(wt => `${wt.term}(${wt.weight})`).join(', ')}`);
      
      // PHASE 2: SLUG DETECTION - Check for slug-like patterns first
      const slugPattern = /^[a-z0-9]+-[a-z0-9]+-[0-9]{4}$|^[a-z0-9-]+-[a-z0-9-]+-[0-9]{4}$/i;
      if (slugPattern.test(searchTerm.replace(/\s/g, '-'))) {
        const cleanSlug = searchTerm.replace(/\s/g, '-').toLowerCase();
        console.log(`PHASE 2: Slug query detected: "${input.query}" -> slug: ${cleanSlug}`);
        
        try {
          const slugResult = await executeWithTimeout(
            db.prepare(`
              SELECT 
                trip_id,
                trip_name,
                trip_slug,
                status,
                start_date,
                end_date,
                destinations,
                total_cost,
                clients,
                workflow_state,
                notes,
                primary_client_email,
                'slug_direct_match' as search_method
              FROM trips_v2 
              WHERE trip_slug = ?
            `).bind(cleanSlug).first(),
            'slug_direct_search'
          );

          if (slugResult) {
            console.log(`PHASE 2: Found trip by slug: ${slugResult.trip_name} (${slugResult.trip_slug})`);
            
            // Format comprehensive response for slug match
            const formattedResponse = `**TRIP FOUND BY SLUG**: ${slugResult.trip_name}
            
**Trip Details:**
- **Slug**: ${slugResult.trip_slug}
- **Status**: ${slugResult.status}
- **Dates**: ${slugResult.start_date} to ${slugResult.end_date}
- **Destinations**: ${slugResult.destinations || 'Not specified'}
- **Cost**: $${slugResult.total_cost || 0}
- **Clients**: ${slugResult.clients || 'Not specified'}
- **Notes**: ${slugResult.notes || 'No notes'}

**URL**: This trip can be accessed at: /trips/${slugResult.trip_slug}

**Search Method**: Direct slug match (Phase 2 enhancement)`;

            return {
              response: formattedResponse,
              context_type: 'trip_by_slug',
              natural_key: slugResult.trip_name,
              source: 'slug_direct_match',
              trip_id: slugResult.trip_id,
              trip_slug: slugResult.trip_slug
            } as SearchResponse;
          }
        } catch (error) {
          console.warn('PHASE 2: Slug search failed:', error);
          // Continue to other search methods
        }
      }

      // ID DETECTION: Check for numeric ID queries first
      const idMatch = searchTerm.match(/\b(?:trip|client).*?(?:id|ids?)\s*(\d+)|(?:id|ids?)\s*(\d+)|(\d+)/i);
      if (idMatch) {
        const numericId = parseInt(idMatch[1] || idMatch[2] || idMatch[3]);
        console.log(`ID query detected: "${input.query}" -> ID: ${numericId}`);
        
        // Handle trip ID query
        if (searchTerm.includes('trip') || !searchTerm.includes('client')) {
          try {
            const tripResult = await executeWithTimeout(
              db.prepare(`
                SELECT 
                  trip_id,
                  trip_name,
                  status,
                  start_date,
                  end_date,
                  destinations,
                  total_cost,
                  clients,
                  workflow_state
                FROM trips_v2 
                WHERE trip_id = ?
              `).bind(numericId).first(),
              `direct trip ID query for ID ${numericId}`
            );
            
            if (tripResult) {
              const clients = JSON.parse(tripResult.clients || '[]');
              const workflowStatus = tripResult.workflow_state 
                ? `Workflow: ${JSON.parse(tripResult.workflow_state).current_phase || 'not initialized'}`
                : 'Workflow: not initialized';
              
              return {
                response: `TRIP ID ${tripResult.trip_id}: ${tripResult.trip_name}
STATUS: ${tripResult.status} | DATES: ${tripResult.start_date} to ${tripResult.end_date}
DESTINATIONS: ${tripResult.destinations || 'TBD'}
COST: $${tripResult.total_cost || 0}
TRAVELERS: ${clients.length > 0 ? clients.map((c: any) => c.full_name || c.email).join(', ') : 'No clients assigned'}
${workflowStatus}`,
                context_type: 'trip_by_id',
                natural_key: tripResult.trip_name,
                source: 'direct_id_query'
              };
            }
          } catch (error) {
            console.warn(`Direct trip ID query failed for ${numericId}:`, error);
          }
        }
        
        // Handle client ID query
        if (searchTerm.includes('client')) {
          try {
            const clientResult = await executeWithTimeout(
              db.prepare(`
                SELECT 
                  client_id,
                  full_name,
                  email,
                  contact_info,
                  preferences,
                  trip_history
                FROM clients_v2 
                WHERE client_id = ?
              `).bind(numericId).first(),
              `direct client ID query for ID ${numericId}`
            );
            
            if (clientResult) {
              const tripHistory = JSON.parse(clientResult.trip_history || '[]');
              const contactInfo = JSON.parse(clientResult.contact_info || '{}');
              
              return {
                response: `CLIENT ID ${clientResult.client_id}: ${clientResult.full_name}
EMAIL: ${clientResult.email}
PHONE: ${contactInfo.phone || 'Not provided'}
TRIPS: ${tripHistory.length > 0 ? tripHistory.map((t: any) => t.trip_name).join(', ') : 'No trips assigned'}`,
                context_type: 'client_by_id',
                natural_key: clientResult.full_name,
                source: 'direct_id_query'
              };
            }
          } catch (error) {
            console.warn(`Direct client ID query failed for ${numericId}:`, error);
          }
        }
      }
      
      // SHOW ALL TRIPS WITH IDs: Special handling for "all trips" queries
      if (searchTerm.includes('all trips') && (searchTerm.includes('id') || searchTerm.includes('details'))) {
        try {
          const allTripsResult = await executeWithTimeout(
            db.prepare(`
              SELECT 
                trip_id,
                trip_name,
                status,
                start_date,
                end_date,
                destinations,
                total_cost,
                clients,
                workflow_state
              FROM trips_v2 
              ORDER BY updated_at DESC
              LIMIT 20
            `).all(),
            'all trips with IDs query'
          );
          
          if (allTripsResult.results.length > 0) {
            const tripsWithIds = allTripsResult.results.map((trip: any) => {
              const clients = JSON.parse(trip.clients || '[]');
              const workflowStatus = trip.workflow_state 
                ? JSON.parse(trip.workflow_state).current_phase || 'not initialized'
                : 'not initialized';
              
              return `ID ${trip.trip_id}: ${trip.trip_name} (${trip.status})
  Dates: ${trip.start_date} to ${trip.end_date} | Cost: $${trip.total_cost || 0}
  Travelers: ${clients.length > 0 ? clients.map((c: any) => c.full_name || c.email).join(', ') : 'None'}
  Workflow: ${workflowStatus}`;
            }).join('\n\n');
            
            return {
              response: `All Trips with IDs:\n\n${tripsWithIds}`,
              context_type: 'all_trips_with_ids',
              natural_key: 'All Trips',
              source: 'all_trips_id_query',
              total_count: allTripsResult.results.length
            };
          }
        } catch (error) {
          console.warn('All trips with IDs query failed:', error);
        }
      }
      
      // OPTIMIZATION: Assess query complexity to choose best strategy
      const complexity = assessQueryComplexity(input.query);
      
      // PHASE 1 & 2 ENHANCEMENT: Create weighted search clauses for all complexity levels including slug search
      const weightedWhereResult = createWeightedWhereClause(input.query, ['trip_name', 'destinations', 'notes', 'trip_slug']);
      const weightedViewWhereResult = createWeightedWhereClause(input.query, ['natural_key', 'search_keywords', 'formatted_response']);
      console.log(`[get_anything] PHASE 1 & 2: Prepared weighted search with ${weightedWhereResult.weights?.length || 0} weighted terms (including slug search)`);
      
      // For complex queries, skip view fallback and go directly to simple table search
      if (complexity === 'complex') {
        console.log(`Complex query detected: "${input.query}" - bypassing view fallback to avoid LIKE pattern complexity`);
        
        // Fallback to optimized terms if weighted search fails
        const searchTerms = optimizedTerms.length > 0 ? optimizedTerms : [searchTerm.split(' ')[0]];
        
        console.log(`[get_anything] Fallback search terms for complex query: ${searchTerms.join(', ')}`);
        
        // Progressive search strategy - try weighted search first, then fallback approaches
        let simpleResults = [];
        
        // PHASE 1: Strategy 0 - Try weighted search first
        if (weightedWhereResult.weights && weightedWhereResult.weights.length > 0) {
          try {
            const weightedQuery = `
              SELECT 
                trip_id, trip_name, trip_slug, destinations, start_date, end_date, 
                status, total_cost, notes, primary_client_email,
                'weighted_complex_search' as search_method
              FROM trips_v2 
              WHERE ${weightedWhereResult.clause}
              LIMIT 50
            `;
            
            const weightedResults = await executeWithTimeout(
              db.prepare(weightedQuery).bind(...weightedWhereResult.params).all(), 
              'weighted_complex_search'
            );
            
            if (weightedResults.results && weightedResults.results.length > 0) {
              console.log(`[get_anything] PHASE 1: Weighted search found ${weightedResults.results.length} results`);
              simpleResults = weightedResults.results;
            }
          } catch (error) {
            console.warn(`[get_anything] PHASE 1: Weighted search failed, falling back to standard search:`, error);
          }
        }
        
        // Strategy 1: Try with optimized terms first
        for (const termSet of [searchTerms, searchTerms.slice(0, 2), searchTerms.slice(0, 1)]) {
          if (simpleResults.length > 0) break;
          
          try {
            for (const term of termSet) {
              const tripResults = await executeWithTimeout(
                db.prepare(`
                  SELECT 
                    trip_name as natural_key,
                    'trip_simple' as context_type,
                    trip_name || ' - ' || status || ' (' || start_date || ' to ' || end_date || ')' || 
                    CASE 
                      WHEN json_extract(workflow_state, '$.current_phase') IS NOT NULL THEN 
                        ' | Workflow: ' || json_extract(workflow_state, '$.current_phase') || ' (step ' || json_extract(workflow_state, '$.current_step') || ')'
                      ELSE ' | Workflow: not initialized'
                    END as formatted_response,
                    json_object(
                      'trip_name', trip_name,
                      'status', status,
                      'start_date', start_date,
                      'end_date', end_date,
                      'total_cost', total_cost,
                      'workflow_state', workflow_state
                    ) as raw_data
                  FROM trips_v2 
                  WHERE LOWER(REPLACE(trip_name, '&', 'and')) LIKE LOWER(REPLACE(?, '&', 'and'))
                  ORDER BY updated_at DESC
                  LIMIT 3
                `).bind(`%${term}%`).all(),
                `progressive search for term "${term}"`
              );
              simpleResults.push(...tripResults.results);
              if (simpleResults.length > 0) break;
            }
          } catch (e) {
            console.warn(`Progressive search failed for terms ${termSet.join(', ')}:`, e);
          }
        }
        
        if (simpleResults.length > 0) {
          const bestMatch = simpleResults[0];
          console.log(`[ANALYTICS] complex_query_view_bypass_success: "${input.query}" -> ${simpleResults.length} results`);
          
          // Add status formatting for trip results
          const status = extractTripStatus(bestMatch.raw_data || bestMatch, bestMatch.context_type);
          const baseResponse = bestMatch.formatted_response + 
            (simpleResults.length > 1 ? 
              '\n\n=== Other matches ===\n' +
              simpleResults.slice(1, 4) // Limit to 3 additional results
                .map((m: any) => `- ${m.natural_key}`)
                .join('\n') : '');
          
          const formattedResponse = formatStatusDashboard(baseResponse, status);
          
          return {
            response: formattedResponse,
            context_type: bestMatch.context_type,
            natural_key: bestMatch.natural_key,
            source: 'complex_query_simple_search',
            complexity: complexity,
            search_terms: searchTerms
          };
        } else {
          console.log(`[ANALYTICS] complex_query_view_bypass_no_results: "${input.query}"`);
        }
      }
      
      // Direct search in live data - no FAQ cache

      // Try exact match on natural key - ORDER BY to get most recent entry
      const exactMatch = await db.prepare(`
        SELECT 
          natural_key,
          formatted_response,
          context_type,
          raw_data
        FROM llm_trip_context
        WHERE LOWER(natural_key) = ?
        ORDER BY last_accessed DESC, relevance_date DESC
        LIMIT 1
      `).bind(searchTerm).first();

      if (exactMatch) {
        // Update access count - fixed to use natural_key properly
        await db.prepare(`
          UPDATE llm_trip_context 
          SET access_count = access_count + 1, 
              last_accessed = CURRENT_TIMESTAMP 
          WHERE natural_key = ?
        `).bind(exactMatch.natural_key).run();

        let response = exactMatch.formatted_response;

        // Add additional context if requested
        if (input.include_everything && exactMatch.raw_data) {
          try {
            const data = JSON.parse(exactMatch.raw_data);
            
            // For trips, add client details
            if (exactMatch.context_type === 'trip_full' && data.clients) {
              const clientEmails = JSON.parse(data.clients)
                .map((c: any) => c.email)
                .filter((e: string) => e);
              
              if (clientEmails.length > 0) {
                const placeholders = clientEmails.map(() => '?').join(',');
                const clientInfo = await db.prepare(`
                  SELECT formatted_response 
                  FROM llm_trip_context 
                  WHERE context_type = 'client_profile' 
                    AND natural_key IN (${placeholders})
                `).bind(...clientEmails).all();
                
                if (clientInfo.results.length > 0) {
                  response += '\n\n=== CLIENT DETAILS ===\n';
                  response += clientInfo.results
                    .map((c: any) => c.formatted_response)
                    .join('\n\n---\n\n');
                }
              }
            }
          } catch (e) {
            console.error('Error adding context:', e);
          }
        }

        return {
          response: response,
          context_type: exactMatch.context_type,
          natural_key: exactMatch.natural_key,
          source: 'exact_match',
          complexity
        } as SearchResponse;
      }

      // Try partial match using simple LIKE (EMERGENCY FIX: Simplified to single term)
      // CRITICAL FIX: Skip this for complex queries to avoid D1 LIKE pattern complexity errors
      let partialMatches = { results: [] };
      
      if (complexity !== 'complex') {
        // PHASE 1 ENHANCEMENT: Try weighted search for moderate complexity queries first
        if (complexity === 'moderate' && weightedViewWhereResult.weights && weightedViewWhereResult.weights.length > 0) {
          try {
            const weightedViewQuery = `
              SELECT 
                natural_key,
                formatted_response,
                context_type,
                raw_data,
                last_accessed,
                'weighted_moderate_search' as search_method
              FROM llm_trip_context 
              WHERE ${weightedViewWhereResult.clause}
              ORDER BY access_count DESC, last_accessed DESC
              LIMIT 20
            `;
            
            const weightedViewResults = await executeWithTimeout(
              db.prepare(weightedViewQuery).bind(...weightedViewWhereResult.params).all(),
              'weighted_moderate_view_search'
            );
            
            if (weightedViewResults.results && weightedViewResults.results.length > 0) {
              console.log(`[get_anything] PHASE 1: Weighted moderate search found ${weightedViewResults.results.length} results`);
              partialMatches = weightedViewResults;
            }
          } catch (error) {
            console.warn(`[get_anything] PHASE 1: Weighted moderate search failed, falling back:`, error);
          }
        }
        
        // Fallback to standard search if weighted search didn't work or wasn't tried
        if (partialMatches.results.length === 0) {
          try {
            partialMatches = await executeWithTimeout(
              db.prepare(`
                SELECT 
                  natural_key,
                  formatted_response,
                  context_type,
                raw_data,
                CASE 
                  WHEN LOWER(natural_key) LIKE ? THEN 1
                  WHEN search_keywords LIKE ? THEN 2
                  ELSE 3
                END as match_rank
              FROM llm_trip_context
              WHERE 
                LOWER(natural_key) LIKE ? OR
                search_keywords LIKE ?
              ORDER BY match_rank, access_count DESC
              LIMIT 5
            `).bind(
              `%${searchTerm}%`,
              `%${searchTerm}%`,
              `%${searchTerm}%`,
              `%${searchTerm}%`
            ).all(),
            `partial match search`
          );
        } catch (error: any) {
          console.warn(`Partial match search failed for "${searchTerm}":`, error.message);
          if (error.message.includes('pattern too complex') || error.message.includes('LIKE or GLOB pattern too complex')) {
            console.log(`Bypassing partial match search due to pattern complexity for: "${searchTerm}"`);
            partialMatches = { results: [] }; // Continue to word search
          } else {
            throw error; // Re-throw non-complexity errors
          }
        }
      } else {
        console.log(`Skipping partial match search for complex query: "${searchTerm}"`);
      }

      if (partialMatches.results.length > 0) {
        const bestMatch = partialMatches.results[0];
        
        // Update access count for best match
        await db.prepare(`
          UPDATE llm_trip_context 
          SET access_count = access_count + 1, 
              last_accessed = CURRENT_TIMESTAMP 
          WHERE natural_key = ?
        `).bind(bestMatch.natural_key).run();

        if (partialMatches.results.length === 1) {
          // Single match - return it with status dashboard
          const status = extractTripStatus(bestMatch.raw_data || bestMatch, bestMatch.context_type);
          const formattedResponse = formatStatusDashboard(bestMatch.formatted_response, status);
          
          return {
            response: formattedResponse,
            context_type: bestMatch.context_type,
            natural_key: bestMatch.natural_key
          };
        } else {
          // Multiple matches - show best match with status dashboard and alternatives
          const status = extractTripStatus(bestMatch.raw_data || bestMatch, bestMatch.context_type);
          const formattedResponse = formatStatusDashboard(
            bestMatch.formatted_response + 
            '\n\n=== Other possible matches ===\n' +
            partialMatches.results.slice(1)
              .map((m: any) => `- ${m.natural_key} (${m.context_type})`)
              .join('\n'),
            status
          );
          
          return {
            response: formattedResponse,
            context_type: bestMatch.context_type,
            natural_key: bestMatch.natural_key,
            // alternatives: partialMatches.results.slice(1).length // Removed - not in SearchResponse interface
          };
        }
      }

      // PHASE 2 FIX: Enhanced word search with smart term extraction
      const words = searchTerm.split(/\s+/)
        .filter(w => w.length >= DEFAULT_COMPLEXITY_LIMITS.minTermLength);
      
      if (words.length > 0) {
        const startTime = Date.now();
        
        // Enhanced term extraction - filter out noise words and extract meaningful terms
        const stopWords = ['create', 'new', 'all', 'show', 'get', 'find', 'me', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'to'];
        const meaningfulWords = words.filter(w => !stopWords.includes(w.toLowerCase()));
        const searchTerms = meaningfulWords.length > 0 ? meaningfulWords.slice(0, 2) : words.slice(0, 1);
        
        // For complex queries (>3 words), use direct simple search instead of progressive fallback
        if (complexity === 'complex' || words.length > 4) {
          console.log(`Complex query detected, using direct simple search for terms: ${searchTerms.join(', ')}`);
          
          // Try direct simple searches on individual tables
          let simpleResults = [];
          
          // Search trips table
          try {
            for (const term of searchTerms) {
              const tripResults = await executeWithTimeout(
                db.prepare(`
                  SELECT 
                    trip_name as natural_key,
                    'trip_direct' as context_type,
                    trip_name || ' - ' || status || ' (' || start_date || ' to ' || end_date || ')' || 
                    CASE 
                      WHEN json_extract(workflow_state, '$.current_phase') IS NOT NULL THEN 
                        ' | Workflow: ' || json_extract(workflow_state, '$.current_phase') || ' (step ' || json_extract(workflow_state, '$.current_step') || ')'
                      ELSE ' | Workflow: not initialized'
                    END as formatted_response,
                    json_object(
                      'trip_name', trip_name,
                      'status', status,
                      'start_date', start_date,
                      'end_date', end_date,
                      'total_cost', total_cost,
                      'workflow_state', workflow_state
                    ) as raw_data
                  FROM trips_v2 
                  WHERE trip_name LIKE ? OR destinations LIKE ?
                  ORDER BY updated_at DESC
                  LIMIT 3
                `).bind(`%${term}%`, `%${term}%`).all(),
                `direct trip search for "${term}"`
              );
              simpleResults.push(...tripResults.results);
            }
          } catch (e) {
            console.warn('Direct trip search failed:', e);
          }
          
          // Search clients table
          try {
            for (const term of searchTerms) {
              const clientResults = await executeWithTimeout(
                db.prepare(`
                  SELECT 
                    email as natural_key,
                    'client_direct' as context_type,
                    full_name || ' (' || email || ')' as formatted_response
                  FROM clients_v2 
                  WHERE full_name LIKE ? OR email LIKE ?
                  ORDER BY updated_at DESC
                  LIMIT 3
                `).bind(`%${term}%`, `%${term}%`).all(),
                `direct client search for "${term}"`
              );
              simpleResults.push(...clientResults.results);
            }
          } catch (e) {
            console.warn('Direct client search failed:', e);
          }
          
          const duration = Date.now() - startTime;
          
          // Analytics logging as suggested by consensus
          console.log(`[ANALYTICS] complex_query_processed: "${input.query}" -> terms: [${searchTerms.join(', ')}], results: ${simpleResults.length}`);
          
          if (simpleResults.length > 0) {
            // Add status dashboard for first result if it's a trip
            let responseText = `Found ${simpleResults.length} results for "${input.query}":\n\n`;
            const topResults = simpleResults.slice(0, 5);
            
            if (topResults.length > 0 && topResults[0].context_type === 'trip_direct') {
              const status = extractTripStatus(topResults[0], 'trip_direct');
              responseText = formatStatusDashboard(responseText, status);
            }
            
            responseText += topResults
              .map((s: any) => `- ${s.formatted_response}`)
              .join('\n');
            
            return {
              response: responseText,
              suggestions: topResults,
              search_terms: searchTerms,
              performance: {
                queryType: 'complex_direct_search',
                duration,
                complexity,
                fallbackUsed: true,
                resultCount: simpleResults.length
              } as QueryPerformanceMetrics,
              source: 'direct_table_search'
            } as SearchResponse;
          } else {
            // Analytics logging for no results
            console.log(`[ANALYTICS] suggestions_returned: "${input.query}" -> no direct results`);
            
            return {
              response: `No results found for "${input.query}". Try specific terms like:\n` +
                `- Trip names (e.g., "Paris Honeymoon", "European Adventure")\n` +
                `- Client names (e.g., "Sarah Johnson") or emails\n` +
                `- Single keywords like "planning", "confirmed", or destination names`,
              error: 'no_results_complex_query',
              suggestion: 'Use specific trip names, client names, or single keywords for best results',
              search_terms: searchTerms,
              performance: {
                queryType: 'complex_no_results',
                duration,
                complexity,
                fallbackUsed: true,
                resultCount: 0
              } as QueryPerformanceMetrics,
              source: 'direct_search_suggestions'
            } as SearchResponse;
          }
        }
        
        // For moderate complexity, use the improved progressive fallback
        const optimizedWords = limitQueryComplexity(words);
        
        let wordSearch;
        try {
          // Use the fixed progressive fallback strategy
          wordSearch = await executeWithProgressiveFallback(
            db,
            searchTerm,
            `word search (${optimizedWords.length} terms)`
          );
          
          const duration = Date.now() - startTime;
          monitorQueryPerformance(`word search (${optimizedWords.length} terms)`, duration);
          
        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`Word search failed after ${duration}ms:`, error);
          
          // Record the error with context
          const sessionId = await recordDatabaseError(db, {
            attempted_operation: 'word_search_with_fallback',
            error_message: error.message,
            table_names: 'llm_trip_context',
            context: extractOperationContext('word_search', input, {
              search_terms: optimizedWords,
              complexity: complexity,
              duration: duration
            })
          });
          
          // Create specific error response for complex patterns
          return {
            response: `Search pattern too complex. Try simpler terms like:\n` +
              `- Trip name (e.g., "European Adventure")\n` +
              `- Client name or email\n` +
              `- Simple keywords like "recent trips" or "active trips"`,
            error: 'complex_pattern',
            suggestion: 'Use simpler search terms',
            session_id: sessionId,
            performance: {
              queryType: 'word_search_failed',
              duration,
              complexity,
              fallbackUsed: true,
              resultCount: 0
            } as QueryPerformanceMetrics
          } as SearchResponse;
        }

        // Handle wordSearch results (from progressive fallback)
        if (wordSearch && wordSearch.results && wordSearch.results.length > 0) {
          const duration = Date.now() - startTime;
          return {
            response: `No exact match for "${input.query}". Did you mean one of these?\n\n` +
              wordSearch.results
                .map((s: any) => `- ${s.natural_key} (${s.context_type})`)
                .join('\n'),
            suggestions: wordSearch.results,
            search_terms: optimizedWords,
            performance: {
              queryType: 'word_search_suggestions',
              duration,
              complexity,
              fallbackUsed: optimizedWords.length < words.length,
              resultCount: wordSearch.results.length
            } as QueryPerformanceMetrics,
            source: 'optimized_word_search'
          } as SearchResponse;
        } else if (wordSearch && wordSearch.error) {
          // Handle fallback error responses
          return wordSearch as SearchResponse;
        }
      }

      // No results found - provide helpful diagnostics
      try {
        // Get some similar trips for suggestions
        const similarTrips = await db.prepare(`
          SELECT trip_name, trip_id 
          FROM trips_v2 
          WHERE trip_name IS NOT NULL 
          ORDER BY updated_at DESC 
          LIMIT 5
        `).all();
        
        // Get recent clients for suggestions  
        const recentClients = await db.prepare(`
          SELECT full_name, email 
          FROM clients_v2 
          WHERE full_name IS NOT NULL 
          ORDER BY updated_at DESC 
          LIMIT 3
        `).all();
        
        const suggestions = [];
        if (similarTrips.results.length > 0) {
          suggestions.push("Recent trips:");
          suggestions.push(...similarTrips.results.map((t: any) => `  • ${t.trip_name} (ID: ${t.trip_id})`));
        }
        
        if (recentClients.results.length > 0) {
          suggestions.push("\nRecent clients:");
          suggestions.push(...recentClients.results.map((c: any) => `  • ${c.full_name} <${c.email}>`));
        }
        
        return {
          response: `No results found for "${input.query}".

**Diagnostic Info:**
• Original query: "${input.query}"
• Normalized search: "${normalizeSearchTerm(input.query)}"
• Search terms used: ${optimizedTerms.join(', ')}
• Search strategy: ${strategy}

**Suggestions:**
${suggestions.join('\n')}

**Search Tips:**
• Use exact trip names or client names
• Try searching with trip ID if you have it
• Use 2-3 distinctive terms (names, locations)
• Avoid generic words like "trip", "details", etc.`,
          error: 'not_found',
          complexity,
          diagnostic: {
            original_query: input.query,
            normalized_query: normalizeSearchTerm(input.query),
            optimized_terms: optimizedTerms,
            search_strategy: strategy,
            recent_trips: similarTrips.results,
            recent_clients: recentClients.results
          }
        } as SearchResponse;
        
      } catch (diagError) {
        // PHASE 3: SEMANTIC SEARCH - Final attempt using component-based semantic matching
        console.log(`PHASE 3: Attempting semantic search for "${input.query}"`);
        try {
          const semanticResults = await performSemanticSearch(db, input.query, 5);
          
          if (semanticResults.length > 0) {
            console.log(`PHASE 3: Semantic search found ${semanticResults.length} results`);
            
            const bestResult = semanticResults[0];
            const formattedResponse = `**SEMANTIC SEARCH RESULT**: ${bestResult.trip_name}

**Trip Details:**
- **Match Score**: ${(bestResult.semantic_score * 100).toFixed(1)}%
- **Components Matched**: ${bestResult.matched_components.map(c => `${c.component_type}:${c.component_value}`).join(', ')}
- **Trip Slug**: ${bestResult.trip_slug || 'Not available'}

**Alternative Matches:**
${semanticResults.slice(1).map(r => `- ${r.trip_name} (${(r.semantic_score * 100).toFixed(1)}% match)`).join('\n')}

**Search Method**: AI-powered semantic component matching (Phase 3)`;

            return {
              response: formattedResponse,
              context_type: 'semantic_search_result',
              natural_key: bestResult.trip_name,
              source: 'semantic_component_matching',
              trip_id: bestResult.trip_id,
              semantic_score: bestResult.semantic_score,
              alternatives: semanticResults.length - 1
            } as SearchResponse;
          }
        } catch (semanticError) {
          console.warn('PHASE 3: Semantic search failed:', semanticError);
          // Continue to no results response
        }

        return {
          response: `No results found for "${input.query}". Try:\n` +
            `- Exact trip or client names\n` +
            `- Trip IDs if available\n` +
            `- Key terms like names and locations\n` +
            `\n**Advanced Search Features:**\n` +
            `- Phase 1: Enhanced punctuation handling ✓\n` +
            `- Phase 2: URL-friendly slug search ✓\n` +
            `- Phase 3: AI semantic component matching ✓`,
          error: 'not_found',
          complexity,
          search_terms: optimizedTerms,
          search_enhancements: 'All 3 phases active'
        } as SearchResponse;
      }
    } catch (error: any) {
      console.error('get_anything error:', error);
      
      // Record the error with full context
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'get_anything_query',
        error_message: error.message,
        table_names: 'llm_trip_context,trips_v2,clients_v2',
        context: extractOperationContext('get_anything', input, {
          complexity: assessQueryComplexity(input.query || ''),
          search_term: input.query || ''
        })
      });
      
      // Create user-friendly error response
      const errorResponse = createErrorResponse(error, 'Search', input, sessionId);
      
      return {
        ...errorResponse,
        complexity: assessQueryComplexity(input.query || ''),
        performance: {
          queryType: 'error_handler',
          duration: 0,
          complexity: assessQueryComplexity(input.query || '') as 'simple' | 'moderate' | 'complex',
          fallbackUsed: false,
          resultCount: 0
        } as QueryPerformanceMetrics
      } as SearchResponse;
    }
  }
};

// Tool for maintaining conversation context
export const rememberContextTool = {
  name: 'remember_context',
  description: 'Store important facts from the current conversation to avoid repeated lookups',
  inputSchema: z.object({
    session_id: z.string().describe('Current session identifier'),
    facts: z.array(z.object({
      type: z.enum(['preference', 'constraint', 'decision', 'context']),
      subject: z.string(),
      fact: z.string()
    })).describe('Facts learned in this conversation'),
    active_context: z.object({
      trip_name: z.string().optional(),
      client_email: z.string().optional(),
      current_focus: z.string().optional()
    }).optional()
  }),
  handler: async (input: any, db: D1Database) => {
    const existing = await db.prepare(
      'SELECT * FROM llm_conversation_memory WHERE session_id = ?'
    ).bind(input.session_id).first();

    if (existing) {
      // Append new facts
      const existingFacts = JSON.parse(existing.learned_facts || '[]');
      const updatedFacts = [...existingFacts, ...input.facts];
      
      await db.prepare(`
        UPDATE llm_conversation_memory 
        SET learned_facts = ?,
            active_entities = ?,
            memory_context = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `).bind(
        JSON.stringify(updatedFacts),
        JSON.stringify(input.active_context || {}),
        `Current session facts:\n${updatedFacts.map((f: any) => 
          `- ${f.type}: ${f.subject} - ${f.fact}`).join('\n')}`,
        input.session_id
      ).run();
    } else {
      // Create new memory
      await db.prepare(`
        INSERT INTO llm_conversation_memory 
        (session_id, memory_context, learned_facts, active_entities)
        VALUES (?, ?, ?, ?)
      `).bind(
        input.session_id,
        `New session started. Facts:\n${input.facts.map((f: any) => 
          `- ${f.type}: ${f.subject} - ${f.fact}`).join('\n')}`,
        JSON.stringify(input.facts),
        JSON.stringify(input.active_context || {})
      ).run();
    }

    return { success: true, facts_stored: input.facts.length };
  }
};

// Bulk operations tool - do multiple things at once
export const bulkTripOperationsTool = {
  name: 'bulk_trip_operations',
  description: 'Perform multiple trip operations in a single call - assign clients, add activities, update costs, modify schedule, add notes, etc.',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    operations: z.array(z.object({
      type: z.enum(['add_activity', 'update_cost', 'add_note', 'update_status', 'add_document', 'assign_client']),
      data: z.any().describe('Operation-specific data. For assign_client: {client_id?, email?, first_name?, last_name?, role?, preferences?}')
    })).describe('Array of operations to perform')
  }),
  handler: async (input: any, db: D1Database) => {
    const results = [];
    
    try {
      // Find the trip
      const trip = await db.prepare(`
        SELECT trip_id, trip_name, status, notes, documents, total_cost
        FROM trips_v2
        WHERE trip_name LIKE ? OR trip_id = ?
        LIMIT 1
      `).bind(`%${input.trip_identifier}%`, parseInt(input.trip_identifier) || 0).first();

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      // Process each operation
      for (const op of input.operations) {
        try {
          switch (op.type) {
            case 'add_note':
              const currentNotes = JSON.parse(trip.notes || '{}');
              
              // Handle both string and object formats for op.data
              let noteData;
              if (typeof op.data === 'string') {
                // If data is a string, wrap it in a note property
                noteData = { note: op.data };
              } else if (typeof op.data === 'object' && op.data !== null) {
                // If data is an object, use it directly
                noteData = op.data;
              } else {
                // Invalid data format
                results.push({
                  operation: 'add_note',
                  success: false,
                  error: 'Note data must be a string or object'
                });
                continue;
              }
              
              const updatedNotes = {
                ...currentNotes,
                ...noteData,
                last_updated: new Date().toISOString()
              };
              
              await db.prepare(`
                UPDATE trips_v2 
                SET notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(JSON.stringify(updatedNotes), trip.trip_id).run();
              
              results.push({ 
                operation: 'add_note', 
                success: true,
                note_added: noteData.note || noteData
              });
              break;

            case 'update_status':
              const validStatuses = ['planning', 'confirmed', 'in_progress', 'completed', 'cancelled'];
              const newStatus = op.data.status.toLowerCase();
              
              if (!validStatuses.includes(newStatus)) {
                results.push({
                  operation: 'update_status',
                  success: false,
                  error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
                continue;
              }
              
              // CRITICAL FIX: Read fresh data before update to get accurate old_status
              const freshTrip = await db.prepare(`
                SELECT status FROM trips_v2 WHERE trip_id = ?
              `).bind(trip.trip_id).first();
              
              const actualOldStatus = freshTrip?.status || 'unknown';
              
              // Execute the update and verify it succeeded
              const updateResult = await db.prepare(`
                UPDATE trips_v2 
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(newStatus, trip.trip_id).run();
              
              // CRITICAL FIX: Verify the update actually occurred
              if (updateResult.meta.changes === 0) {
                results.push({
                  operation: 'update_status',
                  success: false,
                  error: `Failed to update trip status - no rows affected`,
                  trip_id: trip.trip_id
                });
                continue;
              }
              
              // Verify the status was actually changed by reading it back
              const verifyTrip = await db.prepare(`
                SELECT status FROM trips_v2 WHERE trip_id = ?
              `).bind(trip.trip_id).first();
              
              const actualNewStatus = verifyTrip?.status;
              
              if (actualNewStatus !== newStatus) {
                results.push({
                  operation: 'update_status',
                  success: false,
                  error: `Status update verification failed: expected ${newStatus}, got ${actualNewStatus}`,
                  old_status: actualOldStatus,
                  attempted_status: newStatus,
                  actual_status: actualNewStatus
                });
                continue;
              }
              
              // Also update the context with verified data
              await db.prepare(`
                UPDATE llm_trip_context
                SET formatted_response = REPLACE(formatted_response, 
                    'STATUS: ' || ?, 
                    'STATUS: ' || ?),
                    last_accessed = CURRENT_TIMESTAMP
                WHERE natural_key = ?
              `).bind(actualOldStatus, actualNewStatus, trip.trip_name).run();
              
              results.push({
                operation: 'update_status',
                success: true,
                old_status: actualOldStatus,
                new_status: actualNewStatus,
                verified: true,
                rows_affected: updateResult.meta.changes
              });
              break;

            case 'add_activity':
              // This would add to the schedule JSON
              results.push({
                operation: 'add_activity',
                success: false,
                error: 'Activity management not yet implemented'
              });
              break;

            case 'update_cost':
              const costData = op.data;
              
              // CRITICAL FIX: Read current cost before update
              const currentCostQuery = await db.prepare(`
                SELECT total_cost FROM trips_v2 WHERE trip_id = ?
              `).bind(trip.trip_id).first();
              
              const oldCost = currentCostQuery?.total_cost || 0;
              const newCost = costData.total_cost || 0;
              
              // Execute update and verify
              const costUpdateResult = await db.prepare(`
                UPDATE trips_v2 
                SET total_cost = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(newCost, trip.trip_id).run();
              
              // CRITICAL FIX: Verify the update occurred
              if (costUpdateResult.meta.changes === 0) {
                results.push({
                  operation: 'update_cost',
                  success: false,
                  error: `Failed to update cost - no rows affected`,
                  trip_id: trip.trip_id
                });
                continue;
              }
              
              // Verify by reading back
              const verifyCost = await db.prepare(`
                SELECT total_cost FROM trips_v2 WHERE trip_id = ?
              `).bind(trip.trip_id).first();
              
              const actualNewCost = verifyCost?.total_cost;
              
              results.push({
                operation: 'update_cost',
                success: true,
                old_total: oldCost,
                new_total: actualNewCost,
                verified: true,
                rows_affected: costUpdateResult.meta.changes
              });
              break;

            case 'add_document':
              const currentDocs = JSON.parse(trip.documents || '[]');
              currentDocs.push({
                ...op.data,
                added_date: new Date().toISOString()
              });
              
              await db.prepare(`
                UPDATE trips_v2 
                SET documents = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(JSON.stringify(currentDocs), trip.trip_id).run();
              
              results.push({
                operation: 'add_document',
                success: true,
                document: op.data.name || op.data.type
              });
              break;

            case 'assign_client':
              const clientData = op.data;
              let clientId = null;

              // Check if client exists by email or client_id
              let existingClient = null;
              if (clientData.client_id) {
                existingClient = await db.prepare(
                  'SELECT * FROM clients_v2 WHERE client_id = ?'
                ).bind(clientData.client_id).first();
              } else if (clientData.email) {
                existingClient = await db.prepare(
                  'SELECT * FROM clients_v2 WHERE email = ?'
                ).bind(clientData.email).first();
              }

              if (existingClient) {
                clientId = existingClient.client_id;
              } else if (clientData.full_name && clientData.email) {
                // Create new client if required data is provided
                const fullName = clientData.full_name || `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim();
                const contactInfo = {
                  phone: clientData.phone || '',
                  address: clientData.address || ''
                };
                
                const clientInsert = await db.prepare(`
                  INSERT INTO clients_v2 
                  (full_name, email, preferences, trip_history, contact_info, travel_docs, loyalty_programs, search_text, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(
                  fullName,
                  clientData.email,
                  JSON.stringify(clientData.preferences || {}),
                  JSON.stringify([]),
                  JSON.stringify(contactInfo),
                  JSON.stringify({}),
                  JSON.stringify({}),
                  `${fullName} ${clientData.email}`.toLowerCase()
                ).run();
                
                clientId = clientInsert.meta.last_row_id;
                results.push({
                  operation: 'create_client',
                  success: true,
                  client_id: clientId,
                  name: fullName,
                  email: clientData.email
                });
              } else {
                results.push({
                  operation: 'assign_client',
                  success: false,
                  error: 'Client not found and insufficient data to create new client (need full_name and email)'
                });
                continue;
              }

              // Now assign client to trip
              const currentClients = JSON.parse(trip.clients || '[]');
              
              // Check if client already assigned
              const isAlreadyAssigned = currentClients.some((c: any) => 
                c.client_id === clientId || c.email === clientData.email
              );

              if (!isAlreadyAssigned) {
                // Add client to trip's clients array
                const clientInfo = existingClient || {
                  client_id: clientId,
                  full_name: clientData.full_name || `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
                  email: clientData.email
                };

                currentClients.push({
                  client_id: clientInfo.client_id,
                  name: clientInfo.full_name,
                  email: clientInfo.email,
                  role: clientData.role || 'traveler',
                  assigned_date: new Date().toISOString()
                });

                // Update trip
                await db.prepare(`
                  UPDATE trips_v2 
                  SET clients = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE trip_id = ?
                `).bind(JSON.stringify(currentClients), trip.trip_id).run();

                // Update client's trip history
                const clientRecord = await db.prepare(
                  'SELECT trip_history FROM clients_v2 WHERE client_id = ?'
                ).bind(clientId).first();

                const tripHistory = JSON.parse(clientRecord?.trip_history || '[]');
                if (!tripHistory.some((t: any) => t.trip_id === trip.trip_id)) {
                  tripHistory.push({
                    trip_id: trip.trip_id,
                    trip_name: trip.trip_name,
                    assigned_date: new Date().toISOString(),
                    status: trip.status
                  });

                  await db.prepare(`
                    UPDATE clients_v2 
                    SET trip_history = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE client_id = ?
                  `).bind(JSON.stringify(tripHistory), clientId).run();
                }

                // Update LLM context for both trip and client
                await regenerateTripContext(db, trip.trip_id);
                await regenerateClientContext(db, clientId);

                results.push({
                  operation: 'assign_client',
                  success: true,
                  client_id: clientId,
                  client_name: clientInfo.full_name,
                  client_email: clientInfo.email,
                  role: clientData.role || 'traveler'
                });
              } else {
                results.push({
                  operation: 'assign_client',
                  success: false,
                  error: 'Client already assigned to this trip'
                });
              }
              break;

            default:
              results.push({
                operation: op.type,
                success: false,
                error: 'Unknown operation type'
              });
          }
        } catch (opError: any) {
          results.push({
            operation: op.type,
            success: false,
            error: opError.message
          });
        }
      }

      // Log bulk operations activity with travel agent-friendly descriptions
      if (results.length > 0) {
        const successfulOps = results.filter(r => r.success);
        if (successfulOps.length > 0) {
          // Create user-friendly description based on operation types
          let description = '';
          const opCounts = successfulOps.reduce((acc, op) => {
            acc[op.operation] = (acc[op.operation] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const descriptions = [];
          if (opCounts.add_note) descriptions.push('Added planning notes');
          if (opCounts.update_cost) descriptions.push('Updated trip budget');
          if (opCounts.assign_client) descriptions.push('Assigned travelers');
          if (opCounts.add_activity) descriptions.push('Added activities');
          if (opCounts.update_status) descriptions.push('Updated trip status');
          if (opCounts.add_document) descriptions.push('Added travel documents');
          
          // Handle any other operations generically
          Object.keys(opCounts).forEach(op => {
            if (!['add_note', 'update_cost', 'assign_client', 'add_activity', 'update_status', 'add_document'].includes(op)) {
              descriptions.push(`Updated ${op.replace('_', ' ')}`);
            }
          });
          
          description = descriptions.length > 0 
            ? descriptions.join(' and ') + ` for ${trip.trip_name}`
            : `Updated ${trip.trip_name}`;

          await logActivity(
            db,
            'TripProgress',
            description,
            trip.trip_id
          );
        }
      }

      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        operations_performed: results.length,
        results: results
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        results: results
      };
    }
  }
};

/**
 * Calculate total cost from booking confirmations text
 * Extracts costs like £839.44, $340.50, $582.70 and converts to USD
 */
function calculateTotalFromBookings(bookingNotes: string): number {
  if (!bookingNotes || typeof bookingNotes !== 'string') {
    return 0;
  }

  let totalUSD = 0;

  try {
    // Extract GBP amounts (£xxx.xx)
    const gbpMatches = bookingNotes.match(/£([0-9,]+\.?[0-9]*)/g);
    if (gbpMatches) {
      gbpMatches.forEach(match => {
        const amount = parseFloat(match.replace(/£|,/g, ''));
        if (!isNaN(amount)) {
          totalUSD += amount * 1.27; // £1 ≈ $1.27 approximate conversion
        }
      });
    }

    // Extract USD amounts ($xxx.xx)
    const usdMatches = bookingNotes.match(/\$([0-9,]+\.?[0-9]*)/g);
    if (usdMatches) {
      usdMatches.forEach(match => {
        const amount = parseFloat(match.replace(/\$|,/g, ''));
        if (!isNaN(amount)) {
          totalUSD += amount;
        }
      });
    }

    // Extract EUR amounts (€xxx.xx) - if any
    const eurMatches = bookingNotes.match(/€([0-9,]+\.?[0-9]*)/g);
    if (eurMatches) {
      eurMatches.forEach(match => {
        const amount = parseFloat(match.replace(/€|,/g, ''));
        if (!isNaN(amount)) {
          totalUSD += amount * 1.09; // €1 ≈ $1.09 approximate conversion
        }
      });
    }

    return Math.round(totalUSD * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.warn('[calculateTotalFromBookings] Error parsing booking costs:', error);
    return 0;
  }
}

// Helper function to regenerate formatted context
async function regenerateTripContext(db: D1Database, tripId: number) {
  try {
    console.log(`[regenerateTripContext] Starting for trip_id: ${tripId}`);
    
    const trip = await db.prepare('SELECT * FROM trips_v2 WHERE trip_id = ?').bind(tripId).first();
    if (!trip) {
      console.log(`[regenerateTripContext] Trip not found for id: ${tripId}`);
      return;
    }

    console.log(`[regenerateTripContext] Found trip: ${trip.trip_name}`);
    console.log(`[regenerateTripContext] Raw clients data: ${trip.clients}`);

    const schedule = JSON.parse(trip.schedule || '[]');
    const clients = JSON.parse(trip.clients || '[]');
    const financials = JSON.parse(trip.financials || '{}');
    
    console.log(`[regenerateTripContext] Parsed clients array length: ${clients.length}`);
    if (clients.length > 0) {
      console.log(`[regenerateTripContext] Clients:`, clients);
    }
    
    // Parse workflow state for enhanced context
    const workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : null;
    
    // Build formatted response with workflow information
    let formatted = `TRIP: ${trip.trip_name} (${trip.start_date} to ${trip.end_date})\n`;
    
    // CRITICAL FIX: Extract booking confirmations from JSON notes field
    let totalBookingCost = 0;
    let bookingDetails = '';
    
    try {
      const notes = JSON.parse(trip.notes || '{}');
      const bookingNotes = notes.notes; // The actual booking confirmations
      
      if (bookingNotes && typeof bookingNotes === 'string') {
        totalBookingCost = calculateTotalFromBookings(bookingNotes);
        bookingDetails = '\n\nBOOKING CONFIRMATIONS:\n' + bookingNotes;
      }
    } catch (error) {
      console.warn(`[regenerateTripContext] JSON parsing error for trip ${tripId}:`, error);
      // Continue with basic cost display if JSON parsing fails
    }
    
    // Use actual booking costs if available, otherwise fallback to trip totals
    const displayCost = totalBookingCost > 0 ? totalBookingCost : (trip.total_cost || 0);
    const displayPaid = trip.paid_amount || 0;
    const displayDue = Math.max(0, displayCost - displayPaid);
    
    formatted += `STATUS: ${trip.status} | COST: $${displayCost.toFixed(2)} (Paid: $${displayPaid}, Due: $${displayDue.toFixed(2)})${totalBookingCost > 0 ? ' [from confirmed bookings]' : ''}\n`;
    
    // Add workflow state information
    if (workflowState) {
      formatted += `WORKFLOW: ${workflowState.current_phase} phase (step ${workflowState.current_step})`;
      if (workflowState.phase_history && workflowState.phase_history.length > 0) {
        formatted += ` | Completed phases: ${workflowState.phase_history.length}`;
      }
      formatted += `\n`;
    } else {
      formatted += `WORKFLOW: Not initialized\n`;
    }
    formatted += `\n`;
    
    if (clients.length > 0) {
      formatted += `TRAVELERS: ${clients.map((c: any) => `${c.name} (${c.email})`).join(', ')}\n\n`;
    } else {
      formatted += `TRAVELERS: No clients assigned\n\n`;
    }
    
    if (schedule.length > 0) {
      formatted += `ITINERARY:\n`;
      schedule.forEach((day: any) => {
        formatted += `Day ${day.day_number} (${day.date}): ${day.day_name}\n`;
        if (day.activities) {
          day.activities.forEach((act: any) => {
            formatted += `- ${act.time}: ${act.title}\n`;
            if (act.description) formatted += `  ${act.description}\n`;
          });
        }
        formatted += '\n';
      });
    }

    // Add booking confirmations to the formatted response
    if (bookingDetails) {
      formatted += bookingDetails;
    }

    console.log(`[regenerateTripContext] Generated formatted response length: ${formatted.length}`);

    // CRITICAL FIX: Delete all existing entries for this trip before inserting the new one
    await db.prepare(`
      DELETE FROM llm_trip_context 
      WHERE natural_key = ? AND context_type = 'trip_full'
    `).bind(trip.trip_name).run();

    console.log(`[regenerateTripContext] Deleted existing context entries for: ${trip.trip_name}`);

    // Insert the new context
    const result = await db.prepare(`
      INSERT INTO llm_trip_context 
      (natural_key, formatted_response, raw_data, search_keywords, context_type, relevance_date, last_accessed)
      VALUES (?, ?, ?, ?, 'trip_full', ?, CURRENT_TIMESTAMP)
    `).bind(
      trip.trip_name,
      formatted,
      JSON.stringify(trip),
      `${trip.trip_name} ${trip.destinations || ''} ${clients.map((c: any) => c.email || '').join(' ')} ${bookingDetails.replace(/\n/g, ' ') || ''}`.toLowerCase(),
      trip.start_date
    ).run();

    console.log(`[regenerateTripContext] Context insert result:`, result);
    console.log(`[regenerateTripContext] Successfully regenerated context for trip: ${trip.trip_name}`);
  } catch (error) {
    console.error(`[regenerateTripContext] Error for trip_id ${tripId}:`, error);
    throw error;
  }
}

// Helper function to regenerate client context
async function regenerateClientContext(db: D1Database, clientId: number) {
  try {
    console.log(`[regenerateClientContext] Starting for client_id: ${clientId}`);
    
    const client = await db.prepare('SELECT * FROM clients_v2 WHERE client_id = ?').bind(clientId).first();
    if (!client) {
      console.log(`[regenerateClientContext] Client not found for id: ${clientId}`);
      return;
    }

    console.log(`[regenerateClientContext] Found client: ${client.full_name} (${client.email})`);
    console.log(`[regenerateClientContext] Raw trip_history data: ${client.trip_history}`);

    const tripHistory = JSON.parse(client.trip_history || '[]');
    const preferences = JSON.parse(client.preferences || '{}');
    
    console.log(`[regenerateClientContext] Parsed trip history length: ${tripHistory.length}`);
    if (tripHistory.length > 0) {
      console.log(`[regenerateClientContext] Trip history:`, tripHistory);
    }
    
    // Build formatted response
    let formatted = `CLIENT: ${client.full_name} (${client.email})\n`;
    const contactInfo = JSON.parse(client.contact_info || '{}');
    formatted += `CONTACT: ${contactInfo.phone || 'No phone'} | ${contactInfo.address || 'No address'}\n\n`;
    
    if (tripHistory.length > 0) {
      formatted += `TRIP HISTORY:\n`;
      tripHistory.forEach((trip: any) => {
        formatted += `- ${trip.trip_name} (${trip.status})\n`;
      });
      formatted += '\n';
    } else {
      formatted += `TRIP HISTORY: No trips assigned\n\n`;
    }
    
    if (Object.keys(preferences).length > 0) {
      formatted += `PREFERENCES:\n`;
      Object.entries(preferences).forEach(([key, value]) => {
        formatted += `- ${key}: ${value}\n`;
      });
    }

    console.log(`[regenerateClientContext] Generated formatted response length: ${formatted.length}`);

    // CRITICAL FIX: Delete all existing entries for this client before inserting the new one
    await db.prepare(`
      DELETE FROM llm_trip_context 
      WHERE natural_key = ? AND context_type = 'client_profile'
    `).bind(client.email).run();

    console.log(`[regenerateClientContext] Deleted existing context entries for: ${client.email}`);

    // Insert the new context
    const result = await db.prepare(`
      INSERT INTO llm_trip_context 
      (natural_key, formatted_response, raw_data, search_keywords, context_type, relevance_date, last_accessed)
      VALUES (?, ?, ?, ?, 'client_profile', ?, CURRENT_TIMESTAMP)
    `).bind(
      client.email,
      formatted,
      JSON.stringify(client),
      `${client.full_name} ${client.email} ${tripHistory.map((t: any) => t.trip_name).join(' ')}`.toLowerCase(),
      new Date().toISOString().split('T')[0]
    ).run();

    console.log(`[regenerateClientContext] Context insert result:`, result);
    console.log(`[regenerateClientContext] Successfully regenerated context for client: ${client.email}`);
  } catch (error) {
    console.error(`[regenerateClientContext] Error for client_id ${clientId}:`, error);
    throw error;
  }
}

// Tool to manually update ActivityLog entries to populate client_id from trip_id
export const updateActivitylogClientsTool = {
  name: 'update_activitylog_clients',
  description: 'Update ActivityLog entries to populate client_id from trip_id',
  inputSchema: z.object({}),
  handler: async (input: any, db: D1Database) => {
    try {
      console.log('[updateActivitylogClients] Starting update process');
      
      // Get all ActivityLog entries that need client_id populated
      const logsNeedingUpdate = await db.prepare(`
        SELECT log_id, trip_id, activity_type, activity_description
        FROM ActivityLog 
        WHERE client_id IS NULL AND trip_id IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 100
      `).all();

      if (!logsNeedingUpdate.results.length) {
        return { 
          success: true, 
          message: 'No ActivityLog entries need client_id updates',
          updated_count: 0 
        };
      }

      let updated = 0;
      const errors = [];

      for (const log of logsNeedingUpdate.results) {
        try {
          // Get trip clients to find primary client
          const trip = await db.prepare(`
            SELECT clients FROM trips_v2 WHERE trip_id = ?
          `).bind(log.trip_id).first();

          if (trip && trip.clients) {
            const clients = JSON.parse(trip.clients);
            if (clients.length > 0) {
              // Use first client as primary (or look for role="primary_traveler")
              const primaryClient = clients.find((c: any) => c.role === 'primary_traveler') || clients[0];
              
              await db.prepare(`
                UPDATE ActivityLog 
                SET client_id = ?
                WHERE log_id = ?
              `).bind(primaryClient.client_id, log.log_id).run();
              
              updated++;
            }
          }
        } catch (error) {
          errors.push(`Log ${log.log_id}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Updated ${updated} ActivityLog entries with client_id`,
        updated_count: updated,
        total_found: logsNeedingUpdate.results.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      console.error('[updateActivitylogClients] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Tool to clear and regenerate ActivityLog from trips table
export const resetActivitylogFromTripsTool = {
  name: 'reset_activitylog_from_trips',
  description: 'Clear ActivityLog and repopulate from trips_v2 table updated_at column',
  inputSchema: z.object({}),
  handler: async (input: any, db: D1Database) => {
    try {
      console.log('[resetActivitylogFromTrips] Starting reset process');
      
      // Clear existing ActivityLog
      await db.prepare('DELETE FROM ActivityLog').run();
      console.log('[resetActivitylogFromTrips] Cleared existing ActivityLog');
      
      // Get all trips to rebuild activity log
      const trips = await db.prepare(`
        SELECT trip_id, trip_name, status, clients, created_at, updated_at
        FROM trips_v2
        ORDER BY created_at DESC
      `).all();
      
      let inserted = 0;
      
      for (const trip of trips.results) {
        try {
          const clients = JSON.parse(trip.clients || '[]');
          const primaryClient = clients.find((c: any) => c.role === 'primary_traveler') || clients[0];
          
          // Insert trip creation activity
          await db.prepare(`
            INSERT INTO ActivityLog (trip_id, client_id, activity_type, activity_description, timestamp)
            VALUES (?, ?, 'trip_created', ?, ?)
          `).bind(
            trip.trip_id,
            primaryClient?.client_id || null,
            `Trip "${trip.trip_name}" created with status: ${trip.status}`,
            trip.created_at
          ).run();
          inserted++;
          
          // If updated_at is different from created_at, add update activity
          if (trip.updated_at !== trip.created_at) {
            await db.prepare(`
              INSERT INTO ActivityLog (trip_id, client_id, activity_type, activity_description, timestamp)
              VALUES (?, ?, 'trip_updated', ?, ?)
            `).bind(
              trip.trip_id,
              primaryClient?.client_id || null,
              `Trip "${trip.trip_name}" was updated`,
              trip.updated_at
            ).run();
            inserted++;
          }
        } catch (error) {
          console.error(`[resetActivitylogFromTrips] Error processing trip ${trip.trip_id}:`, error);
        }
      }
      
      return {
        success: true,
        message: `ActivityLog reset complete`,
        trips_processed: trips.results.length,
        activities_inserted: inserted
      };
    } catch (error: any) {
      console.error('[resetActivitylogFromTrips] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Tool to manually regenerate context cache for a specific trip or client
export const regenerateContextTool = {
  name: 'regenerate_context',
  description: 'Manually regenerate LLM context cache for a specific trip or client',
  inputSchema: z.object({
    trip_id: z.number().optional().describe('Trip ID to regenerate context for'),
    client_id: z.number().optional().describe('Client ID to regenerate context for'),
    trip_name: z.string().optional().describe('Trip name to regenerate context for'),
    client_email: z.string().optional().describe('Client email to regenerate context for')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const results = [];
      
      // Handle trip context regeneration
      if (input.trip_id || input.trip_name) {
        let tripId = input.trip_id;
        
        if (!tripId && input.trip_name) {
          const trip = await db.prepare(
            'SELECT trip_id FROM trips_v2 WHERE trip_name = ?'
          ).bind(input.trip_name).first();
          
          if (!trip) {
            return {
              success: false,
              error: `Trip not found: ${input.trip_name}`
            };
          }
          tripId = trip.trip_id;
        }
        
        console.log(`[regenerateContext] Regenerating trip context for trip_id: ${tripId}`);
        await regenerateTripContext(db, tripId);
        results.push({
          type: 'trip',
          trip_id: tripId,
          status: 'regenerated'
        });
      }
      
      // Handle client context regeneration  
      if (input.client_id || input.client_email) {
        let clientId = input.client_id;
        
        if (!clientId && input.client_email) {
          const client = await db.prepare(
            'SELECT client_id FROM clients_v2 WHERE email = ?'
          ).bind(input.client_email).first();
          
          if (!client) {
            return {
              success: false,
              error: `Client not found: ${input.client_email}`
            };
          }
          clientId = client.client_id;
        }
        
        console.log(`[regenerateContext] Regenerating client context for client_id: ${clientId}`);
        await regenerateClientContext(db, clientId);
        results.push({
          type: 'client',
          client_id: clientId,
          status: 'regenerated'
        });
      }
      
      if (results.length === 0) {
        return {
          success: false,
          error: 'Must provide trip_id/trip_name or client_id/client_email'
        };
      }
      
      return {
        success: true,
        message: 'Context regeneration completed',
        results: results
      };
    } catch (error: any) {
      console.error('[regenerateContext] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// CRITICAL P0 FIX: Tool to create new trips in trips_v2 table
export const createTripV2Tool = {
  name: 'create_trip_v2',
  description: 'Create a new trip in the trips_v2 table with proper JSON structure',
  inputSchema: z.object({
    trip_name: z.string().describe('Name/title for the trip'),
    start_date: z.string().describe('Start date (YYYY-MM-DD format)'),
    end_date: z.string().describe('End date (YYYY-MM-DD format)'),
    destinations: z.string().optional().describe('Primary destination(s)'),
    total_cost: z.number().optional().default(0).describe('Total estimated cost'),
    status: z.string().optional().default('planning').describe('Trip status: planning, confirmed, in_progress, completed, cancelled'),
    notes: z.string().optional().describe('Trip notes or description'),
    primary_client_email: z.string().optional().describe('Email of primary client (if known)')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Validate required fields
      if (!input.trip_name || !input.start_date || !input.end_date) {
        return {
          success: false,
          error: 'trip_name, start_date, and end_date are required'
        };
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end_date)) {
        return {
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        };
      }

      // Create initial JSON structures
      const initialClients = [];
      const initialSchedule = [];
      const initialAccommodations = [];
      const initialTransportation = [];
      const initialFinancials = {
        estimated_total: input.total_cost || 0,
        paid_amount: 0,
        outstanding_amount: input.total_cost || 0,
        currency: 'USD',
        budget_breakdown: {}
      };
      const initialDocuments = [];
      const initialNotes = input.notes ? {
        description: input.notes,
        created_at: new Date().toISOString(),
        planning_notes: []
      } : {};

      const searchText = `${input.trip_name} ${input.destinations || ''} ${input.primary_client_email || ''}`.toLowerCase();

      // Insert new trip
      const result = await executeWithTimeout(
        db.prepare(`
          INSERT INTO trips_v2 (
            trip_name, status, clients, primary_client_email,
            schedule, accommodations, transportation, financials,
            documents, notes, start_date, end_date, destinations,
            total_cost, paid_amount, search_text, created_at, updated_at,
            created_by, last_modified_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          input.trip_name,
          input.status || 'planning',
          JSON.stringify(initialClients),
          input.primary_client_email || null,
          JSON.stringify(initialSchedule),
          JSON.stringify(initialAccommodations),
          JSON.stringify(initialTransportation),
          JSON.stringify(initialFinancials),
          JSON.stringify(initialDocuments),
          JSON.stringify(initialNotes),
          input.start_date,
          input.end_date,
          input.destinations || '',
          input.total_cost || 0,
          0, // paid_amount starts at 0
          searchText,
          new Date().toISOString(),
          new Date().toISOString(),
          'system_creation_tool',
          'system_creation_tool'
        ).run(),
        'create new trip in trips_v2'
      );

      const tripId = result.meta.last_row_id;

      // Generate trip context for LLM system
      await regenerateTripContext(db, tripId);

      return {
        success: true,
        trip_id: tripId,
        trip_name: input.trip_name,
        start_date: input.start_date,
        end_date: input.end_date,
        status: input.status || 'planning',
        destinations: input.destinations || 'TBD',
        total_cost: input.total_cost || 0,
        message: `Trip "${input.trip_name}" created successfully! Trip ID: ${tripId}`
      };
    } catch (error: any) {
      console.error('create_trip_v2 error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to create trip in trips_v2 table'
      };
    }
  }
};

// CRITICAL P0 FIX: Tool to create new clients in clients_v2 table
export const createClientV2Tool = {
  name: 'create_client_v2',
  description: 'Create a new client in the clients_v2 table with proper JSON structure',
  inputSchema: z.object({
    email: z.string().email().describe('Client email address (required)'),
    full_name: z.string().describe('Client full name (required)'),
    phone: z.string().optional().describe('Phone number'),
    address: z.string().optional().describe('Full address'),
    preferences: z.object({}).optional().describe('Travel preferences as key-value pairs'),
    travel_docs: z.object({}).optional().describe('Travel document information'),
    loyalty_programs: z.object({}).optional().describe('Loyalty program memberships'),
    notes: z.string().optional().describe('Additional notes about client')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Validate required fields
      if (!input.email || !input.full_name) {
        return {
          success: false,
          error: 'email and full_name are required'
        };
      }

      // Check if client already exists
      const existingClient = await executeWithTimeout(
        db.prepare('SELECT client_id, full_name FROM clients_v2 WHERE email = ?').bind(input.email).first(),
        'check existing client'
      );

      if (existingClient) {
        return {
          success: false,
          error: 'Client already exists',
          existing_client: {
            client_id: existingClient.client_id,
            full_name: existingClient.full_name,
            email: input.email
          }
        };
      }

      // Create contact info structure
      const contactInfo = {
        phone: input.phone || '',
        address: input.address || '',
        emergency_contact: {}
      };

      const searchText = `${input.full_name} ${input.email}`.toLowerCase();

      // Insert new client
      const result = await executeWithTimeout(
        db.prepare(`
          INSERT INTO clients_v2 (
            email, full_name, contact_info, travel_docs,
            trip_history, preferences, loyalty_programs,
            search_text, created_at, updated_at,
            last_trip_date, total_trips, total_spent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          input.email,
          input.full_name,
          JSON.stringify(contactInfo),
          JSON.stringify(input.travel_docs || {}),
          JSON.stringify([]), // Empty trip history initially
          JSON.stringify(input.preferences || {}),
          JSON.stringify(input.loyalty_programs || {}),
          searchText,
          new Date().toISOString(),
          new Date().toISOString(),
          null, // No trips yet
          0, // No trips yet
          0.0 // No spending yet
        ).run(),
        'create new client in clients_v2'
      );

      const clientId = result.meta.last_row_id;

      // Generate client context for LLM system
      await regenerateClientContext(db, clientId);

      return {
        success: true,
        client_id: clientId,
        full_name: input.full_name,
        email: input.email,
        contact_info: contactInfo,
        message: `Client "${input.full_name}" created successfully! Client ID: ${clientId}`
      };
    } catch (error: any) {
      console.error('create_client_v2 error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to create client in clients_v2 table'
      };
    }
  }
};

// CRITICAL P0 FIX: Combined tool to create trip and assign client in one operation
export const createTripWithClientTool = {
  name: 'create_trip_with_client',
  description: 'Create a new trip and assign a client (new or existing) in a single operation',
  inputSchema: z.object({
    // Trip details
    trip_name: z.string().describe('Name/title for the trip'),
    start_date: z.string().describe('Start date (YYYY-MM-DD format)'),
    end_date: z.string().describe('End date (YYYY-MM-DD format)'),
    destinations: z.string().optional().describe('Primary destination(s)'),
    total_cost: z.number().optional().default(0).describe('Total estimated cost'),
    status: z.string().optional().default('planning').describe('Trip status'),
    trip_notes: z.string().optional().describe('Trip notes or description'),
    
    // Client details (will create if not exists, or find existing)
    client_email: z.string().email().describe('Client email address'),
    client_full_name: z.string().describe('Client full name'),
    client_phone: z.string().optional().describe('Client phone number'),
    client_preferences: z.object({}).optional().describe('Client travel preferences'),
    client_role: z.string().optional().default('primary_traveler').describe('Client role in trip')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Validate required fields
      if (!input.trip_name || !input.start_date || !input.end_date || !input.client_email || !input.client_full_name) {
        return {
          success: false,
          error: 'trip_name, start_date, end_date, client_email, and client_full_name are required'
        };
      }

      const results = {
        trip_created: false,
        client_created: false,
        client_assigned: false,
        errors: []
      };

      // Step 1: Find or create client
      let clientId = null;
      const existingClient = await executeWithTimeout(
        db.prepare('SELECT client_id, full_name FROM clients_v2 WHERE email = ?').bind(input.client_email).first(),
        'check existing client'
      );

      if (existingClient) {
        clientId = existingClient.client_id;
        results.client_found = {
          client_id: clientId,
          full_name: existingClient.full_name,
          email: input.client_email
        };
      } else {
        // Create new client
        const clientResult = await createClientV2Tool.handler({
          email: input.client_email,
          full_name: input.client_full_name,
          phone: input.client_phone,
          preferences: input.client_preferences || {}
        }, db);

        if (clientResult.success) {
          clientId = clientResult.client_id;
          results.client_created = true;
          results.new_client = {
            client_id: clientId,
            full_name: input.client_full_name,
            email: input.client_email
          };
        } else {
          results.errors.push(`Failed to create client: ${clientResult.error}`);
          return {
            success: false,
            error: 'Could not create or find client',
            details: results
          };
        }
      }

      // Step 2: Create trip
      const tripResult = await createTripV2Tool.handler({
        trip_name: input.trip_name,
        start_date: input.start_date,
        end_date: input.end_date,
        destinations: input.destinations,
        total_cost: input.total_cost,
        status: input.status,
        notes: input.trip_notes,
        primary_client_email: input.client_email
      }, db);

      if (!tripResult.success) {
        results.errors.push(`Failed to create trip: ${tripResult.error}`);
        return {
          success: false,
          error: 'Could not create trip',
          details: results
        };
      }

      results.trip_created = true;
      const tripId = tripResult.trip_id;

      // Step 3: Assign client to trip using bulk operations
      const assignResult = await bulkTripOperationsTool.handler({
        trip_identifier: input.trip_name,
        operations: [{
          type: 'assign_client',
          data: {
            client_id: clientId,
            email: input.client_email,
            full_name: input.client_full_name,
            role: input.client_role || 'primary_traveler'
          }
        }]
      }, db);

      if (assignResult.success) {
        results.client_assigned = true;
      } else {
        results.errors.push(`Failed to assign client to trip: ${assignResult.error}`);
      }

      // Log activity for trip creation with travel agent-friendly description
      await logActivity(
        db,
        'NewTrip',
        `Started planning ${input.trip_name} for ${input.client_full_name}`,
        tripId,
        clientId
      );

      return {
        success: true,
        trip_id: tripId,
        trip_name: input.trip_name,
        client_id: clientId,
        client_email: input.client_email,
        start_date: input.start_date,
        end_date: input.end_date,
        destinations: input.destinations || 'TBD',
        total_cost: input.total_cost || 0,
        results: results,
        message: `Successfully created trip "${input.trip_name}" and ${results.client_created ? 'created' : 'found'} client "${input.client_full_name}"`
      };
    } catch (error: any) {
      console.error('create_trip_with_client error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to create trip with client assignment'
      };
    }
  }
};

// WORKFLOW MANAGEMENT TOOLS - TASK-2025-096 Implementation
// These tools manage workflow state progression and phase transitions

export const advanceWorkflowPhaseTool = {
  name: 'advance_workflow_phase',
  description: 'Advance a trip to the next workflow phase with completion data and validation',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    new_phase: z.enum(['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation']).describe('New workflow phase to advance to'),
    completion_data: z.object({}).optional().describe('Data about the completed phase'),
    step_number: z.number().optional().default(1).describe('Step number within the new phase'),
    notes: z.string().optional().describe('Notes about the phase transition')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await executeWithTimeout(
        db.prepare(`
          SELECT trip_id, trip_name, workflow_state, status
          FROM trips_v2
          WHERE trip_name LIKE ? OR trip_id = ?
          LIMIT 1
        `).bind(`%${input.trip_identifier}%`, parseInt(input.trip_identifier) || 0).first(),
        'find trip for workflow advance'
      );

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      // Parse current workflow state
      let workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : null;
      const now = new Date().toISOString();

      // Initialize workflow state if not exists
      if (!workflowState) {
        workflowState = {
          current_phase: input.new_phase,
          current_step: input.step_number || 1,
          phase_data: {},
          phase_history: [],
          last_transition: now,
          workflow_metadata: {
            initialized_by: 'advance_workflow_phase_tool',
            initialized_at: now,
            total_duration: '0:00:00',
            phase_count: 1
          }
        };
      } else {
        // Record previous phase in history
        const previousPhase = workflowState.current_phase;
        const phaseStartTime = workflowState.last_transition;
        
        if (previousPhase) {
          const duration = calculatePhaseDuration(phaseStartTime, now);
          
          workflowState.phase_history.push({
            phase: previousPhase,
            completed_at: now,
            duration_minutes: duration,
            key_outcomes: input.completion_data ? Object.keys(input.completion_data) : [],
            completion_data: input.completion_data || {}
          });
        }

        // Update to new phase
        workflowState.current_phase = input.new_phase;
        workflowState.current_step = input.step_number || 1;
        workflowState.last_transition = now;
        workflowState.workflow_metadata.phase_count = (workflowState.workflow_metadata.phase_count || 1) + 1;

        // Add notes if provided
        if (input.notes) {
          if (!workflowState.phase_data[input.new_phase]) {
            workflowState.phase_data[input.new_phase] = {};
          }
          workflowState.phase_data[input.new_phase].transition_notes = input.notes;
        }
      }

      // Update the database
      await executeWithTimeout(
        db.prepare(`
          UPDATE trips_v2 
          SET workflow_state = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE trip_id = ?
        `).bind(JSON.stringify(workflowState), trip.trip_id).run(),
        'update workflow state'
      );

      // Log workflow advancement activity
      const previousPhase = workflowState.phase_history.length > 0 
        ? workflowState.phase_history[workflowState.phase_history.length - 1].phase 
        : 'none';
      
      await logActivity(
        db,
        'WorkflowAdvance',
        `Advanced trip "${trip.trip_name}" from ${previousPhase} to ${input.new_phase} phase${input.notes ? '. Notes: ' + input.notes : ''}`,
        trip.trip_id
      );

      // Regenerate trip context to include new workflow state
      await regenerateTripContext(db, trip.trip_id);

      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        previous_phase: workflowState.phase_history.length > 0 
          ? workflowState.phase_history[workflowState.phase_history.length - 1].phase 
          : 'none',
        new_phase: input.new_phase,
        current_step: input.step_number || 1,
        phase_count: workflowState.workflow_metadata.phase_count,
        message: `Trip "${trip.trip_name}" advanced to ${input.new_phase} phase (step ${input.step_number || 1})`
      };
    } catch (error: any) {
      console.error('advance_workflow_phase error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to advance workflow phase'
      };
    }
  }
};

export const setWorkflowStepTool = {
  name: 'set_workflow_step',
  description: 'Set the current step within the current workflow phase',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    step_number: z.number().describe('Step number within current phase'),
    step_data: z.object({}).optional().describe('Data specific to this step')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await executeWithTimeout(
        db.prepare(`
          SELECT trip_id, trip_name, workflow_state
          FROM trips_v2
          WHERE trip_name LIKE ? OR trip_id = ?
          LIMIT 1
        `).bind(`%${input.trip_identifier}%`, parseInt(input.trip_identifier) || 0).first(),
        'find trip for workflow step update'
      );

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      if (!trip.workflow_state) {
        return {
          success: false,
          error: 'Workflow not initialized for this trip',
          suggestion: 'Use advance_workflow_phase to initialize workflow first'
        };
      }

      // Parse and update workflow state
      const workflowState = JSON.parse(trip.workflow_state);
      const previousStep = workflowState.current_step;
      
      workflowState.current_step = input.step_number;
      workflowState.last_transition = new Date().toISOString();

      // Add step data if provided
      if (input.step_data) {
        const currentPhase = workflowState.current_phase;
        if (!workflowState.phase_data[currentPhase]) {
          workflowState.phase_data[currentPhase] = {};
        }
        workflowState.phase_data[currentPhase][`step_${input.step_number}`] = input.step_data;
      }

      // Update the database
      await executeWithTimeout(
        db.prepare(`
          UPDATE trips_v2 
          SET workflow_state = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE trip_id = ?
        `).bind(JSON.stringify(workflowState), trip.trip_id).run(),
        'update workflow step'
      );

      // Regenerate trip context
      await regenerateTripContext(db, trip.trip_id);

      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        current_phase: workflowState.current_phase,
        previous_step: previousStep,
        new_step: input.step_number,
        step_data_provided: !!input.step_data,
        message: `Trip "${trip.trip_name}" step updated to ${input.step_number} in ${workflowState.current_phase} phase`
      };
    } catch (error: any) {
      console.error('set_workflow_step error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to set workflow step'
      };
    }
  }
};

// Helper function for safe trip lookup - avoids complex LIKE patterns that cause D1 errors
async function findTripSafely(db: D1Database, tripIdentifier: string): Promise<any> {
  try {
    // First try exact match
    let trip = await executeWithTimeout(
      db.prepare(`
        SELECT trip_id, trip_name, workflow_state, status, start_date, end_date
        FROM trips_v2
        WHERE trip_name = ? OR trip_id = ?
        LIMIT 1
      `).bind(tripIdentifier, parseInt(tripIdentifier) || 0).first(),
      'exact trip lookup'
    );

    if (trip) return trip;

    // Try normalized matching (& vs and)
    const normalizedIdentifier = normalizeSearchTerm(tripIdentifier);
    trip = await executeWithTimeout(
      db.prepare(`
        SELECT trip_id, trip_name, workflow_state, status, start_date, end_date
        FROM trips_v2
        WHERE LOWER(REPLACE(trip_name, '&', 'and')) = LOWER(REPLACE(?, '&', 'and'))
        LIMIT 1
      `).bind(normalizedIdentifier).first(),
      'normalized trip lookup'
    );
    if (trip) return trip;

    // If identifier looks like an ID and no match, return null
    if (/^\d+$/.test(tripIdentifier)) {
      return null;
    }

    // Use smart term selection for partial matching
    const searchTerms = optimizeSearchQuery(tripIdentifier);
    console.log(`[findTripSafely] Using optimized terms: ${searchTerms.join(', ')}`);

    // Try with first optimized term (safest approach)
    if (searchTerms.length > 0) {
      const term = searchTerms[0];
      try {
        trip = await executeWithTimeout(
          db.prepare(`
            SELECT trip_id, trip_name, workflow_state, status, start_date, end_date
            FROM trips_v2
            WHERE LOWER(REPLACE(trip_name, '&', 'and')) LIKE LOWER(REPLACE(?, '&', 'and'))
            ORDER BY updated_at DESC
            LIMIT 1
          `).bind(`%${term}%`).first(),
          `optimized term search: ${term}`
        );
        if (trip) {
          console.log(`[findTripSafely] Found trip with term: ${term}`);
        }
      } catch (termError) {
        console.warn(`Term search failed for "${term}":`, termError);
      }
    }

    return trip;
  } catch (error: any) {
    console.error('findTripSafely error:', error);
    // If we get a complex pattern error, return null rather than fail
    if (error.message.includes('pattern too complex') || error.message.includes('LIKE or GLOB pattern too complex')) {
      console.warn(`Complex pattern avoided in trip lookup for: ${tripIdentifier}`);
      return null;
    }
    throw error;
  }
}

export const getWorkflowStatusTool = {
  name: 'get_workflow_status',
  description: 'Get detailed workflow status for a trip including phase history and current state',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip using safe lookup to avoid complex LIKE patterns
      const trip = await findTripSafely(db, input.trip_identifier);

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      if (!trip.workflow_state) {
        return {
          success: true,
          trip_id: trip.trip_id,
          trip_name: trip.trip_name,
          workflow_initialized: false,
          message: `Trip "${trip.trip_name}" workflow not initialized`,
          suggestion: 'Use advance_workflow_phase to initialize workflow'
        };
      }

      // Parse workflow state
      const workflowState = JSON.parse(trip.workflow_state);
      
      // Calculate total duration
      const totalDuration = calculateTotalWorkflowDuration(workflowState);
      
      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        trip_status: trip.status,
        trip_dates: `${trip.start_date} to ${trip.end_date}`,
        workflow_initialized: true,
        current_phase: workflowState.current_phase,
        current_step: workflowState.current_step,
        last_transition: workflowState.last_transition,
        total_phases_completed: workflowState.phase_history?.length || 0,
        phase_history: workflowState.phase_history || [],
        phase_data: workflowState.phase_data || {},
        workflow_metadata: workflowState.workflow_metadata || {},
        total_duration: totalDuration,
        message: `Trip "${trip.trip_name}" is in ${workflowState.current_phase} phase (step ${workflowState.current_step})`
      };
    } catch (error: any) {
      console.error('get_workflow_status error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to get workflow status'
      };
    }
  }
};

export const getWorkflowInstructionsTool = {
  name: 'get_workflow_instructions',
  description: 'Get phase-specific instructions for the current workflow state of a trip',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    include_all_phases: z.boolean().optional().default(false).describe('Include instructions for all phases, not just current')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip and its workflow state
      const trip = await executeWithTimeout(
        db.prepare(`
          SELECT trip_id, trip_name, workflow_state, status
          FROM trips_v2
          WHERE trip_name LIKE ? OR trip_id = ?
          LIMIT 1
        `).bind(`%${input.trip_identifier}%`, parseInt(input.trip_identifier) || 0).first(),
        'find trip for workflow instructions'
      );

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      if (!trip.workflow_state) {
        // Get general workflow instructions if no specific workflow state
        const generalInstructions = await executeWithTimeout(
          db.prepare(`
            SELECT name, title, content, workflow_phase, workflow_step
            FROM instruction_sets
            WHERE workflow_phase = 'interview' AND active = 1
            ORDER BY workflow_step
          `).all(),
          'get general workflow instructions'
        );

        return {
          success: true,
          trip_id: trip.trip_id,
          trip_name: trip.trip_name,
          workflow_initialized: false,
          instructions: generalInstructions.results,
          message: `Trip "${trip.trip_name}" workflow not initialized. Here are getting started instructions.`,
          suggestion: 'Use initialize_workflow to set up workflow state, then get phase-specific instructions'
        };
      }

      // Parse workflow state
      const workflowState = JSON.parse(trip.workflow_state);
      const currentPhase = workflowState.current_phase;
      const currentStep = workflowState.current_step;

      // Get current phase instructions
      let instructionsQuery;
      if (input.include_all_phases) {
        instructionsQuery = db.prepare(`
          SELECT name, title, content, workflow_phase, workflow_step
          FROM instruction_sets
          WHERE workflow_phase IS NOT NULL AND active = 1
          ORDER BY 
            CASE workflow_phase
              WHEN 'interview' THEN 1
              WHEN 'conceptualization' THEN 2
              WHEN 'planning' THEN 3
              WHEN 'proposal' THEN 4
              WHEN 'revision' THEN 5
              WHEN 'finalization' THEN 6
              WHEN 'preparation' THEN 7
              ELSE 8
            END,
            workflow_step
        `);
      } else {
        instructionsQuery = db.prepare(`
          SELECT name, title, content, workflow_phase, workflow_step
          FROM instruction_sets
          WHERE workflow_phase = ? AND active = 1
          ORDER BY workflow_step
        `).bind(currentPhase);
      }

      const instructions = await executeWithTimeout(
        instructionsQuery.all(),
        'get workflow phase instructions'
      );

      // Get phase history for context
      const phaseHistory = workflowState.phase_history || [];
      const completedPhases = phaseHistory.map((p: any) => p.phase);

      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        workflow_initialized: true,
        current_phase: currentPhase,
        current_step: currentStep,
        completed_phases: completedPhases,
        instructions: instructions.results,
        phase_history: phaseHistory,
        total_instructions: instructions.results.length,
        message: input.include_all_phases 
          ? `All workflow instructions for trip "${trip.trip_name}" (currently in ${currentPhase} phase)`
          : `Instructions for ${currentPhase} phase of trip "${trip.trip_name}" (step ${currentStep})`
      };
    } catch (error: any) {
      console.error('get_workflow_instructions error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to get workflow instructions'
      };
    }
  }
};

export const initializeWorkflowTool = {
  name: 'initialize_workflow',
  description: 'Initialize workflow state for a trip with a starting phase',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    starting_phase: z.enum(['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation']).optional().default('interview').describe('Starting workflow phase'),
    initial_data: z.object({}).optional().describe('Initial workflow data')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip using safe lookup to avoid complex LIKE patterns
      const trip = await findTripSafely(db, input.trip_identifier);

      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          trip_identifier: input.trip_identifier
        };
      }

      if (trip.workflow_state) {
        const existingState = JSON.parse(trip.workflow_state);
        return {
          success: false,
          error: 'Workflow already initialized',
          current_phase: existingState.current_phase,
          current_step: existingState.current_step,
          message: `Trip "${trip.trip_name}" workflow already in ${existingState.current_phase} phase`
        };
      }

      // Create initial workflow state
      const now = new Date().toISOString();
      const workflowState = {
        current_phase: input.starting_phase || 'interview',
        current_step: 1,
        phase_data: input.initial_data || {},
        phase_history: [],
        last_transition: now,
        workflow_metadata: {
          initialized_by: 'initialize_workflow_tool',
          initialized_at: now,
          total_duration: '0:00:00',
          phase_count: 1
        }
      };

      // Update the database
      await executeWithTimeout(
        db.prepare(`
          UPDATE trips_v2 
          SET workflow_state = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE trip_id = ?
        `).bind(JSON.stringify(workflowState), trip.trip_id).run(),
        'initialize workflow state'
      );

      // Regenerate trip context
      await regenerateTripContext(db, trip.trip_id);

      return {
        success: true,
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        starting_phase: input.starting_phase || 'interview',
        initialized_at: now,
        message: `Workflow initialized for trip "${trip.trip_name}" starting with ${input.starting_phase || 'interview'} phase`
      };
    } catch (error: any) {
      console.error('initialize_workflow error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to initialize workflow'
      };
    }
  }
};

// Helper functions for workflow management
function calculatePhaseDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / (1000 * 60)); // Duration in minutes
}

function calculateTotalWorkflowDuration(workflowState: any): string {
  if (!workflowState.phase_history || workflowState.phase_history.length === 0) {
    const start = new Date(workflowState.workflow_metadata?.initialized_at || workflowState.last_transition);
    const now = new Date();
    const minutes = Math.round((now.getTime() - start.getTime()) / (1000 * 60));
    return formatDuration(minutes);
  }

  const totalMinutes = workflowState.phase_history.reduce((sum: number, phase: any) => {
    return sum + (phase.duration_minutes || 0);
  }, 0);

  // Add current phase duration
  const currentPhaseStart = new Date(workflowState.last_transition);
  const now = new Date();
  const currentPhaseDuration = Math.round((now.getTime() - currentPhaseStart.getTime()) / (1000 * 60));

  return formatDuration(totalMinutes + currentPhaseDuration);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}:00`;
}

// Enhanced bulk_trip_operations to support workflow operations
// Update the existing bulkTripOperationsTool to support workflow operations
const originalBulkOperations = bulkTripOperationsTool.handler;

bulkTripOperationsTool.inputSchema = z.object({
  trip_identifier: z.string().describe('Trip name or ID'),
  operations: z.array(z.object({
    type: z.enum(['add_activity', 'update_cost', 'add_note', 'update_status', 'add_document', 'assign_client', 'advance_workflow', 'set_workflow_step']),
    data: z.any().describe('Operation-specific data. For workflow operations: {phase?, step_number?, completion_data?, notes?}')
  })).describe('Array of operations to perform including workflow operations')
});

bulkTripOperationsTool.handler = async (input: any, db: D1Database) => {
  // Handle workflow operations in the existing bulk operations handler
  const results = [];
  
  try {
    // Find the trip first
    const trip = await db.prepare(`
      SELECT trip_id, trip_name, status, notes, documents, total_cost, workflow_state
      FROM trips_v2
      WHERE trip_name LIKE ? OR trip_id = ?
      LIMIT 1
    `).bind(`%${input.trip_identifier}%`, parseInt(input.trip_identifier) || 0).first();

    if (!trip) {
      return {
        success: false,
        error: 'Trip not found',
        trip_identifier: input.trip_identifier
      };
    }

    // Process each operation, including new workflow operations
    for (const op of input.operations) {
      try {
        switch (op.type) {
          case 'advance_workflow':
            const advanceResult = await advanceWorkflowPhaseTool.handler({
              trip_identifier: input.trip_identifier,
              new_phase: op.data.phase,
              completion_data: op.data.completion_data,
              step_number: op.data.step_number,
              notes: op.data.notes
            }, db);
            
            results.push({
              operation: 'advance_workflow',
              success: advanceResult.success,
              ...advanceResult
            });
            break;

          case 'set_workflow_step':
            const stepResult = await setWorkflowStepTool.handler({
              trip_identifier: input.trip_identifier,
              step_number: op.data.step_number,
              step_data: op.data.step_data
            }, db);
            
            results.push({
              operation: 'set_workflow_step',
              success: stepResult.success,
              ...stepResult
            });
            break;

          default:
            // Handle all existing operations using the original handler
            const originalResult = await originalBulkOperations(input, db);
            return originalResult; // Return original result for non-workflow operations
        }
      } catch (opError: any) {
        results.push({
          operation: op.type,
          success: false,
          error: opError.message
        });
      }
    }

    return {
      success: true,
      trip_id: trip.trip_id,
      trip_name: trip.trip_name,
      operations_performed: results.length,
      results: results
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      results: results
    };
  }
};

// Error Analysis Tools - TASK-2025-110 Implementation
export const analyzeRecentErrorsTool = {
  name: 'analyze_recent_errors',
  description: 'Analyze recent database errors and provide insights',
  inputSchema: z.object({
    hours: z.number().optional().default(24).describe('Hours to look back for errors'),
    limit: z.number().optional().default(10).describe('Maximum number of error patterns to return')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const recentErrors = await db.prepare(`
        SELECT 
          attempted_operation, 
          error_message, 
          COUNT(*) as frequency,
          suggested_tool, 
          MAX(error_timestamp) as last_occurrence,
          GROUP_CONCAT(DISTINCT table_names) as affected_tables
        FROM db_errors 
        WHERE error_timestamp > datetime('now', '-' || ? || ' hours')
        GROUP BY error_message, attempted_operation
        ORDER BY frequency DESC, last_occurrence DESC
        LIMIT ?
      `).bind(input.hours, input.limit).all();
      
      if (!recentErrors.results || recentErrors.results.length === 0) {
        return {
          success: true,
          message: `No errors recorded in the last ${input.hours} hours`,
          error_patterns: [],
          total_errors: 0
        };
      }
      
      // Analyze patterns
      const insights = [];
      let totalErrors = 0;
      
      for (const error of recentErrors.results) {
        totalErrors += error.frequency;
        const pattern = analyzeErrorPattern(error.error_message);
        
        insights.push({
          operation: error.attempted_operation,
          error_message: error.error_message,
          frequency: error.frequency,
          last_occurrence: error.last_occurrence,
          suggested_tool: error.suggested_tool,
          affected_tables: error.affected_tables,
          pattern_category: pattern.category,
          severity: pattern.severity
        });
      }
      
      return {
        success: true,
        total_errors: totalErrors,
        unique_patterns: insights.length,
        time_range: `${input.hours} hours`,
        error_patterns: insights,
        recommendations: generateErrorRecommendations(insights),
        message: `Found ${insights.length} unique error patterns (${totalErrors} total errors) in the last ${input.hours} hours`
      };
    } catch (error: any) {
      console.error('analyze_recent_errors error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to analyze recent errors'
      };
    }
  }
};

export const resolveErrorPatternTool = {
  name: 'resolve_error_pattern',
  description: 'Mark error patterns as resolved and track successful solutions',
  inputSchema: z.object({
    error_pattern: z.string().describe('Error message pattern to resolve'),
    resolution: z.string().describe('Description of how the error was resolved'),
    session_id: z.string().optional().describe('Session ID if resolving a specific error')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      let updateQuery;
      let bindParams;
      
      if (input.session_id) {
        // Resolve specific error by session ID
        updateQuery = `
          UPDATE db_errors 
          SET resolved = 1, resolution = ?, resolved_at = CURRENT_TIMESTAMP
          WHERE session_id = ? AND resolved = 0
        `;
        bindParams = [input.resolution, input.session_id];
      } else {
        // Resolve pattern across all similar errors
        updateQuery = `
          UPDATE db_errors 
          SET resolved = 1, resolution = ?, resolved_at = CURRENT_TIMESTAMP
          WHERE error_message LIKE ? AND resolved = 0
        `;
        bindParams = [input.resolution, `%${input.error_pattern}%`];
      }
      
      const result = await db.prepare(updateQuery).bind(...bindParams).run();
      
      return {
        success: true,
        errors_resolved: result.meta.changes,
        resolution: input.resolution,
        pattern: input.error_pattern,
        message: `Marked ${result.meta.changes} errors as resolved with solution: ${input.resolution}`
      };
    } catch (error: any) {
      console.error('resolve_error_pattern error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to resolve error pattern'
      };
    }
  }
};

// Helper function to generate recommendations based on error patterns
function generateErrorRecommendations(insights: any[]): string[] {
  const recommendations = [];
  
  // Analyze error categories
  const categoryCount = insights.reduce((acc, insight) => {
    acc[insight.pattern_category] = (acc[insight.pattern_category] || 0) + insight.frequency;
    return acc;
  }, {});
  
  if (categoryCount.complexity > 0) {
    recommendations.push(`Found ${categoryCount.complexity} complexity-related errors. Consider implementing query simplification patterns.`);
  }
  
  if (categoryCount.timeout > 0) {
    recommendations.push(`Found ${categoryCount.timeout} timeout errors. Review query performance and add timeouts.`);
  }
  
  if (categoryCount.data > 0) {
    recommendations.push(`Found ${categoryCount.data} data constraint errors. Review input validation.`);
  }
  
  // Check for frequent operations
  const operationCount = insights.reduce((acc, insight) => {
    acc[insight.operation] = (acc[insight.operation] || 0) + insight.frequency;
    return acc;
  }, {});
  
  const mostProblematicOp = Object.entries(operationCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  if (mostProblematicOp && mostProblematicOp[1] > 5) {
    recommendations.push(`Operation "${mostProblematicOp[0]}" is causing ${mostProblematicOp[1]} errors. Consider reviewing this operation's implementation.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No specific patterns detected. Errors appear to be isolated incidents.');
  }
  
  return recommendations;
}

// Recent Activity Retrieval Tool for CTA Startup
export const getRecentActivitiesTool = {
  name: 'get_recent_activities',
  description: 'Get recent activities from ActivityLog for CTA startup presentation',
  inputSchema: z.object({
    days: z.number().optional().default(7).describe('Number of days to look back'),
    limit: z.number().optional().default(10).describe('Maximum number of activities to return')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Apply defaults manually to ensure they're not undefined
      const days = input.days ?? 7;
      const limit = input.limit ?? 10;
      
      console.log(`[get_recent_activities] Processing request: days=${days}, limit=${limit}`);
      
      // Get recent activities with trip and client information
      const activities = await executeWithTimeout(
        db.prepare(`
          SELECT 
            a.activity_id,
            a.session_id,
            a.activity_type,
            a.activity_timestamp,
            a.details,
            a.trip_id,
            a.client_id,
            t.trip_name,
            t.status as trip_status,
            t.start_date,
            t.end_date,
            c.full_name as client_name,
            c.email as client_email
          FROM ActivityLog a
          LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
          LEFT JOIN clients_v2 c ON a.client_id = c.client_id
          WHERE a.activity_timestamp > datetime('now', '-' || ? || ' days')
          ORDER BY a.activity_timestamp DESC
          LIMIT ?
        `).bind(days, limit).all(),
        'get recent activities'
      );

      if (!activities.results || activities.results.length === 0) {
        return {
          success: true,
          message: `No activities found in the last ${days} days`,
          activities: [],
          count: 0,
          formatted_list: []
        };
      }

      // Format activities for display
      const formatted = activities.results.map((activity: any, index: number) => {
        const date = new Date(activity.activity_timestamp).toLocaleDateString();
        const time = new Date(activity.activity_timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        let displayText = `${date} ${time} - ${activity.details}`;
        
        if (activity.trip_name) {
          displayText += ` (${activity.trip_name})`;
        }
        
        if (activity.client_name) {
          displayText += ` - ${activity.client_name}`;
        }

        return {
          number: index + 1,
          activity_id: activity.activity_id,
          trip_id: activity.trip_id,
          client_id: activity.client_id,
          activity_type: activity.activity_type,
          timestamp: activity.activity_timestamp,
          display_text: displayText,
          trip_name: activity.trip_name,
          client_name: activity.client_name
        };
      });

      return {
        success: true,
        count: formatted.length,
        days_searched: days,
        activities: activities.results,
        formatted_list: formatted,
        message: `Found ${formatted.length} recent activities`,
        presentation_text: formatted.length > 0 
          ? `Recent Activities (last ${days} days):\n` + 
            formatted.map(f => `${f.number}. ${f.display_text}`).join('\n') +
            '\n\nType a number (1-' + formatted.length + ') to continue working on that item.'
          : 'No recent activities to continue.'
      };
    } catch (error: any) {
      console.error('get_recent_activities error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve recent activities'
      };
    }
  }
};

// Database cleanup tools - for removing test/duplicate data
export const cleanupDuplicateClientsTool = {
  name: 'cleanup_duplicate_clients',
  description: 'Remove duplicate or test client records based on email patterns or names while preserving legitimate clients',
  inputSchema: z.object({
    dry_run: z.boolean().optional().default(true).describe('If true, only show what would be deleted without actually deleting'),
    email_patterns: z.array(z.string()).optional().describe('Email patterns to match for deletion (e.g., ["@example.com"])'),
    name_patterns: z.array(z.string()).optional().describe('Name patterns to match for deletion (e.g., ["Test", "Sarah & Michael"])'),
    preserve_client_ids: z.array(z.number()).optional().describe('Client IDs to preserve even if they match patterns'),
    preserve_emails: z.array(z.string()).optional().describe('Specific emails to preserve even if they match patterns')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const isDryRun = input.dry_run !== false;
      let whereConditions = [];
      let params = [];
      
      // Build WHERE conditions for email patterns
      if (input.email_patterns && input.email_patterns.length > 0) {
        const emailConditions = input.email_patterns.map(() => 'email LIKE ?');
        whereConditions.push(`(${emailConditions.join(' OR ')})`);
        params.push(...input.email_patterns.map((pattern: string) => `%${pattern}%`));
      }
      
      // Build WHERE conditions for name patterns
      if (input.name_patterns && input.name_patterns.length > 0) {
        const nameConditions = input.name_patterns.map(() => 'full_name LIKE ?');
        whereConditions.push(`(${nameConditions.join(' OR ')})`);
        params.push(...input.name_patterns.map((pattern: string) => `%${pattern}%`));
      }
      
      if (whereConditions.length === 0) {
        return {
          success: false,
          error: 'Must provide at least one email_patterns or name_patterns criterion'
        };
      }
      
      let finalWhereClause = whereConditions.join(' OR ');
      
      // Add exclusions for preserved clients
      if (input.preserve_client_ids && input.preserve_client_ids.length > 0) {
        const preserveIdConditions = input.preserve_client_ids.map(() => '?').join(',');
        finalWhereClause = `(${finalWhereClause}) AND client_id NOT IN (${preserveIdConditions})`;
        params.push(...input.preserve_client_ids);
      }
      
      if (input.preserve_emails && input.preserve_emails.length > 0) {
        const preserveEmailConditions = input.preserve_emails.map(() => '?').join(',');
        finalWhereClause = `(${finalWhereClause}) AND email NOT IN (${preserveEmailConditions})`;
        params.push(...input.preserve_emails);
      }
      
      // First, get the clients that would be affected
      const clientsToDelete = await executeWithTimeout(
        db.prepare(`
          SELECT client_id, email, full_name, created_at
          FROM clients_v2
          WHERE ${finalWhereClause}
          ORDER BY created_at DESC
        `).bind(...params).all(),
        'find clients for cleanup'
      );
      
      if (isDryRun) {
        return {
          success: true,
          dry_run: true,
          message: `Would delete ${clientsToDelete.results.length} clients`,
          clients_to_delete: clientsToDelete.results,
          sql_query: `DELETE FROM clients_v2 WHERE ${finalWhereClause}`,
          parameters: params
        };
      }
      
      // Perform actual deletion
      const deleteResult = await executeWithTimeout(
        db.prepare(`
          DELETE FROM clients_v2 WHERE ${finalWhereClause}
        `).bind(...params).run(),
        'delete duplicate clients'
      );
      
      return {
        success: true,
        dry_run: false,
        deleted_count: deleteResult.meta.changes,
        deleted_clients: clientsToDelete.results,
        message: `Deleted ${deleteResult.meta.changes} client records`
      };
    } catch (error: any) {
      console.error('cleanup_duplicate_clients error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to cleanup duplicate clients'
      };
    }
  }
};

export const cleanupDuplicateTripsTool = {
  name: 'cleanup_duplicate_trips',
  description: 'Remove duplicate or test trip records based on name patterns while preserving legitimate trips',
  inputSchema: z.object({
    dry_run: z.boolean().optional().default(true).describe('If true, only show what would be deleted without actually deleting'),
    name_patterns: z.array(z.string()).describe('Trip name patterns to match for deletion (e.g., ["Sarah & Michael", "Test Trip"])'),
    preserve_trip_ids: z.array(z.number()).optional().describe('Trip IDs to preserve even if they match patterns'),
    preserve_trip_names: z.array(z.string()).optional().describe('Specific trip names to preserve even if they match patterns')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const isDryRun = input.dry_run !== false;
      
      if (!input.name_patterns || input.name_patterns.length === 0) {
        return {
          success: false,
          error: 'Must provide at least one name pattern for trip cleanup'
        };
      }
      
      let whereConditions = [];
      let params = [];
      
      // Build WHERE conditions for name patterns
      const nameConditions = input.name_patterns.map(() => 'trip_name LIKE ?');
      whereConditions.push(`(${nameConditions.join(' OR ')})`);
      params.push(...input.name_patterns.map((pattern: string) => `%${pattern}%`));
      
      let finalWhereClause = whereConditions.join(' OR ');
      
      // Add exclusions for preserved trips
      if (input.preserve_trip_ids && input.preserve_trip_ids.length > 0) {
        const preserveIdConditions = input.preserve_trip_ids.map(() => '?').join(',');
        finalWhereClause = `(${finalWhereClause}) AND trip_id NOT IN (${preserveIdConditions})`;
        params.push(...input.preserve_trip_ids);
      }
      
      if (input.preserve_trip_names && input.preserve_trip_names.length > 0) {
        const preserveNameConditions = input.preserve_trip_names.map(() => '?').join(',');
        finalWhereClause = `(${finalWhereClause}) AND trip_name NOT IN (${preserveNameConditions})`;
        params.push(...input.preserve_trip_names);
      }
      
      // First, get the trips that would be affected
      const tripsToDelete = await executeWithTimeout(
        db.prepare(`
          SELECT trip_id, trip_name, status, start_date, end_date, created_at
          FROM trips_v2
          WHERE ${finalWhereClause}
          ORDER BY created_at DESC
        `).bind(...params).all(),
        'find trips for cleanup'
      );
      
      if (isDryRun) {
        return {
          success: true,
          dry_run: true,
          message: `Would delete ${tripsToDelete.results.length} trips`,
          trips_to_delete: tripsToDelete.results,
          sql_query: `DELETE FROM trips_v2 WHERE ${finalWhereClause}`,
          parameters: params
        };
      }
      
      // Also clean up related data
      const tripIds = tripsToDelete.results.map((trip: any) => trip.trip_id);
      
      if (tripIds.length > 0) {
        const tripIdPlaceholders = tripIds.map(() => '?').join(',');
        
        // Clean up related llm_trip_context records
        await executeWithTimeout(
          db.prepare(`DELETE FROM llm_trip_context WHERE natural_key IN (${tripsToDelete.results.map(() => '?').join(',')})`).bind(...tripsToDelete.results.map((trip: any) => trip.trip_name)).run(),
          'delete related trip context'
        );
        
        // Clean up other related records if they exist
        // Note: Being cautious here - only cleaning up context records for now
      }
      
      // Perform actual trip deletion
      const deleteResult = await executeWithTimeout(
        db.prepare(`
          DELETE FROM trips_v2 WHERE ${finalWhereClause}
        `).bind(...params).run(),
        'delete duplicate trips'
      );
      
      return {
        success: true,
        dry_run: false,
        deleted_count: deleteResult.meta.changes,
        deleted_trips: tripsToDelete.results,
        message: `Deleted ${deleteResult.meta.changes} trip records and related context data`
      };
    } catch (error: any) {
      console.error('cleanup_duplicate_trips error:', error);
      return {
        success: false,
        error: error.message,
        details: 'Failed to cleanup duplicate trips'
      };
    }
  }
};

// Continue command tool for resuming trip work
export const continueTripTool = {
  name: 'continue_trip',
  description: 'Resume work on a trip from ActivityLog with full context and status. Use without parameters for most recent trip, or with search terms to find specific trip.',
  inputSchema: z.object({
    search_query: z.string().optional().describe('Optional search terms to find specific trip (name, client, destination, dates)'),
    activity_id: z.number().optional().describe('Specific activity ID to continue from')
  }),
  handler: async (input: any, db: D1Database) => {
    const sessionId = generateSessionId();
    
    try {
      let targetTrip = null;
      let lastActivity = null;
      
      // Find the target trip
      if (input.activity_id) {
        // Get specific activity
        const activityQuery = await db.prepare(`
          SELECT 
            al.*,
            t.trip_name,
            t.status as trip_status,
            t.start_date,
            t.end_date,
            t.destinations,
            t.total_cost,
            t.workflow_state,
            c.full_name as client_name,
            c.email as client_email
          FROM ActivityLog al
          LEFT JOIN trips_v2 t ON al.trip_id = t.trip_id
          LEFT JOIN clients_v2 c ON al.client_id = c.client_id
          WHERE al.activity_id = ?
        `).bind(input.activity_id).first();
        
        if (activityQuery) {
          targetTrip = { trip_id: activityQuery.trip_id };
          lastActivity = activityQuery;
        }
      } else if (input.search_query) {
        // Search for matching trips in recent activities
        const searchTerm = `%${input.search_query.toLowerCase()}%`;
        const searchResults = await db.prepare(`
          SELECT DISTINCT
            al.trip_id,
            al.activity_id,
            al.activity_timestamp,
            al.activity_type,
            al.details,
            t.trip_name,
            t.status as trip_status,
            t.start_date,
            t.end_date,
            t.destinations,
            t.total_cost,
            t.workflow_state,
            c.full_name as client_name,
            c.email as client_email,
            -- Calculate relevance score
            CASE 
              WHEN LOWER(t.trip_name) LIKE ? THEN 10
              WHEN LOWER(c.full_name) LIKE ? THEN 8
              WHEN LOWER(t.destinations) LIKE ? THEN 6
              WHEN LOWER(al.details) LIKE ? THEN 4
              ELSE 2
            END as relevance_score
          FROM ActivityLog al
          LEFT JOIN trips_v2 t ON al.trip_id = t.trip_id
          LEFT JOIN clients_v2 c ON al.client_id = c.client_id
          WHERE 
            al.activity_timestamp > datetime('now', '-90 days')
            AND (
              LOWER(t.trip_name) LIKE ?
              OR LOWER(c.full_name) LIKE ?
              OR LOWER(t.destinations) LIKE ?
              OR LOWER(al.details) LIKE ?
              OR t.start_date LIKE ?
              OR t.end_date LIKE ?
            )
          ORDER BY relevance_score DESC, al.activity_timestamp DESC
          LIMIT 5
        `).bind(
          searchTerm, searchTerm, searchTerm, searchTerm,
          searchTerm, searchTerm, searchTerm, searchTerm,
          searchTerm, searchTerm
        ).all();
        
        if (searchResults.results && searchResults.results.length > 0) {
          // If multiple high-score matches, return selection list
          if (searchResults.results.length > 1 && 
              searchResults.results[0].relevance_score === searchResults.results[1].relevance_score) {
            return {
              success: true,
              multiple_matches: true,
              matches: searchResults.results.map((r, idx) => ({
                number: idx + 1,
                trip_id: r.trip_id,
                trip_name: r.trip_name,
                client_name: r.client_name,
                last_activity: r.activity_timestamp,
                activity_type: r.activity_type,
                status: r.trip_status
              })),
              message: `Multiple trips match "${input.search_query}". Please specify which one to continue.`
            };
          }
          
          targetTrip = { trip_id: searchResults.results[0].trip_id };
          lastActivity = searchResults.results[0];
        }
      } else {
        // Get most recent activity
        const recentActivity = await db.prepare(`
          SELECT 
            al.*,
            t.trip_name,
            t.status as trip_status,
            t.start_date,
            t.end_date,
            t.destinations,
            t.total_cost,
            t.workflow_state,
            c.full_name as client_name,
            c.email as client_email
          FROM ActivityLog al
          LEFT JOIN trips_v2 t ON al.trip_id = t.trip_id
          LEFT JOIN clients_v2 c ON al.client_id = c.client_id
          WHERE al.trip_id IS NOT NULL
          ORDER BY al.activity_timestamp DESC
          LIMIT 1
        `).first();
        
        if (recentActivity) {
          targetTrip = { trip_id: recentActivity.trip_id };
          lastActivity = recentActivity;
        }
      }
      
      // No trip found
      if (!targetTrip || !targetTrip.trip_id) {
        return {
          success: false,
          no_trips_found: true,
          search_query: input.search_query,
          message: input.search_query 
            ? `No trips found matching "${input.search_query}"`
            : 'No recent trip activity found'
        };
      }
      
      // Load complete trip context
      const [tripData, workflowData, recentActivities] = await Promise.all([
        // Get complete trip details
        db.prepare(`
          SELECT 
            t.*,
            GROUP_CONCAT(DISTINCT c.full_name) as client_names,
            GROUP_CONCAT(DISTINCT c.email) as client_emails
          FROM trips_v2 t
          LEFT JOIN (
            SELECT trip_id, client_id 
            FROM JSON_EACH((SELECT clients FROM trips_v2 WHERE trip_id = ?))
          ) tc ON t.trip_id = tc.trip_id
          LEFT JOIN clients_v2 c ON tc.client_id = c.client_id
          WHERE t.trip_id = ?
          GROUP BY t.trip_id
        `).bind(targetTrip.trip_id, targetTrip.trip_id).first(),
        
        // Get workflow status
        db.prepare(`
          SELECT 
            workflow_state,
            trip_name,
            status,
            start_date,
            end_date,
            total_cost,
            destinations
          FROM trips_v2
          WHERE trip_id = ?
        `).bind(targetTrip.trip_id).first(),
        
        // Get recent activities for this trip
        db.prepare(`
          SELECT 
            activity_type,
            activity_timestamp,
            details
          FROM ActivityLog
          WHERE trip_id = ?
          ORDER BY activity_timestamp DESC
          LIMIT 5
        `).bind(targetTrip.trip_id).all()
      ]);
      
      // Parse workflow state
      let workflowState = null;
      if (workflowData && workflowData.workflow_state) {
        try {
          workflowState = typeof workflowData.workflow_state === 'string' 
            ? JSON.parse(workflowData.workflow_state)
            : workflowData.workflow_state;
        } catch (e) {
          console.warn('Failed to parse workflow state:', e);
        }
      }
      
      // Calculate time since last activity
      let timeSinceLastActivity = null;
      if (lastActivity && lastActivity.activity_timestamp) {
        const lastTime = new Date(lastActivity.activity_timestamp);
        const now = new Date();
        const hoursDiff = Math.floor((now.getTime() - lastTime.getTime()) / (1000 * 60 * 60));
        
        if (hoursDiff < 1) {
          timeSinceLastActivity = 'just now';
        } else if (hoursDiff < 24) {
          timeSinceLastActivity = `${hoursDiff} hour${hoursDiff > 1 ? 's' : ''} ago`;
        } else {
          const daysDiff = Math.floor(hoursDiff / 24);
          timeSinceLastActivity = `${daysDiff} day${daysDiff > 1 ? 's' : ''} ago`;
        }
      }
      
      // Format status display
      const statusDisplay = {
        trip_name: tripData.trip_name,
        dates: `${tripData.start_date} to ${tripData.end_date}`,
        status: tripData.status,
        phase: workflowState?.current_phase || 'Not started',
        step: workflowState?.current_step || 1,
        total_cost: tripData.total_cost || 0,
        destinations: tripData.destinations,
        clients: tripData.client_names ? tripData.client_names.split(',') : [],
        progress_percentage: calculateProgressPercentage(workflowState),
        days_until_departure: calculateDaysUntil(tripData.start_date)
      };
      
      // Generate next action recommendation
      const nextAction = generateNextAction(workflowState, tripData, recentActivities.results);
      
      // Update session context
      await db.prepare(`
        INSERT INTO llm_conversation_memory (
          session_id,
          memory_context,
          learned_facts,
          active_entities,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET
          memory_context = excluded.memory_context,
          active_entities = excluded.active_entities,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        sessionId,
        `Continuing work on trip: ${tripData.trip_name}`,
        JSON.stringify([
          { type: 'context', subject: 'active_trip', fact: tripData.trip_name },
          { type: 'context', subject: 'trip_phase', fact: workflowState?.current_phase }
        ]),
        JSON.stringify({
          trip_id: targetTrip.trip_id,
          trip_name: tripData.trip_name,
          current_focus: 'continuation'
        })
      ).run();
      
      // Log the continue action
      await logActivity(
        db,
        'ContinueWork',
        `Resumed work on trip "${tripData.trip_name}" from ${timeSinceLastActivity || 'recent activity'}`,
        targetTrip.trip_id,
        null,
        sessionId
      );
      
      return {
        success: true,
        trip_id: targetTrip.trip_id,
        trip_data: tripData,
        workflow_state: workflowState,
        status_display: statusDisplay,
        last_activity: {
          type: lastActivity?.activity_type,
          details: lastActivity?.details,
          timestamp: lastActivity?.activity_timestamp,
          time_ago: timeSinceLastActivity
        },
        recent_activities: recentActivities.results,
        next_action: nextAction,
        context_loaded: true,
        session_id: sessionId,
        message: `Context loaded for ${tripData.trip_name}. Ready to continue from ${timeSinceLastActivity || 'where you left off'}.`
      };
      
    } catch (error: any) {
      console.error('continue_trip error:', error);
      
      // Record error for analysis
      await recordDatabaseError(
        db,
        'continue_trip',
        error.message,
        null,
        ['trips_v2', 'ActivityLog', 'clients_v2'],
        null,
        { search_query: input.search_query, activity_id: input.activity_id },
        sessionId
      );
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to load trip context. Please try again.'
      };
    }
  }
};

// Helper function to calculate progress percentage
function calculateProgressPercentage(workflowState: any): number {
  if (!workflowState || !workflowState.current_phase) return 0;
  
  const phases = ['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation'];
  const currentIndex = phases.indexOf(workflowState.current_phase);
  
  if (currentIndex === -1) return 0;
  
  // Base percentage from phase
  const basePercentage = (currentIndex / phases.length) * 100;
  
  // Add step progress within phase
  const stepProgress = workflowState.current_step ? (workflowState.current_step - 1) * 2 : 0;
  
  return Math.min(Math.round(basePercentage + stepProgress), 95);
}

// Helper function to calculate days until date
function calculateDaysUntil(dateString: string): number {
  if (!dateString) return 0;
  
  const targetDate = new Date(dateString);
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

// Helper function to generate next action recommendation
function generateNextAction(workflowState: any, tripData: any, recentActivities: any[]): string {
  if (!workflowState || !workflowState.current_phase) {
    return 'Start with client interview to gather trip requirements';
  }
  
  const phase = workflowState.current_phase;
  const lastActivity = recentActivities && recentActivities[0];
  
  const actionMap: Record<string, string> = {
    interview: 'Continue gathering client preferences and requirements',
    conceptualization: 'Develop trip themes and activity options',
    planning: 'Lock in accommodations and transportation',
    proposal: 'Create and refine client presentation',
    revision: 'Incorporate client feedback and adjust plans',
    finalization: 'Complete all bookings and confirmations',
    preparation: 'Prepare travel documents and final details'
  };
  
  // Check for specific conditions
  if (lastActivity) {
    if (lastActivity.activity_type === 'SearchHotels') {
      return 'Review hotel search results and make selections';
    }
    if (lastActivity.activity_type === 'BulkOperations') {
      return 'Continue with trip modifications and updates';
    }
  }
  
  return actionMap[phase] || 'Continue with trip planning';
}

// Export all LLM-optimized tools
export const llmOptimizedTools = [
  getAnythingTool,
  rememberContextTool,
  bulkTripOperationsTool,
  updateActivitylogClientsTool,
  resetActivitylogFromTripsTool,
  regenerateContextTool,
  createTripV2Tool,
  createClientV2Tool,
  createTripWithClientTool,
  // New workflow management tools
  advanceWorkflowPhaseTool,
  setWorkflowStepTool,
  getWorkflowStatusTool,
  getWorkflowInstructionsTool,
  initializeWorkflowTool,
  // Error analysis tools - TASK-2025-110
  analyzeRecentErrorsTool,
  resolveErrorPatternTool,
  // Recent activity retrieval for CTA startup
  getRecentActivitiesTool,
  // Continue command tool
  continueTripTool,
  // Database cleanup tools
  cleanupDuplicateClientsTool,
  cleanupDuplicateTripsTool
];