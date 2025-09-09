/**
 * PHASE 3: Semantic Search Engine
 * Component-based semantic indexing with natural language query processing
 */

import { D1Database } from '@cloudflare/workers-types';

/**
 * Component types for semantic indexing
 */
export type ComponentType = 'client' | 'destination' | 'date' | 'activity' | 'cost' | 'descriptor' | 'status';

/**
 * Semantic component structure
 */
export interface SemanticComponent {
  component_id?: number;
  trip_id: number;
  component_type: ComponentType;
  component_value: string;
  search_weight: number;
  synonyms?: string[];
  metadata?: Record<string, any>;
}

/**
 * Search result with semantic scoring
 */
export interface SemanticSearchResult {
  trip_id: number;
  trip_name: string;
  trip_slug?: string;
  semantic_score: number;
  matched_components: SemanticComponent[];
  search_method: string;
}

/**
 * PHASE 3: Extract semantic components from trip data
 */
export function extractSemanticComponents(trip: any): SemanticComponent[] {
  const components: SemanticComponent[] = [];

  // Extract client components from primary email and names
  if (trip.primary_client_email) {
    const emailPrefix = trip.primary_client_email.split('@')[0];
    components.push({
      trip_id: trip.trip_id,
      component_type: 'client',
      component_value: emailPrefix,
      search_weight: 2.0, // High weight for client names
      synonyms: [trip.primary_client_email],
      metadata: { source: 'primary_client_email' }
    });
  }

  // Extract client names from trip_name (assuming format like "Sara & Darren's Trip")
  if (trip.trip_name) {
    const nameMatches = trip.trip_name.match(/([A-Z][a-z]+)\s*(?:and|&)\s*([A-Z][a-z]+)/);
    if (nameMatches) {
      components.push({
        trip_id: trip.trip_id,
        component_type: 'client',
        component_value: nameMatches[1].toLowerCase(),
        search_weight: 2.0,
        synonyms: [nameMatches[1]],
        metadata: { source: 'trip_name_extraction' }
      });
      
      components.push({
        trip_id: trip.trip_id,
        component_type: 'client',
        component_value: nameMatches[2].toLowerCase(),
        search_weight: 2.0,
        synonyms: [nameMatches[2]],
        metadata: { source: 'trip_name_extraction' }
      });
    }
  }

  // Extract destination components
  if (trip.destinations) {
    const destinations = trip.destinations.split(/[,;]/).map((d: string) => d.trim());
    destinations.forEach((dest: string) => {
      if (dest) {
        components.push({
          trip_id: trip.trip_id,
          component_type: 'destination',
          component_value: dest.toLowerCase(),
          search_weight: 1.5, // 1.5x weight for destinations
          synonyms: getDestinationSynonyms(dest),
          metadata: { source: 'destinations_field' }
        });
      }
    });
  }

  // Extract date components
  if (trip.start_date) {
    const year = trip.start_date.substring(0, 4);
    const month = trip.start_date.substring(5, 7);
    
    components.push({
      trip_id: trip.trip_id,
      component_type: 'date',
      component_value: year,
      search_weight: 1.3,
      synonyms: [trip.start_date],
      metadata: { source: 'start_date', type: 'year' }
    });

    // Add month name
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthName = monthNames[parseInt(month) - 1];
    if (monthName) {
      components.push({
        trip_id: trip.trip_id,
        component_type: 'date',
        component_value: monthName,
        search_weight: 1.2,
        synonyms: [month, `${year}-${month}`],
        metadata: { source: 'start_date', type: 'month' }
      });
    }
  }

  // Extract cost components
  if (trip.total_cost && trip.total_cost > 0) {
    const costRange = getCostRange(trip.total_cost);
    components.push({
      trip_id: trip.trip_id,
      component_type: 'cost',
      component_value: costRange,
      search_weight: 1.1,
      synonyms: [trip.total_cost.toString(), `$${trip.total_cost}`],
      metadata: { source: 'total_cost', exact_cost: trip.total_cost }
    });
  }

  // Extract status component
  if (trip.status) {
    components.push({
      trip_id: trip.trip_id,
      component_type: 'status',
      component_value: trip.status.toLowerCase(),
      search_weight: 1.2,
      synonyms: getStatusSynonyms(trip.status),
      metadata: { source: 'status_field' }
    });
  }

  // Extract descriptive components from trip name and notes
  if (trip.trip_name) {
    const descriptors = extractDescriptors(trip.trip_name);
    descriptors.forEach(desc => {
      components.push({
        trip_id: trip.trip_id,
        component_type: 'descriptor',
        component_value: desc.toLowerCase(),
        search_weight: 1.3,
        synonyms: getDescriptorSynonyms(desc),
        metadata: { source: 'trip_name' }
      });
    });
  }

  if (trip.notes) {
    const descriptors = extractDescriptors(trip.notes);
    descriptors.forEach(desc => {
      components.push({
        trip_id: trip.trip_id,
        component_type: 'descriptor',
        component_value: desc.toLowerCase(),
        search_weight: 1.1,
        synonyms: getDescriptorSynonyms(desc),
        metadata: { source: 'notes' }
      });
    });
  }

  return components;
}

