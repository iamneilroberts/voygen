/**
 * D1 Travel Database MCP Server - Proper MCP SDK Implementation
 * Based on MCP Development Guide patterns
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from './types';
import { DatabaseManager } from './database/manager';
import { SchemaValidator } from './database/validation';
import { ErrorLogger } from './database/errors';
import { FactTableManager } from './database/facts';
import { TriggerManager } from './database/triggers';
import { llmOptimizedTools } from './tools/llm-optimized-tools';
import { generateSlugFromTripData, ensureUniqueSlug } from './utils/slug-generator';
import { registerHotelManagementTools } from './tools/hotel-management';
import { registerFactManagementTools } from './tools/fact-management';
import { registerCommissionEngineTools } from './tools/commission-engine';
import { registerDatabaseRepairTools } from './tools/database-repair';
import { 
  generateProposalSchema,
  previewProposalSchema,
  listTemplatesSchema,
  handleGenerateProposal,
  handlePreviewProposal,
  handleListTemplates
} from './tools/proposal-tools';

// Create server instance with tools capability
const server = new Server({
  name: 'D1 Travel Database',
  version: '4.2.0',
  description: 'D1 Travel Database MCP for trip and client management'
}, {
  capabilities: {
    tools: {}
  }
});

// Global environment reference
let globalEnv: Env;

// Tool definitions - Database management tools + LLM-optimized tools
const tools = [
  {
    name: 'health_check',
    description: 'Check database health and status',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  {
    name: 'update_activitylog_clients',
    description: 'Update ActivityLog entries to populate client_id from trip_id',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  {
    name: 'reset_activitylog_from_trips',
    description: 'Clear ActivityLog and repopulate from Trips table updated_at column',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  {
    name: 'explore_database',
    description: 'Show all tables and their structure in the database',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  {
    name: 'refresh_trip_facts',
    description: 'Refresh trip_facts for trips marked dirty (up to 50 per call)',
    inputSchema: zodToJsonSchema(z.object({ limit: z.number().optional().default(50) })) as any
  },
  {
    name: 'deploy_fact_triggers',
    description: 'Ensure triggers that mark facts_dirty are present',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  // TEMPORARILY DISABLED: Hotel Management Tools (Schema Issues)
  // NOTE: These tools need schema fixes and handler implementation
  // See Task 3 in .project/tasks/03-hotel-management-fix.md for details
  // {
  //   name: 'ingest_hotels',
  //   description: 'Store hotel availability data in cache',
  //   inputSchema: zodToJsonSchema(z.object({
  //     trip_id: z.string(),
  //     hotels: z.array(z.any()),
  //     site: z.enum(['navitrip', 'trisept', 'vax']),
  //     session_id: z.string().optional()
  //   })) as any
  // },
  // {
  //   name: 'ingest_rooms',
  //   description: 'Store room-level pricing data',
  //   inputSchema: zodToJsonSchema(z.object({
  //     trip_id: z.string(),
  //     hotel_key: z.string(),
  //     rooms: z.array(z.any()),
  //     site: z.enum(['navitrip', 'trisept', 'vax']),
  //     session_id: z.string().optional()
  //   })) as any
  // },
  // {
  //   name: 'query_hotels',
  //   description: 'Query cached hotel data with filters',
  //   inputSchema: zodToJsonSchema(z.object({
  //     trip_id: z.string().optional(),
  //     city: z.string().optional(),
  //     site: z.enum(['navitrip', 'trisept', 'vax']).optional(),
  //     price_range: z.object({
  //       min: z.number().optional(),
  //       max: z.number().optional()
  //     }).optional(),
  //     refundable_only: z.boolean().optional(),
  //     sort_by: z.enum(['price', 'rating', 'commission']).default('price'),
  //     limit: z.number().max(100).default(20)
  //   })) as any
  // },
  // Fact Management Tools
  {
    name: 'query_trip_facts',
    description: 'Query trip facts with natural language or filters',
    inputSchema: zodToJsonSchema(z.object({
      query: z.string(),
      trip_ids: z.array(z.string()).optional(),
      filters: z.any().optional(),
      return_fields: z.array(z.string()).optional(),
      limit: z.number().max(100).default(20)
    })) as any
  },
  {
    name: 'mark_facts_dirty',
    description: 'Mark trip facts as dirty for refresh',
    inputSchema: zodToJsonSchema(z.object({
      trip_ids: z.array(z.string()),
      reason: z.string().optional()
    })) as any
  },
  {
    name: 'get_facts_stats',
    description: 'Get statistics about trip facts table',
    inputSchema: zodToJsonSchema(z.object({
      include_dirty: z.boolean().default(true)
    })) as any
  },
  // TEMPORARILY DISABLED: Commission Tools (Not Used)
  // NOTE: No evidence of active use, remove to simplify system
  // {
  //   name: 'configure_commission_rates',
  //   description: 'Configure commission rates for booking sites',
  //   inputSchema: zodToJsonSchema(z.object({
  //     site: z.enum(['navitrip', 'trisept', 'vax']),
  //     accommodation_type: z.enum(['hotel', 'resort', 'villa']).default('hotel'),
  //     rate_type: z.enum(['standard', 'refundable', 'promo']).optional(),
  //     commission_percent: z.number().min(0).max(50),
  //     min_commission_amount: z.number().optional(),
  //     effective_from: z.string().optional(),
  //     effective_until: z.string().optional(),
  //     notes: z.string().optional()
  //   })) as any
  // },
  // {
  //   name: 'optimize_commission',
  //   description: 'Optimize hotel selection for maximum commission',
  //   inputSchema: zodToJsonSchema(z.object({
  //     trip_id: z.string(),
  //     optimization_rules: z.array(z.string()).optional(),
  //     budget_constraints: z.any().optional(),
  //     client_preferences: z.any().optional(),
  //     return_top_n: z.number().max(20).default(5)
  //   })) as any
  // },
  // {
  //   name: 'calculate_trip_commission',
  //   description: 'Calculate commission for a trip',
  //   inputSchema: zodToJsonSchema(z.object({
  //     trip_id: z.string(),
  //     include_potential: z.boolean().default(true)
  //   })) as any
  // },
  // Proposal Generation Tools
  {
    name: 'generate_proposal',
    description: 'Generate a travel proposal from trip data with HTML rendering and optional PDF',
    inputSchema: zodToJsonSchema(generateProposalSchema) as any
  },
  {
    name: 'preview_proposal',
    description: 'Preview proposal HTML without saving to database',
    inputSchema: zodToJsonSchema(previewProposalSchema) as any
  },
  {
    name: 'list_templates',
    description: 'List available proposal templates and generation capabilities',
    inputSchema: zodToJsonSchema(listTemplatesSchema) as any
  },
  // Maintenance tools
  {
    name: 'backfill_trip_slugs',
    description: 'Generate missing trip_slug values for trips_v2 and ensure uniqueness',
    inputSchema: zodToJsonSchema(z.object({ dry_run: z.boolean().optional().default(false) })) as any
  },
  {
    name: 'rebuild_search_index',
    description: 'Rebuild normalized search_index entries from trips_v2 and clients_v2',
    inputSchema: zodToJsonSchema(z.object({})) as any
  },
  // REMOVED: Database Repair Tools (No Longer Needed)
  // NOTE: Root schema issues fixed in Task 1, these repair tools are obsolete
  // Migration 008 resolved the fundamental schema problems they were designed to fix
  // {
  //   name: 'comprehensive_schema_fix',
  //   description: 'Fix critical database schema issues including facts_dirty, TripParticipants, and TripDays',
  //   inputSchema: zodToJsonSchema(z.object({
  //     dry_run: z.boolean().default(true).describe("If true, only show what would be changed without executing"),
  //     fix_facts_dirty: z.boolean().default(true).describe("Fix facts_dirty data type and foreign key issues"),
  //     fix_trip_participants: z.boolean().default(true).describe("Fix TripParticipants foreign key references"),
  //     fix_trip_days: z.boolean().default(true).describe("Fix TripDays schema alignment"),
  //     recreate_trip_facts: z.boolean().default(false).describe("Recreate trip_facts table with correct schema"),
  //     clean_orphaned_data: z.boolean().default(true).describe("Remove orphaned records")
  //   })) as any
  // },
  // {
  //   name: 'repair_trip_facts_schema',
  //   description: 'Legacy tool: Fix trip facts schema inconsistencies and foreign key constraint problems',
  //   inputSchema: zodToJsonSchema(z.object({
  //     dry_run: z.boolean().default(true).describe("If true, only show what would be changed without executing"),
  //     fix_data_types: z.boolean().default(true).describe("Fix trip_id data type mismatches"),
  //     recreate_tables: z.boolean().default(false).describe("Recreate trip_facts and facts_dirty tables with correct schema")
  //   })) as any
  // },
  // {
  //   name: 'analyze_foreign_key_issues',
  //   description: 'Analyze database foreign key constraint issues and schema inconsistencies',
  //   inputSchema: zodToJsonSchema(z.object({})) as any
  // },
  // Add LLM-optimized tools
  ...llmOptimizedTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema) as any
  }))
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const dbManager = new DatabaseManager(globalEnv);
  const errorLogger = new ErrorLogger(globalEnv);
  const factManager = new FactTableManager(globalEnv);
  const triggerManager = new TriggerManager(globalEnv);
  
  try {
    switch (name) {
      case 'health_check':
        return await handleHealthCheck(dbManager);
        
      case 'update_activitylog_clients':
        return await handleUpdateActivityLogClients(dbManager, errorLogger);
        
      case 'reset_activitylog_from_trips':
        return await handleResetActivityLogFromTrips(dbManager, errorLogger);
        
      case 'explore_database':
        return await handleExploreDatabase(dbManager, errorLogger);
      case 'refresh_trip_facts':
        return await handleRefreshTripFacts(factManager, request.params.arguments as any);
      case 'deploy_fact_triggers':
        await triggerManager.deployTripFactsTriggers();
        return { content: [{ type: 'text', text: '✅ Fact triggers ensured' }]};
        
      // Hotel Management Tools
      case 'ingest_hotels':
        return await handleIngestHotels(args);
      case 'ingest_rooms':
        return await handleIngestRooms(args);
      case 'query_hotels':
        return await handleQueryHotels(args);
        
      // Fact Management Tools
      case 'query_trip_facts':
        return await handleQueryTripFacts(args);
      case 'mark_facts_dirty':
        return await handleMarkFactsDirty(args);
      case 'get_facts_stats':
        return await handleGetFactsStats(args);
        
      // Commission Tools - REMOVED (tools disabled)
      // case 'configure_commission_rates':
      //   return await handleConfigureCommissionRates(args);
      // case 'optimize_commission':
      //   return await handleOptimizeCommission(args);
      // case 'calculate_trip_commission':
      //   return await handleCalculateTripCommission(args);
        
      // Proposal Generation Tools
      case 'generate_proposal':
        const generateResult = await handleGenerateProposal(args, globalEnv.DB);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(generateResult, null, 2)
          }]
        };
      case 'preview_proposal':
        const previewResult = await handlePreviewProposal(args, globalEnv.DB);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(previewResult, null, 2)
          }]
        };
      case 'list_templates':
        const templatesResult = await handleListTemplates();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(templatesResult, null, 2)
          }]
        };
      case 'backfill_trip_slugs':
        return await handleBackfillTripSlugs(globalEnv.DB, (request.params.arguments as any)?.dry_run);
      case 'rebuild_search_index':
        return await handleRebuildSearchIndex(globalEnv.DB);
        
      // Database Repair Tools - REMOVED (tools disabled, root issues fixed)
      // case 'comprehensive_schema_fix':
      //   return await handleComprehensiveSchemaFix(dbManager, errorLogger, args);
      // case 'repair_trip_facts_schema':
      //   return await handleRepairTripFactsSchema(dbManager, errorLogger, args);
      // case 'analyze_foreign_key_issues':
      //   return await handleAnalyzeForeignKeyIssues(dbManager, errorLogger);
        
      default:
        // Handle all LLM-optimized tools dynamically
        const llmTool = llmOptimizedTools.find(t => t.name === name);
        if (llmTool) {
          // Apply schema validation and defaults
          const validatedInput = llmTool.inputSchema.parse(args || {});
          const result = await llmTool.handler(validatedInput, globalEnv.DB);
          return {
            content: [{
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }]
          };
        }
        
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    await errorLogger.logToolError(name, error, `Failed to execute ${name}`);
    return {
      content: [{
        type: 'text',
        text: `Error executing ${name}: ${error.message}`
      }]
    };
  }
});

// Tool implementations
async function handleHealthCheck(dbManager: DatabaseManager) {
  const initialized = await dbManager.ensureInitialized();
  const validator = new SchemaValidator(globalEnv);
  const v = await validator.validate();
  const base = `Database Status: ${initialized ? '✅ Healthy' : '❌ Not Initialized'}\nVersion: 4.2.0`;
  const extra = (v.content?.[0]?.type === 'text' ? (v.content[0] as any).text : '');
  return {
    content: [{ type: 'text', text: `${base}\n${extra}` }]
  };
}

// ----------------------------------------------------------------------------
// Maintenance handlers
// ----------------------------------------------------------------------------

function normalizeTokens(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/["'()\\/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function handleBackfillTripSlugs(db: any, dryRun = false) {
  const missing = await db.prepare(`
    SELECT trip_id, trip_name, destinations, start_date, primary_client_email, trip_slug
    FROM trips_v2
    WHERE trip_slug IS NULL OR trip_slug = ''
  `).all();

  const rows = missing.results || [];
  let updated = 0;
  const previews: any[] = [];

  for (const row of rows) {
    const base = generateSlugFromTripData(row);
    const unique = await ensureUniqueSlug(db, base, row.trip_id);
    previews.push({ trip_id: row.trip_id, prev: row.trip_slug || null, next: unique });
    if (!dryRun) {
      await db.prepare(`UPDATE trips_v2 SET trip_slug = ? WHERE trip_id = ?`).bind(unique, row.trip_id).run();
      updated++;
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Backfill trip slugs: ${dryRun ? 'DRY RUN' : 'APPLIED'}\nChecked: ${rows.length}\nUpdated: ${updated}\nSample: ${JSON.stringify(previews.slice(0, 10), null, 2)}`
    }]
  };
}

async function handleRebuildSearchIndex(db: any) {
  // Ensure table exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS search_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('trip','client','activity','destination')),
      entity_id INTEGER NOT NULL,
      entity_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      search_tokens TEXT NOT NULL,
      date_context TEXT,
      location_context TEXT,
      relevance_score REAL DEFAULT 1.0,
      access_count INTEGER DEFAULT 0,
      last_accessed TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id)
    )
  `).run();

  await db.prepare(`DELETE FROM search_index`).run();

  // Reindex trips
  const trips = await db.prepare(`
    SELECT trip_id, trip_name, destinations, group_name, trip_slug, start_date, end_date
    FROM trips_v2
  `).all();

  for (const t of (trips.results || [])) {
    const tokens = normalizeTokens(`${t.trip_name} ${t.destinations || ''} ${t.group_name || ''} ${t.trip_slug || ''}`);
    const summary = `${t.trip_name} (${t.start_date} to ${t.end_date}) - ${t.destinations || ''}`;
    const relevance = t.trip_slug ? 1.5 : 1.0;
    await db.prepare(`
      INSERT OR REPLACE INTO search_index (
        entity_type, entity_id, entity_name, summary, search_tokens, date_context, location_context, relevance_score, access_count, last_updated
      ) VALUES ('trip', ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).bind(t.trip_id, t.trip_name, summary, tokens, `${t.start_date} to ${t.end_date}`, t.destinations || '', relevance).run();
  }

  // Reindex clients
  const clients = await db.prepare(`SELECT client_id, full_name, email FROM clients_v2`).all();
  for (const c of (clients.results || [])) {
    const tokens = normalizeTokens(`${c.full_name} ${c.email}`);
    const summary = `${c.full_name} <${c.email}>`;
    await db.prepare(`
      INSERT OR REPLACE INTO search_index (
        entity_type, entity_id, entity_name, summary, search_tokens, relevance_score, access_count, last_updated
      ) VALUES ('client', ?, ?, ?, ?, 1.0, 0, CURRENT_TIMESTAMP)
    `).bind(c.client_id, c.full_name, summary, tokens).run();
  }

  return {
    content: [{ type: 'text', text: `Rebuilt search_index: trips=${(trips.results || []).length}, clients=${(clients.results || []).length}` }]
  };
}

async function handleUpdateActivityLogClients(dbManager: DatabaseManager, errorLogger: ErrorLogger) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    // First, check how many records need updating
    const countCheck = await globalEnv.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM ActivityLog 
      WHERE client_id IS NULL AND trip_id IS NOT NULL
    `).first();

    const recordsToUpdate = countCheck?.count || 0;

    if (recordsToUpdate === 0) {
      return {
        content: [{
          type: 'text',
          text: "✅ No ActivityLog records need client_id updates. All records already have client_id populated or don't have trip_id."
        }]
      };
    }

    // Update ActivityLog entries by setting client_id based on trip_id
    // Use the first client from TripParticipants for each trip
    const updateResult = await globalEnv.DB.prepare(`
      UPDATE ActivityLog 
      SET client_id = (
        SELECT tp.client_id 
        FROM TripParticipants tp 
        WHERE tp.trip_id = ActivityLog.trip_id 
        LIMIT 1
      )
      WHERE client_id IS NULL 
        AND trip_id IS NOT NULL
        AND trip_id IN (SELECT DISTINCT trip_id FROM TripParticipants)
    `).run();

    // Check how many were actually updated
    const afterCount = await globalEnv.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM ActivityLog 
      WHERE client_id IS NULL AND trip_id IS NOT NULL
    `).first();

    const remainingNull = afterCount?.count || 0;
    const updatedCount = recordsToUpdate - remainingNull;

    let resultMessage = `✅ **ActivityLog Client ID Update Complete**

📊 **Results:**
- Records that needed updating: ${recordsToUpdate}
- Successfully updated: ${updatedCount}
- Remaining with NULL client_id: ${remainingNull}

🔧 **What was done:**
- Populated client_id for ActivityLog entries using trip_id
- Used first client from TripParticipants for each trip
- Only updated records where trip_id has associated participants`;

    if (remainingNull > 0) {
      resultMessage += `\n\n⚠️ **Note:** ${remainingNull} records still have NULL client_id. These trips may not have participants in TripParticipants table.`;
    }

    return {
      content: [{
        type: 'text',
        text: resultMessage
      }]
    };

  } catch (error: any) {
    await errorLogger.logToolError("update_activitylog_clients", error, "Failed to update ActivityLog client_id values");
    return {
      content: [{
        type: 'text',
        text: `❌ Error updating ActivityLog client_id values: ${error.message}`
      }]
    };
  }
}

async function handleRefreshTripFacts(facts: FactTableManager, args: { limit?: number }) {
  const n = await facts.refreshDirty(Math.max(1, Math.min(500, args?.limit ?? 50)));
  return {
    content: [{ type: 'text', text: `✅ Refreshed ${n} trip(s) from facts_dirty.` }]
  };
}

async function handleResetActivityLogFromTrips(dbManager: DatabaseManager, errorLogger: ErrorLogger) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    // Get current counts
    const beforeActivityCount = await globalEnv.DB.prepare(`SELECT COUNT(*) as count FROM ActivityLog`).first();
    const tripsCount = await globalEnv.DB.prepare(`SELECT COUNT(*) as count FROM Trips`).first();

    const currentActivityRecords = beforeActivityCount?.count || 0;
    const availableTrips = tripsCount?.count || 0;

    // Clear existing ActivityLog
    await globalEnv.DB.prepare(`DELETE FROM ActivityLog`).run();

    if (availableTrips === 0) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ **No Trips Found**\n\nCleared ${currentActivityRecords} old ActivityLog records, but no Trips available to repopulate from.\n\nCreate some trips first, then run this tool again.`
        }]
      };
    }

    // Get all trips and create ActivityLog entries
    const trips = await globalEnv.DB.prepare(`
      SELECT 
        trip_id,
        trip_name,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM Trips
      ORDER BY updated_at DESC
    `).all();

    let insertedCount = 0;
    const sessionId = `Session-${new Date().toISOString().slice(0, 10)}-DataMigration`;

    // Create activity entries for each trip
    for (const trip of trips.results) {
      const tripData = trip as any;
      
      // Create initial "CreateTrip" activity based on created_at
      await globalEnv.DB.prepare(`
        INSERT INTO ActivityLog (
          session_id, 
          client_id, 
          trip_id, 
          activity_type, 
          activity_timestamp, 
          details
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId,
        null, // Will populate client_id later if needed
        tripData.trip_id,
        'CreateTrip',
        tripData.created_at,
        `Created trip: ${tripData.trip_name || 'Untitled'} (${tripData.start_date || 'No date'} to ${tripData.end_date || 'No date'})`
      ).run();
      insertedCount++;

      // If updated_at is different from created_at, create an "EditTrip" activity
      if (tripData.updated_at !== tripData.created_at) {
        await globalEnv.DB.prepare(`
          INSERT INTO ActivityLog (
            session_id, 
            client_id, 
            trip_id, 
            activity_type, 
            activity_timestamp, 
            details
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          sessionId,
          null, // Will populate client_id later if needed
          tripData.trip_id,
          'EditTrip',
          tripData.updated_at,
          `Updated trip: ${tripData.trip_name || 'Untitled'} (${tripData.start_date || 'No date'} to ${tripData.end_date || 'No date'})`
        ).run();
        insertedCount++;
      }
    }

    const afterCount = await globalEnv.DB.prepare(`SELECT COUNT(*) as count FROM ActivityLog`).first();
    const finalCount = afterCount?.count || 0;

    const resultMessage = `✅ **ActivityLog Reset Complete**

📊 **Migration Results:**
- Cleared old ActivityLog records: ${currentActivityRecords}
- Trips processed: ${availableTrips}
- New ActivityLog entries created: ${insertedCount}
- Final ActivityLog record count: ${finalCount}

🔧 **What was done:**
- Cleared all existing ActivityLog entries
- Created "CreateTrip" activity for each trip using created_at timestamp
- Created "EditTrip" activity for trips where updated_at differs from created_at
- Used session ID: ${sessionId}

💡 **Result:** travel_agent_start should now show recent trip activity based on actual trip data.`;

    return {
      content: [{
        type: 'text',
        text: resultMessage
      }]
    };

  } catch (error: any) {
    await errorLogger.logToolError("reset_activitylog_from_trips", error, "Failed to reset ActivityLog from Trips");
    return {
      content: [{
        type: 'text',
        text: `❌ Error resetting ActivityLog: ${error.message}`
      }]
    };
  }
}

async function handleExploreDatabase(dbManager: DatabaseManager, errorLogger: ErrorLogger) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    // List all tables
    const tables = await globalEnv.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();

    let result = "📊 **Database Structure**\n\n";
    
    if (tables.results.length === 0) {
      result += "No tables found in database.\n";
    } else {
      result += `Found ${tables.results.length} tables:\n\n`;
      
      for (const table of tables.results) {
        const tableName = (table as any).name;
        result += `### ${tableName}\n`;
        
        try {
          // Get table schema
          const schema = await globalEnv.DB.prepare(`PRAGMA table_info(${tableName})`).all();
          
          if (schema.results.length > 0) {
            result += "**Columns:**\n";
            for (const col of schema.results) {
              const column = col as any;
              result += `- ${column.name} (${column.type})${column.pk ? ' PRIMARY KEY' : ''}${column.notnull ? ' NOT NULL' : ''}\n`;
            }
          }
          
          // Get row count
          const count = await globalEnv.DB.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
          result += `**Row count:** ${(count as any)?.count || 0}\n\n`;
          
        } catch (e) {
          result += `Error querying table: ${e}\n\n`;
        }
      }
    }

    return {
      content: [{
        type: 'text',
        text: result
      }]
    };

  } catch (error: any) {
    await errorLogger.logToolError("explore_database", error, "Failed to explore database");
    return {
      content: [{
        type: 'text',
        text: `❌ Error exploring database: ${error.message}`
      }]
    };
  }
}

// Hotel Management Tool Handlers
async function handleIngestHotels(args: any) {
  const dbManager = new DatabaseManager(globalEnv);
  const errorLogger = new ErrorLogger(globalEnv);
  
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const hotel of args.hotels || []) {
      try {
        const existing = await globalEnv.DB.prepare(`
          SELECT id FROM hotel_cache 
          WHERE trip_id = ? AND site = ? AND JSON_EXTRACT(json, '$.site_id') = ?
        `).bind(args.trip_id, args.site, hotel.site_id).first();

        const hotelData = {
          trip_id: args.trip_id,
          city: hotel.city,
          giata_id: hotel.giata_id || null,
          site: args.site,
          json: JSON.stringify(hotel),
          lead_price_amount: hotel.lead_price?.amount || 0,
          lead_price_currency: hotel.lead_price?.currency || 'USD',
          refundable: hotel.refundable ? 1 : 0
        };

        if (existing) {
          await globalEnv.DB.prepare(`
            UPDATE hotel_cache 
            SET json = ?, lead_price_amount = ?, updated_at = datetime('now')
            WHERE id = ?
          `).bind(hotelData.json, hotelData.lead_price_amount, existing.id).run();
          updatedCount++;
        } else {
          await globalEnv.DB.prepare(`
            INSERT INTO hotel_cache (
              trip_id, city, giata_id, site, json, 
              lead_price_amount, lead_price_currency, refundable,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            hotelData.trip_id, hotelData.city, hotelData.giata_id,
            hotelData.site, hotelData.json, hotelData.lead_price_amount,
            hotelData.lead_price_currency, hotelData.refundable
          ).run();
          insertedCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push(`Hotel ${hotel.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Hotel ingestion completed',
          results: { inserted: insertedCount, updated: updatedCount, errors: errorCount }
        }, null, 2)
      }]
    };
  } catch (error) {
    const errorMsg = `Hotel ingestion failed: ${error instanceof Error ? error.message : String(error)}`;
    await errorLogger.logError('ingest_hotels', errorMsg, args);
    return { content: [{ type: 'text', text: errorMsg }] };
  }
}

async function handleIngestRooms(args: any) {
  // Similar implementation to hotels but for rooms
  return { content: [{ type: 'text', text: 'Room ingestion functionality ready' }] };
}

async function handleQueryHotels(args: any) {
  const dbManager = new DatabaseManager(globalEnv);
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    let whereClause = "WHERE 1=1";
    const bindings: any[] = [];

    if (args.trip_id) {
      whereClause += " AND trip_id = ?";
      bindings.push(args.trip_id);
    }
    if (args.city) {
      whereClause += " AND city LIKE ?";
      bindings.push(`%${args.city}%`);
    }

    const query = `
      SELECT * FROM hotel_cache ${whereClause} 
      ORDER BY lead_price_amount ASC LIMIT ?
    `;
    bindings.push(args.limit || 20);

    const results = await globalEnv.DB.prepare(query).bind(...bindings).all();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results: results.results?.map((row: any) => ({
            id: row.id,
            hotel_data: JSON.parse(row.json),
            lead_price: row.lead_price_amount,
            cached_at: row.updated_at
          })) || []
        }, null, 2)
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Query failed: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

// Fact Management Tool Handlers
async function handleQueryTripFacts(args: any) {
  const dbManager = new DatabaseManager(globalEnv);
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    let whereClause = "WHERE 1=1";
    const bindings: any[] = [];

    // Handle specific trip IDs
    if (args.trip_ids && args.trip_ids.length > 0) {
      const placeholders = args.trip_ids.map(() => '?').join(', ');
      whereClause += ` AND tf.trip_id IN (${placeholders})`;
      bindings.push(...args.trip_ids);
    }

    // Handle structured filters for the actual trip_facts schema
    if (args.filters) {
      if (args.filters.price_range?.min) {
        whereClause += " AND tf.total_cost >= ?";
        bindings.push(args.filters.price_range.min);
      }

      if (args.filters.price_range?.max) {
        whereClause += " AND tf.total_cost <= ?";
        bindings.push(args.filters.price_range.max);
      }
    }

    // For text search, we'll search across trip details from trips_v2 table if available
    if (args.query && !args.trip_ids) {
      whereClause += " AND (t2.search_text LIKE ? OR t2.trip_name LIKE ? OR t2.destinations LIKE ?)";
      const searchTerm = `%${args.query}%`;
      bindings.push(searchTerm, searchTerm, searchTerm);
    }

    const query = `
      SELECT 
        tf.trip_id,
        tf.total_nights,
        tf.total_hotels,
        tf.total_activities,
        tf.total_cost,
        tf.transit_minutes,
        tf.last_computed,
        tf.version,
        t2.trip_name,
        t2.status as trip_status,
        t2.destinations,
        t2.start_date,
        t2.end_date,
        t2.created_at as trip_created
      FROM trip_facts tf
      LEFT JOIN trips_v2 t2 ON tf.trip_id = CAST(t2.trip_id AS TEXT)
      ${whereClause}
      ORDER BY tf.last_computed DESC
      LIMIT ?
    `;

    bindings.push(args.limit || 20);

    const results = await globalEnv.DB.prepare(query).bind(...bindings).all();

    const trips = results.results?.map((row: any) => {
      // Build facts object from the simple schema
      const facts = {
        trip_id: row.trip_id,
        trip_name: row.trip_name,
        destinations: row.destinations,
        status: row.trip_status,
        dates: {
          start: row.start_date,
          end: row.end_date
        },
        metrics: {
          total_nights: row.total_nights,
          total_hotels: row.total_hotels,
          total_activities: row.total_activities,
          total_cost: row.total_cost,
          transit_minutes: row.transit_minutes
        },
        computed_at: row.last_computed,
        version: row.version
      };
      
      // Filter return fields if specified
      if (args.return_fields && args.return_fields.length > 0) {
        const filteredFacts: any = {};
        for (const field of args.return_fields) {
          if (facts[field as keyof typeof facts] !== undefined) {
            filteredFacts[field] = facts[field as keyof typeof facts];
          }
        }
        return {
          trip_id: row.trip_id,
          facts: filteredFacts,
          metadata: {
            trip_created: row.trip_created,
            facts_version: row.version
          }
        };
      }

      return {
        trip_id: row.trip_id,
        facts,
        metadata: {
          trip_created: row.trip_created,
          facts_version: row.version
        }
      };
    }) || [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results: trips,
          total_found: trips.length,
          query_info: {
            search_query: args.query,
            filters_applied: args.filters,
            return_fields: args.return_fields,
            schema_type: "simple_metrics",
            execution_time: Date.now()
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Trip facts query failed: ${error instanceof Error ? error.message : String(error)}`;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

async function handleMarkFactsDirty(args: any) {
  const dbManager = new DatabaseManager(globalEnv);
  const errorLogger = new ErrorLogger(globalEnv);
  
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    let markedCount = 0;

    for (const tripId of args.trip_ids || []) {
      try {
        // Insert or ignore (in case already marked dirty)
        await globalEnv.DB.prepare(`
          INSERT OR IGNORE INTO facts_dirty (trip_id) VALUES (?)
        `).bind(tripId).run();
        markedCount++;
      } catch (error) {
        console.error(`Failed to mark trip ${tripId} as dirty:`, error);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Marked ${markedCount} trips as dirty for fact refresh`,
          results: {
            marked_count: markedCount,
            reason: args.reason
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Failed to mark trips dirty: ${error instanceof Error ? error.message : String(error)}`;
    await errorLogger.logError('mark_facts_dirty', errorMsg, { trip_ids: args.trip_ids });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

async function handleGetFactsStats(args: any) {
  const dbManager = new DatabaseManager(globalEnv);
  
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    // Get total facts count
    const totalFacts = await globalEnv.DB.prepare(`
      SELECT COUNT(*) as count FROM trip_facts
    `).first();

    // Get dirty facts count if requested
    let dirtyCount = 0;
    if (args.include_dirty !== false) {
      const dirty = await globalEnv.DB.prepare(`
        SELECT COUNT(*) as count FROM facts_dirty
      `).first();
      dirtyCount = dirty?.count || 0;
    }

    // Get recent refresh activity
    const recentRefreshes = await globalEnv.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM trip_facts 
      WHERE last_computed > datetime('now', '-1 hour')
    `).first();

    // Get basic statistics about the facts
    const aggregateStats = await globalEnv.DB.prepare(`
      SELECT 
        AVG(total_cost) as avg_cost,
        MAX(total_cost) as max_cost,
        AVG(total_nights) as avg_nights,
        MAX(total_nights) as max_nights,
        AVG(total_activities) as avg_activities,
        COUNT(*) as facts_with_activities
      FROM trip_facts 
      WHERE total_activities > 0
    `).first();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          stats: {
            total_facts: totalFacts?.count || 0,
            dirty_facts: dirtyCount,
            recent_refreshes: recentRefreshes?.count || 0,
            cost_stats: {
              avg_cost: aggregateStats?.avg_cost || 0,
              max_cost: aggregateStats?.max_cost || 0
            },
            trip_stats: {
              avg_nights: aggregateStats?.avg_nights || 0,
              max_nights: aggregateStats?.max_nights || 0,
              avg_activities: aggregateStats?.avg_activities || 0,
              facts_with_activities: aggregateStats?.facts_with_activities || 0
            }
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Failed to get facts stats: ${error instanceof Error ? error.message : String(error)}`;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

// Commission Tool Handlers
async function handleConfigureCommissionRates(args: any) {
  try {
    const result = await globalEnv.DB.prepare(`
      INSERT INTO commission_rates (
        site, accommodation_type, commission_percent, created_at
      ) VALUES (?, ?, ?, datetime('now'))
    `).bind(args.site, args.accommodation_type || 'hotel', args.commission_percent).run();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Commission rate configured for ${args.site}`,
          rate_id: result.meta.last_row_id
        }, null, 2)
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Commission config failed: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

async function handleOptimizeCommission(args: any) {
  return { content: [{ type: 'text', text: 'Commission optimization functionality ready' }] };
}

async function handleCalculateTripCommission(args: any) {
  return { content: [{ type: 'text', text: 'Trip commission calculation functionality ready' }] };
}

// Database Repair Tool Handlers
async function handleComprehensiveSchemaFix(dbManager: DatabaseManager, errorLogger: ErrorLogger, args: any) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    const params = {
      dry_run: args.dry_run ?? true,
      fix_facts_dirty: args.fix_facts_dirty ?? true,
      fix_trip_participants: args.fix_trip_participants ?? true,
      fix_trip_days: args.fix_trip_days ?? true,
      recreate_trip_facts: args.recreate_trip_facts ?? false,
      clean_orphaned_data: args.clean_orphaned_data ?? true
    };

    const changes: string[] = [];
    const errors: string[] = [];

    // Import functions from database-repair.ts
    const { 
      analyzeSchemaIssues,
      fixFactsDirtySchema,
      fixTripParticipantsSchema,
      fixTripDaysSchema,
      recreateTripFactsTables,
      cleanOrphanedData
    } = await import('./tools/database-repair');

    // Step 1: Analyze current schema issues
    const schemaAnalysis = await analyzeSchemaIssues(globalEnv);
    changes.push(`Schema Analysis: ${schemaAnalysis.summary}`);

    // Step 2: Fix facts_dirty table
    if (params.fix_facts_dirty) {
      const factsDirtyResult = await fixFactsDirtySchema(globalEnv, params.dry_run);
      changes.push(`Facts Dirty Fix: ${factsDirtyResult.summary}`);
      if (factsDirtyResult.errors.length > 0) {
        errors.push(...factsDirtyResult.errors);
      }
    }

    // Step 3: Fix TripParticipants table
    if (params.fix_trip_participants) {
      const participantsResult = await fixTripParticipantsSchema(globalEnv, params.dry_run);
      changes.push(`TripParticipants Fix: ${participantsResult.summary}`);
      if (participantsResult.errors.length > 0) {
        errors.push(...participantsResult.errors);
      }
    }

    // Step 4: Fix TripDays table
    if (params.fix_trip_days) {
      const tripDaysResult = await fixTripDaysSchema(globalEnv, params.dry_run);
      changes.push(`TripDays Fix: ${tripDaysResult.summary}`);
      if (tripDaysResult.errors.length > 0) {
        errors.push(...tripDaysResult.errors);
      }
    }

    // Step 5: Recreate trip_facts if requested
    if (params.recreate_trip_facts && !params.dry_run) {
      const recreateResult = await recreateTripFactsTables(globalEnv);
      changes.push(`Table Recreation: ${recreateResult.summary}`);
      if (recreateResult.errors.length > 0) {
        errors.push(...recreateResult.errors);
      }
    }

    // Step 6: Clean orphaned data
    if (params.clean_orphaned_data && !params.dry_run) {
      const cleanupResult = await cleanOrphanedData(globalEnv);
      changes.push(`Data Cleanup: ${cleanupResult.summary}`);
      if (cleanupResult.errors.length > 0) {
        errors.push(...cleanupResult.errors);
      }
    }

    const result = {
      success: true,
      message: `Comprehensive schema fix ${params.dry_run ? 'analysis' : 'execution'} completed`,
      results: {
        changes_made: changes,
        errors_encountered: errors,
        dry_run: params.dry_run,
        schema_analysis: schemaAnalysis
      }
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Comprehensive schema fix failed: ${error instanceof Error ? error.message : String(error)}`;
    await errorLogger.logError('comprehensive_schema_fix', errorMsg, args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

async function handleRepairTripFactsSchema(dbManager: DatabaseManager, errorLogger: ErrorLogger, args: any) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    const params = {
      dry_run: args.dry_run ?? true,
      fix_data_types: args.fix_data_types ?? true,
      recreate_tables: args.recreate_tables ?? false
    };

    const changes: string[] = [];
    const errors: string[] = [];

    // Import functions from database-repair.ts
    const { 
      analyzeSchemaIssues,
      fixFactsDirtyDataTypes,
      recreateTripFactsTables
    } = await import('./tools/database-repair');

    // Step 1: Analyze current schema issues
    const schemaAnalysis = await analyzeSchemaIssues(globalEnv);
    changes.push(`Schema Analysis: ${schemaAnalysis.summary}`);

    // Step 2: Fix facts_dirty data type issues
    if (params.fix_data_types) {
      const dataTypeFixResult = await fixFactsDirtyDataTypes(globalEnv, params.dry_run);
      changes.push(`Data Type Fixes: ${dataTypeFixResult.summary}`);
      if (dataTypeFixResult.errors.length > 0) {
        errors.push(...dataTypeFixResult.errors);
      }
    }

    // Step 3: Recreate tables if requested
    if (params.recreate_tables && !params.dry_run) {
      const recreateResult = await recreateTripFactsTables(globalEnv);
      changes.push(`Table Recreation: ${recreateResult.summary}`);
      if (recreateResult.errors.length > 0) {
        errors.push(...recreateResult.errors);
      }
    }

    const result = {
      success: true,
      message: `Database repair ${params.dry_run ? 'analysis' : 'execution'} completed`,
      results: {
        changes_made: changes,
        errors_encountered: errors,
        dry_run: params.dry_run,
        schema_analysis: schemaAnalysis
      }
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Database repair failed: ${error instanceof Error ? error.message : String(error)}`;
    await errorLogger.logError('repair_trip_facts_schema', errorMsg, args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

async function handleAnalyzeForeignKeyIssues(dbManager: DatabaseManager, errorLogger: ErrorLogger) {
  const initialized = await dbManager.ensureInitialized();
  if (!initialized) {
    return dbManager.createInitFailedResponse();
  }

  try {
    const issues: any[] = [];

    // Check trip_facts foreign key
    const tripFactsFK = await globalEnv.DB.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='trip_facts'
    `).first();

    if (tripFactsFK) {
      const createSql = tripFactsFK.sql;
      if (createSql.includes('REFERENCES Trips(id)')) {
        issues.push({
          table: 'trip_facts',
          issue: 'Invalid foreign key reference to Trips(id) - should reference trips_v2(trip_id)',
          severity: 'critical'
        });
      }
      if (createSql.includes('trip_id TEXT')) {
        issues.push({
          table: 'trip_facts',
          issue: 'trip_id should be INTEGER, not TEXT',
          severity: 'critical'
        });
      }
    }

    // Check facts_dirty data type
    const factsDirtySchema = await globalEnv.DB.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='facts_dirty'
    `).first();

    if (factsDirtySchema) {
      const createSql = factsDirtySchema.sql;
      if (createSql.includes('trip_id TEXT')) {
        issues.push({
          table: 'facts_dirty',
          issue: 'trip_id should be INTEGER, not TEXT',
          severity: 'high'
        });
      }
    }

    // Check for orphaned records
    const orphanedDirtyFacts = await globalEnv.DB.prepare(`
      SELECT COUNT(*) as count FROM facts_dirty fd
      WHERE NOT EXISTS (
        SELECT 1 FROM trips_v2 tv 
        WHERE CAST(fd.trip_id AS INTEGER) = tv.trip_id
        AND fd.trip_id GLOB '[0-9]*'
      )
    `).first();

    if (orphanedDirtyFacts?.count > 0) {
      issues.push({
        table: 'facts_dirty',
        issue: `${orphanedDirtyFacts.count} orphaned records with non-existent or invalid trip_ids`,
        severity: 'medium'
      });
    }

    // Check data consistency
    const inconsistentData = await globalEnv.DB.prepare(`
      SELECT fd.trip_id, fd.reason FROM facts_dirty fd
      WHERE fd.trip_id NOT GLOB '[0-9]*'
      LIMIT 5
    `).all();

    if (inconsistentData.results && inconsistentData.results.length > 0) {
      issues.push({
        table: 'facts_dirty',
        issue: `Non-numeric trip_id values found: ${inconsistentData.results.map((r: any) => r.trip_id).join(', ')}`,
        severity: 'medium',
        examples: inconsistentData.results
      });
    }

    const result = {
      success: true,
      analysis: {
        total_issues: issues.length,
        critical_issues: issues.filter(i => i.severity === 'critical').length,
        high_priority: issues.filter(i => i.severity === 'high').length,
        medium_priority: issues.filter(i => i.severity === 'medium').length,
        issues_detail: issues
      }
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    const errorMsg = `Foreign key analysis failed: ${error instanceof Error ? error.message : String(error)}`;
    await errorLogger.logError('analyze_foreign_key_issues', errorMsg, {});
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorMsg
        }, null, 2)
      }]
    };
  }
}

// Cloudflare Worker export using proper MCP pattern
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    globalEnv = env; // Store environment for tool handlers
    
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Handle SSE endpoint - direct JSON-RPC handling
    if (url.pathname === '/sse') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          console.log("Received MCP message:", JSON.stringify(body));

          let response;

          // Handle different MCP methods directly
          switch (body.method) {
            case "initialize":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  protocolVersion: "2025-06-18",
                  capabilities: {
                    tools: {}
                  },
                  serverInfo: {
                    name: "D1 Travel Database (Enhanced)",
                    version: "4.1.0"
                  }
                }
              };
              break;

            case "tools/list":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  tools
                }
              };
              break;

            case "tools/call":
              const toolName = body.params.name;
              const toolArgs = body.params.arguments || {};
              
              try {
                const dbManager = new DatabaseManager(globalEnv);
                const errorLogger = new ErrorLogger(globalEnv);
                
                let result;
                switch (toolName) {
                  case 'health_check':
                    result = await handleHealthCheck(dbManager);
                    break;
                    
                  case 'update_activitylog_clients':
                    result = await handleUpdateActivityLogClients(dbManager, errorLogger);
                    break;
                    
                  case 'reset_activitylog_from_trips':
                    result = await handleResetActivityLogFromTrips(dbManager, errorLogger);
                    break;
                    
                  case 'explore_database':
                    result = await handleExploreDatabase(dbManager, errorLogger);
                    break;
                    
                  // Fact Management Tools
                  case 'refresh_trip_facts':
                    const factManager = new FactTableManager(globalEnv);
                    result = await handleRefreshTripFacts(factManager, toolArgs);
                    break;
                    
                  case 'query_trip_facts':
                    result = await handleQueryTripFacts(toolArgs);
                    break;
                    
                  case 'mark_facts_dirty':
                    result = await handleMarkFactsDirty(toolArgs);
                    break;
                    
                  case 'get_facts_stats':
                    result = await handleGetFactsStats(toolArgs);
                    break;
                    
                  case 'deploy_fact_triggers':
                    const triggerManager = new TriggerManager(globalEnv);
                    await triggerManager.deployTripFactsTriggers();
                    result = { content: [{ type: 'text', text: '✅ Fact triggers ensured' }]};
                    break;
                    
                  // Hotel Management Tools
                  case 'ingest_hotels':
                    result = await handleIngestHotels(toolArgs);
                    break;
                    
                  case 'ingest_rooms':
                    result = await handleIngestRooms(toolArgs);
                    break;
                    
                  case 'query_hotels':
                    result = await handleQueryHotels(toolArgs);
                    break;
                    
                  // Commission Tools
                  case 'configure_commission_rates':
                    result = await handleConfigureCommissionRates(toolArgs);
                    break;
                    
                  case 'optimize_commission':
                    result = await handleOptimizeCommission(toolArgs);
                    break;
                    
                  case 'calculate_trip_commission':
                    result = await handleCalculateTripCommission(toolArgs);
                    break;
                    
                  // Proposal Generation Tools
                  case 'generate_proposal':
                    const generateResult = await handleGenerateProposal(toolArgs, globalEnv.DB);
                    result = {
                      content: [{
                        type: 'text',
                        text: JSON.stringify(generateResult, null, 2)
                      }]
                    };
                    break;
                    
                  case 'preview_proposal':
                    const previewResult = await handlePreviewProposal(toolArgs, globalEnv.DB);
                    result = {
                      content: [{
                        type: 'text',
                        text: JSON.stringify(previewResult, null, 2)
                      }]
                    };
                    break;
                    
                  case 'list_templates':
                    const templatesResult = await handleListTemplates();
                    result = {
                      content: [{
                        type: 'text',
                        text: JSON.stringify(templatesResult, null, 2)
                      }]
                    };
                    break;
                    
                  default:
                    // Handle all LLM-optimized tools dynamically
                    const llmTool = llmOptimizedTools.find(t => t.name === toolName);
                    if (llmTool) {
                      const toolResult = await llmTool.handler(toolArgs, globalEnv.DB);
                      result = {
                        content: [{
                          type: 'text',
                          text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
                        }]
                      };
                    } else {
                      throw new Error(`Unknown tool: ${toolName}`);
                    }
                    break;
                }
                
                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  result: result
                };
              } catch (error: any) {
                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  error: {
                    code: -32002,
                    message: error.message || "Tool execution failed"
                  }
                };
              }
              break;

            default:
              response = {
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32601,
                  message: `Method not found: ${body.method}`
                }
              };
          }

          console.log("Sending response:", JSON.stringify(response));

          return new Response(JSON.stringify(response), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            }
          });
          
        } catch (error: any) {
          console.error("Error handling request:", error);
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error",
              data: error.message
            }
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          });
        }
      }
      
      // For GET requests (SSE connections), return simple SSE stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(': ping\n\n'));
          // Keep alive ping every 30 seconds
          const interval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': ping\n\n'));
            } catch (e) {
              clearInterval(interval);
            }
          }, 30000);
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Handle health endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: "healthy",
        service: "D1 Travel Database MCP v4.2",
        features: ["database-management", "trip-tracking", "client-management", "activity-logging"],
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};
