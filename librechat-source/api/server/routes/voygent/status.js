/**
 * Combined Status API Route
 * Feature: 002-librechat-interface-modifications
 *
 * Provides combined status endpoint for efficient polling.
 * Combines token usage, trip progress, and MCP health in single response.
 * Contract: contracts/status-api.yaml
 */

import { Router } from 'express';
import { MCP_SERVERS } from '../../../customizations/mcp/server-registry.ts';

const router = Router();

/**
 * Fetch token usage (reuses logic from token-usage.js)
 */
async function fetchTokenUsage(db, userId, conversationId) {
  try {
    const result = await db.prepare(`
      SELECT
        model,
        input_tokens as inputTokens,
        output_tokens as outputTokens,
        total_tokens as totalTokens,
        approximate,
        cost_usd as price
      FROM token_usage_log
      WHERE ${conversationId ? 'conversation_id = ?' : 'user_id = ?'}
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(conversationId || userId).first();

    if (!result) return null;

    return {
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      approximate: Boolean(result.approximate),
      price: parseFloat(result.price.toFixed(4))
    };
  } catch (error) {
    console.error('Error fetching token usage in status:', error);
    return null;
  }
}

/**
 * Fetch trip progress (reuses logic from trip-progress.js)
 */
async function fetchTripProgress(db, tripId, conversationId) {
  try {
    const result = await db.prepare(`
      SELECT
        trip_id as tripId,
        trip_name as tripName,
        start_date || ' - ' || end_date as dates,
        phase,
        step,
        percent,
        cost,
        budget,
        commission
      FROM trips
      WHERE ${tripId ? 'trip_id = ?' : 'last_updated IS NOT NULL'}
      ORDER BY last_updated DESC
      LIMIT 1
    `).bind(tripId || undefined).first();

    if (!result) return null;

    return {
      tripId: result.tripId,
      tripName: result.tripName,
      dates: result.dates,
      phase: result.phase,
      step: result.step,
      percent: result.percent,
      cost: result.cost,
      budget: result.budget,
      commission: result.commission
    };
  } catch (error) {
    console.error('Error fetching trip progress in status:', error);
    return null;
  }
}

/**
 * Check MCP server health
 */
async function checkMCPHealth() {
  try {
    const healthChecks = await Promise.allSettled(
      MCP_SERVERS.map(async (server) => {
        const startTime = Date.now();
        try {
          const response = await fetch(server.healthEndpoint, {
            method: 'GET',
            timeout: 5000 // 5 second timeout
          });

          const latency = Date.now() - startTime;
          const healthy = response.ok;

          return {
            name: server.name,
            connected: true,
            healthy,
            latency
          };
        } catch (error) {
          return {
            name: server.name,
            connected: false,
            healthy: false,
            error: error.message
          };
        }
      })
    );

    const servers = healthChecks.map(result =>
      result.status === 'fulfilled' ? result.value : {
        name: 'unknown',
        connected: false,
        healthy: false
      }
    );

    // Overall health: all required servers must be healthy
    const requiredServers = MCP_SERVERS.filter(s => s.required).map(s => s.name);
    const healthy = servers
      .filter(s => requiredServers.includes(s.name))
      .every(s => s.healthy);

    return { healthy, servers };
  } catch (error) {
    console.error('Error checking MCP health in status:', error);
    return { healthy: false, servers: [] };
  }
}

/**
 * GET /api/voygent/status
 *
 * Returns combined status data for efficient polling.
 *
 * Query Parameters:
 *   - conversationId (optional): Context for filtering
 *   - include (optional): Comma-separated list (tokens, progress, mcp)
 *
 * Responses:
 *   - 200: Status data found
 *   - 204: No status data available
 *   - 500: Server error
 */
router.get('/status', async (req, res) => {
  const { conversationId, include } = req.query;

  // Parse include parameter
  const includeList = include ? include.split(',').map(s => s.trim()) : ['tokens', 'progress', 'mcp'];
  const includeTokens = includeList.includes('tokens');
  const includeProgress = includeList.includes('progress');
  const includeMCP = includeList.includes('mcp');

  try {
    const db = req.app.locals.db;
    const userId = req.user?.id;

    const response = { ok: true };

    // Fetch data in parallel where possible
    const [tokens, progress, mcp] = await Promise.all([
      includeTokens ? fetchTokenUsage(db, userId, conversationId) : null,
      includeProgress ? fetchTripProgress(db, null, conversationId) : null,
      includeMCP ? checkMCPHealth() : null
    ]);

    // Add to response if data exists
    if (tokens) response.tokens = tokens;
    if (progress) response.progress = progress;
    if (mcp) response.mcp = mcp;

    // Return 204 if no data at all
    if (!tokens && !progress && !mcp) {
      return res.status(204).send();
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching combined status:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch status',
      code: 'STATUS_FETCH_ERROR'
    });
  }
});

export default router;
