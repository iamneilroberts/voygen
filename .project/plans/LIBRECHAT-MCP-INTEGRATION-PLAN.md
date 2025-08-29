# LibreChat MCP Integration Plan
**Phase 1: Basic Travel Agent Assistant Functionality**

## 📋 Objective

Set up LibreChat with d1-database and prompt-instructions MCP servers to create a basic travel agent assistant that can:
- Access client and trip data from the existing travel_assistant database
- Use structured travel planning workflows and instructions
- Demonstrate cost-optimized model switching (Haiku vs Sonnet)
- Provide a professional chat interface for travel agents

## 🎯 Success Criteria

- [ ] LibreChat deployed and accessible locally
- [ ] d1-database MCP server connected and functional  
- [ ] prompt-instructions MCP server integrated
- [ ] Travel agent can complete basic trip lookup and planning
- [ ] Model switching works with cost tracking
- [ ] Professional travel branding applied

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                LibreChat Frontend                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │
│  │   Travel Agent  │ │  Cost Tracker   │ │ Model       │ │
│  │   Chat UI       │ │   Widget        │ │ Selector    │ │
│  └─────────────────┘ └─────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                LibreChat Backend                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │
│  │   Multi-Model   │ │   MCP Client    │ │   MongoDB   │ │
│  │   Manager       │ │   Integration   │ │   Storage   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    MCP Servers                          │
│  ┌─────────────────┐ ┌─────────────────┐               │
│  │   d1-database   │ │ prompt-instruc  │               │
│  │   (Client Data) │ │ (Workflows)     │               │
│  └─────────────────┘ └─────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Implementation Plan

### Phase 1A: LibreChat Basic Setup (Days 1-2)

#### Day 1: Environment Setup
```bash
# 1. Navigate to LibreChat source
cd /home/neil/dev/travelops.ai/librechat-source

# 2. Copy environment template
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Set up MongoDB and Redis
docker run -d --name librechat-mongo -p 27017:27017 mongo:latest
docker run -d --name librechat-redis -p 6379:6379 redis:latest
```

#### Day 2: Basic Configuration
```bash
# 1. Configure environment variables
# Edit .env file with basic settings

# 2. Start LibreChat
npm run dev

# 3. Verify basic functionality
curl http://localhost:3080/health
```

### Phase 1B: MCP Server Integration (Days 3-5)

#### Day 3: MCP Configuration Structure
Create `librechat.yaml` with MCP server definitions:

```yaml
version: 1.0.0
cache: true

# Multi-Model Setup for Travel Agents
endpoints:
  custom:
    # Haiku for cost-effective operations
    - name: "Claude Haiku (Economical)"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-haiku-20241022"]
      modelDisplayLabel: "💰 Haiku - Cost Effective ($0.25/1M tokens)"
      titleConvo: true
      
    # Sonnet for complex planning
    - name: "Claude Sonnet (Premium)" 
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-sonnet-20241022"]  
      modelDisplayLabel: "⭐ Sonnet - Premium Planning ($3.00/1M tokens)"

# Travel Planning Agent with MCP Tools
agents:
  - name: "Travel Planning Assistant"
    description: "Professional travel planning with intelligent cost optimization and access to client database"
    instructions: |
      You are a professional travel planning assistant with access to client data and structured workflows.
      
      **COST OPTIMIZATION STRATEGY:**
      - Use this model (Haiku) for: Basic queries, simple lookups, routine information
      - Recommend Sonnet for: Complex itineraries, multi-destination trips, detailed planning
      
      **AVAILABLE TOOLS:**
      - Database access for client and trip information
      - Structured workflow instructions for travel planning
      - Document generation and travel resources
      
      **PROFESSIONAL APPROACH:**
      - Always maintain confidentiality of client information
      - Follow established travel planning workflows
      - Provide cost-conscious recommendations
      - Escalate complex requests to premium models when appropriate
      
    tools:
      - type: mcp
        server: d1-database
      - type: mcp
        server: prompt-instructions
```

