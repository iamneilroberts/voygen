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
import {
  SearchResponse,
  QueryPerformanceMetrics,
  DEFAULT_COMPLEXITY_LIMITS,
  TripSuggestion,
  TripSelection
} from '../types/search-types';
import { recordDatabaseError, createErrorResponse, analyzeErrorPattern, shouldBypassForComplexity, extractOperationContext } from '../utils/error-recording';
import { generateSessionId, extractTableNames, sanitizeQueryForLogging } from '../utils/session-management';
import { extractTripStatus, formatStatusDashboard } from '../utils/status-formatter';
import { searchTripSurface, TripSurfaceMatch } from '../utils/trip-surface-search';

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

interface TravelerInfo {
  name: string;
  email?: string | null;
}

interface TripContextData {
  trip: any;
  facts: any | null;
  travelers: TravelerInfo[];
  traveler_names: string[];
  traveler_emails: string[];
  workflow_phase: string | null;
  workflow_step: number | null;
  progress_percentage: number;
  days_until_departure: number | null;
  workflow_state: any;
}

function fallbackNameFromEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }
  const local = email.split('@')[0] || '';
  if (!local) {
    return null;
  }
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mergeTravelerDetails(names: string[], emails: string[]): TravelerInfo[] {
  const maxLength = Math.max(names.length, emails.length);
  const seenKeys = new Set<string>();
  const travelers: TravelerInfo[] = [];

  for (let i = 0; i < maxLength; i += 1) {
    const nameCandidate = names[i]?.trim();
    const emailCandidate = emails[i] || null;
    const resolvedName = nameCandidate || fallbackNameFromEmail(emailCandidate) || `Traveler ${travelers.length + 1}`;
    const key = emailCandidate ? emailCandidate.toLowerCase() : `${resolvedName.toLowerCase()}#${i}`;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    travelers.push({ name: resolvedName, email: emailCandidate });
  }

  for (let i = maxLength; i < names.length; i += 1) {
    const name = names[i]?.trim();
    if (!name) {
      continue;
    }
    const key = `${name.toLowerCase()}#extra`;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    travelers.push({ name });
  }

  for (let i = maxLength; i < emails.length; i += 1) {
    const email = emails[i];
    if (!email) {
      continue;
    }
    const key = email.toLowerCase();
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    travelers.push({ name: fallbackNameFromEmail(email) || `Traveler ${travelers.length + 1}`, email });
  }

  return travelers;
}

