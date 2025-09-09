# MCP Development Patterns - Claude Travel Agent v2

## Overview
This document captures successful patterns and common pitfalls in MCP (Model Context Protocol) server development for Claude Travel Agent v2. **Important**: v2 uses the standard MCP SDK, not custom agent frameworks.

## Successful Patterns

### 1. Standard MCP SDK Pattern (Required for v2)
**Always use the official MCP SDK** - This is the required pattern for v2:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'tool_name',
        description: 'Clear tool description',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'Parameter description' }
          },
          required: ['param']
        }
      }
    ]
  };
});

// Tool handler - MUST return this exact format
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (name === 'tool_name') {
      // Validate input
      const input = z.object({
        param: z.string()
      }).parse(args);
      
      // Process request
      const result = await processRequest(input);
      
      // Required response format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

### 2. Local Server Pattern (Node.js)
For local servers like `local-image-storage`:

```typescript
// File: src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import fs from 'fs/promises';

const server = new Server({
  name: 'local-image-storage',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Environment configuration
const config = {
  storageDir: process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  allowedTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
};

// Ensure storage directory exists
await fs.mkdir(config.storageDir, { recursive: true });

// Tool implementation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'upload_image':
        return await handleUploadImage(args);
      case 'list_images':
        return await handleListImages(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: error.message }, null, 2)
      }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

### 3. Remote Server Pattern (Cloudflare Workers)

**IMPORTANT**: The MCP SDK's `server.handleRequest()` method is **incompatible** with Cloudflare Workers and will throw HTTP 500 exceptions. Use custom JSON-RPC handling instead:

```typescript
// ✅ CORRECT: Custom JSON-RPC handling for Cloudflare Workers
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
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Handle SSE endpoint - direct JSON-RPC handling
    if (url.pathname === '/sse') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
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
                    name: "My MCP Server",
                    version: "1.0.0"
                  }
                }
              };
              break;

            case "tools/list":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  tools: [
                    {
                      name: 'my_tool',
                      description: 'Tool description',
                      inputSchema: zodToJsonSchema(MyToolSchema)
                    }
                  ]
                }
              };
              break;

            case "tools/call":
              const toolName = body.params.name;
              const toolArgs = body.params.arguments || {};
              
              try {
                let result;
                switch (toolName) {
                  case 'my_tool':
                    result = await handleMyTool(toolArgs, env);
                    break;
                  default:
                    throw new Error(`Unknown tool: ${toolName}`);
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
                    message: `Tool execution failed: ${error.message}`
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
          console.error('Error handling MCP request:', error);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `Internal error: ${error.message}`,
            },
          }) + '\n', {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }
    }
    
    // Handle health endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: "healthy",
        timestamp: new Date().toISOString()
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};

