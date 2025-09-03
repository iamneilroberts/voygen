import { Env } from '../types';

// Embedded migration SQL content for Cloudflare Workers compatibility
const MIGRATIONS = {
  '001_hotel_cache_tables.sql': `
    -- 001_hotel_cache_tables.sql
    -- Purpose: Add normalized cache tables for hotels and room offers

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS hotel_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_hotel_id TEXT NOT NULL,
      name TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      stars REAL,
      latitude REAL,
      longitude REAL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_json TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_cache_provider_key
      ON hotel_cache(provider, provider_hotel_id);

    CREATE INDEX IF NOT EXISTS idx_hotel_cache_city ON hotel_cache(city);
    CREATE INDEX IF NOT EXISTS idx_hotel_cache_country ON hotel_cache(country);

    CREATE TABLE IF NOT EXISTS rooms_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      room_type TEXT,
      occupancy INTEGER,
      rate_plan TEXT,
      price REAL,
      currency TEXT DEFAULT 'USD',
      refundable BOOLEAN,
      includes_breakfast BOOLEAN,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_json TEXT,
      FOREIGN KEY (hotel_id) REFERENCES hotel_cache(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rooms_cache_hotel ON rooms_cache(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_cache_updated ON rooms_cache(last_updated);

    COMMIT;
  `,
  
  '002_trip_facts_system.sql': `
    -- 002_trip_facts_system.sql
    -- Purpose: Introduce fact table and dirty-tracking for computed trip metrics

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS trip_facts (
      trip_id TEXT PRIMARY KEY,
      total_nights INTEGER DEFAULT 0,
      total_hotels INTEGER DEFAULT 0,
      total_activities INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      transit_minutes INTEGER DEFAULT 0,
      last_computed DATETIME,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS facts_dirty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(trip_id, reason, created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_facts_dirty_trip ON facts_dirty(trip_id);

    -- Triggers to mark facts dirty on relevant table changes
    CREATE TRIGGER IF NOT EXISTS trg_trips_ai_dirty
    AFTER INSERT ON Trips
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_insert');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_trips_au_dirty
    AFTER UPDATE ON Trips
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_update');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_trips_ad_dirty
    AFTER DELETE ON Trips
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.id, 'trip_delete');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_tripdays_ai_dirty
    AFTER INSERT ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_insert');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_tripdays_au_dirty
    AFTER UPDATE ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_update');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_tripdays_ad_dirty
    AFTER DELETE ON TripDays
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'tripday_delete');
    END;

    -- ActivityLog also affects derived metrics
    CREATE TRIGGER IF NOT EXISTS trg_activitylog_ai_dirty
    AFTER INSERT ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_insert');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_activitylog_au_dirty
    AFTER UPDATE ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'activity_update');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_activitylog_ad_dirty
    AFTER DELETE ON ActivityLog
    BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'activity_delete');
    END;

    COMMIT;
  `,
  
  '003_commission_system.sql': `
    -- 003_commission_system.sql
    -- Purpose: Commission rates and rule engine scaffolding

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS commission_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier TEXT,
      product_type TEXT, -- hotel, flight, tour, transfer, package
      rate_type TEXT CHECK(rate_type IN ('percent','fixed')) NOT NULL DEFAULT 'percent',
      rate_value REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      start_date TEXT,
      end_date TEXT,
      active BOOLEAN DEFAULT 1,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_commission_rates_lookup
      ON commission_rates(supplier, product_type, active);

    CREATE TABLE IF NOT EXISTS commission_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      priority INTEGER DEFAULT 100,
      criteria_json TEXT NOT NULL,
      rate_id INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rate_id) REFERENCES commission_rates(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commission_rules_active
      ON commission_rules(active, priority);

    -- Default data
    INSERT INTO commission_rates (supplier, product_type, rate_type, rate_value, notes)
    VALUES
      ('Generic', 'hotel', 'percent', 10.0, 'Default hotel commission'),
      ('Generic', 'tour', 'percent', 12.0, 'Default tour commission')
    ON CONFLICT DO NOTHING;

    INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
    SELECT 'Default hotel rule', 100, '{"product_type":"hotel"}', id, 1
      FROM commission_rates WHERE supplier='Generic' AND product_type='hotel'
    ON CONFLICT DO NOTHING;

    INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
    SELECT 'Default tour rule', 100, '{"product_type":"tour"}', id, 1
      FROM commission_rates WHERE supplier='Generic' AND product_type='tour'
    ON CONFLICT DO NOTHING;

    COMMIT;
  `,
  
  '004_enhanced_trip_structure.sql': `
    -- 004_enhanced_trip_structure.sql
    -- Purpose: Add trip legs and enhanced activities tables

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS trip_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      leg_order INTEGER NOT NULL,
      from_location TEXT,
      to_location TEXT,
      depart_datetime TEXT,
      arrive_datetime TEXT,
      transport_mode TEXT, -- flight, train, car, ferry, walk
      distance_km REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_legs_unique
      ON trip_legs(trip_id, leg_order);

    CREATE INDEX IF NOT EXISTS idx_trip_legs_trip ON trip_legs(trip_id);

    CREATE TABLE IF NOT EXISTS trip_activities_enhanced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      day_id INTEGER, -- optional link to TripDays.id
      activity_type TEXT, -- attraction, tour, meal, transfer, misc
      title TEXT,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      cost REAL,
      currency TEXT DEFAULT 'USD',
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE,
      FOREIGN KEY (day_id) REFERENCES TripDays(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activities_trip ON trip_activities_enhanced(trip_id);
    CREATE INDEX IF NOT EXISTS idx_activities_day ON trip_activities_enhanced(day_id);

    COMMIT;
  `,
  
  '005_proposal_system.sql': `
    -- 005_proposal_system.sql
    -- Purpose: Enhanced proposals with versioning and image attachments

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS proposals_enhanced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'draft', -- draft, sent, accepted, rejected
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_ver
      ON proposals_enhanced(trip_id, version);

    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals_enhanced(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals_enhanced(created_at);

    CREATE TABLE IF NOT EXISTS proposal_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (proposal_id) REFERENCES proposals_enhanced(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_proposal_images_proposal ON proposal_images(proposal_id);

    COMMIT;
  `,
  
  '006_extraction_tracking.sql': `
    -- 006_extraction_tracking.sql
    -- Purpose: Track content extraction sessions and attempts

    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS extraction_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT DEFAULT 'running', -- running, success, failed
      stats_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_extraction_sessions_status ON extraction_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_extraction_sessions_time ON extraction_sessions(started_at);

    CREATE TABLE IF NOT EXISTS extraction_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      item_key TEXT NOT NULL, -- URL or external id
      status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
      error TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      attempts_count INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES extraction_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_session ON extraction_attempts(session_id);
    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_status ON extraction_attempts(status);
    CREATE INDEX IF NOT EXISTS idx_extraction_attempts_item ON extraction_attempts(item_key);

    COMMIT;
  `
};

