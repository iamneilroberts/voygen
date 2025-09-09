# TASK-0052: LibreChat Integration and Testing

**Priority**: HIGH  
**Estimated Effort**: 1 day  
**Dependencies**: TASK-0050 (Infrastructure), TASK-0051 (CPMaxx Extractor)  
**Status**: Not Started

## Objective

Integrate the new mcp-anchor-browser server with LibreChat, configure the MCP connection, and validate end-to-end functionality. This task ensures the LLM can successfully call autonomous hotel search tools and receive structured results.

## Background

With the infrastructure and CPMaxx extractor implemented, we need to integrate the new MCP server with the existing LibreChat system. This requires updating configuration files, testing MCP connectivity, and validating that the LLM can successfully trigger autonomous hotel searches.

## Requirements

### LibreChat Configuration
- [ ] Update `config/librechat-minimal.yaml` with mcp-anchor-browser server
- [ ] Configure proper timeout settings for search operations
- [ ] Set up server instructions for LLM tool selection
- [ ] Validate MCP server priority and tool routing

### MCP Connectivity Testing
- [ ] Test SSE endpoint connectivity from LibreChat
- [ ] Verify MCP protocol compliance (initialize, tools/list, tools/call)
- [ ] Validate tool parameter passing and response handling
- [ ] Test concurrent session management

### End-to-End Functionality
- [ ] LLM can discover and call `search_hotels` tool
- [ ] Hotel search results properly returned and displayed
- [ ] Session management and cleanup working correctly
- [ ] Error handling and timeout scenarios

### Integration with Existing Systems
- [ ] Results cached in d1-database hotel_cache table
- [ ] Trip context properly linked via trip_id parameter
- [ ] Fact refresh triggered after successful searches
- [ ] No conflicts with existing mcp-chrome functionality

## Technical Specifications

### LibreChat Configuration Update
**File**: `config/librechat-minimal.yaml`

```yaml
mcpServers:
  # Existing servers remain unchanged
  mcp-chrome:
    command: "node"
    args: ["./mcp-local-servers/mcp-chrome/app/native-server/dist/index.js"]
    timeout: 30000
    description: "Browser automation for user-assisted tasks (import trips, screenshots)"
    serverInstructions: |
      User-assisted browser automation capabilities:
      - Use for tasks requiring user interaction or verification
      - chrome_screenshot: Visual confirmation and user assistance
      - chrome_navigate: Help users navigate websites
      - chrome_fill_or_select: Assist with form filling
      - Import existing trips from browser tabs
      - Extract confirmation numbers from emails
      - NOT for autonomous hotel searches (use mcp-anchor-browser instead)

  mcp-anchor-browser:
    command: "npx"
    args:
      - "-y"
      - "mcp-remote"
      - "https://mcp-anchor-browser.somotravel.workers.dev/sse"
    timeout: 180000  # 3 minutes for hotel searches
    env: {}
    description: "AI-powered autonomous travel search and data extraction"
    serverInstructions: |
      Autonomous travel search capabilities for LLM-driven operations:
      
      WHEN TO USE:
      - LLM needs real hotel pricing for trip planning
      - Autonomous price comparison across booking sites  
      - Real-time availability checks for specific dates
      - Package deal research without user interaction
      
      AVAILABLE TOOLS:
      - search_hotels: Get hotel availability and pricing from CPMaxx/HotelEngine
        * Required: destination, checkIn, checkOut (YYYY-MM-DD format)
        * Optional: travelers, maxResults, timeout, trip_id
        * Returns: structured hotel data with names, prices, addresses
        * Automatically caches results in d1-database
        
      - get_session_status: Monitor active sessions and costs
        * Use to check session health and cost tracking
        * Returns: active sessions, cost information, quota status
      
      INTEGRATION FEATURES:
      - Automatically links search results to trip context via trip_id
      - Caches results in hotel_cache table for performance
      - Triggers trip_facts refresh when new data ingested
      - Built-in cost controls and session management
      
      IMPORTANT NOTES:
      - Searches typically complete within 2 minutes
      - Results are real-time from CPMaxx booking system
      - Session cleanup is automatic - no manual intervention needed
      - Use trip_id parameter to link searches to specific trips
```

### Tool Usage Examples for LLM
Include in server instructions to guide proper usage:

