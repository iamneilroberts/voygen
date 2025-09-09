#!/bin/bash

# Start Chrome Debug Mode for MCP Server
# Usage: start-chrome-debug [OPTIONS]
# 
# Options:
#   --headless       Run Chrome in headless mode (no GUI)
#   --port PORT      Use custom debug port (default: 9222)
#   --persistent     Use persistent profile (default: temporary)
#   --no-extension   Don't load MCP Chrome extension
#   --help           Show this help message

PORT=9222
HEADLESS=false
PERSISTENT=false
USER_DATA_DIR=""
# Use the modified mcp-chrome-web-extract extension with hotel extraction logic
EXTENSION_DIR="/home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.output/chrome-mv3"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headless)
      HEADLESS=true
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --persistent)
      PERSISTENT=true
      shift
      ;;
    --no-extension)
      EXTENSION_DIR=""
      shift
      ;;
    --help|-h)
      echo "Start Chrome Debug Mode for MCP Server"
      echo ""
      echo "Usage: start-chrome-debug [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --headless       Run Chrome in headless mode (no GUI)"
      echo "  --port PORT      Use custom debug port (default: 9222)"
      echo "  --persistent     Use persistent profile (default: temporary)"
      echo "  --no-extension   Don't load MCP Chrome extension"
      echo "  --help           Show this help message"
      echo ""
      echo "Examples:"
      echo "  start-chrome-debug                    # Normal Chrome with MCP extension"
      echo "  start-chrome-debug --persistent       # Use persistent profile"
      echo "  start-chrome-debug --headless         # Headless Chrome"
      echo "  start-chrome-debug --port 9223        # Custom port"
      echo "  start-chrome-debug --no-extension     # Without MCP extension"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set user data directory based on persistent flag
if [ "$PERSISTENT" = true ]; then
  USER_DATA_DIR="$HOME/.chrome-debug-profile"
  echo "Using persistent profile at: $USER_DATA_DIR"
else
  USER_DATA_DIR="/tmp/chrome-debug-$$"  # Use PID for unique directory
  echo "Using temporary profile at: $USER_DATA_DIR"
fi

# Create user data directory
mkdir -p "$USER_DATA_DIR"

# Build Chrome command
CHROME_CMD="google-chrome"
CHROME_ARGS=(
  "--remote-debugging-port=$PORT"
  "--user-data-dir=$USER_DATA_DIR"
  "--no-first-run"
  "--disable-default-apps"
  "--disable-background-timer-throttling"
  "--disable-backgrounding-occluded-windows"
  "--disable-renderer-backgrounding"
)

# Add MCP Chrome extension if not disabled
if [ -n "$EXTENSION_DIR" ] && [ -d "$EXTENSION_DIR" ]; then
  CHROME_ARGS+=("--load-extension=$EXTENSION_DIR")
  # Enable developer mode for extensions
  CHROME_ARGS+=("--enable-extension-developer-mode")
  echo "Loading MCP Chrome extension from: $EXTENSION_DIR"
elif [ -n "$EXTENSION_DIR" ]; then
  echo "Warning: Extension directory not found: $EXTENSION_DIR"
fi

if [ "$HEADLESS" = true ]; then
  CHROME_ARGS+=("--headless")
  echo "Starting Chrome in headless debug mode..."
else
  CHROME_ARGS+=("--new-window")
  echo "Starting Chrome in debug mode..."
fi

echo "Debug port: $PORT"
echo "User data directory: $USER_DATA_DIR"

# Check if Chrome is available
if ! command -v google-chrome &> /dev/null; then
  echo "Error: google-chrome not found in PATH"
  echo "Please install Google Chrome or add it to your PATH"
  exit 1
fi

# Check if port is already in use
if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
  echo "Warning: Port $PORT is already in use"
  echo "Chrome debug might already be running or another service is using this port"
fi

# Start Chrome with debug mode
echo "Starting: $CHROME_CMD ${CHROME_ARGS[*]}"
exec "$CHROME_CMD" "${CHROME_ARGS[@]}"