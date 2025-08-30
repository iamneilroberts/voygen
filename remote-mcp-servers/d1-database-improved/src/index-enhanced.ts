import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
	DB: D1Database;
	MCP_AUTH_KEY: string;
}

// Enhanced D1 Travel Database MCP agent with proper travel tools
export class D1TravelMCP extends McpAgent {
	server = new McpServer({
		name: "D1 Travel Database (Enhanced)",
		version: "4.0.0",
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
			// Check for both old and new tables
			await env.DB.prepare("SELECT 1 FROM Clients LIMIT 1").run();
			console.log("Database already initialized");
			
			// Also create db_errors table if it doesn't exist
			await this.createErrorLoggingTable(env);
			
			return true;
		} catch (error) {
			console.log("Database check failed, ensuring all tables exist...");
			return await this.initializeSchema(env);
		}
	}

	// Create db_errors table for tracking issues
	private async createErrorLoggingTable(env: Env): Promise<void> {
		try {
			await env.DB.prepare(`
				CREATE TABLE IF NOT EXISTS db_errors (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					error_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					attempted_operation TEXT NOT NULL,
					error_message TEXT NOT NULL,
					sql_query TEXT,
					table_names TEXT,
					column_names TEXT,
					suggested_tool TEXT,
					context TEXT,
					resolved BOOLEAN DEFAULT 0,
					resolution TEXT,
					session_id TEXT,
					mcp_server TEXT DEFAULT 'd1-database-improved'
				)
			`).run();

			// Create indexes
			await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_timestamp ON db_errors(error_timestamp)").run();
			await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_operation ON db_errors(attempted_operation)").run();
			await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_resolved ON db_errors(resolved)").run();
			
			console.log("Error logging table created successfully");
		} catch (error) {
			console.error("Failed to create error logging table:", error);
		}
	}

	// Initialize database schema
	private async initializeSchema(env: Env): Promise<boolean> {
		try {
			// Create the error logging table first
			await this.createErrorLoggingTable(env);

			// Keep existing travel_searches schema for backward compatibility
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

			console.log("Database schema initialized successfully");
			return true;
		} catch (error) {
			console.error("Failed to initialize schema:", error);
			return false;
		}
	}

