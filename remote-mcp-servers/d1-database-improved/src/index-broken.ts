/**
 * D1 Travel Database MCP Server - Modular Version
 * Significantly reduced file size through modularization
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Env } from './types';
import { DatabaseManager } from './database/manager';
import { registerClientTools } from './tools/clients';
import { registerTripTools } from './tools/trips';
import { registerUtilityTools } from './tools/utilities';
import { registerInstructionTools } from './tools/instructions';
import { registerPreferenceTools } from './tools/preferences';
import { handleSSE } from "./sse-handler.js";

// All tools are now fully modularized - no more dependencies on original index.ts

// MCP Framework for Cloudflare Workers (compatible with working pattern)
class McpAgent {
	constructor() {
		this.env = null;
	}

	static serve(path) {
		const instance = new (this)();
		return {
			fetch: async (request, env, ctx) => {
				instance.env = env;
				await instance.init();
				
				const url = new URL(request.url);
				const body = await request.json();
				
				if (body.method === "list_tools") {
					const tools = instance.server._tools || [];
					return new Response(JSON.stringify({
						tools: tools.map(t => ({
							name: t.name,
							description: t.description,
							inputSchema: t.inputSchema
						}))
					}), {
						headers: { "Content-Type": "application/json" }
					});
				}
				
				if (body.method === "call_tool") {
					const tool = instance.server._tools?.find(t => t.name === body.params.name);
					if (!tool) {
						return new Response(JSON.stringify({
							error: "Tool not found"
						}), {
							status: 404,
							headers: { "Content-Type": "application/json" }
						});
					}
					
					const result = await tool.handler(body.params.arguments);
					return new Response(JSON.stringify(result), {
						headers: { "Content-Type": "application/json" }
					});
				}
				
				return new Response(JSON.stringify({
					error: "Method not supported"
				}), {
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}
		};
	}

	static serveSSE(path) {
		const instance = new (this)();
		return {
			fetch: async (request, env, ctx) => {
				instance.env = env;
				await instance.init();
				return handleSSE(request, env, ctx, instance);
			}
		};
	}
}

/**
 * Enhanced D1 Travel Database MCP agent - Modular Architecture
 * ~200 lines instead of 1700+ lines
 */
export class D1TravelMCP extends McpAgent {
	constructor() {
		super();
		this.server = new McpServer({
			name: "D1 Travel Database (Enhanced)",
			version: "4.1.0",
		});
		this.dbManager = null;
	}

	/**
	 * Get environment with proper typing
	 */
	getEnv(): Env {
		return this.env as Env;
	}

	/**
	 * Initialize database manager
	 */
	getDbManager(): DatabaseManager {
		if (!this.dbManager) {
			this.dbManager = new DatabaseManager(this.getEnv());
		}
		return this.dbManager;
	}

	async init() {
		// Store tools in the server for easy access (compatible with old pattern)
		this.server._tools = [];
		
		// Helper to register tools (compatible with old pattern)
		const registerTool = (name, description, inputSchema, handler) => {
			this.server._tools.push({
				name,
				description,
				inputSchema: zodToJsonSchema(inputSchema),
				handler: handler.bind(this)
			});
			this.server.tool(name, inputSchema, handler.bind(this));
		};

		// Register modular tools
		registerClientTools(this.server, () => this.getEnv());
		registerTripTools(this.server, () => this.getEnv());
		registerUtilityTools(this.server, () => this.getEnv());
		registerInstructionTools(this.server, () => this.getEnv());
		registerPreferenceTools(this.server, () => this.getEnv());

		// Add a simple health check using the old pattern
		registerTool(
			"health_check",
			"Check database health and status",
			z.object({}),
			async () => {
				const dbManager = this.getDbManager();
				const initialized = await dbManager.ensureInitialized();
				
				return {
					content: [{
						type: "text",
						text: `Database Status: ${initialized ? '✅ Healthy' : '❌ Not Initialized'}\nVersion: 4.1.0 (Fully Modular)\nAll tools modularized, legacy travel search tools removed`
					}]
				};
			}
		);
	}
}

// Cloudflare Worker export
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Standard MCP HTTP endpoints
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return D1TravelMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return D1TravelMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({
				status: "healthy",
				service: "D1 Travel Database MCP v4.1 (Modular)",
				features: [
					"modular-architecture",
					"travel-tools", 
					"error-logging", 
					"recent-activity", 
					"auto-initialization"
				],
				modules: {
					database: ["schema", "manager", "errors"],
					tools: ["clients", "trips", "instructions", "preferences", "utilities"]
				},
				timestamp: new Date().toISOString()
			}), {
				headers: { "Content-Type": "application/json" }
			});
		}

		return new Response(JSON.stringify({
			error: "Not found",
			available_endpoints: ["/sse", "/mcp", "/health"],
			version: "4.1.0"
		}), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
	},
};