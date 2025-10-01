#!/usr/bin/env node

// Test Travel Agent Setup
console.log("🧪 Testing TravelOps.ai LibreChat Setup");
console.log("=====================================\n");

// Check environment variables
const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'MONGO_URI',
    'TRAVEL_MODE'
];

console.log("📋 Environment Variables Check:");
requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
        console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`);
    } else {
        console.log(`❌ ${envVar}: Missing`);
    }
});

console.log("\n🎯 Travel Agent Configuration:");
console.log(`✅ Agency Name: ${process.env.TRAVEL_AGENCY_NAME || 'Not set'}`);
console.log(`✅ Daily Budget Limit: $${process.env.TRAVEL_DAILY_BUDGET_LIMIT || 'Not set'}`);
console.log(`✅ Cost Alert Threshold: $${process.env.TRAVEL_COST_ALERT_THRESHOLD || 'Not set'}`);

console.log("\n🔗 MCP Server URLs:");
console.log(`✅ d1-database: ${process.env.MCP_D1_DATABASE_URL || 'Not configured'}`);
console.log(`✅ prompt-instructions: ${process.env.MCP_PROMPT_INSTRUCTIONS_URL || 'Not configured'}`);

console.log("\n🧪 Test Queries to Try in LibreChat:");
const testQueries = [
    "Hello, I'm a travel agent. Can you help me access our client database?",
    "Show me recent trips in the database",
    "What travel planning workflows are available?", 
    "Start the travel agent system",
    "Find client information for a test email",
    "Help me plan a vacation to Hawaii",
    "What tools do I have available as a travel agent?",
    "Switch to Sonnet model for complex itinerary planning"
];

testQueries.forEach((query, i) => {
    console.log(`   ${i + 1}. "${query}"`);
});

console.log("\n🎯 Expected Functionality:");
console.log("✅ Database queries should return real travel data");
console.log("✅ Workflow instructions should provide structured steps");
console.log("✅ Model switching should show cost differences (Haiku $0.25/1M vs Sonnet $3.00/1M)");
console.log("✅ Interface should be professional for travel agents");

console.log("\n🚀 Ready to start LibreChat:");
console.log("   npm run dev");
console.log("\n🔗 Access URL: http://localhost:3080");
console.log("\n💡 Create an account, then test the queries above!");