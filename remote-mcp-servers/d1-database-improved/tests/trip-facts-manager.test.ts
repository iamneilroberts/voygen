import { describe, it, expect, beforeEach } from 'vitest';
import { FactTableManager } from '../src/database/facts';
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
  insertedRow: any = null;

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql);
  }

  async executeFirst(sql: string, args: any[]) {
    if (sql.includes('FROM trips_v2')) {
      return {
        trip_id: Number(args[0]),
        trip_name: 'European Adventure - Dublin, London & Stoneleigh',
        primary_client_email: 'chisholm.family@email.com'
      };
    }

    if (sql.includes('SELECT full_name FROM clients_v2')) {
      return { full_name: 'Stephanie Chisholm' };
    }

    if (sql.includes('TripDays')) {
      return { n: 11 };
    }

    if (sql.includes("sqlite_master") && sql.includes('trip_activities_enhanced')) {
      return { count: 1 };
    }

    if (sql.includes('trip_activities_enhanced') && sql.includes('COUNT(1)') && !sql.includes('LOWER(activity_type)')) {
      return { count: 5 };
    }

    if (sql.includes('trip_activities_enhanced') && sql.includes("LOWER(activity_type)")) {
      return { count: 3 };
    }

    if (sql.includes('COALESCE(SUM(cost)')) {
      return { sum: 4784.04 };
    }

    if (sql.includes('trip_legs')) {
      return { count: 0 };
    }

    return undefined;
  }

  async executeAll(sql: string, args: any[]) {
    if (sql.includes('FROM trip_client_assignments')) {
      return {
        results: [
          { email: 'chisholm.family@email.com', full_name: 'Stephanie Chisholm' },
          { email: 'no-email-2@example.com', full_name: null }
        ]
      };
    }

    return { results: [] };
  }

  async executeRun(sql: string, args: any[]) {
    if (sql.startsWith('INSERT INTO trip_facts')) {
      this.insertedRow = args;
    }
  }
}

describe('FactTableManager', () => {
  let db: MockD1Database;
  let env: Env;
  let manager: FactTableManager;

  beforeEach(() => {
    db = new MockD1Database();
    env = { DB: db as any, MCP_AUTH_KEY: 'test' };
    manager = new FactTableManager(env);
  });

  it('computes traveler details and aggregates when refreshing trip facts', async () => {
    const summary = await manager.refreshTripFacts(1);

    expect(summary).not.toBeNull();
    expect(summary!.trip_id).toBe(1);
    expect(summary!.total_nights).toBe(11);
    expect(summary!.total_hotels).toBe(3);
    expect(summary!.total_cost).toBeCloseTo(4784.04);
    expect(summary!.total_activities).toBe(5);
    expect(summary!.traveler_count).toBe(2);
    expect(summary!.traveler_names).toEqual(['Stephanie Chisholm', 'No Email 2']);
    expect(summary!.traveler_emails).toEqual(['chisholm.family@email.com', 'no-email-2@example.com']);
    expect(summary!.primary_client_email).toBe('chisholm.family@email.com');
    expect(summary!.primary_client_name).toBe('Stephanie Chisholm');

    // Verify DB insert call includes JSON-encoded traveler data
    expect(db.insertedRow).not.toBeNull();
    const [tripId, totalNights, totalHotels, totalActivities, totalCost, transitMinutes, travelerCount, travelerNamesJson, travelerEmailsJson, primaryEmail, primaryName] = db.insertedRow;
    expect(tripId).toBe(1);
    expect(totalNights).toBe(11);
    expect(totalHotels).toBe(3);
    expect(totalActivities).toBe(5);
    expect(totalCost).toBeCloseTo(4784.04);
    expect(transitMinutes).toBe(0);
    expect(travelerCount).toBe(2);
    expect(JSON.parse(travelerNamesJson)).toEqual(['Stephanie Chisholm', 'No Email 2']);
    expect(JSON.parse(travelerEmailsJson)).toEqual(['chisholm.family@email.com', 'no-email-2@example.com']);
    expect(primaryEmail).toBe('chisholm.family@email.com');
    expect(primaryName).toBe('Stephanie Chisholm');
  });
});
