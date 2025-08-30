#!/bin/bash

# Voygen Setup Script
# This script sets up the Voygen travel agent system with LibreChat

set -e

echo "🚀 Setting up Voygen Travel Agent System..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "librechat-source" ]; then
    echo "❌ Please run this script from the voygen project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys and configuration"
fi

# Build mcp-chrome if it exists
if [ -d "mcp-local-servers/mcp-chrome" ]; then
    echo "🌐 Building MCP Chrome server..."
    cd mcp-local-servers/mcp-chrome
    npm install
    npm run build
    cd ../..
fi

# Set up LibreChat configuration
echo "⚙️  Setting up LibreChat configuration..."
if [ ! -f "librechat-source/librechat.yaml" ]; then
    cp config/librechat-minimal.yaml librechat-source/librechat.yaml
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Ensure MongoDB is running (required for LibreChat)"
echo "3. Run 'npm run start' to launch Voygen"
echo ""
echo "For detailed setup instructions, see README.md"