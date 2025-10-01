import { describe, it, expect, beforeEach } from 'vitest';
import { TripSearchSurfaceManager } from '../src/database/tripSearchSurface';
import { FactTableManager } from '../src/database/facts';
import { searchTripSurface } from '../src/utils/trip-surface-search';
import { handleRefreshTripSearchSurface } from '../src/tools/search-surface';
import type { Env } from '../src/types';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Integration Test Suite for TASK-0074, TASK-0075, and TASK-0076
 *
 * This test suite validates the implementation of:
 * - TASK-0074: Unified Trip Search Surface (trip_search_surface table)
 * - TASK-0075: Trip Facts Aggregation Pipeline (trip_facts table)
 * - TASK-0076: Continue Trip Fuzzy Matching Upgrade (search improvements)
 */

class MockBoundStatement {
  constructor(private db: MockD1Database, private sql: string, private args: any[]) {}

  async first() {
    return this.db.executeFirst(this.sql, this.args);
  }

  async all() {
    return this.db.executeAll(this.sql, this.args);
  }

  async run() {
    return this.db.executeRun(this.sql, this.args);
  }
}

class MockPreparedStatement {
  constructor(private db: MockD1Database, private sql: string) {}

  bind(...args: any[]) {
    return new MockBoundStatement(this.db, this.sql, args);
  }
}

