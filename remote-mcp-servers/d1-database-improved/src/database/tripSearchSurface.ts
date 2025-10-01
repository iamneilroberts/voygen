import { Env } from '../types';

export interface TripSearchRefreshResult {
  tripId: number;
  tripName: string;
  tokens: string[];
  phoneticTokens: string[];
}

const MANUAL_REPLACEMENTS: Record<string, string[]> = {
  chisholm: ['chisolm', 'chissom', 'chishom'],
  stoneleigh: ['stonleigh', 'stoneley', 'stonely', 'stoneleigh'],
  brianne: ['breanne', 'briane'],
  stephanie: ['steffanie', 'stephany', 'steffany'],
};

function titleCase(word: string): string {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveNameFromEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }
  const localPart = email.split('@')[0] || '';
  if (!localPart) {
    return null;
  }
  const segments = localPart.split(/[._-]+/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return segments.map(titleCase).join(' ');
}

export function removeDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, '');
}

export function normalizeText(value?: string | null): string {
  if (!value) {
    return '';
  }
  const noDiacritics = removeDiacritics(value);
  return noDiacritics.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function tokenizeText(value?: string | null): string[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export function generatePhoneticVariants(token: string): string[] {
  const variants = new Set<string>();

  const replacements = MANUAL_REPLACEMENTS[token];
  if (replacements) {
    replacements.forEach((variant) => variants.add(variant));
  }

  // Generic rules
  if (token.endsWith('leigh')) {
    variants.add(token.replace(/leigh$/, 'ley'));
    variants.add(token.replace(/leigh$/, 'lee'));
    variants.add(token.replace(/leigh$/, 'lay'));
  }

  if (token.endsWith('holme')) {
    variants.add(token.replace(/holme$/, 'holm'));
  }

  if (token.includes('ph')) {
    variants.add(token.replace(/ph/g, 'f'));
  }

  if (token.includes('ck')) {
    variants.add(token.replace(/ck/g, 'k'));
  }

  const collapsed = token.replace(/([a-z])\1+/g, '$1');
  if (collapsed !== token) {
    variants.add(collapsed);
  }

  if (token.includes('ch')) {
    variants.add(token.replace(/ch/g, 'k'));
  }

  return Array.from(variants).filter(Boolean);
}

export class TripSearchSurfaceManager {
  constructor(private env: Env) {}

  async refreshDirty(limit = 100): Promise<number> {
    const dirtyRows: Array<{ trip_id: number }> = await this.env.DB
      .prepare(
        `SELECT DISTINCT trip_id
           FROM trip_search_surface_dirty
          WHERE trip_id IS NOT NULL
          ORDER BY created_at ASC
          LIMIT ?1`
      )
      .bind(limit)
      .all()
      .then((r: any) => r.results || r)
      .catch(() => []);

    if (!dirtyRows.length) {
      return 0;
    }

    for (const row of dirtyRows) {
      await this.refreshTrip(row.trip_id);
    }

    const placeholders = dirtyRows.map(() => '?').join(',');
    await this.env.DB
      .prepare(`DELETE FROM trip_search_surface_dirty WHERE trip_id IN (${placeholders})`)
      .bind(...dirtyRows.map((row) => row.trip_id))
      .run();

    return dirtyRows.length;
  }

  async refreshTrip(tripIdInput: number | string): Promise<TripSearchRefreshResult | null> {
    const tripId = Number(tripIdInput);
    if (Number.isNaN(tripId)) {
      throw new Error(`Invalid trip_id: ${tripIdInput}`);
    }

    const trip: any = await this.env.DB
      .prepare(
        `SELECT t.trip_id, t.trip_name, t.trip_slug, t.status, t.start_date, t.end_date,
                t.destinations, t.primary_client_email,
                c.full_name AS primary_client_name
         FROM trips_v2 t
         LEFT JOIN clients_v2 c ON c.email = t.primary_client_email
         WHERE t.trip_id = ?1`
      )
      .bind(tripId)
      .first();

    if (!trip) {
      await this.env.DB.prepare(`DELETE FROM trip_search_surface WHERE trip_id = ?1`).bind(tripId).run();
      await this.env.DB.prepare(`DELETE FROM trip_search_surface_dirty WHERE trip_id = ?1`).bind(tripId).run();
      return null;
    }

    const travelers: Array<{ email: string; full_name?: string }> = await this.env.DB
      .prepare(
        `SELECT a.client_email AS email,
                cv.full_name AS full_name
         FROM trip_client_assignments a
         LEFT JOIN clients_v2 cv ON cv.email = a.client_email
         WHERE a.trip_id = ?1`
      )
      .bind(tripId)
      .all()
      .then((r: any) => r.results || r)
      .catch(() => []);

    const travelerNames = travelers
      .map((traveler) => traveler.full_name || deriveNameFromEmail(traveler.email) || '')
      .filter(Boolean);
    const travelerEmails = travelers
      .map((traveler) => traveler.email || '')
      .filter(Boolean);

    const tokenSources = [
      trip.trip_name,
      trip.trip_slug?.replace(/-/g, ' '),
      trip.destinations,
      trip.status,
      trip.primary_client_name || deriveNameFromEmail(trip.primary_client_email) || undefined,
      trip.primary_client_email,
      ...travelerNames,
      ...travelerEmails,
      String(trip.trip_id)
    ];

    const normalizedTripName = normalizeText(trip.trip_name);
    const normalizedDestinations = normalizeText(trip.destinations);
    const normalizedTravelers = normalizeText(travelerNames.join(' '));
    const normalizedEmails = normalizeText([
      trip.primary_client_email,
      ...travelerEmails
    ].join(' '));

    const tokensSet = new Set<string>();
    tokenSources.forEach((source) => tokenizeText(source).forEach((token) => tokensSet.add(token)));

    // Always include slug tokens if available
    if (trip.trip_slug) {
      trip.trip_slug
        .split('-')
        .map((part: string) => part.trim().toLowerCase())
        .filter(Boolean)
        .forEach((token: string) => tokensSet.add(token));
    }

    if (normalizedTripName) {
      normalizedTripName.split(' ').forEach((token) => tokensSet.add(token));
    }

    const phoneticSet = new Set<string>();
    tokensSet.forEach((token) => {
      generatePhoneticVariants(token).forEach((variant) => {
        if (!tokensSet.has(variant)) {
          phoneticSet.add(variant);
        }
      });
    });

    // Ensure we always have at least the trip name tokenized
    if (tokensSet.size === 0 && trip.trip_name) {
      tokensSet.add(normalizeText(trip.trip_name));
    }

    const tokens = Array.from(tokensSet).filter(Boolean).sort();
    const phoneticTokens = Array.from(phoneticSet).filter(Boolean).sort();

    await this.env.DB
      .prepare(
        `INSERT INTO trip_search_surface (
           trip_id, trip_name, trip_slug, status, start_date, end_date,
           destinations, primary_client_name, primary_client_email,
           traveler_names, traveler_emails,
           normalized_trip_name, normalized_destinations,
           normalized_travelers, normalized_emails,
           search_tokens, phonetic_tokens, last_synced
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, CURRENT_TIMESTAMP)
         ON CONFLICT(trip_id) DO UPDATE SET
           trip_name = excluded.trip_name,
           trip_slug = excluded.trip_slug,
           status = excluded.status,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           destinations = excluded.destinations,
           primary_client_name = excluded.primary_client_name,
           primary_client_email = excluded.primary_client_email,
           traveler_names = excluded.traveler_names,
           traveler_emails = excluded.traveler_emails,
           normalized_trip_name = excluded.normalized_trip_name,
           normalized_destinations = excluded.normalized_destinations,
           normalized_travelers = excluded.normalized_travelers,
           normalized_emails = excluded.normalized_emails,
           search_tokens = excluded.search_tokens,
           phonetic_tokens = excluded.phonetic_tokens,
           last_synced = CURRENT_TIMESTAMP`
      )
      .bind(
        tripId,
        trip.trip_name,
        trip.trip_slug || null,
        trip.status || null,
        trip.start_date || null,
        trip.end_date || null,
        trip.destinations || null,
        trip.primary_client_name || null,
        trip.primary_client_email || null,
        travelerNames.length ? JSON.stringify(travelerNames) : null,
        travelerEmails.length ? JSON.stringify(travelerEmails) : null,
        normalizedTripName || null,
        normalizedDestinations || null,
        normalizedTravelers || null,
        normalizedEmails || null,
        tokens.join(' '),
        phoneticTokens.length ? phoneticTokens.join(' ') : null
      )
      .run();

    await this.env.DB.prepare(`DELETE FROM trip_search_surface_dirty WHERE trip_id = ?1`).bind(tripId).run();

    return {
      tripId,
      tripName: trip.trip_name,
      tokens,
      phoneticTokens
    };
  }

  async refreshAll(limit?: number): Promise<number> {
    const query = limit
      ? `SELECT trip_id FROM trips_v2 ORDER BY trip_id LIMIT ?1`
      : `SELECT trip_id FROM trips_v2 ORDER BY trip_id`;

    const tripIds: Array<{ trip_id: number }> = await this.env.DB
      .prepare(query)
      .bind(...(limit ? [limit] : []))
      .all()
      .then((r: any) => r.results || r)
      .catch(() => []);

    let count = 0;
    for (const row of tripIds) {
      await this.refreshTrip(row.trip_id);
      count++;
    }
    return count;
  }
}
