/**
 * Instruction management tools for D1 Travel Database
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerInstructionTools(server: McpServer, getEnv: () => Env) {
	// User-friendly startup tool
	server.tool(
		"start",
		{},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				// Load startup-core instruction
				const instruction = await env.DB.prepare(`
					SELECT * FROM instruction_sets 
					WHERE name = 'startup-core' AND active = 1
				`).first();

				if (!instruction) {
					return dbManager.createErrorResponse("No startup-core instruction found. Please ensure the system is properly configured.");
				}

				// Create friendly welcome response
				const welcomeMessage = `✅ **Travel Agent System Ready!**

I'm Claude, Kim Henderson's AI travel assistant. Your core instructions have been loaded successfully.

🎯 **Ready to help with:**
- New trip planning and client interviews
- Hotel searches and booking research  
- Daily itinerary building with local gems
- Commission tracking and trip verification
- Mobile lead processing and autonomous workflows

📋 **Quick Commands:**
- Type "help" to see available workflows
- Type "status" to check loaded instructions
- Use "/new" for interactive trip planning
- Use "/tools" to see available MCP tools

${instruction.content}

---
*System initialized with startup-core v${instruction.version}*`;

				return {
					content: [{
						type: "text",
						text: welcomeMessage
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("start", error, "Failed to load startup instructions");
				return dbManager.createErrorResponse(`Error starting system: ${error.message}`);
			}
		}
	);

	// Alternative alias for start
	server.tool(
		"initialize",
		{},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				// Load startup-core instruction
				const instruction = await env.DB.prepare(`
					SELECT * FROM instruction_sets 
					WHERE name = 'startup-core' AND active = 1
				`).first();

				if (!instruction) {
					return dbManager.createErrorResponse("No startup-core instruction found. Please ensure the system is properly configured.");
				}

				// Create friendly welcome response
				const welcomeMessage = `✅ **Travel Agent System Initialized!**

I'm Claude, Kim Henderson's AI travel assistant. Your core instructions have been loaded successfully.

🎯 **Ready to help with:**
- New trip planning and client interviews
- Hotel searches and booking research  
- Daily itinerary building with local gems
- Commission tracking and trip verification
- Mobile lead processing and autonomous workflows

📋 **Quick Commands:**
- Type "help" to see available workflows
- Type "status" to check loaded instructions
- Use "/new" for interactive trip planning
- Use "/tools" to see available MCP tools

${instruction.content}

---
*System initialized with startup-core v${instruction.version}*`;

				return {
					content: [{
						type: "text",
						text: welcomeMessage
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("initialize", error, "Failed to initialize system");
				return dbManager.createErrorResponse(`Error initializing system: ${error.message}`);
			}
		}
	);

	// Get instruction by name
	server.tool(
		"get_instruction",
		{
			name: z.string().describe("Instruction name (e.g., 'startup-core', 'mobile-mode')")
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
				const instruction = await env.DB.prepare(`
					SELECT * FROM instruction_sets 
					WHERE name = ? AND active = 1
				`).bind(params.name).first();

				if (!instruction) {
					return dbManager.createErrorResponse(`No active instruction found with name: ${params.name}`);
				}

				return {
					content: [{
						type: "text",
						text: `# ${instruction.title}\n\n${instruction.content}\n\n---\n*Category: ${instruction.category} | Version: ${instruction.version}*`
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("get_instruction", error, "Failed to retrieve instruction");
				return dbManager.createErrorResponse(`Error retrieving instruction: ${error.message}`);
			}
		}
	);

	// List all instructions
	server.tool(
		"list_instructions",
		{
			category: z.string().optional().describe("Filter by category (modes, workflows, tools, etc.)")
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
					SELECT id, name, title, category, version, updated_at
					FROM instruction_sets 
					WHERE active = 1
				`;
				const bindings: any[] = [];

				if (params.category) {
					query += ` AND category = ?`;
					bindings.push(params.category);
				}

				query += ` ORDER BY category, name`;

				const results = await env.DB.prepare(query).bind(...bindings).all();

				if (results.results.length === 0) {
					return {
						content: [{
							type: "text",
							text: "No active instructions found."
						}]
					};
				}

				let response = "📚 **Available Instructions**\n\n";
				let currentCategory = "";
				
				for (const inst of results.results) {
					if (inst.category !== currentCategory) {
						currentCategory = inst.category;
						response += `\n### ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}\n`;
					}
					response += `- **${inst.name}**: ${inst.title} (v${inst.version})\n`;
				}

				return {
					content: [{
						type: "text",
						text: response
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("list_instructions", error, "Failed to list instructions");
				return dbManager.createErrorResponse(`Error listing instructions: ${error.message}`);
			}
		}
	);

	// Search instructions
	server.tool(
		"search_instructions",
		{
			search_term: z.string().describe("Search term to find in instruction content"),
			limit: z.number().default(5).describe("Maximum results")
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
					SELECT name, title, category, 
						   SUBSTR(content, 1, 200) as preview
					FROM instruction_sets 
					WHERE active = 1 
					  AND (content LIKE ? OR title LIKE ? OR name LIKE ?)
					ORDER BY 
						CASE 
							WHEN name LIKE ? THEN 1
							WHEN title LIKE ? THEN 2
							ELSE 3
						END
					LIMIT ?
				`).bind(
					searchPattern, searchPattern, searchPattern,
					searchPattern, searchPattern,
					params.limit
				).all();

				if (results.results.length === 0) {
					return {
						content: [{
							type: "text",
							text: `No instructions found matching "${params.search_term}"`
						}]
					};
				}

				let response = `🔍 **Search Results for "${params.search_term}"**\n\n`;
				for (const inst of results.results) {
					response += `### ${inst.title}\n`;
					response += `- **Name**: ${inst.name}\n`;
					response += `- **Category**: ${inst.category}\n`;
					response += `- **Preview**: ${inst.preview}...\n\n`;
				}

				return {
					content: [{
						type: "text",
						text: response
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("search_instructions", error, "Failed to search instructions");
				return dbManager.createErrorResponse(`Error searching instructions: ${error.message}`);
			}
		}
	);

	// Update instruction
	server.tool(
		"update_instruction",
		{
			name: z.string().describe("Instruction name to update"),
			content: z.string().optional().describe("New content"),
			title: z.string().optional().describe("New title"),
			category: z.string().optional().describe("New category"),
			active: z.boolean().optional().describe("Active status")
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
				// Build dynamic update query
				const updates: string[] = [];
				const bindings: any[] = [];

				if (params.content !== undefined) {
					updates.push("content = ?");
					bindings.push(params.content);
				}
				if (params.title !== undefined) {
					updates.push("title = ?");
					bindings.push(params.title);
				}
				if (params.category !== undefined) {
					updates.push("category = ?");
					bindings.push(params.category);
				}
				if (params.active !== undefined) {
					updates.push("active = ?");
					bindings.push(params.active ? 1 : 0);
				}

				if (updates.length === 0) {
					return dbManager.createErrorResponse("No fields to update");
				}

				updates.push("updated_at = datetime('now')");
				updates.push("version = version + 1");
				bindings.push(params.name);

				const query = `
					UPDATE instruction_sets 
					SET ${updates.join(", ")}
					WHERE name = ?
				`;

				const result = await env.DB.prepare(query).bind(...bindings).run();

				if (result.meta.changes === 0) {
					return dbManager.createErrorResponse(`No instruction found with name: ${params.name}`);
				}

				return dbManager.createSuccessResponse(`Successfully updated instruction: ${params.name}`);
			} catch (error: any) {
				await errorLogger.logToolError("update_instruction", error, "Failed to update instruction");
				return dbManager.createErrorResponse(`Error updating instruction: ${error.message}`);
			}
		}
	);

	// User-friendly status tool
	server.tool(
		"status",
		{},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				const results = await env.DB.prepare(`
					SELECT name, title, category, version, updated_at
					FROM instruction_sets 
					WHERE active = 1
					ORDER BY 
						CASE 
							WHEN name = 'startup-core' THEN 1
							WHEN category = 'modes' THEN 2
							WHEN category = 'workflows' THEN 3
							WHEN category = 'tools' THEN 4
							ELSE 5
						END,
						name
				`).all();

				if (results.results.length === 0) {
					return {
						content: [{
							type: "text",
							text: "⚠️ **No Instructions Loaded**\n\nNo active instructions found. Use the 'start' command to initialize the travel agent system."
						}]
					};
				}

				let statusMessage = "📋 **Travel Agent System Status**\n\n";
				let currentCategory = "";
				
				for (const inst of results.results) {
					if (inst.category !== currentCategory) {
						currentCategory = inst.category;
						statusMessage += `\n### ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)} Instructions\n`;
					}
					
					const isCore = inst.name === 'startup-core';
					const icon = isCore ? '🟢' : '✅';
					statusMessage += `${icon} **${inst.name}**: ${inst.title} (v${inst.version})\n`;
					
					if (isCore) {
						statusMessage += `   *Last updated: ${new Date(inst.updated_at).toLocaleDateString()}*\n`;
					}
				}

				statusMessage += `\n---\n*Total: ${results.results.length} active instructions*`;

				return {
					content: [{
						type: "text",
						text: statusMessage
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("status", error, "Failed to get system status");
				return dbManager.createErrorResponse(`Error getting status: ${error.message}`);
			}
		}
	);

	// User-friendly reload tool
	server.tool(
		"reload",
		{},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				// Get current instruction count before reload
				const beforeCount = await env.DB.prepare(`
					SELECT COUNT(*) as count FROM instruction_sets WHERE active = 1
				`).first();

				// Force re-read startup-core instruction to verify it's current
				const instruction = await env.DB.prepare(`
					SELECT * FROM instruction_sets 
					WHERE name = 'startup-core' AND active = 1
				`).first();

				if (!instruction) {
					return dbManager.createErrorResponse("No startup-core instruction found. Please ensure the system is properly configured.");
				}

				// Get updated instruction count
				const afterCount = await env.DB.prepare(`
					SELECT COUNT(*) as count FROM instruction_sets WHERE active = 1
				`).first();

				const reloadMessage = `🔄 **System Instructions Reloaded**

✅ Successfully refreshed all travel agent instructions from database.

📋 **System Status:**
- Startup core: ${instruction.title} (v${instruction.version})
- Active instructions: ${afterCount?.count || 0}
- Last updated: ${new Date(instruction.updated_at).toLocaleString()}

🎯 **System Ready For:**
- New trip planning and client interviews
- Hotel searches and booking research
- Daily itinerary building with local gems
- Commission tracking and trip verification
- Mobile lead processing and autonomous workflows

💡 Use 'help' to see available workflows or 'status' to check detailed instruction list.

---
*Instructions reloaded successfully at ${new Date().toLocaleString()}*`;

				return {
					content: [{
						type: "text",
						text: reloadMessage
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("reload", error, "Failed to reload instructions");
				return dbManager.createErrorResponse(`Error reloading instructions: ${error.message}`);
			}
		}
	);

	// Alternative alias for reload
	server.tool(
		"refresh",
		{},
		async (params) => {
			const env = getEnv();
			const dbManager = new DatabaseManager(env);
			const errorLogger = new ErrorLogger(env);
			
			const initialized = await dbManager.ensureInitialized();
			if (!initialized) {
				return dbManager.createInitFailedResponse();
			}

			try {
				// Get current instruction count before refresh
				const beforeCount = await env.DB.prepare(`
					SELECT COUNT(*) as count FROM instruction_sets WHERE active = 1
				`).first();

				// Force re-read startup-core instruction to verify it's current
				const instruction = await env.DB.prepare(`
					SELECT * FROM instruction_sets 
					WHERE name = 'startup-core' AND active = 1
				`).first();

				if (!instruction) {
					return dbManager.createErrorResponse("No startup-core instruction found. Please ensure the system is properly configured.");
				}

				const refreshMessage = `🔄 **System Instructions Refreshed**

✅ All travel agent instructions have been refreshed from the database.

📋 **Current Status:**
- Core system: ${instruction.title} (v${instruction.version})  
- Active instructions: ${beforeCount?.count || 0}
- System status: Ready for travel planning

Use 'status' for detailed instruction list or 'help' for available workflows.

---
*System refreshed at ${new Date().toLocaleString()}*`;

				return {
					content: [{
						type: "text",
						text: refreshMessage
					}]
				};
			} catch (error: any) {
				await errorLogger.logToolError("refresh", error, "Failed to refresh instructions");
				return dbManager.createErrorResponse(`Error refreshing instructions: ${error.message}`);
			}
		}
	);

	// User-friendly help tool
	server.tool(
		"help",
		{},
		async (params) => {
			const helpMessage = `🛠️ **Travel Agent System Help**

## 🚀 Quick Start Commands
- **start** or **initialize** - Load travel agent instructions and get ready
- **status** - Show which instructions are currently loaded  
- **help** - Show this help menu
- **reload** - Refresh system instructions

## 🎯 Main Workflows

### 🆕 New Trip Planning
- Use \`/new\` for interactive trip planning wizard
- Use \`get_instruction('trip-discovery')\` for structured client interviews
- Use \`get_instruction('client-interview-mode')\` for detailed lead capture

### 🏨 Hotel & Accommodation Research
- Use \`get_instruction('cpmaxx-search')\` for CPMaxx portal searches
- Use \`get_instruction('image-capture-optimization')\` for efficient photo gathering
- Use hotel search tools from the hotel-research MCP server

### 📅 Daily Itinerary Building
- Use \`get_instruction('daily-planning')\` for structured day-by-day planning
- Use \`get_instruction('kims-gems-daily')\` to find unique local experiences
- Use \`get_instruction('viator-integration')\` to add tours and activities

### ✅ Trip Verification & Completion
- Use \`get_instruction('daily-trip-verification')\` after planning each day
- Use \`get_instruction('trip-completeness-check')\` for final review
- Use \`get_instruction('commission-targets')\` to optimize revenue

### 📱 Mobile/Autonomous Mode
- Add \`[MOBILE]\` prefix to messages for autonomous lead processing
- System will automatically structure leads and create database entries
- Use \`get_instruction('mobile-mode')\` for full autonomous workflows

## 🔧 Available MCP Servers & Tools
- **prompt-instructions-d1**: Instruction management (this server)
- **travel-research**: Web search and travel information
- **mcp-cpmaxx**: CPMaxx portal automation and hotel search
- **local-image-storage**: Image storage and management
- **hotel-research**: Hotel details and booking research

Use \`/tools [server-name]\` to see tools available on each server.

## 💡 Pro Tips
- Start each session with 'start' to ensure instructions are loaded
- Use 'status' periodically to check system state
- The system automatically loads additional instructions based on confidence levels
- All workflows include commission tracking and Kim's Gems integration

Need specific help with any workflow? Just ask: "How do I [task]?" and I'll load the appropriate instructions.`;

			return {
				content: [{
					type: "text",
					text: helpMessage
				}]
			};
		}
	);
}