async function fetchTripContext(
  db: D1Database,
  tripId: number,
  match?: TripSurfaceMatch
): Promise<TripContextData | null> {
  const trip = await db
    .prepare(`
      SELECT
        t.trip_id,
        t.trip_name,
        t.trip_slug,
        t.status,
        t.start_date,
        t.end_date,
        t.destinations,
        t.primary_client_email,
        cv.full_name AS primary_client_name,
        t.workflow_state,
        t.total_cost,
        t.clients
      FROM trips_v2 t
      LEFT JOIN clients_v2 cv ON cv.email = t.primary_client_email
      WHERE t.trip_id = ?
    `)
    .bind(tripId)
    .first();

  if (!trip) {
    return null;
  }

  const facts = await db
    .prepare(`
      SELECT traveler_count, traveler_names, traveler_emails, total_nights, total_hotels, total_activities, total_cost, transit_minutes
      FROM trip_facts
      WHERE trip_id = ?
    `)
    .bind(tripId)
    .first();

  let travelerNames: string[] = match?.traveler_names ?? [];
  let travelerEmails: string[] = match?.traveler_emails ?? [];

  if (facts) {
    const factNames = parseJsonArray(facts.traveler_names);
    const factEmails = parseJsonArray(facts.traveler_emails);
    if (factNames.length) {
      travelerNames = factNames;
    }
    if (factEmails.length) {
      travelerEmails = factEmails;
    }
  }

  if (travelerNames.length === 0 && travelerEmails.length === 0) {
    const assignments = await db
      .prepare(`
        SELECT a.client_email AS email, coalesce(cv.full_name, '') AS full_name
        FROM trip_client_assignments a
        LEFT JOIN clients_v2 cv ON cv.email = a.client_email
        WHERE a.trip_id = ?
      `)
      .bind(tripId)
      .all();

    const assignmentRows = (assignments as any).results || [];
    travelerNames = assignmentRows
      .map((row: any) => (row.full_name || '').trim())
      .filter(Boolean);
    travelerEmails = assignmentRows
      .map((row: any) => row.email)
      .filter(Boolean);
  }

  const travelers = mergeTravelerDetails(travelerNames, travelerEmails);

  let workflowPhase: string | null = null;
  let workflowStep: number | null = null;
  let workflowState: any = null;

  if (trip.workflow_state) {
    try {
      workflowState = JSON.parse(trip.workflow_state);
      workflowPhase = workflowState?.current_phase ?? null;
      workflowStep = workflowState?.current_step ?? null;
    } catch {
      workflowState = null;
    }
  }

  const progressPercentage = calculateProgressPercentage(workflowState);
  const daysUntilDeparture = trip.start_date ? calculateDaysUntil(trip.start_date) : null;

  return {
    trip,
    facts: facts || null,
    travelers,
    traveler_names: travelerNames,
    traveler_emails: travelerEmails,
    workflow_phase: workflowPhase,
    workflow_step: workflowStep,
    progress_percentage: progressPercentage,
    days_until_departure: daysUntilDeparture,
    workflow_state: workflowState
  };
}

function formatTravelerLines(travelers: TravelerInfo[]): string {
  if (!travelers.length) {
    return '_No traveler details stored yet_';
  }
  return travelers
    .map((traveler) => `• ${traveler.name}${traveler.email ? ` (${traveler.email})` : ''}`)
    .join('\n');
}

function buildTripSuggestionFromMatch(match: TripSurfaceMatch): TripSuggestion {
  return {
    trip_id: match.trip_id,
    trip_name: match.trip_name,
    trip_slug: match.trip_slug,
    status: match.status,
    destinations: match.destinations,
    start_date: match.start_date,
    end_date: match.end_date,
    primary_client_name: match.primary_client_name,
    primary_client_email: match.primary_client_email,
    traveler_preview: match.traveler_names.slice(0, 3),
    score: match.score
  };
}

