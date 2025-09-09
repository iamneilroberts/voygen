# TASK-0055: Anchor Browser MCP Server Foundation

## Task Overview
**Priority**: High  
**Estimated Time**: 2-3 days  
**Dependencies**: Existing d1-database MCP server  
**Assignee**: Development Team  

## Objective
Set up the foundational infrastructure for a custom Cloudflare Workers-based MCP server that integrates with Anchor Browser API for autonomous travel data extraction.

## Success Criteria
- [ ] Cloudflare Worker project structure created and configured
- [ ] Basic MCP server implementation with SSE support
- [ ] Anchor Browser client integration working
- [ ] Development environment setup with local testing
- [ ] Health checks and monitoring endpoints functional
- [ ] Basic error handling and logging implemented

## Technical Requirements

### 1. Project Structure Setup
```
remote-mcp-servers/mcp-anchor-browser/
├── src/
│   ├── index.ts                 # Main worker entry point
│   ├── types/
│   │   ├── env.ts              # Environment interface
│   │   ├── anchor.ts           # Anchor API types
│   │   └── mcp.ts              # MCP protocol types
│   ├── mcp/
│   │   ├── server.ts           # Core MCP server implementation
│   │   └── handlers.ts         # Request handlers
│   ├── clients/
│   │   └── anchor-browser.ts   # Anchor Browser API client
│   ├── utils/
│   │   ├── logger.ts           # Logging utilities
│   │   └── errors.ts           # Error handling
│   └── config/
│       └── constants.ts        # Configuration constants
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

### 2. Core Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "hono": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

### 3. Environment Configuration

#### wrangler.toml
```toml
name = "mcp-anchor-browser"
main = "src/index.ts"
compatibility_date = "2024-09-07" 
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"
VERSION = "1.0.0"

[[d1_databases]]
binding = "DB"
database_name = "voygen-travel-db"
database_id = "your-d1-database-id"

[build]
command = "npm run build"

[[kv_namespaces]]
binding = "CACHE"
id = "anchor-cache-namespace"
preview_id = "anchor-cache-preview"
```

#### Environment Interface
```typescript
// src/types/env.ts
export interface Env {
  ANCHOR_API_KEY: string;
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: 'development' | 'production';
  VERSION: string;
  DAILY_BUDGET_LIMIT?: string;
  MONTHLY_BUDGET_LIMIT?: string;
  MAX_CONCURRENT_SESSIONS?: string;
  SESSION_TTL_MINUTES?: string;
}
```

### 4. Main Worker Implementation
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { MCPServer } from './mcp/server';
import { createLogger } from './utils/logger';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: c.env.VERSION || '1.0.0',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// MCP Server-Sent Events endpoint
app.get('/sse', async (c) => {
  const log = createLogger(c.env);
  
  try {
    const mcpServer = new MCPServer(c.env);
    return await mcpServer.handleSSE(c);
  } catch (error) {
    log.error('SSE handler error:', error);
    return c.json({ error: 'Server error' }, 500);
  }
});

// Metrics endpoint
app.get('/metrics', async (c) => {
  try {
    const metrics = await getServerMetrics(c.env);
    return c.json(metrics);
  } catch (error) {
    return c.json({ error: 'Failed to fetch metrics' }, 500);
  }
});

// Error handling
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString() 
  }, 500);
});

async function getServerMetrics(env: Env) {
  // TODO: Implement metrics collection
  return {
    uptime: Date.now(),
    version: env.VERSION,
    environment: env.ENVIRONMENT
  };
}

export default app;
```

### 5. Basic MCP Server Implementation
```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { AnchorBrowserClient } from '../clients/anchor-browser';
import { createLogger } from '../utils/logger';

export class MCPServer {
  private server: Server;
  private anchorClient: AnchorBrowserClient;
  private logger: ReturnType<typeof createLogger>;

  constructor(private env: Env) {
    this.logger = createLogger(env);
    
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

    this.anchorClient = new AnchorBrowserClient(env.ANCHOR_API_KEY);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAvailableTools()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        return await this.handleToolCall(name, args);
      } catch (error) {
        this.logger.error(`Tool call error for ${name}:`, error);
        throw error;
      }
    });
  }

  private getAvailableTools(): Tool[] {
    return [
      {
        name: 'test_anchor_connection',
        description: 'Test connection to Anchor Browser API',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_server_status',
        description: 'Get MCP server status and configuration',
        inputSchema: {
          type: 'object', 
          properties: {},
          additionalProperties: false
        }
      }
    ];
  }

  private async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'test_anchor_connection':
        return await this.testAnchorConnection();
        
      case 'get_server_status':
        return await this.getServerStatus();
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async testAnchorConnection(): Promise<any> {
    try {
      const result = await this.anchorClient.testConnection();
      return {
        content: [{
          type: 'text',
          text: `Anchor Browser API connection successful: ${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text', 
          text: `Anchor Browser API connection failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  private async getServerStatus(): Promise<any> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          server: 'mcp-anchor-browser',
          version: this.env.VERSION,
          environment: this.env.ENVIRONMENT,
          timestamp: new Date().toISOString(),
          anchorApiConfigured: !!this.env.ANCHOR_API_KEY,
          databaseConnected: !!this.env.DB
        }, null, 2)
      }]
    };
  }

  async handleSSE(c: any): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Handle incoming MCP messages
    const handleMessage = async (message: any) => {
      try {
        const response = await this.server.handleRequest(message);
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify(response)}\n\n`
        ));
      } catch (error) {
        this.logger.error('MCP request handling error:', error);
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify({ error: error.message })}\n\n`
        ));
      }
    };

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
}
```

