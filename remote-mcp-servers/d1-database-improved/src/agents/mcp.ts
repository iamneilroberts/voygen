// Base MCP Agent class for Cloudflare Workers
export abstract class McpAgent {
  protected env: any;

  static serve(path: string) {
    const instance = new (this as any)();
    return {
      fetch: async (request: Request, env: any, ctx: ExecutionContext) => {
        instance.env = env;
        await instance.init();
        return instance.server.handleRequest(request);
      }
    };
  }

  static serveSSE(path: string) {
    const instance = new (this as any)();
    return {
      fetch: async (request: Request, env: any, ctx: ExecutionContext) => {
        instance.env = env;
        await instance.init();
        
        // Handle SSE connection
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Set up SSE headers
        const headers = new Headers({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });

        // Handle the connection
        ctx.waitUntil((async () => {
          try {
            await instance.server.handleSSERequest(request, async (data: any) => {
              await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            });
          } catch (error) {
            console.error('SSE error:', error);
          } finally {
            await writer.close();
          }
        })());

        return new Response(readable, { headers });
      }
    };
  }

  abstract init(): Promise<void>;
  abstract server: any;
}