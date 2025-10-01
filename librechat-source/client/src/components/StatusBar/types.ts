/**
 * StatusBar Component Type Definitions
 * Feature: 002-librechat-interface-modifications
 *
 * Type definitions for StatusBar and MCP status indicator components.
 * Contract: data-model.md section 5
 */

import { StatusVerbosity, StatusMode } from '../../store/voygent';

/**
 * StatusBar Component Props
 */
export interface StatusBarProps {
  // Optional prop overrides
  forceMode?: StatusMode;       // Force display mode (overrides user preference)
  verbosity?: StatusVerbosity;  // Force verbosity level (overrides user preference)
  className?: string;           // Additional CSS classes
}

/**
 * Combined Status Payload from API
 * Matches: GET /api/voygent/status response
 */
export interface StatusPayload {
  ok?: boolean;

  // Token usage fields
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  approximate?: boolean;
  price?: number;

  // Trip progress fields
  tripId?: string;
  tripName?: string;
  dates?: string;
  phase?: string;
  step?: number;
  totalSteps?: number;
  percent?: number;
  cost?: number;
  budget?: number;
  commission?: number;
  url?: string;
}

/**
 * MCP Status Indicator Component Props
 */
export interface MCPStatusIndicatorProps {
  mode: 'minimal' | 'detailed' | 'hidden';  // Display mode
  showLatency?: boolean;                     // Show latency measurements
  refreshInterval?: number;                  // Polling interval in milliseconds (default: 30000)
}

/**
 * Individual MCP Server Health Status
 */
export interface MCPServerHealth {
  name: string;
  displayName: string;
  connected: boolean;
  healthy: boolean;
  latency?: number;
  lastCheck: number;
  error?: string;
}

/**
 * MCP Health API Response
 * Matches: GET /api/voygent/mcp-health response
 */
export interface MCPHealthResponse {
  ok: boolean;
  healthy: boolean;
  servers: Array<{
    name: string;
    url: string;
    connected: boolean;
    healthy: boolean;
    latency?: number;
    lastCheck: number;
    error?: string;
  }>;
}

/**
 * Token Usage API Response
 * Matches: GET /api/voygent/token-usage response
 */
export interface TokenUsageResponse {
  ok: boolean;
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    approximate: boolean;
    price: number;
    conversationId?: string;
    timestamp: number;
  };
}

/**
 * Trip Progress API Response
 * Matches: GET /api/voygent/trip-progress response
 */
export interface TripProgressResponse {
  ok: boolean;
  progress?: {
    tripId: string;
    tripName: string;
    dates?: string;
    phase: 'Research' | 'Hotels' | 'Activities' | 'Booking' | 'Finalization';
    step: number;
    totalSteps: number;
    percent: number;
    cost: number;
    budget: number;
    commission?: number;
    url?: string;
    lastUpdated: number;
  };
}

/**
 * Status API Response (Combined)
 * Matches: GET /api/voygent/status response
 */
export interface StatusAPIResponse {
  ok: boolean;
  tokens?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
    approximate: boolean;
    price: number;
  };
  progress?: {
    tripId?: string;
    tripName: string;
    dates?: string;
    phase: string;
    step?: number;
    percent: number;
    cost?: number;
    budget?: number;
    commission?: number;
    url?: string;
  };
  mcp?: {
    healthy: boolean;
    servers: Array<{
      name: string;
      connected: boolean;
      healthy: boolean;
      latency?: number;
    }>;
  };
}
