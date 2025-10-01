# MCP Progress Tracking Integration

**Feature**: 002-librechat-interface-modifications (Phase 4)
**Date**: 2025-10-01

## Overview

This guide explains how to integrate trip progress tracking into MCP tool workflows, so the StatusBar updates in real-time as the AI plans trips.

## Progress Update Function

**Location**: `api/server/utils/updateTripProgress.js`

**Functions Available**:
```javascript
const {
  updateTripProgress,      // Update via API
  updateTripProgressDirect, // Update directly with DB client
  advanceToNextPhase,      // Move to next phase
  markTripComplete,        // Mark 100% complete
  calculatePercent,        // Calculate % from phase/step
} = require('~/server/utils/updateTripProgress');
```

## Integration Points

### Option 1: MCP Tool Response Hook (Recommended)

Add progress tracking after each MCP tool execution:

```javascript
// In api/server/services/MCP/MCPService.js or similar

async function executeMCPTool(toolName, params) {
  const result = await mcpClient.callTool(toolName, params);

  // Update progress based on tool
  if (params.tripId) {
    await trackProgress(toolName, params.tripId, result);
  }

  return result;
}

async function trackProgress(toolName, tripId, result) {
  const { updateTripProgress } = require('~/server/utils/updateTripProgress');

  // Map tool names to progress updates
  const progressMap = {
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

  const progress = progressMap[toolName];
  if (progress) {
    await updateTripProgress(tripId, progress);
  }
}
```

### Option 2: Database Trigger Pattern

Update progress whenever trip data changes:

```javascript
// In trip data modification functions

async function saveHotelToTrip(tripId, hotelData) {
  // Save hotel
  await db.prepare('INSERT INTO hotel_cache ...').run();

  // Count hotels saved so far
  const hotelCount = await db
    .prepare('SELECT COUNT(*) as count FROM hotel_cache WHERE trip_id = ?')
    .bind(tripId)
    .first();

  // Update progress based on hotel count
  const { updateTripProgressDirect } = require('~/server/utils/updateTripProgress');
  await updateTripProgressDirect(db, tripId, {
    phase: 'Hotels',
    step: Math.min(hotelCount.count, 5),
    totalSteps: 5,
  });
}
```

### Option 3: Workflow State Machine

Explicit workflow state management:

```javascript
class TripWorkflow {
  constructor(tripId) {
    this.tripId = tripId;
    this.currentPhase = 'Research';
    this.currentStep = 0;
  }

  async nextStep() {
    this.currentStep++;

    const { PHASE_WEIGHTS, advanceToNextPhase } = require('~/server/utils/updateTripProgress');
    const phaseSteps = PHASE_WEIGHTS[this.currentPhase].totalSteps;

    if (this.currentStep >= phaseSteps) {
      // Advance to next phase
      await advanceToNextPhase(this.tripId, this.currentPhase);
      this.currentPhase = this.getNextPhase();
      this.currentStep = 0;
    } else {
      // Update within phase
      await updateTripProgress(this.tripId, {
        phase: this.currentPhase,
        step: this.currentStep,
        totalSteps: phaseSteps,
      });
    }
  }

  getNextPhase() {
    const phases = ['Research', 'Hotels', 'Activities', 'Booking', 'Finalization'];
    const idx = phases.indexOf(this.currentPhase);
    return phases[idx + 1] || 'Finalization';
  }
}

// Usage
const workflow = new TripWorkflow(tripId);
await workflow.nextStep(); // Advances to Research step 1
await workflow.nextStep(); // Advances to Research step 2
// ... etc
```

## Cost Tracking Integration

Update cost as items are added:

```javascript
async function addItemToCost(tripId, itemCost, commission = 0.10) {
  // Get current trip
  const trip = await db
    .prepare('SELECT cost, budget FROM trips WHERE trip_id = ?')
    .bind(tripId)
    .first();

  const newCost = (trip.cost || 0) + itemCost;
  const newCommission = newCost * commission;

  // Update progress with new cost
  const { updateTripProgressDirect } = require('~/server/utils/updateTripProgress');
  await updateTripProgressDirect(db, tripId, {
    cost: newCost,
    commission: newCommission,
  });
}
```

## Real-Time Updates

The StatusBar polls `/api/voygent/status` every 15 seconds and automatically shows trip progress when available.

**No additional frontend work needed** - just update the database and the StatusBar will reflect changes.

## Testing Progress Updates

```javascript
// Manual test
const { updateTripProgress } = require('~/server/utils/updateTripProgress');

// Set to Hotels phase, step 3 of 5 (should show ~32%)
await updateTripProgress('trip_xyz789', {
  phase: 'Hotels',
  step: 3,
  totalSteps: 5,
  cost: 4200,
  commission: 420,
});

// Verify in StatusBar or via API
// curl http://localhost:3080/api/voygent/trip-progress?tripId=trip_xyz789
```

## Phase Percentage Reference

| Phase | Range | Steps | Description |
|-------|-------|-------|-------------|
| Research | 0-20% | 4 | Destination research, requirements |
| Hotels | 20-40% | 5 | Hotel search, comparison, selection |
| Activities | 40-60% | 6 | Itinerary planning, activity booking |
| Booking | 60-80% | 4 | Commission calc, booking links |
| Finalization | 80-100% | 3 | Proposal generation, publishing |

**Example**: Hotels phase, step 3 of 5
- Phase start: 20%
- Phase range: 20% (40-20)
- Step progress: 3/5 = 60%
- Result: 20% + (20% × 60%) = **32%**

## Integration Checklist

- [ ] Choose integration point (Option 1, 2, or 3)
- [ ] Map MCP tool names to progress steps
- [ ] Add progress tracking calls after tool execution
- [ ] Test with real trip workflow
- [ ] Verify StatusBar updates in UI
- [ ] Add cost tracking to relevant operations

## Example: Complete Integration

```javascript
// In MCP tool handler
async function handleMCPToolCall(toolName, params, conversationId) {
  const result = await mcpClient.callTool(toolName, params);

  // Track progress if this is a trip-related tool
  if (params.tripId && isTripTool(toolName)) {
    const { updateTripProgress } = require('~/server/utils/updateTripProgress');

    // Get progress mapping for this tool
    const progress = getProgressForTool(toolName);

    // Update database
    await updateTripProgress(params.tripId, progress);

    // Log for debugging
    logger.info(`Progress: ${params.tripId} - ${progress.phase} ${progress.step}/${progress.totalSteps}`);
  }

  return result;
}
```

## Troubleshooting

**Progress not showing in StatusBar**:
1. Check API: `curl http://localhost:3080/api/voygent/trip-progress?tripId=xxx`
2. Verify database updated: Check `trips` table `last_updated` field
3. Check browser console for StatusBar errors
4. Verify polling interval (should be 15s)

**Percentage calculation wrong**:
- Verify phase name matches exactly (case-sensitive)
- Check step is 0-based (first step = 0, not 1)
- Use `calculatePercent()` function, don't calculate manually

**Cost not updating**:
- Ensure `cost` and `commission` passed to updateTripProgress
- Check database `cost` column type (should be REAL, not INTEGER)
