/**
 * D1 Travel Database MCP Server - Simple Streamable HTTP Transport
 * Compatible with ChatMCP iOS and other POST-based MCP clients
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from './types';
import { llmOptimizedTools } from './tools/llm-optimized-tools';
import { getWorkflowStatusTool } from './tools/workflow-tools';
import type { D1Database } from '@cloudflare/workers-types';
import { 
  generateProposalSchema,
  previewProposalSchema,
  listTemplatesSchema,
  handleGenerateProposal,
  handlePreviewProposal,
  handleListTemplates
} from './tools/proposal-tools';

// Define all available tools
const allTools = [
  ...llmOptimizedTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema) as any,
    handler: tool.handler
  })),
  {
    name: 'generate_proposal',
    description: 'Generate a travel proposal from trip data with HTML rendering and optional PDF',
    inputSchema: zodToJsonSchema(generateProposalSchema) as any,
    handler: handleGenerateProposal
  },
  {
    name: 'preview_proposal', 
    description: 'Preview proposal HTML without saving to database',
    inputSchema: zodToJsonSchema(previewProposalSchema) as any,
    handler: handlePreviewProposal
  },
  {
    name: 'list_templates',
    description: 'List available proposal templates and generation capabilities',
    inputSchema: zodToJsonSchema(listTemplatesSchema) as any,
    handler: handleListTemplates
  }
];

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Detect if this is a ChatMCP iOS client vs LibreChat/mcp-remote
 */
function isStreamableHttpClient(userAgent?: string, accept?: string, pathname?: string): boolean {
  // LibreChat/mcp-remote characteristics:
  // 1. Uses /sse endpoint (not the main endpoints)
  // 2. Node.js user agent pattern
  if (pathname === '/sse' || userAgent?.includes('node')) {
    return false;
  }
  
  // ChatMCP iOS characteristics:
  // 1. Includes both application/json and text/event-stream in Accept header
  // 2. Direct POST to root endpoints (/, /mcp, /jsonrpc)
  // 3. Mobile user agents (CFNetwork, iOS)
  if (accept?.includes('application/json') && accept?.includes('text/event-stream')) {
    return true;
  }
  
  // Additional heuristics for mobile clients
  if (userAgent?.toLowerCase().includes('cfnetwork') || userAgent?.toLowerCase().includes('ios')) {
    return true;
  }
  
  // Default to non-streamable (LibreChat style) for safety
  return false;
}

/**
 * Handle JSONRPC 2.0 requests for MCP with client-specific response format
 */
