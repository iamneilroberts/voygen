import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';
import { generateSessionId } from '../utils/session-management';

/**
 * Workflow management tools for trip planning phases
 */

export const advanceWorkflowPhaseTool = {
  name: 'advance_workflow_phase',
  description: 'Advance a trip to the next workflow phase with completion data and validation',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    new_phase: z.enum(['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation']).describe('New workflow phase to advance to'),
    completion_data: z.object({}).optional().describe('Data about the completed phase'),
    notes: z.string().optional().describe('Notes about the phase transition'),
    step_number: z.number().optional().default(1).describe('Step number within the new phase')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await findTripByIdentifier(db, input.trip_identifier);
      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          message: `No trip found for identifier: ${input.trip_identifier}`
        };
      }

      // Get current workflow state
      const currentWorkflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
      
      // Create new workflow state
      const newWorkflowState = {
        ...currentWorkflowState,
        current_phase: input.new_phase,
        current_step: input.step_number,
        phase_history: [
          ...(currentWorkflowState.phase_history || []),
          {
            phase: input.new_phase,
            entered_at: new Date().toISOString(),
            completion_data: input.completion_data || {},
            notes: input.notes
          }
        ],
        last_updated: new Date().toISOString()
      };

      // Update the trip
      await db.prepare(`
        UPDATE trips_v2 
        SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
      `).bind(JSON.stringify(newWorkflowState), trip.trip_id).run();

      // Log the workflow advancement
      await logActivity(
        db,
        'WorkflowAdvancement',
        `Advanced to ${input.new_phase} phase` + (input.notes ? `: ${input.notes}` : ''),
        trip.trip_id,
        null,
        generateSessionId()
      );

      return {
        success: true,
        message: `Successfully advanced trip "${trip.trip_name}" to ${input.new_phase} phase`,
        trip_id: trip.trip_id,
        previous_phase: currentWorkflowState.current_phase,
        new_phase: input.new_phase,
        workflow_state: newWorkflowState
      };

    } catch (error: any) {
      console.error('advance_workflow_phase error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'advance_workflow_phase',
        error_message: error.message,
        table_names: 'trips_v2',
        context: extractOperationContext('advance_workflow_phase', input)
      });
      
      return createErrorResponse(error, 'Workflow Advancement', input, sessionId);
    }
  }
};

export const setWorkflowStepTool = {
  name: 'set_workflow_step',
  description: 'Set the current step within the current workflow phase',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    step_number: z.number().describe('Step number within current phase'),
    step_data: z.object({}).optional().describe('Data specific to this step')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await findTripByIdentifier(db, input.trip_identifier);
      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          message: `No trip found for identifier: ${input.trip_identifier}`
        };
      }

      // Get current workflow state
      const workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
      
      // Update step
      workflowState.current_step = input.step_number;
      workflowState.step_data = input.step_data || {};
      workflowState.last_updated = new Date().toISOString();

      // Update the trip
      await db.prepare(`
        UPDATE trips_v2 
        SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
      `).bind(JSON.stringify(workflowState), trip.trip_id).run();

      return {
        success: true,
        message: `Set step ${input.step_number} for ${workflowState.current_phase || 'current'} phase`,
        trip_id: trip.trip_id,
        current_phase: workflowState.current_phase,
        current_step: input.step_number
      };

    } catch (error: any) {
      console.error('set_workflow_step error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'set_workflow_step',
        error_message: error.message,
        table_names: 'trips_v2',
        context: extractOperationContext('set_workflow_step', input)
      });
      
      return createErrorResponse(error, 'Workflow Step Setting', input, sessionId);
    }
  }
};

