# MCP Chrome Setup Guide - Working Configuration

This document details the **successful working configuration** for mcp-chrome that enables browser automation through Claude Code's MCP interface.

## Overview

The solution uses **mcp-chrome-web-extract** as the base, which provides both:
- ✅ **General browser automation** (navigation, screenshots, form filling)
- ✅ **Hotel data extraction** capabilities from travel websites

## Architecture

```
Claude Code (/mcp command) 
    ↓ HTTP (port 12306)
Chrome Extension (hbdgbgagpkpjffpklnamcljpakneikee)
    ↓ Native Messaging
Native Host Process (Node.js)
    ↓ Controls
Chrome Browser (Debug Mode)
```

## File Structure

```
mcp-local-servers/mcp-chrome-web-extract/
├── app/
│   ├── chrome-extension/              # Chrome extension source
│   │   ├── .env                      # Extension key configuration  
│   │   ├── .output/chrome-mv3/       # Built extension (load this in Chrome)
│   │   │   └── manifest.json         # Contains hardcoded extension ID
│   │   └── wxt.config.ts            # Build configuration
│   └── native-server/               # Native messaging host
│       ├── dist/                    # Built native host
│       │   ├── cli.js               # Registration and port config
│       │   ├── run_host.sh          # Native messaging entry point
│       │   └── logs/                # Runtime logs
│       └── src/                     # Source code
└── .mcp.json                        # Claude Code MCP server config
```

## Critical Configuration Details

### 1. Extension Key Configuration

**File**: `mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.env`
```env
CHROME_EXTENSION_KEY=MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDnB4a6/wwEIEnMqhd64+OblTmF0KlqvHkZJnYN7vdOLElFOzjZbl2dA4tQERDfiY5M0qTkp+1QnYGkS2sAAUYg9v8k0BQjKHM0JSZQaV+QjukglUDiNzsgcSw0Yek/KF0mFVtuKS72EpBI5krEJ8N/b6SVTfg+3arG4SeY6Bww2bEhcFusDv8w2FJnWHpnnIFGch02/NON4aDWPSZJfF1AxMBtXSHDaEaN+mEffwyflBEl9fjlYrJe8PJxAytgWkOwJErJXFHKxgONE84W5UgYWomEJHkFolxTLvBdPtryPp6ZWbwZUBR4mBuH2luo4L+JAlF17uDASzAs0qCEMwzAgMBAAECggEAS9LsaIspSohbSBJ+6UkycIecKUTC9Oz6rwnACOwxymL7Z+BgoxT/e0cpZ6kNzQvNTUbwlZu0hNKqZYlJJu8rCoGyeImr2I1q+rWvpGip+fM6o15SDfiziooS8GeIKRA0lbmnA80bLiV9QxrFeMgMn6PIh3i5HGDdcx5LngoIWyz122vrIMUAynkUlgWRuESOvBded1N2TzsJoyMwYPdFSBK7fY4hKehU/SuSHetiXDieS0RBWj+wOaoEJRaZFCiVrGPMV5BcKWMtgs9WkYG/AMFVYgXDNDgcfLy0ExckIvonY05nh/x50Np+EzZR65K56kpqJjIB6yZMacjevYOhQQKBgQDjJrkVTHM4Qd0fpL7AtJnRpQpr/fE+0vWpMvB+VkqoAEwKdLyymejy2lOuxfqUCkHY4IcITwTyw4A6hibfZ1zHnBc3yCJwcKCvZXuJZaQTvd6xGZSHf9JHcwkDtDZ1VYzrzV8gKV12GzaqQRmyagS0/fuITTfhG8bKSbv/0I4NeQKBgQDcc+alUI02hjJ9T1AkMQt9LeUXjMjzQVH6rVn0qts5Vs5LvgLOqdpnK5xTeomxM0qCPCy9Da6EqV7/5sFuybvj8oFvrxEnhEcGH/Iy2XH3yUtROGOkOsvEqkoo/6C5LUSehclCzZnFABb7z915utlbrNZFEQJyZTXf3Sz6QPH4CwKBgH2ke5eWU9z4QXExVPmOa86UNXGKYxhW498U+AVJgb3vfCAEdiNsEnfR35u6kmG0Uru9ZbNo0dnd3V2Bupqzt5QJeKY4IySCh768qVpUSC9LRJQ9C/Tu9MbkkEXmNoEsMuhzDnzhpHqhjtkZbTdMgRIDsk+wNopjLM/TfROArjIxAoGBAMGksSHfWttdD7aQ16WiyyO/D7AbA1zhsMAQS6cl+YEpZfaURmUAQA9F+IA/b/mOQ1GYx/ecsAJpwD/qk1jcrUVyfA39aoUapUSVBStzY6+zSoxiiuv0lY7/wjq3KJfgUpkojXw3m223QXkZwsKtxUXI0UJDybFwg91Lq7l7GNC3AoGARTBSr83TTKIkcHsnH9Wl7ZVgS44iRXvTe/7pLgwzPLVAWwBiOZFF7yDqIxZlSTUh9f+MWGCMmMqfm8SDom91G0L8KoQP1PMKrbspRCG65M1VJlecwSXG0MhxdUZ3l5vT0i/aYDP6hBcc57Q2iHHOtJTRk/va1l8uH/1JOUVj9gs=
```

