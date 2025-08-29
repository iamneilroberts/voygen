# Task: LibreChat Foundation Implementation

**ID**: TASK-002  
**Type**: foundation  
**Status**: planned  
**Priority**: critical  
**Assignee**: Lead Developer  
**Estimated Time**: 4 weeks  
**Dependencies**: TASK-001 (Foundation Setup)

## Objective

Implement LibreChat as the primary platform foundation for TravelOps.ai, focusing on MCP integration, multi-model setup, and basic travel agent customizations.

## User Story

As a **travel agent**  
I want to **use a familiar chat interface with multiple AI models and travel-specific tools**  
So that **I can efficiently plan trips while optimizing costs and maintaining professional workflows**

## Context

**Strategic Decision**: Based on multi-AI expert analysis, LibreChat is the optimal foundation:
- **Chat-focused interface** perfect for travel agents (vs Continue.dev's IDE approach)
- **Native MCP support** with 2024 implementation
- **Multi-model switching** for cost optimization (Haiku 12x cheaper than Sonnet)
- **Enterprise features** ready for commercial deployment
- **4-6 weeks to market** vs 6-9 months for custom build

## Expert AI Consensus

- **Haiku**: "LibreChat is significantly more suitable for professional travel agents"
- **Gemini Pro**: "LibreChat is unequivocally the correct foundation"
- **Opus**: "Travel agents need chat interfaces, not developer tools"

## Subtasks

### Week 1: LibreChat Deployment & Basic Configuration
- [ ] Deploy LibreChat instance on staging environment
- [ ] Configure basic authentication and user management
- [ ] Set up MongoDB and Redis dependencies
- [ ] Test basic chat functionality with default models
- [ ] Apply initial travel agency branding (logo, colors)
- [ ] Document deployment process and configuration

### Week 2: Multi-Model Integration & MCP Setup
- [ ] Configure Anthropic models (Haiku, Sonnet) for cost optimization
- [ ] Add OpenAI GPT-4 as fallback provider
- [ ] Set up model selection UI with cost indicators
- [ ] Configure first MCP server (d1-database)
- [ ] Test MCP tool calling functionality
- [ ] Implement basic cost tracking and logging

### Week 3: Travel-Specific MCP Servers
- [ ] Integrate template-document MCP server
- [ ] Connect mcp-chrome for web research
- [ ] Add prompt-instructions-d1 for workflow guidance
- [ ] Test github-mcp for documentation management
- [ ] Configure zen MCP for multi-model capabilities
- [ ] Validate all 12 existing MCP servers compatibility

### Week 4: Travel Agent UI Customizations
- [ ] Create travel-specific chat templates and prompts
- [ ] Implement itinerary display components
- [ ] Add cost tracking dashboard widget
- [ ] Create model selection guidance for travel tasks
- [ ] Set up beta user accounts for testing
- [ ] Conduct user acceptance testing with 5 travel agents

## Technical Requirements

### LibreChat Configuration

```yaml
# librechat.yaml - Production Configuration
version: 1.0.0
cache: true

# Travel Agent Optimized Models
endpoints:
  custom:
    - name: "Haiku (Cost Effective)"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-haiku-20241022"]
      modelDisplayLabel: "Claude Haiku - Economical ($0.25/1M tokens)"
      titleConvo: true
      
    - name: "Sonnet (Premium)"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1" 
      models:
        default: ["claude-3-5-sonnet-20241022"]
      modelDisplayLabel: "Claude Sonnet - Premium ($3.00/1M tokens)"
      
    - name: "GPT-4 (Fallback)"
      apiKey: "${OPENAI_API_KEY}"
      baseURL: "https://api.openai.com/v1"
      models:
        default: ["gpt-4-turbo-preview"]
      modelDisplayLabel: "GPT-4 - Fallback ($10.00/1M tokens)"

# Travel Planning Agent
agents:
  - name: "Travel Planning Assistant"
    description: "Professional travel planning with intelligent cost optimization"
    instructions: |
      You are a professional travel planning assistant specializing in efficient, cost-conscious trip planning. 

      COST OPTIMIZATION STRATEGY:
      - Use Haiku for: Basic queries, simple bookings, routine information
      - Use Sonnet for: Complex itineraries, multi-destination trips, detailed planning
      - Use GPT-4 for: Creative suggestions, unusual destinations, fallback scenarios

      WORKFLOW: Follow the established 12-step travel planning process.
      TOOLS: Leverage all available MCP servers for comprehensive travel services.
      
    tools:
      - type: mcp
        server: d1-database
      - type: mcp
        server: template-document  
      - type: mcp
        server: mcp-chrome
```

### MCP Server Configuration

```json
{
  "mcpServers": {
    "d1-database": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://d1-database-improved.somotravel.workers.dev/sse"],
      "env": {
        "DATABASE_URL": "https://travel-assistant.somotravel.workers.dev"
      }
    },
    "template-document": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://template-document-mcp.somotravel.workers.dev/sse"]
    },
    "mcp-chrome": {
      "command": "node", 
      "args": ["/usr/local/lib/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js"]
    },
    "prompt-instructions-d1": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse"]
    },
    "github-mcp": {
      "command": "npx", 
      "args": ["-y", "mcp-remote", "https://github-mcp-cta.somotravel.workers.dev/sse"]
    },
    "zen": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/BeehiveInnovations/zen-mcp-server.git", "zen-mcp-server"],
      "env": {
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### Travel-Specific UI Components

```typescript
// Custom Components for Travel Interface
interface TravelChatEnhancements {
  // Cost tracking widget
  costTracker: {
    dailySpend: number;
    modelUsage: ModelUsageStats[];
    savingsCalculator: CostComparisonWidget;
  };
  
  // Itinerary display
  itineraryViewer: {
    visualTimeline: ItineraryTimeline;
    costBreakdown: CostAnalysis;
    bookingStatus: BookingTracker;
  };
  
  // Travel agent tools
  agentToolbar: {
    clientSelector: ClientManagement;
    templateLibrary: DocumentTemplates;
    workflowTracker: TwelveStepProgress;
  };
}

// Model Selection Enhancement
const TravelModelSelector = () => {
  const models = [
    {
      name: "Haiku",
      cost: "$0.25/1M",
      bestFor: ["Quick searches", "Simple bookings", "Basic info"],
      savings: "12x cheaper than Sonnet"
    },
    {
      name: "Sonnet", 
      cost: "$3.00/1M",
      bestFor: ["Complex itineraries", "Multi-city trips", "Detailed planning"],
      performance: "Balanced cost & capability"
    },
    {
      name: "GPT-4",
      cost: "$10.00/1M", 
      bestFor: ["Creative suggestions", "Unusual destinations", "Complex reasoning"],
      usage: "Premium tasks only"
    }
  ];
  
  return (
    <ModelSelectionWidget 
      models={models}
      autoSuggest={true}
      costTracker={true}
      travelOptimized={true}
    />
  );
};
```

## Implementation Steps

### Phase 1: Environment Setup (Days 1-3)
1. **Deploy LibreChat Infrastructure**
   ```bash
   # Clone LibreChat repository
   git clone https://github.com/danny-avila/LibreChat.git
   cd LibreChat
   
   # Configure environment
   cp .env.example .env
   # Edit .env with travel-specific configuration
   
   # Deploy with Docker
   docker compose up -d
   ```

2. **Configure Travel Agency Branding**
   - Replace logo and favicon in `client/public/assets/`
   - Update brand colors in CSS variables
   - Customize welcome messages and instructions

3. **Set Up User Management**
   - Create admin account
   - Configure user registration settings
   - Set up role-based access (agents, supervisors, admins)

### Phase 2: Model Integration (Days 4-7)
1. **Configure AI Providers**
   - Add Anthropic API credentials
   - Set up OpenAI fallback
   - Configure model selection UI
   - Test model switching functionality

2. **Implement Cost Tracking**
   ```typescript
   class CostTracker {
     async trackUsage(model: string, tokens: number, cost: number) {
       // Log to database
       await this.logUsage({
         timestamp: new Date(),
         model,
         tokens, 
         cost,
         savings: this.calculateSavings(model, cost)
       });
       
       // Update UI widget
       this.updateCostWidget(cost);
     }
   }
   ```

### Phase 3: MCP Integration (Days 8-14)
1. **Test Each MCP Server Individually**
   - Validate d1-database connectivity
   - Verify template-document functionality
   - Test mcp-chrome web scraping
   - Confirm all tool registrations

2. **Integration Testing**
   - Test multi-server workflows
   - Validate tool calling from chat interface
   - Monitor performance and reliability
   - Handle connection failures gracefully

### Phase 4: Travel UI Customizations (Days 15-21)
1. **Create Travel-Specific Components**
   - Itinerary display widgets
   - Cost breakdown visualizations  
   - Client management interfaces
   - Workflow progress indicators

2. **User Experience Optimization**
   - Travel-specific prompt templates
   - Quick-action buttons for common tasks
   - Contextual help and guidance
   - Mobile-responsive design

### Phase 5: Beta Testing (Days 22-28)
1. **Beta User Setup**
   - Create test accounts for 5 travel agents
   - Provide training materials and guides
   - Set up feedback collection system
   - Monitor usage patterns and issues

2. **Iterate Based on Feedback**
   - Fix critical issues immediately
   - Prioritize feature requests
   - Optimize performance bottlenecks
   - Prepare for wider deployment

## Test Scenarios

### 1. Basic Chat Functionality
- **Test**: Travel agent logs in and starts planning conversation
- **Expected**: Smooth authentication, responsive interface, model selection available
- **Validation**: Complete a simple hotel search using Haiku model

### 2. Multi-Model Cost Optimization
- **Test**: Same query processed by Haiku, Sonnet, and GPT-4
- **Expected**: Cost tracking shows accurate pricing, Haiku demonstrates savings
- **Validation**: Cost widget updates in real-time, savings calculation correct

### 3. MCP Server Integration
- **Test**: Use each MCP server through chat interface
- **Expected**: All tools accessible, responses formatted properly
- **Validation**: d1-database queries work, documents generate, web scraping functions

### 4. Travel Workflow Completion
- **Test**: Complete end-to-end trip planning using multiple tools
- **Expected**: Seamless workflow from research to document generation
- **Validation**: Professional itinerary produced, client data saved

### 5. Error Handling and Recovery
- **Test**: MCP server failures, API timeouts, authentication issues
- **Expected**: Graceful degradation, clear error messages, automatic retries
- **Validation**: System remains stable, user workflow continues

## Test Commands

```bash
# LibreChat deployment test
docker compose up -d
curl http://localhost:3080/health

# MCP server connectivity test
npx -y mcp-remote https://d1-database-improved.somotravel.workers.dev/sse --test

# Model switching test  
curl -X POST http://localhost:3080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test model switching", "model": "claude-3-5-haiku"}'

# Cost tracking validation
node scripts/validate-cost-tracking.js

# UI customization test
npm run build
npm run test:ui
```

## Acceptance Criteria

### Must Have ✅
- [ ] LibreChat deployed and accessible at staging URL
- [ ] All 3 AI models (Haiku, Sonnet, GPT-4) working with cost tracking
- [ ] At least 8 of 12 MCP servers successfully integrated
- [ ] Travel agent branding applied (logo, colors, messaging)
- [ ] 5 beta travel agents can complete full trip planning workflows
- [ ] Cost optimization demonstrating 8x+ savings with smart model selection
- [ ] Basic travel-specific UI components implemented

### Should Have
- [ ] All 12 MCP servers fully integrated and tested
- [ ] Advanced cost dashboard with savings analytics
- [ ] Mobile-responsive design for tablet use
- [ ] User documentation and training materials
- [ ] Performance monitoring and alerting setup

### Could Have
- [ ] White-label customization options
- [ ] Advanced itinerary visualization
- [ ] Team collaboration features
- [ ] Integration with external booking systems
- [ ] Advanced workflow automation

## Risk Assessment

### High Risks
1. **MCP Server Compatibility**: Some servers may need adaptation for LibreChat
   - **Mitigation**: Test each server individually, create compatibility adapters
2. **LibreChat Customization Complexity**: Deep UI changes may be difficult
   - **Mitigation**: Start with minimal changes, use configuration over customization
3. **Model Provider API Changes**: Rate limits or API modifications
   - **Mitigation**: Multiple providers, graceful fallbacks, monitoring

### Medium Risks
1. **Performance at Scale**: LibreChat may not handle high concurrent usage
   - **Mitigation**: Load testing, caching, horizontal scaling
2. **User Adoption Curve**: Travel agents may resist new interface
   - **Mitigation**: Extensive training, gradual rollout, feedback integration

## Success Metrics

### Technical Metrics
- **Deployment Success**: LibreChat accessible within 48 hours
- **MCP Integration**: 90%+ server compatibility rate  
- **Model Performance**: <3 second response times for all models
- **Cost Accuracy**: ±5% accuracy in cost tracking and calculations
- **Uptime**: 99%+ availability during testing period

### User Experience Metrics  
- **Beta Completion**: 80%+ of beta users complete full workflows
- **Task Success**: 90%+ completion rate for travel planning tasks
- **User Satisfaction**: 4.2/5 average rating from beta users
- **Cost Savings**: Demonstrated 8x+ savings with optimal model selection
- **Learning Curve**: New users productive within 30 minutes

## Deliverables

### Week 1
- [ ] LibreChat staging deployment
- [ ] Basic travel agent branding
- [ ] User authentication system
- [ ] Initial documentation

### Week 2  
- [ ] Multi-model configuration
- [ ] Cost tracking system
- [ ] Core MCP server integration
- [ ] Model selection UI

### Week 3
- [ ] All MCP servers connected
- [ ] Advanced tool integration
- [ ] Error handling implementation
- [ ] Performance optimization

### Week 4
- [ ] Travel-specific UI components
- [ ] Beta user environment
- [ ] Testing and feedback system  
- [ ] Production deployment preparation

## Next Tasks

This task enables:
- **TASK-003**: Advanced Travel Agent Features
- **TASK-004**: Commercial Deployment Preparation  
- **TASK-005**: Beta User Onboarding and Feedback
- **TASK-006**: Performance Optimization and Scaling

## Notes

**Critical Success Factor**: MCP server compatibility is make-or-break for this approach. If existing servers don't work with LibreChat's MCP implementation, fallback to Continue.dev may be necessary.

**User Experience Priority**: Travel agents must feel comfortable with the interface from day one. Over-engineering the UI early could hurt adoption.

**Cost Validation**: Proving the 12x cost savings with Haiku is crucial for business model validation and investor confidence.

**Documentation**: Comprehensive documentation is essential for team onboarding and future maintenance.

---

**Created**: August 29, 2025  
**Last Updated**: August 29, 2025  
**Next Review**: September 5, 2025