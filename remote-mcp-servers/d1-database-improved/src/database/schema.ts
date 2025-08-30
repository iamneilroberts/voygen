/**
 * Database schema initialization for D1 Travel Database
 */

import { Env } from '../types';

export class SchemaInitializer {
	constructor(private env: Env) {}

	/**
	 * Initialize all database tables
	 */
	async initializeSchema(): Promise<boolean> {
		try {
			// Create the error logging table first
			await this.createErrorLoggingTable();

			// Create core tables
			await this.createCoreTables();

			// Create instruction tables
			await this.createInstructionTables();

			console.log("Database schema initialized successfully");
			return true;
		} catch (error) {
			console.error("Failed to initialize schema:", error);
			return false;
		}
	}

	/**
	 * Create error logging table for tracking database issues
	 */
	async createErrorLoggingTable(): Promise<void> {
		try {
			await this.env.DB.prepare(`
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
			await this.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_timestamp ON db_errors(error_timestamp)").run();
			await this.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_operation ON db_errors(attempted_operation)").run();
			await this.env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_db_errors_resolved ON db_errors(resolved)").run();
			
			console.log("Error logging table created successfully");
		} catch (error) {
			console.error("Failed to create error logging table:", error);
		}
	}

	/**
	 * Create core travel management tables
	 */
	private async createCoreTables(): Promise<void> {
		// Clients table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS Clients (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				email TEXT,
				phone TEXT,
				address TEXT,
				city TEXT,
				state TEXT,
				postal_code TEXT,
				country TEXT DEFAULT 'United States',
				notes TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		// Trips table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS Trips (
				id TEXT PRIMARY KEY,
				trip_name TEXT NOT NULL,
				destination TEXT,
				start_date TEXT,
				end_date TEXT,
				trip_type TEXT DEFAULT 'leisure',
				status TEXT DEFAULT 'planning',
				trip_cost_total REAL DEFAULT 0,
				trip_notes TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		// TripParticipants table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS TripParticipants (
				trip_id TEXT NOT NULL,
				client_id INTEGER NOT NULL,
				role TEXT DEFAULT 'participant',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (trip_id, client_id),
				FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE,
				FOREIGN KEY (client_id) REFERENCES Clients(id) ON DELETE CASCADE
			)
		`).run();

		// TripDays table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS TripDays (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				trip_id TEXT NOT NULL,
				day_number INTEGER NOT NULL,
				date TEXT,
				location TEXT,
				summary TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
			)
		`).run();

		// ActivityLog table for tracking user activities
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS ActivityLog (
				activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id TEXT NOT NULL,
				client_id INTEGER,
				trip_id TEXT,
				activity_type TEXT NOT NULL,
				activity_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
				details TEXT,
				FOREIGN KEY (client_id) REFERENCES Clients(id) ON DELETE SET NULL,
				FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE SET NULL
			)
		`).run();

		// Legacy travel_searches table for backward compatibility
		await this.env.DB.prepare(`
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

		// User preferences table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS user_preferences (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				preference_type TEXT NOT NULL,
				preference_value TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();
	}

	/**
	 * Create instruction-related tables
	 */
	private async createInstructionTables(): Promise<void> {
		// Instruction sets table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS instruction_sets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE,
				title TEXT NOT NULL,
				content TEXT NOT NULL,
				category TEXT DEFAULT 'general',
				active BOOLEAN DEFAULT 1,
				version INTEGER DEFAULT 1,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		// Commission config table
		await this.env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS commission_config (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				config_key TEXT UNIQUE NOT NULL,
				config_value TEXT NOT NULL,
				description TEXT,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();
	}

	/**
	 * Check if database is initialized
	 */
	async isDatabaseInitialized(): Promise<boolean> {
		try {
			await this.env.DB.prepare("SELECT 1 FROM Clients LIMIT 1").run();
			return true;
		} catch (error) {
			return false;
		}
	}
}