import { Env } from '../types';

export interface TripFactsSummary {
  trip_id: number;
  total_nights: number;
  total_hotels: number;
  total_activities: number;
  total_cost: number;
  transit_minutes: number;
  traveler_count: number;
  traveler_names: string[];
  traveler_emails: string[];
  primary_client_email: string | null;
  primary_client_name: string | null;
}

function titleCase(word: string): string {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveNameFromEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }
  const local = email.split('@')[0] || '';
  if (!local) {
    return null;
  }
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (!segments.length) {
    return null;
  }
  return segments.map(titleCase).join(' ');
}

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
      await this.refreshTripFacts(row.trip_id);
      count++;
    }

    // Clear processed dirty entries for refreshed trips
    if (dirty.length) {
      const ids = dirty.map((d) => Number(d.trip_id));
      const placeholders = ids.map(() => '?').join(',');
      await this.env.DB
        .prepare(`DELETE FROM facts_dirty WHERE trip_id IN (${placeholders})`)
        .bind(...ids)
        .run();
    }
    return count;
  }

  async refreshTripFacts(tripIdInput: string | number): Promise<TripFactsSummary | null> {
    const tripId = Number(tripIdInput);
    if (Number.isNaN(tripId)) {
      throw new Error(`Invalid trip_id: ${tripIdInput}`);
    }

    const tripRow: any = await this.env.DB
      .prepare(
        `SELECT trip_id, trip_name, primary_client_email, start_date, end_date
         FROM trips_v2
         WHERE trip_id = ?1`
      )
      .bind(tripId)
      .first();

    if (!tripRow) {
      await this.env.DB.prepare(`DELETE FROM trip_facts WHERE trip_id = ?1`).bind(tripId).run();
      return null;
    }

    const primaryClientEmail: string | null = tripRow.primary_client_email || null;
    let primaryClientName: string | null = null;
    if (primaryClientEmail) {
      const nameRow: any = await this.env.DB
        .prepare(`SELECT full_name FROM clients_v2 WHERE email = ?1`)
        .bind(primaryClientEmail)
        .first();
      primaryClientName =
        (nameRow?.full_name as string | undefined)?.trim() ||
        primaryClientName ||
        deriveNameFromEmail(primaryClientEmail);
    }

    const travelerRows: Array<{ email: string; full_name?: string | null }> = await this.env.DB
      .prepare(
        `SELECT a.client_email AS email,
                cv.full_name AS full_name
         FROM trip_client_assignments a
         LEFT JOIN clients_v2 cv ON cv.email = a.client_email
         WHERE a.trip_id = ?1`
      )
      .bind(tripId)
      .all()
      .then((r: any) => r.results || r)
      .catch(() => []);

    const travelerEmails: string[] = [];
    const travelerNames: string[] = [];
    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    for (const traveler of travelerRows) {
      if (traveler.email) {
        const lower = traveler.email.toLowerCase();
        if (!seenEmails.has(lower)) {
          seenEmails.add(lower);
          travelerEmails.push(traveler.email);
        }
      }
      const normalizedName =
        (traveler.full_name as string | undefined)?.trim() ||
        deriveNameFromEmail(traveler.email) ||
        '';
      if (normalizedName) {
        const nameKey = normalizedName.toLocaleLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          travelerNames.push(normalizedName);
        }
      }
    }

    if (primaryClientEmail) {
      const lower = primaryClientEmail.toLowerCase();
      if (!seenEmails.has(lower)) {
        seenEmails.add(lower);
        travelerEmails.push(primaryClientEmail);
      }
    }

    if (primaryClientName) {
      const nameKey = primaryClientName.toLocaleLowerCase();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        travelerNames.push(primaryClientName);
      }
    }

    const travelerCount = travelerEmails.length;

    // Compute metrics from available tables (defensive if optional tables absent)
    const total_nights = await this.scalar(
      `SELECT COALESCE(MAX(day_number) - MIN(day_number) + 1, 0) AS n FROM TripDays WHERE trip_id = ?1`,
      [tripId]
    );

    // Fallback to trip duration if TripDays are missing
    let nights = total_nights;
    if (!nights && tripRow.start_date && tripRow.end_date) {
      const startParts = String(tripRow.start_date)
        .split('-')
        .map((part: string) => Number(part));
      const endParts = String(tripRow.end_date)
        .split('-')
        .map((part: string) => Number(part));
      if (startParts.length === 3 && endParts.length === 3) {
        const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
        const endUtc = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
        if (!Number.isNaN(startUtc) && !Number.isNaN(endUtc) && endUtc >= startUtc) {
          const diffDays = Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
          nights = diffDays > 0 ? diffDays : 0;
        }
      }
    }

    const total_activities = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COUNT(1) FROM trip_activities_enhanced WHERE trip_id = ?1`,
            [tripId]
          )
        : 0
    );

    const total_hotels = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COUNT(1) FROM trip_activities_enhanced WHERE trip_id = ?1 AND LOWER(activity_type) IN ('hotel','lodging')`,
            [tripId]
          )
        : 0
    );

    const total_cost = await this.scalar(
      `SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='trip_activities_enhanced'`
    ).then(async (exists) =>
      exists
        ? this.scalar(
            `SELECT COALESCE(SUM(cost),0) FROM trip_activities_enhanced WHERE trip_id = ?1`,
            [tripId]
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
            [tripId]
          )
        : 0
    );

    await this.env.DB
      .prepare(
        `INSERT INTO trip_facts(
           trip_id,
           total_nights,
           total_hotels,
           total_activities,
           total_cost,
           transit_minutes,
           traveler_count,
           traveler_names,
           traveler_emails,
           primary_client_email,
           primary_client_name,
           last_computed,
           version
         )
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP, 1)
         ON CONFLICT(trip_id) DO UPDATE SET
           total_nights=excluded.total_nights,
           total_hotels=excluded.total_hotels,
           total_activities=excluded.total_activities,
           total_cost=excluded.total_cost,
           transit_minutes=excluded.transit_minutes,
           traveler_count=excluded.traveler_count,
           traveler_names=excluded.traveler_names,
           traveler_emails=excluded.traveler_emails,
           primary_client_email=excluded.primary_client_email,
           primary_client_name=excluded.primary_client_name,
           last_computed=CURRENT_TIMESTAMP`
      )
      .bind(
        tripId,
        nights,
        total_hotels,
        total_activities,
        total_cost,
        transit_minutes,
        travelerCount,
        travelerNames.length ? JSON.stringify(travelerNames) : null,
        travelerEmails.length ? JSON.stringify(travelerEmails) : null,
        primaryClientEmail,
        primaryClientName
      )
      .run();

    return {
      trip_id: tripId,
      total_nights: nights,
      total_hotels,
      total_activities,
      total_cost,
      transit_minutes,
      traveler_count: travelerCount,
      traveler_names: travelerNames,
      traveler_emails: travelerEmails,
      primary_client_email: primaryClientEmail,
      primary_client_name: primaryClientName
    };
  }

  private async scalar(sql: string, args: any[] = []): Promise<number> {
    const row: any = await this.env.DB.prepare(sql).bind(...args).first();
    const val = row && Object.values(row)[0];
    return typeof val === 'number' ? val : Number(val || 0) || 0;
  }
}
