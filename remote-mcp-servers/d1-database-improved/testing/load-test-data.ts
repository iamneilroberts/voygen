// Test data loader for v2 migration testing
import { D1Database } from '@cloudflare/workers-types';

export async function loadTestData(db: D1Database) {
  // Smith family Hawaii trip
  await db.prepare(`
    INSERT INTO Trips (trip_name, client_name, start_date, end_date, status)
    VALUES ('Smith Family Hawaii Vacation', 'John Smith', '2024-06-15', '2024-06-22', 'confirmed')
  `).run();

  // Johnson Europe tour
  await db.prepare(`
    INSERT INTO Trips (trip_name, client_name, start_date, end_date, status)
    VALUES ('Johnson Europe Tour', 'Sarah Johnson', '2024-09-01', '2024-09-14', 'planning')
  `).run();

  // Corporate retreat
  await db.prepare(`
    INSERT INTO Trips (trip_name, client_name, start_date, end_date, status)
    VALUES ('Tech Corp Annual Retreat', 'Tech Corp HR', '2024-10-20', '2024-10-23', 'quoted')
  `).run();
}