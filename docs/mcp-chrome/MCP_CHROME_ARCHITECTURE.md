# MCP Chrome Architecture

## System Overview

```
┌─────────────────┐    HTTP POST     ┌─────────────────┐    Native Messaging    ┌─────────────────┐    Chrome DevTools    ┌─────────────────┐
│                 │   :12306/mcp     │                 │         stdio           │                 │      Protocol         │                 │
│   Claude Code   │ ────────────────▶│ Chrome Extension│ ◀─────────────────────▶ │ Native Host     │ ────────────────────▶ │ Chrome Browser  │
│     (/mcp)      │                  │  Background.js  │                         │   (Node.js)     │                       │   (Debug Mode)  │
│                 │                  │                 │                         │                 │                       │                 │
└─────────────────┘                  └─────────────────┘                         └─────────────────┘                       └─────────────────┘
                                             │                                           │
                                             │ Popup UI                                  │ File System
                                             ▼                                           ▼
                                     ┌─────────────────┐                         ┌─────────────────┐
                                     │ Extension Popup │                         │  Config Files   │
                                     │  - Start Server │                         │  - Port Config  │
                                     │  - Show Status  │                         │  - Logs         │
                                     └─────────────────┘                         └─────────────────┘
```

## Component Details

### Claude Code (MCP Client)
- **Role**: Initiates browser automation requests
- **Protocol**: HTTP POST to `http://127.0.0.1:12306/mcp`
- **Configuration**: `.mcp.json` with mcp-remote connection
- **Tools**: Provides browser automation tools via MCP protocol

### Chrome Extension (ID: hbdgbgagpkpjffpklnamcljpakneikee)
- **Role**: HTTP server + Chrome API bridge
- **Components**:
  - `background.js`: Service worker handling HTTP requests
  - `popup.html/js`: User interface for control
  - `content-scripts/`: Injected page interaction
- **Permissions**: `nativeMessaging`, `tabs`, `scripting`, `debugger`, etc.

### Native Messaging Host (Node.js Process)
- **Role**: Mediates between extension and external processes
- **Protocol**: Chrome Native Messaging (binary stdio)
- **Registration**: `~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json`
- **Entry Point**: `run_host.sh` → `index.js`

### Chrome Browser (Debug Mode)
- **Role**: Target browser for automation
- **Debug Port**: 9222 (Chrome DevTools Protocol)
- **User Data**: `/tmp/chrome-debug-fresh/` (custom directory)

## Data Flow

### 1. MCP Tool Call Flow
```
Claude Code Tool Call
    ↓ HTTP POST
Extension Background (Fastify Server)
    ↓ Chrome APIs
Browser DOM/Navigation
    ↓ Response
Extension Background
    ↓ HTTP Response
Claude Code
```

### 2. Extension-Native Host Communication
```
Extension Popup "Start Server"
    ↓ Native Messaging
Native Host receives START command
    ↓ Starts HTTP Server
Server listens on port 12306
    ↓ Reports back
Extension shows "Running" status
```

## Key Files & Their Roles

### Extension Files
```
.output/chrome-mv3/
├── manifest.json          # Extension metadata + permissions
├── background.js          # Main HTTP server (2.3MB with deps)
├── popup.html/js          # User interface
├── content-scripts/       # Page injection scripts
└── workers/              # Web workers for processing
```

### Native Host Files
```
dist/
├── index.js              # Main entry point
├── cli.js                # Registration/configuration tool
├── run_host.sh           # Chrome native messaging entry
├── server/index.js       # HTTP server implementation
├── native-messaging-host.js  # Native messaging protocol
└── logs/                 # Runtime logs
```

### Configuration Files
```
# Extension key (determines ID)
app/chrome-extension/.env

# Native messaging registration  
~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# MCP client configuration
.mcp.json

# Port configuration
app/native-server/dist/mcp/stdio-config.json
```

## Security Model

### Extension Permissions
- `nativeMessaging`: Communicate with native host
- `tabs`/`activeTab`: Access browser tabs
- `scripting`: Inject content scripts
- `debugger`: Advanced browser control
- `<all_urls>`: Access any website

### Native Messaging Security
- Extension ID allowlist in native host registration
- Stdio-only communication (no network)
- Process isolation between extension and host

### Network Security
- HTTP server only listens on localhost (127.0.0.1)
- Port 12306 only accessible locally
- CORS configured for extension origin

## Extension ID Management

### Deterministic ID Generation
```
Private Key (in .env) 
    ↓ Chrome Extension Key Algorithm
Extension ID: hbdgbgagpkpjffpklnamcljpakneikee
    ↓ Must match
Native Host allowed_origins
```

### Why This Matters
- **Unpacked extensions** get random IDs by default
- **Native messaging** requires exact ID match
- **Hardcoded key** ensures consistent ID across installs

## Port Configuration

### Port 12306 Selection
- **Chosen**: High port, unlikely to conflict
- **Usage**: HTTP server for MCP protocol
- **Configuration**: Set via `node dist/cli.js update-port 12306`
- **Verification**: `ss -tlnp | grep 12306`

## Error Handling

### Connection Failures
1. **Native messaging fails**: Extension shows "Native connection disconnected"
2. **HTTP server fails**: Claude Code shows "Failed to reconnect to mcp-chrome"  
3. **Browser control fails**: Tools timeout or return errors

### Recovery Mechanisms
- Native host process restart on extension reload
- HTTP server restart via popup interface
- Automatic reconnection attempts

## Performance Considerations

### Memory Usage
- Extension background: ~50-100MB (includes ML models)
- Native host: ~20-30MB
- Total system impact: ~100-150MB

### Response Times
- HTTP MCP calls: 100-500ms typical
- Native messaging: 10-50ms overhead
- Browser automation: 200ms-2s depending on operation

---

**Architecture Status**: ✅ Working and Documented  
**Last Updated**: September 7, 2025  
**Key Insight**: The critical breakthrough was using the complete `mcp-chrome-web-extract` setup rather than incomplete `mcp-chrome-fresh`, combined with deterministic extension ID management.