const MIGRATION_FILES = Object.keys(MIGRATIONS);

export class MigrationRunner {
  constructor(private env: Env) {}

  async ensureTrackingTable(): Promise<void> {
    await this.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }

  async appliedMigrations(): Promise<Set<string>> {
    await this.ensureTrackingTable();
    const rows: { name: string }[] = await this.env.DB.prepare(
      'SELECT name FROM schema_migrations'
    ).all().then((r: any) => r.results || r)
      .catch(() => []);
    return new Set((rows || []).map((r) => r.name));
  }

  async applyPending(): Promise<{ applied: string[] }> {
    const applied = await this.appliedMigrations();
    const did: string[] = [];

    console.log(`Checking migrations. Applied migrations:`, Array.from(applied));
    console.log(`Available migrations:`, MIGRATION_FILES);

    for (const file of MIGRATION_FILES) {
      if (applied.has(file)) {
        console.log(`Migration ${file} already applied, skipping`);
        continue;
      }
      const sql = MIGRATIONS[file as keyof typeof MIGRATIONS];
      if (!sql) {
        console.log(`No SQL content found for ${file}, skipping`);
        continue;
      }
      
      try {
        console.log(`Applying migration ${file}...`);
        await this.executeScript(sql);
        await this.env.DB.prepare('INSERT INTO schema_migrations(name) VALUES (?)').bind(file).run();
        console.log(`Successfully applied migration ${file}`);
        did.push(file);
      } catch (error) {
        console.error(`Failed to apply migration ${file}:`, error);
        throw new Error(`Migration ${file} failed: ${error}`);
      }
    }
    return { applied: did };
  }

  private async executeScript(sql: string) {
    // First, remove transaction control statements entirely
    const cleanedSql = sql
      .replace(/^\s*BEGIN TRANSACTION\s*;?\s*$/gm, '')
      .replace(/^\s*COMMIT\s*;?\s*$/gm, '');
    
    // Split into statements, but handle triggers specially
    const statements: string[] = [];
    let current = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    const lines = cleanedSql.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('--')) continue;
      
      current += line + '\n';
      
      // Track trigger blocks
      if (trimmed.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
        triggerDepth = 0;
      }
      
      if (inTrigger) {
        if (trimmed.toUpperCase() === 'BEGIN') {
          triggerDepth++;
        } else if (trimmed.toUpperCase() === 'END' || trimmed.toUpperCase() === 'END;') {
          triggerDepth--;
          if (triggerDepth <= 0) {
            inTrigger = false;
            // Complete trigger statement
            statements.push(current.trim());
            current = '';
          }
        }
      } else if (trimmed.endsWith(';')) {
        // Regular statement ending with semicolon
        statements.push(current.trim());
        current = '';
      }
    }
    
    // Add any remaining statement
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    for (const stmt of statements) {
      if (!stmt) continue;
      // Remove trailing semicolon for consistency
      const cleanStmt = stmt.replace(/;\s*$/, '');
      if (!cleanStmt.trim()) continue;
      
      try {
        console.log(`Executing: ${cleanStmt.substring(0, 100).replace(/\n/g, ' ')}...`);
        await this.env.DB.prepare(cleanStmt).run();
      } catch (e) {
        console.error(`Failed to execute statement: ${cleanStmt}`);
        console.error(`Error details:`, e);
        throw e;
      }
    }
  }
}

