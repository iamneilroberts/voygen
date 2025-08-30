/**
 * Utility tools for database operations and schema management
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerUtilityTools(server: McpServer, getEnv: () => Env) {
	// Execute custom SQL query
	server.tool(
		"execute_query",
		{
			query: z.string().describe("SQL query to execute"),
			params: z.array(z.unknown()).optional().describe("Query parameters")
		},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
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
					
					return dbManager.createSuccessResponse(
						`Query executed successfully.\n\nRows affected: ${result.meta.changes}\nLast row ID: ${result.meta.last_row_id || 'N/A'}`
					);
				}
			} catch (error: any) {
				await errorLogger.logError({
					attempted_operation: "execute_query",
					error_message: error.message || "Unknown error",
					sql_query: params.query,
					context: "Direct SQL execution"
				});

				return dbManager.createErrorResponse(`Query execution failed: ${error.message}`);
			}
		}
	);

	// Get database schema
	server.tool(
		"get_database_schema",
		{},
		async () => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				// Get all tables
				const tables = await env.DB.prepare(`
					SELECT name, sql FROM sqlite_master
					WHERE type='table' AND name NOT LIKE 'sqlite_%'
					ORDER BY name
				`).all();

				// Get all views
				const views = await env.DB.prepare(`
					SELECT name, sql FROM sqlite_master
					WHERE type='view' AND name NOT LIKE 'sqlite_%'
					ORDER BY name
				`).all();

				let schemaInfo = "📋 **Database Schema**\n\n";
				
				if (tables.results.length > 0) {
					schemaInfo += "**Tables:**\n";
					for (const table of tables.results) {
						schemaInfo += `\n• **${table.name}**\n`;
						if (table.sql) {
							// Clean up SQL formatting
							const formattedSql = table.sql
								.replace(/\s+/g, ' ')
								.replace(/\(\s+/g, '(\n    ')
								.replace(/,\s+/g, ',\n    ')
								.replace(/\)\s*$/g, '\n)');
							schemaInfo += `  SQL: ${formattedSql}\n`;
						}
					}
				}

				if (views.results.length > 0) {
					schemaInfo += "\n**Views:**\n";
					for (const view of views.results) {
						schemaInfo += `• **${view.name}**\n`;
						if (view.sql) {
							const formattedSql = view.sql
								.replace(/\s+/g, ' ')
								.substring(0, 200);
							schemaInfo += `  SQL: ${formattedSql}${view.sql.length > 200 ? '...' : ''}\n`;
						}
					}
				}

				// Add note about D1 restrictions
				schemaInfo += "\n\n💡 Note: D1 restricts access to some SQLite system functions. Use the table definitions above or query sqlite_master directly for schema information.";

				return {
					content: [{
						type: "text",
						text: schemaInfo
					}]
				};
			} catch (error: any) {
				return dbManager.createErrorResponse(`Cannot access schema: ${error.message}`);
			}
		}
	);

	// Health check tool
	server.tool(
		"check_database_status",
		{},
		async () => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);

			try {
				const initialized = await dbManager.ensureInitialized();
				
				let clientCount = 0;
				let tripCount = 0;
				let errorCount = 0;
				let instructionCount = 0;
				
				if (initialized) {
					try {
						const clients = await env.DB.prepare("SELECT COUNT(*) as count FROM Clients").first();
						clientCount = clients?.count || 0;
						
						const trips = await env.DB.prepare("SELECT COUNT(*) as count FROM Trips").first();
						tripCount = trips?.count || 0;
						
						errorCount = await errorLogger.getUnresolvedErrorCount();
						
						const instructions = await env.DB.prepare("SELECT COUNT(*) as count FROM instruction_sets WHERE active = 1").first();
						instructionCount = instructions?.count || 0;
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
📚 Instructions: ${instructionCount} active
⚠️ Unresolved Errors: ${errorCount} issues

${!initialized ? '⚠️ Run initialization to set up the database.' : '✅ Database is ready for use.'}`
					}]
				};
			} catch (error) {
				return dbManager.createErrorResponse(`Error checking database status: ${error}`);
			}
		}
	);
}