export const getWorkflowStatusTool = {
  name: 'get_workflow_status',
  description: 'Get detailed workflow status for a trip including phase history and current state',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await findTripByIdentifier(db, input.trip_identifier);
      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          message: `No trip found for identifier: ${input.trip_identifier}`
        };
      }

      const workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
      
      // Get recent workflow activities
      const activities = await db.prepare(`
        SELECT * FROM ActivityLog 
        WHERE trip_id = ? AND activity_type LIKE '%Workflow%'
        ORDER BY created_at DESC 
        LIMIT 10
      `).bind(trip.trip_id).all();

      // Calculate progress
      const phases = ['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation'];
      const currentPhaseIndex = phases.indexOf(workflowState.current_phase || '');
      const progressPercentage = currentPhaseIndex >= 0 ? Math.round((currentPhaseIndex / phases.length) * 100) : 0;

      return {
        success: true,
        trip_name: trip.trip_name,
        trip_id: trip.trip_id,
        current_phase: workflowState.current_phase || 'Not started',
        current_step: workflowState.current_step || 1,
        progress_percentage: progressPercentage,
        phase_history: workflowState.phase_history || [],
        step_data: workflowState.step_data || {},
        last_updated: workflowState.last_updated,
        recent_activities: activities.results || [],
        next_phases: phases.slice(currentPhaseIndex + 1)
      };

    } catch (error: any) {
      console.error('get_workflow_status error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'get_workflow_status',
        error_message: error.message,
        table_names: 'trips_v2,ActivityLog',
        context: extractOperationContext('get_workflow_status', input)
      });
      
      return createErrorResponse(error, 'Workflow Status Retrieval', input, sessionId);
    }
  }
};

export const getWorkflowInstructionsTool = {
  name: 'get_workflow_instructions',
  description: 'Get phase-specific instructions for the current workflow state of a trip',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    include_all_phases: z.boolean().optional().default(false).describe('Include instructions for all phases, not just current')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await findTripByIdentifier(db, input.trip_identifier);
      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          message: `No trip found for identifier: ${input.trip_identifier}`
        };
      }

      const workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
      const currentPhase = workflowState.current_phase || 'interview';
      
      // Get instructions for the current or all phases
      const instructions = input.include_all_phases 
        ? getAllPhaseInstructions()
        : getPhaseInstructions(currentPhase);

      return {
        success: true,
        trip_name: trip.trip_name,
        current_phase: currentPhase,
        current_step: workflowState.current_step || 1,
        instructions: instructions,
        phase_specific: !input.include_all_phases
      };

    } catch (error: any) {
      console.error('get_workflow_instructions error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'get_workflow_instructions',
        error_message: error.message,
        table_names: 'trips_v2',
        context: extractOperationContext('get_workflow_instructions', input)
      });
      
      return createErrorResponse(error, 'Workflow Instructions Retrieval', input, sessionId);
    }
  }
};

export const initializeWorkflowTool = {
  name: 'initialize_workflow',
  description: 'Initialize workflow state for a trip with a starting phase',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    starting_phase: z.enum(['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation']).optional().default('interview').describe('Starting workflow phase'),
    initial_data: z.object({}).optional().describe('Initial workflow data')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find the trip
      const trip = await findTripByIdentifier(db, input.trip_identifier);
      if (!trip) {
        return {
          success: false,
          error: 'Trip not found',
          message: `No trip found for identifier: ${input.trip_identifier}`
        };
      }

      // Create initial workflow state
      const initialWorkflowState = {
        current_phase: input.starting_phase,
        current_step: 1,
        phase_history: [{
          phase: input.starting_phase,
          entered_at: new Date().toISOString(),
          completion_data: {},
          notes: 'Workflow initialized'
        }],
        step_data: input.initial_data || {},
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      // Update the trip
      await db.prepare(`
        UPDATE trips_v2 
        SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
      `).bind(JSON.stringify(initialWorkflowState), trip.trip_id).run();

      // Log the workflow initialization
      await logActivity(
        db,
        'WorkflowInitialization',
        `Initialized workflow starting with ${input.starting_phase} phase`,
        trip.trip_id,
        null,
        generateSessionId()
      );

      return {
        success: true,
        message: `Workflow initialized for trip "${trip.trip_name}" starting with ${input.starting_phase} phase`,
        trip_id: trip.trip_id,
        workflow_state: initialWorkflowState,
        instructions: getPhaseInstructions(input.starting_phase)
      };

    } catch (error: any) {
      console.error('initialize_workflow error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'initialize_workflow',
        error_message: error.message,
        table_names: 'trips_v2',
        context: extractOperationContext('initialize_workflow', input)
      });
      
      return createErrorResponse(error, 'Workflow Initialization', input, sessionId);
    }
  }
};

