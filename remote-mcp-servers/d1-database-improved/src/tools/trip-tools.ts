import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';
import { importTripPageTool, importTripPageAndParseTool } from './import-tools';
import { generateSessionId } from '../utils/session-management';

/**
 * Trip management tools for creating, updating, and managing trips
 */

export const createTripV2Tool = {
  name: 'create_trip_v2',
  description: 'Create a new trip in the trips_v2 table with proper JSON structure',
  inputSchema: z.object({
    trip_name: z.string().describe('Name/title for the trip'),
    start_date: z.string().describe('Start date (YYYY-MM-DD format)'),
    end_date: z.string().describe('End date (YYYY-MM-DD format)'),
    destinations: z.string().optional().describe('Primary destination(s)'),
    total_cost: z.number().optional().default(0).describe('Total estimated cost'),
    status: z.string().optional().default('planning').describe('Trip status: planning, confirmed, in_progress, completed, cancelled'),
    notes: z.string().optional().describe('Trip notes or description'),
    primary_client_email: z.string().optional().describe('Email of primary client (if known)')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Generate trip slug
      const slug = generateTripSlug(input.trip_name, input.start_date);
      
      // Insert the trip
      const result = await db.prepare(`
        INSERT INTO trips_v2 (
          trip_name,
          trip_slug,
          destinations,
          start_date,
          end_date,
          total_cost,
          status,
          notes,
          primary_client_email,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        input.trip_name,
        slug,
        input.destinations || '',
        input.start_date,
        input.end_date,
        input.total_cost || 0,
        input.status || 'planning',
        input.notes || '',
        input.primary_client_email || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create trip');
      }

      const tripId = result.meta.last_row_id;

      // Log the creation
      await logActivity(
        db,
        'TripCreated',
        `Created new trip: ${input.trip_name}`,
        Number(tripId),
        null,
        generateSessionId()
      );

      return {
        success: true,
        trip_id: Number(tripId),
        trip_name: input.trip_name,
        trip_slug: slug,
        message: `Trip "${input.trip_name}" created successfully with ID ${tripId}`
      };

    } catch (error: any) {
      console.error('create_trip_v2 error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'create_trip_v2',
        error_message: error.message,
        table_names: 'trips_v2',
        context: extractOperationContext('create_trip_v2', input)
      });
      
      return createErrorResponse(error, 'Trip Creation', input, sessionId);
    }
  }
};

export const createTripWithClientTool = {
  name: 'create_trip_with_client',
  description: 'Create a new trip and assign a client (new or existing) in a single operation',
  inputSchema: z.object({
    trip_name: z.string().describe('Name/title for the trip'),
    start_date: z.string().describe('Start date (YYYY-MM-DD format)'),
    end_date: z.string().describe('End date (YYYY-MM-DD format)'),
    client_email: z.string().describe('Client email address'),
    client_full_name: z.string().describe('Client full name'),
    destinations: z.string().optional().describe('Primary destination(s)'),
    total_cost: z.number().optional().default(0).describe('Total estimated cost'),
    status: z.string().optional().default('planning').describe('Trip status'),
    trip_notes: z.string().optional().describe('Trip notes or description'),
    client_phone: z.string().optional().describe('Client phone number'),
    client_preferences: z.object({}).optional().describe('Client travel preferences'),
    client_role: z.string().optional().default('primary_traveler').describe('Client role in trip')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Check if client exists
      let client = await db.prepare('SELECT * FROM clients_v2 WHERE email = ?').bind(input.client_email).first();
      
      if (!client) {
        // Create new client
        const clientResult = await db.prepare(`
          INSERT INTO clients_v2 (
            email,
            full_name,
            phone,
            preferences,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          input.client_email,
          input.client_full_name,
          input.client_phone || null,
          JSON.stringify(input.client_preferences || {})
        ).run();

        if (!clientResult.success) {
          throw new Error('Failed to create client');
        }

        client = {
          client_id: Number(clientResult.meta.last_row_id),
          email: input.client_email,
          full_name: input.client_full_name,
          phone: input.client_phone,
          preferences: JSON.stringify(input.client_preferences || {})
        };
      }

      // Create trip
      const slug = generateTripSlug(input.trip_name, input.start_date);
      const tripResult = await db.prepare(`
        INSERT INTO trips_v2 (
          trip_name,
          trip_slug,
          destinations,
          start_date,
          end_date,
          total_cost,
          status,
          notes,
          primary_client_email,
          client_names,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        input.trip_name,
        slug,
        input.destinations || '',
        input.start_date,
        input.end_date,
        input.total_cost || 0,
        input.status || 'planning',
        input.trip_notes || '',
        input.client_email,
        input.client_full_name
      ).run();

      if (!tripResult.success) {
        throw new Error('Failed to create trip');
      }

      const tripId = Number(tripResult.meta.last_row_id);

      // Create trip-client assignment (dual-write strategy)
      const assignmentResult = await db.prepare(`
        INSERT INTO trip_client_assignments (
          trip_id,
          client_email,
          client_role,
          created_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        tripId,
        input.client_email,
        input.client_role || 'primary_traveler'
      ).run();

      // Also update the clients JSON field directly for backup compatibility
      const clientAssignment = [{
        email: input.client_email,
        role: input.client_role || 'primary_traveler',
        assigned_at: new Date().toISOString()
      }];

      await db.prepare(`
        UPDATE trips_v2 
        SET clients = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
      `).bind(JSON.stringify(clientAssignment), tripId).run();

      // Log the creation
      await logActivity(
        db,
        'TripAndClientCreated',
        `Created trip "${input.trip_name}" with client ${input.client_full_name}`,
        tripId,
        client.client_id,
        generateSessionId()
      );

      return {
        success: true,
        trip_id: tripId,
        client_id: client.client_id,
        trip_name: input.trip_name,
        client_name: input.client_full_name,
        trip_slug: slug,
        message: `Trip "${input.trip_name}" created successfully with client ${input.client_full_name}`
      };

    } catch (error: any) {
      console.error('create_trip_with_client error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'create_trip_with_client',
        error_message: error.message,
        table_names: 'trips_v2,clients_v2,trip_client_assignments',
        context: extractOperationContext('create_trip_with_client', input)
      });
      
      return createErrorResponse(error, 'Trip and Client Creation', input, sessionId);
    }
  }
};