/**
 * Get destination synonyms
 */
function getDestinationSynonyms(destination: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'hawaii': ['hawaiian islands', 'aloha state', 'pacific islands'],
    'mediterranean': ['med sea', 'mediterranean sea', 'med cruise'],
    'caribbean': ['carribean', 'west indies', 'caribbean islands'],
    'europe': ['european', 'eu', 'old continent'],
    'paris': ['city of light', 'france capital'],
    'london': ['uk capital', 'england capital', 'britain'],
    'rome': ['eternal city', 'italy capital', 'roman'],
    'greece': ['greek islands', 'hellenic', 'greek'],
    'italy': ['italian', 'italia'],
    'spain': ['spanish', 'espana'],
    'iceland': ['icelandic', 'reykjavik'],
    'norway': ['norwegian', 'norge', 'scandinavia'],
    'thailand': ['thai', 'siam', 'bangkok'],
    'japan': ['japanese', 'nippon', 'tokyo']
  };

  const dest = destination.toLowerCase();
  return synonymMap[dest] || [];
}

/**
 * Get status synonyms
 */
function getStatusSynonyms(status: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'planning': ['draft', 'in planning', 'preliminary'],
    'confirmed': ['booked', 'secured', 'finalized'],
    'in_progress': ['ongoing', 'active', 'traveling', 'current'],
    'completed': ['finished', 'done', 'past', 'concluded'],
    'cancelled': ['canceled', 'aborted', 'scrapped']
  };

  const stat = status.toLowerCase();
  return synonymMap[stat] || [];
}

/**
 * Get descriptor synonyms
 */
function getDescriptorSynonyms(descriptor: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'anniversary': ['celebration', 'milestone', 'special occasion'],
    'honeymoon': ['newlyweds', 'romantic', 'wedding trip'],
    'vacation': ['holiday', 'getaway', 'trip', 'break'],
    'business': ['work', 'corporate', 'conference'],
    'family': ['relatives', 'kids', 'children', 'parents'],
    'adventure': ['exciting', 'thrilling', 'active'],
    'relaxation': ['peaceful', 'calm', 'restful', 'spa'],
    'cultural': ['heritage', 'historical', 'museums'],
    'cruise': ['ship', 'sailing', 'maritime', 'ocean']
  };

  const desc = descriptor.toLowerCase();
  return synonymMap[desc] || [];
}

/**
 * Extract descriptive terms from text
 */
function extractDescriptors(text: string): string[] {
  const descriptorPatterns = [
    /\b(anniversary|honeymoon|vacation|holiday|getaway|business|family|adventure|relaxation|cultural|cruise|romantic|celebration|wedding)\b/gi,
    /\b(luxury|budget|premium|deluxe|standard|economy|first-class|business-class)\b/gi,
    /\b(group|solo|couple|couples|single|family|corporate)\b/gi
  ];

  const descriptors: string[] = [];
  descriptorPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      descriptors.push(...matches);
    }
  });

  return [...new Set(descriptors.map(d => d.toLowerCase()))];
}

/**
 * Get cost range category
 */
function getCostRange(cost: number): string {
  if (cost < 1000) return 'budget';
  if (cost < 5000) return 'moderate';
  if (cost < 10000) return 'premium';
  return 'luxury';
}

/**
 * PHASE 3: Perform semantic search using component matching
 */
export async function performSemanticSearch(
  db: D1Database,
  query: string,
  maxResults: number = 10
): Promise<SemanticSearchResult[]> {
  try {
    // Extract components from the search query
    const queryComponents = extractQueryComponents(query);
    
    if (queryComponents.length === 0) {
      return [];
    }

    console.log(`PHASE 3: Semantic search with ${queryComponents.length} query components`);

    // Build semantic search query
    const semanticQuery = buildSemanticQuery(queryComponents, maxResults);
    
    // Execute semantic search
    const results = await db.prepare(semanticQuery.sql)
      .bind(...semanticQuery.params)
      .all();

    // Calculate semantic scores and return formatted results
    return calculateSemanticScores(results.results, queryComponents);

  } catch (error) {
    console.error('PHASE 3: Semantic search failed:', error);
    return [];
  }
}

/**
 * Extract semantic components from search query
 */