class MockD1Database implements Partial<D1Database> {
  // Test data storage
  trips = new Map<number, any>();
  clients = new Map<string, any>();
  assignments: Array<{ trip_id: number; client_email: string; role?: string }> = [];
  searchSurfaceRows = new Map<number, any>();
  tripFacts = new Map<number, any>();
  dirtyRows: Array<{ trip_id: number; reason?: string }> = [];
  activities: Array<{ trip_id: number; activity_type: string; cost?: number }> = [];
  confirmedItems: Array<{ trip_id: number; cost?: number }> = [];

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql);
  }

  async executeFirst(sql: string, args: any[]) {
    // Trip queries
    if (sql.includes('FROM trips_v2') && sql.includes('WHERE trip_id')) {
      const id = Number(args[0]);
      return this.trips.get(id) || null;
    }

    // Client queries
    if (sql.includes('FROM clients_v2') && sql.includes('WHERE email')) {
      const email = args[0];
      return this.clients.get(email) || { full_name: null };
    }

    // Trip facts queries
    if (sql.includes('FROM trip_facts') && sql.includes('WHERE trip_id')) {
      const id = Number(args[0]);
      return this.tripFacts.get(id) || null;
    }

    // Search surface queries
    if (sql.includes('FROM trip_search_surface') && sql.includes('WHERE trip_id')) {
      const id = Number(args[0]);
      return this.searchSurfaceRows.get(id) || null;
    }

    // Trip duration calculation (TripDays)
    if (sql.includes('TripDays')) {
      return { n: 11 }; // Default test duration
    }

    // Activity and cost aggregations
    if (sql.includes('trip_activities_enhanced') && sql.includes('COUNT(1)')) {
      if (sql.includes("LOWER(activity_type) = 'hotel'")) {
        return { count: 3 };
      }
      return { count: 5 };
    }

    if (sql.includes('COALESCE(SUM(cost)')) {
      return { sum: 4784.04 };
    }

    if (sql.includes('trip_legs')) {
      return { count: 0 };
    }

    // Table existence checks
    if (sql.includes("sqlite_master") && sql.includes('trip_activities_enhanced')) {
      return { count: 1 };
    }

    return null;
  }

  async executeAll(sql: string, args: any[]) {
    // Trip assignments
    if (sql.includes('FROM trip_client_assignments')) {
      const tripId = args.length > 0 ? Number(args[0]) : null;
      const relevantAssignments = tripId
        ? this.assignments.filter(a => a.trip_id === tripId)
        : this.assignments;

      const results = relevantAssignments.map(assignment => {
        const client = this.clients.get(assignment.client_email);
        return {
          email: assignment.client_email,
          full_name: client?.full_name || null,
          role: assignment.role || 'traveler'
        };
      });
      return { results };
    }

    // Dirty queue processing
    if (sql.includes('trip_search_surface_dirty')) {
      const limit = args[0] ?? this.dirtyRows.length;
      const rows = this.dirtyRows.slice(0, limit).map(row => ({ trip_id: row.trip_id }));
      return { results: rows };
    }

    // All trips query
    if (sql.includes('SELECT trip_id FROM trips_v2')) {
      const limit = args[0];
      const rows = Array.from(this.trips.values())
        .sort((a, b) => a.trip_id - b.trip_id)
        .slice(0, limit || undefined)
        .map(trip => ({ trip_id: trip.trip_id }));
      return { results: rows };
    }

    // Search surface queries with fuzzy matching
    if (sql.includes('FROM trip_search_surface')) {
      const rows = Array.from(this.searchSurfaceRows.values());
      return { results: rows };
    }

    return { results: [] };
  }

  async executeRun(sql: string, args: any[]) {
    // Insert operations
    if (sql.startsWith('INSERT INTO trip_search_surface_dirty')) {
      const [trip_id, reason] = args;
      this.dirtyRows.push({ trip_id: Number(trip_id), reason });
      return;
    }

    if (sql.startsWith('INSERT INTO trip_search_surface')) {
      const [
        tripId, tripName, tripSlug, status, startDate, endDate,
        destinations, primaryClientName, primaryClientEmail,
        travelerNames, travelerEmails, normalizedTripName,
        normalizedDestinations, normalizedTravelers, normalizedEmails,
        searchTokens, phoneticTokens
      ] = args;

      this.searchSurfaceRows.set(Number(tripId), {
        trip_id: Number(tripId),
        trip_name: tripName,
        trip_slug: tripSlug,
        status,
        start_date: startDate,
        end_date: endDate,
        destinations,
        primary_client_name: primaryClientName,
        primary_client_email: primaryClientEmail,
        traveler_names: travelerNames,
        traveler_emails: travelerEmails,
        normalized_trip_name: normalizedTripName,
        normalized_destinations: normalizedDestinations,
        normalized_travelers: normalizedTravelers,
        normalized_emails: normalizedEmails,
        search_tokens: searchTokens,
        phonetic_tokens: phoneticTokens,
        traveler_count: JSON.parse(travelerNames || '[]').length,
        facts_traveler_count: JSON.parse(travelerNames || '[]').length,
        facts_traveler_names: travelerNames,
        facts_traveler_emails: travelerEmails
      });
      return;
    }

    if (sql.startsWith('INSERT INTO trip_facts')) {
      const [
        tripId, totalNights, totalHotels, totalActivities, totalCost,
        transitMinutes, travelerCount, travelerNamesJson, travelerEmailsJson,
        primaryEmail, primaryName
      ] = args;

      this.tripFacts.set(Number(tripId), {
        trip_id: Number(tripId),
        total_nights: totalNights,
        total_hotels: totalHotels,
        total_activities: totalActivities,
        total_cost: totalCost,
        transit_minutes: transitMinutes,
        traveler_count: travelerCount,
        traveler_names: travelerNamesJson,
        traveler_emails: travelerEmailsJson,
        primary_client_email: primaryEmail,
        primary_client_name: primaryName,
        last_computed: new Date().toISOString()
      });
      return;
    }

    // Delete operations
    if (sql.startsWith('DELETE FROM trip_search_surface WHERE')) {
      const [trip_id] = args;
      this.searchSurfaceRows.delete(Number(trip_id));
      return;
    }

    if (sql.startsWith('DELETE FROM trip_search_surface_dirty WHERE')) {
      const ids = args.map(id => Number(id));
      this.dirtyRows = this.dirtyRows.filter(row => !ids.includes(row.trip_id));
      return;
    }
  }

  // Seed test data
  seedTestData() {
    // Test trip: Chisholm family European adventure
    this.trips.set(1, {
      trip_id: 1,
      trip_name: 'European Adventure - Dublin, London & Stoneleigh',
      trip_slug: 'european-adventure-dublin-london-stoneleigh-2025',
      status: 'confirmed',
      start_date: '2025-09-18',
      end_date: '2025-09-28',
      destinations: 'Dublin, London, Stoneleigh',
      primary_client_email: 'chisholm.family@email.com',
      primary_client_name: 'Stephanie Chisholm'
    });

    // Test trip: Scotland Highland trip
    this.trips.set(2, {
      trip_id: 2,
      trip_name: 'Scotland Highland Heritage Trip',
      trip_slug: 'scotland-highland-heritage-trip-2025',
      status: 'confirmed',
      start_date: '2025-04-20',
      end_date: '2025-04-29',
      destinations: 'Inverness',
      primary_client_email: 'neil@example.com',
      primary_client_name: 'Neil Roberts'
    });

    // Test clients
    this.clients.set('chisholm.family@email.com', {
      full_name: 'Stephanie Chisholm',
      email: 'chisholm.family@email.com'
    });
    this.clients.set('no-email-2@example.com', {
      full_name: null,
      email: 'no-email-2@example.com'
    });
    this.clients.set('neil@example.com', {
      full_name: 'Neil Roberts',
      email: 'neil@example.com'
    });

    // Test assignments
    this.assignments.push(
      { trip_id: 1, client_email: 'chisholm.family@email.com', role: 'primary_traveler' },
      { trip_id: 1, client_email: 'no-email-2@example.com', role: 'traveler' },
      { trip_id: 2, client_email: 'neil@example.com', role: 'primary_traveler' }
    );

    // Test activities and costs
    this.activities.push(
      { trip_id: 1, activity_type: 'hotel', cost: 1500 },
      { trip_id: 1, activity_type: 'hotel', cost: 1200 },
      { trip_id: 1, activity_type: 'hotel', cost: 900 },
      { trip_id: 1, activity_type: 'tour', cost: 300 },
      { trip_id: 1, activity_type: 'dining', cost: 884.04 }
    );
  }
}

