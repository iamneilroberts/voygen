/**
 * Token Pricing Utility
 * Feature: 002-librechat-interface-modifications
 *
 * Provides model pricing lookup and cost calculation for AI token usage.
 * Pricing data sourced from research.md section 6 (2025-01 rates).
 */

export interface ModelPricing {
  modelId: string;
  modelName: string;
  inputPricePer1M: number;  // USD per 1 million input tokens
  outputPricePer1M: number; // USD per 1 million output tokens
}

/**
 * Model pricing lookup table
 * Prices are per 1 million tokens in USD
 * Last updated: 2025-01
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet-20241022': {
    modelId: 'claude-3-5-sonnet-20241022',
    modelName: 'Claude 3.5 Sonnet',
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
  },
  'claude-3-5-haiku-20241022': {
    modelId: 'claude-3-5-haiku-20241022',
    modelName: 'Claude 3.5 Haiku',
    inputPricePer1M: 0.80,
    outputPricePer1M: 4.00,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    inputPricePer1M: 5.00,
    outputPricePer1M: 15.00,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    modelName: 'GPT-4o Mini',
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
  },
};

/**
 * Calculate cost for token usage
 *
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @param modelId - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
 * @returns Cost in USD, rounded to 6 decimal places
 *
 * @example
 * calculateCost(5000, 1500, 'claude-3-5-sonnet-20241022')
 * // Returns: 0.0375
 * // Calculation: (5000/1M * $3) + (1500/1M * $15) = $0.015 + $0.0225 = $0.0375
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId];

  if (!pricing) {
    console.warn(`Pricing not found for model: ${modelId}. Returning $0.00`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  return parseFloat((inputCost + outputCost).toFixed(6));
}

/**
 * Get human-readable model name from model ID
 *
 * @param modelId - Model identifier
 * @returns Human-readable model name or original ID if not found
 */
export function getModelName(modelId: string): string {
  return MODEL_PRICING[modelId]?.modelName || modelId;
}

/**
 * Check if pricing exists for a given model
 *
 * @param modelId - Model identifier
 * @returns true if pricing data exists
 */
export function hasPricing(modelId: string): boolean {
  return modelId in MODEL_PRICING;
}
