# LibreChat Travel Agent Setup Instructions

## 🚀 Quick Start Guide

**Status**: LibreChat cloned and ready for configuration
**Location**: `/home/neil/dev/travelops.ai/librechat-source/`
**Next Steps**: Configure environment and test MCP integration

## 📋 Prerequisites Check

Before proceeding, ensure you have:

### Required API Keys
```bash
# Check if you have these environment variables or API keys:
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+✅ Set}"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:+✅ Set}"

# If not set, you'll need to obtain these from:
# - Anthropic Console: https://console.anthropic.com/
# - OpenAI Platform: https://platform.openai.com/
```

### System Dependencies
```bash
# Check Docker installation
docker --version

# Check Node.js version (need 18+)
node --version

# Check if MongoDB/Redis needed or using Docker
docker ps | grep -E "(mongo|redis)"
```

## ⚡ Immediate Next Steps

### Step 1: Configure Environment Variables
```bash
cd /home/neil/dev/travelops.ai/librechat-source

# Edit .env file with your API keys
nano .env

# Add these required variables:
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  

# Travel-specific configuration
TRAVEL_AGENCY_NAME="TravelOps.ai Demo"
TRAVEL_DAILY_BUDGET_LIMIT=25.00
```

### Step 2: Start Database Services
```bash
# Option A: Use Docker (Recommended)
docker run -d --name librechat-mongo -p 27017:27017 mongo:latest
docker run -d --name librechat-redis -p 6379:6379 redis:latest

# Option B: Use existing MongoDB instance
# Update MONGO_URI in .env to point to your instance
```

### Step 3: Install Dependencies and Start
```bash
# Install Node.js dependencies
npm install

# Start LibreChat in development mode
npm run dev

# Should be accessible at http://localhost:3080
```

### Step 4: Test MCP Server Connectivity
```bash
# Test d1-database server
npx -y mcp-remote https://d1-database-improved.somotravel.workers.dev/sse --test

# Test prompt-instructions server  
npx -y mcp-remote https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse --test

# Expected: Both should respond with available tools
```

## 🎯 Configuration Files to Create

### 1. LibreChat MCP Configuration
**File**: `librechat.yaml`
```yaml
version: 1.0.0
cache: true

endpoints:
  custom:
    - name: "Claude Haiku (Cost Effective)"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-haiku-20241022"]
      modelDisplayLabel: "💰 Haiku - Economical ($0.25/1M)"
      
    - name: "Claude Sonnet (Premium)"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-sonnet-20241022"]
      modelDisplayLabel: "⭐ Sonnet - Premium ($3.00/1M)"

agents:
  - name: "Travel Planning Assistant"
    description: "Professional travel planning with database access"
    instructions: |
      You are a professional travel planning assistant with access to:
      - Client and trip database via d1-database tools
      - Structured travel planning workflows
      - Cost optimization through model selection
      
      Use Haiku (current model) for basic queries and lookups.
      Recommend switching to Sonnet for complex itinerary planning.
    tools:
      - type: mcp
        server: d1-database
      - type: mcp  
        server: prompt-instructions

mcpServers:
  d1-database:
    command: "npx"
    args: ["-y", "mcp-remote", "https://d1-database-improved.somotravel.workers.dev/sse"]
    timeout: 30000
    
  prompt-instructions:
    command: "npx" 
    args: ["-y", "mcp-remote", "https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse"]
    timeout: 30000
```

### 2. Travel Agent Environment Variables
**Add to .env**:
```bash
# Travel Agent Specific Configuration
TRAVEL_MODE=enabled
COST_TRACKING=enabled
TRAVEL_AGENCY_NAME="TravelOps.ai Demo"
TRAVEL_DAILY_BUDGET_LIMIT=25.00
TRAVEL_COST_ALERT_THRESHOLD=20.00

# MCP Server Configuration
MCP_D1_DATABASE_URL=https://d1-database-improved.somotravel.workers.dev/sse
MCP_PROMPT_INSTRUCTIONS_URL=https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse
```

## 🧪 Basic Testing Script

Create this test file to validate functionality:

**File**: `test-travel-agent.js`
```javascript
// Basic functionality test
const testQueries = [
  "Test connection to database",
  "Show me available travel planning workflows", 
  "Find recent trips in the system",
  "Start a new travel planning session",
  "What tools do I have available?"
];

console.log("Travel Agent Test Queries:");
testQueries.forEach((query, i) => {
  console.log(`${i + 1}. ${query}`);
});

console.log("\nRun these in LibreChat to test MCP integration");
```

## 📊 Success Indicators

You'll know the setup is successful when:

### ✅ Technical Validation
- [ ] LibreChat loads at http://localhost:3080
- [ ] Can create account and log in
- [ ] Model selection shows Haiku and Sonnet options with cost info
- [ ] Chat interface responds to basic queries
- [ ] MCP tools appear in tool selection (if UI shows them)

### ✅ Travel Agent Functionality
- [ ] Can query: "Show me recent trips in the database"
- [ ] Can ask: "What travel planning workflows are available?"
- [ ] Can run: "Start the travel agent system"
- [ ] Cost tracking shows token usage (if implemented in UI)
- [ ] Can switch between Haiku and Sonnet models

### ✅ User Experience
- [ ] Interface loads quickly (<3 seconds)
- [ ] Chat responses appear within 5 seconds
- [ ] Error messages are clear and actionable
- [ ] Professional appearance suitable for travel agents

## 🚨 Troubleshooting Common Issues

### MCP Server Connection Issues
```bash
# Check server status
curl -I https://d1-database-improved.somotravel.workers.dev/sse
curl -I https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse

# Test with verbose output
npx -y mcp-remote https://d1-database-improved.somotravel.workers.dev/sse --verbose
```

### LibreChat Startup Issues
```bash
# Check logs
npm run dev 2>&1 | tee startup.log

# Common fixes:
# 1. Ensure MongoDB is running
# 2. Check API keys are valid
# 3. Verify network connectivity
# 4. Clear node_modules and reinstall
```

### Database Connection Problems
```bash
# Test MongoDB connection
docker exec -it librechat-mongo mongo --eval "db.stats()"

# Test Redis connection  
docker exec -it librechat-redis redis-cli ping
```

## 🎯 What to Test Once Running

### Basic Travel Agent Workflow Test
1. **Login**: Create account and access chat interface
2. **Model Selection**: Choose Haiku model for cost efficiency
3. **Database Query**: "Find all clients in the system"
4. **Workflow Access**: "Show me travel planning workflows"
5. **Travel Planning**: "Help me plan a trip to Hawaii"
6. **Model Switching**: "Switch to Sonnet for complex planning"
7. **Cost Tracking**: Check if usage costs are displayed

### Expected Results
- Database queries return real data from travel_assistant D1 database
- Workflow instructions provide structured travel planning steps
- Model switching works with clear cost differences shown
- Interface is professional and suitable for travel agents

---

**Ready to proceed?** Follow the steps above and let me know if you encounter any issues or need help with API key configuration.

**Current Status**: ✅ LibreChat installed, ⏳ Configuration needed
**Next Milestone**: Working travel agent chat interface with MCP integration
**Estimated Time**: 30-60 minutes for basic setup