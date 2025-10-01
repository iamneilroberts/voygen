import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importTripPageTool } from '../src/tools/import-tools';
import type { D1Database } from '@cloudflare/workers-types';

class MockRunResult { constructor(public success = true, public lastId = 0) {}
  get meta() { return { last_row_id: this.lastId }; }
}

class MockStmt {
  constructor(private db: MockDB, private sql: string) {}
  private args: any[] = [];
  bind(...args: any[]) { this.args = args; return this; }
  async first() { return this.db.first(this.sql, this.args); }
  async all() { return { results: this.db.all(this.sql, this.args) }; }
  async run() { return this.db.run(this.sql, this.args); }
}

class MockDB implements D1Database {
  docs: any[] = [];
  trips = new Map<number, any>([[1, { documents: '[]' }]]);
  activity: any[] = [];
  lastId = 100;

  prepare(sql: string): any { return new MockStmt(this, sql); }
  dump(): any { throw new Error('not implemented'); }
  batch(): any { throw new Error('not implemented'); }

  first(sql: string, args: any[]) {
    if (sql.includes('FROM trips_v2 WHERE trip_id =')) {
      const t = this.trips.get(Number(args[0]));
      return t ? { documents: t.documents } : null;
    }
    if (sql.includes('FROM trips_v2 WHERE LOWER(trip_slug)')) return null;
    return null;
  }
  all(sql: string, _args: any[]) { return []; }
  run(sql: string, args: any[]) {
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS trip_external_docs')) return new MockRunResult(true, 0);
    if (sql.startsWith('DELETE FROM trip_external_docs')) return new MockRunResult(true, 0);
    if (sql.startsWith('INSERT INTO trip_external_docs')) {
      this.lastId += 1;
      this.docs.push({ trip_id: args[0], url: args[1], html: args[4], text: args[5] });
      return new MockRunResult(true, this.lastId);
    }
    if (sql.startsWith('UPDATE trips_v2 SET documents')) {
      const json = args[0];
      const id = Number(args[1]);
      const t = this.trips.get(id); if (t) t.documents = json;
      return new MockRunResult(true, 0);
    }
    if (sql.startsWith('INSERT INTO ActivityLog')) { this.activity.push({}); return new MockRunResult(true, 0); }
    return new MockRunResult(true, 0);
  }
}

describe('import_trip_page', () => {
  let db: MockDB;
  const sampleHtml = '<html><head><title>Test</title></head><body><h1>Trip A</h1><p>Details</p></body></html>';

  beforeEach(() => {
    db = new MockDB();
    globalThis.fetch = vi.fn(async () => new Response(sampleHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })) as any;
  });

  it('fetches a URL and stores HTML + text + doc reference', async () => {
    const result: any = await importTripPageTool.handler({ trip_id: 1, url: 'https://example.com/demo', save_raw_html: true, save_text: true }, db as unknown as D1Database);
    expect(result.success).toBe(true);
    expect(db.docs.length).toBe(1);
    const stored = db.docs[0];
    expect(stored.html).toContain('<h1>Trip A</h1>');
    expect(stored.text).toContain('Trip A');
    const docRef = JSON.parse(db.trips.get(1).documents);
    expect(Array.isArray(docRef)).toBe(true);
    expect(docRef[0].url).toBe('https://example.com/demo');
    expect(result.doc_id).toBeGreaterThan(0);
  });
});
