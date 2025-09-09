# MCP Anchor Browser Server

A Model Context Protocol (MCP) server that integrates with Anchor Browser API for autonomous web automation and data extraction, specifically designed for travel industry use cases.

## Overview

This server provides LibreChat/Claude with powerful web automation capabilities through the Anchor Browser service, enabling:

- **Autonomous web browsing** with real browser sessions
- **Travel data extraction** from booking sites and travel platforms  
- **Screenshot capture** for visual confirmation
- **Form interaction** for booking workflows
- **Session management** with cost tracking and budget controls

## Features

### Core Capabilities
- ✅ **Session Management**: Create, manage, and monitor browser sessions
- ✅ **Web Navigation**: Navigate to URLs with configurable wait conditions
- ✅ **Data Extraction**: Extract structured data using CSS selectors
- ✅ **Element Interaction**: Click, type, and interact with page elements
- ✅ **Screenshot Capture**: Take full page or element-specific screenshots
- ✅ **Budget Tracking**: Monitor API costs with daily/monthly limits
- ✅ **Error Handling**: Comprehensive error handling with retry logic
- ✅ **Health Monitoring**: Built-in health checks and metrics

### Travel-Specific Tools
- Hotel price extraction from booking sites
- Availability checking and monitoring
- Review and rating data collection
- Amenity and facility information extraction
- Multi-site comparison workflows

## Installation

### Prerequisites
- Node.js 18+ 
- Wrangler CLI (`npm install -g wrangler`)
- Anchor Browser API key
- Cloudflare account with Workers and D1 access

### Setup Steps

1. **Clone and navigate to the project**:
   ```bash
   cd remote-mcp-servers/mcp-anchor-browser
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   # Set your Anchor Browser API key
   wrangler secret put ANCHOR_API_KEY
   # Enter your API key when prompted
   ```

4. **Configure wrangler.toml**:
   - Update `database_id` with your actual D1 database ID
   - Update KV namespace IDs for caching
   - Set production environment variables as needed

5. **Build the project**:
   ```bash
   npm run build
   ```

## Development

### Local Development
```bash
# Start local development server
npm run dev

# The server will be available at:
# http://localhost:8787
```

### Testing the Server
```bash
# Test health endpoint
curl http://localhost:8787/health

# Test MCP SSE endpoint (requires MCP client)
curl http://localhost:8787/sse
```

### Environment Configuration

Create a `.env` file for local development:
```env
ANCHOR_API_KEY=your-anchor-api-key-here
ENVIRONMENT=development
VERSION=1.0.0
DAILY_BUDGET_LIMIT=50
MONTHLY_BUDGET_LIMIT=1000
MAX_CONCURRENT_SESSIONS=5
SESSION_TTL_MINUTES=30
```

## Deployment

### Deploy to Cloudflare Workers
```bash
# Deploy to development
npm run deploy

# Deploy to production
wrangler deploy --env production
```

### Post-Deployment Setup
1. Set secrets in production:
   ```bash
   wrangler secret put ANCHOR_API_KEY --env production
   ```

2. Verify deployment:
   ```bash
   curl https://mcp-anchor-browser.your-subdomain.workers.dev/health
   ```

## MCP Integration

### Add to LibreChat Configuration

Add to your `librechat.yaml`:
```yaml
endpoints:
  assistants:
    - model: claude-3-5-sonnet-20241022
      mcp:
        mcpRemoteServers:
          - url: https://mcp-anchor-browser.your-subdomain.workers.dev/sse
            name: mcp-anchor-browser
```

### Available Tools

| Tool Name | Description | Use Case |
|-----------|-------------|----------|
| `test_anchor_connection` | Test API connectivity | Verify setup |
| `get_server_status` | Get server status and metrics | Monitoring |
| `create_session` | Create new browser session | Start automation |
| `navigate` | Navigate to URL | Load web pages |
| `screenshot` | Capture page screenshot | Visual confirmation |
| `extract_data` | Extract structured data | Scrape information |
| `click_element` | Click page elements | Interact with UI |
| `type_text` | Type into input fields | Fill forms |
| `wait_for_element` | Wait for element conditions | Handle dynamic content |
| `get_session_metrics` | Get session statistics | Monitor usage |
| `close_session` | Close browser session | Clean up resources |
| `get_budget_status` | Check budget usage | Cost management |

## Usage Examples

### Basic Session Workflow
```typescript
// 1. Create a session
await callTool('create_session', {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0...'
});

// 2. Navigate to a website
await callTool('navigate', {
  sessionId: 'session-id',
  url: 'https://booking.com',
  waitFor: 'networkidle0'
});

// 3. Extract hotel data
await callTool('extract_data', {
  sessionId: 'session-id',
  selector: '.hotel-card',
  multiple: true,
  format: 'json'
});

// 4. Take a screenshot
await callTool('screenshot', {
  sessionId: 'session-id',
  fullPage: true,
  format: 'png'
});

// 5. Close session
await callTool('close_session', {
  sessionId: 'session-id'
});
```

