#!/bin/bash

# Chrome debug launcher script

# Set the debug port (default: 9222)
DEBUG_PORT=9222

# Set user data directory (optional - uses a separate profile for debugging)
USER_DATA_DIR="/tmp/chrome-debug-profile"

# Detect the OS and set Chrome path accordingly
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v google-chrome &> /dev/null; then
        CHROME_PATH="google-chrome"
    elif command -v google-chrome-stable &> /dev/null; then
        CHROME_PATH="google-chrome-stable"
    elif command -v chromium-browser &> /dev/null; then
        CHROME_PATH="chromium-browser"
    else
        echo "Chrome/Chromium not found on Linux"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ ! -f "$CHROME_PATH" ]; then
        echo "Chrome not found at $CHROME_PATH"
        exit 1
    fi
else
    echo "Unsupported operating system"
    exit 1
fi

# Kill any existing Chrome processes using the debug port
lsof -ti:$DEBUG_PORT | xargs kill -9 2>/dev/null

echo "Starting Chrome in debug mode..."
echo "Debug port: $DEBUG_PORT"
echo "User data directory: $USER_DATA_DIR"

# Launch Chrome with debugging flags
"$CHROME_PATH" \
    --remote-debugging-port=$DEBUG_PORT \
    --user-data-dir="$USER_DATA_DIR" \
    --no-first-run \
    --no-default-browser-check \
    &

echo "Chrome started in debug mode on port $DEBUG_PORT"
echo "You can connect to it via:"
echo "  - Chrome DevTools: chrome://inspect"
echo "  - Direct URL: http://localhost:$DEBUG_PORT"
