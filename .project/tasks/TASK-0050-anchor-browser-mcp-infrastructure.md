# TASK-0050: Anchor Browser MCP Infrastructure Setup

**Priority**: HIGH  
**Estimated Effort**: 2-3 days  
**Dependencies**: None  
**Status**: Not Started

## Objective

Create the foundational infrastructure for the mcp-anchor-browser server, including the Cloudflare Workers setup, base MCP server implementation, and session management framework.

## Background

Based on successful testing with Anchor Browser extracting hotel data from cpmaxx.cruiseplannersnet.com, we need to transform the proof-of-concept scripts into a production-ready MCP server. This task establishes the core infrastructure that all site-specific extractors will build upon.

## Requirements

### Core Infrastructure
- [ ] Create `remote-mcp-servers/mcp-anchor-browser/` directory structure
- [ ] Set up Cloudflare Workers configuration with `wrangler.toml`
- [ ] Implement base MCP server following existing d1-database pattern
- [ ] Configure TypeScript build process and dependencies
- [ ] Set up Zod schemas for validation

### Session Management Framework
- [ ] Implement `SafeAnchorSession` class based on testing patterns
- [ ] Add automatic session cleanup with 5-minute safety timeout
- [ ] Create timeout protection for individual searches (90-300 seconds)
- [ ] Implement cost tracking and monitoring capabilities
- [ ] Add graceful error handling for rate limits and failures

### Base Extractor Architecture  
- [ ] Create `AnchorExtractor` base class
- [ ] Implement `ExtractionSession` utility for session management
- [ ] Design `ExtractionResult` standardized output format
- [ ] Create extractor registry system for site selection
- [ ] Add confidence scoring and auto-detection capabilities

## Technical Specifications

### Directory Structure
```
remote-mcp-servers/mcp-anchor-browser/
├── src/
│   ├── index.ts                   # Main MCP server
│   ├── types.ts                   # Type definitions
│   ├── extractors/
│   │   ├── base/
│   │   │   ├── AnchorExtractor.ts
│   │   │   ├── ExtractionSession.ts
│   │   │   └── ExtractionResult.ts
│   │   ├── sites/              # Site-specific extractors (future tasks)
│   │   └── utils/
│   │       ├── PriceParser.ts
│   │       ├── DateParser.ts
│   │       └── LocationNormalizer.ts
│   ├── tools/
│   │   ├── search-hotels.ts
│   │   └── session-management.ts
│   └── session/
│       ├── SessionManager.ts
│       ├── CostTracker.ts
│       └── TimeoutController.ts
├── wrangler.toml
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

#### 1. SafeAnchorSession Class
```typescript
export class SafeAnchorSession {
  private anchor: Anchorbrowser;
  private sessionId: string | null = null;
  private isActive: boolean = false;
  private costTracker: CostTracker;
  