// Tool handler functions
async function handleMyTool(args: any, env: Env) {
  try {
    // Validate input
    const validatedInput = MyToolSchema.parse(args);
    
    // Process request with environment access
    const result = await env.DB.prepare(
      'SELECT * FROM table WHERE id = ?'
    ).bind(validatedInput.id).first();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, data: result }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${error.message}`
      }]
    };
  }
}
```

### 4. Error Handling Pattern
Consistent error handling across all tools:

```typescript
const handleToolCall = async (toolName: string, args: any) => {
  try {
    // Input validation
    const validatedInput = validateInput(toolName, args);
    
    // Main logic
    const result = await executeToolLogic(toolName, validatedInput);
    
    // Success response (required format)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: result
        }, null, 2)
      }]
    };
  } catch (error) {
    // Error response (required format)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, null, 2)
      }],
      isError: true
    };
  }
};
```

### 5. Input Validation Pattern
Use Zod for robust input validation:

```typescript
import { z } from 'zod';

const schemas = {
  upload_image: z.object({
    filename: z.string().min(1).max(255),
    data: z.string().min(1), // base64 or file path
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional()
  }),
  
  list_images: z.object({
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    filter: z.string().optional()
  })
};

const validateInput = (toolName: string, args: any) => {
  const schema = schemas[toolName as keyof typeof schemas];
  if (!schema) {
    throw new Error(`No validation schema for tool: ${toolName}`);
  }
  return schema.parse(args);
};
```

### 6. Database Operations Pattern (D1)
For Cloudflare D1 database operations:

```typescript
const databaseTool = async (env: Env, operation: string, params: any) => {
  try {
    switch (operation) {
      case 'create_client':
        const result = await env.DB.prepare(`
          INSERT INTO clients (name, email, phone, created_at)
          VALUES (?1, ?2, ?3, datetime('now'))
          RETURNING id
        `).bind(params.name, params.email, params.phone).first();
        
        return { success: true, data: result };
        
      case 'list_clients':
        const clients = await env.DB.prepare(`
          SELECT id, name, email, phone, created_at
          FROM clients
          WHERE active = 1
          ORDER BY name
          LIMIT ?1 OFFSET ?2
        `).bind(params.limit || 20, params.offset || 0).all();
        
        return { success: true, data: clients.results };
        
      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};
```

### 7. File Operations Pattern (Local Storage)
For local file system operations:

```typescript
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const fileOperations = {
  async uploadImage(data: string, filename: string, metadata?: any) {
    // Validate file type
    const ext = path.extname(filename).toLowerCase();
    if (!config.allowedTypes.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }
    
    // Generate unique ID
    const imageId = crypto.randomUUID();
    const safeName = `${imageId}${ext}`;
    const filePath = path.join(config.storageDir, 'images', safeName);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Save file (assuming base64 data)
    const buffer = Buffer.from(data, 'base64');
    
    // Check file size
    if (buffer.length > config.maxFileSize) {
      throw new Error(`File too large: ${buffer.length} bytes`);
    }
    
    await fs.writeFile(filePath, buffer);
    
    // Save metadata to database/file
    const imageData = {
      id: imageId,
      filename: filename,
      path: filePath,
      size: buffer.length,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    
    await saveImageMetadata(imageData);
    
    return { imageId, path: filePath, size: buffer.length };
  },
  
  async listImages(limit = 20, offset = 0, filter?: string) {
    // Implementation depends on metadata storage
    return await getImageList(limit, offset, filter);
  }
};
```

## Common Pitfalls and Solutions

### 1. Cloudflare Workers Incompatibility
**Problem**: Using MCP SDK's `server.handleRequest()` in Cloudflare Workers throws HTTP 500 exceptions.
**Solution**: Use custom JSON-RPC handling for Cloudflare Workers, standard MCP SDK for local servers.

```typescript
// ❌ WRONG - MCP SDK server.handleRequest() in Cloudflare Workers
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
const server = new Server({...});
server.setRequestHandler(ListToolsRequestSchema, ...);
return server.handleRequest(request); // BREAKS in Workers

// ✅ CORRECT - Custom JSON-RPC for Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle JSON-RPC methods directly
    const body = await request.json();
    switch (body.method) {
      case "tools/list":
        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [...] }
        });
    }
  }
};

// ✅ CORRECT - Standard MCP SDK for local servers
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const server = new Server({...});
const transport = new StdioServerTransport();
server.connect(transport);
```

### 2. Wrong MCP Framework
**Problem**: Using McpAgent or custom implementations.
**Solution**: Always use the standard MCP SDK for local servers, custom JSON-RPC for Workers.

```typescript
// ❌ WRONG - Don't use McpAgent in v2
import { McpAgent } from 'mcp-agent';

// ✅ CORRECT - Use standard MCP SDK for local servers
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// ✅ CORRECT - Use custom JSON-RPC for Cloudflare Workers
// See pattern #3 above
```

### 3. Incorrect Response Format
**Problem**: Returning plain objects instead of MCP format.
**Solution**: Always return the correct MCP response format.

```typescript
// ❌ WRONG
return { success: true, data: result };

// ✅ CORRECT
return {
  content: [{
    type: 'text',
    text: JSON.stringify({ success: true, data: result }, null, 2)
  }]
};
```

### 4. Missing Tool Registration
**Problem**: Tools not appearing in Claude Desktop.
**Solution**: Implement both ListTools and CallTool handlers.

```typescript
// Required: List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...] };
});

// Required: Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Handle calls
});
```

### 5. File Path Issues
**Problem**: Path traversal vulnerabilities or cross-platform issues.
**Solution**: Use path.join and validate paths.

```typescript
// ❌ WRONG
const filePath = storageDir + '/' + filename;

// ✅ CORRECT
const safeName = path.basename(filename); // Prevent path traversal
const filePath = path.join(storageDir, 'images', safeName);

// Validate path is within allowed directory
const resolvedPath = path.resolve(filePath);
const resolvedStorage = path.resolve(storageDir);
if (!resolvedPath.startsWith(resolvedStorage)) {
  throw new Error('Invalid file path');
}
```

### 6. Environment Variable Access in Workers
**Problem**: Environment variables undefined in handlers.
**Solution**: Properly pass environment through fetch handler.

```typescript
// ✅ CORRECT Pattern for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create server with access to env
    const server = createServer(env);
    return handleMcpRequest(request, server);
  }
};

const createServer = (env: Env) => {
  const server = new Server(/* config */);
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // env is available here
    const apiKey = env.API_KEY;
    // ...
  });
  
  return server;
};
```

### 7. Mixed MCP SDK and Custom JSON-RPC Code
**Problem**: Having both MCP SDK `server.setRequestHandler()` calls AND custom JSON-RPC handling causes conflicts.
**Solution**: Choose one approach - never mix them in the same file.

```typescript
// ❌ WRONG - Mixing MCP SDK with custom JSON-RPC
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
const server = new Server({...});

// This creates unused server setup code
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...]
}));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // This custom JSON-RPC handling conflicts with above
    switch (body.method) {
      case "tools/list":
        // Duplicate tool definitions cause confusion
    }
  }
};

// ✅ CORRECT - Pure custom JSON-RPC for Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only custom JSON-RPC handling, no MCP SDK server setup
    const body = await request.json();
    switch (body.method) {
      case "tools/list":
        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [...] }
        });
    }
  }
};

// ✅ CORRECT - Pure MCP SDK for local servers
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
const server = new Server({...});
server.setRequestHandler(ListToolsRequestSchema, ...);
server.setRequestHandler(CallToolRequestSchema, ...);
const transport = new StdioServerTransport();
server.connect(transport);
```

## Testing Patterns

### Local Testing
```bash
# Test local server
cd mcp-local-servers/local-image-storage
npm run build
npm start

# Test with mcp client
node test-local.js
```

### Remote Testing
```bash
# Test remote server
cd remote-mcp-servers/d1-database-improved
npm run build
wrangler dev

# Test with mcp-remote
node test-remote.js
```

### Integration Testing
```javascript
// test-integration.js
const testMcpServer = async (serverUrl, toolName, params) => {
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: params },
      id: 1
    })
  });
  
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  return result;
};
```

## Deployment Patterns

### Local Server Deployment
```json
// package.json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  }
}

// Claude Desktop config
{
  "local-image-storage": {
    "command": "node",
    "args": ["mcp-local-servers/local-image-storage/dist/index.js"],
    "cwd": "/path/to/project"
  }
}
```

### Remote Server Deployment
```bash
# Deploy to Cloudflare Workers
cd remote-mcp-servers/d1-database-improved
wrangler deploy

# Set environment variables
wrangler secret put API_KEY
```

## Performance Best Practices

### 1. Efficient File Operations
```typescript
// Use streams for large files
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const copyLargeFile = async (src: string, dest: string) => {
  await pipeline(
    createReadStream(src),
    createWriteStream(dest)
  );
};
```

### 2. Database Query Optimization
```typescript
// Use prepared statements
const getClientStmt = env.DB.prepare('SELECT * FROM clients WHERE id = ?');
const client = await getClientStmt.bind(clientId).first();

// Use indexes
const query = `
  SELECT c.*, COUNT(t.id) as trip_count
  FROM clients c
  LEFT JOIN trips t ON c.id = t.client_id
  WHERE c.active = 1
  GROUP BY c.id
  ORDER BY c.name
`;
```

### 3. Memory Management
```typescript
// Clean up resources
const processImage = async (imageData: Buffer) => {
  try {
    // Process image
    const result = await processBuffer(imageData);
    return result;
  } finally {
    // Clear large buffers from memory
    imageData.fill(0);
  }
};
```

## Debugging Cloudflare Workers MCP Servers

### Common HTTP 500 Error Diagnosis
When Cloudflare Workers return HTTP 500 exceptions for MCP requests:

1. **Check Wrangler Logs**:
   ```bash
   wrangler tail --format=pretty
   ```

2. **Test Health Endpoint**:
   ```bash
   curl https://your-worker.workers.dev/health
   ```

3. **Test MCP Protocol Directly**:
   ```bash
   curl -X POST https://your-worker.workers.dev/sse \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
   ```

4. **Common Fixes**:
   - Remove MCP SDK server setup code from Workers
   - Use pure custom JSON-RPC handling
   - Ensure proper CORS headers
   - Validate JSON-RPC response format

### Successful Deployment Checklist
- ✅ Health endpoint returns 200
- ✅ `/sse` endpoint accepts POST requests
- ✅ `tools/list` returns valid tool array
- ✅ `tools/call` executes without errors
- ✅ Claude Desktop connects successfully
- ✅ No mixing of MCP SDK and custom JSON-RPC

This pattern guide ensures consistent, reliable MCP server development for Claude Travel Agent v2 using the appropriate pattern for each deployment target.