import { describe, it, expect, beforeEach } from 'vitest';
import { TripSearchSurfaceManager } from '../src/database/tripSearchSurface';
import type { Env } from '../src/types';

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

class MockD1Database {
  trips = new Map<number, any>();
  assignments: Array<{ trip_id: number; client_email: string }> = [];
  clients = new Map<string, { full_name?: string }>();
  searchSurfaceRows = new Map<number, any>();
  dirtyRows: Array<{ trip_id: number; reason?: string }> = [];

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql);
  }

  async executeFirst(sql: string, args: any[]) {
    if (sql.includes('FROM trips_v2')) {
      const id = Number(args[0]);
      return this.trips.get(id) || undefined;
    }
    return undefined;
  }

  async executeAll(sql: string, args: any[]) {
    if (sql.includes('FROM trip_client_assignments')) {
      const tripId = Number(args[0]);
      const rows = this.assignments
        .filter((assignment) => assignment.trip_id === tripId)
        .map((assignment) => ({
          email: assignment.client_email,
          full_name: this.clients.get(assignment.client_email)?.full_name || null
        }));
      return { results: rows };
    }

    if (sql.includes('trip_search_surface_dirty')) {
      const limit = args[0] ?? this.dirtyRows.length;
      const rows = this.dirtyRows.slice(0, limit).map((row) => ({ trip_id: row.trip_id }));
      return { results: rows };
    }

    if (sql.includes('SELECT trip_id FROM trips_v2')) {
      const limit = args[0];
      const rows = Array.from(this.trips.values())
        .sort((a, b) => a.trip_id - b.trip_id)
        .slice(limit ? 0 : undefined, limit ? limit : undefined)
        .map((trip) => ({ trip_id: trip.trip_id }));
      return { results: rows };
    }

    return { results: [] };
  }

  async executeRun(sql: string, args: any[]) {
    if (sql.startsWith('INSERT INTO trip_search_surface_dirty')) {
      const [trip_id, reason] = args;
      this.dirtyRows.push({ trip_id: Number(trip_id), reason });
      return;
    }

    if (sql.startsWith('DELETE FROM trip_search_surface WHERE')) {
      const [trip_id] = args;
      this.searchSurfaceRows.delete(Number(trip_id));
      return;
    }

    if (sql.startsWith('DELETE FROM trip_search_surface_dirty WHERE')) {
      const ids = args.map((id) => Number(id));
      this.dirtyRows = this.dirtyRows.filter((row) => !ids.includes(row.trip_id));
      return;
    }

    if (sql.startsWith('INSERT INTO trip_search_surface')) {
      const [
        tripId,
        tripName,
        tripSlug,
        status,
        startDate,
        endDate,
        destinations,
        primaryClientName,
        primaryClientEmail,
        travelerNames,
        travelerEmails,
        normalizedTripName,
        normalizedDestinations,
        normalizedTravelers,
        normalizedEmails,
        searchTokens,
        phoneticTokens
      ] = args;

      this.searchSurfaceRows.set(Number(tripId), {
        tripId: Number(tripId),
        tripName,
        tripSlug,
        status,
        startDate,
        endDate,
        destinations,
        primaryClientName,
        primaryClientEmail,
        travelerNames,
        travelerEmails,
        normalizedTripName,
        normalizedDestinations,
        normalizedTravelers,
        normalizedEmails,
        searchTokens,
        phoneticTokens
      });
      return;
    }
  }
}

describe('TripSearchSurfaceManager', () => {
  let db: MockD1Database;
  let env: Env;
  let manager: TripSearchSurfaceManager;

  beforeEach(() => {
    db = new MockD1Database();

    db.trips.set(1, {
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

    db.assignments.push(
      { trip_id: 1, client_email: 'chisholm.family@email.com' },
      { trip_id: 1, client_email: 'no-email-2@example.com' }
    );

    db.clients.set('chisholm.family@email.com', { full_name: 'Chisholm Family' });
    // second traveler missing full_name

    env = { DB: db, MCP_AUTH_KEY: 'test' };
    manager = new TripSearchSurfaceManager(env);
  });

  it('generates normalized tokens and phonetic variants for trip data', async () => {
    const result = await manager.refreshTrip(1);

    expect(result).not.toBeNull();
    expect(result!.tokens).toContain('chisholm');
    expect(result!.tokens).toContain('stoneleigh');
    expect(result!.phoneticTokens).toContain('chisolm');

    const stored = db.searchSurfaceRows.get(1);
    expect(stored).toBeDefined();
    expect(stored!.travelerNames).toBe(JSON.stringify(['Chisholm Family', 'No Email 2']));
    expect(stored!.searchTokens.split(' ')).toContain('stoneleigh');
  });

  it('refreshDirty processes queued trip ids and clears dirty table', async () => {
    db.trips.set(2, {
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

    db.assignments.push({ trip_id: 2, client_email: 'neil@example.com' });
    db.clients.set('neil@example.com', { full_name: 'Neil Roberts' });

    db.dirtyRows.push({ trip_id: 1 }, { trip_id: 2 });

    const processed = await manager.refreshDirty();

    expect(processed).toBe(2);
    expect(db.dirtyRows.length).toBe(0);
    expect(db.searchSurfaceRows.has(1)).toBe(true);
    expect(db.searchSurfaceRows.has(2)).toBe(true);
  });
});
