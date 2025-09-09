#!/bin/bash

# MCP Chrome Hotel Extraction Test Suite
# Tests all phases of the extraction plan

set -e

echo "========================================="
echo "MCP Chrome Hotel Extraction Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Chrome extension is connected
check_port() {
    if ss -ltn | grep -q ":$1"; then
        return 0
    else
        return 1
    fi
}

echo -e "${YELLOW}Pre-flight checks...${NC}"
echo ""

# Check for required ports
MCP_PORT=${MCP_PORT:-56889}
if check_port $MCP_PORT; then
    echo -e "${GREEN}✓${NC} MCP server is running on port $MCP_PORT"
else
    echo -e "${RED}✗${NC} MCP server not found on port $MCP_PORT"
    echo ""
    echo "Please ensure:"
    echo "1. Chrome extension is loaded (chrome://extensions)"
    echo "2. Extension popup shows 'Connected'"
    echo "3. Native host is registered (run: node app/native-server/dist/cli.js register)"
    exit 1
fi

echo ""
echo "========================================="
echo "Phase 1: Basic Connectivity Test"
echo "========================================="
echo ""

if [ -f "scripts/smoke-min.js" ]; then
    echo "Running smoke test..."
    node scripts/smoke-min.js
    SMOKE_EXIT=$?
    if [ $SMOKE_EXIT -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Phase 1 PASSED"
    else
        echo -e "${RED}✗${NC} Phase 1 FAILED"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} Smoke test not found, skipping Phase 1"
fi

echo ""
echo "========================================="
echo "Phase 2: Hotel Extraction Test"
echo "========================================="
echo ""

if [ -f "scripts/test-hotel-extraction.js" ]; then
    echo "Testing hotel extraction on CP Maxx..."
    
    # Option to use custom URL
    if [ ! -z "$TEST_URL" ]; then
        echo "Using custom test URL: $TEST_URL"
    fi
    
    node scripts/test-hotel-extraction.js
    EXTRACT_EXIT=$?
    if [ $EXTRACT_EXIT -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Phase 2 PASSED"
    else
        echo -e "${RED}✗${NC} Phase 2 FAILED"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} Hotel extraction test not found, skipping Phase 2"
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo -e "${GREEN}✓${NC} All tests passed successfully!"
echo ""
echo "Next steps:"
echo "1. Test on different hotel booking sites (VAX, WAD, generic)"
echo "2. Test with different search parameters"
echo "3. Verify MongoDB integration if MONGODB_URI is set"
echo ""
echo "Example custom tests:"
echo "  TEST_URL='https://example.com/hotels' npm run test:extraction"
echo ""