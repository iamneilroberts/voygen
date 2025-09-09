/**
 * Database Repair Tool for Critical Schema Issues
 * Handles trip facts schema inconsistencies and foreign key constraint problems
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

export function registerDatabaseRepairTools(server: McpServer, getEnv: () => Env) {

  // Tool: comprehensive_schema_fix
  server.tool(
    "comprehensive_schema_fix",
    {
      dry_run: z.boolean().default(true).describe("If true, only show what would be changed without executing"),
      fix_facts_dirty: z.boolean().default(true).describe("Fix facts_dirty data type and foreign key issues"),
      fix_trip_participants: z.boolean().default(true).describe("Fix TripParticipants foreign key references"),
      fix_trip_days: z.boolean().default(true).describe("Fix TripDays schema alignment"),
      recreate_trip_facts: z.boolean().default(false).describe("Recreate trip_facts table with correct schema"),
      clean_orphaned_data: z.boolean().default(true).describe("Remove orphaned records")
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
        const changes: string[] = [];
        const errors: string[] = [];

        // Step 1: Analyze current schema issues
        const schemaAnalysis = await analyzeSchemaIssues(env);
        changes.push(`Schema Analysis: ${schemaAnalysis.summary}`);

        // Step 2: Fix facts_dirty table
        if (params.fix_facts_dirty) {
          const factsDirtyResult = await fixFactsDirtySchema(env, params.dry_run);
          changes.push(`Facts Dirty Fix: ${factsDirtyResult.summary}`);
          if (factsDirtyResult.errors.length > 0) {
            errors.push(...factsDirtyResult.errors);
          }
        }

        // Step 3: Fix TripParticipants table
        if (params.fix_trip_participants) {
          const participantsResult = await fixTripParticipantsSchema(env, params.dry_run);
          changes.push(`TripParticipants Fix: ${participantsResult.summary}`);
          if (participantsResult.errors.length > 0) {
            errors.push(...participantsResult.errors);
          }
        }

        // Step 4: Fix TripDays table
        if (params.fix_trip_days) {
          const tripDaysResult = await fixTripDaysSchema(env, params.dry_run);
          changes.push(`TripDays Fix: ${tripDaysResult.summary}`);
          if (tripDaysResult.errors.length > 0) {
            errors.push(...tripDaysResult.errors);
          }
        }

        // Step 5: Recreate trip_facts if requested
        if (params.recreate_trip_facts && !params.dry_run) {
          const recreateResult = await recreateTripFactsTables(env);
          changes.push(`Table Recreation: ${recreateResult.summary}`);
          if (recreateResult.errors.length > 0) {
            errors.push(...recreateResult.errors);
          }
        }

        // Step 6: Clean orphaned data
        if (params.clean_orphaned_data && !params.dry_run) {
          const cleanupResult = await cleanOrphanedData(env);
          changes.push(`Data Cleanup: ${cleanupResult.summary}`);
          if (cleanupResult.errors.length > 0) {
            errors.push(...cleanupResult.errors);
          }
        }

        return {
          success: true,
          message: `Comprehensive schema fix ${params.dry_run ? 'analysis' : 'execution'} completed`,
          results: {
            changes_made: changes,
            errors_encountered: errors,
            dry_run: params.dry_run,
            schema_analysis: schemaAnalysis
          }
        };

      } catch (error) {
        const errorMsg = `Comprehensive schema fix failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('comprehensive_schema_fix', errorMsg, params);
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: repair_trip_facts_schema (legacy compatibility)
  server.tool(
    "repair_trip_facts_schema",
    {
      dry_run: z.boolean().default(true).describe("If true, only show what would be changed without executing"),
      fix_data_types: z.boolean().default(true).describe("Fix trip_id data type mismatches"),
      recreate_tables: z.boolean().default(false).describe("Recreate trip_facts and facts_dirty tables with correct schema")
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
        const changes: string[] = [];
        const errors: string[] = [];

        // Step 1: Analyze current schema issues
        const schemaAnalysis = await analyzeSchemaIssues(env);
        changes.push(`Schema Analysis: ${schemaAnalysis.summary}`);

        // Step 2: Fix facts_dirty data type issues
        if (params.fix_data_types) {
          const dataTypeFixResult = await fixFactsDirtyDataTypes(env, params.dry_run);
          changes.push(`Data Type Fixes: ${dataTypeFixResult.summary}`);
          if (dataTypeFixResult.errors.length > 0) {
            errors.push(...dataTypeFixResult.errors);
          }
        }

        // Step 3: Recreate tables if requested
        if (params.recreate_tables && !params.dry_run) {
          const recreateResult = await recreateTripFactsTables(env);
          changes.push(`Table Recreation: ${recreateResult.summary}`);
          if (recreateResult.errors.length > 0) {
            errors.push(...recreateResult.errors);
          }
        }

        return {
          success: true,
          message: `Database repair ${params.dry_run ? 'analysis' : 'execution'} completed`,
          results: {
            changes_made: changes,
            errors_encountered: errors,
            dry_run: params.dry_run,
            schema_analysis: schemaAnalysis
          }
        };

      } catch (error) {
        const errorMsg = `Database repair failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('repair_trip_facts_schema', errorMsg, params);
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: analyze_foreign_key_issues
  server.tool(
    "analyze_foreign_key_issues",
    {},
    async () => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        const issues: any[] = [];

        // Check trip_facts foreign key
        const tripFactsFK = await env.DB.prepare(`
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
        const factsDirtySchema = await env.DB.prepare(`
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
        const orphanedDirtyFacts = await env.DB.prepare(`
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
        const inconsistentData = await env.DB.prepare(`
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

        return {
          success: true,
          analysis: {
            total_issues: issues.length,
            critical_issues: issues.filter(i => i.severity === 'critical').length,
            high_priority: issues.filter(i => i.severity === 'high').length,
            medium_priority: issues.filter(i => i.severity === 'medium').length,
            issues_detail: issues
          }
        };

      } catch (error) {
        return {
          success: false,
          error: `Foreign key analysis failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  );
}

export async function analyzeSchemaIssues(env: Env): Promise<{summary: string, details: any}> {
  const details: any = {};
  
  // Check trips_v2 count and max ID
  const tripsInfo = await env.DB.prepare(`
    SELECT COUNT(*) as count, MAX(trip_id) as max_id FROM trips_v2
  `).first();
  details.trips_v2 = tripsInfo;

  // Check facts_dirty count and data types
  const factsDirtyInfo = await env.DB.prepare(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN trip_id GLOB '[0-9]*' THEN 1 END) as numeric_ids,
           COUNT(CASE WHEN trip_id NOT GLOB '[0-9]*' THEN 1 END) as text_ids
    FROM facts_dirty
  `).first();
  details.facts_dirty = factsDirtyInfo;

  // Check trip_facts count
  const tripFactsInfo = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM trip_facts
  `).first();
  details.trip_facts = tripFactsInfo;

  const summary = `trips_v2: ${details.trips_v2?.count || 0} records, facts_dirty: ${details.facts_dirty?.total || 0} (${details.facts_dirty?.numeric_ids || 0} numeric, ${details.facts_dirty?.text_ids || 0} text), trip_facts: ${details.trip_facts?.count || 0}`;

  return { summary, details };
}

export async function fixFactsDirtyDataTypes(env: Env, dryRun: boolean): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];
  
  if (dryRun) {
    // Just analyze what would be changed
    const textIds = await env.DB.prepare(`
      SELECT trip_id FROM facts_dirty WHERE trip_id NOT GLOB '[0-9]*' LIMIT 10
    `).all();
    
    return {
      summary: `Would fix ${textIds.results?.length || 0} non-numeric trip_id values`,
      errors: []
    };
  }

  try {
    // Convert trip names to trip_ids where possible
    const tripNamesToFix = await env.DB.prepare(`
      SELECT DISTINCT fd.trip_id as trip_name
      FROM facts_dirty fd
      WHERE fd.trip_id NOT GLOB '[0-9]*'
    `).all();

    let fixedCount = 0;
    for (const row of tripNamesToFix.results || []) {
      const tripRecord = await env.DB.prepare(`
        SELECT trip_id FROM trips_v2 WHERE trip_name = ?
      `).bind(row.trip_name).first();

      if (tripRecord) {
        // Update facts_dirty to use the numeric trip_id
        await env.DB.prepare(`
          UPDATE facts_dirty SET trip_id = ? WHERE trip_id = ?
        `).bind(tripRecord.trip_id.toString(), row.trip_name).run();
        fixedCount++;
      } else {
        // Remove orphaned records
        await env.DB.prepare(`
          DELETE FROM facts_dirty WHERE trip_id = ?
        `).bind(row.trip_name).run();
        errors.push(`Removed orphaned facts_dirty record for non-existent trip: ${row.trip_name}`);
      }
    }

    return {
      summary: `Fixed ${fixedCount} trip_id references, removed ${errors.length} orphaned records`,
      errors
    };
  } catch (error) {
    errors.push(`Failed to fix data types: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to fix data types', errors };
  }
}

export async function fixFactsDirtySchema(env: Env, dryRun: boolean): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];
  
  try {
    if (dryRun) {
      // Analyze what would be changed
      const analysis = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN trip_id GLOB '[0-9]*' THEN 1 END) as numeric_ids,
          COUNT(CASE WHEN trip_id NOT GLOB '[0-9]*' THEN 1 END) as text_ids
        FROM facts_dirty
      `).first();
      
      return {
        summary: `Would convert ${analysis?.text_ids || 0} TEXT trip_ids to INTEGER (${analysis?.total || 0} total records)`,
        errors: []
      };
    }

    // Step 1: Create new table with correct schema
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS facts_dirty_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
      )
    `).run();

    // Step 2: Migrate valid data
    const migrateResult = await env.DB.prepare(`
      INSERT INTO facts_dirty_new (trip_id, reason, created_at)
      SELECT 
        CAST(fd.trip_id AS INTEGER) as trip_id,
        fd.reason,
        fd.created_at
      FROM facts_dirty fd
      JOIN trips_v2 tv ON CAST(fd.trip_id AS INTEGER) = tv.trip_id
      WHERE fd.trip_id GLOB '[0-9]*'
    `).run();

    // Step 3: Also migrate records where trip_id is a trip name
    const tripNameMigrations = await env.DB.prepare(`
      SELECT DISTINCT fd.trip_id as trip_name
      FROM facts_dirty fd
      WHERE fd.trip_id NOT GLOB '[0-9]*'
    `).all();

    let convertedNames = 0;
    for (const row of tripNameMigrations.results || []) {
      const tripRecord = await env.DB.prepare(`
        SELECT trip_id FROM trips_v2 WHERE trip_name = ?
      `).bind(row.trip_name).first();

      if (tripRecord) {
        await env.DB.prepare(`
          INSERT INTO facts_dirty_new (trip_id, reason, created_at)
          SELECT ?, reason, created_at
          FROM facts_dirty
          WHERE trip_id = ?
        `).bind(tripRecord.trip_id, row.trip_name).run();
        convertedNames++;
      }
    }

    // Step 4: Drop old table and rename new one
    await env.DB.prepare(`DROP TABLE facts_dirty`).run();
    await env.DB.prepare(`ALTER TABLE facts_dirty_new RENAME TO facts_dirty`).run();

    // Step 5: Create index
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_facts_dirty_trip ON facts_dirty(trip_id)
    `).run();

    return {
      summary: `Successfully converted facts_dirty to INTEGER schema. Migrated ${migrateResult.changes} direct records, converted ${convertedNames} trip name references`,
      errors
    };
  } catch (error) {
    errors.push(`Failed to fix facts_dirty schema: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to fix facts_dirty schema', errors };
  }
}

export async function fixTripParticipantsSchema(env: Env, dryRun: boolean): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];

  try {
    if (dryRun) {
      const currentCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM TripParticipants
      `).first();
      
      return {
        summary: `Would recreate TripParticipants table with correct v2 foreign keys (${currentCount?.count || 0} records)`,
        errors: []
      };
    }

    // Step 1: Backup existing data
    const existingData = await env.DB.prepare(`
      SELECT trip_id, client_id, role, created_at FROM TripParticipants
    `).all();

    // Step 2: Drop and recreate table with correct foreign keys
    await env.DB.prepare(`DROP TABLE IF EXISTS TripParticipants`).run();
    await env.DB.prepare(`
      CREATE TABLE TripParticipants (
        trip_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        role TEXT DEFAULT 'traveler',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (trip_id, client_id),
        FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients_v2(client_id) ON DELETE CASCADE
      )
    `).run();

    // Step 3: Restore valid data
    let restoredCount = 0;
    for (const row of existingData.results || []) {
      try {
        // Verify both foreign keys exist
        const tripExists = await env.DB.prepare(`
          SELECT 1 FROM trips_v2 WHERE trip_id = ?
        `).bind(row.trip_id).first();

        const clientExists = await env.DB.prepare(`
          SELECT 1 FROM clients_v2 WHERE client_id = ?
        `).bind(row.client_id).first();

        if (tripExists && clientExists) {
          await env.DB.prepare(`
            INSERT INTO TripParticipants (trip_id, client_id, role, created_at)
            VALUES (?, ?, ?, ?)
          `).bind(row.trip_id, row.client_id, row.role, row.created_at).run();
          restoredCount++;
        } else {
          errors.push(`Skipped orphaned participant: trip_id=${row.trip_id}, client_id=${row.client_id}`);
        }
      } catch (e) {
        errors.push(`Failed to restore participant record: ${e}`);
      }
    }

    return {
      summary: `Successfully recreated TripParticipants with v2 foreign keys. Restored ${restoredCount}/${existingData.results?.length || 0} records`,
      errors
    };
  } catch (error) {
    errors.push(`Failed to fix TripParticipants schema: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to fix TripParticipants schema', errors };
  }
}

export async function fixTripDaysSchema(env: Env, dryRun: boolean): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];

  try {
    if (dryRun) {
      const currentCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM TripDays
      `).first();
      
      return {
        summary: `Would fix TripDays foreign key references (${currentCount?.count || 0} records)`,
        errors: []
      };
    }

    // Step 1: Check if trip_id is already INTEGER
    const schemaInfo = await env.DB.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='TripDays'
    `).first();

    if (!schemaInfo || !schemaInfo.sql.includes('trip_id TEXT')) {
      return {
        summary: 'TripDays table already has correct INTEGER trip_id schema',
        errors: []
      };
    }

    // Step 2: Backup existing data
    const existingData = await env.DB.prepare(`
      SELECT id, trip_id, day_number, date, location, summary, created_at, updated_at 
      FROM TripDays
    `).all();

    // Step 3: Drop and recreate table
    await env.DB.prepare(`DROP TABLE IF EXISTS TripDays`).run();
    await env.DB.prepare(`
      CREATE TABLE TripDays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        date TEXT,
        location TEXT,
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
      )
    `).run();

    // Step 4: Restore valid data
    let restoredCount = 0;
    for (const row of existingData.results || []) {
      try {
        // Convert trip_id if it's a string
        let tripIdToUse = row.trip_id;
        if (typeof row.trip_id === 'string' && !row.trip_id.match(/^\d+$/)) {
          // Try to find by trip name
          const tripRecord = await env.DB.prepare(`
            SELECT trip_id FROM trips_v2 WHERE trip_name = ?
          `).bind(row.trip_id).first();
          
          if (tripRecord) {
            tripIdToUse = tripRecord.trip_id;
          } else {
            errors.push(`Could not resolve trip_id for TripDays record with trip_id: ${row.trip_id}`);
            continue;
          }
        }

        await env.DB.prepare(`
          INSERT INTO TripDays (trip_id, day_number, date, location, summary, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(tripIdToUse, row.day_number, row.date, row.location, row.summary, row.created_at, row.updated_at).run();
        restoredCount++;
      } catch (e) {
        errors.push(`Failed to restore TripDays record: ${e}`);
      }
    }

    return {
      summary: `Successfully fixed TripDays schema. Restored ${restoredCount}/${existingData.results?.length || 0} records`,
      errors
    };
  } catch (error) {
    errors.push(`Failed to fix TripDays schema: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to fix TripDays schema', errors };
  }
}

export async function cleanOrphanedData(env: Env): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];
  
  try {
    let cleanupCount = 0;

    // Clean orphaned ActivityLog entries
    const activityCleanup = await env.DB.prepare(`
      DELETE FROM ActivityLog 
      WHERE trip_id IS NOT NULL 
      AND trip_id NOT IN (SELECT trip_id FROM trips_v2)
    `).run();
    cleanupCount += activityCleanup.changes || 0;

    // Clean orphaned facts_dirty entries (should be minimal after schema fix)
    const factsCleanup = await env.DB.prepare(`
      DELETE FROM facts_dirty 
      WHERE trip_id NOT IN (SELECT trip_id FROM trips_v2)
    `).run();
    cleanupCount += factsCleanup.changes || 0;

    return {
      summary: `Cleaned ${cleanupCount} orphaned records from ActivityLog and facts_dirty tables`,
      errors
    };
  } catch (error) {
    errors.push(`Failed to clean orphaned data: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to clean orphaned data', errors };
  }
}

export async function recreateTripFactsTables(env: Env): Promise<{summary: string, errors: string[]}> {
  const errors: string[] = [];

  try {
    // Drop existing trip_facts table
    await env.DB.prepare(`DROP TABLE IF EXISTS trip_facts`).run();

    // Create new trip_facts table with correct schema
    await env.DB.prepare(`
      CREATE TABLE trip_facts (
        trip_id INTEGER PRIMARY KEY,
        total_nights INTEGER DEFAULT 0,
        total_hotels INTEGER DEFAULT 0,
        total_activities INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        transit_minutes INTEGER DEFAULT 0,
        last_computed DATETIME,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (trip_id) REFERENCES trips_v2(trip_id) ON DELETE CASCADE
      )
    `).run();

    // Create indexes
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_trip_facts_computed ON trip_facts(last_computed)
    `).run();

    return {
      summary: 'Successfully recreated trip_facts table with correct INTEGER schema and foreign key',
      errors
    };
  } catch (error) {
    errors.push(`Failed to recreate tables: ${error instanceof Error ? error.message : String(error)}`);
    return { summary: 'Failed to recreate tables', errors };
  }
}