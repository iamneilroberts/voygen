/**
 * MCP Progress Tracking Integration
 * Feature: 002-librechat-interface-modifications (Phase 4, T019)
 *
 * Hooks into MCP tool execution to update trip progress in real-time.
 */

const { logger } = require('@librechat/data-schemas');
const { updateTripProgress } = require('~/server/utils/updateTripProgress');

/**
 * Tool name to progress mapping
 * Maps MCP tool calls to workflow phases and steps
 */
const PROGRESS_MAP = {
  // Research phase (0-20%)
  'search_destinations': { phase: 'Research', step: 1, totalSteps: 4 },
  'analyze_requirements': { phase: 'Research', step: 2, totalSteps: 4 },
  'compile_research': { phase: 'Research', step: 3, totalSteps: 4 },
  'create_trip': { phase: 'Research', step: 4, totalSteps: 4 },

  // Hotels phase (20-40%)
  'search_hotels': { phase: 'Hotels', step: 1, totalSteps: 5 },
  'compare_rates': { phase: 'Hotels', step: 2, totalSteps: 5 },
  'select_hotel': { phase: 'Hotels', step: 3, totalSteps: 5 },
  'save_hotel': { phase: 'Hotels', step: 4, totalSteps: 5 },
  'finalize_hotels': { phase: 'Hotels', step: 5, totalSteps: 5 },

  // Activities phase (40-60%)
  'search_activities': { phase: 'Activities', step: 1, totalSteps: 6 },
  'plan_itinerary': { phase: 'Activities', step: 2, totalSteps: 6 },
  'add_activity': { phase: 'Activities', step: 3, totalSteps: 6 },
  'optimize_schedule': { phase: 'Activities', step: 4, totalSteps: 6 },
  'add_dining': { phase: 'Activities', step: 5, totalSteps: 6 },
  'finalize_itinerary': { phase: 'Activities', step: 6, totalSteps: 6 },

  // Booking phase (60-80%)
  'prepare_booking': { phase: 'Booking', step: 1, totalSteps: 4 },
  'calculate_commission': { phase: 'Booking', step: 2, totalSteps: 4 },
  'generate_booking_links': { phase: 'Booking', step: 3, totalSteps: 4 },
  'save_booking_info': { phase: 'Booking', step: 4, totalSteps: 4 },

  // Finalization phase (80-100%)
  'generate_proposal': { phase: 'Finalization', step: 1, totalSteps: 3 },
  'publish_document': { phase: 'Finalization', step: 2, totalSteps: 3 },
  'send_to_client': { phase: 'Finalization', step: 3, totalSteps: 3 },
};

/**
 * Extract trip ID from tool arguments
 * @param {Object|string} toolArguments - MCP tool arguments
 * @returns {string|null} Trip ID if found
 */
function extractTripId(toolArguments) {
  if (!toolArguments || typeof toolArguments !== 'object') {
    return null;
  }

  // Check for trip_id (preferred)
  if (toolArguments.trip_id) {
    return toolArguments.trip_id;
  }

  // Fallback to trip_identifier
  if (toolArguments.trip_identifier) {
    return toolArguments.trip_identifier;
  }

  return null;
}

/**
 * Extract cost information from tool result
 * @param {any} result - MCP tool result
 * @returns {Object|null} Cost and commission if found
 */
function extractCostFromResult(result) {
  // Handle array results
  if (Array.isArray(result) && result.length > 0) {
    result = result[0];
  }

  // Handle text content results
  if (result?.type === 'text' && result?.text) {
    try {
      const parsed = JSON.parse(result.text);
      if (parsed.cost || parsed.price) {
        return {
          cost: parsed.cost || parsed.price,
          commission: parsed.commission || (parsed.cost || parsed.price) * 0.10,
        };
      }
    } catch {
      // Not JSON, ignore
    }
  }

  // Handle object results
  if (result && typeof result === 'object') {
    if (result.cost || result.price) {
      return {
        cost: result.cost || result.price,
        commission: result.commission || (result.cost || result.price) * 0.10,
      };
    }
  }

  return null;
}

/**
 * Track progress after MCP tool execution
 * @param {string} toolName - Name of the executed tool
 * @param {Object|string} toolArguments - Tool arguments
 * @param {any} result - Tool execution result
 */
async function trackMCPProgress(toolName, toolArguments, result) {
  try {
    // Check if this tool has progress mapping
    const progress = PROGRESS_MAP[toolName];
    if (!progress) {
      return; // Not a trip-related tool
    }

    // Extract trip ID
    const tripId = extractTripId(toolArguments);
    if (!tripId) {
      logger.debug(`[MCP Progress] ${toolName} executed but no trip_id found`);
      return;
    }

    // Extract cost if available
    const costInfo = extractCostFromResult(result);

    // Update progress
    const updates = {
      phase: progress.phase,
      step: progress.step,
      totalSteps: progress.totalSteps,
      ...costInfo, // Includes cost and commission if found
    };

    await updateTripProgress(tripId, updates);

    logger.info(
      `[MCP Progress] ${tripId} - ${toolName} → ${progress.phase} ${progress.step}/${progress.totalSteps}`
    );
  } catch (error) {
    // Don't fail tool execution if progress tracking fails
    logger.error(`[MCP Progress] Failed to track progress for ${toolName}:`, error.message);
  }
}

/**
 * Wrap MCP tool _call function with progress tracking
 * @param {Function} originalCall - Original _call function
 * @param {string} toolName - Tool name (without server suffix)
 * @returns {Function} Wrapped _call function
 */
function wrapWithProgressTracking(originalCall, toolName) {
  return async function (toolArguments, config) {
    // Execute original tool call
    const result = await originalCall(toolArguments, config);

    // Track progress asynchronously (don't block result)
    trackMCPProgress(toolName, toolArguments, result).catch((err) => {
      logger.error(`[MCP Progress] Async tracking failed for ${toolName}:`, err.message);
    });

    return result;
  };
}

module.exports = {
  trackMCPProgress,
  wrapWithProgressTracking,
  PROGRESS_MAP,
};