describe('TASK-0074: Unified Trip Search Surface', () => {
  let db: MockD1Database;
  let env: Env;
  let searchSurfaceManager: TripSearchSurfaceManager;

  beforeEach(() => {
    db = new MockD1Database();
    db.seedTestData();
    env = { DB: db as any, MCP_AUTH_KEY: 'test' };
    searchSurfaceManager = new TripSearchSurfaceManager(env);
  });

  it('creates search surface with normalized tokens and phonetic variants', async () => {
    const result = await searchSurfaceManager.refreshTrip(1);

    expect(result).not.toBeNull();
    expect(result!.tripName).toBe('European Adventure - Dublin, London & Stoneleigh');
    expect(result!.tokens).toContain('chisholm');
    expect(result!.tokens).toContain('stoneleigh');
    expect(result!.phoneticTokens).toContain('chisolm'); // Phonetic variant
    expect(result!.phoneticTokens).toContain('stonleigh'); // Phonetic variant

    const stored = db.searchSurfaceRows.get(1);
    expect(stored).toBeDefined();
    expect(stored!.search_tokens.split(' ')).toContain('stoneleigh');
    expect(stored!.phonetic_tokens.split(' ')).toContain('chisolm');
  });

  it('includes traveler information in search surface', async () => {
    await searchSurfaceManager.refreshTrip(1);

    const stored = db.searchSurfaceRows.get(1);
    expect(stored).toBeDefined();

    const travelerNames = JSON.parse(stored!.traveler_names);
    const travelerEmails = JSON.parse(stored!.traveler_emails);

    expect(travelerNames).toContain('Stephanie Chisholm');
    expect(travelerNames).toContain('No Email 2'); // Fallback name
    expect(travelerEmails).toContain('chisholm.family@email.com');
    expect(travelerEmails).toContain('no-email-2@example.com');
  });

  it('processes dirty queue and synchronizes changes', async () => {
    // Add trips to dirty queue
    db.dirtyRows.push({ trip_id: 1 }, { trip_id: 2 });

    const processed = await searchSurfaceManager.refreshDirty();

    expect(processed).toBe(2);
    expect(db.dirtyRows.length).toBe(0); // Queue should be cleared
    expect(db.searchSurfaceRows.has(1)).toBe(true);
    expect(db.searchSurfaceRows.has(2)).toBe(true);
  });

  it('handles MCP tool interface correctly', async () => {
    const response = await handleRefreshTripSearchSurface(searchSurfaceManager, {
      trip_id: 1
    });

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe('text');

    const result = JSON.parse(response.content[0].text);
    expect(result.refreshed).toBe(1);
    expect(result.mode).toBe('single');
    expect(result.trip_id).toBe(1);
  });
});