  constructor(apiKey: string) {
    this.anchor = new Anchorbrowser({ apiKey });
    this.costTracker = new CostTracker();
    
    // Auto-cleanup safety net
    setTimeout(() => {
      if (this.isActive) this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  async createSession(): Promise<string>;
  async performTask(prompt: string, url: string, timeout?: number): Promise<any>;
  async cleanup(): Promise<void>;
}
```

#### 2. Base MCP Server Structure
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle MCP protocol requests
    // Support for initialize, tools/list, tools/call methods
    // Session management and cleanup
    // Error handling and logging
  }
};
```

#### 3. Core MCP Tools
- `get_session_status` - Monitor active sessions and costs
- `cleanup_sessions` - Force cleanup of all active sessions  
- `health_check` - Server health and configuration status

### Environment Configuration
- `ANCHORBROWSER_API_KEY` - Anchor Browser API key from testing
- `CPMAXX_EMAIL` - CPMaxx login email (kim.henderson@cruiseplanners.com)
- `CPMAXX_PASSWORD` - CPMaxx login password
- `MAX_SESSION_DURATION` - Maximum session duration (default 300 seconds)
- `MAX_CONCURRENT_SESSIONS` - Maximum concurrent sessions (default 3)

### Package Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "anchorbrowser": "^0.4.0",
    "zod": "^3.22.0",
    "zod-to-json-schema": "^3.22.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.3.0",
    "wrangler": "^3.0.0"
  }
}
```

## Implementation Steps

### Step 1: Project Setup (Day 1)
1. Create directory structure and basic files
2. Initialize npm project with dependencies
3. Set up TypeScript configuration
4. Create basic wrangler.toml for Cloudflare Workers

### Step 2: Session Management (Day 1-2)
1. Implement SafeAnchorSession class based on successful test patterns
2. Add timeout controls and automatic cleanup
3. Create cost tracking utilities
4. Implement error handling for rate limits

### Step 3: MCP Server Foundation (Day 2)
1. Create base MCP server following d1-database pattern
2. Implement core MCP protocol handlers (initialize, tools/list, tools/call)
3. Add basic tools for session management and health checks
4. Set up proper CORS and SSE endpoint handling

### Step 4: Base Extractor Framework (Day 2-3)
1. Create AnchorExtractor base class with common functionality
2. Implement ExtractionSession utility for session handling
3. Design ExtractionResult format for standardized outputs
4. Create extractor registry for dynamic site selection

### Step 5: Testing & Validation (Day 3)
1. Test MCP server connectivity with LibreChat
2. Validate session creation and cleanup
3. Test timeout controls and error handling
4. Verify cost tracking and monitoring capabilities

## Testing Strategy

### Unit Tests
- SafeAnchorSession lifecycle (create, use, cleanup)
- Timeout controls and error handling
- Cost tracking accuracy
- MCP protocol compliance

### Integration Tests
- MCP server connectivity via SSE endpoint
- Session management under load
- Error recovery from rate limits
- Proper cleanup on worker termination

### Manual Testing
- Connect mcp-anchor-browser to LibreChat
- Test session creation and basic tools
- Verify automatic cleanup after timeout
- Monitor costs and session limits

## Success Criteria

### Technical Requirements
- [ ] MCP server successfully connects to LibreChat
- [ ] Sessions create and cleanup automatically
- [ ] Timeout controls prevent runaway costs
- [ ] Error handling gracefully manages failures
- [ ] Base extractor framework ready for site-specific implementations

### Performance Requirements  
- [ ] Session creation completes within 10 seconds
- [ ] Cleanup operations complete within 5 seconds
- [ ] Server responds to MCP requests within 2 seconds
- [ ] Memory usage stays under 50MB per worker instance

### Safety Requirements
- [ ] No sessions remain active beyond 5-minute safety limit
- [ ] Cost tracking accurately monitors API usage
- [ ] Rate limiting errors handled without crashes
- [ ] All credentials properly secured in environment variables

## Dependencies & Blockers

### External Dependencies
- Anchor Browser API key and quota availability
- CPMaxx site credentials remain valid
- Cloudflare Workers platform stability

### Internal Dependencies
- Understanding of existing MCP server patterns from d1-database
- LibreChat configuration for testing connectivity
- Access to Cloudflare Workers deployment environment

## Follow-up Tasks

This infrastructure task enables the following implementation tasks:

- **TASK-0051**: CPMaxx Extractor Implementation (proven working)
- **TASK-0052**: VAX Vacation Extractor Development  
- **TASK-0053**: Delta Vacations Extractor Development
- **TASK-0054**: NaviTrip Generic Extractor Development
- **TASK-0055**: LibreChat Integration and Testing

## Notes

### Key Learnings from Testing
- Anchor Browser successfully extracted 20 Seattle hotels from CPMaxx
- Session cleanup via `anchor.sessions.delete('all')` is reliable
- Timeout controls at 90-120 seconds prevent most runaway sessions
- Nested result structure: `response.data.result.result`
- Authentication persistence works across search operations

### Cost Considerations
- Initial testing consumed ~$4 of $5 credit, indicating ~$0.20 per search
- Proper timeout controls essential to prevent cost overruns
- Session pooling may reduce per-search costs in future optimizations

### Security Notes
- API keys must be stored securely in Cloudflare Workers environment
- CPMaxx credentials require secure handling
- Session IDs should not be logged or exposed in responses