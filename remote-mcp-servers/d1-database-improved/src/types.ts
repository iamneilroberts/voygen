/**
 * Shared types and interfaces for D1 Travel Database MCP
 */

export interface Env {
	DB: any; // D1Database type not available in all contexts
	MCP_AUTH_KEY: string;
}

export interface DatabaseError {
	attempted_operation: string;
	error_message: string;
	sql_query?: string;
	table_names?: string;
	column_names?: string;
	suggested_tool?: string;
	context?: string;
	session_id?: string;
}

export interface Client {
	id?: number;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	address?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	country: string;
	notes?: string;
	created_at?: string;
	updated_at?: string;
}

export interface Trip {
	id: string;
	trip_name: string;
	destination?: string;
	start_date?: string;
	end_date?: string;
	trip_type?: string;
	status: string;
	trip_cost_total?: number;
	trip_notes?: string;
	created_at?: string;
	updated_at?: string;
}

export interface TripParticipant {
	trip_id: string;
	client_id: number;
	role: string;
	created_at?: string;
}

export interface TripDay {
	id?: number;
	trip_id: string;
	day_number: number;
	date?: string;
	location?: string;
	summary?: string;
}

export interface InstructionSet {
	id?: number;
	name: string;
	title: string;
	content: string;
	category: string;
	active: boolean;
	version: number;
	created_at?: string;
	updated_at?: string;
}

export interface UserPreference {
	id?: number;
	user_id: string;
	preference_type: string;
	preference_value: string;
	created_at?: string;
	updated_at?: string;
}

export interface TravelSearch {
	id?: number;
	search_type: string;
	origin?: string;
	destination?: string;
	departure_date?: string;
	return_date?: string;
	passengers?: number;
	budget_limit?: number;
	search_parameters?: string;
	results_summary?: string;
	user_id?: string;
	created_at?: string;
}

// Tool response type compatible with MCP SDK
export interface ToolResponse {
	[x: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
}

// Verbosity levels
export type VerbosityLevel = 'concise' | 'normal' | 'detailed';

export const VERBOSITY_ICONS = {
	'concise': '🎯',
	'normal': '📋',
	'detailed': '📚'
} as const;

export const VERBOSITY_DESCRIPTIONS = {
	'concise': 'Just the essentials',
	'normal': 'Balanced detail',
	'detailed': 'Comprehensive information'
} as const;