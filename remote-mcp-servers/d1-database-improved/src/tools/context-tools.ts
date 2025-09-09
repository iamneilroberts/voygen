import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';
import { generateSessionId } from '../utils/session-management';

/**
 * Context management tools for maintaining conversation memory and trip context
 */

export const rememberContextTool = {
  name: 'remember_context',
  description: 'Store important facts from the current conversation to avoid repeated lookups',
  inputSchema: z.object({
    session_id: z.string().describe('Current session identifier'),
    facts: z.array(z.object({
      type: z.enum(['preference', 'constraint', 'decision', 'context']),
      subject: z.string(),
      fact: z.string()
    })).describe('Facts learned in this conversation'),
    active_context: z.object({
      trip_name: z.string().optional(),
      client_email: z.string().optional(),
      current_focus: z.string().optional()
    }).optional()
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const existing = await db.prepare(
        'SELECT * FROM llm_conversation_memory WHERE session_id = ?'
      ).bind(input.session_id).first();

      if (existing) {
        // Append new facts
        const existingFacts = JSON.parse(existing.learned_facts || '[]');
        const updatedFacts = [...existingFacts, ...input.facts];
        
        await db.prepare(`
          UPDATE llm_conversation_memory 
          SET learned_facts = ?,
              active_entities = ?,
              memory_context = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `).bind(
          JSON.stringify(updatedFacts),
          JSON.stringify(input.active_context || {}),
          `Current session facts:\n${updatedFacts.map((f: any) => `• ${f.subject}: ${f.fact}`).join('\n')}`,
          input.session_id
        ).run();
      } else {
        // Create new memory entry
        await db.prepare(`
          INSERT INTO llm_conversation_memory (
            session_id,
            learned_facts,
            active_entities,
            memory_context,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          input.session_id,
          JSON.stringify(input.facts),
          JSON.stringify(input.active_context || {}),
          `Session facts:\n${input.facts.map((f: any) => `• ${f.subject}: ${f.fact}`).join('\n')}`
        ).run();
      }

      return {
        success: true,
        message: `Stored ${input.facts.length} facts for session ${input.session_id}`,
        facts_stored: input.facts.length
      };

    } catch (error: any) {
      console.error('remember_context error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'remember_context',
        error_message: error.message,
        table_names: 'llm_conversation_memory',
        context: extractOperationContext('remember_context', input)
      });
      
      return createErrorResponse(error, 'Context Storage', input, sessionId);
    }
  }
};

export const regenerateContextTool = {
  name: 'regenerate_context',
  description: 'Manually regenerate LLM context cache for a specific trip or client',
  inputSchema: z.object({
    trip_id: z.number().optional().describe('Trip ID to regenerate context for'),
    trip_name: z.string().optional().describe('Trip name to regenerate context for'),
    client_id: z.number().optional().describe('Client ID to regenerate context for'),
    client_email: z.string().optional().describe('Client email to regenerate context for')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      let contextData: any = {};
      let contextType = '';
      
      if (input.trip_id || input.trip_name) {
        // Regenerate trip context
        const tripQuery = input.trip_id 
          ? 'SELECT * FROM trips_v2 WHERE trip_id = ?'
          : 'SELECT * FROM trips_v2 WHERE trip_name LIKE ?';
        const tripParam = input.trip_id || `%${input.trip_name}%`;
        
        const trip = await db.prepare(tripQuery).bind(tripParam).first();
        if (!trip) {
          return {
            success: false,
            error: 'Trip not found',
            message: `No trip found for ${input.trip_id ? 'ID ' + input.trip_id : 'name "' + input.trip_name + '"'}`
          };
        }
        
        // Get related data
        const clients = await db.prepare(`
          SELECT * FROM clients_v2 
          WHERE email IN (
            SELECT DISTINCT client_email 
            FROM trip_client_assignments 
            WHERE trip_id = ?
          )
        `).bind(trip.trip_id).all();
        
        const activities = await db.prepare(`
          SELECT * FROM ActivityLog 
          WHERE trip_id = ? 
          ORDER BY created_at DESC 
          LIMIT 20
        `).bind(trip.trip_id).all();
        
        contextData = {
          trip: trip,
          clients: clients.results,
          recent_activities: activities.results,
          workflow_state: trip.workflow_state ? JSON.parse(trip.workflow_state) : null
        };
        contextType = 'trip';
        
      } else if (input.client_id || input.client_email) {
        // Regenerate client context
        const clientQuery = input.client_id
          ? 'SELECT * FROM clients_v2 WHERE client_id = ?'
          : 'SELECT * FROM clients_v2 WHERE email = ?';
        const clientParam = input.client_id || input.client_email;
        
        const client = await db.prepare(clientQuery).bind(clientParam).first();
        if (!client) {
          return {
            success: false,
            error: 'Client not found',
            message: `No client found for ${input.client_id ? 'ID ' + input.client_id : 'email "' + input.client_email + '"'}`
          };
        }
        
        // Get client's trips
        const trips = await db.prepare(`
          SELECT t.* FROM trips_v2 t
          INNER JOIN trip_client_assignments tca ON t.trip_id = tca.trip_id
          WHERE tca.client_email = ?
          ORDER BY t.updated_at DESC
        `).bind(client.email).all();
        
        contextData = {
          client: client,
          trips: trips.results,
          preferences: client.preferences ? JSON.parse(client.preferences) : {},
          travel_docs: client.travel_docs ? JSON.parse(client.travel_docs) : {}
        };
        contextType = 'client';
      } else {
        return {
          success: false,
          error: 'Missing identifier',
          message: 'Please provide either trip_id, trip_name, client_id, or client_email'
        };
      }
      
      // Generate context summary
      const contextSummary = generateContextSummary(contextData, contextType);
      const sessionId = generateSessionId();
      
      // Store regenerated context
      await db.prepare(`
        INSERT OR REPLACE INTO llm_trip_context (
          natural_key,
          context_data,
          context_summary,
          last_updated,
          search_keywords,
          context_hash
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `).bind(
        input.trip_name || input.client_email || `${contextType}_${input.trip_id || input.client_id}`,
        JSON.stringify(contextData),
        contextSummary,
        extractSearchKeywords(contextData, contextType).join(','),
        generateContextHash(contextData)
      ).run();
      
      return {
        success: true,
        message: `Successfully regenerated ${contextType} context`,
        context_type: contextType,
        summary: contextSummary,
        session_id: sessionId
      };
      
    } catch (error: any) {
      console.error('regenerate_context error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'regenerate_context',
        error_message: error.message,
        table_names: 'llm_trip_context,trips_v2,clients_v2',
        context: extractOperationContext('regenerate_context', input)
      });
      
      return createErrorResponse(error, 'Context Regeneration', input, sessionId);
    }
  }
};

// Helper functions
function generateContextSummary(contextData: any, contextType: string): string {
  if (contextType === 'trip') {
    const trip = contextData.trip;
    const clientNames = contextData.clients?.map((c: any) => c.full_name).join(', ') || 'Unknown';
    const workflowPhase = contextData.workflow_state?.current_phase || 'Not started';
    
    return `Trip: ${trip.trip_name}
Client(s): ${clientNames}
Destinations: ${trip.destinations}
Dates: ${trip.start_date} to ${trip.end_date}
Status: ${trip.status}
Workflow Phase: ${workflowPhase}
Total Cost: $${trip.total_cost || 0}`;
    
  } else if (contextType === 'client') {
    const client = contextData.client;
    const tripCount = contextData.trips?.length || 0;
    const preferences = Object.keys(contextData.preferences || {}).join(', ');
    
    return `Client: ${client.full_name}
Email: ${client.email}
Phone: ${client.phone || 'Not provided'}
Trips: ${tripCount} trip(s)
Preferences: ${preferences || 'None specified'}`;
  }
  
  return 'Context summary not available';
}

function extractSearchKeywords(contextData: any, contextType: string): string[] {
  const keywords: string[] = [];
  
  if (contextType === 'trip') {
    const trip = contextData.trip;
    keywords.push(
      trip.trip_name,
      trip.destinations,
      trip.status,
      ...contextData.clients?.map((c: any) => c.full_name) || []
    );
  } else if (contextType === 'client') {
    const client = contextData.client;
    keywords.push(
      client.full_name,
      client.email,
      ...contextData.trips?.map((t: any) => t.trip_name) || []
    );
  }
  
  return keywords.filter(k => k && k.trim().length > 0);
}

function generateContextHash(contextData: any): string {
  // Simple hash generation based on JSON stringify
  const str = JSON.stringify(contextData);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}