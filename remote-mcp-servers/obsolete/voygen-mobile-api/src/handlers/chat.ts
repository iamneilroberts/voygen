/**
 * Chat with AI about trips
 */

import { Env, Trip } from '../types';
import { authenticate, corsHeaders } from '../auth';

/**
 * Chat with AI about a trip
 * POST /chat/:id
 */
export async function handleTripChat(tripId: string, request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as any;
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

      const claudeData = await claudeResponse.json() as any;
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

      const mcpData = await mcpResponse.json() as any;
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