	async init() {
		// CORE TRAVEL TOOLS

		// Get recent activity - the most important tool for startup
		this.server.tool(
			"get_recent_activity",
			{
				days_back: z.number().default(7).describe("How many days back to look"),
				limit: z.number().default(5).describe("Maximum results to return")
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
					const query = `
						SELECT 
							t.id as trip_id,
							t.trip_name,
							t.destination,
							t.start_date,
							t.end_date,
							t.updated_at,
							GROUP_CONCAT(c.first_name || ' ' || c.last_name) as client_names,
							CAST((JULIANDAY('now') - JULIANDAY(t.updated_at)) AS INTEGER) as days_ago,
							COALESCE(
								CASE 
									WHEN t.trip_cost_total > 0 THEN 'Planned trip ($' || CAST(t.trip_cost_total AS INTEGER) || ')'
									ELSE 'Planning in progress'
								END, 'New trip'
							) as status
						FROM Trips t
						LEFT JOIN TripParticipants tp ON t.id = tp.trip_id
						LEFT JOIN Clients c ON tp.client_id = c.id
						WHERE t.updated_at >= datetime('now', '-' || ? || ' days')
						GROUP BY t.id
						ORDER BY t.updated_at DESC
						LIMIT ?
					`;
					
					const results = await env.DB.prepare(query)
						.bind(params.days_back, params.limit)
						.all();
					
					if (results.results.length === 0) {
						return {
							content: [{
								type: "text",
								text: "No recent trips found in the last " + params.days_back + " days."
							}]
						};
					}
					
					let response = "Recent Activity:\n\n";
					for (const trip of results.results) {
						const daysAgo = trip.days_ago === 0 ? "today" : 
									   trip.days_ago === 1 ? "yesterday" : 
									   `${trip.days_ago} days ago`;
						
						response += `**${trip.client_names || 'Unknown Client'} - ${trip.destination || 'TBD'}** (${daysAgo})\n`;
						response += `Status: ${trip.status} • ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}\n`;
						response += `Trip ID: ${trip.trip_id}\n\n`;
					}
					
					return {
						content: [{
							type: "text", 
							text: response
						}]
					};
				} catch (error: any) {
					// Log the error for future improvement
					try {
						await env.DB.prepare(`
							INSERT INTO db_errors (
								attempted_operation, 
								error_message, 
								suggested_tool,
								context
							) VALUES (?, ?, ?, ?)
						`).bind(
							"get_recent_activity",
							error.message || "Unknown error",
							"get_recent_activity",
							"Failed to retrieve recent trip activity"
						).run();
					} catch (logError) {
						console.error("Failed to log error:", logError);
					}
					
					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving recent activity: ${error.message}\n\nPlease use execute_query to check the database schema.`
						}]
					};
				}
			}
		);

		// Create client
		this.server.tool(
			"create_client",
			{
				first_name: z.string().describe("Client's first name"),
				last_name: z.string().describe("Client's last name"),
				email: z.string().email().optional().describe("Client's email address"),
				phone: z.string().optional().describe("Client's phone number"),
				address: z.string().optional().describe("Street address"),
				city: z.string().optional().describe("City"),
				state: z.string().optional().describe("State/Province"),
				postal_code: z.string().optional().describe("Postal/ZIP code"),
				country: z.string().default("United States").describe("Country"),
				preferences: z.string().optional().describe("Travel preferences and notes")
			},
			async (params) => {
				const env = this.env as Env;
				
				// Ensure database is initialized
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					const result = await env.DB.prepare(`
						INSERT INTO Clients (
							first_name, last_name, email, phone, 
							address, city, state, postal_code, country,
							notes, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
					`).bind(
						params.first_name,
						params.last_name,
						params.email || null,
						params.phone || null,
						params.address || null,
						params.city || null,
						params.state || null,
						params.postal_code || null,
						params.country,
						params.preferences || null
					).run();

					return {
						content: [{
							type: "text",
							text: `✅ Client created successfully!\n\nClient ID: ${result.meta.last_row_id}\nName: ${params.first_name} ${params.last_name}`
						}]
					};
				} catch (error: any) {
					// Log error
					try {
						await env.DB.prepare(`
							INSERT INTO db_errors (
								attempted_operation, 
								error_message,
								table_names,
								suggested_tool
							) VALUES (?, ?, ?, ?)
						`).bind(
							"create_client",
							error.message || "Unknown error",
							"Clients",
							"create_client"
						).run();
					} catch (logError) {
						console.error("Failed to log error:", logError);
					}

					return {
						content: [{
							type: "text",
							text: `❌ Error creating client: ${error.message}`
						}]
					};
				}
			}
		);

		// Search clients
		this.server.tool(
			"search_clients",
			{
				search_term: z.string().describe("Name or email to search for"),
				limit: z.number().default(10).describe("Maximum results")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					const searchPattern = `%${params.search_term}%`;
					const results = await env.DB.prepare(`
						SELECT 
							id, first_name, last_name, email, phone, 
							city, state, country, notes,
							created_at, updated_at
						FROM Clients
						WHERE first_name LIKE ? 
							OR last_name LIKE ? 
							OR email LIKE ?
							OR CONCAT(first_name, ' ', last_name) LIKE ?
						ORDER BY updated_at DESC
						LIMIT ?
					`).bind(
						searchPattern,
						searchPattern,
						searchPattern,
						searchPattern,
						params.limit
					).all();

					if (results.results.length === 0) {
						return {
							content: [{
								type: "text",
								text: `No clients found matching "${params.search_term}"`
							}]
						};
					}

					let response = `Found ${results.results.length} client(s):\n\n`;
					for (const client of results.results) {
						response += `**${client.first_name} ${client.last_name}** (ID: ${client.id})\n`;
						if (client.email) response += `Email: ${client.email}\n`;
						if (client.phone) response += `Phone: ${client.phone}\n`;
						if (client.city || client.state) {
							response += `Location: ${[client.city, client.state, client.country].filter(Boolean).join(', ')}\n`;
						}
						if (client.notes) response += `Notes: ${client.notes}\n`;
						response += `\n`;
					}

					return {
						content: [{
							type: "text",
							text: response
						}]
					};
				} catch (error: any) {
					// Log error
					await this.logDatabaseError(env, {
						attempted_operation: "search_clients",
						error_message: error.message || "Unknown error",
						table_names: "Clients",
						suggested_tool: "search_clients"
					});

					return {
						content: [{
							type: "text",
							text: `❌ Error searching clients: ${error.message}`
						}]
					};
				}
			}
		);

		// Create trip
		this.server.tool(
			"create_trip",
			{
				trip_name: z.string().describe("Name for the trip"),
				destination: z.string().optional().describe("Primary destination"),
				start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
				end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
				trip_type: z.string().optional().describe("Type of trip (leisure, business, etc.)"),
				status: z.string().default("planning").describe("Trip status"),
				budget: z.number().optional().describe("Budget amount"),
				notes: z.string().optional().describe("Trip notes")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					// Generate a unique trip ID
					const tripId = `TRIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
					
					const result = await env.DB.prepare(`
						INSERT INTO Trips (
							id, trip_name, destination, start_date, end_date,
							trip_type, status, trip_cost_total, trip_notes,
							created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
					`).bind(
						tripId,
						params.trip_name,
						params.destination || null,
						params.start_date || null,
						params.end_date || null,
						params.trip_type || 'leisure',
						params.status,
						params.budget || 0,
						params.notes ? JSON.stringify({ notes: params.notes }) : null
					).run();

					return {
						content: [{
							type: "text",
							text: `✅ Trip created successfully!\n\nTrip ID: ${tripId}\nName: ${params.trip_name}\nDestination: ${params.destination || 'TBD'}\nDates: ${params.start_date || 'TBD'} to ${params.end_date || 'TBD'}`
						}]
					};
				} catch (error: any) {
					await this.logDatabaseError(env, {
						attempted_operation: "create_trip",
						error_message: error.message || "Unknown error",
						table_names: "Trips",
						suggested_tool: "create_trip"
					});

					return {
						content: [{
							type: "text",
							text: `❌ Error creating trip: ${error.message}`
						}]
					};
				}
			}
		);

		// Link trip participants
		this.server.tool(
			"link_trip_participants",
			{
				trip_id: z.string().describe("Trip ID"),
				client_id: z.number().describe("Client ID to link to trip"),
				role: z.string().default("participant").describe("Role in trip")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					await env.DB.prepare(`
						INSERT INTO TripParticipants (
							trip_id, client_id, role, created_at
						) VALUES (?, ?, ?, datetime('now'))
					`).bind(
						params.trip_id,
						params.client_id,
						params.role
					).run();

					return {
						content: [{
							type: "text",
							text: `✅ Successfully linked client ${params.client_id} to trip ${params.trip_id}`
						}]
					};
				} catch (error: any) {
					await this.logDatabaseError(env, {
						attempted_operation: "link_trip_participants",
						error_message: error.message || "Unknown error",
						table_names: "TripParticipants",
						suggested_tool: "link_trip_participants"
					});

					return {
						content: [{
							type: "text",
							text: `❌ Error linking participant: ${error.message}`
						}]
					};
				}
			}
		);