// Helper functions
async function findTripByIdentifier(db: D1Database, identifier: string): Promise<any> {
  // Try by trip_id first (if numeric)
  if (/^\d+$/.test(identifier)) {
    const trip = await db.prepare('SELECT * FROM trips_v2 WHERE trip_id = ?').bind(parseInt(identifier)).first();
    if (trip) return trip;
  }
  
  // Try by exact trip name
  let trip = await db.prepare('SELECT * FROM trips_v2 WHERE trip_name = ?').bind(identifier).first();
  if (trip) return trip;
  
  // Try by partial trip name
  trip = await db.prepare('SELECT * FROM trips_v2 WHERE trip_name LIKE ?').bind(`%${identifier}%`).first();
  return trip;
}

async function logActivity(
  db: D1Database,
  activityType: string,
  details: string,
  tripId?: number | null,
  clientId?: number | null,
  sessionId?: string | null
) {
  try {
    await db.prepare(`
      INSERT INTO ActivityLog (
        activity_type, 
        activity_details, 
        trip_id, 
        client_id, 
        session_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      activityType,
      details,
      tripId,
      clientId,
      sessionId
    ).run();
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

function getPhaseInstructions(phase: string): any {
  const instructions = {
    interview: {
      title: 'Client Interview Phase',
      description: 'Gather comprehensive client requirements and preferences',
      steps: [
        'Conduct initial client consultation',
        'Document travel preferences and constraints',
        'Identify budget parameters',
        'Understand special requirements',
        'Set expectations and timeline'
      ],
      deliverables: ['Client requirement summary', 'Budget framework', 'Preference profile']
    },
    conceptualization: {
      title: 'Concept Development Phase',
      description: 'Develop initial trip concepts based on client preferences',
      steps: [
        'Research destination options',
        'Create theme concepts',
        'Identify key experiences',
        'Develop preliminary timeline',
        'Present concepts to client'
      ],
      deliverables: ['Trip concept document', 'Destination recommendations', 'Experience outline']
    },
    planning: {
      title: 'Detailed Planning Phase',
      description: 'Create comprehensive itinerary and logistics',
      steps: [
        'Develop detailed daily itinerary',
        'Research and select accommodations',
        'Plan transportation and transfers',
        'Book experiences and activities',
        'Coordinate logistics'
      ],
      deliverables: ['Complete itinerary', 'Accommodation selections', 'Activity bookings']
    },
    proposal: {
      title: 'Proposal Generation Phase',
      description: 'Create formal travel proposal for client approval',
      steps: [
        'Compile all planning elements',
        'Calculate total costs',
        'Create proposal document',
        'Include terms and conditions',
        'Present to client'
      ],
      deliverables: ['Formal proposal document', 'Cost breakdown', 'Terms and conditions']
    },
    revision: {
      title: 'Revision Phase',
      description: 'Address client feedback and refine proposal',
      steps: [
        'Review client feedback',
        'Identify required changes',
        'Research alternatives',
        'Update proposal',
        'Resubmit for approval'
      ],
      deliverables: ['Revised proposal', 'Change documentation', 'Updated costs']
    },
    finalization: {
      title: 'Finalization Phase',
      description: 'Confirm all bookings and finalize arrangements',
      steps: [
        'Confirm all reservations',
        'Process payments',
        'Arrange travel insurance',
        'Coordinate final details',
        'Prepare travel documents'
      ],
      deliverables: ['Confirmed bookings', 'Travel insurance', 'Final documentation']
    },
    preparation: {
      title: 'Pre-Travel Preparation Phase',
      description: 'Prepare client for departure',
      steps: [
        'Create travel checklist',
        'Provide destination information',
        'Share emergency contacts',
        'Confirm final arrangements',
        'Conduct pre-travel briefing'
      ],
      deliverables: ['Travel checklist', 'Destination guide', 'Emergency contact list']
    }
  };
  
  return instructions[phase] || {
    title: 'Unknown Phase',
    description: 'Phase instructions not available',
    steps: [],
    deliverables: []
  };
}

function getAllPhaseInstructions(): any {
  const phases = ['interview', 'conceptualization', 'planning', 'proposal', 'revision', 'finalization', 'preparation'];
  return phases.reduce((acc, phase) => {
    acc[phase] = getPhaseInstructions(phase);
    return acc;
  }, {} as any);
}