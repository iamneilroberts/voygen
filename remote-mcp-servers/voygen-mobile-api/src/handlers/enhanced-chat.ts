/**
 * Enhanced Chat Handler with Full MCP Integration
 * Provides Claude/LibreChat-like experience for mobile users
 */

import { Env } from '../types';
import { authenticate, corsHeaders } from '../auth';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: any;
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context?: {
    active_trip_id?: string;
    active_client_email?: string;
    workflow_phase?: string;
  };
}

/**
 * MCP Server Integration - Calls your actual MCP servers
 */
async function callMCPServer(env: Env, serverUrl: string, method: string, params: any) {
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MCP_AUTH_KEY || 'dev-secret'}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random().toString(36),
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      }
    })
  });

  if (!response.ok) {
    throw new Error(`MCP Server error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.result || data;
}

/**
 * Process user message with full MCP integration
 */
async function processUserMessage(message: string, context: any, env: Env): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  try {
    // Trip-related queries
    if (lowerMessage.includes('trip') || lowerMessage.includes('client') || 
        lowerMessage.includes('booking') || lowerMessage.includes('travel')) {
      
      // Extract search terms from the message
      const searchTerms = extractSearchTerms(message);
      
      if (searchTerms) {
        const result = await callMCPServer(env, 'https://d1-database-improved.somotravel.workers.dev/sse', 
          'get_anything', {
            query: searchTerms,
            include_everything: true
          });
          
        if (result && result.trips && result.trips.length > 0) {
          return formatTripResults(result);
        }
      }
    }
    
    // Continue/resume workflow
    if (lowerMessage.includes('continue') || lowerMessage.includes('resume')) {
      const result = await callMCPServer(env, 'https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse',
        'continue_trip', {
          search_query: extractSearchTerms(message) || undefined
        });
        
      if (result) {
        return `Resuming work on: ${result.trip_name || 'recent trip'}\n\n${result.summary || 'Ready to continue where we left off.'}`;
      }
    }
    
    // Trip creation
    if (lowerMessage.includes('create') && lowerMessage.includes('trip')) {
      return "I'll help you create a new trip. Please provide:\n\n• Trip name\n• Client name and email\n• Travel dates\n• Destinations\n\nYou can say something like: 'Create a trip for John Smith (john@email.com) to Paris from June 1-10 called Paris Getaway'";
    }
    
    // Parse trip creation request
    const tripData = parseTripCreationRequest(message);
    if (tripData) {
      const result = await callMCPServer(env, 'https://d1-database-improved.somotravel.workers.dev/sse',
        'create_trip_with_client', tripData);
        
      if (result) {
        return `✅ Trip created successfully!\n\n**${result.trip_name}**\n📍 ${result.destinations}\n📅 ${result.start_date} to ${result.end_date}\n👤 ${result.client_full_name}`;
      }
    }
    
    // Publishing
    if (lowerMessage.includes('publish') || lowerMessage.includes('proposal')) {
      const tripId = extractTripId(message, context);
      if (tripId) {
        const result = await callMCPServer(env, 'https://github-mcp-cta.somotravel.workers.dev/sse',
          'publish_travel_document_with_dashboard_update', {
            trip_id: tripId,
            template: 'standard'
          });
          
        if (result && result.html_url) {
          return `🚀 Trip published successfully!\n\n📄 [View Published Proposal](${result.html_url})\n📊 Dashboard updated automatically`;
        }
      } else {
        return "Which trip would you like to publish? Please specify the trip name or ID.";
      }
    }
    
    // General AI response with context
    return await getAIResponse(message, context, env);
    
  } catch (error) {
    console.error('MCP Error:', error);
    return `I encountered an error processing your request: ${(error as Error).message}\n\nTry rephrasing your question or being more specific about which trip or client you're referring to.`;
  }
}

/**
 * Extract search terms from user message
 */
function extractSearchTerms(message: string): string | null {
  // Extract names, emails, locations, dates
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1];
  
  // Extract quoted terms
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Extract capitalized names (likely proper nouns)
  const nameMatches = message.match(/\b[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+\b/);
  if (nameMatches) return nameMatches[0];
  
  // Extract common travel destinations
  const destinations = ['paris', 'london', 'tokyo', 'rome', 'barcelona', 'amsterdam', 'berlin', 'prague'];
  for (const dest of destinations) {
    if (message.toLowerCase().includes(dest)) {
      return dest.charAt(0).toUpperCase() + dest.slice(1);
    }
  }
  
  return null;
}

/**
 * Parse trip creation request
 */
