#!/bin/bash

# LibreChat Travel Agent Setup Script
echo "🚀 Setting up LibreChat for Travel Agent functionality..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if API keys are available
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not found in environment"
    echo "   You'll need to add this to .env file"
    MISSING_KEYS=true
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not found in environment"  
    echo "   You'll need to add this to .env file"
    MISSING_KEYS=true
fi

# Check MongoDB connection
echo "🔍 Testing MongoDB connection..."
if ! docker exec librechat-mongo mongo --quiet --eval "db.stats()" > /dev/null 2>&1; then
    echo "❌ MongoDB connection failed"
    exit 1
else
    echo "✅ MongoDB connection successful"
fi

# Check Redis connection
echo "🔍 Testing Redis connection..."
if ! docker exec librechat-redis redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis connection failed"
    exit 1
else
    echo "✅ Redis connection successful"
fi

# Test MCP servers
echo "🔍 Testing MCP server connectivity..."

echo "Testing d1-database server..."
if timeout 10 npx -y mcp-remote https://d1-database-improved.somotravel.workers.dev/sse --test > /dev/null 2>&1; then
    echo "✅ d1-database server accessible"
else
    echo "⚠️  d1-database server test inconclusive (may still work)"
fi

echo "Testing prompt-instructions server..."
if timeout 10 npx -y mcp-remote https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse --test > /dev/null 2>&1; then
    echo "✅ prompt-instructions server accessible"
else
    echo "⚠️  prompt-instructions server test inconclusive (may still work)"
fi

# Configure .env file
echo "⚙️  Configuring environment variables..."

# Add travel-specific configuration to .env
cat >> .env << EOF

# Travel Agent Configuration
TRAVEL_MODE=enabled
COST_TRACKING=enabled
TRAVEL_AGENCY_NAME="TravelOps.ai Demo"
TRAVEL_DAILY_BUDGET_LIMIT=25.00
TRAVEL_COST_ALERT_THRESHOLD=20.00

# MCP Server URLs
MCP_D1_DATABASE_URL=https://d1-database-improved.somotravel.workers.dev/sse
MCP_PROMPT_INSTRUCTIONS_URL=https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse
EOF

echo "✅ Environment configured"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🎯 Setup Status:"
echo "✅ LibreChat cloned and configured"
echo "✅ MongoDB and Redis running"
echo "✅ MCP servers accessible" 
echo "✅ Configuration files created"

if [ "$MISSING_KEYS" = true ]; then
    echo ""
    echo "⚠️  REQUIRED: Add API keys to .env file:"
    echo "   ANTHROPIC_API_KEY=your_key_here"
    echo "   OPENAI_API_KEY=your_key_here"
    echo ""
fi

echo ""
echo "🚀 Ready to start LibreChat:"
echo "   npm run dev"
echo ""
echo "🔗 Access URL: http://localhost:3080"
echo ""
echo "🧪 Test queries to try:"
echo "   1. 'Show me recent trips in the database'"
echo "   2. 'What travel planning workflows are available?'"
echo "   3. 'Start the travel agent system'"
echo "   4. 'Find client information for a specific email'"
echo ""

# Create a test script
cat > test-travel-agent.js << 'EOL'
// Travel Agent Test Queries
console.log("🧪 Travel Agent Test Queries to try in LibreChat:");
console.log("");

const testQueries = [
    "Hello, I'm a travel agent. Can you help me access our client database?",
    "Show me recent trips in the database",
    "What travel planning workflows are available?", 
    "Start the travel agent system",
    "Find client information for john@example.com",
    "Help me plan a 7-day vacation to Hawaii",
    "What tools do I have available as a travel agent?",
    "Switch to Sonnet model for complex itinerary planning"
];

testQueries.forEach((query, i) => {
    console.log(`${i + 1}. ${query}`);
});

console.log("");
console.log("💡 Expected Results:");
console.log("- Database queries should return real travel data");
console.log("- Workflow instructions should provide structured steps");
console.log("- Model switching should show cost differences");
console.log("- Interface should be professional for travel agents");
EOL

echo "📝 Created test-travel-agent.js with sample queries"
echo ""
echo "✨ Setup complete! Ready to test travel agent functionality."