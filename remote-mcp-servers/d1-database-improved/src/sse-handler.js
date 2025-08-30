// SSE Handler for MCP Protocol
export async function handleSSE(request, env, ctx, mcpInstance) {
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // For GET requests, establish SSE connection
  if (request.method === "GET") {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send initial connection event
    await writer.write(encoder.encode('event: open\ndata: {"type":"connection_ready"}\n\n'));

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode('event: ping\ndata: {}\n\n'));
      } catch (e) {
        clearInterval(pingInterval);
      }
    }, 30000);

    ctx.waitUntil(new Promise((resolve) => {
      // Clean up on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        writer.close();
        resolve();
      });
    }));

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  // For POST requests, handle MCP messages
  if (request.method === "POST") {
    try {
      const body = await request.json();
      console.log("Received MCP message:", JSON.stringify(body));

      let response;

      // Handle different MCP methods
      switch (body.method) {
        case "initialize":
          response = {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2025-06-18",
              capabilities: {
                tools: {},
                resources: {}
              },
              serverInfo: {
                name: "D1 Travel Database (Improved)",
                version: "3.0.0"
              }
            }
          };
          break;

        case "tools/list":
          const tools = mcpInstance.server._tools || [];
          response = {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
              }))
            }
          };
          break;

        case "tools/call":
          const tool = mcpInstance.server._tools?.find(t => t.name === body.params.name);
          if (!tool) {
            response = {
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32001,
                message: `Tool not found: ${body.params.name}`
              }
            };
          } else {
            try {
              const result = await tool.handler(body.params.arguments || {});
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: result
              };
            } catch (error) {
              response = {
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32002,
                  message: error.message || "Tool execution failed"
                }
              };
            }
          }
          break;

        default:
          response = {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`
            }
          };
      }

      console.log("Sending response:", JSON.stringify(response));

      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: error.message
        }
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}