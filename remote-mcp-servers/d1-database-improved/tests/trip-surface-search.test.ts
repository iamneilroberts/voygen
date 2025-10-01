import { describe, it, expect } from 'vitest';
import { searchTripSurface } from '../src/utils/trip-surface-search';
import type { D1Database } from '@cloudflare/workers-types';

class MockPreparedStatement {
  constructor(private rows: any[]) {}

  bind(..._args: any[]) {
    return {
      all: async () => ({ results: this.rows }),
      first: async () => (this.rows.length ? this.rows[0] : null)
    };
  }
}

class MockD1Database implements D1Database {
  constructor(private rows: any[]) {}

  prepare(_query: string) {
    return new MockPreparedStatement(this.rows);
  }

  // Unused interface members
  batch() {
    throw new Error('Not implemented in mock');
  }

  dump() {
    throw new Error('Not implemented in mock');
  }
}

describe('searchTripSurface', () => {
  const baseRow = {
    trip_id: 1,
    trip_name: 'European Adventure - Dublin, London & Stoneleigh',
    trip_slug: 'european-adventure-dublin-london-stoneleigh-2025',
    status: 'confirmed',
    start_date: '2025-09-18',
    end_date: '2025-09-28',
    destinations: 'Dublin, London, Stoneleigh',
    primary_client_name: 'Chisholm Family',
    primary_client_email: 'chisholm.family@email.com',
    search_tokens: 'european adventure dublin london stoneleigh chisholm family 1',
    phonetic_tokens: 'stonleigh chisolm chissom',
    normalized_trip_name: 'european adventure dublin london stoneleigh',
    normalized_destinations: 'dublin london stoneleigh',
    normalized_travelers: 'chisholm family',
    normalized_emails: 'chisholm family@email.com',
    traveler_names: JSON.stringify(['Chisholm Family', 'No Email 2']),
    traveler_emails: JSON.stringify(['chisholm.family@email.com', 'no-email-2@example.com']),
    traveler_count: 2,
    facts_traveler_count: 2,
    facts_traveler_names: JSON.stringify(['Chisholm Family', 'No Email 2']),
    facts_traveler_emails: JSON.stringify(['chisholm.family@email.com', 'no-email-2@example.com'])
  };

  const otherRow = {
    trip_id: 2,
    trip_name: 'Scotland Highland Heritage Trip',
    trip_slug: 'scotland-highland-heritage-trip-2025',
    status: 'confirmed',
    start_date: '2025-04-20',
    end_date: '2025-04-29',
    destinations: 'Inverness',
    primary_client_name: 'Neil Roberts',
    primary_client_email: 'neil@example.com',
    search_tokens: 'scotland highland heritage 2025 2',
    phonetic_tokens: 'scotland',
    normalized_trip_name: 'scotland highland heritage trip',
    normalized_destinations: 'inverness',
    normalized_travelers: 'neil roberts',
    normalized_emails: 'neil@example.com',
    traveler_names: JSON.stringify(['Neil Roberts']),
    traveler_emails: JSON.stringify(['neil@example.com']),
    traveler_count: 1,
    facts_traveler_count: 1,
    facts_traveler_names: JSON.stringify(['Neil Roberts']),
    facts_traveler_emails: JSON.stringify(['neil@example.com'])
  };

  it('ranks typos for Chisholm trip using phonetic tokens', async () => {
    const db = new MockD1Database([baseRow, otherRow]);
    const matches = await searchTripSurface(db as unknown as D1Database, 'Chisolm Stoneleigh', { limit: 3 });

    expect(matches.length).toBeGreaterThan(0);
    const best = matches[0];
    expect(best.trip_id).toBe(1);
    expect(best.matched_tokens).toContain('stoneleigh');
    expect(best.match_reasons).toContain('phonetic_match');
    expect(best.traveler_names).toEqual(['Chisholm Family', 'No Email 2']);
  });

  it('prefers exact slug matches over phonetic matches', async () => {
    const db = new MockD1Database([otherRow, baseRow]);
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
});