#### Day 4: d1-database MCP Integration

**Test Connection:**
```bash
# Test d1-database server connectivity
npx -y mcp-remote https://d1-database-improved.somotravel.workers.dev/sse --test

# Expected: Server responds with available tools list
```

**Add to LibreChat MCP Configuration:**
```yaml
mcpServers:
  d1-database:
    command: "npx"
    args: 
      - "-y"
      - "mcp-remote" 
      - "https://d1-database-improved.somotravel.workers.dev/sse"
    env:
      DATABASE_URL: "https://travel-assistant.somotravel.workers.dev"
    timeout: 30000
    description: "Access to client and trip database"
```

**Integration Tests:**
- [ ] List all tools available from d1-database server
- [ ] Test `get_anything` tool with simple client query
- [ ] Verify trip data retrieval functionality
- [ ] Test error handling for invalid queries

#### Day 5: prompt-instructions MCP Integration

**Test Connection:**
```bash
# Test prompt-instructions server connectivity  
npx -y mcp-remote https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse --test
```

**Add to LibreChat MCP Configuration:**
```yaml
mcpServers:
  prompt-instructions:
    command: "npx"
    args:
      - "-y"
      - "mcp-remote"
      - "https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse"
    timeout: 30000
    description: "Travel planning workflows and instructions"
```

**Integration Tests:**
- [ ] Test `travel_agent_start` tool for initialization
- [ ] Verify workflow instruction retrieval
- [ ] Test instruction loading by category
- [ ] Validate help and status commands

### Phase 1C: Travel Agent Customization (Days 6-7)

#### Day 6: Basic UI Branding

**Logo and Branding:**
```bash
# Navigate to client assets
cd /home/neil/dev/travelops.ai/librechat-source/client/public/assets

# Replace default assets with travel branding
# - favicon.svg → travel-themed icon
# - logo.svg → travel agency logo  
# - Update manifest.json with travel app info
```

**CSS Customization:**
```css
/* Add to client/src/styles/travel-theme.css */
:root {
  --travel-primary: #2563eb;    /* Travel blue */
  --travel-secondary: #059669;  /* Success green */
  --travel-accent: #dc2626;     /* Alert red */
  --travel-neutral: #64748b;    /* Professional gray */
}

.travel-chat-container {
  background: linear-gradient(135deg, var(--travel-primary) 0%, #1e40af 100%);
}

.cost-tracker {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
```

#### Day 7: Travel Agent Prompts and Instructions

**Create Travel-Specific System Prompts:**
```markdown
# Travel Agent System Prompt Template
You are a professional travel planning assistant working for a travel agency. You have access to:

1. **Client Database**: Historical bookings, preferences, and contact information
2. **Travel Workflows**: Structured 12-step planning process
3. **Cost Optimization**: Multiple AI models for different complexity levels

## Your Responsibilities:
- Maintain client confidentiality
- Follow professional travel planning workflows  
- Optimize costs by using appropriate AI models
- Provide accurate, up-to-date travel information
- Generate professional documentation

## Model Usage Guidelines:
- **Haiku (Current)**: Simple queries, basic lookups, routine tasks
- **Sonnet**: Complex itineraries, multi-destination planning, detailed analysis
- **GPT-4**: Fallback for unique requests or when other models unavailable

## Available Tools:
- Database queries for client and trip information
- Workflow instructions and travel planning steps
- Document generation and templates
```

## 🧪 Testing Plan

### Integration Testing Checklist

#### MCP Server Connectivity
- [ ] d1-database server responds to health checks
- [ ] prompt-instructions server accessible and functional
- [ ] Tool discovery working for both servers
- [ ] Error handling graceful for server outages

#### Database Functionality
```bash
# Test queries to run in LibreChat chat:
1. "Show me recent trips in the database"
2. "Find client information for john@example.com" 
3. "What travel workflows are available?"
4. "Start the travel planning process"
```

