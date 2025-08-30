/**
 * Error logging utilities for database operations
 */

import { Env, DatabaseError } from '../types';

export class ErrorLogger {
	constructor(private env: Env) {}

	/**
	 * Log a database error with context
	 */
	async logError(errorInfo: DatabaseError): Promise<void> {
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
	 * Log error from tool execution
	 */
	async logToolError(
		toolName: string, 
		error: any, 
		context?: string,
		suggestedTool?: string
	): Promise<void> {
		await this.logError({
			attempted_operation: toolName,
			error_message: error.message || "Unknown error",
			context,
			suggested_tool: suggestedTool || toolName
		});
	}

	/**
	 * Get unresolved errors count
	 */
	async getUnresolvedErrorCount(): Promise<number> {
		try {
			const result = await this.env.DB.prepare(
				"SELECT COUNT(*) as count FROM db_errors WHERE resolved = 0"
			).first();
			return result?.count || 0;
		} catch (error) {
			console.error("Failed to get error count:", error);
			return 0;
		}
	}

	/**
	 * Mark an error as resolved
	 */
	async resolveError(errorId: number, resolution: string): Promise<void> {
		try {
			await this.env.DB.prepare(`
				UPDATE db_errors 
				SET resolved = 1, resolution = ? 
				WHERE id = ?
			`).bind(resolution, errorId).run();
		} catch (error) {
			console.error("Failed to resolve error:", error);
		}
	}
}