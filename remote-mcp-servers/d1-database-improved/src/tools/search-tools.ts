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

// Helper function to execute queries with timeout
async function executeWithTimeout<T>(query: Promise<T>, operation: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout: ${operation}`)), QUERY_TIMEOUT_MS);
  });
  
  return Promise.race([query, timeoutPromise]);
}

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
          activity_type, 
          activity_details, 
          trip_id, 
          client_id, 
          session_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      await stmt.bind(
        activityType,
        details,
        safeTripId,
        safeClientId,
        finalSessionId
      ).run();
      
      console.log(`[logActivity] Successfully logged activity: ${activityType}`);
    } catch (insertError: any) {
      console.error(`[logActivity] Insert failed:`, insertError);
      console.error(`[logActivity] Values were: ${activityType}, tripId: ${safeTripId}, clientId: ${safeClientId}`);
      throw insertError;
    }
    
  } catch (error: any) {
    console.error(`[logActivity] Failed to log activity:`, error);
    // Don't throw - logging failures shouldn't break main functionality
  }
}

/**
 * Main search tool - handles all search operations with advanced fallback strategies
 */
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
      
      // OPTIMIZATION: Assess query complexity to choose best strategy
      const complexity = assessQueryComplexity(input.query);
      
      // PHASE 1: Direct LLM context by exact natural_key match
      try {
        const directCtx = await executeWithTimeout(
          db.prepare(`
            SELECT natural_key, formatted_response, context_type
            FROM llm_trip_context
            WHERE LOWER(natural_key) = LOWER(?)
            LIMIT 1
          `).bind(input.query).first(),
          'llm_context_direct_match'
        );
        if (directCtx) {
          return {
            response: directCtx.formatted_response,
            context_type: 'llm_context',
            natural_key: directCtx.natural_key,
            source: 'context_direct'
          } as SearchResponse;
        }
      } catch (e) {
        console.warn('PHASE 1: Direct context lookup failed', e);
      }
      
      // PHASE 2: SLUG DETECTION - Check for slug-like patterns first
      const slugPattern = /^[a-z0-9]+-[a-z0-9]+-[0-9]{4}$|^[a-z0-9-]+-[a-z0-9-]+-[0-9]{4}$/i;
      if (slugPattern.test(searchTerm.replace(/\s/g, '-'))) {
        const cleanSlug = searchTerm.replace(/\s/g, '-').toLowerCase();
        console.log(`PHASE 2: Slug query detected: "${input.query}" -> slug: ${cleanSlug}`);
        
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
          return {
            response: `Found trip by slug: ${slugResult.trip_name}`,
            context_type: 'trip_slug_match',
            trip_id: slugResult.trip_id,
            source: 'slug_detection'
          } as SearchResponse;
        }
      }
      
      // Continue with progressive fallback search
      const fallbackResult = await executeWithProgressiveFallback(
        db, 
        input.query, 
        optimizedTerms,
        strategy
      );
      
      if (fallbackResult && !fallbackResult.error) {
        return fallbackResult;
      }
      
      // Final fallback: semantic search if available
      try {
        const semanticResults = await performSemanticSearch(db, input.query, 5);
        
        if (semanticResults.length > 0) {
          const bestResult = semanticResults[0];
          const formattedResponse = `**SEMANTIC SEARCH RESULT**: ${bestResult.trip_name}

**Trip Details:**
- **Match Score**: ${(bestResult.semantic_score * 100).toFixed(1)}%
- **Components Matched**: ${bestResult.matched_components.map(c => `${c.component_type}:${c.component_value}`).join(', ')}
- **Trip Slug**: ${bestResult.trip_slug || 'Not available'}

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
      }

      // No results found
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

/**
 * Continue work on a trip tool
 */
