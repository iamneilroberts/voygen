/**
 * Token Usage API Route
 * Feature: 002-librechat-interface-modifications
 *
 * Provides token usage metrics for conversations and sessions.
 * Contract: contracts/token-usage-api.yaml
 */

import { Router } from 'express';
import { calculateCost } from '../../../customizations/pricing/model-pricing.ts';

const router = Router();

/**
 * GET /api/voygent/token-usage
 *
 * Returns token usage metrics for a conversation or cumulative session.
 *
 * Query Parameters:
 *   - conversationId (optional): Specific conversation to query
 *   - cumulative (optional): Return cumulative session usage
 *
 * Responses:
 *   - 200: Token usage data found
 *   - 204: No usage data available
 *   - 400: Invalid parameters
 *   - 500: Server error
 */
router.get('/token-usage', async (req, res) => {
  const { conversationId, cumulative } = req.query;

  try {
    // TODO: Replace with actual database query
    // This is a placeholder implementation
    const db = req.app.locals.db; // Assuming D1 database is available on app.locals

    let usage;

    if (cumulative === 'true') {
      // Get cumulative usage for user's session
      const userId = req.user?.id; // Assuming auth middleware sets req.user

      if (!userId) {
        return res.status(400).json({
          ok: false,
          error: 'User authentication required for cumulative usage',
          code: 'AUTH_REQUIRED'
        });
      }

      const result = await db.prepare(`
        SELECT
          model,
          SUM(input_tokens) as inputTokens,
          SUM(output_tokens) as outputTokens,
          SUM(total_tokens) as totalTokens,
          SUM(cost_usd) as price,
          MAX(created_at) as timestamp
        FROM token_usage_log
        WHERE user_id = ?
        AND created_at > ?
        GROUP BY model
        ORDER BY timestamp DESC
        LIMIT 1
      `).bind(userId, Date.now() - 86400000).first(); // Last 24 hours

      if (result) {
        usage = {
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          approximate: true,
          price: parseFloat(result.price.toFixed(4)),
          timestamp: result.timestamp
        };
      }
    } else if (conversationId) {
      // Get usage for specific conversation
      const result = await db.prepare(`
        SELECT
          model,
          input_tokens as inputTokens,
          output_tokens as outputTokens,
          total_tokens as totalTokens,
          approximate,
          cost_usd as price,
          conversation_id as conversationId,
          created_at as timestamp
        FROM token_usage_log
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(conversationId).first();

      if (result) {
        usage = {
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          approximate: Boolean(result.approximate),
          price: parseFloat(result.price.toFixed(4)),
          conversationId: result.conversationId,
          timestamp: result.timestamp
        };
      }
    } else {
      // Get most recent usage for user
      const userId = req.user?.id;

      if (!userId) {
        return res.status(204).send();
      }

      const result = await db.prepare(`
        SELECT
          model,
          input_tokens as inputTokens,
          output_tokens as outputTokens,
          total_tokens as totalTokens,
          approximate,
          cost_usd as price,
          conversation_id as conversationId,
          created_at as timestamp
        FROM token_usage_log
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(userId).first();

      if (result) {
        usage = {
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          approximate: Boolean(result.approximate),
          price: parseFloat(result.price.toFixed(4)),
          conversationId: result.conversationId,
          timestamp: result.timestamp
        };
      }
    }

    if (!usage) {
      return res.status(204).send();
    }

    res.json({ ok: true, usage });
  } catch (error) {
    console.error('Error fetching token usage:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch token usage',
      code: 'USAGE_FETCH_ERROR'
    });
  }
});

/**
 * POST /api/voygent/token-usage/log
 *
 * Logs token usage for an AI interaction.
 * Called by middleware after each AI response.
 *
 * Body:
 *   - conversationId: string (required)
 *   - userId: string (required)
 *   - model: string (required)
 *   - inputTokens: number (required)
 *   - outputTokens: number (required)
 *   - approximate: boolean (optional)
 *
 * Responses:
 *   - 201: Usage logged successfully
 *   - 400: Invalid request body
 *   - 500: Server error
 */
router.post('/token-usage/log', async (req, res) => {
  const { conversationId, userId, model, inputTokens, outputTokens, approximate = false } = req.body;

  // Validation
  if (!conversationId || !userId || !model || inputTokens == null || outputTokens == null) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: conversationId, userId, model, inputTokens, outputTokens',
      code: 'INVALID_REQUEST'
    });
  }

  try {
    const db = req.app.locals.db;

    // Calculate cost
    const cost = calculateCost(inputTokens, outputTokens, model);
    const totalTokens = inputTokens + outputTokens;
    const timestamp = Date.now();
    const id = `log_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert into database
    await db.prepare(`
      INSERT INTO token_usage_log (
        id, conversation_id, user_id, model,
        input_tokens, output_tokens, total_tokens,
        cost_usd, approximate, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, conversationId, userId, model,
      inputTokens, outputTokens, totalTokens,
      cost, approximate ? 1 : 0, timestamp
    ).run();

    res.status(201).json({
      ok: true,
      id,
      price: parseFloat(cost.toFixed(4))
    });
  } catch (error) {
    console.error('Error logging token usage:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to log token usage',
      code: 'LOGGING_ERROR'
    });
  }
});

export default router;
