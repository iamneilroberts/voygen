import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import { generateSessionId } from '../utils/session-management';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';

async function logActivity(
  db: D1Database,
  activityType: string,
  details: string,
  tripId?: number | null,
  clientId?: number | null,
  sessionId?: string | null
) {
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
    await stmt.bind(activityType, details, tripId ?? null, clientId ?? null, sessionId ?? generateSessionId()).run();
  } catch {
    // best-effort logging
  }
}

// Enhanced parser utilities for schedule-first parsing

// Activity classification keywords
const ACTIVITY_KEYWORDS = {
  meal: ['breakfast', 'lunch', 'dinner', 'brunch', 'snack', 'coffee', 'dining', 'restaurant', 'cafe', 'food', 'cuisine'],
  lodging: ['hotel', 'check-in', 'check-out', 'accommodation', 'stay', 'room', 'resort', 'inn', 'lodge', 'bed'],
  flight: ['flight', 'departure', 'arrival', 'airport', 'airline', 'boarding', 'takeoff', 'landing', 'plane'],
  transfer: ['transfer', 'transport', 'drive', 'taxi', 'uber', 'bus', 'train', 'shuttle', 'pickup', 'dropoff'],
  tour: ['tour', 'guided', 'sightseeing', 'attraction', 'museum', 'gallery', 'monument', 'landmark', 'visit', 'explore'],
  activity: ['activity', 'experience', 'adventure', 'excursion', 'recreation', 'entertainment', 'show', 'event'],
  shopping: ['shopping', 'market', 'store', 'boutique', 'souvenir', 'purchase', 'mall', 'shop']
};

// Section markers for isolating schedule content
const SCHEDULE_MARKERS = {
  start: [
    '📅 Schedule', 'Schedule', 'Itinerary', 'Day-by-Day', 'Daily Activities', 'Trip Schedule',
    'Your Itinerary', 'Trip Details', 'Day by Day', 'Agenda', 'Schedule Overview', 'Trip Outline'
  ],
  end: [
    '✈️', '🛬', '🏨', 'Insurance', 'Apps', 'Contact', 'Emergency', 'Packing',
    'Important Information', 'Travel Tips', 'Weather', 'Currency', 'Documents'
  ]
};

/**
 * Find and isolate a specific section of text
 */
function findSection(text: string, startMarkers: string[], endMarkers: string[]): string | null {
  const normalizedText = text.toLowerCase();

  // Find the earliest start marker
  let startIndex = -1;
  let foundStartMarker = '';

  for (const marker of startMarkers) {
    const index = normalizedText.indexOf(marker.toLowerCase());
    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
      foundStartMarker = marker;
    }
  }

  if (startIndex === -1) {
    return null; // No schedule section found
  }

  // Find the earliest end marker after the start
  let endIndex = text.length;

  for (const marker of endMarkers) {
    const index = normalizedText.indexOf(marker.toLowerCase(), startIndex + foundStartMarker.length);
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

/**
 * Detect date headers in various formats
 */
function detectDateHeaders(text: string): Array<{ index: number; date: string; dayNumber?: number }> {
  const matches: Array<{ index: number; date: string; dayNumber?: number }> = [];

  // Date patterns (in order of preference)
  const patterns = [
    // Day X: Date format
    /Day\s+(\d+):?\s+([^,\n]+(?:,\s*\d{4})?)/gi,
    // Full month names with optional year
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d)(?:,\s*(\d{4}))?/gi,
    // Abbreviated month names with optional year
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-3]?\d)(?:,\s*(\d{4}))?/gi,
    // Day of week + month + date
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-3]?\d)/gi,
    // US date format M/D/Y
    /\b([0-1]?\d)\/([0-3]?\d)(?:\/(\d{2,4}))?\b/g,
    // EU date format D/M/Y
    /\b([0-3]?\d)\/([0-1]?\d)(?:\/(\d{2,4}))?\b/g
  ];

  patterns.forEach((pattern, patternIndex) => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      let dateStr = match[0];
      let dayNum: number | undefined;

      // Handle Day X: format specially
      if (patternIndex === 0) {
        dayNum = parseInt(match[1]);
        dateStr = match[2];
      }

      matches.push({
        index: match.index,
        date: dateStr.trim(),
        dayNumber: dayNum
      });
    }
  });

  // Sort by index and remove duplicates
  return matches
    .sort((a, b) => a.index - b.index)
    .filter((match, index, arr) => {
      // Remove matches that are too close to each other (within 20 characters)
      return index === 0 || match.index - arr[index - 1].index > 20;
    });
}

