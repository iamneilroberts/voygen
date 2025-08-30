import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
	DB: D1Database;
	MCP_AUTH_KEY: string;
}

// Define our improved D1 Travel Database MCP agent with automatic initialization
export class D1TravelMCP extends McpAgent {
	server = new McpServer({
		name: "D1 Travel Database (Improved)",
		version: "3.0.0",
	});

	private isInitialized = false;
	private initializationPromise: Promise<boolean> | null = null;

	// Automatic initialization check
	private async ensureInitialized(env: Env): Promise<boolean> {
		if (this.isInitialized) {
			return true;
		}

		// Prevent multiple concurrent initialization attempts
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.checkAndInitialize(env);
		const result = await this.initializationPromise;
		this.isInitialized = result;
		this.initializationPromise = null;
		return result;
	}

	// Check if database is initialized and initialize if needed
	private async checkAndInitialize(env: Env): Promise<boolean> {
		try {
			// Try to query a known table to check if schema exists
			await env.DB.prepare("SELECT 1 FROM travel_searches LIMIT 1").run();
			console.log("Database already initialized");
			return true;
		} catch (error) {
			// If table doesn't exist or we get auth error, initialize
			console.log("Database not initialized, initializing now...");
			return await this.initializeSchema(env);
		}
	}

	// Initialize database schema
	private async initializeSchema(env: Env): Promise<boolean> {
		try {
			// Create searches table
			await env.DB.prepare(`
				CREATE TABLE IF NOT EXISTS travel_searches (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					search_type TEXT NOT NULL,
					origin TEXT,
					destination TEXT,
					departure_date TEXT,
					return_date TEXT,
					passengers INTEGER DEFAULT 1,
					budget_limit REAL,
					search_parameters TEXT,
					results_summary TEXT,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					user_id TEXT DEFAULT 'anonymous'
				)
			`).run();

			// Create user preferences table
			await env.DB.prepare(`
				CREATE TABLE IF NOT EXISTS user_preferences (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					user_id TEXT NOT NULL,
					preference_type TEXT NOT NULL,
					preference_value TEXT,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)
			`).run();

			// Create popular routes view
			await env.DB.prepare(`
				CREATE VIEW IF NOT EXISTS popular_routes AS
				SELECT
					origin,
					destination,
					COUNT(*) as search_count,
					AVG(budget_limit) as avg_budget,
					MAX(created_at) as last_searched
				FROM travel_searches
				WHERE origin IS NOT NULL AND destination IS NOT NULL
				GROUP BY origin, destination
				ORDER BY search_count DESC
			`).run();

			console.log("Database schema initialized successfully");
			return true;
		} catch (error) {
			console.error("Failed to initialize database schema:", error);
			return false;
		}
	}

