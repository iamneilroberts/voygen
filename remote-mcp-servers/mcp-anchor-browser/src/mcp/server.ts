import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  TextContent,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AnchorBrowserClient } from '../clients/anchor-browser';
import { createLogger, Logger } from '../utils/logger';
import { createMCPErrorResponse, AnchorMCPError } from '../utils/errors';
import { Env } from '../types/env';

const CreateSessionSchema = z.object({
  proxy: z.string().optional(),
  userAgent: z.string().optional(),
  viewport: z.object({
    width: z.number(),
    height: z.number()
  }).optional(),
  headless: z.boolean().optional(),
  timeout: z.number().optional(),
  region: z.string().optional()
});

const NavigateSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional(),
  timeout: z.number().optional()
});

const ScreenshotSchema = z.object({
  sessionId: z.string(),
  fullPage: z.boolean().optional(),
  quality: z.number().min(1).max(100).optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  selector: z.string().optional()
});

const ExtractSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  attribute: z.string().optional(),
  multiple: z.boolean().optional(),
  format: z.enum(['text', 'html', 'json']).optional(),
  schema: z.any().optional()
});

const ClickSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  clickCount: z.number().optional(),
  delay: z.number().optional()
});

const TypeSchema = z.object({
  sessionId: z.string(),
  selector: z.string(),
  text: z.string(),
  delay: z.number().optional(),
  clear: z.boolean().optional()
});

const WaitSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  timeout: z.number().optional(),
  visible: z.boolean().optional(),
  hidden: z.boolean().optional()
});

export class MCPServer {
  private server: Server;
  private anchorClient: AnchorBrowserClient;
  private logger: Logger;

