/**
 * Database manager for handling initialization and error logging
 */

import { Env, DatabaseError, ToolResponse } from '../types';
import { SchemaInitializer } from './schema';

export class DatabaseManager {
	private isInitialized = false;
	private initializationPromise: Promise<boolean> | null = null;
	private schemaInitializer: SchemaInitializer;

	constructor(private env: Env) {
		this.schemaInitializer = new SchemaInitializer(env);
	}

	/**
	 * Ensure database is initialized before any operation
	 */
	async ensureInitialized(): Promise<boolean> {
		if (this.isInitialized) {
			return true;
		}

		// Prevent multiple concurrent initialization attempts
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.checkAndInitialize();
		const result = await this.initializationPromise;
		this.isInitialized = result;
		this.initializationPromise = null;
		return result;
	}

	/**
	 * Check if database is initialized and initialize if needed
	 */
	private async checkAndInitialize(): Promise<boolean> {
		try {
			// Check if database is already initialized
			const initialized = await this.schemaInitializer.isDatabaseInitialized();
			
			if (initialized) {
				console.log("Database already initialized");
				// Ensure error logging table exists
				await this.schemaInitializer.createErrorLoggingTable();
				return true;
			}

			console.log("Database check failed, initializing schema...");
			return await this.schemaInitializer.initializeSchema();
		} catch (error) {
			console.error("Database initialization check failed:", error);
			return false;
		}
	}

	/**
	 * Log database error for future improvement
	 */
	async logDatabaseError(errorInfo: DatabaseError): Promise<void> {
		try {
			await this.env.DB.prepare(`
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

	/**
	 * Create a standard error response
	 */
	createErrorResponse(message: string): ToolResponse {
		return {
			content: [{
				type: "text",
				text: `❌ ${message}`
			}]
		};
	}

	/**
	 * Create a standard success response
	 */
	createSuccessResponse(message: string): ToolResponse {
		return {
			content: [{
				type: "text",
				text: `✅ ${message}`
			}]
		};
	}

	/**
	 * Create initialization failed response
	 */
	createInitFailedResponse(): ToolResponse {
		return {
			content: [{
				type: "text",
				text: "❌ Database initialization failed. Please check configuration."
			}]
		};
	}
}