### 6. Anchor Browser Client
```typescript
// src/clients/anchor-browser.ts
import { createLogger } from '../utils/logger';

export interface AnchorSession {
  id: string;
  status: 'active' | 'idle' | 'closed';
  createdAt: Date;
  lastUsed: Date;
  totalCost: number;
}

export class AnchorBrowserClient {
  private baseUrl = 'https://api.anchorbrowser.io';
  private logger = createLogger({ ENVIRONMENT: 'development' } as any);

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('Anchor API key is required');
    }
  }

  async testConnection(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: 'connected',
        apiVersion: data.version || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Anchor connection test failed:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async createSession(config?: any): Promise<AnchorSession> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config || {})
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        id: data.session_id || data.id,
        status: 'active',
        createdAt: new Date(),
        lastUsed: new Date(),
        totalCost: 0.01 // Creation cost
      };
    } catch (error) {
      this.logger.error('Session creation failed:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
    } catch (error) {
      this.logger.error(`Failed to close session ${sessionId}:`, error);
      // Don't throw - session cleanup should be non-blocking
    }
  }
}
```

## Implementation Steps

### Step 1: Environment Setup (Day 1 Morning)
1. Create project directory structure
2. Initialize npm project with dependencies
3. Set up TypeScript configuration
4. Configure wrangler.toml for Cloudflare Workers

### Step 2: Basic Infrastructure (Day 1 Afternoon)
1. Implement main worker entry point with Hono
2. Create basic MCP server structure
3. Add health check and metrics endpoints
4. Set up error handling and logging

### Step 3: Anchor Integration (Day 2 Morning)
1. Implement Anchor Browser client with connection testing
2. Add basic session management
3. Test API connectivity and authentication
4. Implement basic error handling

### Step 4: MCP Protocol Implementation (Day 2 Afternoon)
1. Complete MCP server with proper request handling
2. Implement Server-Sent Events for real-time communication
3. Add tool registration and execution framework
4. Test MCP protocol compliance

### Step 5: Testing & Deployment (Day 3)
1. Local development testing with wrangler dev
2. Integration testing with LibreChat
3. Deploy to Cloudflare Workers development environment
4. Validate all endpoints and functionality

## Testing Plan

### Unit Tests
- [ ] Anchor Browser client connection and authentication
- [ ] MCP server request/response handling
- [ ] Error handling and logging utilities
- [ ] Environment configuration validation

### Integration Tests  
- [ ] End-to-end MCP communication with LibreChat
- [ ] Anchor Browser API integration
- [ ] Cloudflare Workers deployment
- [ ] Health check and monitoring endpoints

### Manual Testing
- [ ] LibreChat MCP server connection
- [ ] Tool execution through Claude interface
- [ ] Error scenarios and recovery
- [ ] Performance under load

## Deliverables

1. **Working Cloudflare Worker** deployed and accessible
2. **MCP Server Implementation** with basic tools
3. **Anchor Browser Integration** with connection testing
4. **Development Environment** configured for further development
5. **Documentation** for setup and testing procedures
6. **Test Suite** covering core functionality

## Risk Mitigation

### Technical Risks
- **Anchor API Changes**: Version lock dependencies and implement error handling
- **Cloudflare Limits**: Monitor resource usage and implement rate limiting
- **MCP Protocol Changes**: Use stable SDK versions and test compatibility

### Performance Risks  
- **Cold Start Latency**: Implement keep-alive mechanisms
- **Memory Usage**: Monitor and optimize worker memory consumption
- **API Rate Limits**: Implement request queuing and retry logic

## Success Metrics

- [ ] Health check endpoint returns 200 OK
- [ ] MCP server accepts connections from LibreChat
- [ ] Anchor Browser API authentication successful
- [ ] Basic tools executable through Claude interface
- [ ] Worker deploys without errors to Cloudflare
- [ ] Response times under 2 seconds for basic operations

## Next Steps

Upon completion, this foundation will enable:
- TASK-0056: Site-Specific Extractors Implementation
- TASK-0057: Session Pool Management System  
- TASK-0058: Cost Optimization Engine
- TASK-0059: Production Deployment & Monitoring