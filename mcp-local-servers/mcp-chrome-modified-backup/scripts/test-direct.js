#!/usr/bin/env node

/**
 * Direct test of MCP Chrome extraction
 * This test directly calls the extraction tool on the current tab
 */

const MCP_PORT = process.env.MCP_PORT || 12306;
const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`;

console.log(`[Direct Test] Testing MCP at ${MCP_URL}...`);

async function testExtraction() {
  try {
    // Initialize connection
    console.log('[→] Initializing MCP connection...');
    
    const initResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 0
      })
    });

    if (!initResponse.ok) {
      throw new Error(`Init failed: ${initResponse.status} ${initResponse.statusText}`);
    }

    const initData = await initResponse.text();
    console.log('[✓] Init response:', initData.substring(0, 200));

    // List tools
    console.log('\n[→] Listing available tools...');
    
    const toolsResponse = await fetch(MCP_URL, {
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

    const toolsData = await toolsResponse.text();
    console.log('[✓] Tools response:', toolsData.substring(0, 500));

    // Try to extract hotels from current tab
    console.log('\n[→] Extracting hotels from current tab...');
    
    const extractResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'chrome_extract_hotels',
          arguments: {
            maxRows: 10
          }
        },
        id: 2
      })
    });

    const extractData = await extractResponse.text();
    
    try {
      const result = JSON.parse(extractData);
      if (result.result) {
        console.log('[✓] Extraction successful!');
        console.log('Result:', JSON.stringify(result.result, null, 2));
      } else if (result.error) {
        console.log('[✗] Extraction error:', result.error);
      }
    } catch (e) {
      console.log('[i] Raw response:', extractData.substring(0, 500));
    }

  } catch (error) {
    console.error('[✗] Test failed:', error.message);
    
    // Try a simple GET to see if server is responding
    try {
      const testResponse = await fetch(`http://127.0.0.1:${MCP_PORT}/`, {
        method: 'GET'
      });
      console.log('[i] Server GET response status:', testResponse.status);
      const text = await testResponse.text();
      console.log('[i] Server response:', text.substring(0, 200));
    } catch (e) {
      console.log('[i] Server not responding on port', MCP_PORT);
    }
  }
}

testExtraction().catch(console.error);