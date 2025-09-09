/**
 * Type definitions and validation schemas for the Voygen Mobile API
 */

import { z } from 'zod';

export interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
  PUBLISH_MCP_URL: string;
  PUBLISH_MCP_TOKEN: string;
  PUBLISH_TEMPLATE: string;
  SITE_BASE_URL: string;
  ANTHROPIC_API_KEY?: string;
  CHAT_MCP_URL?: string;
  CHAT_MCP_TOKEN?: string;
  MCP_AUTH_KEY?: string;
}

export interface AuthResult {
  success: boolean;
  owner?: string;
  error?: string;
}

export interface Trip {
  trip_id: number;
  trip_name: string;
  status: string;
  start_date: string;
  end_date: string;
  destinations: string;
  total_cost?: number;
  paid_amount?: number;
  primary_client_email?: string;
  group_name?: string;
  created_at: string;
  updated_at: string;
  clients?: string;
  schedule?: string;
  accommodations?: string;
  transportation?: string;
  financials?: string;
  documents?: string;
  notes?: string;
}

// Validation schemas
export const TripCreateSchema = z.object({
  trip_name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  destinations: z.string().optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  owner: z.string().min(1),
  data: z.record(z.any()).optional()
});

export const TripUpdateSchema = z.object({
  trip_name: z.string().min(1).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  destinations: z.string().optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  data: z.record(z.any()).optional()
});

export type TripCreateData = z.infer<typeof TripCreateSchema>;
export type TripUpdateData = z.infer<typeof TripUpdateSchema>;