/**
 * Extract time information from text
 */
function extractTimes(text: string): { start_time?: string; end_time?: string } {
  // Time patterns (12h and 24h, with ranges)
  const timePatterns = [
    // Range patterns first (more specific)
    /(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)/g,
    /(\d{1,2}\s?(?:AM|PM|am|pm))\s*[-–—]\s*(\d{1,2}\s?(?:AM|PM|am|pm))/g,
    // Single time patterns
    /\b(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\b/g,
    /\b(\d{1,2}\s?(?:AM|PM|am|pm))\b/g
  ];

  for (const pattern of timePatterns) {
    const match = pattern.exec(text);
    if (match) {
      if (match[2]) {
        // Range found
        return { start_time: match[1].trim(), end_time: match[2].trim() };
      } else {
        // Single time
        return { start_time: match[1].trim() };
      }
    }
  }

  return {};
}

/**
 * Classify activity type based on content
 */
function classifyActivity(title: string, description?: string): string {
  const text = (title + ' ' + (description || '')).toLowerCase();

  for (const [type, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return type;
    }
  }

  return 'activity'; // default
}

/**
 * Enhanced day splitting using schedule-first strategy
 */
function splitDaysFromTextScheduleFirst(text: string, strategy: 'schedule_first' | 'full_text' = 'schedule_first'): Array<{ day_number: number; heading: string; body: string; date?: string }> {
  let workingText = text;

  // Step 1: Try to isolate schedule section if using schedule_first strategy
  if (strategy === 'schedule_first') {
    const scheduleSection = findSection(text, SCHEDULE_MARKERS.start, SCHEDULE_MARKERS.end);
    if (scheduleSection) {
      workingText = scheduleSection;
    }
    // If no schedule section found, fall back to full text
  }

  // Step 2: Detect both Day X headings and date headers
  const dayMatches: Array<{ index: number; day: number; heading: string }> = [];
  const dayRegex = /(day\s*(\d+)\s*[:\-–]?\s*[^\n]*)/gi;
  let m: RegExpExecArray | null;

  while ((m = dayRegex.exec(workingText)) != null) {
    const dayNum = Number(m[2]);
    dayMatches.push({
      index: m.index,
      day: Number.isFinite(dayNum) ? dayNum : dayMatches.length + 1,
      heading: m[1]
    });
  }

  // Get date headers
  const dateHeaders = detectDateHeaders(workingText);

  // Step 3: Merge and create breakpoints
  const allBreakpoints: Array<{ index: number; day_number: number; heading: string; date?: string }> = [];

  // Add day matches
  dayMatches.forEach(match => {
    allBreakpoints.push({
      index: match.index,
      day_number: match.day,
      heading: match.heading,
    });
  });

  // Add date headers as breakpoints
  dateHeaders.forEach((dateHeader, idx) => {
    // If this date header has a day number, use it; otherwise, assign sequential number
    const dayNumber = dateHeader.dayNumber || (dayMatches.length + idx + 1);

    allBreakpoints.push({
      index: dateHeader.index,
      day_number: dayNumber,
      heading: `Day ${dayNumber}: ${dateHeader.date}`,
      date: dateHeader.date
    });
  });

  // Sort by index and remove duplicates (prefer day headings over date headers if close)
  allBreakpoints.sort((a, b) => a.index - b.index);

  const uniqueBreakpoints = allBreakpoints.filter((bp, idx) => {
    if (idx === 0) return true;
    const prev = allBreakpoints[idx - 1];
    // If two breakpoints are within 50 characters, prefer the one with explicit day number
    if (Math.abs(bp.index - prev.index) < 50) {
      return bp.heading.toLowerCase().includes('day') && !prev.heading.toLowerCase().includes('day');
    }
    return true;
  });

  // If no breakpoints found, return single day
  if (uniqueBreakpoints.length === 0) {
    return [{ day_number: 1, heading: 'Day 1', body: workingText }];
  }

  // Step 4: Split text into day blocks
  const blocks: Array<{ day_number: number; heading: string; body: string; date?: string }> = [];

  for (let i = 0; i < uniqueBreakpoints.length; i++) {
    const start = uniqueBreakpoints[i].index;
    const end = i + 1 < uniqueBreakpoints.length ? uniqueBreakpoints[i + 1].index : workingText.length;
    const body = workingText.slice(start, end);

    blocks.push({
      day_number: uniqueBreakpoints[i].day_number,
      heading: uniqueBreakpoints[i].heading.trim(),
      body,
      date: uniqueBreakpoints[i].date
    });
  }

  return blocks;
}

/**
 * Enhanced activity extraction with better time parsing and classification
 */
function extractActivitiesEnhanced(body: string): Array<{ start_time?: string; end_time?: string; title: string; location?: string; activity_type: string }> {
  const lines = body.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const activities: any[] = [];

  for (const line of lines) {
    // Skip very short lines or lines that look like headers
    if (line.length < 5 || /^(day\s*\d+|schedule|itinerary)/i.test(line)) {
      continue;
    }

    // Extract times using enhanced time extraction
    const times = extractTimes(line);

    // Clean up the title by removing time information
    let title = line;
    if (times.start_time) {
      // Remove the time portion from the title
      title = line.replace(/\b\d{1,2}:?\d{0,2}\s?(?:AM|PM|am|pm)?\b/g, '').trim();
      title = title.replace(/^\s*[-–—:]\s*/, '').trim(); // Remove leading separators
    }

    // Skip if title is too short after cleanup
    if (title.length < 3) {
      continue;
    }

    // Classify the activity
    const activity_type = classifyActivity(title);

    // Try to extract location (basic pattern matching)
    let location: string | undefined;
    const locationMatch = title.match(/(?:at|in|@)\s+([^,\n]+)/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
    }

    activities.push({
      start_time: times.start_time,
      end_time: times.end_time,
      title,
      location,
      activity_type
    });
  }

  return activities.slice(0, 50); // Limit to prevent runaway parsing
}

// Extract hotel/accommodation information from text
function extractHotels(text: string, tripId: number): any[] {
  const hotels: any[] = [];
  const lines = text.split('\n');

  // Hotel/accommodation keywords to look for
  const hotelKeywords = [
    'hotel', 'hilton', 'marriott', 'hyatt', 'sheraton', 'westin', 'grafton',
    'canopy', 'accommodation', 'resort', 'inn', 'lodge', 'stay', 'check-in'
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if this line mentions a hotel
    if (hotelKeywords.some(keyword => lowerLine.includes(keyword))) {
      // Extract hotel name and city
      const hotelMatch = line.match(/([A-Z][^,\n]*(?:Hotel|Hilton|Marriott|Hyatt|Sheraton|Westin|Grafton|Canopy|Inn|Lodge|Resort)[^,\n]*)/i);
      if (hotelMatch) {
        const hotelName = hotelMatch[1].trim();

        // Extract city/location
        let city = 'Unknown';
        if (lowerLine.includes('dublin')) city = 'Dublin';
        else if (lowerLine.includes('london')) city = 'London';
        else if (lowerLine.includes('stoneleigh')) city = 'Stoneleigh';

        // Extract nights if mentioned
        const nightsMatch = line.match(/(\d+)\s*nights?/i);
        const nights = nightsMatch ? parseInt(nightsMatch[1]) : 1;

        // Estimate price based on city and hotel name
        let estimatedPrice = 200; // Default
        if (city === 'Dublin' && lowerLine.includes('grafton')) estimatedPrice = 250;
        if (city === 'London' && lowerLine.includes('canopy')) estimatedPrice = 180;

        hotels.push({
          id: `hotel_${hotels.length + 1}_trip_${tripId}`,
          name: hotelName,
          city: city,
          location: city,
          star_rating: 4, // Default estimate
          tags: ['imported'],
          lead_price: { amount: estimatedPrice, currency: 'USD' },
          site: 'imported',
          refundable: true,
          nights: nights,
          amenities: ['WiFi', 'Breakfast']
        });
      }
    }
  }

  return hotels;
}

export const importTripPageTool = {
  name: 'import_trip_page',
  description: 'Import a public web page (no browser). Saves FULL HTML + extracted text for a trip and adds a reference in trips_v2.documents.',
  inputSchema: z.object({
    trip_id: z.union([z.number(), z.string()]).optional().describe('Trip ID'),
    trip_identifier: z.string().optional().describe('Trip name or slug if trip_id is not known'),
    url: z.string().url().describe('URL of the page to import'),
    tag: z.string().optional().describe('Optional tag to categorize this document'),
    save_raw_html: z.boolean().optional().default(true),
    save_text: z.boolean().optional().default(true),
    overwrite: z.boolean().optional().default(false)
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Resolve trip_id
      let tripId: number | null = null;
      if (input.trip_id != null) {
        const n = Number(input.trip_id);
        if (!Number.isFinite(n)) {
          throw new Error('trip_id must be numeric');
        }
        tripId = n;
      } else if (input.trip_identifier) {
        const ident = String(input.trip_identifier).trim().toLowerCase();
        const bySlug = await db
          .prepare(`SELECT trip_id FROM trips_v2 WHERE LOWER(trip_slug) = ? LIMIT 1`)
          .bind(ident)
          .first();
        if (bySlug?.trip_id) {
          tripId = Number(bySlug.trip_id);
        } else {
          const like = `%${ident}%`;
          const byName = await db
            .prepare(`SELECT trip_id FROM trips_v2 WHERE LOWER(trip_name) LIKE ? ORDER BY updated_at DESC LIMIT 1`)
            .bind(like)
            .first();
          if (byName?.trip_id) {
            tripId = Number(byName.trip_id);
          }
        }
      }

      if (!tripId) {
        throw new Error('Trip not found. Provide a valid trip_id or trip_identifier.');
      }

      // Fetch page
      const res = await fetch(input.url, { redirect: 'follow' as any });
      if (!res.ok) {
        throw new Error(`Fetch failed (${res.status}) for ${input.url}`);
      }
      const contentType = res.headers.get('content-type') || 'text/html';
      const saveHtml = input.save_raw_html !== false; // default true
      const saveText = input.save_text !== false; // default true
      const html = saveHtml ? await res.text() : '';
      const sizeBytes = html ? new TextEncoder().encode(html).length : 0;

      // Basic text extraction
      const text = saveText
        ? html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

      // Ensure storage table exists (separate table to avoid bloating trips_v2 rows)
      await db
        .prepare(`
          CREATE TABLE IF NOT EXISTS trip_external_docs (
            doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            content_type TEXT,
            size_bytes INTEGER,
            html TEXT,
            text TEXT,
            tag TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
          )
        `)
        .run();

      if (input.overwrite) {
        await db
          .prepare(`DELETE FROM trip_external_docs WHERE trip_id = ? AND url = ?`)
          .bind(tripId, input.url)
          .run();
      }

      // Insert doc
      const insert = await db
        .prepare(
          `INSERT INTO trip_external_docs (trip_id, url, content_type, size_bytes, html, text, tag) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(tripId, input.url, contentType, sizeBytes, saveHtml ? html : null, saveText ? text : null, input.tag || null)
        .run();

      const docId = Number(insert.meta?.last_row_id || 0);

      // Append a small reference to trips_v2.documents
      const row = await db
        .prepare(`SELECT documents FROM trips_v2 WHERE trip_id = ?`)
        .bind(tripId)
        .first();
      let docs: any[] = [];
      try {
        docs = row?.documents ? JSON.parse(row.documents) : [];
        if (!Array.isArray(docs)) docs = [];
      } catch {
        docs = [];
      }
      docs.push({
        doc_id: docId,
        url: input.url,
        content_type: contentType,
        size_bytes: sizeBytes,
        tag: input.tag || null,
        fetched_at: new Date().toISOString()
      });
      await db
        .prepare(`UPDATE trips_v2 SET documents = ?, updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?`)
        .bind(JSON.stringify(docs), tripId)
        .run();

      await logActivity(
        db,
        'ExternalDocImported',
        `Imported external page into trip: ${input.url}`,
        tripId,
        null,
        generateSessionId()
      );

      return {
        success: true,
        message: 'Page imported',
        trip_id: tripId,
        url: input.url,
        content_type: contentType,
        bytes_saved: sizeBytes,
        doc_id: docId,
        saved_html: saveHtml,
        saved_text: saveText
      };
    } catch (error: any) {
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'import_trip_page',
        error_message: error.message,
        table_names: 'trip_external_docs,trips_v2,ActivityLog',
        context: extractOperationContext('import_trip_page', input)
      });
      return createErrorResponse(error, 'Import Trip Page', input, sessionId);
    }
  }
};

export const getTripDocumentsTool = {
  name: 'get_trip_documents',
  description: 'List stored external documents for a trip with optional previews.',
  inputSchema: z.object({
    trip_id: z.union([z.string(), z.number()]).optional(),
    trip_identifier: z.string().optional(),
    limit: z.number().optional().default(10),
    include_html: z.boolean().optional().default(false),
    include_text: z.boolean().optional().default(false)
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Resolve trip
      let tripId: number | null = null;
      if (input.trip_id != null) {
        tripId = Number(input.trip_id);
      } else if (input.trip_identifier) {
        const ident = String(input.trip_identifier).trim().toLowerCase();
        const bySlug = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_slug)=?').bind(ident).first();
        tripId = bySlug?.trip_id ? Number(bySlug.trip_id) : null;
        if (!tripId) {
          const like = `%${ident}%`;
          const byName = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_name) LIKE ? ORDER BY updated_at DESC LIMIT 1').bind(like).first();
          if (byName?.trip_id) tripId = Number(byName.trip_id);
        }
      }
      if (!tripId) throw new Error('Trip not found');

      const cols = ['doc_id','trip_id','url','content_type','size_bytes','tag','created_at'];
      if (input.include_html) cols.push('html');
      if (input.include_text) cols.push('text');

      const sql = `SELECT ${cols.join(',')} FROM trip_external_docs WHERE trip_id = ? ORDER BY created_at DESC LIMIT ?`;
      const docs = await db.prepare(sql).bind(tripId, input.limit || 10).all();
      return { success: true, trip_id: tripId, count: docs.results?.length || 0, documents: docs.results };
    } catch (error: any) {
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'get_trip_documents',
        error_message: error.message,
        table_names: 'trip_external_docs',
        context: extractOperationContext('get_trip_documents', input)
      });
      return createErrorResponse(error, 'Get Trip Documents', input, sessionId);
    }
  }
};

// Simple itinerary parser utilities
function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitDaysFromText(text: string): Array<{ day_number: number; heading: string; body: string }>{
  const matches: Array<{ index: number; day: number; heading: string }> = [];
  const regex = /(day\s*(\d+)\s*[:\-–]?\s*[^\n]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) != null) {
    const dayNum = Number(m[2]);
    matches.push({ index: m.index, day: Number.isFinite(dayNum) ? dayNum : matches.length + 1, heading: m[1] });
  }
  if (matches.length === 0) {
    return [{ day_number: 1, heading: 'Day 1', body: text }];
  }
  const blocks: Array<{ day_number: number; heading: string; body: string }> = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end);
    blocks.push({ day_number: matches[i].day, heading: matches[i].heading.trim(), body });
  }
  return blocks;
}

function extractActivities(body: string): Array<{ start_time?: string; end_time?: string; title: string; location?: string; activity_type?: string }>{
  const lines = body.split(/\n|\r|\.|;|\u2022/).map((l) => l.trim()).filter(Boolean);
  const out: any[] = [];
  const timeRe = /(\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b)/;
  for (const line of lines) {
    const tm = line.match(timeRe);
    if (tm) {
      const parts = line.split(/\s+-\s+|\s+–\s+|\s+—\s+/);
      let title = line;
      let start: string | undefined;
      let end: string | undefined;
      if (parts.length >= 2) {
        // e.g., "10:00 AM - Guinness Storehouse Tour"
        start = (parts[0].match(timeRe) || [])[0];
        title = parts.slice(1).join(' - ').trim();
      } else {
        start = tm[0];
        title = line.replace(timeRe, '').replace(/^[\s\-–—:]+/, '').trim();
      }
      const lower = title.toLowerCase();
      const activity_type = lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') ? 'meal' : 'activity';
      out.push({ start_time: start, end_time: end, title, activity_type });
    } else if (line.length > 10) {
      // Fallback: long descriptive line
      out.push({ title: line, activity_type: 'activity' });
    }
  }
  return out.slice(0, 50);
}

export const importTripPageAndParseTool = {
  name: 'import_trip_page_and_parse',
  description: 'Parse an imported/remote trip page into TripDays and Activities with enhanced schedule-first parsing and flexible overwrite options.',
  inputSchema: z.object({
    trip_id: z.union([z.number(), z.string()]).optional(),
    trip_identifier: z.string().optional(),
    doc_id: z.number().optional(),
    url: z.string().url().optional(),
    strategy: z.enum(['schedule_first', 'full_text']).optional().default('schedule_first').describe('Parsing strategy: schedule_first isolates schedule sections, full_text processes entire document'),
    overwrite: z.enum(['none', 'days', 'all']).optional().default('none').describe('Overwrite behavior: none=skip duplicates, days=replace matching day numbers, all=replace all trip days'),
    dry_run: z.boolean().optional().default(false),
    max_days: z.number().optional().default(14),
    max_activities_per_day: z.number().optional().default(30)
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Resolve trip
      let tripId: number | null = null;
      if (input.trip_id != null) {
        tripId = Number(input.trip_id);
      } else if (input.trip_identifier) {
        const ident = String(input.trip_identifier).trim().toLowerCase();
        const bySlug = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_slug)=?').bind(ident).first();
        if (bySlug?.trip_id) tripId = Number(bySlug.trip_id);
        if (!tripId) {
          const like = `%${ident}%`;
          const byName = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_name) LIKE ? ORDER BY updated_at DESC LIMIT 1').bind(like).first();
          if (byName?.trip_id) tripId = Number(byName.trip_id);
        }
      }
      if (!tripId) throw new Error('Trip not found');

      // Resolve document
      let doc: any = null;
      if (input.doc_id) {
        doc = await db.prepare('SELECT * FROM trip_external_docs WHERE doc_id = ? AND trip_id = ?').bind(input.doc_id, tripId).first();
      } else if (input.url) {
        doc = await db.prepare('SELECT * FROM trip_external_docs WHERE trip_id = ? AND url = ? ORDER BY created_at DESC LIMIT 1').bind(tripId, input.url).first();
      } else {
        doc = await db.prepare('SELECT * FROM trip_external_docs WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1').bind(tripId).first();
      }
      if (!doc) throw new Error('No imported document found to parse');

      const baseText = doc.text || stripHtml(doc.html);
      if (!baseText) throw new Error('Document has no text to parse');

      // Use enhanced parsing with strategy
      const strategy = input.strategy || 'schedule_first';
      const days = splitDaysFromTextScheduleFirst(baseText, strategy).slice(0, input.max_days || 14);
      const parsed: Array<{ day_number: number; heading: string; activities: any[]; date?: string }> = [];
      for (const d of days) {
        const acts = extractActivitiesEnhanced(d.body).slice(0, input.max_activities_per_day || 30);
        parsed.push({
          day_number: d.day_number,
          heading: d.heading,
          activities: acts,
          date: d.date
        });
      }

      if (input.dry_run) {
        return { success: true, preview: parsed.slice(0, 2), strategy: strategy };
      }

      // Handle overwrite logic
      const overwriteMode = input.overwrite || 'none';
      if (overwriteMode === 'all') {
        // Delete all TripDays for this trip (cascades to activities)
        await db.prepare('DELETE FROM TripDays WHERE trip_id = ?').bind(tripId).run();
      } else if (overwriteMode === 'days') {
        // Delete only the days we're about to insert
        const dayNumbers = parsed.map(p => p.day_number);
        if (dayNumbers.length > 0) {
          const placeholders = dayNumbers.map(() => '?').join(',');
          await db.prepare(`DELETE FROM TripDays WHERE trip_id = ? AND day_number IN (${placeholders})`)
            .bind(tripId, ...dayNumbers)
            .run();
        }
      }

      // Insert TripDays + activities
      let daysCreated = 0;
      let activitiesCreated = 0;
      let duplicatesSkipped = 0;
      for (const d of parsed) {
        // Insert or update TripDay with optional date
        if (overwriteMode === 'none') {
          await db.prepare('INSERT OR IGNORE INTO TripDays (trip_id, day_number, summary, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
            .bind(tripId, d.day_number, d.heading)
            .run();
        } else {
          // For overwrite modes, use INSERT OR REPLACE to handle conflicts
          await db.prepare('INSERT OR REPLACE INTO TripDays (trip_id, day_number, summary, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
            .bind(tripId, d.day_number, d.heading)
            .run();
        }

        const dayRow = await db.prepare('SELECT id FROM TripDays WHERE trip_id = ? AND day_number = ?')
          .bind(tripId, d.day_number)
          .first();

        if (dayRow?.id) daysCreated += 1;

        for (const a of d.activities) {
          // Check for duplicates if in 'none' mode
          if (overwriteMode === 'none') {
            const existing = await db.prepare(
              `SELECT 1 FROM trip_activities_enhanced
               WHERE trip_id = ? AND day_id = ? AND title = ? AND COALESCE(start_time,'') = ?
               AND metadata_json LIKE ? LIMIT 1`
            ).bind(
              tripId,
              dayRow?.id || null,
              a.title || 'Activity',
              a.start_time || '',
              `%"doc_id": ${doc.doc_id}%`
            ).first();

            if (existing) {
              duplicatesSkipped += 1;
              continue;
            }
          }

          const metadata = {
            source: 'import_trip_page_and_parse',
            doc_id: doc.doc_id,
            strategy: strategy,
            parsed_date: d.date || null
          };

          await db.prepare(
            `INSERT INTO trip_activities_enhanced (trip_id, day_id, activity_type, title, start_time, end_time, location, metadata_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          )
            .bind(
              tripId,
              dayRow?.id || null,
              a.activity_type || 'activity',
              a.title || 'Activity',
              a.start_time || null,
              a.end_time || null,
              a.location || null,
              JSON.stringify(metadata)
            )
            .run();
          activitiesCreated += 1;
        }
      }

      const logMessage = `Parsed ${daysCreated} days, ${activitiesCreated} activities from doc ${doc.doc_id} using ${strategy} strategy`;
      await logActivity(db, 'ItineraryParsed', logMessage, tripId, null, generateSessionId());

      return {
        success: true,
        trip_id: tripId,
        days_created: daysCreated,
        activities_created: activitiesCreated,
        duplicates_skipped: duplicatesSkipped,
        doc_id: doc.doc_id,
        strategy: strategy,
        overwrite_mode: overwriteMode
      };
    } catch (error: any) {
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'import_trip_page_and_parse',
        error_message: error.message,
        table_names: 'TripDays,trip_activities_enhanced,trip_external_docs',
        context: extractOperationContext('import_trip_page_and_parse', input)
      });
      return createErrorResponse(error, 'Import Page and Parse', input, sessionId);
    }
  }
};

