import { D1Database } from '@cloudflare/workers-types';

export interface TripSurfaceMatch {
  trip_id: number;
  trip_name: string;
  trip_slug?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  destinations?: string | null;
  primary_client_name?: string | null;
  primary_client_email?: string | null;
  traveler_names: string[];
  traveler_emails: string[];
  traveler_count: number;
  score: number;
  matched_tokens: string[];
  match_reasons: string[];
}

export interface TripSurfaceSearchOptions {
  limit?: number;
  candidate_limit?: number;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_CANDIDATE_LIMIT = 25;

function decodeJsonArray(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

function extractEmails(query: string): string[] {
  const matches = query.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function extractNumericIds(tokens: string[]): number[] {
  return tokens
    .map((token) => Number(token))
    .filter((value) => Number.isInteger(value) && value > 0) as number[];
}

function safeSplit(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function computeScore(
  row: any,
  tokens: string[],
  slugCandidate: string | null,
  emailMatches: string[],
  numericIds: number[]
): { score: number; matchedTokens: string[]; reasons: string[] } {
  const matchedTokens = new Set<string>();
  const reasons: string[] = [];
  let score = 0;

  const searchTokenSet = new Set(safeSplit(row.search_tokens));
  const phoneticTokenSet = new Set(safeSplit(row.phonetic_tokens));
  const normalizedTripName = row.normalized_trip_name || '';
  const normalizedDestinations = row.normalized_destinations || '';
  const normalizedTravelers = row.normalized_travelers || '';
  const normalizedEmails = row.normalized_emails || '';

  if (slugCandidate && row.trip_slug && slugCandidate === row.trip_slug.toLowerCase()) {
    score += 160;
    matchedTokens.add(slugCandidate);
    reasons.push('slug_exact');
  }

  for (const id of numericIds) {
    if (Number(row.trip_id) === id) {
      score += 140;
      matchedTokens.add(String(id));
      reasons.push('trip_id_exact');
    }
  }

  for (const email of emailMatches) {
    if (row.primary_client_email && row.primary_client_email.toLowerCase() === email) {
      score += 120;
      matchedTokens.add(email);
      reasons.push('primary_email_exact');
    } else if (row.traveler_emails && row.traveler_emails.toLowerCase().includes(email)) {
      score += 80;
      matchedTokens.add(email);
      reasons.push('traveler_email_match');
    }
  }

  const destinationsLower = (row.destinations || '').toLowerCase();
  const tripNameLower = (row.trip_name || '').toLowerCase();
  const primaryNameLower = (row.primary_client_name || '').toLowerCase();

  for (const token of tokens) {
    if (searchTokenSet.has(token)) {
      score += 22;
      matchedTokens.add(token);
      reasons.push('token_match');
      continue;
    }

    if (phoneticTokenSet.has(token)) {
      score += 14;
      matchedTokens.add(token);
      reasons.push('phonetic_match');
      continue;
    }

    if (normalizedTripName.includes(token)) {
      score += 12;
      matchedTokens.add(token);
      reasons.push('normalized_trip_name');
      continue;
    }

    if (destinationsLower.includes(token) || normalizedDestinations.includes(token)) {
      score += 10;
      matchedTokens.add(token);
      reasons.push('destination_match');
      continue;
    }

    if (normalizedTravelers.includes(token) || (row.traveler_names && row.traveler_names.toLowerCase().includes(token))) {
      score += 9;
      matchedTokens.add(token);
      reasons.push('traveler_match');
      continue;
    }

    if (normalizedEmails.includes(token)) {
      score += 7;
      matchedTokens.add(token);
      reasons.push('email_token');
      continue;
    }

    if (primaryNameLower.includes(token)) {
      score += 6;
      matchedTokens.add(token);
      reasons.push('primary_client_name');
      continue;
    }

    if (tripNameLower.includes(token)) {
      score += 6;
      matchedTokens.add(token);
      reasons.push('trip_name_partial');
    }
  }

  if (row.status && row.status.toLowerCase() === 'confirmed') {
    score += 3;
  }

  const travelerCount = Number(row.traveler_count ?? row.facts_traveler_count ?? 0);
  if (travelerCount > 0) {
    score += Math.min(travelerCount, 5);
  }

  return {
    score,
    matchedTokens: Array.from(matchedTokens),
    reasons
  };
}

export async function searchTripSurface(
  db: D1Database,
  query: string,
  options: TripSurfaceSearchOptions = {}
): Promise<TripSurfaceMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const tokens = tokenizeQuery(trimmed);
  const emailMatches = extractEmails(trimmed);
  const slugCandidate = trimmed.toLowerCase().replace(/\s+/g, '-');
  const numericIds = extractNumericIds(tokens);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const candidateLimit = options.candidate_limit ?? DEFAULT_CANDIDATE_LIMIT;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (slugCandidate) {
    whereClauses.push('LOWER(tss.trip_slug) = ?');
    params.push(slugCandidate);
  }

  if (numericIds.length > 0) {
    const placeholders = numericIds.map(() => '?').join(',');
    whereClauses.push(`tss.trip_id IN (${placeholders})`);
    params.push(...numericIds);
  }

  if (emailMatches.length > 0) {
    for (const email of emailMatches) {
      whereClauses.push('(LOWER(tss.primary_client_email) = ? OR LOWER(coalesce(tss.traveler_emails, "")) LIKE ?)');
      params.push(email, `%${email}%`);
    }
  }

  if (tokens.length > 0) {
    const tokenOrs: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      tokenOrs.push(`(
        LOWER(tss.trip_name) LIKE ? OR
        LOWER(coalesce(tss.destinations, "")) LIKE ? OR
        tss.search_tokens LIKE ? OR
        coalesce(tss.phonetic_tokens, "") LIKE ? OR
        coalesce(tss.normalized_trip_name, "") LIKE ? OR
        coalesce(tss.normalized_destinations, "") LIKE ? OR
        coalesce(tss.normalized_travelers, "") LIKE ? OR
        coalesce(tss.normalized_emails, "") LIKE ?
      )`);
      const pattern = `%${tokens[i]}%`;
      params.push(pattern, pattern, `%${tokens[i]}%`, `%${tokens[i]}%`, `%${tokens[i]}%`, `%${tokens[i]}%`, `%${tokens[i]}%`, `%${tokens[i]}%`);
    }
    whereClauses.push(tokenOrs.join(' OR '));
  }

  if (whereClauses.length === 0) {
    whereClauses.push('1=1');
  }

  const sql = `
    SELECT 
      tss.*, 
      tf.traveler_count AS facts_traveler_count,
      tf.traveler_names AS facts_traveler_names,
      tf.traveler_emails AS facts_traveler_emails
    FROM trip_search_surface tss
    LEFT JOIN trip_facts tf ON tf.trip_id = tss.trip_id
    WHERE ${whereClauses.join(' OR ')}
    ORDER BY tss.last_synced DESC
    LIMIT ${candidateLimit}
  `;

  const result = await db.prepare(sql).bind(...params).all();
  const rows = (result as any)?.results || [];

  const matches: TripSurfaceMatch[] = rows.map((row: any) => {
    const factsNames = decodeJsonArray(row.facts_traveler_names);
    const factsEmails = decodeJsonArray(row.facts_traveler_emails);
    const surfaceNames = decodeJsonArray(row.traveler_names);
    const surfaceEmails = decodeJsonArray(row.traveler_emails);
    const travelerNames = factsNames.length ? factsNames : surfaceNames;
    const travelerEmails = factsEmails.length ? factsEmails : surfaceEmails;

    const { score, matchedTokens, reasons } = computeScore(row, tokens, slugCandidate, emailMatches, numericIds);

    return {
      trip_id: Number(row.trip_id),
      trip_name: row.trip_name,
      trip_slug: row.trip_slug,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      destinations: row.destinations,
      primary_client_name: row.primary_client_name,
      primary_client_email: row.primary_client_email,
      traveler_names: travelerNames,
      traveler_emails: travelerEmails,
      traveler_count: Number(row.traveler_count ?? row.facts_traveler_count ?? travelerNames.length),
      score,
      matched_tokens: matchedTokens,
      match_reasons: reasons
    } as TripSurfaceMatch;
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
