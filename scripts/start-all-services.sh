#!/bin/bash

echo "🚀 Starting all services for LibreChat + MCP Chrome..."

# Start MongoDB
echo "📦 Starting MongoDB..."
sudo systemctl start mongod
if ! systemctl is-active --quiet mongod; then
    echo "⚠️  MongoDB failed to start. Trying Docker..."
    docker run -d -p 27017:27017 --name librechat-mongo mongo:latest 2>/dev/null || echo "⚠️  Docker MongoDB also failed"
fi

# Start MeiliSearch (optional but recommended)
echo "🔍 Starting MeiliSearch..."
docker run -d -p 7700:7700 --name librechat-meilisearch \
    -e MEILI_MASTER_KEY=DrhYf7zENyR6AlUCKmnz0eYASOQdl6zxH7s7MKFSfFCt \
    getmeili/meilisearch:latest 2>/dev/null || echo "⚠️  MeiliSearch failed to start"

# Wait a moment for services to initialize
sleep 3

# Start Chrome Debug
echo "🌐 Starting Chrome Debug..."
start-chrome-debug &
CHROME_PID=$!

# Start LibreChat
echo "💬 Starting LibreChat..."
cd /home/neil/dev/voygen/librechat-source
npm run dev

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $CHROME_PID 2>/dev/null
    docker stop librechat-mongo librechat-meilisearch 2>/dev/null
}

trap cleanup EXIT