export const continueTripTool = {
  name: 'continue_trip',
  description: 'Resume work on a trip from ActivityLog with full context and status. Use without parameters for most recent trip, or with search terms to find specific trip.',
  inputSchema: z.object({
    search_query: z.string().optional().describe('Optional search terms to find specific trip (name, client, destination, dates)'),
    activity_id: z.number().optional().describe('Specific activity ID to continue from')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const sessionId = generateSessionId();
      let targetTrip: any;
      
      // Find the target trip
      if (input.activity_id) {
        // Continue from specific activity
        const activity = await db.prepare(`
          SELECT a.*, t.trip_name, t.status as trip_status
          FROM ActivityLog a
          LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
          WHERE a.activity_id = ?
        `).bind(input.activity_id).first();
        
        if (!activity) {
          return {
            success: false,
            error: 'Activity not found',
            message: `No activity found with ID ${input.activity_id}`
          };
        }
        
        targetTrip = activity;
      } else if (input.search_query) {
        // Search for specific trip
        const searchResults = await db.prepare(`
          SELECT a.*, t.trip_name, t.status as trip_status,
                 ROW_NUMBER() OVER (PARTITION BY a.trip_id ORDER BY a.created_at DESC) as rn
          FROM ActivityLog a
          LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
          WHERE (t.trip_name LIKE ? OR t.destinations LIKE ? OR a.activity_details LIKE ?)
            AND a.trip_id IS NOT NULL
          ORDER BY a.created_at DESC
        `).bind(`%${input.search_query}%`, `%${input.search_query}%`, `%${input.search_query}%`).all();
        
        if (!searchResults.results || searchResults.results.length === 0) {
          return {
            success: false,
            error: 'No matching trips found',
            message: `No trips found matching "${input.search_query}"`
          };
        }
        
        targetTrip = searchResults.results[0];
      } else {
        // Get most recent trip
        const recentActivity = await db.prepare(`
          SELECT a.*, t.trip_name, t.status as trip_status
          FROM ActivityLog a
          LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
          WHERE a.trip_id IS NOT NULL
          ORDER BY a.created_at DESC
          LIMIT 1
        `).first();
        
        if (!recentActivity) {
          return {
            success: false,
            error: 'No recent trips found',
            message: 'No recent trip activities found to continue'
          };
        }
        
        targetTrip = recentActivity;
      }
      
      // Get comprehensive trip data
      const tripData = await db.prepare(`
        SELECT 
          t.*,
          c.full_name as primary_client_name,
          c.email as primary_client_email,
          c.phone as primary_client_phone
        FROM trips_v2 t
        LEFT JOIN clients_v2 c ON c.email = t.primary_client_email
        WHERE t.trip_id = ?
      `).bind(targetTrip.trip_id).first();
      
      if (!tripData) {
        return {
          success: false,
          error: 'Trip data not found',
          message: `Trip data not found for ID ${targetTrip.trip_id}`
        };
      }
      
      // Get workflow state
      const workflowState = tripData.workflow_state ? JSON.parse(tripData.workflow_state) : null;
      
      // Get recent activities for this trip
      const recentActivities = await db.prepare(`
        SELECT *
        FROM ActivityLog
        WHERE trip_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(targetTrip.trip_id).all();
      
      // Calculate time since last activity
      const lastActivityDate = new Date(targetTrip.created_at);
      const now = new Date();
      const timeDiff = now.getTime() - lastActivityDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const timeSinceLastActivity = daysDiff > 0 ? `${daysDiff} days ago` : 'today';
      
      // Create comprehensive context
      const contextSummary = {
        trip_name: tripData.trip_name,
        trip_id: tripData.trip_id,
        status: tripData.status,
        client: tripData.primary_client_name || 'Unknown',
        client_email: tripData.primary_client_email,
        destinations: tripData.destinations,
        dates: `${tripData.start_date} to ${tripData.end_date}`,
        last_activity: targetTrip.activity_type,
        last_activity_date: timeSinceLastActivity,
        workflow_phase: workflowState?.current_phase || 'Not set',
        step: workflowState?.current_step || 1,
        total_cost: tripData.total_cost || 0,
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
        message: `✅ **CONTINUING WORK ON**: ${tripData.trip_name}

**📋 TRIP SUMMARY:**
• **Client**: ${contextSummary.client} (${contextSummary.client_email})
• **Destinations**: ${contextSummary.destinations}
• **Travel Dates**: ${contextSummary.dates}
• **Status**: ${contextSummary.status}
• **Total Cost**: $${contextSummary.total_cost.toLocaleString()}

**🔄 WORKFLOW STATUS:**
• **Current Phase**: ${contextSummary.workflow_phase}
• **Step**: ${contextSummary.step}
• **Progress**: ${contextSummary.progress_percentage}%
• **Days Until Departure**: ${contextSummary.days_until_departure}

**📅 RECENT ACTIVITY:**
• **Last Action**: ${targetTrip.activity_type} (${timeSinceLastActivity})
• **Details**: ${targetTrip.activity_details}

**🎯 RECOMMENDED NEXT ACTION:**
${nextAction}

**🔗 Context loaded for session**: ${sessionId}`,
        context: contextSummary,
        session_id: sessionId,
        next_action: nextAction,
        recent_activities: recentActivities.results?.slice(0, 5) || []
      };
      
    } catch (error: any) {
      console.error('continue_trip error:', error);
      
      // Record the error
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'continue_trip',
        error_message: error.message,
        table_names: 'ActivityLog,trips_v2,clients_v2',
        context: extractOperationContext('continue_trip', input)
      });
      
      // Log error activity
      await logActivity(
        db,
        'ContinueWorkError',
        `Failed to continue trip work: ${error.message}`,
        null,
        null,
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
  
  const actionMap: { [key: string]: string } = {
    interview: 'Conduct detailed client interview to understand preferences and requirements',
    conceptualization: 'Develop initial trip concepts and themes based on client preferences',
    planning: 'Create detailed itinerary with accommodations, activities, and logistics',
    proposal: 'Generate and review travel proposal document',
    revision: 'Address client feedback and refine proposal',
    finalization: 'Confirm bookings and finalize all arrangements',
    preparation: 'Prepare client for departure with final documents and information'
  };
  
  return actionMap[phase] || 'Continue with trip planning';
}
