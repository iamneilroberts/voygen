# MCP Chrome Troubleshooting Guide

Quick troubleshooting reference for common mcp-chrome issues.

## Quick Status Check

```bash
# 1. Check if extension is loaded correctly
# Go to chrome://extensions/ - should see "Chrome MCP Server" with ID hbdgbgagpkpjffpklnamcljpakneikee

# 2. Check if native messaging host is registered
ls ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# 3. Check if HTTP server is running
ss -tlnp | grep 12306

# 4. Test MCP connection
# In Claude Code: /mcp
```

## Common Issues & Solutions

### ❌ "Failed to reconnect to mcp-chrome"

**Cause**: MCP can't reach HTTP server on port 12306

**Solutions**:
1. Check extension popup - click "Start Server" if available
2. Verify server is listening: `ss -tlnp | grep 12306`
3. Check extension console for errors: `chrome://extensions/` → Details → Inspect views

### ❌ "Native connection disconnected"

**Cause**: Extension can't communicate with native messaging host

**Solutions**:
1. **Extension ID mismatch** - most common cause
   ```bash
   # Check extension ID matches in both places:
   # 1. Chrome extension manifest
   grep -o '"key":"[^"]*"' mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.output/chrome-mv3/manifest.json
   
   # 2. Native messaging host config
   cat ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
   ```

2. **Missing native messaging host**
   ```bash
   # Re-register
   cd mcp-local-servers/mcp-chrome-web-extract/app/native-server
   node dist/cli.js register
   
   # For debug Chrome, copy to debug directory
   cp ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json /tmp/chrome-debug-fresh/NativeMessagingHosts/
   ```

3. **Host script not executable**
   ```bash
   chmod +x mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/run_host.sh
   ```

### ❌ "Specified native messaging host not found"

**Cause**: Chrome can't find the native messaging host

**Solutions**:
1. **Wrong Chrome user data directory**
   ```bash
   # Debug Chrome uses different directory
   mkdir -p /tmp/chrome-debug-fresh/NativeMessagingHosts
   cp ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json /tmp/chrome-debug-fresh/NativeMessagingHosts/
   ```

2. **Path doesn't exist**
   ```bash
   # Check if path in manifest is correct
   ls -la /home/neil/dev/voygen/mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/run_host.sh
   ```

### ❌ Extension loads with wrong ID

**Cause**: Extension built without proper key

**Solutions**:
1. **Add extension key**
   ```bash
   cd mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension
   
   # Create .env file with key
   echo 'CHROME_EXTENSION_KEY=MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDnB4a6...' > .env
   
   # Rebuild
   npm run build
   ```

2. **Remove old extensions**
   - Go to `chrome://extensions/`
   - Remove any old Chrome MCP Server extensions
   - Reload the correct one

### ❌ Tools timeout or don't work

**Cause**: Server receives MCP calls but can't control Chrome

**Solutions**:
1. **Check Chrome debug mode**
   ```bash
   # Ensure Chrome is running with remote debugging
   ps aux | grep "remote-debugging-port=9222"
   ```

2. **Check extension popup status**
   - Extension icon → popup should show "Connected, Service Running"
   - If "Service Not Started", click start button

3. **Check logs**
   ```bash
   # Native host logs
   ls mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/logs/
   cat mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/logs/native_host_wrapper_*.log
   ```

## Reset Everything (Nuclear Option)

If all else fails, complete reset:

```bash
# 1. Kill all Chrome processes
pkill -f chrome

# 2. Remove all native messaging hosts
rm -rf ~/.config/google-chrome/NativeMessagingHosts/
rm -rf /tmp/chrome-debug*/NativeMessagingHosts/

# 3. Clean build everything
cd mcp-local-servers/mcp-chrome-web-extract
rm -rf app/chrome-extension/.output/
rm -rf app/native-server/dist/
npm run build

# 4. Re-register native host
cd app/native-server
node dist/cli.js register
node dist/cli.js update-port 12306

# 5. Copy to debug Chrome
mkdir -p /tmp/chrome-debug-fresh/NativeMessagingHosts
cp ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json /tmp/chrome-debug-fresh/NativeMessagingHosts/

# 6. Start fresh Chrome
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug-fresh" --no-first-run --disable-default-apps

# 7. Load extension from: mcp-local-servers/mcp-chrome-web-extract/app/chrome-extension/.output/chrome-mv3/
```

## Debug Information Collection

When reporting issues, collect this info:

```bash
# Extension ID
echo "Extension ID should be: hbdgbgagpkpjffpklnamcljpakneikee"

# Native messaging host config
echo "=== Native Messaging Host ==="
cat ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# Port status
echo "=== Port Status ==="
ss -tlnp | grep 12306

# Chrome processes
echo "=== Chrome Processes ==="
ps aux | grep chrome | grep -E "(remote-debugging|debug)"

# MCP config
echo "=== MCP Config ==="
grep -A 10 "mcp-chrome" .mcp.json

# Recent logs
echo "=== Recent Native Host Logs ==="
ls -la mcp-local-servers/mcp-chrome-web-extract/app/native-server/dist/logs/ | tail -5
```

## Success Indicators

When everything is working correctly:

1. ✅ Extension loads with ID `hbdgbgagpkpjffpklnamcljpakneikee`
2. ✅ Extension popup shows "Connected" (not "Native connection disconnected")  
3. ✅ Clicking "Start Server" successfully starts HTTP server
4. ✅ `ss -tlnp | grep 12306` shows server listening
5. ✅ Claude Code `/mcp` command shows "mcp-chrome" as connected
6. ✅ Browser automation tools work (navigate, screenshot, etc.)

---

**Remember**: The key breakthrough was using `mcp-chrome-web-extract` (complete setup) instead of `mcp-chrome-fresh` (extension only) and ensuring consistent extension ID across all components.