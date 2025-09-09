import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';
import { generateSessionId } from '../utils/session-management';

/**
 * Client management tools for creating, updating, and managing clients
 */

export const createClientV2Tool = {
  name: 'create_client_v2',
  description: 'Create a new client in the clients_v2 table with proper JSON structure',
  inputSchema: z.object({
    email: z.string().email().describe('Client email address (required)'),
    full_name: z.string().describe('Client full name (required)'),
    phone: z.string().optional().describe('Phone number'),
    address: z.string().optional().describe('Full address'),
    preferences: z.object({}).optional().describe('Travel preferences as key-value pairs'),
    loyalty_programs: z.object({}).optional().describe('Loyalty program memberships'),
    travel_docs: z.object({}).optional().describe('Travel document information'),
    notes: z.string().optional().describe('Additional notes about client')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Check if client already exists
      const existing = await db.prepare('SELECT * FROM clients_v2 WHERE email = ?').bind(input.email).first();
      if (existing) {
        return {
          success: false,
          error: 'Client already exists',
          message: `Client with email ${input.email} already exists`,
          existing_client: existing
        };
      }

      // Insert new client
      const result = await db.prepare(`
        INSERT INTO clients_v2 (
          email,
          full_name,
          phone,
          address,
          preferences,
          loyalty_programs,
          travel_docs,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        input.email,
        input.full_name,
        input.phone || null,
        input.address || null,
        JSON.stringify(input.preferences || {}),
        JSON.stringify(input.loyalty_programs || {}),
        JSON.stringify(input.travel_docs || {}),
        input.notes || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create client');
      }

      const clientId = Number(result.meta.last_row_id);

      // Log the creation
      await logActivity(
        db,
        'ClientCreated',
        `Created new client: ${input.full_name} (${input.email})`,
        null,
        clientId,
        generateSessionId()
      );

      return {
        success: true,
        client_id: clientId,
        email: input.email,
        full_name: input.full_name,
        message: `Client "${input.full_name}" created successfully with ID ${clientId}`
      };

    } catch (error: any) {
      console.error('create_client_v2 error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'create_client_v2',
        error_message: error.message,
        table_names: 'clients_v2',
        context: extractOperationContext('create_client_v2', input)
      });
      
      return createErrorResponse(error, 'Client Creation', input, sessionId);
    }
  }
};

export const cleanupDuplicateClientsTool = {
  name: 'cleanup_duplicate_clients',
  description: 'Remove duplicate or test client records based on email patterns or names while preserving legitimate clients',
  inputSchema: z.object({
    email_patterns: z.array(z.string()).optional().describe('Email patterns to match for deletion (e.g., ["@example.com"])'),
    name_patterns: z.array(z.string()).optional().describe('Name patterns to match for deletion (e.g., ["Test", "Sarah & Michael"])'),
    preserve_emails: z.array(z.string()).optional().describe('Specific emails to preserve even if they match patterns'),
    preserve_client_ids: z.array(z.number()).optional().describe('Client IDs to preserve even if they match patterns'),
    dry_run: z.boolean().optional().default(true).describe('If true, only show what would be deleted without actually deleting')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const toDelete = [];
      const preserved = [];

      // Build WHERE clause for potential deletions
      const conditions = [];
      const params = [];

      if (input.email_patterns && input.email_patterns.length > 0) {
        const emailConditions = input.email_patterns.map(() => 'email LIKE ?').join(' OR ');
        conditions.push(`(${emailConditions})`);
        params.push(...input.email_patterns.map((pattern: string) => `%${pattern}%`));
      }

      if (input.name_patterns && input.name_patterns.length > 0) {
        const nameConditions = input.name_patterns.map(() => 'full_name LIKE ?').join(' OR ');
        conditions.push(`(${nameConditions})`);
        params.push(...input.name_patterns.map((pattern: string) => `%${pattern}%`));
      }

      if (conditions.length === 0) {
        return {
          success: false,
          error: 'No deletion criteria provided',
          message: 'Please provide either email_patterns or name_patterns'
        };
      }

      // Find candidates for deletion
      const whereClause = conditions.join(' OR ');
      const candidates = await db.prepare(`
        SELECT * FROM clients_v2 WHERE ${whereClause}
      `).bind(...params).all();

      for (const client of candidates.results) {
        // Check if should be preserved
        const shouldPreserve = 
          (input.preserve_emails && input.preserve_emails.includes(client.email)) ||
          (input.preserve_client_ids && input.preserve_client_ids.includes(client.client_id));

        if (shouldPreserve) {
          preserved.push(client);
        } else {
          toDelete.push(client);
        }
      }

      let deletionResult = null;
      if (!input.dry_run && toDelete.length > 0) {
        // Perform actual deletion
        const clientIds = toDelete.map(c => c.client_id);
        
        // First delete related records
        await db.prepare(`
          DELETE FROM trip_client_assignments 
          WHERE client_email IN (${toDelete.map(() => '?').join(',')})
        `).bind(...toDelete.map(c => c.email)).run();

        // Then delete clients
        deletionResult = await db.prepare(`
          DELETE FROM clients_v2 
          WHERE client_id IN (${clientIds.map(() => '?').join(',')})
        `).bind(...clientIds).run();

        // Log the cleanup
        await logActivity(
          db,
          'ClientCleanup',
          `Cleaned up ${deletionResult.changes} duplicate/test clients`,
          null,
          null,
          generateSessionId()
        );
      }

      return {
        success: true,
        dry_run: input.dry_run,
        candidates_found: candidates.results.length,
        to_delete: toDelete.length,
        preserved: preserved.length,
        actually_deleted: deletionResult ? deletionResult.changes : 0,
        deletion_candidates: toDelete.map(c => ({
          id: c.client_id,
          name: c.full_name,
          email: c.email,
          reason: 'Matched deletion patterns'
        })),
        preserved_clients: preserved.map(c => ({
          id: c.client_id,
          name: c.full_name,
          email: c.email,
          reason: 'In preserve list'
        })),
        message: input.dry_run 
          ? `Dry run: Found ${toDelete.length} clients to delete, ${preserved.length} preserved`
          : `Deleted ${deletionResult?.changes || 0} clients, preserved ${preserved.length}`
      };

    } catch (error: any) {
      console.error('cleanup_duplicate_clients error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'cleanup_duplicate_clients',
        error_message: error.message,
        table_names: 'clients_v2,trip_client_assignments',
        context: extractOperationContext('cleanup_duplicate_clients', input)
      });
      
      return createErrorResponse(error, 'Client Cleanup', input, sessionId);
    }
  }
};

export const cleanupDuplicateTripsTool = {
  name: 'cleanup_duplicate_trips',
  description: 'Remove duplicate or test trip records based on name patterns while preserving legitimate trips',
  inputSchema: z.object({
    name_patterns: z.array(z.string()).describe('Trip name patterns to match for deletion (e.g., ["Sarah & Michael", "Test Trip"])'),
    preserve_trip_names: z.array(z.string()).optional().describe('Specific trip names to preserve even if they match patterns'),
    preserve_trip_ids: z.array(z.number()).optional().describe('Trip IDs to preserve even if they match patterns'),
    archive_only: z.boolean().optional().default(false).describe('If true, set status="cancelled" instead of deleting'),
    dry_run: z.boolean().optional().default(true).describe('If true, only show what would be changed without actually applying')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const toDelete = [];
      const preserved = [];

      // Build WHERE clause for potential deletions
      const nameConditions = input.name_patterns.map(() => 'trip_name LIKE ?').join(' OR ');
      const whereClause = `(${nameConditions})`;
      const params = input.name_patterns.map((pattern: string) => `%${pattern}%`);

      // Find candidates for deletion
      const candidates = await db.prepare(`
        SELECT * FROM trips_v2 WHERE ${whereClause}
      `).bind(...params).all();

      for (const trip of candidates.results) {
        // Check if should be preserved
        const shouldPreserve = 
          (input.preserve_trip_names && input.preserve_trip_names.includes(trip.trip_name)) ||
          (input.preserve_trip_ids && input.preserve_trip_ids.includes(trip.trip_id));

        if (shouldPreserve) {
          preserved.push(trip);
        } else {
          toDelete.push(trip);
        }
      }

      let actionResult: any = null;
      if (!input.dry_run && toDelete.length > 0) {
        const tripIds = toDelete.map(t => t.trip_id);

        if (input.archive_only) {
          // Soft-archive by setting status to cancelled
          actionResult = await db.prepare(`
            UPDATE trips_v2 
            SET status='cancelled', updated_at=CURRENT_TIMESTAMP 
            WHERE trip_id IN (${tripIds.map(() => '?').join(',')})
          `).bind(...tripIds).run();

          await logActivity(
            db,
            'TripArchive',
            `Archived ${actionResult.changes} duplicate/test trips (status=cancelled)`,
            null,
            null,
            generateSessionId()
          );
        } else {
          // Hard delete duplicates and related records
          await db.prepare(`
            DELETE FROM trip_client_assignments 
            WHERE trip_id IN (${tripIds.map(() => '?').join(',')})
          `).bind(...tripIds).run();

          await db.prepare(`
            DELETE FROM ActivityLog 
            WHERE trip_id IN (${tripIds.map(() => '?').join(',')})
          `).bind(...tripIds).run();

          actionResult = await db.prepare(`
            DELETE FROM trips_v2 
            WHERE trip_id IN (${tripIds.map(() => '?').join(',')})
          `).bind(...tripIds).run();

          await logActivity(
            db,
            'TripCleanup',
            `Deleted ${actionResult.changes} duplicate/test trips`,
            null,
            null,
            generateSessionId()
          );
        }
      }

      return {
        success: true,
        dry_run: input.dry_run,
        candidates_found: candidates.results.length,
        to_delete: toDelete.length,
        preserved: preserved.length,
        actually_deleted: (!input.archive_only && actionResult) ? actionResult.changes : 0,
        archived: (input.archive_only && actionResult) ? actionResult.changes : 0,
        deletion_candidates: toDelete.map(t => ({
          id: t.trip_id,
          name: t.trip_name,
          destinations: t.destinations,
          status: t.status,
          reason: 'Matched deletion patterns'
        })),
        preserved_trips: preserved.map(t => ({
          id: t.trip_id,
          name: t.trip_name,
          destinations: t.destinations,
          status: t.status,
          reason: 'In preserve list'
        })),
        message: input.dry_run 
          ? `Dry run: Found ${toDelete.length} trips to ${input.archive_only ? 'archive' : 'delete'}, ${preserved.length} preserved`
          : input.archive_only
            ? `Archived ${actionResult?.changes || 0} trips, preserved ${preserved.length}`
            : `Deleted ${actionResult?.changes || 0} trips, preserved ${preserved.length}`
      };

    } catch (error: any) {
      console.error('cleanup_duplicate_trips error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'cleanup_duplicate_trips',
        error_message: error.message,
        table_names: 'trips_v2,trip_client_assignments,ActivityLog',
        context: extractOperationContext('cleanup_duplicate_trips', input)
      });
      
      return createErrorResponse(error, 'Trip Cleanup', input, sessionId);
    }
  }
};

// Helper function
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
