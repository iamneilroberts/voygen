/**
 * Search normalization utilities for consistent trip matching
 */

/**
 * Normalizes search terms for consistent database matching
 * PHASE 1 ENHANCEMENT: Enhanced punctuation normalization for better matching
 * Handles common variations like "&" vs "and", spacing, special characters
 */
export function normalizeSearchTerm(term: string): string {
  return term
    .toLowerCase()
    // Phase 1: Enhanced punctuation normalization
    .replace(/\s*[&+]\s*/g, ' and ')     // Normalize &, + to 'and'
    .replace(/\s*\/\s*/g, ' or ')        // Normalize / to 'or'
    .replace(/\s*,\s*/g, ' ')            // Remove commas, replace with space
    .replace(/\s*;\s*/g, ' ')            // Remove semicolons, replace with space
    .replace(/\s*:\s*/g, ' ')            // Remove colons, replace with space
    .replace(/\s+/g, ' ')                // Normalize multiple spaces
    .replace(/[''`]/g, "'")              // Normalize all quote variants
    .replace(/[""]/g, '"')               // Normalize smart quotes
    .replace(/[^\w\s@.-]/g, '')         // Remove special chars except email chars
    .replace(/\s*[-–—]\s*/g, ' ')       // Normalize all dash variants to spaces
    .replace(/\s*\.\s*(?!\w)/g, ' ')    // Remove periods not in emails/decimals
    .trim();
}

/**
 * Term weight information for prioritized search matching
 */
export interface TermWeight {
  term: string;
  weight: number;
  category: 'email' | 'name' | 'location' | 'date' | 'descriptor' | 'number' | 'generic';
}

/**
 * Selects the best search terms from a query with weighted priorities
 * PHASE 1 ENHANCEMENT: Returns terms with weights for better matching
 * Prioritizes proper nouns, locations, and unique identifiers
 */
export function selectBestSearchTerms(query: string, maxTerms: number = 3): string[] {
  const weightedTerms = selectWeightedSearchTerms(query, maxTerms);
  return weightedTerms.map(t => t.term);
}

/**
 * PHASE 1 NEW: Selects search terms with weight information
 * Client names get 2x weight, destinations get 1.5x weight as per spec
 */
export function selectWeightedSearchTerms(query: string, maxTerms: number = 3): TermWeight[] {
  const words = query.split(/\s+/).filter(w => w.length > 1);
  const weightedTerms: TermWeight[] = [];
  
  // Priority 1: Email addresses (always unique) - Weight 3.0
  const emails = words.filter(w => /\w+@\w+\.\w+/.test(w));
  emails.forEach(term => weightedTerms.push({ term, weight: 3.0, category: 'email' }));
  
  // Priority 2: Proper nouns (likely client names) - Weight 2.0 (2x baseline)
  const properNouns = words.filter(w => /^[A-Z][a-z]+/.test(w) && !emails.includes(w));
  properNouns.forEach(term => weightedTerms.push({ term, weight: 2.0, category: 'name' }));
  
  // Priority 3: Known locations (destinations) - Weight 1.5 (1.5x baseline)
  const locationKeywords = [
    'bristol', 'bath', 'london', 'paris', 'hawaii', 'york', 'rome', 'venice',
    'mediterranean', 'caribbean', 'europe', 'asia', 'america', 'africa',
    'australia', 'japan', 'italy', 'france', 'spain', 'greece', 'turkey',
    'croatia', 'iceland', 'norway', 'sweden', 'denmark', 'portugal',
    'scotland', 'ireland', 'wales', 'england', 'thailand', 'vietnam',
    'singapore', 'malaysia', 'indonesia', 'philippines', 'china', 'korea'
  ];
  const locations = words.filter(w => 
    locationKeywords.some(loc => w.toLowerCase().includes(loc)) && 
    !properNouns.includes(w) && !emails.includes(w)
  );
  locations.forEach(term => weightedTerms.push({ term, weight: 1.5, category: 'location' }));
  
  // Priority 4: Dates and years - Weight 1.8
  const numbers = words.filter(w => 
    /\d/.test(w) && !emails.includes(w) && !properNouns.includes(w) && !locations.includes(w)
  );
  numbers.forEach(term => weightedTerms.push({ term, weight: 1.8, category: 'number' }));
  
  // Priority 5: Unique descriptors - Weight 1.3
  const descriptors = words.filter(w => 
    /^(anniversary|birthday|wedding|honeymoon|celebration|reunion|vacation|holiday|getaway)/i.test(w) &&
    !properNouns.includes(w) && !locations.includes(w) && !numbers.includes(w) && !emails.includes(w)
  );
  descriptors.forEach(term => weightedTerms.push({ term, weight: 1.3, category: 'descriptor' }));
  
  // Priority 6: Generic terms - Weight 1.0 (baseline)
  const remaining = words.filter(w => 
    !emails.includes(w) && !properNouns.includes(w) && !locations.includes(w) && 
    !numbers.includes(w) && !descriptors.includes(w)
  );
  remaining.forEach(term => weightedTerms.push({ term, weight: 1.0, category: 'generic' }));
  
  // Sort by weight (highest first), remove duplicates, limit to maxTerms
  const uniqueTerms = new Map<string, TermWeight>();
  weightedTerms.forEach(wt => {
    if (!uniqueTerms.has(wt.term) || uniqueTerms.get(wt.term)!.weight < wt.weight) {
      uniqueTerms.set(wt.term, wt);
    }
  });
  
  return Array.from(uniqueTerms.values())
    .sort((a, b) => b.weight - a.weight)
    .filter(wt => wt.term.length >= 2)
    .slice(0, maxTerms);
}

/**
 * PHASE 1 ENHANCEMENT: Creates comprehensive search variations for improved fallback matching
 */
export function createSearchVariations(query: string): string[] {
  const normalized = normalizeSearchTerm(query);
  const variations = [
    query,                                    // Original
    normalized,                               // Normalized
    normalized.replace(/ and /g, ' & '),     // Try with &
    normalized.replace(/ and /g, ' '),       // Try without and/&
    normalized.replace(/ or /g, ' '),        // Try without or
  ];
  
  // Enhanced name pattern matching for various formats
  const namePatterns = [
    /^(\w+)\s*(?:and|&|\+)\s*(\w+)/i,        // "Sara and Darren", "Sara & Darren", "Sara + Darren"
    /^(\w+)\s*[,/]\s*(\w+)/i,                // "Sara, Darren", "Sara / Darren"
    /^(\w+)\s+(\w+)\s+(?:and|&)\s+(\w+)/i,   // "Sara Johnson and Darren"
    /^(\w+)\s+(?:and|&)\s+(\w+)\s+(\w+)/i    // "Sara and Darren Smith"
  ];
  
  for (const pattern of namePatterns) {
    const match = query.match(pattern);
    if (match) {
      // Add individual names
      variations.push(match[1].toLowerCase());
      variations.push(match[2].toLowerCase());
      if (match[3]) variations.push(match[3].toLowerCase());
      
      // Add combined variations
      variations.push(`${match[1]} ${match[2]}`);
      if (match[3]) {
        variations.push(`${match[1]} ${match[3]}`);
        variations.push(`${match[2]} ${match[3]}`);
      }
    }
  }
  
  // Add partial word matching for longer terms
  const words = normalized.split(/\s+/).filter(w => w.length > 3);
  words.forEach(word => {
    if (word.length > 4) {
      variations.push(word.substring(0, Math.max(3, word.length - 1))); // Remove last char
      variations.push(word.substring(1)); // Remove first char
    }
  });
  
  // Add acronym variations for multi-word queries
  if (words.length > 1) {
    const acronym = words.map(w => w.charAt(0)).join('');
    if (acronym.length > 1) {
      variations.push(acronym);
    }
  }
  
  // Add common misspelling corrections
  const correctionMap = {
    'hawai': 'hawaii',
    'mediteranean': 'mediterranean',
    'carribean': 'caribbean',
    'aniversary': 'anniversary',
    'anniversery': 'anniversary',
    'honeymon': 'honeymoon'
  };
  
  words.forEach(word => {
    Object.entries(correctionMap).forEach(([typo, correct]) => {
      if (word.includes(typo)) {
        variations.push(word.replace(typo, correct));
      }
    });
  });
  
  return [...new Set(variations)].filter(v => v.length > 0);  // Remove duplicates and empty strings
}

/**
 * Determines search strategy based on query complexity
 */
export function determineSearchStrategy(query: string): 'exact' | 'fuzzy' | 'broad' {
  // If it looks like an ID, use exact
  if (/^\d+$/.test(query.trim())) {
    return 'exact';
  }
  
  // If it's an email, use exact
  if (/\w+@\w+\.\w+/.test(query)) {
    return 'exact';
  }
  
  // If it has many words, use broad
  const wordCount = query.split(/\s+/).length;
  if (wordCount > 4) {
    return 'broad';
  }
  
  // Default to fuzzy for most searches
  return 'fuzzy';
}

/**
 * Stop words to filter out from searches
 */
export const SEARCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'after',
  'me', 'all', 'show', 'get', 'find', 'list', 'display', 'give', 'tell',
  'their', 'our', 'my', 'your', 'his', 'her', 'its', 'they', 'we', 'you',
  'details', 'information', 'data', 'full', 'complete', 'everything', 'all',
  'itinerary', 'trip', 'travel', 'accommodation', 'transportation', 'activities',
  'please', 'need', 'want', 'would', 'could', 'should', 'can', 'will'
]);

/**
 * Filters out stop words from search terms
 */
export function removeStopWords(terms: string[]): string[] {
  return terms.filter(term => 
    !SEARCH_STOP_WORDS.has(term.toLowerCase()) && term.length >= 2
  );
}