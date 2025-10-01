/**
 * Proposal rendering and publishing handlers
 */

import { Env, Trip } from '../types';
import { authenticate, corsHeaders } from '../auth';
import { generateBasicProposalHTML } from '../templates/proposal';

/**
 * Render proposal HTML
 * POST /proposals/:id/render
 */
export async function handleRenderProposal(tripId: string, request: Request, env: Env): Promise<Response> {
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
 * Publish trip to GitHub Pages
 * POST /publish/:id
 */
export async function handlePublishTrip(tripId: string, request: Request, env: Env): Promise<Response> {
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
    const filename = `${(trip as any).trip_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

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

    const publishResult = await publishResponse.json() as any;
    
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