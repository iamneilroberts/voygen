#!/usr/bin/env node

/**
 * Minimal smoke test for MCP Chrome - Phase 1
 * Connects to the MCP server and tests basic tool functionality
 */

import WebSocket from 'ws';

const MCP_PORT = process.env.MCP_PORT || 56889;
const MCP_URL = `ws://127.0.0.1:${MCP_PORT}/mcp`;

console.log(`[Phase 1 Smoke Test] Connecting to ${MCP_URL}...`);

const ws = new WebSocket(MCP_URL);

ws.on('open', () => {
  console.log('[✓] Connected to MCP server');
  
  // Send listTools request
  const listToolsRequest = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  };
  
  console.log('[→] Sending listTools request...');
  ws.send(JSON.stringify(listToolsRequest));
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data.toString());
    
    if (response.id === 1) {
      // Response to listTools
      console.log('[✓] Received tools list:');
      if (response.result && response.result.tools) {
        response.result.tools.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
        });
        
        // Now test get_windows_and_tabs
        const getWindowsRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get_windows_and_tabs',
            arguments: {}
          },
          id: 2
        };
        
        console.log('\n[→] Calling get_windows_and_tabs...');
        ws.send(JSON.stringify(getWindowsRequest));
      } else {
        console.error('[✗] No tools found in response');
        process.exit(1);
      }
    } else if (response.id === 2) {
      // Response to get_windows_and_tabs
      console.log('[✓] Windows and tabs response received:');
      if (response.result && response.result.content) {
        const content = JSON.parse(response.result.content[0].text);
        console.log(`  Found ${content.windows ? content.windows.length : 0} window(s)`);
        
        if (content.windows && content.windows[0]) {
          const firstWindow = content.windows[0];
          console.log(`  Window 1 has ${firstWindow.tabs ? firstWindow.tabs.length : 0} tab(s)`);
          
          if (firstWindow.tabs && firstWindow.tabs.length > 0) {
            firstWindow.tabs.slice(0, 3).forEach((tab, i) => {
              console.log(`    Tab ${i + 1}: ${tab.title || 'Untitled'} - ${tab.url || 'No URL'}`);
            });
          }
        }
        
        console.log('\n[✓] Phase 1 smoke test PASSED');
        ws.close();
        process.exit(0);
      } else {
        console.error('[✗] Invalid response format');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('[✗] Error parsing response:', error.message);
    console.error('Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('[✗] WebSocket error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Chrome extension is loaded (chrome://extensions)');
  console.error('2. Extension popup shows "Connected"');
  console.error(`3. MCP server is running on port ${MCP_PORT}`);
  process.exit(1);
});

ws.on('close', () => {
  console.log('[i] Connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('[✗] Test timed out after 10 seconds');
  ws.close();
  process.exit(1);
}, 10000);