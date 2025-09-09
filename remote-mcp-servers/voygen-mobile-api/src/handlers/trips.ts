/**
 * Trip CRUD handlers
 */

import { Env, Trip, TripCreateSchema, TripUpdateSchema } from '../types';
import { authenticate, corsHeaders } from '../auth';

/**
 * Fetch trips.json from somotravel.us to get exact ordering
 */
async function fetchSomotravelTripsOrder(): Promise<string[]> {
  try {
    const response = await fetch('https://somotravel.us/trips.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch trips.json: ${response.status}`);
    }
    const data = await response.json() as any;
    return data.trips?.map((trip: any) => trip.title) || [];
  } catch (error) {
    console.log('Failed to fetch somotravel.us trips order:', error);
    return [];
  }
}

/**
 * Get trips list with filtering and pagination
 * GET /trips?owner=...&limit=...&status=...
 */
export async function handleGetTrips(request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const owner = url.searchParams.get('owner') || auth.owner;
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const status = url.searchParams.get('status');

  try {
    let query = `
      SELECT trip_id, trip_name, status, start_date, end_date, destinations, 
             total_cost, paid_amount, primary_client_email, group_name, 
             created_at, updated_at
      FROM trips_v2 
      WHERE created_by = ? OR created_by IS NULL
    `;
    const params: any[] = [owner];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Get trips from database first
    query += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();
    let trips = result.results as any[];

    // Try to get somotravel.us ordering and apply it
    try {
      const somotravelOrder = await fetchSomotravelTripsOrder();
      if (somotravelOrder.length > 0) {
        // Sort trips based on somotravel.us order
        trips.sort((a, b) => {
          const aIndex = somotravelOrder.findIndex(title => 
            title.toLowerCase().includes(a.trip_name.toLowerCase()) ||
            a.trip_name.toLowerCase().includes(title.toLowerCase())
          );
          const bIndex = somotravelOrder.findIndex(title => 
            title.toLowerCase().includes(b.trip_name.toLowerCase()) ||
            b.trip_name.toLowerCase().includes(title.toLowerCase())
          );
          
          // If both found, sort by index
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          // If only one found, prioritize it
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          
          // If neither found, fall back to status priority
          const statusPriority = {
            'planning': 1,
            'confirmed': 2,
            'in_progress': 3,
            'completed': 4,
            'cancelled': 5
          };
          const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 6;
          const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 6;
          
          return aPriority - bPriority;
        });
      }
    } catch (orderError) {
      console.log('Using fallback sorting due to trips.json fetch error:', orderError);
    }
    
    return new Response(JSON.stringify({
      trips,
      count: trips.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Database error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create new trip
 * POST /trips
 */
export async function handleCreateTrip(request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const data = TripCreateSchema.parse(body);

    const result = await env.DB.prepare(`
      INSERT INTO trips_v2 (
        trip_name, status, start_date, end_date, destinations, 
        created_by, last_modified_by, clients, schedule, 
        accommodations, transportation, financials, documents, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.trip_name,
      data.status || 'planning',
      data.start_date,
      data.end_date,
      data.destinations || '',
      data.owner,
      data.owner,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      JSON.stringify(data.data || {})
    ).run();

    if (!result.success) {
      throw new Error('Failed to create trip');
    }

    // Fetch the created trip
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(result.meta.last_row_id).first();

    return new Response(JSON.stringify({
      success: true,
      trip
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.name === 'ZodError' ? 400 : 500;
    return new Response(JSON.stringify({ 
      error: error.name === 'ZodError' ? 'Validation error' : 'Server error',
      details: error.message 
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get single trip with full details
 * GET /trips/:id
 */
export async function handleGetTrip(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(parseInt(tripId)).first();

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ trip }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Database error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update trip
 * PATCH /trips/:id
 */
export async function handleUpdateTrip(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const data = TripUpdateSchema.parse(body);

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];

    if (data.trip_name) {
      updates.push('trip_name = ?');
      params.push(data.trip_name);
    }
    if (data.start_date) {
      updates.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.end_date) {
      updates.push('end_date = ?');
      params.push(data.end_date);
    }
    if (data.destinations) {
      updates.push('destinations = ?');
      params.push(data.destinations);
    }
    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.data) {
      updates.push('notes = ?');
      params.push(JSON.stringify(data.data));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    updates.push('last_modified_by = ?');
    params.push(auth.owner!);
    params.push(parseInt(tripId));

    if (updates.length === 2) { // Only timestamp and user updates
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const query = `UPDATE trips_v2 SET ${updates.join(', ')} WHERE trip_id = ?`;
    const result = await env.DB.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error('Failed to update trip');
    }

    // Fetch updated trip
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(parseInt(tripId)).first();

    return new Response(JSON.stringify({
      success: true,
      trip
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.name === 'ZodError' ? 400 : 500;
    return new Response(JSON.stringify({ 
      error: error.name === 'ZodError' ? 'Validation error' : 'Server error',
      details: error.message 
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}