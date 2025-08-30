/**
 * User preference management tools for D1 Travel Database
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse, VERBOSITY_ICONS, VERBOSITY_DESCRIPTIONS } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerPreferenceTools(server: McpServer, getEnv: () => Env) {
	// Get user preference
	server.tool(
		"get_user_preference",
		{
			user_id: z.string().default("default").describe("User ID (default: 'default' for global preferences)"),
			preference_type: z.string().describe("Type of preference to retrieve (e.g., 'verbosity_level')")
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
				const result = await env.DB.prepare(`
					SELECT preference_value, updated_at 
					FROM user_preferences 
					WHERE user_id = ? AND preference_type = ?
					ORDER BY updated_at DESC
					LIMIT 1
				`).bind(params.user_id, params.preference_type).first();

				if (!result) {
					// Return default values for known preference types
					const defaults: Record<string, string> = {
						'verbosity_level': 'normal'
					};
					
					return {
						content: [{
							type: "text",
							text: `📊 **User Preference**\n\nType: ${params.preference_type}\nValue: ${defaults[params.preference_type] || 'Not set'}\nStatus: Using default`
						}]
					};
				}

				return {
					content: [{
						type: "text",
						text: `📊 **User Preference**\n\nType: ${params.preference_type}\nValue: ${result.preference_value}\nLast Updated: ${result.updated_at}`
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("get_user_preference", error, "Failed to retrieve preference");
				return dbManager.createErrorResponse(`Error retrieving preference: ${error.message}`);
			}
		}
	);

	// Set user preference
	server.tool(
		"set_user_preference",
		{
			user_id: z.string().default("default").describe("User ID (default: 'default' for global preferences)"),
			preference_type: z.string().describe("Type of preference (e.g., 'verbosity_level')"),
			preference_value: z.string().describe("Value to set (e.g., 'concise', 'normal', 'detailed')")
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
				// Validate verbosity level values
				if (params.preference_type === 'verbosity_level') {
					const validLevels = ['concise', 'normal', 'detailed'];
					if (!validLevels.includes(params.preference_value)) {
						return dbManager.createErrorResponse(
							`Invalid verbosity level. Must be one of: ${validLevels.join(', ')}`
						);
					}
				}

				// Check if preference exists
				const existing = await env.DB.prepare(`
					SELECT id FROM user_preferences 
					WHERE user_id = ? AND preference_type = ?
				`).bind(params.user_id, params.preference_type).first();

				if (existing) {
					// Update existing preference
					await env.DB.prepare(`
						UPDATE user_preferences 
						SET preference_value = ?, updated_at = datetime('now')
						WHERE user_id = ? AND preference_type = ?
					`).bind(params.preference_value, params.user_id, params.preference_type).run();
				} else {
					// Insert new preference
					await env.DB.prepare(`
						INSERT INTO user_preferences (user_id, preference_type, preference_value)
						VALUES (?, ?, ?)
					`).bind(params.user_id, params.preference_type, params.preference_value).run();
				}

				// Format response with verbosity indicator for verbosity_level changes
				let responseText = `✅ Preference saved successfully!\n\nType: ${params.preference_type}\nValue: ${params.preference_value}`;
				
				if (params.preference_type === 'verbosity_level') {
					const icon = VERBOSITY_ICONS[params.preference_value as keyof typeof VERBOSITY_ICONS];
					const description = VERBOSITY_DESCRIPTIONS[params.preference_value as keyof typeof VERBOSITY_DESCRIPTIONS];
					
					responseText = `📊 Verbosity Mode Updated!\n\nNew: ${icon} **${params.preference_value.charAt(0).toUpperCase() + params.preference_value.slice(1)}** - ${description}\n\nYour preferences have been saved and will apply to all future sessions.`;
				}

				return {
					content: [{
						type: "text",
						text: responseText
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("set_user_preference", error, "Failed to set preference");
				return dbManager.createErrorResponse(`Error setting preference: ${error.message}`);
			}
		}
	);

	// List all user preferences
	server.tool(
		"list_user_preferences",
		{
			user_id: z.string().default("default").describe("User ID (default: 'default' for global preferences)")
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
				const preferences = await env.DB.prepare(`
					SELECT preference_type, preference_value, updated_at
					FROM user_preferences
					WHERE user_id = ?
					ORDER BY preference_type
				`).bind(params.user_id).all();

				if (!preferences.results || preferences.results.length === 0) {
					return {
						content: [{
							type: "text",
							text: `📊 **User Preferences**\n\nNo preferences set for user: ${params.user_id}\n\nDefault values will be used.`
						}]
					};
				}

				let output = `📊 **User Preferences for ${params.user_id}**\n\n`;
				
				for (const pref of preferences.results) {
					output += `**${pref.preference_type}**: ${pref.preference_value}\n`;
					
					// Add special formatting for verbosity level
					if (pref.preference_type === 'verbosity_level') {
						const icon = VERBOSITY_ICONS[pref.preference_value as keyof typeof VERBOSITY_ICONS] || '❓';
						output = output.replace(
							`**verbosity_level**: ${pref.preference_value}`,
							`**Verbosity Level**: ${icon} ${pref.preference_value}`
						);
					}
					
					output += `  Last updated: ${pref.updated_at}\n\n`;
				}

				return {
					content: [{
						type: "text",
						text: output
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("list_user_preferences", error, "Failed to list preferences");
				return dbManager.createErrorResponse(`Error listing preferences: ${error.message}`);
			}
		}
	);

	// Legacy preference tools for backward compatibility
	// These will be removed in the next phase
	server.tool(
		"store_user_preference",
		{
			user_id: z.string().describe("User identifier"),
			preference_type: z.string().describe("Type of preference (airline, seat_type, meal, etc.)"),
			preference_value: z.string().describe("Preference value")
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
					INSERT INTO user_preferences (user_id, preference_type, preference_value)
					VALUES (?, ?, ?)
					ON CONFLICT(user_id, preference_type) DO UPDATE SET
						preference_value = excluded.preference_value,
						updated_at = datetime('now')
				`).bind(params.user_id, params.preference_type, params.preference_value).run();

				return dbManager.createSuccessResponse(
					`Preference stored: ${params.preference_type} = ${params.preference_value}`
				);
			} catch (error: any) {
				await errorLogger.logToolError("store_user_preference", error, "Failed to store preference");
				return dbManager.createErrorResponse(`Error storing preference: ${error.message}`);
			}
		}
	);

	server.tool(
		"get_user_preferences",
		{
			user_id: z.string().describe("User identifier"),
			preference_type: z.string().optional().describe("Specific preference type to retrieve")
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
				let query = `SELECT preference_type, preference_value FROM user_preferences WHERE user_id = ?`;
				const bindings: any[] = [params.user_id];

				if (params.preference_type) {
					query += ` AND preference_type = ?`;
					bindings.push(params.preference_type);
				}

				const results = await env.DB.prepare(query).bind(...bindings).all();

				if (results.results.length === 0) {
					return {
						content: [{
							type: "text",
							text: "No preferences found."
						}]
					};
				}

				let response = `📊 **User Preferences**\n\n`;
				for (const pref of results.results) {
					response += `${pref.preference_type}: ${pref.preference_value}\n`;
				}

				return {
					content: [{
						type: "text",
						text: response
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("get_user_preferences", error, "Failed to get preferences");
				return dbManager.createErrorResponse(`Error retrieving preferences: ${error.message}`);
			}
		}
	);
}