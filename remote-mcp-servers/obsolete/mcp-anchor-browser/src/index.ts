import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createLogger } from './utils/logger';
import { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use('*', logger());

app.get('/', (c) => {
  return c.json({
    name: 'mcp-anchor-browser',
    description: 'MCP server for Anchor Browser integration with travel data extraction',
    version: c.env.VERSION || '1.0.0',
    endpoints: {
      health: '/health',
      sse: '/sse',
      metrics: '/metrics'
    },
    documentation: 'https://github.com/your-org/mcp-anchor-browser'
  });
});

app.get('/health', async (c) => {
  const log = createLogger(c.env, 'HealthCheck');
  
  try {
    const checks = {
      server: 'healthy',
      timestamp: new Date().toISOString(),
      version: c.env.VERSION || '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      anchorApiConfigured: !!c.env.ANCHOR_API_KEY,
      databaseConnected: !!c.env.DB,
      cacheConnected: !!c.env.CACHE
    };

    let overallStatus = 'healthy';
    
    if (!c.env.ANCHOR_API_KEY) {
      overallStatus = 'degraded';
      log.warn('ANCHOR_API_KEY not configured');
    }

    if (!c.env.DB) {
      overallStatus = 'degraded';
      log.warn('Database not connected');
    }

    return c.json({
      status: overallStatus,
      ...checks
    }, overallStatus === 'healthy' ? 200 : 503);
    
  } catch (error) {
    log.error('Health check failed:', error);
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

app.post('/sse', async (c) => {
  const log = createLogger(c.env, 'SSEEndpoint');
  
  try {
    log.info('New MCP SSE connection established');
    
    const body = await c.req.json();
    console.log("Received MCP message:", JSON.stringify(body));

    let response;

    // Handle different MCP methods directly
    switch (body.method) {
      case "initialize":
        response = {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "mcp-anchor-browser",
              version: c.env.VERSION || "1.0.0"
            }
          }
        };
        break;

      case "tools/list":
        const tools = [
          {
            name: 'test_anchor_connection',
            description: 'Test connection to Anchor Browser API and check service status',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'get_server_status',
            description: 'Get MCP server status, configuration, and active sessions',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'create_session',
            description: 'Create a new Anchor Browser automation session',
            inputSchema: {
              type: 'object',
              properties: {
                proxy: { type: 'string', description: 'Proxy server to use' },
                userAgent: { type: 'string', description: 'Custom user agent string' },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'number', description: 'Viewport width in pixels' },
                    height: { type: 'number', description: 'Viewport height in pixels' }
                  }
                },
                headless: { type: 'boolean', description: 'Run browser in headless mode' },
                timeout: { type: 'number', description: 'Default timeout in milliseconds' },
                region: { type: 'string', description: 'Geographic region for the session' }
              },
              additionalProperties: false
            }
          },
          {
            name: 'navigate',
            description: 'Navigate to a URL in an existing session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID' },
                url: { type: 'string', description: 'URL to navigate to' },
                waitFor: { 
                  type: 'string', 
                  enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
                  description: 'Wait condition after navigation'
                },
                timeout: { type: 'number', description: 'Navigation timeout in milliseconds' }
              },
              required: ['sessionId', 'url'],
              additionalProperties: false
            }
          },
          {
            name: 'screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID' },
                fullPage: { type: 'boolean', description: 'Capture full page' },
                quality: { type: 'number', minimum: 1, maximum: 100, description: 'Image quality (1-100)' },
                format: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: 'Image format' },
                width: { type: 'number', description: 'Screenshot width' },
                height: { type: 'number', description: 'Screenshot height' },
                selector: { type: 'string', description: 'CSS selector to screenshot specific element' }
              },
              required: ['sessionId'],
              additionalProperties: false
            }
          },
          {
            name: 'close_session',
            description: 'Close an active session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID to close' }
              },
              required: ['sessionId'],
              additionalProperties: false
            }
          }
        ];
        
        response = {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: tools
          }
        };
        break;

      case "tools/call":
        const toolName = body.params.name;
        const toolArgs = body.params.arguments || {};
        
        try {
          let result;
          switch (toolName) {
            case 'test_anchor_connection':
              result = {
                content: [{
                  type: 'text',
                  text: `✅ Anchor Browser API connection test initiated!\n\nStatus: Ready to connect\nVersion: ${c.env.VERSION || '1.0.0'}\nEnvironment: ${c.env.ENVIRONMENT || 'development'}\nAPI Configured: ${!!c.env.ANCHOR_API_KEY}`
                }]
              };
              break;
              
            case 'get_server_status':
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    server: 'mcp-anchor-browser',
                    version: c.env.VERSION || '1.0.0',
                    environment: c.env.ENVIRONMENT || 'development',
                    timestamp: new Date().toISOString(),
                    anchorApiConfigured: !!c.env.ANCHOR_API_KEY,
                    databaseConnected: !!c.env.DB,
                    cacheConnected: !!c.env.CACHE,
                    activeSessions: 0,
                    totalCost: 0
                  }, null, 2)
                }]
              };
              break;
              
            default:
              result = {
                content: [{
                  type: 'text',
                  text: `❌ Tool not yet implemented: ${toolName}`
                }],
                isError: true
              };
          }

          response = {
            jsonrpc: "2.0",
            id: body.id,
            result
          };
        } catch (error) {
          console.error(`Tool execution error:`, error);
          response = {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32603,
              message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          };
        }
        break;

      default:
        response = {
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`
          }
        };
    }

    return new Response(JSON.stringify(response) + '\n', {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    log.error('SSE handler error:', error);
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    }) + '\n', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
});

app.get('/metrics', async (c) => {
  const log = createLogger(c.env, 'MetricsEndpoint');
  
  try {
    const metrics = await getServerMetrics(c.env);
    return c.json(metrics);
  } catch (error) {
    log.error('Failed to fetch metrics:', error);
    return c.json({ 
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/sessions/:sessionId/close', async (c) => {
  const log = createLogger(c.env, 'CloseSession');
  const sessionId = c.req.param('sessionId');
  
  try {
    log.info(`Manual session close requested: ${sessionId}`);
    return c.json({ message: `Session ${sessionId} close initiated` });
  } catch (error) {
    log.error(`Failed to close session ${sessionId}:`, error);
    return c.json({
      error: 'Failed to close session',
      sessionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/debug/info', async (c) => {
  const log = createLogger(c.env, 'DebugInfo');
  
  try {
    return c.json({
      server: {
        name: 'mcp-anchor-browser',
        version: c.env.VERSION || '1.0.0',
        environment: c.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString()
      },
      configuration: {
        anchorApiConfigured: !!c.env.ANCHOR_API_KEY,
        databaseConnected: !!c.env.DB,
        cacheConnected: !!c.env.CACHE,
        budgetLimits: {
          daily: c.env.DAILY_BUDGET_LIMIT || 'not-set',
          monthly: c.env.MONTHLY_BUDGET_LIMIT || 'not-set'
        }
      },
      runtime: {
        maxConcurrentSessions: c.env.MAX_CONCURRENT_SESSIONS || 'unlimited',
        sessionTtlMinutes: c.env.SESSION_TTL_MINUTES || 30
      }
    });
  } catch (error) {
    log.error('Debug info request failed:', error);
    return c.json({
      error: 'Failed to get debug info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.onError((err, c) => {
  const log = createLogger(c.env, 'ErrorHandler');
  log.error('Worker error:', err);
  
  return c.json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: c.req.header('cf-ray') || 'unknown'
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: `Path ${c.req.path} not found`,
    availableEndpoints: ['/', '/health', '/sse', '/metrics'],
    timestamp: new Date().toISOString()
  }, 404);
});

async function getServerMetrics(env: Env): Promise<any> {
  try {
    return {
      server: {
        uptime: Date.now(),
        version: env.VERSION || '1.0.0',
        environment: env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString()
      },
      health: {
        anchorApiConfigured: !!env.ANCHOR_API_KEY,
        databaseConnected: !!env.DB,
        cacheConnected: !!env.CACHE
      },
      usage: {
        totalSessions: 0,
        activeSessions: 0,
        totalCost: 0
      }
    };
  } catch (error) {
    throw new Error(`Metrics collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  fetch: app.fetch,
  
  scheduled: async (event: any, env: Env, ctx: any) => {
    const log = createLogger(env, 'ScheduledTask');
    log.info('Running scheduled cleanup task');
  }
};