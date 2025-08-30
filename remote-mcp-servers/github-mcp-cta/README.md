# GitHub MCP Server for CTA

A Cloudflare Workers-based MCP server that enables the Claude Travel Agent (CTA) to publish professional travel documents directly to GitHub Pages.

## Features

- **Direct GitHub Integration**: Publishes HTML travel documents to GitHub repository
- **Automatic Index Management**: Updates index.html with trip cards automatically
- **PAT Authentication**: Secure Personal Access Token authentication (no OAuth complexity)
- **Professional Document Publishing**: Seamless integration with CTA's `/publish` command
- **Error Handling**: Comprehensive validation and retry logic

## MCP Tools

1. **github_create_file** - Create new HTML travel documents
2. **github_update_file** - Update existing files
3. **github_get_file** - Read file content and metadata
4. **github_list_files** - Browse repository structure
5. **publish_travel_document** - Complete publishing workflow with index updates

## Setup and Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure GitHub Personal Access Token

Create a GitHub Personal Access Token with `repo` permissions:
1. Go to GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)
2. Generate new token with these permissions:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)

### 3. Set Cloudflare Worker Secrets

```bash
wrangler secret put GITHUB_TOKEN
# Enter your GitHub Personal Access Token
```

### 4. Update Environment Variables

Edit `wrangler.toml` to set your GitHub repository:
```toml
[vars]
GITHUB_OWNER = "your-github-username"
GITHUB_REPO = "your-repository-name"
```

### 5. Deploy to Cloudflare Workers

```bash
# Deploy to production
npm run deploy

# Or deploy to development
wrangler deploy --env development
```

### 6. Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://github-mcp-cta.somotravel.workers.dev/sse"]
    }
  }
}
```

## Testing

### Local Testing
```bash
npm test
```

### Health Check
```bash
curl https://github-mcp-cta.somotravel.workers.dev/health
```

### Integration Testing
Test individual MCP tools through Claude Desktop or direct API calls.

## GitHub Pages Structure

The server maintains the existing somotravel.us structure:

### Index.html Trip Card Format
```html
<div class="trip-card">
  <div class="trip-info">
    <div class="trip-title">Client Name - Destination</div>
    <div class="trip-dates">Start Date - End Date</div>
    <div class="trip-status status-class">Status</div>
  </div>
  <a href="filename.html" class="trip-link">View Details</a>
</div>
```

### Document Filename Convention
- Format: `{client-name}-{destination}-{dates}.html`
- Examples: `sara-darren-bristol-oct2025.html`

## CTA Integration

The server integrates with CTA's `/publish` command:

```
/publish
```

This will:
1. Generate professional travel document HTML
2. Create/update the document file on GitHub
3. Update index.html with new trip card
4. Provide live URLs for sharing with clients

## Error Handling

The server includes comprehensive error handling:

- **Validation Errors**: Input validation for all parameters
- **GitHub API Errors**: Proper error codes and retry logic
- **Rate Limiting**: Automatic retry with exponential backoff
- **Authentication Issues**: Clear error messages for token problems

## Security

- GitHub PAT stored securely in Cloudflare Worker secrets
- Input validation prevents malicious content
- No sensitive information in error messages
- Repository permissions limited to specified repo only

## Performance

- Response Time: < 2 seconds for file operations
- Publishing Flow: < 5 seconds end-to-end
- Error Rate: < 1% under normal load
- Automatic retry logic for transient failures

## Architecture

```
CTA /publish Command
       ↓
Template-Document MCP (generates HTML)
       ↓
GitHub MCP Server (this server)
       ↓
GitHub API (creates/updates files)
       ↓
GitHub Pages (publishes to somotravel.us)
```

## Troubleshooting

### Common Issues

1. **GitHub Authentication Failed**
   - Check GITHUB_TOKEN is set correctly
   - Verify token has `repo` permissions
   - Ensure token hasn't expired

2. **File Not Found Errors**
   - Check GITHUB_OWNER and GITHUB_REPO settings
   - Verify repository exists and is accessible

3. **Publishing Failures**
   - Check index.html exists in repository
   - Verify trip-cards section exists in index.html
   - Check for file naming conflicts

### Debug Commands

```bash
# Check server health
curl https://github-mcp-cta.somotravel.workers.dev/health

# View server logs
wrangler tail

# Test locally
npm test
```

## Development

### Project Structure
```
src/
├── index.ts           # Main MCP server handler
├── github-client.ts   # GitHub API client
├── validation.ts      # Input validation
├── index-manager.ts   # Index.html management
└── types.ts          # TypeScript types

test-local.js         # Local testing script
wrangler.toml        # Cloudflare Worker config
```

### Building
```bash
npm run build
```

### Local Development
```bash
wrangler dev
```

## License

MIT License - Built for Claude Travel Agent system.