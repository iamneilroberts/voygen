# Getting Started with TravelOps.ai

## Quick Overview

TravelOps.ai is an LLM-agnostic AI travel planning platform built on Continue.dev with Model Context Protocol (MCP) integration. This guide will help you get up and running quickly.

## Prerequisites

- **Node.js**: Version 18 or higher
- **Git**: Latest version
- **Docker**: Optional, for containerized development
- **API Keys**: Anthropic, OpenAI, and/or Google AI credentials

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/travelops-ai/travelops-ai.git
cd travelops-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Continue.dev

```bash
# Install Continue.dev CLI
npm install -g @continue/cli

# Verify installation
continue --version
```

### 4. Environment Configuration

Create a `.env` file in the project root:

```bash
# AI Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GOOGLE_AI_API_KEY=your_google_key_here

# Development Configuration
NODE_ENV=development
PORT=3000
DEBUG=true

# MCP Server URLs (use existing Claude Travel Agent servers)
MCP_D1_DATABASE_URL=https://d1-database-improved.somotravel.workers.dev/sse
MCP_TEMPLATE_DOCUMENT_URL=https://template-document-mcp.somotravel.workers.dev/sse
MCP_CHROME_URL=local
MCP_PROMPT_INSTRUCTIONS_URL=https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse
MCP_GITHUB_URL=https://github-mcp-cta.somotravel.workers.dev/sse

# Cost Tracking
DAILY_COST_LIMIT=50.00
COST_ALERT_THRESHOLD=40.00
```

### 5. Configure Continue.dev

Create a `continue-config.yml` file:

```yaml
name: travelops-ai
version: 1.0.0

models:
  - provider: anthropic
    model: claude-3-5-haiku-20241022
    apiKey: ${ANTHROPIC_API_KEY}
    costPerToken: 0.00025
    
  - provider: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: ${ANTHROPIC_API_KEY}
    costPerToken: 0.003
    
  - provider: openai
    model: gpt-4-turbo-preview
    apiKey: ${OPENAI_API_KEY}
    costPerToken: 0.01

mcpServers:
  - name: d1-database
    command: npx
    args:
      - -y
      - mcp-remote
      - ${MCP_D1_DATABASE_URL}
    
  - name: template-document
    command: npx
    args:
      - -y
      - mcp-remote
      - ${MCP_TEMPLATE_DOCUMENT_URL}

workflows:
  travel_planning:
    steps: 12
    default_model: claude-3-5-haiku-20241022
    complex_model: claude-3-5-sonnet-20241022
    fallback_model: gpt-4-turbo-preview
```

### 6. Test the Setup

```bash
# Test Continue.dev installation
continue test-models

# Test MCP server connectivity
continue test-mcp-servers

# Run the development server
npm run dev
```

## Basic Usage

### Starting a Travel Planning Session

1. **Open the application** in your browser (http://localhost:3000)
2. **Select your preferred AI model** based on task complexity and budget
3. **Begin the 12-step travel planning workflow**:
   - Destination research
   - Budget analysis
   - Accommodation options
   - Transportation planning
   - Activity recommendations
   - Dining suggestions
   - Document generation
   - And more...

### Model Selection Guidelines

**Use Claude Haiku 3.5 for**:
- Simple destination queries
- Basic itinerary generation
- Routine document creation
- Cost-effective operations

**Use Claude Sonnet 3.5 for**:
- Complex multi-destination trips
- Detailed budget optimization
- Comprehensive travel planning
- High-quality document generation

**Use GPT-4 for**:
- Creative travel suggestions
- Unusual destination planning
- Fallback when Claude is unavailable
- Specific formatting requirements

### Cost Optimization

The platform automatically suggests the most cost-effective model for each task while maintaining quality standards. You can:

- Set daily spending limits
- Receive alerts when approaching budget thresholds
- View real-time cost tracking
- Compare costs across different models

## Development Workflow

### Running Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Code Quality

```bash
# Check TypeScript types
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

### Building and Deployment

```bash
# Build for production
npm run build

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Project Structure

```
travelops.ai/
├── src/
│   ├── core/              # Core platform logic
│   ├── ui/                # React components
│   ├── extensions/        # Continue.dev extensions
│   └── agents/            # Custom AI agents
├── docs/                  # Documentation
├── tests/                 # Test files
├── .project/              # Project management
└── config/                # Configuration files
```

## Common Issues

### Continue.dev Not Found
```bash
# Reinstall Continue.dev
npm uninstall -g @continue/cli
npm install -g @continue/cli
```

### MCP Server Connection Errors
- Check server URLs in your `.env` file
- Verify your internet connection
- Test servers individually with `continue test-mcp-servers`

### API Key Issues
- Verify API keys are correctly set in `.env`
- Check API key permissions and quotas
- Test with minimal requests first

### High Costs
- Review your model selection strategy
- Check the cost tracking dashboard
- Consider using Haiku for more tasks
- Set lower daily limits

## Getting Help

- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Report bugs on GitHub
- **Discussions**: Join our community discussions
- **Support**: Contact the development team

## Next Steps

1. **Complete the tutorial**: Follow the step-by-step guide
2. **Explore the UI**: Familiarize yourself with the interface
3. **Test model switching**: Try different AI providers
4. **Create your first trip**: Plan a complete travel itinerary
5. **Review costs**: Monitor your usage and optimize

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to contribute to the project.

---

**Need help?** Check our [FAQ](docs/faq.md) or join our [community discussions](https://github.com/travelops-ai/travelops-ai/discussions).