  constructor(private env: Env) {
    this.logger = createLogger(env, 'MCPServer');
    
    this.server = new Server(
      {
        name: 'mcp-anchor-browser',
        version: env.VERSION || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      }
    );

    if (!env.ANCHOR_API_KEY) {
      this.logger.warn('ANCHOR_API_KEY not configured - API calls will fail');
    }

    this.anchorClient = new AnchorBrowserClient(env.ANCHOR_API_KEY || 'test-key', env);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAvailableTools()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info(`Executing tool: ${name}`, { args });
        return await this.handleToolCall(name, args || {});
      } catch (error) {
        this.logger.error(`Tool call error for ${name}:`, error);
        
        if (error instanceof AnchorMCPError) {
          return createMCPErrorResponse(error);
        }
        
        return createMCPErrorResponse(new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  private getAvailableTools(): Tool[] {
    return [
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
        name: 'extract_data',
        description: 'Extract data from the current page using CSS selectors',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            selector: { type: 'string', description: 'CSS selector for elements to extract' },
            attribute: { type: 'string', description: 'HTML attribute to extract (default: text content)' },
            multiple: { type: 'boolean', description: 'Extract multiple elements' },
            format: { type: 'string', enum: ['text', 'html', 'json'], description: 'Output format' },
            schema: { type: 'object', description: 'JSON schema for structured extraction' }
          },
          required: ['sessionId'],
          additionalProperties: false
        }
      },
      {
        name: 'click_element',
        description: 'Click on an element or coordinates',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            selector: { type: 'string', description: 'CSS selector for element to click' },
            coordinates: {
              type: 'object',
              properties: {
                x: { type: 'number', description: 'X coordinate' },
                y: { type: 'number', description: 'Y coordinate' }
              },
              description: 'Click coordinates (alternative to selector)'
            },
            button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button' },
            clickCount: { type: 'number', description: 'Number of clicks' },
            delay: { type: 'number', description: 'Delay between clicks in ms' }
          },
          required: ['sessionId'],
          additionalProperties: false
        }
      },
      {
        name: 'type_text',
        description: 'Type text into an input field',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            selector: { type: 'string', description: 'CSS selector for input field' },
            text: { type: 'string', description: 'Text to type' },
            delay: { type: 'number', description: 'Delay between keystrokes in ms' },
            clear: { type: 'boolean', description: 'Clear field before typing' }
          },
          required: ['sessionId', 'selector', 'text'],
          additionalProperties: false
        }
      },
      {
        name: 'wait_for_element',
        description: 'Wait for an element to appear, disappear, or meet certain conditions',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            selector: { type: 'string', description: 'CSS selector for element to wait for' },
            timeout: { type: 'number', description: 'Timeout in milliseconds' },
            visible: { type: 'boolean', description: 'Wait for element to be visible' },
            hidden: { type: 'boolean', description: 'Wait for element to be hidden' }
          },
          required: ['sessionId'],
          additionalProperties: false
        }
      },
      {
        name: 'get_session_metrics',
        description: 'Get metrics and statistics for a session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' }
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
      },
      {
        name: 'get_budget_status',
        description: 'Get current budget usage and limits',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    ];
  }

  private async handleToolCall(name: string, args: any): Promise<CallToolResult> {
    switch (name) {
      case 'test_anchor_connection':
        return await this.testAnchorConnection();
      
      case 'get_server_status':
        return await this.getServerStatus();
      
      case 'create_session':
        return await this.createSession(CreateSessionSchema.parse(args));
      
      case 'navigate':
        return await this.navigate(NavigateSchema.parse(args));
      
      case 'screenshot':
        return await this.screenshot(ScreenshotSchema.parse(args));
      
      case 'extract_data':
        return await this.extractData(ExtractSchema.parse(args));
      
      case 'click_element':
        return await this.clickElement(ClickSchema.parse(args));
      
      case 'type_text':
        return await this.typeText(TypeSchema.parse(args));
      
      case 'wait_for_element':
        return await this.waitForElement(WaitSchema.parse(args));
      
      case 'get_session_metrics':
        return await this.getSessionMetrics(args);
      
      case 'close_session':
        return await this.closeSession(args);
      
      case 'get_budget_status':
        return await this.getBudgetStatus();
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async testAnchorConnection(): Promise<CallToolResult> {
    try {
      const result = await this.anchorClient.testConnection();
      return {
        content: [{
          type: 'text',
          text: `✅ Anchor Browser API connection successful!\n\nStatus: ${result.status}\nVersion: ${result.version}\nRegions: ${result.regions?.join(', ') || 'N/A'}\nLimits: ${JSON.stringify(result.limits, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Anchor Browser API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async getServerStatus(): Promise<CallToolResult> {
    const activeSessions = this.anchorClient.getActiveSessions();
    const totalCost = this.anchorClient.getTotalCost();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          server: 'mcp-anchor-browser',
          version: this.env.VERSION || '1.0.0',
          environment: this.env.ENVIRONMENT || 'development',
          timestamp: new Date().toISOString(),
          anchorApiConfigured: !!this.env.ANCHOR_API_KEY,
          databaseConnected: !!this.env.DB,
          cacheConnected: !!this.env.CACHE,
          activeSessions: activeSessions.length,
          totalCost: totalCost,
          sessions: activeSessions.map(s => ({
            id: s.id,
            status: s.status,
            createdAt: s.createdAt,
            cost: s.totalCost
          }))
        }, null, 2)
      }]
    };
  }

  private async createSession(args: z.infer<typeof CreateSessionSchema>): Promise<CallToolResult> {
    try {
      const session = await this.anchorClient.createSession(args);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Created new session: ${session.id}\n\nCost: $${session.totalCost.toFixed(4)}\nStatus: ${session.status}\nCreated: ${session.createdAt.toISOString()}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async navigate(args: z.infer<typeof NavigateSchema>): Promise<CallToolResult> {
    try {
      await this.anchorClient.navigate(args.sessionId, {
        url: args.url,
        waitFor: args.waitFor,
        timeout: args.timeout
      });
      
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully navigated to: ${args.url}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async screenshot(args: z.infer<typeof ScreenshotSchema>): Promise<CallToolResult> {
    try {
      const screenshotBase64 = await this.anchorClient.screenshot(args.sessionId, {
        fullPage: args.fullPage,
        quality: args.quality,
        format: args.format,
        width: args.width,
        height: args.height,
        selector: args.selector
      });
      
      return {
        content: [{
          type: 'text',
          text: `✅ Screenshot captured successfully!\n\nData: ${screenshotBase64.substring(0, 100)}...`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async extractData(args: z.infer<typeof ExtractSchema>): Promise<CallToolResult> {
    try {
      const result = await this.anchorClient.extract(args.sessionId, {
        selector: args.selector,
        attribute: args.attribute,
        multiple: args.multiple,
        format: args.format,
        schema: args.schema
      });
      
      return {
        content: [{
          type: 'text',
          text: `✅ Data extracted successfully!\n\nCost: $${result.cost.toFixed(4)}\nData: ${JSON.stringify(result.data, null, 2)}\n\nMetadata: ${JSON.stringify(result.metadata, null, 2)}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async clickElement(args: z.infer<typeof ClickSchema>): Promise<CallToolResult> {
    try {
      await this.anchorClient.click(args.sessionId, {
        selector: args.selector,
        coordinates: args.coordinates,
        button: args.button,
        clickCount: args.clickCount,
        delay: args.delay
      });
      
      const target = args.selector || `(${args.coordinates?.x}, ${args.coordinates?.y})`;
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully clicked: ${target}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async typeText(args: z.infer<typeof TypeSchema>): Promise<CallToolResult> {
    try {
      await this.anchorClient.type(args.sessionId, {
        selector: args.selector,
        text: args.text,
        delay: args.delay,
        clear: args.clear
      });
      
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully typed text into: ${args.selector}\nText: ${args.text.substring(0, 50)}${args.text.length > 50 ? '...' : ''}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async waitForElement(args: z.infer<typeof WaitSchema>): Promise<CallToolResult> {
    try {
      await this.anchorClient.wait(args.sessionId, {
        selector: args.selector,
        timeout: args.timeout,
        visible: args.visible,
        hidden: args.hidden
      });
      
      return {
        content: [{
          type: 'text',
          text: `✅ Wait condition satisfied${args.selector ? ` for: ${args.selector}` : ''}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async getSessionMetrics(args: { sessionId: string }): Promise<CallToolResult> {
    try {
      const metrics = await this.anchorClient.getSessionMetrics(args.sessionId);
      
      if (!metrics) {
        return {
          content: [{
            type: 'text',
            text: `❌ Session not found: ${args.sessionId}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(metrics, null, 2)
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async closeSession(args: { sessionId: string }): Promise<CallToolResult> {
    try {
      await this.anchorClient.closeSession(args.sessionId);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Session closed: ${args.sessionId}`
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  private async getBudgetStatus(): Promise<CallToolResult> {
    try {
      const budget = await this.anchorClient.getBudgetLimits();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(budget, null, 2)
        }]
      };
    } catch (error) {
      return createMCPErrorResponse(error as Error);
    }
  }

  async handleSSE(c: any): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Send initial connection message
    await writer.write(new TextEncoder().encode(
      `data: ${JSON.stringify({ 
        type: 'connection', 
        server: 'mcp-anchor-browser',
        version: this.env.VERSION || '1.0.0'
      })}\n\n`
    ));

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP server...');
    await this.anchorClient.closeAllSessions();
    this.logger.info('MCP server shutdown complete');
  }
}