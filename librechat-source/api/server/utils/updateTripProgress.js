/**
 * Trip Progress Update Utility
 * Feature: 002-librechat-interface-modifications
 *
 * Updates trip planning progress fields in D1 database.
 * Calculates completion percentage based on workflow phase and step.
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

/**
 * Phase weight mapping for percentage calculation
 * Matches data-model.md section 3: Trip Progress Indicator
 */
const PHASE_WEIGHTS = {
  Research: { start: 0, end: 20, totalSteps: 4 },
  Hotels: { start: 20, end: 40, totalSteps: 5 },
  Activities: { start: 40, end: 60, totalSteps: 6 },
  Booking: { start: 60, end: 80, totalSteps: 4 },
  Finalization: { start: 80, end: 100, totalSteps: 3 },
};

/**
 * Calculate completion percentage based on phase and step
 *
 * @param {string} phase - Current workflow phase
 * @param {number} step - Current step within phase (0-based)
 * @param {number} totalSteps - Total steps in phase
 * @returns {number} Completion percentage (0-100)
 *
 * @example
 * calculatePercent('Hotels', 3, 5) // Returns 32
 * // Hotels phase: 20-40% range
 * // Step 3 of 5 = 60% through phase
 * // 20 + (40-20) * (3/5) = 20 + 12 = 32%
 */
function calculatePercent(phase, step, totalSteps) {
  const weights = PHASE_WEIGHTS[phase];
  if (!weights) {
    logger.warn(`Unknown phase: ${phase}`);
    return 0;
  }

  const phaseRange = weights.end - weights.start;
  const stepProgress = (step / totalSteps) * phaseRange;

  return Math.round(weights.start + stepProgress);
}

/**
 * Update trip progress via API
 *
 * @param {string} tripId - Trip identifier
 * @param {Object} updates - Progress updates
 * @param {string} updates.phase - Current phase (Research, Hotels, Activities, Booking, Finalization)
 * @param {number} updates.step - Current step within phase
 * @param {number} updates.totalSteps - Total steps in phase
 * @param {number} updates.cost - Current trip cost
 * @param {number} updates.commission - Estimated commission
 * @returns {Promise<Object>} Updated progress with calculated percent
 */
async function updateTripProgress(tripId, updates) {
  try {
    const response = await axios.post(
      'http://localhost:3080/api/voygent/trip-progress/update',
      {
        tripId,
        ...updates,
      },
      {
        timeout: 5000,
      }
    );

    const percent = response.data.percent;
    logger.debug(
      `Trip progress updated: ${tripId} - ${updates.phase} (${updates.step}/${updates.totalSteps}) = ${percent}%`
    );

    return { ok: true, percent };
  } catch (error) {
    logger.error('Failed to update trip progress:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Update progress directly (when DB client is available)
 *
 * @param {Object} db - D1 database client
 * @param {string} tripId - Trip identifier
 * @param {Object} updates - Progress updates
 */
async function updateTripProgressDirect(db, tripId, updates) {
  try {
    const { phase, step, totalSteps, cost, commission } = updates;

    // Calculate percentage
    let percent = null;
    if (phase && step != null && totalSteps != null) {
      percent = calculatePercent(phase, step, totalSteps);
    }

    // Build update query
    const fields = [];
    const values = [];

    if (phase) {
      fields.push('phase = ?');
      values.push(phase);
    }
    if (step != null) {
      fields.push('step = ?');
      values.push(step);
    }
    if (totalSteps != null) {
      fields.push('total_steps = ?');
      values.push(totalSteps);
    }
    if (percent != null) {
      fields.push('percent = ?');
      values.push(percent);
    }
    if (cost != null) {
      fields.push('cost = ?');
      values.push(cost);
    }
    if (commission != null) {
      fields.push('commission = ?');
      values.push(commission);
    }

    // Always update timestamp
    const timestamp = Date.now();
    fields.push('last_updated = ?');
    values.push(timestamp);

    values.push(tripId); // WHERE clause

    await db
      .prepare(`UPDATE trips SET ${fields.join(', ')} WHERE trip_id = ?`)
      .bind(...values)
      .run();

    logger.debug(`Trip progress updated (direct): ${tripId} = ${percent}%`);
    return { ok: true, percent };
  } catch (error) {
    logger.error('Failed to update trip progress (direct):', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Advance trip to next phase
 *
 * @param {string} tripId - Trip identifier
 * @param {string} currentPhase - Current phase
 * @returns {Promise<Object>} Updated progress
 */
async function advanceToNextPhase(tripId, currentPhase) {
  const phaseOrder = ['Research', 'Hotels', 'Activities', 'Booking', 'Finalization'];
  const currentIndex = phaseOrder.indexOf(currentPhase);

  if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
    logger.warn(`Cannot advance from phase: ${currentPhase}`);
    return { ok: false, error: 'Invalid or final phase' };
  }

  const nextPhase = phaseOrder[currentIndex + 1];
  const nextPhaseSteps = PHASE_WEIGHTS[nextPhase].totalSteps;

  return updateTripProgress(tripId, {
    phase: nextPhase,
    step: 0,
    totalSteps: nextPhaseSteps,
  });
}

/**
 * Mark trip as complete
 *
 * @param {string} tripId - Trip identifier
 * @returns {Promise<Object>} Updated progress
 */
async function markTripComplete(tripId) {
  return updateTripProgress(tripId, {
    phase: 'Finalization',
    step: 3,
    totalSteps: 3,
  });
}

module.exports = {
  calculatePercent,
  updateTripProgress,
  updateTripProgressDirect,
  advanceToNextPhase,
  markTripComplete,
  PHASE_WEIGHTS,
};
