/**
 * Client management tools for D1 Travel Database
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerClientTools(server: McpServer, getEnv: () => Env) {
	// Create client
	server.tool(
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
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			// Ensure database is initialized
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
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

				return dbManager.createSuccessResponse(
					`Client created successfully!\n\nClient ID: ${result.meta.last_row_id}\nName: ${params.first_name} ${params.last_name}`
				);
			} catch (error: any) {
				await errorLogger.logToolError("create_client", error, "Failed to create client");
				return dbManager.createErrorResponse(`Error creating client: ${error.message}`);
			}
		}
	);

	// Search clients
	server.tool(
		"search_clients",
		{
			search_term: z.string().describe("Name or email to search for"),
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
						OR first_name || ' ' || last_name LIKE ?
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
				await errorLogger.logToolError("search_clients", error, "Failed to search clients");
				return dbManager.createErrorResponse(`Error searching clients: ${error.message}`);
			}
		}
	);

	// Get client by ID
	server.tool(
		"get_client",
		{
			client_id: z.number().describe("Client ID to retrieve")
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
				const client = await env.DB.prepare(`
					SELECT * FROM Clients WHERE id = ?
				`).bind(params.client_id).first();

				if (!client) {
					return {
						content: [{
							type: "text",
							text: `❌ Client not found with ID: ${params.client_id}`
						}]
					};
				}

				let response = `## Client Details\n\n`;
				response += `**Name**: ${client.first_name} ${client.last_name}\n`;
				response += `**ID**: ${client.id}\n`;
				if (client.email) response += `**Email**: ${client.email}\n`;
				if (client.phone) response += `**Phone**: ${client.phone}\n`;
				if (client.address) response += `**Address**: ${client.address}\n`;
				if (client.city || client.state || client.postal_code) {
					response += `**Location**: ${[client.address, client.city, client.state, client.postal_code, client.country].filter(Boolean).join(', ')}\n`;
				}
				if (client.notes) response += `\n### Notes\n${client.notes}\n`;
				response += `\n**Created**: ${client.created_at}\n`;
				response += `**Last Updated**: ${client.updated_at}\n`;

				return {
					content: [{
						type: "text",
						text: response
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("get_client", error, "Failed to retrieve client");
				return dbManager.createErrorResponse(`Error retrieving client: ${error.message}`);
			}
		}
	);
}