function extractQueryComponents(query: string): Array<{type: ComponentType, value: string, weight: number}> {
  const components: Array<{type: ComponentType, value: string, weight: number}> = [];

  // Extract potential client names (proper nouns)
  const names = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (names) {
    names.forEach(name => {
      components.push({
        type: 'client',
        value: name.toLowerCase(),
        weight: 2.0
      });
    });
  }

  // Extract years
  const years = query.match(/\b(19|20)\d{2}\b/g);
  if (years) {
    years.forEach(year => {
      components.push({
        type: 'date',
        value: year,
        weight: 1.3
      });
    });
  }

  // Extract cost indicators
  const costMatches = query.match(/\$\d+|\b(budget|cheap|expensive|luxury|premium)\b/gi);
  if (costMatches) {
    costMatches.forEach(cost => {
      components.push({
        type: 'cost',
        value: cost.toLowerCase().replace('$', ''),
        weight: 1.1
      });
    });
  }

  // Extract status keywords
  const statusMatches = query.match(/\b(planning|confirmed|completed|cancelled|active|ongoing)\b/gi);
  if (statusMatches) {
    statusMatches.forEach(status => {
      components.push({
        type: 'status',
        value: status.toLowerCase(),
        weight: 1.2
      });
    });
  }

  // Extract descriptors
  const descriptors = extractDescriptors(query);
  descriptors.forEach(desc => {
    components.push({
      type: 'descriptor',
      value: desc,
      weight: 1.3
    });
  });

  // Remaining words as potential destinations
  const words = query.toLowerCase().split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !components.some(c => c.value.includes(word)));
    
  words.forEach(word => {
    if (isLikelyDestination(word)) {
      components.push({
        type: 'destination',
        value: word,
        weight: 1.5
      });
    }
  });

  return components;
}

/**
 * Check if a word is likely a destination
 */
function isLikelyDestination(word: string): boolean {
  const destinationIndicators = [
    'hawaii', 'europe', 'asia', 'africa', 'america', 'mediterranean', 'caribbean',
    'paris', 'london', 'rome', 'tokyo', 'bangkok', 'istanbul', 'barcelona',
    'italy', 'france', 'spain', 'greece', 'germany', 'portugal', 'iceland',
    'norway', 'sweden', 'denmark', 'thailand', 'vietnam', 'singapore',
    'cruise', 'island', 'beach', 'mountain', 'city', 'country'
  ];
  
  return destinationIndicators.some(indicator => 
    word.includes(indicator) || indicator.includes(word)
  );
}

/**
 * Build semantic search SQL query
 */
function buildSemanticQuery(components: Array<{type: ComponentType, value: string, weight: number}>, maxResults: number) {
  const conditions: string[] = [];
  const params: string[] = [];

  components.forEach(comp => {
    conditions.push(`
      (tc.component_type = ? AND (
        tc.component_value LIKE ? OR 
        tc.synonyms LIKE ?
      ))
    `);
    params.push(comp.type, `%${comp.value}%`, `%${comp.value}%`);
  });

  const sql = `
    SELECT 
      t.trip_id,
      t.trip_name,
      t.trip_slug,
      t.destinations,
      t.start_date,
      t.end_date,
      t.status,
      t.total_cost,
      t.primary_client_email,
      GROUP_CONCAT(
        tc.component_type || ':' || tc.component_value || ':' || tc.search_weight,
        '|'
      ) as matched_components,
      COUNT(tc.component_id) as match_count,
      SUM(tc.search_weight) as total_weight
    FROM trips_v2 t
    INNER JOIN trip_components tc ON t.trip_id = tc.trip_id
    WHERE ${conditions.join(' OR ')}
    GROUP BY t.trip_id
    ORDER BY total_weight DESC, match_count DESC
    LIMIT ?
  `;

  params.push(maxResults.toString());

  return { sql, params };
}

/**
 * Calculate semantic scores for search results
 */
function calculateSemanticScores(
  results: any[],
  queryComponents: Array<{type: ComponentType, value: string, weight: number}>
): SemanticSearchResult[] {
  return results.map(result => {
    const matchedComponents = parseMatchedComponents(result.matched_components);
    const semanticScore = calculateScore(matchedComponents, queryComponents, result.match_count);

    return {
      trip_id: result.trip_id,
      trip_name: result.trip_name,
      trip_slug: result.trip_slug,
      semantic_score: semanticScore,
      matched_components: matchedComponents,
      search_method: 'semantic_component_matching'
    };
  });
}

/**
 * Parse matched components from database result
 */
function parseMatchedComponents(componentsString: string): SemanticComponent[] {
  if (!componentsString) return [];

  return componentsString.split('|').map(comp => {
    const [type, value, weight] = comp.split(':');
    return {
      trip_id: 0, // Will be filled by caller
      component_type: type as ComponentType,
      component_value: value,
      search_weight: parseFloat(weight)
    };
  });
}

/**
 * Calculate semantic similarity score
 */
function calculateScore(
  matchedComponents: SemanticComponent[],
  queryComponents: Array<{type: ComponentType, value: string, weight: number}>,
  matchCount: number
): number {
  let score = 0;
  let totalPossibleScore = 0;

  queryComponents.forEach(queryComp => {
    totalPossibleScore += queryComp.weight;

    const matches = matchedComponents.filter(matchComp => 
      matchComp.component_type === queryComp.type &&
      (matchComp.component_value.includes(queryComp.value) ||
       queryComp.value.includes(matchComp.component_value))
    );

    if (matches.length > 0) {
      const bestMatch = matches.reduce((best, current) =>
        current.search_weight > best.search_weight ? current : best
      );
      score += queryComp.weight * bestMatch.search_weight;
    }
  });

  // Normalize score and add bonus for multiple matches
  const normalizedScore = totalPossibleScore > 0 ? score / totalPossibleScore : 0;
  const matchBonus = Math.min(matchCount * 0.1, 0.5); // Max 50% bonus

  return Math.min(normalizedScore + matchBonus, 1.0);
}