### Travel Data Extraction
```typescript
// Extract hotel information
const hotelData = await callTool('extract_data', {
  sessionId: 'session-id',
  selector: '.property-card',
  schema: {
    name: '.hotel-name',
    price: '.price',
    rating: '.rating',
    amenities: '.amenity'
  },
  multiple: true,
  format: 'json'
});
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANCHOR_API_KEY` | Yes | - | Anchor Browser API key |
| `ENVIRONMENT` | No | `development` | Runtime environment |
| `VERSION` | No | `1.0.0` | Server version |
| `DAILY_BUDGET_LIMIT` | No | `50` | Daily spending limit (USD) |
| `MONTHLY_BUDGET_LIMIT` | No | `1000` | Monthly spending limit (USD) |
| `MAX_CONCURRENT_SESSIONS` | No | `10` | Max simultaneous sessions |
| `SESSION_TTL_MINUTES` | No | `30` | Session timeout in minutes |

### Budget Management

The server includes built-in budget tracking:
- **Daily Limits**: Prevent overspending per day
- **Monthly Limits**: Long-term budget control
- **Cost Tracking**: Track costs per session and operation
- **Warning Alerts**: Notifications at 80% (daily) and 90% (monthly) thresholds

### Session Management

- **Automatic Cleanup**: Sessions expire after TTL
- **Concurrent Limits**: Prevent resource exhaustion  
- **Cost Tracking**: Monitor per-session expenses
- **Health Monitoring**: Track session metrics

## API Reference

### Health Check Endpoint
```
GET /health
```
Returns server status and configuration.

### MCP SSE Endpoint
```
GET /sse
```
Server-Sent Events endpoint for MCP communication.

### Metrics Endpoint
```
GET /metrics
```
Returns server metrics and usage statistics.

### Debug Info Endpoint
```
GET /debug/info
```
Returns detailed configuration and runtime information.

## Error Handling

The server includes comprehensive error handling:

- **Retry Logic**: Automatic retries for transient failures
- **Rate Limiting**: Handles API rate limits gracefully
- **Budget Enforcement**: Prevents overspending
- **Session Recovery**: Handles session failures
- **Detailed Logging**: Comprehensive error logging

## Monitoring and Logging

### Built-in Monitoring
- Health check endpoints
- Metrics collection
- Session tracking
- Budget monitoring
- Error rate tracking

### Logging Levels
- **Development**: Debug, Info, Warn, Error
- **Production**: Info, Warn, Error

### Key Metrics
- Active session count
- Total API costs
- Request/response times
- Error rates
- Budget utilization

## Security Considerations

- API keys stored as Cloudflare secrets
- Request validation with Zod schemas
- Rate limiting protection
- CORS configured for specific origins
- Sensitive data sanitization in logs

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```bash
   wrangler secret put ANCHOR_API_KEY
   ```

2. **D1 Database Not Connected**
   - Verify `database_id` in `wrangler.toml`
   - Ensure database exists in Cloudflare dashboard

3. **KV Namespace Issues**
   - Create KV namespaces in Cloudflare dashboard
   - Update namespace IDs in `wrangler.toml`

4. **Budget Limits Exceeded**
   - Check current usage with `get_budget_status` tool
   - Adjust limits in environment configuration

5. **Session Creation Failures**
   - Verify Anchor API key validity
   - Check API quota and billing status
   - Review error logs for specific issues

### Debug Commands
```bash
# Check server status
curl https://your-worker.workers.dev/health

# View debug information
curl https://your-worker.workers.dev/debug/info

# Check metrics
curl https://your-worker.workers.dev/metrics
```

## Development Guidelines

### Code Structure
- **Types**: TypeScript interfaces in `src/types/`
- **Clients**: API clients in `src/clients/`
- **Utils**: Helper functions in `src/utils/`
- **MCP**: MCP server implementation in `src/mcp/`
- **Config**: Constants and configuration in `src/config/`

### Testing
- Unit tests for core functionality
- Integration tests with Anchor API
- MCP protocol compliance tests
- Load testing for concurrent sessions

### Contributing
1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include detailed logging
4. Update documentation
5. Test thoroughly before deployment

## Support

For issues and questions:
- Check the troubleshooting guide above
- Review error logs in Cloudflare dashboard
- Test API connectivity with health endpoints
- Verify configuration and environment variables

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0 (2025-01-20)
- Initial release
- Basic MCP server implementation
- Anchor Browser API integration
- Session management and budget tracking
- Health monitoring and metrics
- Complete tool suite for web automation