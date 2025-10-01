import { Env } from '../types';

export class TriggerManager {
  constructor(private env: Env) {}

  async deployTripFactsTriggers(): Promise<void> {
    // Recreate trip_facts dirty triggers (guarded by IF NOT EXISTS in SQL)
    const sql = `
    CREATE TRIGGER IF NOT EXISTS trg_trips_ai_dirty
    AFTER INSERT ON Trips BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_insert');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_trips_au_dirty
    AFTER UPDATE ON Trips BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.id, 'trip_update');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_trips_ad_dirty
    AFTER DELETE ON Trips BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.id, 'trip_delete');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_tripdays_ai_dirty
    AFTER INSERT ON TripDays BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_insert');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_tripdays_au_dirty
    AFTER UPDATE ON TripDays BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'tripday_update');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_tripdays_ad_dirty
    AFTER DELETE ON TripDays BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'tripday_delete');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ai_facts
    AFTER INSERT ON trip_client_assignments BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_insert');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_au_facts
    AFTER UPDATE ON trip_client_assignments BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (NEW.trip_id, 'traveler_update');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_trip_client_assignments_ad_facts
    AFTER DELETE ON trip_client_assignments BEGIN
      INSERT INTO facts_dirty(trip_id, reason) VALUES (OLD.trip_id, 'traveler_delete');
    END;`;

    for (const stmt of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
      await this.env.DB.prepare(stmt).run();
    }
  }

  async listTripFactsTriggers(): Promise<{ name: string }[]> {
    const rows: any = await this.env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%dirty%'`
    ).all();
    return (rows.results || rows) as { name: string }[];
  }
}
