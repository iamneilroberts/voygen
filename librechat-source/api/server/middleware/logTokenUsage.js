/**
 * Token Usage Logging Middleware
 * Feature: 002-librechat-interface-modifications
 *
 * Extracts token metadata from AI responses and logs to database.
 * Called after each AI interaction completes.
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

/**
 * Log token usage to voygent API
 *
 * @param {Object} params - Logging parameters
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.userId - User ID
 * @param {string} params.model - Model identifier
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @param {boolean} params.approximate - Whether counts are approximate
 */
async function logTokenUsage({ conversationId, userId, model, inputTokens, outputTokens, approximate = false }) {
  try {
    // Call our voygent token-usage API
    await axios.post('http://localhost:3080/api/voygent/token-usage/log', {
      conversationId,
      userId,
      model,
      inputTokens,
      outputTokens,
      approximate,
    }, {
      timeout: 5000,
    });

    logger.debug(`Token usage logged: ${inputTokens} in + ${outputTokens} out for ${model}`);
  } catch (error) {
    // Log error but don't fail the response
    logger.error('Failed to log token usage:', error.message);
  }
}

/**
 * Extract token counts from Anthropic API response
 */
function extractAnthropicTokens(responseData) {
  if (responseData?.usage) {
    return {
      inputTokens: responseData.usage.input_tokens || 0,
      outputTokens: responseData.usage.output_tokens || 0,
      approximate: false,
    };
  }
  return null;
}

/**
 * Extract token counts from OpenAI API response
 */
function extractOpenAITokens(responseData) {
  if (responseData?.usage) {
    return {
      inputTokens: responseData.usage.prompt_tokens || 0,
      outputTokens: responseData.usage.completion_tokens || 0,
      approximate: false,
    };
  }
  return null;
}

/**
 * Middleware to log token usage after AI response
 *
 * Usage:
 *   app.use('/api/ask', logTokenUsageMiddleware);
 */
function logTokenUsageMiddleware(req, res, next) {
  // Store the original res.json function
  const originalJson = res.json.bind(res);

  // Override res.json to intercept response
  res.json = function(data) {
    // Try to extract token information
    let tokens = null;

    // Check for Anthropic response format
    if (data?.usage?.input_tokens) {
      tokens = extractAnthropicTokens(data);
    }
    // Check for OpenAI response format
    else if (data?.usage?.prompt_tokens) {
      tokens = extractOpenAITokens(data);
    }

    // Log if we found token data
    if (tokens && req.user?.id) {
      logTokenUsage({
        conversationId: req.body?.conversationId || data?.conversationId,
        userId: req.user.id,
        model: req.body?.model || data?.model || 'unknown',
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        approximate: tokens.approximate,
      }).catch(err => {
        logger.error('Token logging failed:', err);
      });
    }

    // Call original res.json
    return originalJson(data);
  };

  next();
}

module.exports = {
  logTokenUsage,
  logTokenUsageMiddleware,
  extractAnthropicTokens,
  extractOpenAITokens,
};
