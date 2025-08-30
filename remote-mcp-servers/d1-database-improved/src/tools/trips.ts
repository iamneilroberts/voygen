/**
 * Trip management tools for D1 Travel Database
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerTripTools(server: McpServer, getEnv: () => Env) {
	// Get recent activity - the most important tool for startup
	server.tool(
		"get_recent_activity",
		{
			days_back: z.number().default(7).describe("How many days back to look"),
			limit: z.number().default(5).describe("Maximum results to return")
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
				await errorLogger.logToolError("get_recent_activity", error, "Failed to retrieve recent activity");
				return dbManager.createErrorResponse(`Error retrieving recent activity: ${error.message}\n\nPlease use execute_query to check the database schema.`);
			}
		}
	);

	// Create trip
	server.tool(
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
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
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

				return dbManager.createSuccessResponse(
					`Trip created successfully!\n\nTrip ID: ${tripId}\nName: ${params.trip_name}\nDestination: ${params.destination || 'TBD'}\nDates: ${params.start_date || 'TBD'} to ${params.end_date || 'TBD'}`
				);
			} catch (error: any) {
				await errorLogger.logToolError("create_trip", error, "Failed to create trip");
				return dbManager.createErrorResponse(`Error creating trip: ${error.message}`);
			}
		}
	);

	// Link trip participants
	server.tool(
		"link_trip_participants",
		{
			trip_id: z.string().describe("Trip ID"),
			client_id: z.number().describe("Client ID to link to trip"),
			role: z.string().default("participant").describe("Role in trip")
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
				await env.DB.prepare(`
					INSERT INTO TripParticipants (
						trip_id, client_id, role, created_at
					) VALUES (?, ?, ?, datetime('now'))
				`).bind(
					params.trip_id,
					params.client_id,
					params.role
				).run();

				return dbManager.createSuccessResponse(
					`Successfully linked client ${params.client_id} to trip ${params.trip_id}`
				);
			} catch (error: any) {
				await errorLogger.logToolError("link_trip_participants", error, "Failed to link participant");
				return dbManager.createErrorResponse(`Error linking participant: ${error.message}`);
			}
		}
	);

	// Get comprehensive trip details
	server.tool(
		"get_comprehensive_trip_details",
		{
			trip_id: z.string().describe("Trip ID to retrieve")
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
				// Get trip basic info
				const trip = await env.DB.prepare(`
					SELECT * FROM Trips WHERE id = ?
				`).bind(params.trip_id).first();

				if (!trip) {
					return dbManager.createErrorResponse(`Trip not found: ${params.trip_id}`);
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
				await errorLogger.logToolError(
					"get_comprehensive_trip_details", 
					error, 
					"Failed to retrieve trip details",
					"get_comprehensive_trip_details"
				);
				return dbManager.createErrorResponse(`Error retrieving trip details: ${error.message}`);
			}
		}
	);

	// Search trips
	server.tool(
		"search_trips",
		{
			search_term: z.string().optional().describe("Search in trip name, destination, or client names"),
			client_name: z.string().optional().describe("Filter by client name"),
			destination: z.string().optional().describe("Filter by destination"),
			status: z.string().optional().describe("Filter by status"),
			limit: z.number().default(10).describe("Maximum results")
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
				let query = `
					SELECT DISTINCT
						t.id,
						t.trip_name,
						t.destination,
						t.start_date,
						t.end_date,
						t.status,
						t.trip_cost_total,
						GROUP_CONCAT(c.first_name || ' ' || c.last_name) as client_names
					FROM Trips t
					LEFT JOIN TripParticipants tp ON t.id = tp.trip_id
					LEFT JOIN Clients c ON tp.client_id = c.id
					WHERE 1=1
				`;
				const bindings: any[] = [];

				if (params.search_term) {
					query += ` AND (t.trip_name LIKE ? OR t.destination LIKE ?)`;
					const pattern = `%${params.search_term}%`;
					bindings.push(pattern, pattern);
				}

				if (params.destination) {
					query += ` AND t.destination LIKE ?`;
					bindings.push(`%${params.destination}%`);
				}

				if (params.status) {
					query += ` AND t.status = ?`;
					bindings.push(params.status);
				}

				query += ` GROUP BY t.id ORDER BY t.updated_at DESC LIMIT ?`;
				bindings.push(params.limit);

				const results = await env.DB.prepare(query).bind(...bindings).all();

				// Filter by client name if specified (post-processing since it's aggregated)
				let filteredResults = results.results;
				if (params.client_name) {
					filteredResults = filteredResults.filter(trip => 
						trip.client_names && trip.client_names.toLowerCase().includes(params.client_name!.toLowerCase())
					);
				}

				if (filteredResults.length === 0) {
					return {
						content: [{
							type: "text",
							text: "No trips found matching the search criteria."
						}]
					};
				}

				let response = `Found ${filteredResults.length} trip(s):\n\n`;
				for (const trip of filteredResults) {
					response += `**${trip.trip_name}** (${trip.id})\n`;
					response += `Destination: ${trip.destination || 'TBD'}\n`;
					response += `Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}\n`;
					response += `Status: ${trip.status}\n`;
					if (trip.client_names) response += `Clients: ${trip.client_names}\n`;
					if (trip.trip_cost_total) response += `Budget: $${trip.trip_cost_total}\n`;
					response += `\n`;
				}

				return {
					content: [{
						type: "text",
						text: response
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("search_trips", error, "Failed to search trips");
				return dbManager.createErrorResponse(`Error searching trips: ${error.message}`);
			}
		}
	);

	// ERROR LOGGING TOOL - specific to database operations
	server.tool(
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
			const env = getEnv();
			const errorLogger = new ErrorLogger(env);
			
			try {
				await errorLogger.logError(params);
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
}