export const updateActivitylogClientsTool = {
  name: 'update_activitylog_clients',
  description: 'Update ActivityLog entries to populate client_id from trip_id',
  inputSchema: z.object({}),
  handler: async (input: any, db: D1Database) => {
    try {
      const result = await db.prepare(`
        UPDATE ActivityLog 
        SET client_id = (
          SELECT tca.client_email 
          FROM trip_client_assignments tca 
          WHERE tca.trip_id = ActivityLog.trip_id 
          AND tca.client_role = 'primary_traveler'
          LIMIT 1
        )
        WHERE trip_id IS NOT NULL 
        AND client_id IS NULL
      `).run();

      return {
        success: true,
        updated_count: result.changes,
        message: `Updated ${result.changes} ActivityLog entries with client information`
      };

    } catch (error: any) {
      console.error('update_activitylog_clients error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'update_activitylog_clients',
        error_message: error.message,
        table_names: 'ActivityLog,trip_client_assignments',
        context: extractOperationContext('update_activitylog_clients', input)
      });
      
      return createErrorResponse(error, 'ActivityLog Client Update', input, sessionId);
    }
  }
};

export const resetActivitylogFromTripsTool = {
  name: 'reset_activitylog_from_trips',
  description: 'Clear ActivityLog and repopulate from trips_v2 table updated_at column',
  inputSchema: z.object({}),
  handler: async (input: any, db: D1Database) => {
    try {
      // Clear existing ActivityLog
      await db.prepare('DELETE FROM ActivityLog').run();

      // Repopulate from trips_v2
      const trips = await db.prepare(`
        SELECT trip_id, trip_name, updated_at, status
        FROM trips_v2
        ORDER BY updated_at ASC
      `).all();

      let insertedCount = 0;
      for (const trip of trips.results) {
        await db.prepare(`
          INSERT INTO ActivityLog (
            activity_type,
            activity_details,
            trip_id,
            created_at
          ) VALUES (?, ?, ?, ?)
        `).bind(
          'TripUpdate',
          `Trip "${trip.trip_name}" was updated (Status: ${trip.status})`,
          trip.trip_id,
          trip.updated_at
        ).run();
        
        insertedCount++;
      }

      return {
        success: true,
        cleared_entries: 'all',
        inserted_entries: insertedCount,
        message: `Reset ActivityLog: inserted ${insertedCount} entries from trips_v2`
      };

    } catch (error: any) {
      console.error('reset_activitylog_from_trips error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'reset_activitylog_from_trips',
        error_message: error.message,
        table_names: 'ActivityLog,trips_v2',
        context: extractOperationContext('reset_activitylog_from_trips', input)
      });
      
      return createErrorResponse(error, 'ActivityLog Reset', input, sessionId);
    }
  }
};

