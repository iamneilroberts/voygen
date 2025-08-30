import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';

/**
 * Migration tools to transform existing normalized data 
 * into the LLM-optimized denormalized format
 */

export const migrateTripsToV2Tool = {
  name: 'migrate_trips_to_v2',
  description: 'Migrate existing trips from normalized tables to denormalized v2 format',
  inputSchema: z.object({
    trip_id: z.number().optional().describe('Specific trip to migrate, or leave empty for all'),
    dry_run: z.boolean().default(false).describe('Preview migration without making changes')
  }),
  handler: async (input: any, db: D1Database) => {
    const tripFilter = input.trip_id ? 'WHERE t.trip_id = ?' : '';
    const params = input.trip_id ? [input.trip_id] : [];
    
    // Get trips to migrate
    const trips = await db.prepare(`
      SELECT t.*, cg.group_name 
      FROM Trips t
      LEFT JOIN ClientGroups cg ON t.group_id = cg.group_id
      ${tripFilter}
    `).bind(...params).all();

    const results = [];

    for (const trip of trips.results) {
      // Gather all related data
      
      // 1. Get clients
      const clients = await db.prepare(`
        SELECT c.*, cgm.relationship
        FROM Clients c
        JOIN ClientGroupMembers cgm ON c.client_id = cgm.client_id
        JOIN ClientGroups cg ON cgm.group_id = cg.group_id
        WHERE cg.group_id = ?
      `).bind(trip.group_id).all();

      // 2. Get schedule with activities
      const days = await db.prepare(`
        SELECT * FROM TripDays WHERE trip_id = ? ORDER BY day_number
      `).bind(trip.trip_id).all();

      const schedule = [];
      for (const day of days.results) {
        const activities = await db.prepare(`
          SELECT ta.*, d.destination_name
          FROM TripActivities ta
          LEFT JOIN Destinations d ON ta.destination_id = d.destination_id
          WHERE ta.day_id = ?
          ORDER BY ta.start_time
        `).bind(day.day_id).all();

        // Get accommodation for this day
        const accommodation = await db.prepare(`
          SELECT * FROM Accommodations 
          WHERE trip_id = ? AND trip_day_id = ?
        `).bind(trip.trip_id, day.day_id).first();

        schedule.push({
          day_number: day.day_number,
          date: day.date,
          day_name: day.day_name || `Day ${day.day_number}`,
          activities: activities.results.map(a => ({
            time: a.start_time || 'TBD',
            type: a.activity_type,
            title: a.activity_title,
            description: a.description,
            location: a.location_name || a.destination_name,
            is_hidden_gem: a.is_hidden_gem
          })),
          accommodation: accommodation ? {
            name: accommodation.accommodation_name,
            check_in: accommodation.check_in_time,
            check_out: accommodation.check_out_time,
            address: accommodation.address
          } : null,
          notes: day.notes
        });
      }

      // 3. Get all accommodations
      const accommodations = await db.prepare(`
        SELECT * FROM Accommodations WHERE trip_id = ?
      `).bind(trip.trip_id).all();

      // 4. Get all transportation
      const transportation = await db.prepare(`
        SELECT * FROM Transportation WHERE trip_id = ?
        ORDER BY departure_datetime
      `).bind(trip.trip_id).all();

      // 5. Get financial breakdown
      const costs = await db.prepare(`
        SELECT * FROM TripCosts WHERE trip_id = ?
      `).bind(trip.trip_id).all();

      const costBreakdown: any = {};
      costs.results.forEach((cost: any) => {
        if (!costBreakdown[cost.category]) {
          costBreakdown[cost.category] = 0;
        }
        costBreakdown[cost.category] += cost.total_cost;
      });

      // 6. Get documents
      const documents = await db.prepare(`
        SELECT * FROM Documents WHERE trip_id = ?
      `).bind(trip.trip_id).all();

      // Build the denormalized record
      const v2Record = {
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        status: trip.status,
        clients: clients.results.map((c: any) => ({
          client_id: c.client_id,
          name: `${c.first_name} ${c.last_name}`,
          email: c.email,
          role: c.relationship || 'traveler',
          preferences: c.preferences ? JSON.parse(c.preferences) : {}
        })),
        primary_client_email: clients.results[0]?.email,
        group_name: trip.group_name,
        schedule: schedule,
        accommodations: accommodations.results,
        transportation: transportation.results,
        financials: {
          quoted_total: trip.total_cost,
          paid_amount: trip.paid_amount,
          balance_due: trip.balance_due,
          currency: trip.currency || 'USD',
          breakdown: costBreakdown,
          payment_history: []
        },
        documents: documents.results.map((d: any) => ({
          type: d.type,
          name: d.name,
          url: d.file_path || d.github_url,
          uploaded_date: d.upload_date
        })),
        notes: {
          agent_notes: trip.notes,
          special_requests: trip.special_requests
        },
        start_date: trip.start_date,
        end_date: trip.end_date,
        destinations: [...new Set(schedule.flatMap((d: any) => 
          d.activities.map((a: any) => a.location).filter(Boolean)
        ))].join(', '),
        total_cost: trip.total_cost,
        paid_amount: trip.paid_amount,
        search_text: `${trip.trip_name} ${clients.results.map((c: any) => 
          `${c.first_name} ${c.last_name} ${c.email}`).join(' ')} ${
          schedule.map((d: any) => d.activities.map((a: any) => a.title).join(' ')).join(' ')
        }`.toLowerCase()
      };

      if (!input.dry_run) {
        // Insert into v2 table
        await db.prepare(`
          INSERT INTO trips_v2 (
            trip_id, trip_name, status, clients, primary_client_email,
            group_name, schedule, accommodations, transportation,
            financials, documents, notes, start_date, end_date,
            destinations, total_cost, paid_amount, search_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          v2Record.trip_id,
          v2Record.trip_name,
          v2Record.status,
          JSON.stringify(v2Record.clients),
          v2Record.primary_client_email,
          v2Record.group_name,
          JSON.stringify(v2Record.schedule),
          JSON.stringify(v2Record.accommodations),
          JSON.stringify(v2Record.transportation),
          JSON.stringify(v2Record.financials),
          JSON.stringify(v2Record.documents),
          JSON.stringify(v2Record.notes),
          v2Record.start_date,
          v2Record.end_date,
          v2Record.destinations,
          v2Record.total_cost,
          v2Record.paid_amount,
          v2Record.search_text
        ).run();

        // Also create the formatted context
        const formatted = await generateFormattedContext(v2Record);
        await db.prepare(`
          INSERT INTO llm_trip_context (
            natural_key, formatted_response, raw_data, 
            search_keywords, context_type, relevance_date
          ) VALUES (?, ?, ?, ?, 'trip_full', ?)
        `).bind(
          v2Record.trip_name,
          formatted,
          JSON.stringify(v2Record),
          v2Record.search_text,
          v2Record.start_date
        ).run();
      }

      results.push({
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        migrated: !input.dry_run,
        data_size: JSON.stringify(v2Record).length
      });
    }

    return {
      success: true,
      trips_processed: results.length,
      dry_run: input.dry_run,
      results: results
    };
  }
};

// Helper to generate formatted text
async function generateFormattedContext(trip: any): Promise<string> {
  let text = `TRIP: ${trip.trip_name} (${trip.start_date} to ${trip.end_date})\n`;
  text += `STATUS: ${trip.status} | COST: $${trip.total_cost.toLocaleString()} (Paid: $${trip.paid_amount.toLocaleString()}, Due: $${(trip.total_cost - trip.paid_amount).toLocaleString()})\n\n`;
  
  text += `TRAVELERS: ${trip.clients.map((c: any) => `${c.name} (${c.email})`).join(', ')}\n\n`;
  
  text += `ITINERARY:\n`;
  trip.schedule.forEach((day: any) => {
    text += `Day ${day.day_number} (${day.date}): ${day.day_name}\n`;
    day.activities.forEach((act: any) => {
      text += `- ${act.time}: ${act.title}`;
      if (act.location) text += ` at ${act.location}`;
      text += '\n';
      if (act.description) text += `  ${act.description}\n`;
    });
    if (day.accommodation) {
      text += `- Accommodation: ${day.accommodation.name}\n`;
    }
    text += '\n';
  });

  if (trip.accommodations.length > 0) {
    text += `ACCOMMODATIONS:\n`;
    trip.accommodations.forEach((acc: any) => {
      text += `- ${acc.accommodation_name}: ${acc.check_in_date} to ${acc.check_out_date}`;
      if (acc.total_cost) text += ` ($${acc.total_cost})`;
      text += '\n';
    });
    text += '\n';
  }

  if (trip.transportation.length > 0) {
    text += `TRANSPORTATION:\n`;
    trip.transportation.forEach((trans: any) => {
      text += `- ${trans.transport_type}: ${trans.departure_location} to ${trans.arrival_location}`;
      if (trans.departure_datetime) text += ` (${trans.departure_datetime})`;
      text += '\n';
    });
    text += '\n';
  }

  return text;
}

export const migrateClientsToV2Tool = {
  name: 'migrate_clients_to_v2',
  description: 'Migrate clients to v2 format with embedded trip history',
  inputSchema: z.object({
    client_id: z.number().optional().describe('Specific client to migrate'),
    dry_run: z.boolean().default(false)
  }),
  handler: async (input: any, db: D1Database) => {
    const clientFilter = input.client_id ? 'WHERE c.client_id = ?' : '';
    const params = input.client_id ? [input.client_id] : [];
    
    const clients = await db.prepare(`
      SELECT * FROM Clients c ${clientFilter}
    `).bind(...params).all();

    const results = [];

    for (const client of clients.results) {
      // Get trip history
      const tripHistory = await db.prepare(`
        SELECT 
          t.trip_id,
          t.trip_name,
          t.start_date || ' to ' || t.end_date as dates,
          t.status,
          t.total_cost,
          t.currency,
          cgm.relationship as role
        FROM Trips t
        JOIN ClientGroups cg ON t.group_id = cg.group_id
        JOIN ClientGroupMembers cgm ON cg.group_id = cgm.group_id
        WHERE cgm.client_id = ?
        ORDER BY t.start_date DESC
      `).bind(client.client_id).all();

      const v2Record = {
        client_id: client.client_id,
        email: client.email,
        full_name: `${client.first_name} ${client.last_name}`,
        contact_info: {
          phone: client.phone,
          address: client.address,
          city: client.city,
          state: client.state,
          postal_code: client.postal_code,
          country: client.country
        },
        travel_docs: {
          passport: client.passport_number ? {
            number: client.passport_number,
            expiry: client.passport_expiry
          } : null
        },
        trip_history: tripHistory.results,
        preferences: client.preferences ? JSON.parse(client.preferences) : {},
        search_text: `${client.first_name} ${client.last_name} ${client.email} ${
          tripHistory.results.map((t: any) => t.trip_name).join(' ')
        }`.toLowerCase(),
        last_trip_date: tripHistory.results[0]?.dates?.split(' to ')[0],
        total_trips: tripHistory.results.length,
        total_spent: tripHistory.results.reduce((sum: number, t: any) => 
          sum + (t.total_cost || 0), 0)
      };

      if (!input.dry_run) {
        await db.prepare(`
          INSERT INTO clients_v2 (
            client_id, email, full_name, contact_info, travel_docs,
            trip_history, preferences, search_text, last_trip_date,
            total_trips, total_spent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          v2Record.client_id,
          v2Record.email,
          v2Record.full_name,
          JSON.stringify(v2Record.contact_info),
          JSON.stringify(v2Record.travel_docs),
          JSON.stringify(v2Record.trip_history),
          JSON.stringify(v2Record.preferences),
          v2Record.search_text,
          v2Record.last_trip_date,
          v2Record.total_trips,
          v2Record.total_spent
        ).run();

        // Create formatted context
        let formatted = `CLIENT: ${v2Record.full_name}\n`;
        formatted += `EMAIL: ${v2Record.email}\n`;
        formatted += `PHONE: ${v2Record.contact_info.phone || 'Not provided'}\n\n`;
        formatted += `TRIP HISTORY (${v2Record.total_trips} trips, $${v2Record.total_spent.toLocaleString()} total):\n`;
        v2Record.trip_history.forEach((t: any) => {
          formatted += `- ${t.trip_name} (${t.dates}) - ${t.status}\n`;
        });

        await db.prepare(`
          INSERT INTO llm_trip_context (
            natural_key, formatted_response, raw_data,
            search_keywords, context_type, relevance_date
          ) VALUES (?, ?, ?, ?, 'client_profile', ?)
        `).bind(
          v2Record.email,
          formatted,
          JSON.stringify(v2Record),
          v2Record.search_text,
          v2Record.last_trip_date || 'never'
        ).run();
      }

      results.push({
        client_id: client.client_id,
        name: v2Record.full_name,
        migrated: !input.dry_run
      });
    }

    return {
      success: true,
      clients_processed: results.length,
      dry_run: input.dry_run,
      results: results
    };
  }
};

export const createSearchIndexTool = {
  name: 'create_search_index',
  description: 'Build the search index for instant natural language queries',
  inputSchema: z.object({
    rebuild: z.boolean().default(false).describe('Rebuild entire index from scratch')
  }),
  handler: async (input: any, db: D1Database) => {
    if (input.rebuild) {
      await db.prepare('DELETE FROM search_index').run();
    }

    // Index trips
    const trips = await db.prepare('SELECT * FROM trips_v2').all();
    for (const trip of trips.results) {
      const schedule = JSON.parse(trip.schedule || '[]');
      const summary = `${trip.trip_name}: ${trip.start_date} to ${trip.end_date}, ${
        schedule.length} days, $${trip.total_cost}`;
      
      await db.prepare(`
        INSERT OR REPLACE INTO search_index (
          entity_type, entity_id, entity_name, summary,
          search_tokens, date_context, location_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'trip',
        trip.trip_id,
        trip.trip_name,
        summary,
        trip.search_text,
        `${trip.start_date} ${trip.end_date}`,
        trip.destinations
      ).run();
    }

    // Index clients
    const clients = await db.prepare('SELECT * FROM clients_v2').all();
    for (const client of clients.results) {
      const summary = `${client.full_name} (${client.email}): ${
        client.total_trips} trips, last: ${client.last_trip_date || 'never'}`;
      
      await db.prepare(`
        INSERT OR REPLACE INTO search_index (
          entity_type, entity_id, entity_name, summary,
          search_tokens, date_context
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        'client',
        client.client_id,
        client.full_name,
        summary,
        client.search_text,
        client.last_trip_date
      ).run();
    }

    return {
      success: true,
      trips_indexed: trips.results.length,
      clients_indexed: clients.results.length
    };
  }
};

// Export migration tools
export const migrationTools = [
  migrateTripsToV2Tool,
  migrateClientsToV2Tool,
  createSearchIndexTool
];