function toSelectedTrip(match: TripSurfaceMatch): TripSelection {
  return {
    ...buildTripSuggestionFromMatch(match),
    traveler_emails: match.traveler_emails,
    traveler_count: match.traveler_count,
    matched_tokens: match.matched_tokens,
    match_reasons: match.match_reasons
  };
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
      
      // PHASE 2B: Unified trip search surface fuzzy matching
      try {
        const surfaceMatches = await searchTripSurface(db, input.query, { limit: 5 });
        if (surfaceMatches.length) {
          const bestMatch = surfaceMatches[0];
          const tripContext = await fetchTripContext(db, bestMatch.trip_id, bestMatch);

          if (tripContext) {
            const facts = tripContext.facts || {};
            const metrics: string[] = [];
            if (typeof facts.total_nights === 'number') {
              metrics.push(`Total Nights: ${facts.total_nights}`);
            }
            if (typeof facts.total_hotels === 'number') {
              metrics.push(`Hotels Booked: ${facts.total_hotels}`);
            }
            if (typeof facts.total_activities === 'number' && facts.total_activities > 0) {
              metrics.push(`Total Activities: ${facts.total_activities}`);
            }
            if (typeof facts.total_cost === 'number' && facts.total_cost > 0) {
              metrics.push(`Estimated Cost: $${Number(facts.total_cost).toLocaleString()}`);
            }
            if (typeof facts.transit_minutes === 'number' && facts.transit_minutes > 0) {
              const hours = Math.round((facts.transit_minutes / 60) * 10) / 10;
              metrics.push(`Transit Time: ${hours} hrs`);
            }

            const travelerBlock = formatTravelerLines(tripContext.travelers);
            const metricsBlock = metrics.length ? `\n**Key Metrics**\n${metrics.map((item) => `• ${item}`).join('\n')}` : '';
            const matchedTokens = bestMatch.matched_tokens.length
              ? `\n**Matched Tokens:** ${bestMatch.matched_tokens.join(', ')}`
              : '';

            const response = `**Trip Match:** ${tripContext.trip.trip_name} (ID ${tripContext.trip.trip_id})\n` +
              `• **Status:** ${tripContext.trip.status || 'unknown'}\n` +
              `• **Dates:** ${tripContext.trip.start_date || 'TBD'} → ${tripContext.trip.end_date || 'TBD'}\n` +
              `• **Destinations:** ${tripContext.trip.destinations || 'Not specified'}\n` +
              `• **Primary Client:** ${tripContext.trip.primary_client_name || 'Unknown'}${tripContext.trip.primary_client_email ? ` (${tripContext.trip.primary_client_email})` : ''}\n` +
              `• **Workflow Phase:** ${tripContext.workflow_phase || 'Not set'} (step ${tripContext.workflow_step ?? 1})\n` +
              `• **Progress:** ${tripContext.progress_percentage}%\n` +
              (tripContext.days_until_departure != null ? `• **Days Until Departure:** ${tripContext.days_until_departure}\n` : '') +
              `\n**Travelers**\n${travelerBlock}${metricsBlock}${matchedTokens}\n\n_Score: ${bestMatch.score.toFixed(1)} via trip search surface_`;

            const selectedTrip = toSelectedTrip(bestMatch);
            selectedTrip.traveler_emails = tripContext.travelers
              .map((trav) => trav.email)
              .filter((email): email is string => Boolean(email));
            selectedTrip.traveler_count = tripContext.travelers.length;

            const suggestionPayload = surfaceMatches
              .slice(1)
              .map((match) => buildTripSuggestionFromMatch(match));

            return {
              response,
              context_type: 'trip_search_surface_match',
              natural_key: tripContext.trip.trip_name,
              source: 'trip_search_surface',
              trip_id: tripContext.trip.trip_id,
              search_terms: optimizedTerms,
              selected_trip: selectedTrip,
              trip_suggestions: suggestionPayload
            } as SearchResponse;
          }
        }
      } catch (surfaceError) {
        console.warn('Trip search surface lookup failed', surfaceError);
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
      let fuzzyMatches: TripSurfaceMatch[] = [];
      let selectedMatch: TripSurfaceMatch | null = null;
      
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
        // Normalize search input
        const normalizedQuery = input.search_query.trim().toLowerCase();
        const likeTerm = `%${normalizedQuery}%`;

        // Primary search (single LIKE)
        let searchResults: any = await db.prepare(`
          SELECT a.*, t.trip_name, t.status as trip_status,
                 ROW_NUMBER() OVER (PARTITION BY a.trip_id ORDER BY a.created_at DESC) as rn
          FROM ActivityLog a
          LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
          WHERE (
            LOWER(t.trip_name) LIKE ? OR 
            LOWER(t.destinations) LIKE ? OR 
            LOWER(a.activity_details) LIKE ?
          )
            AND a.trip_id IS NOT NULL
          ORDER BY a.created_at DESC
        `).bind(likeTerm, likeTerm, likeTerm).all();

        // Fallback: require all distinctive terms to appear somewhere
        if (!searchResults.results || searchResults.results.length === 0) {
          const distinctiveTerms = normalizedQuery
            .split(/[^a-z0-9]+/i)
            .map((term: string) => term.trim())
            .filter((term: string) => term.length >= 3)
            .slice(0, 3);

          if (distinctiveTerms.length > 0) {
            const clauses = distinctiveTerms
              .map(
                () =>
                  `(
                    LOWER(t.trip_name) LIKE ? OR 
                    LOWER(t.destinations) LIKE ? OR 
                    LOWER(a.activity_details) LIKE ?
                  )`,
              )
              .join(' AND ');

            const fallbackParams: string[] = [];
            distinctiveTerms.forEach((term: string) => {
              const pattern = `%${term}%`;
              fallbackParams.push(pattern, pattern, pattern);
            });

            searchResults = await db.prepare(`
              SELECT a.*, t.trip_name, t.status as trip_status,
                     ROW_NUMBER() OVER (PARTITION BY a.trip_id ORDER BY a.created_at DESC) as rn
              FROM ActivityLog a
              LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
              WHERE ${clauses}
                AND a.trip_id IS NOT NULL
              ORDER BY a.created_at DESC
            `).bind(...fallbackParams).all();
          }
        }

        if (searchResults.results && searchResults.results.length > 0) {
          targetTrip = searchResults.results[0];
          fuzzyMatches = await searchTripSurface(db, input.search_query, { limit: 5 });
          selectedMatch = fuzzyMatches.find((match) => match.trip_id === targetTrip.trip_id) || null;
        } else {
          fuzzyMatches = await searchTripSurface(db, input.search_query, { limit: 5 });
          if (!fuzzyMatches.length) {
            return {
              success: false,
              error: 'No matching trips found',
              message: `No trips found matching "${input.search_query}"`,
              suggestions: []
            };
          }

          selectedMatch = fuzzyMatches[0];
          const latestActivity = await db.prepare(`
            SELECT a.*, t.trip_name, t.status as trip_status
            FROM ActivityLog a
            LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
            WHERE a.trip_id = ?
            ORDER BY a.created_at DESC
            LIMIT 1
          `)
            .bind(selectedMatch.trip_id)
            .first();

          if (latestActivity) {
            targetTrip = latestActivity;
          } else {
            targetTrip = {
              trip_id: selectedMatch.trip_id,
              trip_name: selectedMatch.trip_name,
              trip_status: selectedMatch.status,
              activity_type: 'TripMatch',
              activity_details: 'Matched via trip search surface',
              created_at: new Date().toISOString()
            };
          }
        }
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
      
      if (!targetTrip) {
        return {
          success: false,
          error: 'trip_not_found',
          message: 'Unable to determine which trip to continue. Provide a more specific search query.'
        };
      }

      const tripContext = await fetchTripContext(
        db,
        targetTrip.trip_id,
        selectedMatch || (fuzzyMatches.length ? fuzzyMatches[0] : undefined)
      );

      if (!tripContext) {
        return {
          success: false,
          error: 'Trip data not found',
          message: `Trip data not found for ID ${targetTrip.trip_id}`
        };
      }

      const tripData = tripContext.trip;
      const workflowState = tripContext.workflow_state ?? null;
      
      // Get recent activities for this trip
      const recentActivitiesResult = await db.prepare(`
        SELECT *
        FROM ActivityLog
        WHERE trip_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(targetTrip.trip_id).all();
      const recentActivities = (recentActivitiesResult as any).results || [];
      
      // Calculate time since last activity
      const lastActivityDate = new Date(targetTrip.created_at);
      const now = new Date();
      const timeDiff = now.getTime() - lastActivityDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const timeSinceLastActivity = daysDiff > 0 ? `${daysDiff} days ago` : 'today';
      
      // Create comprehensive context
  let clientNames: string[] = [];
  if (tripData.clients) {
    try {
      const parsedClients = Array.isArray(tripData.clients)
        ? tripData.clients
        : JSON.parse(tripData.clients);
      if (Array.isArray(parsedClients)) {
        clientNames = parsedClients
          .map((client: any) => (typeof client?.full_name === 'string' ? client.full_name.trim() : ''))
          .filter(Boolean);
      }
    } catch {
      clientNames = [];
    }
  }

      const facts = tripContext.facts || {};
      const metrics: string[] = [];
      if (typeof facts.total_nights === 'number') {
        metrics.push(`Total Nights: ${facts.total_nights}`);
      }
      if (typeof facts.total_hotels === 'number') {
        metrics.push(`Hotels Booked: ${facts.total_hotels}`);
      }
      if (typeof facts.total_activities === 'number' && facts.total_activities > 0) {
        metrics.push(`Total Activities: ${facts.total_activities}`);
      }
      if (typeof facts.total_cost === 'number' && facts.total_cost > 0) {
        metrics.push(`Estimated Cost: $${Number(facts.total_cost).toLocaleString()}`);
      }
      if (typeof facts.transit_minutes === 'number' && facts.transit_minutes > 0) {
        const hours = Math.round((facts.transit_minutes / 60) * 10) / 10;
        metrics.push(`Transit Time: ${hours} hrs`);
      }

      const suggestionPayload = fuzzyMatches
        .filter((match) => match.trip_id !== tripData.trip_id)
        .slice(0, 4)
        .map((match) => buildTripSuggestionFromMatch(match));

      const selectedTripPayload = selectedMatch ? toSelectedTrip(selectedMatch) : undefined;
      if (selectedTripPayload) {
        selectedTripPayload.traveler_emails = tripContext.travelers
          .map((traveler) => traveler.email)
          .filter((email): email is string => Boolean(email));
        selectedTripPayload.traveler_count = tripContext.travelers.length;
      }

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
        workflow_phase: tripContext.workflow_phase || 'Not set',
        step: tripContext.workflow_step || 1,
        total_cost: tripData.total_cost ?? facts.total_cost ?? 0,
        clients: clientNames,
        progress_percentage: tripContext.progress_percentage,
        days_until_departure: tripContext.days_until_departure,
        travelers: tripContext.travelers,
        traveler_count: tripContext.travelers.length
      };
      
      // Generate next action recommendation
      const nextAction = generateNextAction(workflowState, tripData, recentActivities);
      
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
      
      const travelerBlock = formatTravelerLines(tripContext.travelers);
      const metricsBlock = metrics.length ? `\n**Key Metrics**\n${metrics.map((item) => `• ${item}`).join('\n')}` : '';
      const matchBlock = selectedMatch
        ? `\n_Source: trip search surface score ${selectedMatch.score.toFixed(1)}_`
        : '';

      return {
        success: true,
        message: `✅ **CONTINUING WORK ON**: ${tripData.trip_name}

**📋 TRIP SUMMARY:**
• **Client**: ${contextSummary.client} (${contextSummary.client_email})
• **Destinations**: ${contextSummary.destinations}
• **Travel Dates**: ${contextSummary.dates}
• **Status**: ${contextSummary.status}
• **Total Cost**: $${contextSummary.total_cost.toLocaleString()}

**👥 TRAVELERS:**
${travelerBlock}

**🔄 WORKFLOW STATUS:**
• **Current Phase**: ${contextSummary.workflow_phase}
• **Step**: ${contextSummary.step}
• **Progress**: ${contextSummary.progress_percentage}%
• **Days Until Departure**: ${contextSummary.days_until_departure}

${metricsBlock}

**📅 RECENT ACTIVITY:**
• **Last Action**: ${targetTrip.activity_type} (${timeSinceLastActivity})
• **Details**: ${targetTrip.activity_details}

**🎯 RECOMMENDED NEXT ACTION:**
${nextAction}

**🔗 Context loaded for session**: ${sessionId}${matchBlock}`,
        context: contextSummary,
        session_id: sessionId,
        next_action: nextAction,
        recent_activities: recentActivities.results?.slice(0, 5) || [],
        travelers: tripContext.travelers,
        suggestions: suggestionPayload,
        selected_match: selectedTripPayload
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
