#!/usr/bin/env node

/**
 * Test MCP Chrome with SSE protocol
 */

const MCP_PORT = process.env.MCP_PORT || 12306;
const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`;

console.log(`[MCP SSE Test] Connecting to ${MCP_URL}...`);

// First, establish SSE connection
fetch(`${MCP_URL}/sse`, {
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream'
  }
})
.then(async response => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  console.log('[✓] SSE connection established');
  
  // Get session ID from headers or first message
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        console.log('[SSE Data]:', data);
        
        try {
          const json = JSON.parse(data);
          if (json.jsonrpc === '2.0') {
            console.log('[✓] Received JSONRPC message:', json);
            
            // If this is the initialize response, list tools
            if (json.method === 'initialized' || json.result?.protocolVersion) {
              console.log('[→] Sending list tools request...');
              
              // Send a POST request to list tools
              const listToolsResponse = await fetch(`${MCP_URL}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'tools/list',
                  id: 1
                })
              });
              
              const toolsData = await listToolsResponse.json();
              console.log('[✓] Tools response:', JSON.stringify(toolsData, null, 2));
              
              process.exit(0);
            }
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
    }
    
    buffer = lines[lines.length - 1];
  }
})
.catch(error => {
  console.error('[✗] Connection failed:', error.message);
  console.error('\nMake sure:');
  console.error('1. Chrome extension is loaded and connected');
  console.error(`2. MCP server is running on port ${MCP_PORT}`);
  process.exit(1);
});