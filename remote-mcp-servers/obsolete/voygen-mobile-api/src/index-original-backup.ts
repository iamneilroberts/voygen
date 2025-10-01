/**
 * Voygen Mobile API - REST endpoints for mobile trip management
 * Provides CRUD operations for trips, proposal rendering, and publishing
 */

import { z } from 'zod';

export interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
  PUBLISH_MCP_URL: string;
  PUBLISH_MCP_TOKEN: string;
  PUBLISH_TEMPLATE: string;
  SITE_BASE_URL: string;
  ANTHROPIC_API_KEY?: string;
  CHAT_MCP_URL?: string;
  CHAT_MCP_TOKEN?: string;
}

// Validation schemas
const TripCreateSchema = z.object({
  trip_name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  destinations: z.string().optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  owner: z.string().min(1),
  data: z.record(z.any()).optional()
});

const TripUpdateSchema = z.object({
  trip_name: z.string().min(1).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  destinations: z.string().optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  data: z.record(z.any()).optional()
});

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

/**
 * Handle CORS preflight requests
 */
function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Authenticate request using bearer token
 */
function authenticate(request: Request, env: Env): { success: boolean; owner?: string; error?: string } {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }
  
  const token = authHeader.substring(7);
  
  // For MVP, use simple dev token
  if (token === env.AUTH_SECRET) {
    return { success: true, owner: 'dev-user' };
  }
  
  return { success: false, error: 'Invalid token' };
}

/**
 * Fetch trips.json from somotravel.us to get exact ordering
 */