```yaml
      USAGE EXAMPLES:
      
      Basic hotel search:
      {
        "destination": "Seattle, WA",
        "checkIn": "2026-03-15", 
        "checkOut": "2026-03-16",
        "travelers": 2
      }
      
      Trip-linked search with constraints:
      {
        "destination": "Miami, FL",
        "checkIn": "2026-06-10",
        "checkOut": "2026-06-15", 
        "travelers": 4,
        "maxResults": 25,
        "trip_id": "12345"
      }
```

## Implementation Steps

### Step 1: Configuration Updates (2 hours)
1. **Update librechat-minimal.yaml**
   - Add mcp-anchor-browser server configuration
   - Update mcp-chrome instructions to clarify user-assisted role
   - Set appropriate timeout values (180 seconds for searches)
   - Configure server priorities and tool selection guidance

2. **Environment Variables**
   - Ensure LibreChat can access remote MCP server URL
   - Verify network connectivity to Cloudflare Workers
   - Test SSL/TLS certificate handling

### Step 2: MCP Server Deployment (1 hour)
1. **Deploy to Cloudflare Workers**
   ```bash
   cd remote-mcp-servers/mcp-anchor-browser
   wrangler deploy
   ```

2. **Verify SSE Endpoint**
   ```bash
   curl -X GET https://mcp-anchor-browser.somotravel.workers.dev/sse
   curl -X POST https://mcp-anchor-browser.somotravel.workers.dev/sse \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```

### Step 3: LibreChat Connectivity Testing (2 hours)
1. **Start LibreChat with New Configuration**
   ```bash
   npm run dev  # or npm start for production
   ```

2. **Test MCP Server Detection**
   - Verify mcp-anchor-browser appears in server list
   - Check for connection errors in LibreChat logs
   - Validate tool discovery and listing

3. **Test Basic MCP Protocol**
   - Initialize handshake
   - Tools list request/response
   - Basic tool call without complex parameters

### Step 4: Tool Functionality Testing (3 hours)
1. **Test search_hotels Tool**
   - Simple hotel search with required parameters
   - Verify structured JSON response format
   - Check result completeness and data quality
   - Test various destination formats

2. **Test Error Handling**
   - Invalid date formats
   - Non-existent destinations  
   - Timeout scenarios
   - Rate limiting responses

3. **Test Session Management**
   - Multiple concurrent searches
   - Session cleanup verification
   - Cost tracking accuracy

### Step 5: Integration Validation (2 hours)
1. **d1-database Integration**
   - Verify hotel results cached in hotel_cache table
   - Check trip_id linking when provided
   - Validate trip_facts refresh triggers

2. **LibreChat User Experience**
   - LLM can autonomously call search tools
   - Results properly formatted for display
   - Error messages user-friendly
   - No interference with existing mcp-chrome tools

## Testing Strategy

### Manual Testing Scenarios

#### Basic Functionality Tests
```
Test 1: Simple Hotel Search
- Ask LLM: "Find hotels in Seattle for March 15-16, 2026"
- Expected: LLM calls search_hotels tool, returns hotel list
- Validation: Results include hotel names, prices, addresses

Test 2: Trip-Linked Search  
- Ask LLM: "Search Miami hotels June 10-15 for trip 12345"
- Expected: search_hotels called with trip_id parameter
- Validation: Results cached and linked to trip in database

Test 3: Error Handling
- Ask LLM: "Find hotels in InvalidCity for invalid-date"
- Expected: Graceful error handling, informative message
- Validation: No crashes, clear error explanation
```

#### Integration Tests
```
Test 4: d1-database Caching
- Perform hotel search, check hotel_cache table
- Verify JSON data structure and completeness
- Confirm trip_id association when provided

Test 5: Concurrent Operations
- Start hotel search, simultaneously use mcp-chrome tools
- Expected: Both servers operate independently
- Validation: No conflicts or interference

Test 6: Session Management  
- Monitor active sessions during/after searches
- Expected: Automatic cleanup within timeout period
- Validation: No orphaned sessions or runaway costs
```

### Automated Testing

