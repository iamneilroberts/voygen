/**
 * Voygen Mobile API - Refactored modular version
 * Main entry point with clean imports and routing
 */

import { Env } from './types';
import { handleCors, corsHeaders } from './auth';
import { handleGetTrips, handleCreateTrip, handleGetTrip, handleUpdateTrip } from './handlers/trips';
import { handleRenderProposal, handlePublishTrip } from './handlers/proposals';
import { handleTripChat } from './handlers/chat';
import { handleEnhancedChat } from './handlers/enhanced-chat';
import { getMobileInterfaceHTML } from './templates/mobile';
import { getMobileChatHTML } from './templates/mobile-chat';

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

  // Serve mobile interfaces
  if ((path === '/' || path === '/mobile' || path === '/mobile/') && method === 'GET') {
    return new Response(getMobileInterfaceHTML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }
  
  // Serve enhanced chat interface
  if (path === '/chat' && method === 'GET') {
    return new Response(getMobileChatHTML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }

  // Health check
  if (path === '/health' && method === 'GET') {
    return new Response(JSON.stringify({
      status: 'healthy',
      version: '1.0.0-modular',
      endpoints: {
        'GET /': 'Mobile interface',
        'GET /mobile': 'Mobile interface', 
        'GET /chat': 'Enhanced chat interface',
        'GET /trips': 'List trips',
        'POST /trips': 'Create trip', 
        'GET /trips/:id': 'Get trip',
        'PATCH /trips/:id': 'Update trip',
        'POST /proposals/:id/render': 'Render proposal',
        'POST /publish/:id': 'Publish trip',
        'POST /chat/:id': 'Chat with AI about trip',
        'POST /chat/enhanced': 'Enhanced AI chat with full MCP integration'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Trip routes
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

  // Proposal routes
  const proposalMatch = path.match(/^\/proposals\/(\d+)\/render$/);
  if (proposalMatch && method === 'POST') {
    return handleRenderProposal(proposalMatch[1], request, env);
  }

  const publishMatch = path.match(/^\/publish\/(\d+)$/);
  if (publishMatch && method === 'POST') {
    return handlePublishTrip(publishMatch[1], request, env);
  }

  // Chat routes
  const chatMatch = path.match(/^\/chat\/(\d+)$/);
  if (chatMatch && method === 'POST') {
    return handleTripChat(chatMatch[1], request, env);
  }
  
  // Enhanced chat endpoint
  if (path === '/chat/enhanced' && method === 'POST') {
    return handleEnhancedChat(request, env);
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