	async init() {
		// Manual initialization tool (kept for compatibility)
		this.server.tool(
			"initialize_travel_schema",
			{},
			async () => {
				const env = this.env as Env;
				const success = await this.initializeSchema(env);
				
				if (success) {
					this.isInitialized = true;
					return {
						content: [{
							type: "text",
							text: "✅ Travel database schema initialized successfully"
						}]
					};
				} else {
					return {
						content: [{
							type: "text",
							text: "❌ Failed to initialize database schema. Check logs for details."
						}]
					};
				}
			}
		);

		// Store travel search with automatic initialization
		this.server.tool(
			"store_travel_search",
			{
				search_type: z.string().describe("Type of search (flight, hotel, package)"),
				origin: z.string().optional().describe("Origin location"),
				destination: z.string().optional().describe("Destination location"),
				departure_date: z.string().optional().describe("Departure date"),
				return_date: z.string().optional().describe("Return date"),
				passengers: z.number().optional().describe("Number of passengers"),
				budget_limit: z.number().optional().describe("Budget limit"),
				search_parameters: z.string().optional().describe("Full search parameters as JSON"),
				results_summary: z.string().optional().describe("Summary of search results"),
				user_id: z.string().optional().describe("User identifier")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					const result = await env.DB.prepare(`
						INSERT INTO travel_searches
						(search_type, origin, destination, departure_date, return_date,
						 passengers, budget_limit, search_parameters, results_summary, user_id)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`).bind(
						params.search_type,
						params.origin || null,
						params.destination || null,
						params.departure_date || null,
						params.return_date || null,
						params.passengers || 1,
						params.budget_limit || null,
						params.search_parameters || null,
						params.results_summary || null,
						params.user_id || 'anonymous'
					).run();

					return {
						content: [{
							type: "text",
							text: `✅ Travel search stored with ID: ${result.meta.last_row_id}`
						}]
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error storing search: ${error}`
						}]
					};
				}
			}
		);

		// Get search history with automatic initialization
		this.server.tool(
			"get_search_history",
			{
				user_id: z.string().optional().describe("User ID to filter by"),
				search_type: z.string().optional().describe("Search type to filter by"),
				limit: z.number().optional().describe("Maximum number of results")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					let query = "SELECT * FROM travel_searches WHERE 1=1";
					const bindings: unknown[] = [];

					if (params.user_id) {
						query += " AND user_id = ?";
						bindings.push(params.user_id);
					}

					if (params.search_type) {
						query += " AND search_type = ?";
						bindings.push(params.search_type);
					}

					query += " ORDER BY created_at DESC";

					if (params.limit) {
						query += " LIMIT ?";
						bindings.push(params.limit);
					}

					const result = await env.DB.prepare(query).bind(...bindings).all();

					return {
						content: [{
							type: "text",
							text: `📋 Found ${result.results.length} travel searches:\n\n${JSON.stringify(result.results, null, 2)}`
						}]
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving search history: ${error}`
						}]
					};
				}
			}
		);

		// Get popular routes with automatic initialization
		this.server.tool(
			"get_popular_routes",
			{
				limit: z.number().optional().describe("Maximum number of routes to return")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					let query = "SELECT * FROM popular_routes";

					if (params.limit) {
						query += " LIMIT ?";
						const result = await env.DB.prepare(query).bind(params.limit).all();

						return {
							content: [{
								type: "text",
								text: `🔥 Top ${result.results.length} popular routes:\n\n${JSON.stringify(result.results, null, 2)}`
							}]
						};
					} else {
						const result = await env.DB.prepare(query).all();

						return {
							content: [{
								type: "text",
								text: `🔥 All popular routes (${result.results.length} total):\n\n${JSON.stringify(result.results, null, 2)}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving popular routes: ${error}`
						}]
					};
				}
			}
		);

		// Store user preference with automatic initialization
		this.server.tool(
			"store_user_preference",
			{
				user_id: z.string().describe("User identifier"),
				preference_type: z.string().describe("Type of preference (airline, seat_type, meal, etc.)"),
				preference_value: z.string().describe("Preference value")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					// Check if preference exists and update, otherwise insert
					const existing = await env.DB.prepare(`
						SELECT id FROM user_preferences
						WHERE user_id = ? AND preference_type = ?
					`).bind(params.user_id, params.preference_type).first();

					if (existing) {
						await env.DB.prepare(`
							UPDATE user_preferences
							SET preference_value = ?, updated_at = CURRENT_TIMESTAMP
							WHERE user_id = ? AND preference_type = ?
						`).bind(params.preference_value, params.user_id, params.preference_type).run();

						return {
							content: [{
								type: "text",
								text: `✅ Updated preference for ${params.user_id}: ${params.preference_type} = ${params.preference_value}`
							}]
						};
					} else {
						await env.DB.prepare(`
							INSERT INTO user_preferences (user_id, preference_type, preference_value)
							VALUES (?, ?, ?)
						`).bind(params.user_id, params.preference_type, params.preference_value).run();

						return {
							content: [{
								type: "text",
								text: `✅ Stored new preference for ${params.user_id}: ${params.preference_type} = ${params.preference_value}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error storing preference: ${error}`
						}]
					};
				}
			}
		);

		// Get user preferences with automatic initialization
		this.server.tool(
			"get_user_preferences",
			{
				user_id: z.string().describe("User identifier"),
				preference_type: z.string().optional().describe("Specific preference type to retrieve")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					let query = "SELECT * FROM user_preferences WHERE user_id = ?";
					const bindings: unknown[] = [params.user_id];

					if (params.preference_type) {
						query += " AND preference_type = ?";
						bindings.push(params.preference_type);
					}

					query += " ORDER BY updated_at DESC";

					const result = await env.DB.prepare(query).bind(...bindings).all();

					return {
						content: [{
							type: "text",
							text: `👤 Preferences for ${params.user_id}:\n\n${JSON.stringify(result.results, null, 2)}`
						}]
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving preferences: ${error}`
						}]
					};
				}
			}
		);

		// Execute custom SQL query with automatic initialization
		this.server.tool(
			"execute_query",
			{
				query: z.string().describe("SQL query to execute"),
				params: z.array(z.unknown()).optional().describe("Query parameters")
			},
			async (params) => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					// Security: Only allow SELECT statements for safety
					const trimmedQuery = params.query.trim().toLowerCase();
					if (!trimmedQuery.startsWith('select')) {
						return {
							content: [{
								type: "text",
								text: `❌ Only SELECT queries are allowed for security reasons`
							}]
						};
					}

					const stmt = env.DB.prepare(params.query);
					const result = params.params ?
						await stmt.bind(...params.params).all() :
						await stmt.all();

					return {
						content: [{
							type: "text",
							text: `📊 Query results (${result.results.length} rows):\n\n${JSON.stringify(result.results, null, 2)}`
						}]
					};
				} catch (error) {
					// Provide more helpful error messages
					let errorMessage = `❌ Error executing query: ${error}`;
					
					if (error.toString().includes('SQLITE_AUTH')) {
						errorMessage += "\n\n💡 Tip: This query requires system-level access that D1 restricts. Try querying user tables directly instead.";
					}

					return {
						content: [{
							type: "text",
							text: errorMessage
						}]
					};
				}
			}
		);

		// Get database schema - improved version
		this.server.tool(
			"get_database_schema",
			{},
			async () => {
				const env = this.env as Env;

				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed. Please check configuration."
						}]
					};
				}

				try {
					// Use a simpler approach that works with D1's restrictions
					const tables = await env.DB.prepare(`
						SELECT name, sql FROM sqlite_master
						WHERE type='table' AND name NOT LIKE 'sqlite_%'
						ORDER BY name
					`).all();

					const views = await env.DB.prepare(`
						SELECT name, sql FROM sqlite_master
						WHERE type='view'
						ORDER BY name
					`).all();

					let schemaInfo = "📋 **Database Schema**\n\n";

					if (tables.results.length > 0) {
						schemaInfo += "**Tables:**\n";
						for (const table of tables.results) {
							schemaInfo += `\n• **${table.name}**\n`;
							// Extract column info from CREATE TABLE statement
							if (table.sql) {
								schemaInfo += `  SQL: ${table.sql}\n`;
							}
						}
					}

					if (views.results.length > 0) {
						schemaInfo += "\n**Views:**\n";
						for (const view of views.results) {
							schemaInfo += `• **${view.name}**\n`;
							if (view.sql) {
								schemaInfo += `  SQL: ${view.sql}\n`;
							}
						}
					}

					// Add helpful note about D1 restrictions
					schemaInfo += "\n\n💡 Note: D1 restricts access to some SQLite system functions. Use the table definitions above or query sqlite_master directly for schema information.";

					return {
						content: [{
							type: "text",
							text: schemaInfo
						}]
					};
				} catch (error) {
					// Provide fallback schema information
					return {
						content: [{
							type: "text",
							text: `❌ Cannot access full schema due to D1 restrictions.

📋 **Known Tables:**

• **travel_searches**
  - id: INTEGER PRIMARY KEY
  - search_type: TEXT NOT NULL
  - origin: TEXT
  - destination: TEXT
  - departure_date: TEXT
  - return_date: TEXT
  - passengers: INTEGER DEFAULT 1
  - budget_limit: REAL
  - search_parameters: TEXT
  - results_summary: TEXT
  - created_at: DATETIME DEFAULT CURRENT_TIMESTAMP
  - user_id: TEXT DEFAULT 'anonymous'

• **user_preferences**
  - id: INTEGER PRIMARY KEY
  - user_id: TEXT NOT NULL
  - preference_type: TEXT NOT NULL
  - preference_value: TEXT
  - created_at: DATETIME DEFAULT CURRENT_TIMESTAMP
  - updated_at: DATETIME DEFAULT CURRENT_TIMESTAMP

• **popular_routes** (view)
  - Aggregates travel_searches by origin/destination

💡 Use execute_query with "SELECT name FROM sqlite_master WHERE type='table'" for a simple table list.`
						}]
					};
				}
			}
		);

		// Health check tool
		this.server.tool(
			"check_database_status",
			{},
			async () => {
				const env = this.env as Env;

				try {
					// Check initialization status
					const initialized = await this.ensureInitialized(env);
					
					// Try to count records
					let searchCount = 0;
					let preferenceCount = 0;
					
					if (initialized) {
						try {
							const searches = await env.DB.prepare("SELECT COUNT(*) as count FROM travel_searches").first();
							searchCount = searches?.count || 0;
							
							const prefs = await env.DB.prepare("SELECT COUNT(*) as count FROM user_preferences").first();
							preferenceCount = prefs?.count || 0;
						} catch (e) {
							// Ignore count errors
						}
					}

					return {
						content: [{
							type: "text",
							text: `📊 **Database Status**

✅ Initialized: ${initialized ? 'Yes' : 'No'}
📁 Travel Searches: ${searchCount} records
👤 User Preferences: ${preferenceCount} records

${!initialized ? '⚠️ Run initialize_travel_schema to set up the database.' : '✅ Database is ready for use.'}`
						}]
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error checking database status: ${error}`
						}]
					};
				}
			}
		);
	}
}

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
				service: "D1 Travel Database MCP v3 (Improved)",
				features: ["auto-initialization", "better-error-handling", "schema-workarounds"],
				timestamp: new Date().toISOString()
			}), {
				headers: { "Content-Type": "application/json" }
			});
		}

		return new Response(JSON.stringify({
			error: "Not found",
			available_endpoints: ["/sse", "/mcp", "/health"]
		}), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
	},
};