import { Env } from '../types';

export class FactTableManager {
  constructor(private env: Env) {}

  async refreshDirty(limit = 50): Promise<number> {
    // Pick distinct dirty trips
    const dirty: { trip_id: string }[] = await this.env.DB
      .prepare(
        `SELECT DISTINCT trip_id FROM facts_dirty WHERE trip_id IS NOT NULL LIMIT ?1`
      )
      .bind(limit)
      .all()
      .then((r: any) => r.results || r)
      .catch(() => []);

    let count = 0;
    for (const row of dirty) {
      await this.refreshTrip(row.trip_id);
      count++;
    }

    // Clear processed dirty entries for refreshed trips
    if (dirty.length) {
      const ids = dirty.map((d) => d.trip_id);
      const placeholders = ids.map(() => '?').join(',');
      await this.env.DB
        .prepare(`DELETE FROM facts_dirty WHERE trip_id IN (${placeholders})`)
        .bind(...ids)
        .run();
    }
    return count;
  }

  async refreshTrip(tripId: string): Promise<void> {
    // Compute metrics from available tables (defensive if optional tables absent)
    const total_nights = await this.scalar(
      `SELECT COALESCE(MAX(day_number) - MIN(day_number) + 1, 0) AS n FROM TripDays WHERE trip_id = ?1`,
      [parseInt(tripId)]
    );

    const total_activities = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COUNT(1) FROM trip_activities_enhanced WHERE trip_id = ?1`,
            [parseInt(tripId)]
          )
        : 0
    );

    const total_hotels = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COUNT(1) FROM trip_activities_enhanced WHERE trip_id = ?1 AND LOWER(activity_type) IN ('hotel','lodging')`,
            [parseInt(tripId)]
          )
        : 0
    );

    const total_cost = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COALESCE(SUM(cost),0) FROM trip_activities_enhanced WHERE trip_id = ?1`,
            [parseInt(tripId)]
          )
        : 0
    );

    const transit_minutes = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_legs'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COALESCE(SUM((strftime('%s', arrive_datetime) - strftime('%s', depart_datetime)) / 60), 0)
             FROM trip_legs WHERE trip_id = ?1 AND depart_datetime IS NOT NULL AND arrive_datetime IS NOT NULL`,
            [parseInt(tripId)]
          )
        : 0
    );

    await this.env.DB
      .prepare(
        `INSERT INTO trip_facts(trip_id, total_nights, total_hotels, total_activities, total_cost, transit_minutes, last_computed, version)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP, 1)
         ON CONFLICT(trip_id) DO UPDATE SET
           total_nights=excluded.total_nights,
           total_hotels=excluded.total_hotels,
           total_activities=excluded.total_activities,
           total_cost=excluded.total_cost,
           transit_minutes=excluded.transit_minutes,
           last_computed=CURRENT_TIMESTAMP`
      )
      .bind(parseInt(tripId), total_nights, total_hotels, total_activities, total_cost, transit_minutes)
      .run();
  }

  private async scalar(sql: string, args: any[] = []): Promise<number> {
    const row: any = await this.env.DB.prepare(sql).bind(...args).first();
    const val = row && Object.values(row)[0];
    return typeof val === 'number' ? val : Number(val || 0) || 0;
  }
}

