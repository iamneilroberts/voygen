#!/bin/bash

# Quick LibreChat Backend Restart (for testing config changes)
echo "🔄 Restarting LibreChat backend to pick up config changes..."

# Kill backend only (frontend can keep running)
pkill -f "npm run backend:dev"
pkill -f "nodemon api/server/index.js"

sleep 2

# Restart backend
echo "🚀 Starting backend with updated config..."
npm run backend:dev &

echo "✅ Backend restarted! Frontend still running on localhost:3090"
echo "⏳ Wait ~10 seconds for MCP servers to reconnect..."