describe('TASK-0075: Trip Facts Aggregation Pipeline', () => {
  let db: MockD1Database;
  let env: Env;
  let factManager: FactTableManager;

  beforeEach(() => {
    db = new MockD1Database();
    db.seedTestData();
    env = { DB: db as any, MCP_AUTH_KEY: 'test' };
    factManager = new FactTableManager(env);
  });

  it('aggregates trip facts correctly', async () => {
    const summary = await factManager.refreshTripFacts(1);

    expect(summary).not.toBeNull();
    expect(summary!.trip_id).toBe(1);
    expect(summary!.total_nights).toBe(11);
    expect(summary!.total_hotels).toBe(3);
    expect(summary!.total_activities).toBe(5);
    expect(summary!.total_cost).toBeCloseTo(4784.04);
    expect(summary!.traveler_count).toBe(2);
    expect(summary!.primary_client_email).toBe('chisholm.family@email.com');
    expect(summary!.primary_client_name).toBe('Stephanie Chisholm');
  });

  it('includes traveler details in facts', async () => {
    const summary = await factManager.refreshTripFacts(1);

    expect(summary!.traveler_names).toEqual(['Stephanie Chisholm', 'No Email 2']);
    expect(summary!.traveler_emails).toEqual(['chisholm.family@email.com', 'no-email-2@example.com']);

    // Verify stored JSON format
    const stored = db.tripFacts.get(1);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!.traveler_names)).toEqual(['Stephanie Chisholm', 'No Email 2']);
    expect(JSON.parse(stored!.traveler_emails)).toEqual(['chisholm.family@email.com', 'no-email-2@example.com']);
  });

  it('handles trips with no bookings gracefully', async () => {
    // Create a trip with no activities/costs
    db.trips.set(3, {
      trip_id: 3,
      trip_name: 'Future Trip',
      trip_slug: 'future-trip-2026',
      status: 'planning',
      start_date: '2026-01-01',
      end_date: '2026-01-10',
      destinations: 'TBD',
      primary_client_email: 'future@email.com',
      primary_client_name: 'Future Client'
    });

    const summary = await factManager.refreshTripFacts(3);

    expect(summary).not.toBeNull();
    expect(summary!.trip_id).toBe(3);
    expect(summary!.total_cost).toBe(0);
    expect(summary!.total_hotels).toBe(0);
    expect(summary!.total_activities).toBe(0);
  });
});

