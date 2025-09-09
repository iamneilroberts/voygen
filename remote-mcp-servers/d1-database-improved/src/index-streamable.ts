/**
 * D1 Travel Database MCP Server - Streamable HTTP Transport
 * Compatible with ChatMCP iOS and other clients that use POST-based streaming
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from './types';
import { DatabaseManager } from './database/manager';
import { SchemaValidator } from './database/validation';
import { ErrorLogger } from './database/errors';
import { FactTableManager } from './database/facts';
import { TriggerManager } from './database/triggers';
import { llmOptimizedTools } from './tools/llm-optimized-tools';
import { registerHotelManagementTools } from './tools/hotel-management';
import { registerFactManagementTools } from './tools/fact-management';
import { registerCommissionEngineTools } from './tools/commission-engine';
import { registerDatabaseRepairTools } from './tools/database-repair';
import { 
  generateProposalSchema,
  previewProposalSchema,
  listTemplatesSchema,
  handleGenerateProposal,
  handlePreviewProposal,
  handleListTemplates
} from './tools/proposal-tools';

// Create server instance with tools capability
const server = new Server({
  name: 'D1 Travel Database',
  version: '4.2.0',
  description: 'D1 Travel Database MCP for trip and client management'
}, {
  capabilities: {
    tools: {}
  }
});

// Global environment reference
let globalEnv: Env;

// Register all tools (same as original)
function registerTools() {
  // Register LLM-optimized tools
  for (const tool of llmOptimizedTools) {
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [{
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema) as any
      }]
    }));
  }
  
  // Register other tools
  registerHotelManagementTools(server, () => globalEnv);
  registerFactManagementTools(server, () => globalEnv);
  registerCommissionEngineTools(server, () => globalEnv);
  registerDatabaseRepairTools(server, () => globalEnv);
  
  // Register proposal tools
  server.tool('generate_proposal', generateProposalSchema, 
    async (params) => handleGenerateProposal(params, globalEnv));
  server.tool('preview_proposal', previewProposalSchema,
    async (params) => handlePreviewProposal(params, globalEnv));
  server.tool('list_templates', listTemplatesSchema,
    async (params) => handleListTemplates(params, globalEnv));
}

// Initialize server with all tools
registerTools();

/**
 * Cloudflare Worker handler for Streamable HTTP transport
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    globalEnv = env; // Store environment for tool handlers
    
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Handle both SSE endpoint (GET/POST) for compatibility
    if (url.pathname === '/sse' && (request.method === 'GET' || request.method === 'POST')) {
      // For POST, read any initialization payload
      let initPayload = null;
      if (request.method === 'POST') {
        try {
          initPayload = await request.json();
        } catch {
          // Ignore JSON parse errors, continue without init payload
        }
      }
      
      // Create SSE stream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          // Send initial connection message
          controller.enqueue(encoder.encode('data: {"type":"connection","status":"connected"}\n\n'));
          
          // If we have an init payload, process it
          if (initPayload) {
            controller.enqueue(encoder.encode(`data: {"type":"init","payload":${JSON.stringify(initPayload)}}\n\n`));
          }
          
          // Keep connection alive with periodic pings
          const pingInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
            } catch {
              clearInterval(pingInterval);
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
    }
    
    // Main Streamable HTTP endpoint - accepts POST with JSONRPC
    if (url.pathname === '/' && request.method === 'POST') {
      try {
        const body = await request.text();
        
        // Create a text encoder for streaming
        const encoder = new TextEncoder();
        
        // Create streaming response
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Parse JSONRPC request
              const jsonrpcRequest = JSON.parse(body);
              
              // Handle the request through MCP server
              if (jsonrpcRequest.method === 'tools/list') {
                // Return all available tools
                const tools = [
                  ...llmOptimizedTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: zodToJsonSchema(tool.inputSchema)
                  })),
                  {
                    name: 'generate_proposal',
                    description: 'Generate a travel proposal from trip data with HTML rendering and optional PDF',
                    inputSchema: zodToJsonSchema(generateProposalSchema)
                  },
                  {
                    name: 'preview_proposal',
                    description: 'Preview proposal HTML without saving to database',
                    inputSchema: zodToJsonSchema(previewProposalSchema)
                  },
                  {
                    name: 'list_templates',
                    description: 'List available proposal templates and generation capabilities',
                    inputSchema: zodToJsonSchema(listTemplatesSchema)
                  }
                ];
                
                const response = {
                  jsonrpc: '2.0',
                  id: jsonrpcRequest.id,
                  result: { tools }
                };
                
                controller.enqueue(encoder.encode(JSON.stringify(response)));
                
              } else if (jsonrpcRequest.method === 'tools/call') {
                // Execute tool call
                const toolName = jsonrpcRequest.params?.name;
                const toolArgs = jsonrpcRequest.params?.arguments || {};
                
                // Find and execute the tool
                const tool = llmOptimizedTools.find(t => t.name === toolName);
                
                if (tool) {
                  try {
                    const result = await tool.handler(toolArgs, globalEnv.DB);
                    
                    const response = {
                      jsonrpc: '2.0',
                      id: jsonrpcRequest.id,
                      result: {
                        content: [{ 
                          type: 'text', 
                          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                        }]
                      }
                    };
                    
                    controller.enqueue(encoder.encode(JSON.stringify(response)));
                  } catch (error: any) {
                    const errorResponse = {
                      jsonrpc: '2.0',
                      id: jsonrpcRequest.id,
                      error: {
                        code: -32603,
                        message: error.message || 'Internal error'
                      }
                    };
                    
                    controller.enqueue(encoder.encode(JSON.stringify(errorResponse)));
                  }
                } else {
                  // Handle special tools
                  let result;
                  switch (toolName) {
                    case 'generate_proposal':
                      result = await handleGenerateProposal(toolArgs, globalEnv);
                      break;
                    case 'preview_proposal':
                      result = await handlePreviewProposal(toolArgs, globalEnv);
                      break;
                    case 'list_templates':
                      result = await handleListTemplates(toolArgs, globalEnv);
                      break;
                    default:
                      const errorResponse = {
                        jsonrpc: '2.0',
                        id: jsonrpcRequest.id,
                        error: {
                          code: -32601,
                          message: `Tool not found: ${toolName}`
                        }
                      };
                      controller.enqueue(encoder.encode(JSON.stringify(errorResponse)));
                      controller.close();
                      return;
                  }
                  
                  const response = {
                    jsonrpc: '2.0',
                    id: jsonrpcRequest.id,
                    result: {
                      content: [{ 
                        type: 'text', 
                        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                      }]
                    }
                  };
                  
                  controller.enqueue(encoder.encode(JSON.stringify(response)));
                }
                
              } else if (jsonrpcRequest.method === 'initialize') {
                // Handle initialization
                const response = {
                  jsonrpc: '2.0',
                  id: jsonrpcRequest.id,
                  result: {
                    protocolVersion: '2024-11-05',
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
                
                controller.enqueue(encoder.encode(JSON.stringify(response)));
                
              } else {
                // Unknown method
                const errorResponse = {
                  jsonrpc: '2.0',
                  id: jsonrpcRequest.id,
                  error: {
                    code: -32601,
                    message: `Method not found: ${jsonrpcRequest.method}`
                  }
                };
                
                controller.enqueue(encoder.encode(JSON.stringify(errorResponse)));
              }
              
            } catch (error: any) {
              // Send error response
              const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32700,
                  message: 'Parse error',
                  data: error.message
                }
              };
              
              controller.enqueue(encoder.encode(JSON.stringify(errorResponse)));
            } finally {
              controller.close();
            }
          }
        });
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
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
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        transport: 'streamable-http',
        version: '4.2.0'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Default 404
    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};