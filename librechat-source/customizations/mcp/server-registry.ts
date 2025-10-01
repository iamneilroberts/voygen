/**
 * MCP Server Registry
 * Feature: 002-librechat-interface-modifications
 *
 * Centralized registry of all Voygent MCP servers with health check URLs.
 * Used for auto-enable configuration and health monitoring.
 */

export interface MCPServerConfig {
  name: string;              // Server identifier (matches librechat.yaml)
  displayName: string;        // Human-readable name for UI
  url: string;                // SSE endpoint URL
  healthEndpoint: string;     // Health check endpoint
  required: boolean;          // Whether server is required for travel agent mode
  autoEnable: boolean;        // Whether to auto-enable on startup
}

/**
 * Registry of all Voygent MCP servers
 * Sourced from apps/librechat/config/librechat.yaml
 */
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'd1_database',
    displayName: 'D1 Database',
    url: 'https://d1-database-prod.somotravel.workers.dev/sse',
    healthEndpoint: 'https://d1-database-prod.somotravel.workers.dev/health',
    required: true,
    autoEnable: true,
  },
  {
    name: 'prompt_instructions',
    displayName: 'Prompt Instructions',
    url: 'https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse',
    healthEndpoint: 'https://prompt-instructions-d1-mcp.somotravel.workers.dev/health',
    required: true,
    autoEnable: true,
  },
  {
    name: 'template_document',
    displayName: 'Template Document',
    url: 'https://template-document-mcp.somotravel.workers.dev/sse',
    healthEndpoint: 'https://template-document-mcp.somotravel.workers.dev/health',
    required: true,
    autoEnable: true,
  },
  {
    name: 'web_fetch',
    displayName: 'Web Fetch',
    url: 'https://web-fetch-mcp.somotravel.workers.dev/sse',
    healthEndpoint: 'https://web-fetch-mcp.somotravel.workers.dev/health',
    required: false,
    autoEnable: true,
  },
  {
    name: 'document_publish',
    displayName: 'Document Publisher',
    url: 'https://document-publish-mcp.somotravel.workers.dev/sse',
    healthEndpoint: 'https://document-publish-mcp.somotravel.workers.dev/health',
    required: false,
    autoEnable: true,
  },
];

/**
 * Get server config by name
 *
 * @param name - Server identifier
 * @returns Server config or undefined if not found
 */
export function getServerConfig(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS.find(server => server.name === name);
}

/**
 * Get all required servers
 *
 * @returns Array of required server configs
 */
export function getRequiredServers(): MCPServerConfig[] {
  return MCP_SERVERS.filter(server => server.required);
}

/**
 * Get all auto-enabled servers
 *
 * @returns Array of auto-enabled server configs
 */
export function getAutoEnabledServers(): MCPServerConfig[] {
  return MCP_SERVERS.filter(server => server.autoEnable);
}

/**
 * Check if all required servers are present in a list
 *
 * @param serverNames - List of server names to check
 * @returns true if all required servers are present
 */
export function hasAllRequiredServers(serverNames: string[]): boolean {
  const required = getRequiredServers();
  return required.every(server => serverNames.includes(server.name));
}