describe('TASK-0076: Continue Trip Fuzzy Matching Upgrade', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = new MockD1Database();
    db.seedTestData();

    // Pre-populate search surface for fuzzy matching tests
    db.searchSurfaceRows.set(1, {
      trip_id: 1,
      trip_name: 'European Adventure - Dublin, London & Stoneleigh',
      trip_slug: 'european-adventure-dublin-london-stoneleigh-2025',
      status: 'confirmed',
      start_date: '2025-09-18',
      end_date: '2025-09-28',
      destinations: 'Dublin, London, Stoneleigh',
      primary_client_name: 'Stephanie Chisholm',
      primary_client_email: 'chisholm.family@email.com',
      traveler_names: JSON.stringify(['Stephanie Chisholm', 'No Email 2']),
      traveler_emails: JSON.stringify(['chisholm.family@email.com', 'no-email-2@example.com']),
      search_tokens: 'european adventure dublin london stoneleigh stephanie chisholm family 2025',
      phonetic_tokens: 'chisolm chissom stonleigh',
      normalized_trip_name: 'european adventure dublin london stoneleigh',
      normalized_destinations: 'dublin london stoneleigh',
      normalized_travelers: 'stephanie chisholm no email 2',
      normalized_emails: 'chisholm.family@email.com no-email-2@example.com',
      traveler_count: 2,
      facts_traveler_count: 2,
      facts_traveler_names: JSON.stringify(['Stephanie Chisholm', 'No Email 2']),
      facts_traveler_emails: JSON.stringify(['chisholm.family@email.com', 'no-email-2@example.com'])
    });

    db.searchSurfaceRows.set(2, {
      trip_id: 2,
      trip_name: 'Scotland Highland Heritage Trip',
      trip_slug: 'scotland-highland-heritage-trip-2025',
      status: 'confirmed',
      start_date: '2025-04-20',
      end_date: '2025-04-29',
      destinations: 'Inverness',
      primary_client_name: 'Neil Roberts',
      primary_client_email: 'neil@example.com',
      traveler_names: JSON.stringify(['Neil Roberts']),
      traveler_emails: JSON.stringify(['neil@example.com']),
      search_tokens: 'scotland highland heritage trip neil roberts inverness 2025',
      phonetic_tokens: 'scotland',
      normalized_trip_name: 'scotland highland heritage trip',
      normalized_destinations: 'inverness',
      normalized_travelers: 'neil roberts',
      normalized_emails: 'neil@example.com',
      traveler_count: 1,
      facts_traveler_count: 1,
      facts_traveler_names: JSON.stringify(['Neil Roberts']),
      facts_traveler_emails: JSON.stringify(['neil@example.com'])
    });
  });

  it('resolves typos using phonetic matching (Chisolm → Chisholm)', async () => {
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chisolm Stoneleigh', { limit: 3 });

    expect(matches.length).toBeGreaterThan(0);
    const best = matches[0];
    expect(best.trip_id).toBe(1);
    expect(best.match_reasons).toContain('phonetic_match');
    expect(best.traveler_names).toContain('Stephanie Chisholm');
  });

  it('resolves typos using phonetic matching (Stonleigh → Stoneleigh)', async () => {
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chisholm Stonleigh', { limit: 3 });

    expect(matches.length).toBeGreaterThan(0);
    const best = matches[0];
    expect(best.trip_id).toBe(1);
    expect(best.matched_tokens).toContain('chisholm');
    expect(best.match_reasons).toContain('phonetic_match');
  });

  it('prefers exact slug matches over fuzzy matches', async () => {
    const matches = await searchTripSurface(
      db as unknown as D1Database,
      'european-adventure-dublin-london-stoneleigh-2025',
      { limit: 2 }
    );

    expect(matches.length).toBeGreaterThan(0);
    const best = matches[0];
    expect(best.trip_id).toBe(1);
    expect(best.match_reasons).toContain('slug_exact');
    expect(best.score).toBeGreaterThan(matches[1]?.score || 0);
  });

  it('includes traveler information in search results', async () => {
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chisolm Dublin London', { limit: 1 });

    expect(matches.length).toBeGreaterThan(0);
    const match = matches[0];
    expect(match.trip_id).toBe(1);
    expect(match.traveler_names).toEqual(['Stephanie Chisholm', 'No Email 2']);
    expect(match.traveler_emails).toEqual(['chisholm.family@email.com', 'no-email-2@example.com']);
    expect(match.traveler_count).toBe(2);
  });

  it('handles partial matches and provides suggestions', async () => {
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chis Heritage', { limit: 5 });

    // Should match both trips partially
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Verify that matches include suggestion-worthy information
    matches.forEach(match => {
      expect(match.trip_id).toBeDefined();
      expect(match.trip_name).toBeDefined();
      expect(match.trip_slug).toBeDefined();
      expect(match.traveler_names).toBeDefined();
      expect(match.score).toBeGreaterThan(0);
    });
  });

  it('scores matches correctly based on match quality', async () => {
    // Test exact vs phonetic vs partial matches
    const exactMatches = await searchTripSurface(db as unknown as D1Database, 'Chisholm Stoneleigh', { limit: 3 });
    const phoneticMatches = await searchTripSurface(db as unknown as D1Database, 'Chisolm Stonleigh', { limit: 3 });
    const partialMatches = await searchTripSurface(db as unknown as D1Database, 'Dublin Adventure', { limit: 3 });

    expect(exactMatches[0]?.score).toBeGreaterThan(phoneticMatches[0]?.score || 0);
    expect(phoneticMatches[0]?.score).toBeGreaterThan(partialMatches[0]?.score || 0);
  });
});