async function handleMcpRequest(request: any, env: Env, sessionId?: string, isStreamableClient: boolean = false): Promise<{response: any, headers: Record<string, string>}> {
  const { method, params, id } = request;
  
  try {
    switch (method) {
      case 'initialize':
        const newSessionId = generateSessionId();
        const initResponse = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: isStreamableClient ? '2025-03-26' : '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'D1 Travel Database',
              version: '4.2.0',
              description: 'D1 Travel Database MCP for trip and client management'
            }
          }
        };
        
        return {
          response: initResponse,
          headers: isStreamableClient ? { 'Mcp-Session-Id': newSessionId } : {}
        };
        
      case 'tools/list':
        const toolsResponse = {
          jsonrpc: '2.0',
          id,
          result: {
            tools: allTools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          }
        };
        
        return {
          response: toolsResponse,
          headers: {}
        };
        
      case 'tools/call':
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        
        const tool = allTools.find(t => t.name === toolName);
        if (!tool) {
          return {
            response: {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Tool not found: ${toolName}`
              }
            },
            headers: {}
          };
        }
        
        try {
          let result;
          if (tool.name === 'generate_proposal') {
            result = await handleGenerateProposal(toolArgs, env);
          } else if (tool.name === 'preview_proposal') {
            result = await handlePreviewProposal(toolArgs, env);
          } else if (tool.name === 'list_templates') {
            result = await handleListTemplates(toolArgs, env);
          } else {
            result = await tool.handler(toolArgs, env.DB);
          }
          
          return {
            response: {
              jsonrpc: '2.0',
              id,
              result: {
                content: [{
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }]
              }
            },
            headers: {}
          };
        } catch (error: any) {
          return {
            response: {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32603,
                message: error.message || 'Internal error',
                data: error.stack
              }
            },
            headers: {}
          };
        }
        
      default:
        return {
          response: {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          },
          headers: {}
        };
    }
  } catch (error: any) {
    return {
      response: {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      },
      headers: {}
    };
  }
}

/**
 * Cloudflare Worker main handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id',
          'Access-Control-Expose-Headers': 'Mcp-Session-Id',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Health check or business status endpoint
    if (url.pathname === '/health' || url.pathname === '/status') {
      // If a query is provided, return compact business status for StatusBar
      const q = url.searchParams.get('q')?.trim();
      if (request.method === 'GET') {
        if (q) {
          const summary = await getCompactStatus(env.DB, q);
          return new Response(JSON.stringify(summary), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        // No query: fall back to most recent trip activity
        const recent = await getRecentActivities(env.DB, 1);
        if (recent.length > 0) {
          const idOrName = recent[0].trip_name || String(recent[0].trip_id);
          const summary = await getCompactStatus(env.DB, idOrName);
          return new Response(JSON.stringify(summary), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }
      // Default: plain health payload
      return new Response(JSON.stringify({
        status: 'healthy',
        transport: 'streamable-http',
        version: '4.2.0',
        tools: allTools.length,
        endpoints: {
          main: '/ (POST)',
          sse: '/sse (GET/POST)', 
          health: '/health (GET)'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Auto-start helper: returns startup greeting and recent work
    if (url.pathname === '/start' && request.method === 'GET') {
      const recent = await getRecentActivities(env.DB, 5);
      const greeting = await fetchTravelAgentStart(env).catch(() => undefined);
      const top = recent[0];
      let suggestion: string | undefined;
      if (top?.phase === 'planning' && (top?.hasTransport && top?.hasAccommodations)) {
        suggestion = 'Consider adding commissioned tours and activities next.';
      }
      return new Response(
        JSON.stringify({
          ok: true,
          autoStart: true,
          message: 'Claude Travel Agent System Ready',
          greeting,
          recent,
          suggestion,
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      );
    }
    
    // SSE endpoint for backward compatibility
    if (url.pathname === '/sse') {
      if (request.method === 'GET') {
        // Traditional SSE stream
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: {"type":"connection","status":"ready"}\n\n'));
            
            // Keep alive ping every 30s
            const ping = setInterval(() => {
              try {
                controller.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
              } catch {
                clearInterval(ping);
              }
            }, 30000);
          }
        });
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else if (request.method === 'POST') {
        // Handle POST to /sse as JSONRPC - always return unwrapped for LibreChat compatibility
        try {
          const body = await request.json();
          const { response } = await handleMcpRequest(body, env, undefined, false);
          
          return new Response(JSON.stringify(response), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error.message
            }
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
    }
    
    // Main Streamable HTTP endpoint - handle multiple common paths
    if ((url.pathname === '/' || url.pathname === '/mcp' || url.pathname === '/jsonrpc') && request.method === 'POST') {
      try {
        const body = await request.json();
        
        // Detect client type
        const userAgent = request.headers.get('User-Agent');
        const accept = request.headers.get('Accept');
        const isStreamableClient = isStreamableHttpClient(userAgent || '', accept || '', url.pathname);
        
        // Get session ID from header if present
        const sessionId = request.headers.get('Mcp-Session-Id');
        
        const { response, headers: responseHeaders } = await handleMcpRequest(body, env, sessionId || undefined, isStreamableClient);
        
        // For LibreChat/mcp-remote: return raw JSON-RPC response
        if (!isStreamableClient) {
          return new Response(JSON.stringify(response), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // For ChatMCP iOS: include MCP-specific headers
        const responseHeadersObj = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
          'Access-Control-Expose-Headers': 'Mcp-Session-Id',
          ...responseHeaders
        };
        
        return new Response(JSON.stringify(response), {
          headers: responseHeadersObj
        });
      } catch (error: any) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error.message
          }
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // Root GET - show info
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(`
        <html>
          <head><title>D1 Travel Database MCP Server</title></head>
          <body>
            <h1>D1 Travel Database MCP Server</h1>
            <p><strong>Version:</strong> 4.2.0</p>
            <p><strong>Transport:</strong> Streamable HTTP (JSONRPC 2.0)</p>
            <p><strong>Tools:</strong> ${allTools.length} available</p>
            <h2>Endpoints:</h2>
            <ul>
              <li><code>POST /</code> - Main MCP endpoint (JSONRPC 2.0)</li>
              <li><code>POST /mcp</code> - MCP endpoint (JSONRPC 2.0)</li>
              <li><code>POST /jsonrpc</code> - JSONRPC endpoint</li>
              <li><code>POST /sse</code> - Alternative MCP endpoint</li>
              <li><code>GET /sse</code> - SSE stream (legacy)</li>
              <li><code>GET /health</code> - Health check</li>
            </ul>
            <h2>Usage with ChatMCP:</h2>
            <pre>{"server": {"url": "https://d1-database-improved.somotravel.workers.dev", "transport": "http"}}</pre>
          </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 404 for other paths - with debugging info
    console.log(`404 - Method: ${request.method}, Path: ${url.pathname}, Headers:`, Object.fromEntries(request.headers.entries()));
    
    return new Response(JSON.stringify({
      error: 'Not Found',
      method: request.method,
      path: url.pathname,
      message: 'This endpoint is not available. Use POST to /, /mcp, or /jsonrpc for MCP communication.',
      availableEndpoints: [
        'POST /',
        'POST /mcp', 
        'POST /jsonrpc',
        'POST /sse',
        'GET /sse',
        'GET /health'
      ]
    }, null, 2), { 
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Helper: compact status query used by StatusBar
async function getCompactStatus(db: D1Database, identifier: string) {
  // Workflow status
  const wf = (await getWorkflowStatusTool.handler({ trip_identifier: identifier }, db)) as any;
  // Trip summary
  const trip = await findTripSummary(db, identifier);
  return {
    ok: true,
    tripName: wf?.trip_name || trip?.trip_name || undefined,
    dates: trip?.start_date && trip?.end_date ? `${trip.start_date} – ${trip.end_date}` : undefined,
    phase: wf?.current_phase || undefined,
    step: wf?.current_step || undefined,
    percent: Number.isFinite(wf?.progress_percentage) ? wf.progress_percentage : undefined,
    cost: trip?.total_cost ?? undefined,
    budget: trip?.financials?.budget ?? undefined,
    commission: trip?.financials?.commission ?? undefined,
    url: trip?.published_url ?? undefined,
  };
}

async function findTripSummary(db: D1Database, identifier: string) {
  const isNumeric = /^\d+$/.test(identifier);
  let row: any;
  if (isNumeric) {
    row = (await db.prepare(`SELECT trip_id, trip_name, start_date, end_date, total_cost, published_url, financials FROM trips_v2 WHERE trip_id = ? LIMIT 1`).bind(Number(identifier)).first()) as any;
  } else {
    const like = `%${identifier}%`;
    row = (await db.prepare(`
      SELECT trip_id, trip_name, start_date, end_date, total_cost, published_url, financials 
      FROM trips_v2 
      WHERE trip_name LIKE ? OR destinations LIKE ? OR primary_client_email LIKE ?
      ORDER BY updated_at DESC LIMIT 1
    `).bind(like, like, like).first()) as any;
  }
  if (!row) return null;
  try {
    row.financials = row.financials ? JSON.parse(row.financials) : {};
  } catch { row.financials = {}; }
  return row;
}

async function getRecentActivities(db: D1Database, limit = 5) {
  const rs = await db.prepare(
    `SELECT a.activity_id, a.trip_id, a.activity_type, a.activity_timestamp as ts, 
            t.trip_name, t.start_date, t.end_date, t.accommodations, t.transportation, t.workflow_state
     FROM ActivityLog a JOIN trips_v2 t ON a.trip_id = t.trip_id
     ORDER BY a.activity_timestamp DESC LIMIT ?`
  ).bind(limit).all();
  const items = (rs.results || []).map((r: any) => {
    let wf: any = {}; let acc: any[] = []; let trans: any[] = [];
    try { wf = r.workflow_state ? JSON.parse(r.workflow_state) : {}; } catch {}
    try { acc = r.accommodations ? JSON.parse(r.accommodations) : []; } catch {}
    try { trans = r.transportation ? JSON.parse(r.transportation) : []; } catch {}
    return {
      activity_id: r.activity_id,
      trip_id: r.trip_id,
      trip_name: r.trip_name,
      dates: r.start_date && r.end_date ? `${r.start_date} – ${r.end_date}` : undefined,
      phase: wf.current_phase,
      step: wf.current_step,
      hasAccommodations: Array.isArray(acc) && acc.length > 0,
      hasTransport: Array.isArray(trans) && trans.length > 0,
      ts: r.ts,
    };
  });
  return items;
}

// Helper: fetch startup/greeting text from Prompt Instructions MCP
async function fetchTravelAgentStart(env: Env): Promise<string | undefined> {
  const base = (env as any).PROMPT_INSTRUCTIONS_URL || 'https://prompt-instructions-d1-mcp.somotravel.workers.dev';
  const target = base.endsWith('/sse') ? base : base + '/sse';
  try {
    // Initialize (best-effort)
    await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    }).catch(() => undefined);

    // Call tool
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'travel_agent_start', arguments: {} },
      }),
    });
    const json = await resp.json();
    const content = json?.result?.content;
    if (Array.isArray(content) && content.length && content[0].text) {
      return content[0].text as string;
    }
    if (json?.result && typeof json.result === 'string') {
      return json.result as string;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
