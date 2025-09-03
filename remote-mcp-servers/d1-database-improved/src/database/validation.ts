import { Env, ToolResponse } from '../types';

export class SchemaValidator {
  constructor(private env: Env) {}

  async checkTables(expected: string[]): Promise<{ missing: string[] }> {
    const rows: any = await this.env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    const have = new Set<string>((rows.results || rows).map((r: any) => r.name));
    const missing = expected.filter((t) => !have.has(t));
    return { missing };
  }

  async currentVersion(): Promise<number> {
    const row: any = await this.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='schema_migrations'`
    ).first();
    if (!row || !row.n) return 0;
    const r2: any = await this.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM schema_migrations`
    ).first();
    return r2?.n || 0;
  }

  async validate(): Promise<ToolResponse> {
    const expected = [
      'hotel_cache', 'rooms_cache',
      'trip_facts', 'facts_dirty',
      'commission_rates', 'commission_rules',
      'trip_legs', 'trip_activities_enhanced',
      'proposals_enhanced', 'proposal_images',
      'extraction_sessions', 'extraction_attempts'
    ];
    const { missing } = await this.checkTables(expected);
    // Index checks (best-effort)
    const expectedIndexes = [
      'idx_hotel_cache_provider_key', 'idx_rooms_cache_hotel',
      'idx_facts_dirty_trip', 'idx_trip_legs_trip',
      'idx_proposals_ver', 'idx_extraction_attempts_session'
    ];
    const idxRows: any = await this.env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all();
    const haveIdx = new Set<string>((idxRows.results || idxRows).map((r: any) => r.name));
    const missingIdx = expectedIndexes.filter((n) => !haveIdx.has(n));
    const version = await this.currentVersion();
    const ok = missing.length === 0 && missingIdx.length === 0;
    return {
      content: [{
        type: 'text',
        text: `${ok ? '✅' : '⚠️'} Schema version: ${version}. Missing tables: ${missing.join(', ') || 'none'}; Missing indexes: ${missingIdx.join(', ') || 'none'}`
      }]
    };
  }
}