export const bulkTripOperationsTool = {
  name: 'bulk_trip_operations',
  description: 'Perform multiple trip operations in a single call - assign clients, add activities, update costs, modify schedule, add notes, etc.',
  inputSchema: z.object({
    trip_identifier: z.string().describe('Trip name or ID'),
    operations: z.array(z.object({
      type: z.enum([
        'add_activity', 'update_cost', 'add_note', 'update_status', 'add_document', 'assign_client', 'advance_workflow', 'set_workflow_step',
        'import_from_url', 'import_and_parse_from_url', 'rename_trip'
      ]),
      data: z.any().optional().describe('Operation-specific data. For workflow operations: {phase?, step_number?, completion_data?, notes?}')
    })).describe('Array of operations to perform including workflow operations')
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

      const results = [];
      const sessionId = generateSessionId();

      for (const operation of input.operations) {
        try {
          let result;
          
          switch (operation.type) {
            case 'add_activity':
              await logActivity(
                db,
                operation.data?.type || 'GeneralActivity',
                operation.data?.details || 'Activity added via bulk operation',
                trip.trip_id,
                null,
                sessionId
              );
              result = { success: true, message: 'Activity added' };
              break;

            case 'update_cost':
              await db.prepare(`
                UPDATE trips_v2 
                SET total_cost = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(operation.data?.cost || 0, trip.trip_id).run();
              result = { success: true, message: `Cost updated to ${operation.data?.cost || 0}` };
              break;

            case 'add_note':
              const currentNotes = trip.notes || '';
              const newNote = `${currentNotes}\n\n[${new Date().toISOString()}] ${operation.data?.note || ''}`.trim();
              await db.prepare(`
                UPDATE trips_v2 
                SET notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(newNote, trip.trip_id).run();
              result = { success: true, message: 'Note added' };
              break;

            case 'update_status':
              await db.prepare(`
                UPDATE trips_v2 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(operation.data?.status || 'planning', trip.trip_id).run();
              result = { success: true, message: `Status updated to ${operation.data?.status}` };
              break;

            case 'assign_client':
              // Dual-write strategy: update both normalized table AND denormalized JSON
              
              // 1. Insert into normalized junction table (with trigger that updates JSON)
              const assignResult = await db.prepare(`
                INSERT OR REPLACE INTO trip_client_assignments (
                  trip_id, client_email, client_role, created_at
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(
                trip.trip_id,
                operation.data?.email,
                operation.data?.role || 'traveler'
              ).run();

              // 2. Also directly update the JSON field in trips_v2 (backup compatibility)
              // This ensures the system works even if triggers fail
              const clientAssignment = {
                email: operation.data?.email,
                role: operation.data?.role || 'traveler',
                assigned_at: new Date().toISOString()
              };

              // Get current clients JSON
              const currentTrip = await db.prepare(`
                SELECT clients FROM trips_v2 WHERE trip_id = ?
              `).bind(trip.trip_id).first();

              let clients = [];
              if (currentTrip?.clients && currentTrip.clients !== '[]') {
                try {
                  clients = JSON.parse(currentTrip.clients);
                } catch (e) {
                  console.warn('Failed to parse existing clients JSON, starting fresh');
                  clients = [];
                }
              }

              // Remove existing assignment for this email (if any) and add new one
              clients = clients.filter(c => c.email !== operation.data?.email);
              clients.push(clientAssignment);

              // Update trips_v2 with new clients JSON
              await db.prepare(`
                UPDATE trips_v2 
                SET clients = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(JSON.stringify(clients), trip.trip_id).run();

              result = { 
                success: true, 
                message: `Client ${operation.data?.email} assigned (dual-write: junction table + JSON)`,
                assignment_id: assignResult.meta?.last_row_id
              };
              break;

            case 'advance_workflow':
              const workflowState = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
              const newWorkflowState = {
                ...workflowState,
                current_phase: operation.data?.phase,
                current_step: operation.data?.step_number || 1,
                last_updated: new Date().toISOString()
              };
              
              await db.prepare(`
                UPDATE trips_v2 
                SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(JSON.stringify(newWorkflowState), trip.trip_id).run();
              result = { success: true, message: `Workflow advanced to ${operation.data?.phase}` };
              break;

            case 'set_workflow_step':
              const currentWorkflow = trip.workflow_state ? JSON.parse(trip.workflow_state) : {};
              currentWorkflow.current_step = operation.data?.step_number || 1;
              currentWorkflow.last_updated = new Date().toISOString();
              
              await db.prepare(`
                UPDATE trips_v2 
                SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP
                WHERE trip_id = ?
              `).bind(JSON.stringify(currentWorkflow), trip.trip_id).run();
              result = { success: true, message: `Workflow step set to ${operation.data?.step_number}` };
              break;

            case 'import_from_url':
              if (!operation.data?.url) throw new Error('import_from_url requires data.url');
              {
                const importResult: any = await importTripPageTool.handler({
                  trip_id: trip.trip_id,
                  url: operation.data.url,
                  tag: operation.data.tag,
                  save_raw_html: operation.data.save_raw_html ?? true,
                  save_text: operation.data.save_text ?? true,
                  overwrite: operation.data.overwrite ?? false
                }, db);
                result = { success: !!importResult?.success, message: importResult?.message || 'Imported', details: importResult };
              }
              break;

            case 'import_and_parse_from_url':
              if (!operation.data?.url) throw new Error('import_and_parse_from_url requires data.url');
              {
                // Step 1: Import the page
                const importResult: any = await importTripPageTool.handler({
                  trip_id: trip.trip_id,
                  url: operation.data.url,
                  tag: operation.data.tag || 'imported_and_parsed',
                  save_raw_html: operation.data.save_raw_html ?? true,
                  save_text: operation.data.save_text ?? true,
                  overwrite: operation.data.overwrite ?? false
                }, db);

                if (!importResult?.success) {
                  throw new Error(`Import failed: ${importResult?.message || 'Unknown error'}`);
                }

                // Step 2: Parse the imported page
                const parseResult: any = await importTripPageAndParseTool.handler({
                  trip_id: trip.trip_id,
                  doc_id: importResult.doc_id,
                  strategy: operation.data.strategy || 'schedule_first',
                  overwrite: operation.data.overwrite || 'none',
                  dry_run: operation.data.dry_run || false,
                  max_days: operation.data.max_days || 14,
                  max_activities_per_day: operation.data.max_activities_per_day || 30
                }, db);

                if (!parseResult?.success) {
                  throw new Error(`Parse failed: ${parseResult?.message || 'Unknown error'}`);
                }

                // Step 3: Optional rename trip
                let renameResult = null;
                if (operation.data.rename_to) {
                  await db.prepare(`
                    UPDATE trips_v2
                    SET trip_name = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE trip_id = ?
                  `).bind(operation.data.rename_to, trip.trip_id).run();

                  if (operation.data.update_slug) {
                    const newSlug = generateTripSlug(operation.data.rename_to, trip.start_date);
                    await db.prepare(`
                      UPDATE trips_v2
                      SET trip_slug = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE trip_id = ?
                    `).bind(newSlug, trip.trip_id).run();
                  }

                  renameResult = { renamed_to: operation.data.rename_to };
                }

                result = {
                  success: true,
                  message: 'Import, parse, and optional rename completed',
                  imported: importResult,
                  parsed: parseResult,
                  renamed: renameResult
                };
              }
              break;

            case 'rename_trip':
              if (!operation.data?.new_name) throw new Error('rename_trip requires data.new_name');
              {
                const newName: string = operation.data.new_name;
                // Optionally update slug based on start_date
                const tripRow = await db.prepare('SELECT start_date FROM trips_v2 WHERE trip_id = ?').bind(trip.trip_id).first();
                const startDate = tripRow?.start_date || (new Date().getFullYear() + '-01-01');
                const updateSlug = operation.data?.update_slug !== false; // default true
                const newSlug = updateSlug ? generateTripSlug(newName, startDate) : trip.trip_slug;
                await db.prepare(`UPDATE trips_v2 SET trip_name = ?, ${updateSlug ? 'trip_slug = ?, ' : ''} updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?`)
                  .bind(...(updateSlug ? [newName, newSlug, trip.trip_id] : [newName, trip.trip_id]))
                  .run();
                result = { success: true, message: `Trip renamed to ${newName}` };
              }
              break;

            default:
              result = { success: false, message: `Unknown operation type: ${operation.type}` };
          }

          results.push({ operation: operation.type, ...result });

        } catch (opError: any) {
          results.push({ 
            operation: operation.type, 
            success: false, 
            error: opError.message 
          });
        }
      }

      // Log the bulk operation
      await logActivity(
        db,
        'BulkOperations',
        `Performed ${input.operations.length} operations on trip`,
        trip.trip_id,
        null,
        sessionId
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      return {
        success: true,
        trip_id: trip.trip_id,
        operations_completed: successCount,
        operations_failed: failureCount,
        results: results,
        message: `Bulk operations completed: ${successCount} succeeded, ${failureCount} failed`
      };

    } catch (error: any) {
      console.error('bulk_trip_operations error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'bulk_trip_operations',
        error_message: error.message,
        table_names: 'trips_v2,ActivityLog,trip_client_assignments',
        context: extractOperationContext('bulk_trip_operations', input)
      });
      
      return createErrorResponse(error, 'Bulk Trip Operations', input, sessionId);
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

function generateTripSlug(tripName: string, startDate: string): string {
  const nameSlug = tripName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
  
  const year = startDate.split('-')[0];
  return `${nameSlug}-${year}`;
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