async function fetchSomotravelTripsOrder(): Promise<string[]> {
  try {
    const response = await fetch('https://somotravel.us/trips.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch trips.json: ${response.status}`);
    }
    const data = await response.json();
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
async function handleGetTrips(request: Request, env: Env): Promise<Response> {
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
async function handleCreateTrip(request: Request, env: Env): Promise<Response> {
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
async function handleGetTrip(tripId: string, request: Request, env: Env): Promise<Response> {
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
async function handleUpdateTrip(tripId: string, request: Request, env: Env): Promise<Response> {
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

/**
 * Render proposal HTML
 * POST /proposals/:id/render
 */
async function handleRenderProposal(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get trip data
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(parseInt(tripId)).first();

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate simple HTML proposal (basic template for MVP)
    const html = generateBasicProposalHTML(trip as any);

    // Update last_rendered_at in trip data
    const notesData = typeof trip.notes === 'string' ? JSON.parse(trip.notes) : (trip.notes || {});
    notesData.last_rendered_at = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE trips_v2 SET notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE trip_id = ?
    `).bind(JSON.stringify(notesData), parseInt(tripId)).run();

    return new Response(JSON.stringify({
      success: true,
      html,
      rendered_at: notesData.last_rendered_at
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Render error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Chat with AI about a trip
 * POST /chat/:id
 */
async function handleTripChat(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get trip data for context
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(parseInt(tripId)).first();

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use Claude API directly if available, otherwise try MCP
    let response;
    
    if (env.ANTHROPIC_API_KEY) {
      // Direct Claude API call
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `You are a travel assistant helping with trip "${trip.trip_name}".

Trip Details:
- Destinations: ${trip.destinations || 'Not specified'}
- Dates: ${trip.start_date} to ${trip.end_date}
- Status: ${trip.status}
- Current Cost: $${trip.total_cost || 0}

User Message: ${message}

Please provide helpful suggestions or answer questions about this trip. Keep responses concise and actionable for mobile users.`
          }]
        })
      });

      if (!claudeResponse.ok) {
        throw new Error(`Claude API error: ${claudeResponse.status}`);
      }

      const claudeData = await claudeResponse.json();
      response = claudeData.content[0]?.text || 'Sorry, I could not process your request.';
    } else if (env.CHAT_MCP_URL) {
      // MCP Server call (if available)
      const mcpResponse = await fetch(env.CHAT_MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CHAT_MCP_TOKEN}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'chat',
            arguments: {
              prompt: `Trip: ${trip.trip_name}. Context: ${JSON.stringify({
                destinations: trip.destinations,
                dates: `${trip.start_date} to ${trip.end_date}`,
                status: trip.status,
                cost: trip.total_cost
              })}. User: ${message}`,
              model: 'claude-3-5-haiku-20241022'
            }
          }
        })
      });

      if (!mcpResponse.ok) {
        throw new Error(`MCP API error: ${mcpResponse.status}`);
      }

      const mcpData = await mcpResponse.json();
      response = mcpData.result?.content?.[0]?.text || 'Sorry, I could not process your request.';
    } else {
      // Fallback: Simple predefined responses
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('budget')) {
        response = `The current estimated cost for "${trip.trip_name}" is $${trip.total_cost || 0}. Would you like me to help you adjust the budget or find cost-saving options?`;
      } else if (lowerMessage.includes('date') || lowerMessage.includes('time') || lowerMessage.includes('schedule')) {
        response = `Your trip "${trip.trip_name}" is scheduled from ${trip.start_date} to ${trip.end_date}. Would you like to modify these dates or discuss the itinerary?`;
      } else if (lowerMessage.includes('destination') || lowerMessage.includes('place') || lowerMessage.includes('location')) {
        response = `You're traveling to ${trip.destinations || 'destinations not yet specified'}. Would you like to add or change destinations?`;
      } else {
        response = `I'd be happy to help with "${trip.trip_name}"! You can ask me about costs, dates, destinations, or any other trip details. What would you like to know or change?`;
      }
    }

    return new Response(JSON.stringify({
      response,
      trip_context: {
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        status: trip.status
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Chat error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Publish trip to GitHub Pages
 * POST /publish/:id
 */
async function handlePublishTrip(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get trip data
    const trip = await env.DB.prepare(`
      SELECT * FROM trips_v2 WHERE trip_id = ?
    `).bind(parseInt(tripId)).first();

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate HTML
    const html = generateBasicProposalHTML(trip as any);
    const filename = `${trip.trip_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    // Call Publisher MCP Worker
    const publishResponse = await fetch(env.PUBLISH_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PUBLISH_MCP_TOKEN}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'publish_travel_document_with_dashboard_update',
          arguments: {
            trip_id: tripId,
            html_content: html,
            filename: filename,
            trip_metadata: {
              title: trip.trip_name,
              dates: `${trip.start_date} to ${trip.end_date}`,
              status: trip.status || 'planning',
              description: trip.destinations || 'Travel proposal'
            }
          }
        }
      })
    });

    if (!publishResponse.ok) {
      throw new Error(`Publisher API returned ${publishResponse.status}`);
    }

    const publishResult = await publishResponse.json();
    
    if (publishResult.error) {
      throw new Error(publishResult.error.message);
    }

    const result = JSON.parse(publishResult.result.content[0].text);
    const html_url = `${env.SITE_BASE_URL}/proposals/${filename}.html`;

    // Update trip with publish info
    const notesData = typeof trip.notes === 'string' ? JSON.parse(trip.notes) : (trip.notes || {});
    notesData.last_published_at = new Date().toISOString();
    notesData.published_url = html_url;
    notesData.filename = filename;

    await env.DB.prepare(`
      UPDATE trips_v2 SET notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE trip_id = ?
    `).bind(JSON.stringify(notesData), parseInt(tripId)).run();

    return new Response(JSON.stringify({
      success: true,
      html_url,
      published_at: notesData.last_published_at,
      commit_info: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Publish error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate basic HTML proposal for MVP
 */
function generateBasicProposalHTML(trip: any): string {
  const destinations = trip.destinations || 'Various destinations';
  const startDate = new Date(trip.start_date).toLocaleDateString();
  const endDate = new Date(trip.end_date).toLocaleDateString();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${trip.trip_name} - Travel Proposal</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            color: #333; 
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #007bff; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .trip-info { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
        }
        .status { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 16px; 
            font-size: 0.85em; 
            font-weight: 600; 
            text-transform: uppercase; 
        }
        .status.planning { background: #fff3cd; color: #856404; }
        .status.confirmed { background: #d1ecf1; color: #0c5460; }
        .status.in_progress { background: #d4edda; color: #155724; }
        .status.completed { background: #d1ecf1; color: #0c5460; }
        h1 { color: #007bff; margin: 0; }
        h2 { color: #495057; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #dee2e6; 
            color: #6c757d; 
            font-size: 0.9em; 
        }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .trip-info { padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${trip.trip_name}</h1>
        <p>Travel Proposal</p>
        <span class="status ${trip.status}">${trip.status}</span>
    </div>
    
    <div class="trip-info">
        <h2>Trip Overview</h2>
        <p><strong>Destinations:</strong> ${destinations}</p>
        <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
        <p><strong>Status:</strong> ${trip.status}</p>
        ${trip.total_cost ? `<p><strong>Estimated Cost:</strong> $${trip.total_cost}</p>` : ''}
        ${trip.group_name ? `<p><strong>Group:</strong> ${trip.group_name}</p>` : ''}
    </div>
    
    <div class="content">
        <h2>Trip Details</h2>
        <p>This is a ${trip.status} travel proposal for ${trip.trip_name}.</p>
        <p>We will be traveling to ${destinations} from ${startDate} to ${endDate}.</p>
        
        ${trip.schedule ? `
        <h2>Itinerary</h2>
        <p>Detailed itinerary planning is in progress. Please contact us for the latest updates.</p>
        ` : ''}
        
        <h2>Next Steps</h2>
        <p>Please review this proposal and let us know if you have any questions or modifications.</p>
    </div>
    
    <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Powered by Voygen Travel Assistant</p>
    </div>
</body>
</html>`.trim();
}

/**
 * Get mobile interface HTML
 */
function getMobileInterfaceHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voygen Mobile - Trip Management</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
        }

        .header h1 {
            margin-bottom: 8px;
            font-weight: 600;
        }

        .header p {
            opacity: 0.9;
        }

        .auth-section {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .trips-section {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: none;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
        }

        input, select, textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }

        .btn:hover {
            background: #0056b3;
        }

        .btn-success {
            background: #28a745;
        }

        .btn-success:hover {
            background: #1e7e34;
        }

        .btn-danger {
            background: #dc3545;
        }

        .btn-danger:hover {
            background: #c82333;
        }

        .trip-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            transition: box-shadow 0.3s ease;
        }

        .trip-card:hover {
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .trip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .trip-title {
            font-weight: 600;
            font-size: 18px;
            color: #007bff;
        }

        .status-badge {
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-planning {
            background: #fff3cd;
            color: #856404;
        }

        .status-confirmed {
            background: #d1ecf1;
            color: #0c5460;
        }

        .status-in_progress {
            background: #d4edda;
            color: #155724;
        }

        .status-completed {
            background: #d1ecf1;
            color: #0c5460;
        }

        .trip-details {
            margin-bottom: 10px;
            color: #666;
        }

        .trip-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .trip-actions .btn {
            font-size: 14px;
            padding: 8px 16px;
            margin: 0;
        }

        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
        }

        .success {
            background: #d4edda;
            color: #155724;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.4);
        }

        .modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: none;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
        }

        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .close:hover {
            color: black;
        }

        @media (max-width: 600px) {
            .container {
                padding: 10px;
            }
            
            .trip-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .trip-actions {
                margin-top: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛫 Voygen Mobile</h1>
            <p>Trip Management Interface</p>
        </div>

        <!-- Authentication Section -->
        <div id="authSection" class="auth-section">
            <h3>Authentication Required</h3>
            <p>Please enter your API token to access trip management features.</p>
            <div class="form-group">
                <label for="authToken">API Token:</label>
                <input type="password" id="authToken" value="dev-secret" placeholder="Enter your API token">
            </div>
            <button class="btn" onclick="authenticate()">Connect</button>
        </div>

        <!-- Main Interface -->
        <div id="mainInterface" class="trips-section">
            <div class="trip-header">
                <h3>Your Trips</h3>
                <button class="btn btn-success" onclick="showCreateTripModal()">+ New Trip</button>
            </div>
            <div id="tripsContainer">
                <div class="loading">Loading trips...</div>
            </div>
        </div>

        <!-- Create Trip Modal -->
        <div id="createTripModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="hideCreateTripModal()">&times;</span>
                <h3>Create New Trip</h3>
                <form id="createTripForm">
                    <div class="form-group">
                        <label for="tripName">Trip Name:</label>
                        <input type="text" id="tripName" required>
                    </div>
                    <div class="form-group">
                        <label for="startDate">Start Date:</label>
                        <input type="date" id="startDate" required>
                    </div>
                    <div class="form-group">
                        <label for="endDate">End Date:</label>
                        <input type="date" id="endDate" required>
                    </div>
                    <div class="form-group">
                        <label for="destinations">Destinations:</label>
                        <input type="text" id="destinations" placeholder="e.g. Paris, Rome, Barcelona">
                    </div>
                    <div class="form-group">
                        <label for="status">Status:</label>
                        <select id="status">
                            <option value="planning">Planning</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <button type="submit" class="btn">Create Trip</button>
                </form>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = '/';
        let authToken = '';
        let somotravelTripsOrder = [];

        // Fetch somotravel.us trips order on load
        async function loadSomotravelOrder() {
            try {
                const response = await fetch('https://somotravel.us/trips.json');
                if (response.ok) {
                    const data = await response.json();
                    somotravelTripsOrder = data.trips || [];
                    console.log('Loaded somotravel.us trips order:', somotravelTripsOrder.length, 'trips');
                }
            } catch (error) {
                console.log('Could not load somotravel.us trips order:', error);
            }
        }

        // Find matching proposal URL for a trip
        function findProposalUrl(tripName) {
            const matchingTrip = somotravelTripsOrder.find(trip => 
                trip.title.toLowerCase().includes(tripName.toLowerCase()) ||
                tripName.toLowerCase().includes(trip.title.toLowerCase())
            );
            
            if (matchingTrip && matchingTrip.filename) {
                return \`https://somotravel.us/proposals/\${matchingTrip.filename}.html\`;
            }
            return null;
        }

        // Authentication
        function authenticate() {
            const token = document.getElementById('authToken').value;
            if (!token) {
                showError('Please enter an API token');
                return;
            }
            
            authToken = token;
            fetchTrips();
        }

        // API Helper
        async function apiCall(endpoint, options = {}) {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (authToken) {
                headers['Authorization'] = \`Bearer \${authToken}\`;
            }
            
            const response = await fetch(API_BASE + endpoint, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(error.error || ('HTTP ' + response.status));
            }
            
            return await response.json();
        }

        // Fetch and display trips
        async function fetchTrips() {
            try {
                const data = await apiCall('trips');
                displayTrips(data.trips);
                showMainInterface();
            } catch (error) {
                showError('Authentication failed: ' + error.message);
            }
        }

        // Display trips in the UI
        function displayTrips(trips) {
            const container = document.getElementById('tripsContainer');
            
            if (trips.length === 0) {
                container.innerHTML = '<p>No trips found. Create your first trip!</p>';
                return;
            }
            
            container.innerHTML = trips.map(trip => \`
                <div class="trip-card">
                    <div class="trip-header">
                        <div class="trip-title">\${trip.trip_name}</div>
                        <span class="status-badge status-\${trip.status}">\${trip.status}</span>
                    </div>
                    <div class="trip-details">
                        <strong>📍</strong> \${trip.destinations || 'No destinations set'}<br>
                        <strong>📅</strong> \${formatDate(trip.start_date)} - \${formatDate(trip.end_date)}<br>
                        \${trip.total_cost ? \`<strong>💰</strong> $\${trip.total_cost}\` : ''}
                    </div>
                    <div class="trip-actions">
                        <button class="btn" onclick="viewTrip(\${trip.trip_id})">Summary</button>
                        <button class="btn" onclick="viewTripDetails(\${trip.trip_id})">Details</button>
                        <button class="btn" onclick="viewProposal('\${trip.trip_name}')">Preview Proposal</button>
                        <button class="btn" onclick="openChat(\${trip.trip_id}, '\${trip.trip_name}')">💬 Chat</button>
                        <button class="btn btn-success" onclick="publishTrip(\${trip.trip_id})">Publish</button>
                    </div>
                </div>
            \`).join('');
        }

        // View trip details (mobile-friendly)
        async function viewTrip(tripId) {
            try {
                const data = await apiCall('trips/' + tripId);
                const trip = data.trip;
                
                // Create a mobile-friendly formatted view
                let details = \`📊 Trip Details\\n\\n\`;
                details += \`🎫 Name: \${trip.trip_name}\\n\`;
                details += \`📍 Destinations: \${trip.destinations || 'Not set'}\\n\`;
                details += \`📅 Dates: \${formatDate(trip.start_date)} - \${formatDate(trip.end_date)}\\n\`;
                details += \`🏷️ Status: \${trip.status}\\n\`;
                details += \`💰 Cost: $\${trip.total_cost || 0}\\n\`;
                details += \`👥 Group: \${trip.group_name || 'None'}\\n\\n\`;
                
                if (trip.clients && trip.clients !== '[]') {
                    const clients = JSON.parse(trip.clients);
                    details += \`👤 Travelers:\\n\`;
                    clients.forEach((client, i) => {
                        details += \`  \${i + 1}. \${client.name || client.full_name || 'Unknown'} (\${client.email || 'No email'})\\n\`;
                    });
                }
                
                alert(details);
            } catch (error) {
                showError('Failed to fetch trip: ' + error.message);
            }
        }

        // View full trip details with day-by-day itinerary
        async function viewTripDetails(tripId) {
            try {
                const data = await apiCall('trips/' + tripId);
                const trip = data.trip;
                
                // TODO: Fix template literal issue in detailed view
                // For now, show a simple alert instead of the complex HTML generation
                alert('Trip Details: ' + trip.trip_name + '\\nDates: ' + trip.start_date + ' to ' + trip.end_date + '\\nDestinations: ' + (trip.destinations || 'Not specified') + '\\nStatus: ' + trip.status);
                return;
                
                // DISABLED: Complex HTML view - template literal escaping issue
                /*
                let detailsHtml = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'    <meta charset="UTF-8">' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'    <title>' + trip.trip_name + ' - Trip Details</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }
        .trip-overview {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .day-card {
            background: white;
            border-left: 4px solid #007bff;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .day-header {
            font-size: 18px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .activity {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 3px solid #28a745;
        }
        .activity-time {
            font-weight: bold;
            color: #28a745;
        }
        .activity-type {
            display: inline-block;
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
            margin-left: 10px;
        }
        .accommodation, .meal {
            background: #fff3cd;
            border-left-color: #ffc107;
        }
        .transportation {
            background: #d1ecf1;
            border-left-color: #17a2b8;
        }
        .close-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            z-index: 1000;
        }
        .section {
            margin: 20px 0;
        }
        .section h3 {
            color: #495057;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 5px;
        }
    </style>
</head>
<body>
    <button class="close-btn" onclick="window.close()">&times;</button>
    
    <div class="header">
        <h1>\${trip.trip_name}</h1>
        <p>\${formatDate(trip.start_date)} to \${formatDate(trip.end_date)}</p>
        <p>Status: \${trip.status.toUpperCase()}</p>
    </div>

    <div class="trip-overview">
        <h2>📋 Trip Overview</h2>
        <p><strong>📍 Destinations:</strong> \${trip.destinations || 'Not specified'}</p>
        <p><strong>👥 Group:</strong> \${trip.group_name || 'None'}</p>
        <p><strong>💰 Total Cost:</strong> $\${trip.total_cost || 0}</p>
        <p><strong>💳 Paid Amount:</strong> $\${trip.paid_amount || 0}</p>
        <p><strong>💳 Balance Due:</strong> $\${(trip.total_cost || 0) - (trip.paid_amount || 0)}</p>
\`;

                // Add travelers section
                if (trip.clients && trip.clients !== '[]') {
                    try {
                        const clients = JSON.parse(trip.clients);
                        detailsHtml += '<div class="section"><h3>👤 Travelers</h3>';
                        clients.forEach((client, i) => {
                            detailsHtml += '<p>' + (i + 1) + '. ' + (client.name || client.full_name || 'Unknown') + 
                                         ' (' + (client.email || 'No email') + ') - ' + (client.role || 'Traveler') + '</p>';
                        });
                        detailsHtml += '</div>';
                    } catch (e) {
                        console.log('Error parsing clients:', e);
                    }
                }

                detailsHtml += \`
    </div>
\`;

                // Add day-by-day schedule
                if (trip.schedule && trip.schedule !== '[]') {
                    try {
                        const schedule = JSON.parse(trip.schedule);
                        if (schedule.length > 0) {
                            detailsHtml += \`<h2>📅 Day-by-Day Itinerary</h2>\`;
                            
                            schedule.forEach((day, index) => {
                                detailsHtml += \`
    <div class="day-card">
        <div class="day-header">
            Day \${day.day_number || index + 1} - \${day.date ? formatDate(day.date) : 'Date TBD'}
            \${day.day_name ? \`: \${day.day_name}\` : ''}
        </div>\`;

                                // Add activities
                                if (day.activities && Array.isArray(day.activities)) {
                                    day.activities.forEach(activity => {
                                        const activityClass = activity.activity_type || activity.type || '';
                                        detailsHtml += \`
        <div class="activity \${activityClass.toLowerCase()}">
            <div class="activity-time">\${activity.start_time || activity.time || 'Time TBD'}</div>
            <div class="activity-type">\${activity.activity_type || activity.type || 'Activity'}</div>
            <h4>\${activity.title || activity.name || 'Activity'}</h4>
            <p>\${activity.description || ''}</p>
            \${activity.location ? \`<p><strong>📍 Location:</strong> \${activity.location}</p>\` : ''}
            \${activity.duration ? \`<p><strong>⏱️ Duration:</strong> \${activity.duration}</p>\` : ''}
            \${activity.cost ? \`<p><strong>💰 Cost:</strong> $\${activity.cost}</p>\` : ''}
        </div>\`;
                                    });
                                }

                                // Add accommodation info
                                if (day.accommodation) {
                                    detailsHtml += \`
        <div class="activity accommodation">
            <div class="activity-type">Accommodation</div>
            <h4>\${day.accommodation.name || 'Hotel'}</h4>
            \${day.accommodation.address ? \`<p><strong>📍 Address:</strong> \${day.accommodation.address}</p>\` : ''}
            \${day.accommodation.check_in ? \`<p><strong>🏨 Check-in:</strong> \${day.accommodation.check_in}</p>\` : ''}
            \${day.accommodation.check_out ? \`<p><strong>🏨 Check-out:</strong> \${day.accommodation.check_out}</p>\` : ''}
        </div>\`;
                                }

                                // Add meals
                                if (day.meals && Array.isArray(day.meals)) {
                                    day.meals.forEach(meal => {
                                        detailsHtml += \`
        <div class="activity meal">
            <div class="activity-type">Meal - \${meal.type || 'Dining'}</div>
            <h4>\${meal.restaurant || meal.name || 'Meal'}</h4>
            <p>\${meal.description || ''}</p>
            \${meal.location ? \`<p><strong>📍 Location:</strong> \${meal.location}</p>\` : ''}
            \${meal.time ? \`<p><strong>🕐 Time:</strong> \${meal.time}</p>\` : ''}
        </div>\`;
                                    });
                                }

                                // Add day notes
                                if (day.notes) {
                                    detailsHtml += \`
        <div class="activity">
            <div class="activity-type">Notes</div>
            <p>\${day.notes}</p>
        </div>\`;
                                }

                                detailsHtml += \`</div>\`;
                            });
                        }
                    } catch (e) {
                        detailsHtml += \`<p>Error loading schedule details: \${e.message}</p>\`;
                    }
                } else {
                    detailsHtml += \`
    <div class="day-card">
        <p>📝 Detailed day-by-day itinerary is being planned. Please check back later for updates.</p>
    </div>\`;
                }

                detailsHtml += \`
    <script>
        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }
    </script>
</body>
</html>\`;

                // Open detailed view
                try {
                    const newWindow = window.open('', '_blank');
                    if (newWindow && newWindow.document) {
                        newWindow.document.write(detailsHtml);
                        newWindow.document.close();
                        showSuccess('Trip details opened in new tab!');
                    } else {
                        throw new Error('Popup blocked');
                    }
                } catch (windowError) {
                    // Fallback: Create blob and open
                    const blob = new Blob([detailsHtml], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    
                    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
                        window.open(url, '_blank') || (window.location.href = url);
                    } else {
                        const link = document.createElement('a');
                        link.href = url;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                    
                    showSuccess('Trip details generated! Opening now...');
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                
            } catch (error) {
                showError('Failed to fetch trip details: ' + error.message);
            }
            */
        }

        // View existing proposal from somotravel.us
        function viewProposal(tripName) {
            const proposalUrl = findProposalUrl(tripName);
            
            if (proposalUrl) {
                // Open the existing proposal from somotravel.us
                try {
                    const newWindow = window.open(proposalUrl, '_blank');
                    if (newWindow) {
                        showSuccess('Opening published proposal...');
                    } else {
                        // Fallback for blocked popups
                        window.location.href = proposalUrl;
                    }
                } catch (error) {
                    window.location.href = proposalUrl;
                }
            } else {
                // Fallback to generating a new proposal if no published one exists
                showError('No published proposal found. Generating new one...');
                setTimeout(() => generateNewProposal(tripName), 1000);
            }
        }

        // Generate new proposal (fallback)
        async function generateNewProposal(tripName) {
            // Find the trip ID from the name
            const tripsContainer = document.getElementById('tripsContainer');
            const tripCards = tripsContainer.querySelectorAll('.trip-card');
            let tripId = null;
            
            tripCards.forEach(card => {
                const titleElement = card.querySelector('.trip-title');
                if (titleElement && titleElement.textContent === tripName) {
                    const summaryButton = card.querySelector('button[onclick*="viewTrip"]');
                    if (summaryButton) {
                        const match = summaryButton.getAttribute('onclick').match(/viewTrip\\(([0-9]+)\\)/);
                        if (match) tripId = match[1];
                    }
                }
            });

            if (!tripId) {
                showError('Could not find trip to generate proposal');
                return;
            }

            try {
                showSuccess('Generating proposal...');
                const data = await apiCall('proposals/' + tripId + '/render', { method: 'POST' });
                
                // Open generated HTML
                const blob = new Blob([data.html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
                    window.open(url, '_blank') || (window.location.href = url);
                } else {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                showSuccess('Proposal generated! Opening now...');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (error) {
                showError('Failed to generate proposal: ' + error.message);
            }
        }

        // Open chat interface for a trip
        function openChat(tripId, tripName) {
            alert('Chat feature temporarily disabled due to technical issues. Will be restored soon!');
            return;
            
            /* DISABLED - Template literal issue
            const chatHtml = \`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat - \${tripName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: #f5f5f5;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .chat-header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .chat-title {
            font-size: 18px;
            font-weight: 600;
        }
        .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
        }
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 18px;
            word-wrap: break-word;
        }
        .message.user {
            background: #007bff;
            color: white;
            align-self: flex-end;
            margin-left: auto;
        }
        .message.ai {
            background: white;
            color: #333;
            align-self: flex-start;
            border: 1px solid #e9ecef;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .chat-input {
            background: white;
            border-top: 1px solid #e9ecef;
            padding: 15px 20px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .chat-input input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 16px;
            outline: none;
        }
        .chat-input input:focus {
            border-color: #007bff;
        }
        .send-btn {
            background: #007bff;
            border: none;
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            min-width: 80px;
        }
        .send-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="chat-header">
        <div class="chat-title">💬 Chat - \${tripName}</div>
        <button class="close-btn" onclick="window.close()">Close</button>
    </div>
    
    <div class="chat-messages" id="chatMessages">
        <div class="message ai">
            Hi! I'm here to help you with your trip "\${tripName}". 
            You can ask me about costs, dates, destinations, or any changes you'd like to make.
            What would you like to know or modify?
        </div>
    </div>
    
    <div class="chat-input">
        <input type="text" id="messageInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
        <button class="send-btn" onclick="sendMessage()" id="sendBtn">Send</button>
    </div>

    <script>
        let isLoading = false;
        
        function handleKeyPress(event) {
            if (event.key === 'Enter' && !isLoading) {
                sendMessage();
            }
        }
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message || isLoading) return;
            
            // Add user message to chat
            addMessage(message, 'user');
            input.value = '';
            
            // Show loading
            isLoading = true;
            document.getElementById('sendBtn').disabled = true;
            addMessage('Thinking...', 'ai', true);
            
            try {
                const response = await fetch('/chat/\${tripId}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || 'dev-secret')
                    },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Remove loading message
                const messages = document.getElementById('chatMessages');
                const loadingMsg = messages.lastElementChild;
                if (loadingMsg && loadingMsg.textContent === 'Thinking...') {
                    loadingMsg.remove();
                }
                
                // Add AI response
                addMessage(data.response, 'ai');
                
            } catch (error) {
                // Remove loading message
                const messages = document.getElementById('chatMessages');
                const loadingMsg = messages.lastElementChild;
                if (loadingMsg && loadingMsg.textContent === 'Thinking...') {
                    loadingMsg.remove();
                }
                
                addMessage('Sorry, I encountered an error: ' + error.message, 'ai');
            } finally {
                isLoading = false;
                document.getElementById('sendBtn').disabled = false;
                document.getElementById('messageInput').focus();
            }
        }
        
        function addMessage(text, sender, isLoading = false) {
            const messages = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + sender;
            messageDiv.textContent = text;
            
            if (isLoading) {
                messageDiv.className += ' loading';
            }
            
            messages.appendChild(messageDiv);
            messages.scrollTop = messages.scrollHeight;
        }
        
        // Focus input on load
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('messageInput').focus();
        });
    </script>
</body>
</html>\`;

            try {
                const newWindow = window.open('', '_blank');
                if (newWindow && newWindow.document) {
                    newWindow.document.write(chatHtml);
                    newWindow.document.close();
                    showSuccess('Chat opened in new tab!');
                } else {
                    throw new Error('Popup blocked');
                }
            } catch (windowError) {
                // Fallback: Create blob URL
                const blob = new Blob([chatHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
                    window.open(url, '_blank') || (window.location.href = url);
                } else {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                showSuccess('Chat interface opened!');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }

        // Publish trip
        async function publishTrip(tripId) {
            try {
                if (!confirm('Are you sure you want to publish this trip?')) return;
                
                showSuccess('Publishing trip...');
                const data = await apiCall('publish/' + tripId, { method: 'POST' });
                
                if (data.html_url) {
                    showSuccess(\`Trip published successfully! <a href="\${data.html_url}" target="_blank">View Published Trip</a>\`);
                } else {
                    showSuccess('Trip published successfully!');
                }
            } catch (error) {
                showError('Failed to publish trip: ' + error.message);
            }
        }

        // Create trip
        document.getElementById('createTripForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                trip_name: document.getElementById('tripName').value,
                start_date: document.getElementById('startDate').value,
                end_date: document.getElementById('endDate').value,
                destinations: document.getElementById('destinations').value,
                status: document.getElementById('status').value,
                owner: 'mobile-user'
            };
            
            try {
                const data = await apiCall('trips', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                
                showSuccess('Trip created successfully!');
                hideCreateTripModal();
                fetchTrips();
                document.getElementById('createTripForm').reset();
            } catch (error) {
                showError('Failed to create trip: ' + error.message);
            }
        });

        // UI Helpers
        function showMainInterface() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'block';
        }

        function showCreateTripModal() {
            document.getElementById('createTripModal').style.display = 'block';
        }

        function hideCreateTripModal() {
            document.getElementById('createTripModal').style.display = 'none';
        }

        function showError(message) {
            removeMessages();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = message;
            document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.container').firstChild);
        }

        function showSuccess(message) {
            removeMessages();
            const successDiv = document.createElement('div');
            successDiv.className = 'success';
            successDiv.innerHTML = message;
            document.querySelector('.container').insertBefore(successDiv, document.querySelector('.container').firstChild);
        }

        function removeMessages() {
            const messages = document.querySelectorAll('.error, .success');
            messages.forEach(msg => msg.remove());
        }

        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('authToken').value = 'dev-secret';
            // Load trips order from somotravel.us on startup
            loadSomotravelOrder();
            // Store auth token for chat windows
            localStorage.setItem('authToken', 'dev-secret');
        });
    </script>
</body>
</html>`;
}

/**
 * Route requests to appropriate handlers
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return handleCors();
  }

  // Serve mobile interface
  if ((path === '/' || path === '/mobile' || path === '/mobile/') && method === 'GET') {
    return new Response(getMobileInterfaceHTML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }

  // Health check
  if (path === '/health' && method === 'GET') {
    return new Response(JSON.stringify({
      status: 'healthy',
      version: '1.0.0',
      endpoints: {
        'GET /': 'Mobile interface',
        'GET /mobile': 'Mobile interface',
        'GET /trips': 'List trips',
        'POST /trips': 'Create trip', 
        'GET /trips/:id': 'Get trip',
        'PATCH /trips/:id': 'Update trip',
        'POST /proposals/:id/render': 'Render proposal',
        'POST /publish/:id': 'Publish trip',
        'POST /chat/:id': 'Chat with AI about trip'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Routes
  if (path === '/trips' && method === 'GET') {
    return handleGetTrips(request, env);
  }
  
  if (path === '/trips' && method === 'POST') {
    return handleCreateTrip(request, env);
  }

  const tripIdMatch = path.match(/^\/trips\/(\d+)$/);
  if (tripIdMatch && method === 'GET') {
    return handleGetTrip(tripIdMatch[1], request, env);
  }
  
  if (tripIdMatch && method === 'PATCH') {
    return handleUpdateTrip(tripIdMatch[1], request, env);
  }

  const proposalMatch = path.match(/^\/proposals\/(\d+)\/render$/);
  if (proposalMatch && method === 'POST') {
    return handleRenderProposal(proposalMatch[1], request, env);
  }

  const publishMatch = path.match(/^\/publish\/(\d+)$/);
  if (publishMatch && method === 'POST') {
    return handlePublishTrip(publishMatch[1], request, env);
  }

  const chatMatch = path.match(/^\/chat\/(\d+)$/);
  if (chatMatch && method === 'POST') {
    return handleTripChat(chatMatch[1], request, env);
  }

  // 404
  return new Response(JSON.stringify({
    error: 'Not Found',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Cloudflare Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error: any) {
      console.error('Unhandled error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};