		// Get comprehensive trip details
		this.server.tool(
			"get_comprehensive_trip_details",
			{
				trip_id: z.string().describe("Trip ID to retrieve")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					// Get trip basic info
					const trip = await env.DB.prepare(`
						SELECT * FROM Trips WHERE id = ?
					`).bind(params.trip_id).first();

					if (!trip) {
						return {
							content: [{
								type: "text",
								text: `❌ Trip not found: ${params.trip_id}`
							}]
						};
					}

					// Get participants
					const participants = await env.DB.prepare(`
						SELECT 
							c.id, c.first_name, c.last_name, c.email, c.phone,
							tp.role
						FROM TripParticipants tp
						JOIN Clients c ON tp.client_id = c.id
						WHERE tp.trip_id = ?
					`).bind(params.trip_id).all();

					// Get trip days
					const tripDays = await env.DB.prepare(`
						SELECT * FROM TripDays 
						WHERE trip_id = ? 
						ORDER BY day_number
					`).bind(params.trip_id).all();

					// Format response
					let response = `## Trip Details: ${trip.trip_name}\n\n`;
					response += `**ID**: ${trip.id}\n`;
					response += `**Destination**: ${trip.destination || 'TBD'}\n`;
					response += `**Dates**: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}\n`;
					response += `**Status**: ${trip.status}\n`;
					response += `**Budget**: $${trip.trip_cost_total || 0}\n\n`;

					if (participants.results.length > 0) {
						response += `### Participants\n`;
						for (const p of participants.results) {
							response += `- ${p.first_name} ${p.last_name} (${p.role})\n`;
							if (p.email) response += `  Email: ${p.email}\n`;
							if (p.phone) response += `  Phone: ${p.phone}\n`;
						}
						response += `\n`;
					}

					if (tripDays.results.length > 0) {
						response += `### Daily Itinerary\n`;
						for (const day of tripDays.results) {
							response += `**Day ${day.day_number}** - ${day.date}\n`;
							if (day.location) response += `Location: ${day.location}\n`;
							if (day.summary) response += `${day.summary}\n`;
							response += `\n`;
						}
					}

					if (trip.trip_notes) {
						try {
							const notes = JSON.parse(trip.trip_notes);
							if (notes.notes) {
								response += `### Notes\n${notes.notes}\n`;
							}
						} catch (e) {
							// Ignore JSON parse errors
						}
					}

					return {
						content: [{
							type: "text",
							text: response
						}]
					};
				} catch (error: any) {
					await this.logDatabaseError(env, {
						attempted_operation: "get_comprehensive_trip_details",
						error_message: error.message || "Unknown error",
						table_names: "Trips,TripParticipants,Clients,TripDays",
						suggested_tool: "get_comprehensive_trip_details"
					});

					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving trip details: ${error.message}`
						}]
					};
				}
			}
		);

		// ERROR LOGGING TOOL
		this.server.tool(
			"log_database_error",
			{
				attempted_operation: z.string().describe("What was Claude trying to do"),
				error_message: z.string().describe("The error message received"),
				sql_query: z.string().optional().describe("SQL that failed"),
				table_names: z.string().optional().describe("Tables involved (comma-separated)"),
				column_names: z.string().optional().describe("Columns that might be missing (comma-separated)"),
				suggested_tool: z.string().optional().describe("What tool would have helped"),
				context: z.string().optional().describe("Additional context"),
				session_id: z.string().optional().describe("Session identifier")
			},
			async (params) => {
				const env = this.env as Env;
				
				try {
					await env.DB.prepare(`
						INSERT INTO db_errors (
							attempted_operation, 
							error_message, 
							sql_query,
							table_names,
							column_names,
							suggested_tool,
							context,
							session_id
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`).bind(
						params.attempted_operation,
						params.error_message,
						params.sql_query || null,
						params.table_names || null,
						params.column_names || null,
						params.suggested_tool || null,
						params.context || null,
						params.session_id || null
					).run();

					return {
						content: [{
							type: "text",
							text: `✅ Error logged successfully. This will help improve the system.`
						}]
					};
				} catch (error: any) {
					return {
						content: [{
							type: "text",
							text: `⚠️ Could not log error: ${error.message}`
						}]
					};
				}
			}
		);

		// Keep existing travel search tools for backward compatibility
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
						INSERT INTO travel_searches (
							search_type, origin, destination, 
							departure_date, return_date, passengers,
							budget_limit, search_parameters, results_summary,
							user_id, created_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
							text: `✅ Travel search stored successfully!\n\nSearch ID: ${result.meta.last_row_id}\nType: ${params.search_type}\nRoute: ${params.origin || 'Any'} → ${params.destination || 'Any'}`
						}]
					};
				} catch (error: any) {
					return {
						content: [{
							type: "text",
							text: `❌ Error storing search: ${error.message}`
						}]
					};
				}
			}
		);

		// Keep other existing tools...
		this.server.tool(
			"get_search_history",
			{
				user_id: z.string().optional().describe("User ID to filter by"),
				search_type: z.string().optional().describe("Search type to filter by"),
				limit: z.number().optional().describe("Maximum number of results")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					let query = "SELECT * FROM travel_searches WHERE 1=1";
					const bindings: any[] = [];
					
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

					const results = await env.DB.prepare(query).bind(...bindings).all();

					if (results.results.length === 0) {
						return {
							content: [{
								type: "text",
								text: "No search history found."
							}]
						};
					}

					let response = `📊 **Search History** (${results.results.length} records)\n\n`;
					for (const search of results.results) {
						response += `**${search.search_type}** - ${search.created_at}\n`;
						if (search.origin || search.destination) {
							response += `Route: ${search.origin || 'Any'} → ${search.destination || 'Any'}\n`;
						}
						if (search.departure_date || search.return_date) {
							response += `Dates: ${search.departure_date || '?'} to ${search.return_date || '?'}\n`;
						}
						if (search.budget_limit) {
							response += `Budget: $${search.budget_limit}\n`;
						}
						response += `\n`;
					}

					return {
						content: [{
							type: "text",
							text: response
						}]
					};
				} catch (error: any) {
					return {
						content: [{
							type: "text",
							text: `❌ Error retrieving search history: ${error.message}`
						}]
					};
				}
			}
		);

		// Execute custom SQL query
		this.server.tool(
			"execute_query",
			{
				query: z.string().describe("SQL query to execute"),
				params: z.array(z.unknown()).optional().describe("Query parameters")
			},
			async (params) => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					const stmt = env.DB.prepare(params.query);
					
					if (params.params && params.params.length > 0) {
						stmt.bind(...params.params);
					}

					// Determine if this is a SELECT query
					const isSelect = params.query.trim().toUpperCase().startsWith("SELECT");
					
					if (isSelect) {
						const results = await stmt.all();
						
						if (results.results.length === 0) {
							return {
								content: [{
									type: "text",
									text: "Query executed successfully. No results returned."
								}]
							};
						}

						// Format results as a table-like structure
						const columns = Object.keys(results.results[0]);
						let response = `Query returned ${results.results.length} row(s):\n\n`;
						
						// Add column headers
						response += columns.join(" | ") + "\n";
						response += columns.map(() => "---").join(" | ") + "\n";
						
						// Add data rows
						for (const row of results.results) {
							const values = columns.map(col => {
								const val = row[col];
								return val === null ? "NULL" : String(val);
							});
							response += values.join(" | ") + "\n";
						}

						return {
							content: [{
								type: "text",
								text: response
							}]
						};
					} else {
						// For non-SELECT queries (INSERT, UPDATE, DELETE)
						const result = await stmt.run();
						
						return {
							content: [{
								type: "text",
								text: `✅ Query executed successfully.\n\nRows affected: ${result.meta.changes}\nLast row ID: ${result.meta.last_row_id || 'N/A'}`
							}]
						};
					}
				} catch (error: any) {
					// Log the error
					try {
						await this.logDatabaseError(env, {
							attempted_operation: "execute_query",
							error_message: error.message || "Unknown error",
							sql_query: params.query,
							context: "Direct SQL execution"
						});
					} catch (logError) {
						console.error("Failed to log error:", logError);
					}

					return {
						content: [{
							type: "text",
							text: `❌ Query execution failed: ${error.message}`
						}]
					};
				}
			}
		);

		// Get database schema
		this.server.tool(
			"get_database_schema",
			{},
			async () => {
				const env = this.env as Env;
				
				const initialized = await this.ensureInitialized(env);
				if (!initialized) {
					return {
						content: [{
							type: "text",
							text: "❌ Database initialization failed."
						}]
					};
				}

				try {
					// Get all tables
					const tables = await env.DB.prepare(`
						SELECT name, sql FROM sqlite_master
						WHERE type='table' AND name NOT LIKE 'sqlite_%'
						ORDER BY name
					`).all();

					let schemaInfo = "📋 **Database Schema**\n\n";
					
					if (tables.results.length > 0) {
						schemaInfo += "**Tables:**\n";
						for (const table of tables.results) {
							schemaInfo += `\n• **${table.name}**\n`;
							if (table.sql) {
								schemaInfo += `\`\`\`sql\n${table.sql}\n\`\`\`\n`;
							}
						}
					}

