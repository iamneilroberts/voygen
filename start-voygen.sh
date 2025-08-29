#!/bin/bash

# Voygen Startup Script
echo "🚀 Starting Voygen - AI Travel Assistant"

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the voygen project root directory"
    exit 1
fi

# Set environment variables for development
export NODE_ENV=development
export LIBRECHAT_CONFIG_PATH="../librechat.yaml"

# Start LibreChat in development mode
echo "📦 Starting LibreChat with MCP servers..."
cd librechat-source

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "⚙️  Installing dependencies..."
    npm install
fi

# Start the development server
echo "🌐 Starting development server on http://localhost:3080"
npm run dev