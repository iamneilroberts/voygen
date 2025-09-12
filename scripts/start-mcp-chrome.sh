#!/bin/bash

# Script to start MCP Chrome HTTP server for Claude Code integration

echo "Starting MCP Chrome HTTP server..."

cd /home/neil/dev/voygen/mcp-local-servers/mcp-chrome

# Check if server is already running
if lsof -i:12306 >/dev/null 2>&1; then
    echo "⚠️  Server already running on port 12306"
    echo "To restart, first kill the existing process:"
    echo "  pkill -f 'node.*start-mcp-server.cjs'"
    exit 1
fi

# Start the server
node start-mcp-server.cjs &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Check if server started successfully
if lsof -i:12306 >/dev/null 2>&1; then
    echo "✅ MCP Chrome server started successfully (PID: $SERVER_PID)"
    echo "Server running at: http://127.0.0.1:12306"
    echo ""
    echo "To stop the server, run:"
    echo "  kill $SERVER_PID"
else
    echo "❌ Failed to start MCP Chrome server"
    exit 1
fi