#### MCP Protocol Tests
```bash
# Test server connectivity
npx mcp-remote https://mcp-anchor-browser.somotravel.workers.dev/sse

# Test tool listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  curl -X POST -H "Content-Type: application/json" -d @- \
  https://mcp-anchor-browser.somotravel.workers.dev/sse

# Test basic tool call
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_session_status","arguments":{}}}' | \
  curl -X POST -H "Content-Type: application/json" -d @- \
  https://mcp-anchor-browser.somotravel.workers.dev/sse
```

## Success Criteria

### Technical Requirements
- [ ] mcp-anchor-browser server appears in LibreChat MCP server list
- [ ] LLM can discover and list available tools
- [ ] search_hotels tool executes successfully with valid parameters
- [ ] Hotel search results returned in under 3 minutes
- [ ] Session cleanup completes automatically

### Integration Requirements  
- [ ] Hotel search results cached in d1-database hotel_cache table
- [ ] Trip linking works when trip_id parameter provided
- [ ] No conflicts with existing mcp-chrome functionality
- [ ] Error handling provides clear, actionable feedback

### User Experience Requirements
- [ ] LLM autonomously calls hotel search without user prompting
- [ ] Search results displayed in readable format
- [ ] Error messages are user-friendly and informative
- [ ] Performance meets user expectations (<3 minutes)

### Data Quality Requirements
- [ ] Hotel results include complete information (name, price, address)
- [ ] Pricing information accurate with proper currency
- [ ] Location data matches search destination
- [ ] Results consistent across multiple searches

## Monitoring & Observability

### Key Metrics to Track
```typescript
// Session metrics
- Active sessions count
- Average session duration  
- Session cleanup success rate
- Cost per search

// Search metrics
- Search success rate
- Average response time
- Results count per search
- Error rate by error type

// Integration metrics
- d1-database cache hit rate
- Trip linking success rate
- LibreChat connectivity uptime
```

### Logging Requirements
```typescript
// Log levels and content
INFO: Successful searches, session lifecycle
WARN: Rate limits, timeout approaching, data quality issues  
ERROR: Authentication failures, extraction failures, crashes
DEBUG: Detailed extraction steps, response parsing
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Connection Issues
```
Problem: "MCP server not found" in LibreChat
Solution: 
1. Verify Cloudflare Workers deployment status
2. Check SSE endpoint accessibility 
3. Validate librechat-minimal.yaml syntax
4. Restart LibreChat after configuration changes
```

#### Authentication Issues  
```
Problem: CPMaxx login failures
Solution:
1. Verify credentials in Cloudflare Workers environment
2. Check cpmaxx.cruiseplannersnet.com site availability
3. Test authentication manually via Anchor Browser dashboard
4. Monitor for credential expiration or policy changes
```

#### Performance Issues
```
Problem: Searches timing out or taking >3 minutes
Solution:
1. Check Anchor Browser API quota and limits
2. Monitor concurrent session count
3. Verify timeout settings in configuration
4. Consider increasing timeout for complex searches
```

## Dependencies & Blockers

### External Dependencies
- Cloudflare Workers platform availability
- Anchor Browser API service stability
- CPMaxx website functionality and authentication
- LibreChat MCP client implementation

### Internal Dependencies  
- TASK-0050: Infrastructure must be deployed and functional
- TASK-0051: CPMaxx extractor must be working correctly
- d1-database MCP server must be accessible for caching
- LibreChat development environment set up

## Follow-up Tasks

### Immediate Next Steps
- **TASK-0053**: Performance optimization and monitoring setup
- **TASK-0054**: Additional site extractors (VAX, Delta Vacations)  
- **TASK-0055**: Production deployment and monitoring

### Future Enhancements
- User interface improvements for displaying hotel results
- Advanced search filters and sorting options
- Price comparison across multiple booking sites
- Integration with trip planning and itinerary tools

## Notes

### Configuration Backup
```bash
# Backup current configuration before changes
cp config/librechat-minimal.yaml config/librechat-minimal.yaml.backup

# Test rollback plan in case of issues
mv config/librechat-minimal.yaml.backup config/librechat-minimal.yaml
```

### Development vs Production Settings
```yaml
# Development: Lower timeout, more verbose logging
timeout: 120000
env:
  LOG_LEVEL: "DEBUG"

# Production: Higher timeout, essential logging only  
timeout: 180000
env:
  LOG_LEVEL: "INFO"
```