					// Add helpful notes
					schemaInfo += "\n💡 **Key Tables:**\n";
					schemaInfo += "- **Clients**: Customer information\n";
					schemaInfo += "- **Trips**: Trip details and planning\n";
					schemaInfo += "- **TripParticipants**: Links clients to trips\n";
					schemaInfo += "- **TripDays**: Daily itinerary\n";
					schemaInfo += "- **db_errors**: Error logging for system improvement\n";
					
					schemaInfo += "\n🔧 **Available Tools:**\n";
					schemaInfo += "- get_recent_activity: View recent trips\n";
					schemaInfo += "- create_client/search_clients: Manage clients\n";
					schemaInfo += "- create_trip/get_comprehensive_trip_details: Manage trips\n";
					schemaInfo += "- log_database_error: Log issues for improvement\n";

					return {
						content: [{
							type: "text",
							text: schemaInfo
						}]
					};
				} catch (error: any) {
					return {
						content: [{
							type: "text",
							text: `❌ Cannot access schema: ${error.message}`
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
					const initialized = await this.ensureInitialized(env);
					
					let clientCount = 0;
					let tripCount = 0;
					let errorCount = 0;
					
					if (initialized) {
						try {
							const clients = await env.DB.prepare("SELECT COUNT(*) as count FROM Clients").first();
							clientCount = clients?.count || 0;
							
							const trips = await env.DB.prepare("SELECT COUNT(*) as count FROM Trips").first();
							tripCount = trips?.count || 0;
							
							const errors = await env.DB.prepare("SELECT COUNT(*) as count FROM db_errors WHERE resolved = 0").first();
							errorCount = errors?.count || 0;
						} catch (e) {
							// Ignore count errors
						}
					}

					return {
						content: [{
							type: "text",
							text: `📊 **Database Status**

✅ Initialized: ${initialized ? 'Yes' : 'No'}
👥 Clients: ${clientCount} records
✈️ Trips: ${tripCount} records
⚠️ Unresolved Errors: ${errorCount} issues

${!initialized ? '⚠️ Run initialization to set up the database.' : '✅ Database is ready for use.'}`
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

	// Helper method to log database errors
	private async logDatabaseError(env: Env, errorInfo: {
		attempted_operation: string;
		error_message: string;
		sql_query?: string;
		table_names?: string;
		column_names?: string;
		suggested_tool?: string;
		context?: string;
		session_id?: string;
	}) {
		try {
			await env.DB.prepare(`
				INSERT INTO db_errors (
					attempted_operation, 
					error_message, 
					sql_query,
					table_names,
					column_names,
					suggested_tool,
					context,
					session_id
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				errorInfo.attempted_operation,
				errorInfo.error_message,
				errorInfo.sql_query || null,
				errorInfo.table_names || null,
				errorInfo.column_names || null,
				errorInfo.suggested_tool || null,
				errorInfo.context || null,
				errorInfo.session_id || null
			).run();
		} catch (error) {
			console.error("Failed to log database error:", error);
		}
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
				service: "D1 Travel Database MCP v4 (Enhanced)",
				features: ["travel-tools", "error-logging", "recent-activity", "auto-initialization"],
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