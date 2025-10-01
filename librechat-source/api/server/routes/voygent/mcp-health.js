/**
 * MCP Health Check API Route
 * Feature: 002-librechat-interface-modifications
 *
 * Provides health status for all MCP servers.
 * Contract: contracts/status-api.yaml (MCPHealthResponse)
 */

import { Router } from 'express';
import { MCP_SERVERS, getRequiredServers } from '../../../customizations/mcp/server-registry.ts';

const router = Router();

/**
 * Health check a single MCP server
 *
 * @param server - MCP server config
 * @returns Health status object
 */
async function checkServerHealth(server) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(server.healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    const latency = Date.now() - startTime;
    const healthy = response.ok;
    const lastCheck = Date.now();

    return {
      name: server.name,
      url: server.url,
      connected: true,
      healthy,
      latency,
      lastCheck
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      name: server.name,
      url: server.url,
      connected: false,
      healthy: false,
      latency,
      lastCheck: Date.now(),
      error: error.name === 'AbortError' ? 'Health check timeout' : error.message
    };
  }
}

/**
 * GET /api/voygent/mcp-health
 *
 * Returns health status for all configured MCP servers.
 *
 * Responses:
 *   - 200: Health check completed
 *   - 500: Health check failed
 */
router.get('/mcp-health', async (req, res) => {
  try {
    // Check all servers in parallel
    const healthPromises = MCP_SERVERS.map(server => checkServerHealth(server));
    const servers = await Promise.all(healthPromises);

    // Determine overall health
    // All required servers must be healthy for overall health = true
    const requiredServerNames = getRequiredServers().map(s => s.name);
    const healthy = servers
      .filter(s => requiredServerNames.includes(s.name))
      .every(s => s.healthy);

    res.json({
      ok: true,
      healthy,
      servers
    });
  } catch (error) {
    console.error('Error during MCP health check:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'MCP health check failed',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

export default router;
