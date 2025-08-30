# D1 Database MCP - Improved Version

## Overview
This is an improved version of the D1 Database MCP that addresses the SQLite authorization errors and provides automatic initialization.

## Key Improvements

### 1. Automatic Initialization
- Database schema is automatically initialized on first use
- No need to manually run `initialize_travel_schema` first
- Initialization state is tracked to avoid redundant checks

### 2. Better Error Handling
- Clear error messages for authorization issues
- Helpful tips when D1 restrictions are encountered
- Graceful fallbacks for schema introspection

### 3. Enhanced Tools
- `check_database_status` - New tool to verify database health
- Improved `get_database_schema` with workarounds for D1 restrictions
- All tools now include automatic initialization checks

## Features

### Database Tables
- **travel_searches** - Stores travel search history
- **user_preferences** - Stores user travel preferences  
- **popular_routes** - View aggregating popular travel routes

### Available Tools
1. `initialize_travel_schema` - Manual initialization (kept for compatibility)
2. `store_travel_search` - Store a travel search
3. `get_search_history` - Retrieve search history
4. `get_popular_routes` - Get popular travel routes
5. `store_user_preference` - Store user preferences
6. `get_user_preferences` - Retrieve user preferences
7. `execute_query` - Execute custom SELECT queries
8. `get_database_schema` - Get database schema (with D1 workarounds)
9. `check_database_status` - Check database health and stats

## Deployment

1. Update `wrangler.toml` with your D1 database ID
2. Install dependencies: `npm install`
3. Deploy: `npm run deploy`

## Usage in Claude Desktop

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "d1-database-improved": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://d1-database-improved.your-domain.workers.dev/sse"
      ]
    }
  }
}
```

## How It Works

### Automatic Initialization Flow
1. When any tool is called, it checks if the database is initialized
2. If not initialized, it automatically creates the schema
3. The initialization state is cached to avoid repeated checks
4. If initialization fails, clear error messages are provided

### Handling D1 Restrictions
- D1 restricts access to certain SQLite system functions
- The improved schema tool uses `sqlite_master` queries instead of PRAGMA
- Fallback documentation is provided when schema access fails
- Error messages include helpful tips for working around restrictions

## Migration from v2
No migration needed - the improved version is backward compatible and will automatically initialize the database on first use.