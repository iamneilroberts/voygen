/**
 * PHASE 2: Trip Slug Generation System
 * Creates URL-friendly identifiers with client-destination-year format
 */

import { D1Database } from '@cloudflare/workers-types';

/**
 * Generates a trip slug in the format: client-destination-year
 * Example: "sara-darren-hawaii-2024" or "john-doe-europe-2025"
 */
export function generateTripSlug(
  tripName: string,
  destinations?: string,
  startDate?: string,
  primaryClientEmail?: string
): string {
  // Extract client name from email or use trip name
  let clientPart = '';
  if (primaryClientEmail) {
    const emailPrefix = primaryClientEmail.split('@')[0];
    clientPart = cleanSlugPart(emailPrefix, 20);
  } else {
    // Extract first few words from trip name as client identifier
    const words = tripName.split(/\s+/).slice(0, 2);
    clientPart = cleanSlugPart(words.join(' '), 20);
  }
  
  // Extract destination
  let destinationPart = 'trip';
  if (destinations) {
    const destWords = destinations.split(/\s+/).slice(0, 2);
    destinationPart = cleanSlugPart(destWords.join(' '), 15);
  }
  
  // Extract year
  let yearPart = new Date().getFullYear().toString();
  if (startDate) {
    const yearMatch = startDate.match(/(\d{4})/);
    if (yearMatch) {
      yearPart = yearMatch[1];
    }
  }
  
  const baseSlug = `${clientPart}-${destinationPart}-${yearPart}`;
  return normalizeSlug(baseSlug);
}

/**
 * Cleans and normalizes a part of the slug
 */
function cleanSlugPart(text: string, maxLength: number): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')           // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')               // Replace spaces with hyphens
    .replace(/-+/g, '-')                // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')            // Remove leading/trailing hyphens
    .substring(0, maxLength)
    .replace(/-+$/, '');                // Remove trailing hyphen after truncation
}

/**
 * Final slug normalization
 */
function normalizeSlug(slug: string): string {
  return slug
    .replace(/&/g, 'and')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Ensures slug uniqueness by appending a number if needed
 */
export async function ensureUniqueSlug(
  db: D1Database,
  baseSlug: string,
  excludeTripId?: number
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (await isSlugTaken(db, slug, excludeTripId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    // Prevent infinite loops
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }
  
  return slug;
}

/**
 * Checks if a slug is already taken
 */
async function isSlugTaken(
  db: D1Database, 
  slug: string, 
  excludeTripId?: number
): Promise<boolean> {
  try {
    let query = 'SELECT trip_id FROM trips_v2 WHERE trip_slug = ?';
    let params = [slug];
    
    if (excludeTripId) {
      query += ' AND trip_id != ?';
      params.push(excludeTripId.toString());
    }
    
    const result = await db.prepare(query).bind(...params).first();
    return result !== null;
  } catch (error) {
    console.warn('Error checking slug uniqueness:', error);
    return false; // Assume not taken if we can't check
  }
}

/**
 * Generates slug from trip data object
 */
export function generateSlugFromTripData(trip: any): string {
  return generateTripSlug(
    trip.trip_name || '',
    trip.destinations || '',
    trip.start_date || '',
    trip.primary_client_email || ''
  );
}

/**
 * PHASE 2: Bulk slug generation for existing trips
 * Used during migration to populate slugs for existing trips
 */
export async function generateSlugsForExistingTrips(db: D1Database): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  try {
    // Get all trips without slugs
    const trips = await db.prepare(`
      SELECT trip_id, trip_name, destinations, start_date, primary_client_email
      FROM trips_v2 
      WHERE trip_slug IS NULL OR trip_slug = ''
    `).all();
    
    console.log(`Found ${trips.results.length} trips needing slugs`);
    
    for (const trip of trips.results) {
      try {
        const baseSlug = generateSlugFromTripData(trip);
        const uniqueSlug = await ensureUniqueSlug(db, baseSlug, trip.trip_id);
        
        await db.prepare(`
          UPDATE trips_v2 
          SET trip_slug = ? 
          WHERE trip_id = ?
        `).bind(uniqueSlug, trip.trip_id).run();
        
        results.success++;
        console.log(`Generated slug for trip ${trip.trip_id}: ${uniqueSlug}`);
        
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to generate slug for trip ${trip.trip_id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
  } catch (error) {
    results.errors.push(`Bulk slug generation failed: ${error}`);
    console.error('Bulk slug generation failed:', error);
  }
  
  return results;
}

/**
 * Validates slug format
 */
export function validateSlug(slug: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!slug) {
    errors.push('Slug cannot be empty');
  }
  
  if (slug.length < 3) {
    errors.push('Slug must be at least 3 characters');
  }
  
  if (slug.length > 100) {
    errors.push('Slug must be less than 100 characters');
  }
  
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
  }
  
  if (slug.startsWith('-') || slug.endsWith('-')) {
    errors.push('Slug cannot start or end with a hyphen');
  }
  
  if (slug.includes('--')) {
    errors.push('Slug cannot contain consecutive hyphens');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}