# Prompt Instructions D1 MCP Server

A dynamic instruction management MCP server using Cloudflare D1 database for storing and retrieving travel planning instructions.

## 🎯 Purpose

This server provides dynamic instruction management capabilities for the Claude Travel Agent system. Unlike the original static `prompt-instructions-mcp` server, this version stores instructions in a Cloudflare D1 database, allowing for:

- **Dynamic Updates**: Modify instructions without code deployments
- **Version Control**: Track instruction changes over time
- **Confidence-Based Loading**: Serve different instruction sets based on confidence levels
- **Categorization**: Organize instructions by category (modes, planning, tools, etc.)
- **Performance**: KV caching for fast retrieval

## 🚀 Quick Start

### Deployment

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
wrangler deploy

# Check health
curl https://prompt-instructions-d1-mcp.somotravel.workers.dev/health
```

### Database Setup

The database schema is automatically created when deploying. Key tables:

- `instruction_sets`: Main instruction storage
- `instruction_metadata`: Tags and relationships
- `confidence_mappings`: Confidence level instruction mappings
- `instruction_access_log`: Usage analytics

## 🛠️ MCP Tools

### Core Tools

#### `get_instruction`
Retrieve a specific instruction by name.

```json
{
  "name": "get_instruction",
  "arguments": {
    "name": "mobile-mode"
  }
}
```

#### `list_instructions`
List all available instructions, optionally filtered by category.

```json
{
  "name": "list_instructions",
  "arguments": {
    "category": "modes"  // Optional
  }
}
```

#### `create_instruction`
Create a new instruction in the database.

```json
{
  "name": "create_instruction",
  "arguments": {
    "name": "new-workflow",
    "title": "New Workflow Instructions",
    "content": "# New Workflow\n\nDetailed instructions...",
    "category": "workflows"
  }
}
```

#### `update_instruction`
Update an existing instruction.

```json
{
  "name": "update_instruction",
  "arguments": {
    "name": "existing-workflow",
    "title": "Updated Title",
    "content": "Updated content...",
    "category": "updated-category"
  }
}
```

#### `get_instructions_by_confidence`
Get instructions based on confidence level.

```json
{
  "name": "get_instructions_by_confidence",
  "arguments": {
    "confidence_level": "high"  // high, medium, low, error
  }
}
```

## 📊 Pre-loaded Instructions

The server comes with key travel planning instructions:

### Modes
- **mobile-mode**: Autonomous lead processing
- **interactive-mode**: Collaborative planning

### Planning
- **trip_discovery**: Comprehensive trip discovery process
- **three-tier-pricing**: Three-tier pricing strategy

### Tools & Workflows
- **tool-reference**: MCP tools quick reference
- **cpmaxx_search**: CPMaxx search workflow

## 🔧 Configuration

### Environment Variables

```toml
# wrangler.toml
[vars]
MCP_AUTH_KEY = "prompt-instructions-d1-mcp-auth-key-2025"

[[d1_databases]]
binding = "DB"
database_name = "prompt-instructions-d1-db"
database_id = "bb5afae5-7b9c-4702-8fb9-895eea404719"

[[kv_namespaces]]
binding = "INSTRUCTIONS_CACHE"
id = "74fe5ac7c4084850a458a4443c029c40"
```

### Claude Desktop Integration

Add to your `claude-desktop-config.json`:

```json
{
  "mcpServers": {
    "prompt-instructions-d1": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-fetch", "https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse"]
    }
  }
}
```

## 📈 Features

### Caching
- Instructions are cached in KV storage for 1 hour
- Cache is automatically invalidated on updates
- Improves response times for frequently accessed instructions

### Error Handling
- Graceful fallbacks for database connection issues
- Detailed error messages for debugging
- Comprehensive logging for monitoring

### Confidence-Based Loading
Pre-configured mappings for different confidence levels:
- **High**: Advanced techniques for experienced users
- **Medium**: Specific techniques for common tasks  
- **Low**: Comprehensive step-by-step workflows
- **Error**: Error handling and recovery procedures

## 🔍 Testing

### Manual Testing

```bash
# Test health endpoint
curl https://prompt-instructions-d1-mcp.somotravel.workers.dev/health

# Test MCP initialize
curl -X POST https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test get instruction
curl -X POST https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_instruction","arguments":{"name":"mobile-mode"}}}'
```

### Automated Testing

```bash
npm test
```

## 🗄️ Database Schema

### instruction_sets
```sql
CREATE TABLE instruction_sets (
    instruction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### confidence_mappings
```sql
CREATE TABLE confidence_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confidence_level TEXT NOT NULL,
    instruction_names TEXT NOT NULL, -- JSON array
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚧 Migration from Static Server

This server is designed as a drop-in replacement for the static `prompt-instructions-mcp` server. The main differences:

1. **Storage**: Instructions stored in D1 database vs. static TypeScript files
2. **Management**: Instructions can be updated via MCP tools vs. code changes
3. **Performance**: KV caching for better response times
4. **Analytics**: Optional usage tracking and logging

## 📝 Development

### Local Development

```bash
# Start local development server
wrangler dev

# Execute database migrations
wrangler d1 execute prompt-instructions-d1-db --file=schema.sql

# View logs
wrangler tail
```

### Adding New Instructions

You can add instructions via the MCP tools or directly via SQL:

```sql
INSERT INTO instruction_sets (name, title, content, category) VALUES
('new-instruction', 'New Instruction Title', 'Content here...', 'category');
```

## 🔒 Security

- Environment variables for sensitive configuration
- Input validation on all MCP tool parameters
- SQL injection protection via prepared statements
- CORS headers properly configured

## 📊 Monitoring

- Health endpoint at `/health`
- Comprehensive error logging
- Optional usage analytics in `instruction_access_log` table
- Cloudflare Analytics integration

## ✅ Success Criteria Met

- ✅ Basic functionality: Get/list instructions from D1 database
- ✅ MCP integration: Works properly with Claude Desktop
- ✅ Performance: No timeout issues, reasonable response times
- ✅ Management: Can create/update instructions dynamically
- ✅ Migration: Successfully imported existing static instructions

## 🎉 Deployment Information

- **Deployed URL**: https://prompt-instructions-d1-mcp.somotravel.workers.dev
- **Database**: prompt-instructions-d1-db (bb5afae5-7b9c-4702-8fb9-895eea404719)
- **KV Cache**: INSTRUCTIONS_CACHE (74fe5ac7c4084850a458a4443c029c40)
- **Version**: 1.0.0
- **Status**: ✅ Active and tested