#### Model Switching
- [ ] Haiku model loads and responds (verify cost tracking)
- [ ] Sonnet model accessible for complex queries
- [ ] Model selection UI shows cost information
- [ ] Usage tracking logs token consumption correctly

#### Travel Agent Workflow
```
Test Scenario: Complete Travel Planning Session
1. Agent logs into LibreChat
2. Selects Haiku model for cost efficiency
3. Looks up existing client: "Find trips for Smith family"
4. Starts new trip planning: "Plan a 7-day Hawaii vacation"
5. Uses workflow tools: "What's step 1 in trip planning?"
6. Switches to Sonnet for complex itinerary
7. Generates summary document
```

### Performance Testing
- [ ] Response time <3 seconds for simple queries
- [ ] Database queries complete within 5 seconds
- [ ] UI remains responsive during MCP tool calls
- [ ] Memory usage stable during extended sessions

## 📊 Success Metrics

### Technical Metrics
- **MCP Integration**: 100% tool availability from both servers
- **Response Time**: <3s for Haiku queries, <5s for complex Sonnet tasks
- **Error Rate**: <5% for standard database and workflow operations
- **Uptime**: 95%+ availability during testing period

### User Experience Metrics
- **Task Completion**: Travel agent can complete basic trip lookup in <2 minutes
- **Workflow Adherence**: Successfully follows structured planning process
- **Cost Awareness**: Clear visibility into model costs and savings
- **Professional Interface**: Clean, branded experience appropriate for business use

## 🚨 Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| **MCP Server Downtime** | Implement graceful error handling, show clear status messages |
| **LibreChat Configuration Issues** | Maintain backup configuration files, document all changes |
| **Model Provider API Limits** | Monitor usage, implement rate limiting alerts |
| **Database Connection Issues** | Add retry logic, fallback to cached responses where possible |

### User Experience Risks
| Risk | Mitigation |
|------|------------|
| **Complex Setup Process** | Create step-by-step setup documentation |
| **Poor Performance** | Optimize queries, implement caching for common requests |
| **Confusing Interface** | User testing with actual travel agents, iterative UI improvements |
| **Cost Transparency** | Clear cost displays, usage warnings, budget controls |

## 📝 Environment Configuration

### Required Environment Variables
```bash
# API Keys
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here  # For fallback

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/librechat
REDIS_URI=redis://localhost:6379

# MCP Server URLs  
MCP_D1_DATABASE_URL=https://d1-database-improved.somotravel.workers.dev/sse
MCP_PROMPT_INSTRUCTIONS_URL=https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse

# Travel Agent Configuration
TRAVEL_AGENCY_NAME="TravelOps.ai Demo"
TRAVEL_DAILY_BUDGET_LIMIT=25.00
TRAVEL_COST_ALERT_THRESHOLD=20.00
```

### Docker Compose Configuration
```yaml
# docker-compose.override.yml for travel agent setup
version: '3.8'
services:
  api:
    environment:
      - TRAVEL_MODE=enabled
      - MCP_SERVERS_CONFIG=/app/config/mcp-servers.json
    volumes:
      - ./config:/app/config
  
  client:
    environment:
      - TRAVEL_BRANDING=enabled
      - COST_TRACKING=enabled
```

## 🎯 Next Steps After Completion

1. **Enhanced Features** (Phase 2):
   - Add more MCP servers (mcp-chrome, template-document)
   - Implement advanced cost analytics
   - Create travel-specific UI components

2. **Production Preparation** (Phase 3):
   - Set up production MongoDB and Redis instances
   - Configure SSL certificates and domain
   - Implement backup and monitoring systems

3. **User Training** (Phase 4):
   - Create user documentation and training materials
   - Conduct sessions with beta travel agents
   - Gather feedback for UI improvements

---

**Estimated Completion Time**: 7 days  
**Prerequisites**: LibreChat cloned, Docker installed, API keys available  
**Success Definition**: Travel agent can complete basic client lookup and trip planning using MCP tools through LibreChat interface

*Created: August 29, 2025*  
*Last Updated: August 29, 2025*  
*Next Review: September 5, 2025*