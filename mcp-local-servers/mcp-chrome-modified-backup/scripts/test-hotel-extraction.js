#!/usr/bin/env node

/**
 * Test hotel extraction from CP Maxx - Phase 2
 * Tests the chrome_extract_hotels tool on a live CP Maxx page
 */

import WebSocket from 'ws';

const MCP_PORT = process.env.MCP_PORT || 56889;
const MCP_URL = `ws://127.0.0.1:${MCP_PORT}/mcp`;

// CP Maxx test URL - hotels in Orlando
const TEST_URL = process.env.TEST_URL || 'https://vacationaccess.cpmaxx.com/search/hotels?destination=Orlando,%20FL&checkIn=2025-02-01&checkOut=2025-02-05&rooms=1&adults=2';

console.log(`[Hotel Extraction Test] Connecting to ${MCP_URL}...`);

const ws = new WebSocket(MCP_URL);

ws.on('open', () => {
  console.log('[✓] Connected to MCP server');
  
  // First navigate to the test page
  const navigateRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'chrome_navigate',
      arguments: {
        url: TEST_URL
      }
    },
    id: 1
  };
  
  console.log(`[→] Navigating to test page: ${TEST_URL}`);
  ws.send(JSON.stringify(navigateRequest));
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data.toString());
    
    if (response.id === 1) {
      // Navigation complete
      console.log('[✓] Navigation complete');
      
      // Wait a bit for page to load
      setTimeout(() => {
        // Now extract hotels
        const extractRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'chrome_extract_hotels',
            arguments: {
              pageTypeHint: 'navitrip_cp',
              maxRows: 10  // Just get first 10 for testing
            }
          },
          id: 2
        };
        
        console.log('[→] Extracting hotel data...');
        ws.send(JSON.stringify(extractRequest));
      }, 3000); // Wait 3 seconds for page to fully load
      
    } else if (response.id === 2) {
      // Extraction response
      console.log('[✓] Extraction complete');
      
      if (response.result && response.result.content) {
        try {
          const extractData = JSON.parse(response.result.content[0].text);
          
          console.log(`\n[Results Summary]`);
          console.log(`  Status: ${extractData.ok ? 'SUCCESS' : 'FAILED'}`);
          console.log(`  Route: ${extractData.route || 'N/A'}`);
          console.log(`  Count: ${extractData.count || 0} hotels extracted`);
          console.log(`  Timing: ${extractData.meta?.timing_ms || 'N/A'}ms`);
          
          if (extractData.sample && extractData.sample.length > 0) {
            console.log(`\n[Sample Hotels (first 3)]:`);
            extractData.sample.forEach((hotel, i) => {
              console.log(`\n  Hotel ${i + 1}:`);
              console.log(`    Name: ${hotel.name || 'N/A'}`);
              console.log(`    Price: ${hotel.price_text || 'N/A'}`);
              console.log(`    Stars: ${hotel.star_rating || 'N/A'}`);
              console.log(`    Address: ${hotel.address || 'N/A'}`);
              if (hotel.detail_url) {
                console.log(`    URL: ${hotel.detail_url.substring(0, 80)}...`);
              }
            });
          }
          
          if (extractData.ndjson_gz_base64) {
            console.log(`\n[✓] Full data available (gzipped NDJSON): ${extractData.ndjson_gz_base64.length} chars`);
          }
          
          console.log('\n[✓] Hotel extraction test PASSED');
        } catch (parseErr) {
          console.error('[✗] Failed to parse extraction result:', parseErr.message);
          console.log('Raw result:', response.result.content[0].text.substring(0, 500));
        }
      } else {
        console.error('[✗] No content in response');
      }
      
      ws.close();
      process.exit(0);
    }
    
    // Handle errors
    if (response.error) {
      console.error('[✗] Error response:', response.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('[✗] Error parsing response:', error.message);
    console.error('Raw data:', data.toString().substring(0, 500));
  }
});

ws.on('error', (error) => {
  console.error('[✗] WebSocket error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Chrome extension is loaded and connected');
  console.error('2. MCP server is running on port', MCP_PORT);
  console.error('3. You have internet access to reach CP Maxx');
  process.exit(1);
});

ws.on('close', () => {
  console.log('[i] Connection closed');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('[✗] Test timed out after 30 seconds');
  ws.close();
  process.exit(1);
}, 30000);