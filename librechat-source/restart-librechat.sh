#!/bin/bash

# LibreChat Quick Restart Script
echo "🔄 Restarting LibreChat..."

# Kill existing processes
echo "⏹️  Stopping backend..."
pkill -f "npm run backend:dev" || true
pkill -f "nodemon api/server/index.js" || true

echo "⏹️  Stopping frontend..."
pkill -f "npm run frontend:dev" || true
pkill -f "vite" || true

# Wait for processes to stop
sleep 3

echo "🚀 Starting backend..."
npm run backend:dev &
BACKEND_PID=$!

# Wait for backend to initialize
echo "⏳ Waiting for backend to start..."
sleep 8

echo "🚀 Starting frontend..."
npm run frontend:dev &
FRONTEND_PID=$!

# Wait a moment for services to start
sleep 3

echo ""
echo "✅ LibreChat restarted successfully!"
echo "🔗 Frontend: http://localhost:3090"
echo "🔗 Backend API: http://localhost:3080"
echo ""
echo "📝 Process IDs:"
echo "   Backend: $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "💡 To stop both services:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📋 Logs:"
echo "   Backend logs: tail -f /tmp/librechat-backend.log"
echo "   Frontend logs: tail -f /tmp/librechat-frontend.log"