describe('Integration: End-to-End Task Validation', () => {
  let db: MockD1Database;
  let env: Env;
  let searchSurfaceManager: TripSearchSurfaceManager;
  let factManager: FactTableManager;

  beforeEach(() => {
    db = new MockD1Database();
    db.seedTestData();
    env = { DB: db as any, MCP_AUTH_KEY: 'test' };
    searchSurfaceManager = new TripSearchSurfaceManager(env);
    factManager = new FactTableManager(env);
  });

  it('complete workflow: refresh facts, update search surface, perform fuzzy search', async () => {
    // Step 1: Refresh trip facts (TASK-0075)
    const factSummary = await factManager.refreshTripFacts(1);
    expect(factSummary).not.toBeNull();
    expect(factSummary!.traveler_count).toBe(2);

    // Step 2: Update search surface (TASK-0074)
    const searchResult = await searchSurfaceManager.refreshTrip(1);
    expect(searchResult).not.toBeNull();
    expect(searchResult!.phoneticTokens).toContain('chisolm');

    // Step 3: Perform fuzzy search (TASK-0076)
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chisolm Dublin London Stonleigh', { limit: 1 });
    expect(matches.length).toBe(1);
    expect(matches[0].trip_id).toBe(1);
    expect(matches[0].traveler_names).toEqual(['Stephanie Chisholm', 'No Email 2']);
  });

  it('handles real-world typo scenarios', async () => {
    // Refresh search surface first
    await searchSurfaceManager.refreshTrip(1);

    // Test various typo combinations that should resolve to Chisholm trip
    const typoQueries = [
      'Chisolm Dublin London Stonleigh',
      'Chissom Stoneleigh Dublin',
      'European Adventure Chisolm',
      'dublin london stonleigh chisholm',
      'CHISOLM STONLEIGH' // Test case insensitivity
    ];

    for (const query of typoQueries) {
      const matches = await searchTripSurface(db as unknown as D1Database, query, { limit: 1 });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].trip_id).toBe(1);
      expect(matches[0].match_reasons.length).toBeGreaterThan(0);
    }
  });

  it('maintains data consistency across all three systems', async () => {
    // Refresh both systems
    await factManager.refreshTripFacts(1);
    await searchSurfaceManager.refreshTrip(1);

    // Verify consistency
    const facts = db.tripFacts.get(1);
    const searchSurface = db.searchSurfaceRows.get(1);

    expect(facts).toBeDefined();
    expect(searchSurface).toBeDefined();

    // Traveler counts should match
    expect(facts!.traveler_count).toBe(searchSurface!.traveler_count);

    // Traveler data should be consistent
    const factsTravelers = JSON.parse(facts!.traveler_names);
    const searchTravelers = JSON.parse(searchSurface!.traveler_names);
    expect(factsTravelers).toEqual(searchTravelers);
  });
});