export const previewTravelDocTool = {
  name: 'preview_travel_doc',
  description: 'Quickly preview stored HTML/text from a trip_external_docs row for QA.',
  inputSchema: z.object({
    doc_id: z.number().optional(),
    trip_id: z.union([z.number(), z.string()]).optional(),
    trip_identifier: z.string().optional(),
    url: z.string().url().optional(),
    format: z.enum(['text','html']).optional().default('text'),
    max_chars: z.number().optional().default(1200)
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      let row: any = null;
      if (input.doc_id) {
        row = await db.prepare('SELECT * FROM trip_external_docs WHERE doc_id = ?').bind(input.doc_id).first();
      } else {
        // resolve trip
        let tripId: number | null = null;
        if (input.trip_id != null) tripId = Number(input.trip_id);
        else if (input.trip_identifier) {
          const ident = String(input.trip_identifier).trim().toLowerCase();
          const bySlug = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_slug)=?').bind(ident).first();
          if (bySlug?.trip_id) tripId = Number(bySlug.trip_id);
          if (!tripId) {
            const like = `%${ident}%`;
            const byName = await db.prepare('SELECT trip_id FROM trips_v2 WHERE LOWER(trip_name) LIKE ? ORDER BY updated_at DESC LIMIT 1').bind(like).first();
            if (byName?.trip_id) tripId = Number(byName.trip_id);
          }
        }
        if (!tripId) throw new Error('Trip not found');
        if (input.url) {
          row = await db.prepare('SELECT * FROM trip_external_docs WHERE trip_id = ? AND url = ? ORDER BY created_at DESC LIMIT 1').bind(tripId, input.url).first();
        } else {
          row = await db.prepare('SELECT * FROM trip_external_docs WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1').bind(tripId).first();
        }
      }
      if (!row) throw new Error('Document not found');

      const content = input.format === 'html' ? (row.html || '') : (row.text || stripHtml(row.html));
      const snippet = (content || '').slice(0, input.max_chars || 1200);
      return { success: true, doc_id: row.doc_id, length: (content || '').length, preview: snippet };
    } catch (error: any) {
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'preview_travel_doc',
        error_message: error.message,
        table_names: 'trip_external_docs',
        context: extractOperationContext('preview_travel_doc', input)
      });
      return createErrorResponse(error, 'Preview Travel Doc', input, sessionId);
    }
  }
};