**This key ensures the extension gets ID**: `hbdgbgagpkpjffpklnamcljpakneikee`

### 2. Native Messaging Host Registration

**Location**: `~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json`
```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "/home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"
  ]
}
```

**For Chrome Debug Mode**, also copy to:
`/tmp/chrome-debug-fresh/NativeMessagingHosts/com.chromemcp.nativehost.json`

### 3. Claude Code MCP Configuration

**File**: `.mcp.json` (project root)
```json
{
  "mcpServers": {
    "mcp-chrome": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:12306/mcp"
      ]
    }
  }
}
```

## Setup Steps (Working Procedure)

### 1. Build the Extension and Native Host

```bash
cd mcp-local-servers/mcp-chrome-web-extract

# Install dependencies
npm install

# Build everything (extension + native host)
npm run build
```

### 2. Register Native Messaging Host

```bash
cd mcp-local-servers/mcp-chrome-web-extract/app/native-server

# Register the native messaging host
node dist/cli.js register

# Set the correct port for MCP connection
node dist/cli.js update-port 12306
```

### 3. Set Up Chrome Debug Mode

```bash
# Start Chrome in debug mode with custom user data directory
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug-fresh" --no-first-run --disable-default-apps
```

### 4. Copy Native Messaging Host to Debug Directory

```bash
# Chrome debug mode needs its own copy of the native messaging host manifest
cp ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json /tmp/chrome-debug-fresh/NativeMessagingHosts/
```

### 5. Load Extension in Chrome

1. Open `chrome://extensions/` in the debug Chrome window
2. Enable "Developer mode" 
3. Click "Load unpacked"
4. Select: `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.output/chrome-mv3/`
5. Verify the extension ID matches: `hbdgbgagpkpjffpklnamcljpakneikee`

### 6. Start the MCP Server

1. Click the Chrome MCP extension icon
2. The popup should show "Connected" status (no more native messaging errors)
3. Click "Start Server" or similar button to start HTTP server on port 12306
4. Verify server is listening: `ss -tlnp | grep 12306`

### 7. Test with Claude Code

```bash
# Test MCP connection
/mcp

# Should show "mcp-chrome" as connected
# Test browser automation
```

## Key Success Factors

### ✅ **Extension ID Consistency**
- Extension key in `.env` ensures deterministic ID `hbdgbgagpkpjffpklnamcljpakneikee`
- Native messaging host configured for exact same ID
- No random extension IDs causing connection failures

### ✅ **Complete Architecture**
- Uses `mcp-chrome-web-extract` which has both extension AND native host
- Not just the extension without the host (like `mcp-chrome-fresh`)
- Built from source with proper configuration

### ✅ **Correct Build Process**
- Environment variable for extension key set before build
- Full build process creates all necessary components
- Proper native messaging host registration

### ✅ **Chrome Debug Directory**
- Native messaging host manifest copied to debug Chrome's user data directory
- Chrome debug mode can find and load the native messaging host

## Available MCP Tools

Once connected, Claude Code can use these browser automation tools:

- `chrome_navigate` - Navigate to URLs
- `chrome_screenshot` - Take screenshots  
- `chrome_get_web_content` - Extract page content
- `chrome_click_element` - Click elements
- `chrome_fill_or_select` - Fill forms
- `chrome_get_interactive_elements` - Find clickable elements
- `chrome_extract_hotels` - Extract hotel search results (specialized)
- And many more...

## Troubleshooting

### Extension Won't Load
- Check manifest.json has the correct `key` field
- Verify `.env` file exists with `CHROME_EXTENSION_KEY`
- Rebuild extension: `cd app/chrome-extension && npm run build`

### Native Messaging Connection Failed
- Verify extension ID matches in both places:
  - Extension manifest (generated from key)
  - Native messaging host `allowed_origins`
- Check native messaging host is registered: `ls ~/.config/google-chrome/NativeMessagingHosts/`
- For debug Chrome, ensure copy exists in debug user data directory

### MCP Connection Failed (Port 12306)
- Check if HTTP server started: `ss -tlnp | grep 12306`
- Look at extension popup for "Start Server" button
- Check native messaging host logs: `mcp-chrome-web-extract/app/native-server/dist/logs/`

### Tools Timeout
- Verify Chrome extension can actually control the browser
- Check browser console for errors
- Ensure Chrome debug mode is running on port 9222

## Version History

- **mcp-chrome-fresh**: Pre-built extension only, missing native host
- **mcp-chrome-modified-backup**: Modified version, may have issues
- **mcp-chrome-web-extract**: ✅ **WORKING VERSION** - Complete setup with extension + native host
- **mcp-chrome**: Current working directory, based on mcp-chrome-web-extract

## Files Created During Setup

```
# Extension environment
mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.env

# Built extension (load in Chrome)
mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.output/chrome-mv3/

# Built native host
mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/

# Native messaging registration
~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# Debug Chrome copy
/tmp/chrome-debug-fresh/NativeMessagingHosts/com.chromemcp.nativehost.json
```

---

**Date**: September 7, 2025  
**Status**: ✅ Working Configuration  
**Tested with**: Claude Code, Chrome Debug Mode, MCP Remote Connection