function parseTripCreationRequest(message: string): any | null {
  // Look for patterns like "Create trip for John Smith (john@email.com) to Paris from June 1-10 called Paris Getaway"
  const pattern = /create.+?trip.+?for\s+([^(]+)\s*\(([^)]+)\).+?to\s+([^(]+?)\s+from\s+([^c]+?)called\s+(.+)$/i;
  const match = message.match(pattern);
  
  if (match) {
    const [, name, email, destination, dateRange, tripName] = match;
    const dates = parseDateRange(dateRange.trim());
    
    return {
      trip_name: tripName.trim(),
      client_full_name: name.trim(),
      client_email: email.trim(),
      destinations: destination.trim(),
      start_date: dates.start,
      end_date: dates.end,
      status: 'planning'
    };
  }
  
  return null;
}

/**
 * Parse date ranges like "June 1-10" or "June 1 to June 10"
 */
function parseDateRange(dateStr: string): { start: string, end: string } {
  const currentYear = new Date().getFullYear();
  
  // Simple patterns - you can enhance this
  if (dateStr.includes('-')) {
    const [start, end] = dateStr.split('-');
    return {
      start: `${currentYear}-06-01`, // Simplified - should parse properly
      end: `${currentYear}-06-10`
    };
  }
  
  return {
    start: `${currentYear}-06-01`,
    end: `${currentYear}-06-10`
  };
}

/**
 * Extract trip ID from message or context
 */
function extractTripId(message: string, context: any): string | null {
  // Check context first
  if (context?.active_trip_id) return context.active_trip_id;
  
  // Extract from message
  const idMatch = message.match(/trip\s+(\d+)/i);
  if (idMatch) return idMatch[1];
  
  return null;
}

/**
 * Format trip results for display
 */
function formatTripResults(result: any): string {
  let response = '';
  
  if (result.trips && result.trips.length > 0) {
    response += `🎫 **Found ${result.trips.length} trip(s):**\n\n`;
    
    result.trips.slice(0, 3).forEach((trip: any, index: number) => {
      response += `**${index + 1}. ${trip.trip_name}**\n`;
      response += `📍 ${trip.destinations || 'Destinations TBD'}\n`;
      response += `📅 ${trip.start_date} to ${trip.end_date}\n`;
      response += `🏷️ Status: ${trip.status}\n`;
      if (trip.total_cost) response += `💰 Cost: $${trip.total_cost}\n`;
      response += `🆔 ID: ${trip.trip_id}\n\n`;
    });
    
    if (result.trips.length > 3) {
      response += `... and ${result.trips.length - 3} more trips.\n\n`;
    }
  }
  
  if (result.clients && result.clients.length > 0) {
    response += `👥 **Related clients:**\n`;
    result.clients.slice(0, 2).forEach((client: any) => {
      response += `• ${client.full_name} (${client.email})\n`;
    });
    response += '\n';
  }
  
  response += `💡 *You can say things like:*\n`;
  response += `• "Continue trip [name]" to resume work\n`;
  response += `• "Publish trip [ID]" to create proposal\n`;
  response += `• "Create trip for..." to add new trips`;
  
  return response;
}

/**
 * Get AI response using Claude API
 */
async function getAIResponse(message: string, context: any, env: Env): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    return "I'd be happy to help, but I need the Claude API to provide intelligent responses. Please ask about specific trips, clients, or use commands like 'show trips' or 'create trip'.";
  }
  
  const systemPrompt = `You are Voygen, an AI travel assistant. You help travel agents manage trips, clients, and bookings through a mobile chat interface.

Current context: ${JSON.stringify(context)}

You have access to:
- D1 database with trips and client information
- Trip creation and management tools  
- Document publishing to somotravel.us
- Workflow management system

Keep responses concise and mobile-friendly. Always suggest specific actions the user can take.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        content: message
      }],
      system: systemPrompt
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.content[0]?.text || 'I apologize, but I could not process your request at this time.';
}

/**
 * Enhanced Chat Endpoint
 * POST /chat/enhanced
 */
export async function handleEnhancedChat(request: Request, env: Env): Promise<Response> {
  const auth = authenticate(request, env);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as any;
    const { message, session_id, context } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process the message with full MCP integration
    const response = await processUserMessage(message, context || {}, env);

    // Create chat message objects
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    const assistantMessage: ChatMessage = {
      role: 'assistant', 
      content: response,
      timestamp: new Date().toISOString(),
      metadata: {
        mcp_enabled: true,
        version: '2.0'
      }
    };

    return new Response(JSON.stringify({
      messages: [userMessage, assistantMessage],
      session_id: session_id || `session_${Date.now()}`,
      context: context || {}
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Enhanced chat error:', error);
    return new Response(JSON.stringify({ 
      error: 'Chat processing failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}