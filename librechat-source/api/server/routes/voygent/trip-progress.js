/**
 * Trip Progress API Route
 * Feature: 002-librechat-interface-modifications
 *
 * Provides trip planning progress tracking.
 * Contract: contracts/trip-progress-api.yaml
 */

import { Router } from 'express';

const router = Router();

/**
 * Phase weight mapping for percentage calculation
 * Matches data-model.md section 3: Trip Progress Indicator
 */
const PHASE_WEIGHTS = {
  Research: { start: 0, end: 20, totalSteps: 4 },
  Hotels: { start: 20, end: 40, totalSteps: 5 },
  Activities: { start: 40, end: 60, totalSteps: 6 },
  Booking: { start: 60, end: 80, totalSteps: 4 },
  Finalization: { start: 80, end: 100, totalSteps: 3 }
};

/**
 * Calculate completion percentage based on phase and step
 *
 * @param phase - Current workflow phase
 * @param step - Current step within phase
 * @param totalSteps - Total steps in phase
 * @returns Completion percentage (0-100)
 */
function calculatePercent(phase, step, totalSteps) {
  const weights = PHASE_WEIGHTS[phase];
  if (!weights) return 0;

  const phaseRange = weights.end - weights.start;
  const stepProgress = (step / totalSteps) * phaseRange;

  return Math.round(weights.start + stepProgress);
}

/**
 * GET /api/voygent/trip-progress
 *
 * Returns trip planning progress for an active trip.
 *
 * Query Parameters:
 *   - tripId (optional): Specific trip ID
 *   - conversationId (optional): Auto-detect trip from conversation
 *
 * Responses:
 *   - 200: Progress data found
 *   - 204: No active trip in progress
 *   - 404: Trip not found
 *   - 500: Server error
 */
router.get('/trip-progress', async (req, res) => {
  const { tripId, conversationId } = req.query;

  try {
    const db = req.app.locals.db;
    let result;

    if (tripId) {
      // Query by specific trip ID
      result = await db.prepare(`
        SELECT
          trip_id as tripId,
          trip_name as tripName,
          start_date || ' - ' || end_date as dates,
          phase,
          step,
          total_steps as totalSteps,
          percent,
          cost,
          budget,
          commission,
          last_updated as lastUpdated
        FROM trips
        WHERE trip_id = ?
        LIMIT 1
      `).bind(tripId).first();

      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Trip not found',
          code: 'TRIP_NOT_FOUND'
        });
      }
    } else if (conversationId) {
      // Auto-detect trip from conversation context
      // TODO: Implement conversation -> trip mapping
      // For now, return most recent trip
      result = await db.prepare(`
        SELECT
          trip_id as tripId,
          trip_name as tripName,
          start_date || ' - ' || end_date as dates,
          phase,
          step,
          total_steps as totalSteps,
          percent,
          cost,
          budget,
          commission,
          last_updated as lastUpdated
        FROM trips
        ORDER BY last_updated DESC
        LIMIT 1
      `).first();
    } else {
      // No trip specified
      return res.status(204).send();
    }

    if (!result) {
      return res.status(204).send();
    }

    // Build progress payload
    const progress = {
      tripId: result.tripId,
      tripName: result.tripName,
      dates: result.dates,
      phase: result.phase,
      step: result.step,
      totalSteps: result.totalSteps,
      percent: result.percent,
      cost: result.cost,
      budget: result.budget,
      commission: result.commission,
      lastUpdated: result.lastUpdated
    };

    // Add URL if trip is published
    // TODO: Check if trip has published document
    // progress.url = `https://somotravel.us/${result.tripId}.html`;

    res.json({ ok: true, progress });
  } catch (error) {
    console.error('Error fetching trip progress:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch trip progress',
      code: 'PROGRESS_FETCH_ERROR'
    });
  }
});

/**
 * POST /api/voygent/trip-progress/update
 *
 * Updates trip progress (called by MCP servers or workflow engine).
 *
 * Body:
 *   - tripId: string (required)
 *   - phase: string (optional)
 *   - step: number (optional)
 *   - totalSteps: number (optional)
 *   - cost: number (optional)
 *   - commission: number (optional)
 *
 * Responses:
 *   - 200: Progress updated
 *   - 400: Invalid request
 *   - 404: Trip not found
 *   - 500: Server error
 */
router.post('/trip-progress/update', async (req, res) => {
  const { tripId, phase, step, totalSteps, cost, commission } = req.body;

  if (!tripId) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required field: tripId',
      code: 'INVALID_REQUEST'
    });
  }

  try {
    const db = req.app.locals.db;

    // Check if trip exists
    const trip = await db.prepare('SELECT trip_id FROM trips WHERE trip_id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return res.status(404).json({
        ok: false,
        error: 'Trip not found',
        code: 'TRIP_NOT_FOUND'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (phase) {
      updates.push('phase = ?');
      values.push(phase);
    }
    if (step != null) {
      updates.push('step = ?');
      values.push(step);
    }
    if (totalSteps != null) {
      updates.push('total_steps = ?');
      values.push(totalSteps);
    }
    if (cost != null) {
      updates.push('cost = ?');
      values.push(cost);
    }
    if (commission != null) {
      updates.push('commission = ?');
      values.push(commission);
    }

    // Calculate new percentage
    let percent = null;
    if (phase && step != null && totalSteps != null) {
      percent = calculatePercent(phase, step, totalSteps);
      updates.push('percent = ?');
      values.push(percent);
    }

    // Always update last_updated timestamp
    const timestamp = Date.now();
    updates.push('last_updated = ?');
    values.push(timestamp);

    // Execute update
    values.push(tripId); // WHERE clause value
    await db.prepare(`
      UPDATE trips
      SET ${updates.join(', ')}
      WHERE trip_id = ?
    `).bind(...values).run();

    res.json({ ok: true, percent });
  } catch (error) {
    console.error('Error updating trip progress:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to update trip progress',
      code: 'PROGRESS_UPDATE_ERROR'
    });
  }
});

export default router;
