/**
 * Fact table management tools for D1 Travel Database
 * Handles trip facts generation, queries, and maintenance
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';
import { FactTableManager } from '../database/facts';

export function registerFactManagementTools(server: McpServer, getEnv: () => Env) {
  
  // Tool: refresh_trip_facts
  server.tool(
    "refresh_trip_facts",
    {
      trip_id: z.string().optional().describe("Specific trip ID to refresh (optional)"),
      limit: z.number().default(50).max(1000).describe("Maximum number of trips to refresh"),
      force_refresh: z.boolean().default(false).describe("Force refresh even if not marked dirty")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const factManager = new FactTableManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let refreshedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        if (params.trip_id) {
          // Refresh specific trip
          try {
            await factManager.refreshTripFacts(params.trip_id);
            refreshedCount = 1;
          } catch (error) {
            errorCount = 1;
            errors.push(`Failed to refresh trip ${params.trip_id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          // Refresh dirty trips or all if force_refresh
          let query: string;
          if (params.force_refresh) {
            query = `
              SELECT t.trip_id 
              FROM Trips t 
              WHERE t.status != 'cancelled' 
              ORDER BY t.updated_at DESC 
              LIMIT ?
            `;
          } else {
            query = `
              SELECT DISTINCT fd.trip_id 
              FROM facts_dirty fd
              JOIN Trips t ON fd.trip_id = t.trip_id
              WHERE t.status != 'cancelled'
              LIMIT ?
            `;
          }

          const tripsToRefresh = await env.DB.prepare(query).bind(params.limit).all();
          
          for (const trip of tripsToRefresh.results || []) {
            try {
              await factManager.refreshTripFacts(trip.trip_id);
              refreshedCount++;
              
              // Remove from dirty list
              await env.DB.prepare(`
                DELETE FROM facts_dirty WHERE trip_id = ?
              `).bind(trip.trip_id).run();
              
            } catch (error) {
              errorCount++;
              const errorMsg = `Failed to refresh trip ${trip.trip_id}: ${error instanceof Error ? error.message : String(error)}`;
              errors.push(errorMsg);
              console.error(errorMsg);
            }
          }
        }

        return {
          success: true,
          message: `Trip facts refresh completed`,
          results: {
            refreshed_count: refreshedCount,
            error_count: errorCount,
            error_details: errors.length > 0 ? errors : undefined,
            refresh_type: params.trip_id ? 'single_trip' : (params.force_refresh ? 'force_all' : 'dirty_only')
          }
        };

      } catch (error) {
        const errorMsg = `Trip facts refresh failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('refresh_trip_facts', errorMsg, { trip_id: params.trip_id });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: query_trip_facts
  server.tool(
    "query_trip_facts",
    {
      query: z.string().describe("Natural language query or search terms"),
      trip_ids: z.array(z.string()).optional().describe("Specific trip IDs to search"),
      filters: z.object({
        destination: z.string().optional(),
        client_email: z.string().optional(),
        status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
        date_range: z.object({
          start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
          end: z.string().optional().describe("End date (YYYY-MM-DD)")
        }).optional(),
        price_range: z.object({
          min: z.number().optional(),
          max: z.number().optional()
        }).optional()
      }).optional().describe("Structured filters"),
      return_fields: z.array(z.string()).optional().describe("Specific fields to return"),
      limit: z.number().default(20).max(100).describe("Maximum results to return")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let whereClause = "WHERE 1=1";
        const bindings: any[] = [];

        // Handle specific trip IDs
        if (params.trip_ids && params.trip_ids.length > 0) {
          const placeholders = params.trip_ids.map(() => '?').join(', ');
          whereClause += ` AND tf.trip_id IN (${placeholders})`;
          bindings.push(...params.trip_ids);
        }

        // Handle structured filters
        if (params.filters) {
          if (params.filters.destination) {
            whereClause += " AND JSON_EXTRACT(tf.facts, '$.destination') LIKE ?";
            bindings.push(`%${params.filters.destination}%`);
          }

          if (params.filters.client_email) {
            whereClause += " AND JSON_EXTRACT(tf.facts, '$.client.email') = ?";
            bindings.push(params.filters.client_email);
          }

          if (params.filters.status) {
            whereClause += " AND JSON_EXTRACT(tf.facts, '$.status') = ?";
            bindings.push(params.filters.status);
          }

          if (params.filters.date_range?.start) {
            whereClause += " AND JSON_EXTRACT(tf.facts, '$.dates.start') >= ?";
            bindings.push(params.filters.date_range.start);
          }

          if (params.filters.date_range?.end) {
            whereClause += " AND JSON_EXTRACT(tf.facts, '$.dates.end') <= ?";
            bindings.push(params.filters.date_range.end);
          }

          if (params.filters.price_range?.min) {
            whereClause += " AND tf.lead_price_min >= ?";
            bindings.push(params.filters.price_range.min);
          }

          if (params.filters.price_range?.max) {
            whereClause += " AND tf.lead_price_min <= ?";
            bindings.push(params.filters.price_range.max);
          }
        }

        // Handle text search across facts JSON
        if (params.query && !params.trip_ids) {
          const searchTerms = params.query.toLowerCase().split(' ').filter(term => term.length > 2);
          for (const term of searchTerms) {
            whereClause += " AND tf.facts LIKE ?";
            bindings.push(`%${term}%`);
          }
        }

        const query = `
          SELECT 
            tf.trip_id,
            tf.facts,
            tf.lead_price_min,
            tf.total_commission_potential,
            tf.availability_status,
            tf.last_availability_check,
            tf.updated_at,
            t.status as trip_status,
            t.created_at as trip_created
          FROM trip_facts tf
          JOIN Trips t ON tf.trip_id = t.trip_id
          ${whereClause}
          ORDER BY tf.updated_at DESC
          LIMIT ?
        `;

        bindings.push(params.limit);

        const results = await env.DB.prepare(query).bind(...bindings).all();

        const trips = results.results?.map((row: any) => {
          const facts = JSON.parse(row.facts);
          
          // Filter return fields if specified
          if (params.return_fields && params.return_fields.length > 0) {
            const filteredFacts: any = {};
            for (const field of params.return_fields) {
              if (facts[field] !== undefined) {
                filteredFacts[field] = facts[field];
              }
            }
            facts = filteredFacts;
          }

          return {
            trip_id: row.trip_id,
            facts,
            metadata: {
              lead_price_min: row.lead_price_min,
              total_commission_potential: row.total_commission_potential,
              availability_status: row.availability_status,
              last_availability_check: row.last_availability_check,
              trip_status: row.trip_status,
              facts_updated: row.updated_at,
              trip_created: row.trip_created
            }
          };
        }) || [];

        return {
          success: true,
          results: trips,
          total_found: trips.length,
          query_info: {
            search_query: params.query,
            filters_applied: params.filters,
            return_fields: params.return_fields,
            execution_time: Date.now()
          }
        };

      } catch (error) {
        const errorMsg = `Trip facts query failed: ${error instanceof Error ? error.message : String(error)}`;
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: mark_facts_dirty
  server.tool(
    "mark_facts_dirty",
    {
      trip_ids: z.array(z.string()).describe("Trip IDs to mark as dirty"),
      reason: z.string().optional().describe("Reason for marking dirty")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let markedCount = 0;

        for (const tripId of params.trip_ids) {
          try {
            // Insert or ignore (in case already marked dirty)
            await env.DB.prepare(`
              INSERT OR IGNORE INTO facts_dirty (trip_id) VALUES (?)
            `).bind(tripId).run();
            markedCount++;
          } catch (error) {
            console.error(`Failed to mark trip ${tripId} as dirty:`, error);
          }
        }

        return {
          success: true,
          message: `Marked ${markedCount} trips as dirty for fact refresh`,
          results: {
            marked_count: markedCount,
            reason: params.reason
          }
        };

      } catch (error) {
        const errorMsg = `Failed to mark trips dirty: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('mark_facts_dirty', errorMsg, { trip_ids: params.trip_ids });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: get_facts_stats
  server.tool(
    "get_facts_stats",
    {
      include_dirty: z.boolean().default(true).describe("Include dirty facts count")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        // Get total facts count
        const totalFacts = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM trip_facts
        `).first();

        // Get facts by availability status
        const availabilityStats = await env.DB.prepare(`
          SELECT 
            availability_status,
            COUNT(*) as count
          FROM trip_facts 
          GROUP BY availability_status
        `).all();

        // Get dirty facts count if requested
        let dirtyCount = 0;
        if (params.include_dirty) {
          const dirty = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM facts_dirty
          `).first();
          dirtyCount = dirty?.count || 0;
        }

        // Get recent refresh activity
        const recentRefreshes = await env.DB.prepare(`
          SELECT COUNT(*) as count 
          FROM trip_facts 
          WHERE updated_at > datetime('now', '-1 hour')
        `).first();

        return {
          success: true,
          stats: {
            total_facts: totalFacts?.count || 0,
            dirty_facts: dirtyCount,
            recent_refreshes: recentRefreshes?.count || 0,
            availability_breakdown: availabilityStats.results?.map((row: any) => ({
              status: row.availability_status || 'unknown',
              count: row.count
            })) || []
          }
        };

      } catch (error) {
        const errorMsg = `Failed to get facts stats: ${error instanceof Error ? error.message : String(error)}`;
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );
}