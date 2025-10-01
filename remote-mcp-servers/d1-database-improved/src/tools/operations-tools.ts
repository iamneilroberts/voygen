import { z } from 'zod';
import { D1Database } from '@cloudflare/workers-types';
import { recordDatabaseError, createErrorResponse, extractOperationContext } from '../utils/error-recording';
import { generateSessionId } from '../utils/session-management';

/**
 * Operations and analytics tools for error analysis, activity tracking, and system monitoring
 */

export const analyzeRecentErrorsTool = {
  name: 'analyze_recent_errors',
  description: 'Analyze recent database errors and provide insights',
  inputSchema: z.object({
    hours: z.number().optional().default(24).describe('Hours to look back for errors'),
    limit: z.number().optional().default(10).describe('Maximum number of error patterns to return')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const hours = Number.isFinite(Number(input?.hours)) ? Number(input.hours) : 24;
      const limit = Number.isFinite(Number(input?.limit)) ? Number(input.limit) : 10;
      const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
      
      // Get recent errors
      const errors = await db.prepare(`
        SELECT 
          error_message,
          attempted_operation,
          table_names,
          context,
          created_at,
          COUNT(*) as occurrence_count
        FROM database_errors 
        WHERE created_at >= ?
        GROUP BY error_message, attempted_operation
        ORDER BY occurrence_count DESC, created_at DESC
        LIMIT ?
      `).bind(hoursAgo, limit).all();

      // Analyze error patterns
      const patterns = [];
      const operationStats = {};
      const tableStats = {};

      for (const error of errors.results) {
        // Track operation failures
        const op = error.attempted_operation;
        operationStats[op] = (operationStats[op] || 0) + error.occurrence_count;

        // Track table-related failures
        if (error.table_names) {
          const tables = error.table_names.split(',');
          tables.forEach(table => {
            tableStats[table] = (tableStats[table] || 0) + error.occurrence_count;
          });
        }

        // Categorize error
        const category = categorizeError(error.error_message);
        
        patterns.push({
          error_message: error.error_message,
          operation: error.attempted_operation,
          category: category,
          occurrences: error.occurrence_count,
          last_seen: error.created_at,
          affected_tables: error.table_names,
          context: error.context ? JSON.parse(error.context) : null
        });
      }

      // Generate recommendations
      const recommendations = generateErrorRecommendations(patterns, operationStats, tableStats);

      return {
        success: true,
        analysis_period: `${hours} hours`,
        total_error_patterns: patterns.length,
        total_occurrences: patterns.reduce((sum, p) => sum + p.occurrences, 0),
        error_patterns: patterns,
        operation_failures: operationStats,
        table_failures: tableStats,
        recommendations: recommendations,
        message: `Analyzed ${patterns.length} error patterns from the last ${hours} hours`
      };

    } catch (error: any) {
      console.error('analyze_recent_errors error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'analyze_recent_errors',
        error_message: error.message,
        table_names: 'database_errors',
        context: extractOperationContext('analyze_recent_errors', input)
      });
      
      return createErrorResponse(error, 'Error Analysis', input, sessionId);
    }
  }
};

export const resolveErrorPatternTool = {
  name: 'resolve_error_pattern',
  description: 'Mark error patterns as resolved and track successful solutions',
  inputSchema: z.object({
    error_pattern: z.string().describe('Error message pattern to resolve'),
    resolution: z.string().describe('Description of how the error was resolved'),
    session_id: z.string().optional().describe('Session ID if resolving a specific error')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      // Find matching errors
      const matchingErrors = await db.prepare(`
        SELECT * FROM database_errors 
        WHERE error_message LIKE ? 
        AND resolved_at IS NULL
        ORDER BY created_at DESC
      `).bind(`%${input.error_pattern}%`).all();

      if (matchingErrors.results.length === 0) {
        return {
          success: false,
          message: 'No unresolved errors found matching that pattern',
          pattern: input.error_pattern
        };
      }

      // Mark errors as resolved
      const resolvedCount = await db.prepare(`
        UPDATE database_errors 
        SET resolved_at = CURRENT_TIMESTAMP,
            resolution = ?
        WHERE error_message LIKE ? 
        AND resolved_at IS NULL
      `).bind(input.resolution, `%${input.error_pattern}%`).run();

      // Create resolution record
      await db.prepare(`
        INSERT INTO error_resolutions (
          error_pattern,
          resolution,
          resolved_by_session,
          resolved_at,
          errors_resolved_count
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).bind(
        input.error_pattern,
        input.resolution,
        input.session_id || generateSessionId(),
        resolvedCount.changes
      ).run();

      // Log the resolution
      await logActivity(
        db,
        'ErrorPatternResolved',
        `Resolved ${resolvedCount.changes} errors matching pattern: ${input.error_pattern}`,
        null,
        null,
        input.session_id
      );

      return {
        success: true,
        pattern: input.error_pattern,
        errors_resolved: resolvedCount.changes,
        resolution: input.resolution,
        message: `Successfully resolved ${resolvedCount.changes} errors matching the pattern`
      };

    } catch (error: any) {
      console.error('resolve_error_pattern error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'resolve_error_pattern',
        error_message: error.message,
        table_names: 'database_errors,error_resolutions',
        context: extractOperationContext('resolve_error_pattern', input)
      });
      
      return createErrorResponse(error, 'Error Pattern Resolution', input, sessionId);
    }
  }
};

export const getRecentActivitiesTool = {
  name: 'get_recent_activities',
  description: 'Get recent activities from ActivityLog for CTA startup presentation',
  inputSchema: z.object({
    days: z.number().optional().default(7).describe('Number of days to look back'),
    limit: z.number().optional().default(10).describe('Maximum number of activities to return')
  }),
  handler: async (input: any, db: D1Database) => {
    try {
      const daysAgo = new Date(Date.now() - (input.days * 24 * 60 * 60 * 1000)).toISOString();
      
      const activities = await db.prepare(`
        SELECT 
          a.*,
          t.trip_name,
          t.destinations,
          t.status as trip_status,
          c.full_name as client_name
        FROM ActivityLog a
        LEFT JOIN trips_v2 t ON a.trip_id = t.trip_id
        LEFT JOIN clients_v2 c ON a.client_id = c.client_id
        WHERE a.created_at >= ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `).bind(daysAgo, input.limit).all();

      // Aggregate statistics
      const stats = {
        total_activities: activities.results.length,
        activity_types: {},
        trips_active: new Set(),
        clients_active: new Set(),
        daily_activity: {}
      };

      for (const activity of activities.results) {
        // Count activity types
        const type = activity.activity_type;
        stats.activity_types[type] = (stats.activity_types[type] || 0) + 1;

        // Track active trips and clients
        if (activity.trip_id) stats.trips_active.add(activity.trip_id);
        if (activity.client_id) stats.clients_active.add(activity.client_id);

        // Daily activity distribution
        const day = activity.created_at.split('T')[0];
        stats.daily_activity[day] = (stats.daily_activity[day] || 0) + 1;
      }

      // Convert sets to counts
      stats.trips_active = stats.trips_active.size;
      stats.clients_active = stats.clients_active.size;

      return {
        success: true,
        time_period: `${input.days} days`,
        activities: activities.results,
        statistics: stats,
        message: `Retrieved ${activities.results.length} activities from the last ${input.days} days`
      };

    } catch (error: any) {
      console.error('get_recent_activities error:', error);
      
      const sessionId = await recordDatabaseError(db, {
        attempted_operation: 'get_recent_activities',
        error_message: error.message,
        table_names: 'ActivityLog,trips_v2,clients_v2',
        context: extractOperationContext('get_recent_activities', input)
      });
      
      return createErrorResponse(error, 'Recent Activities Retrieval', input, sessionId);
    }
  }
};

// Helper functions
function categorizeError(errorMessage: string): string {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('timeout') || message.includes('deadline')) {
    return 'timeout';
  } else if (message.includes('constraint') || message.includes('unique')) {
    return 'constraint_violation';
  } else if (message.includes('syntax') || message.includes('sql')) {
    return 'sql_syntax';
  } else if (message.includes('connection') || message.includes('network')) {
    return 'connectivity';
  } else if (message.includes('not found') || message.includes('missing')) {
    return 'data_missing';
  } else if (message.includes('permission') || message.includes('access')) {
    return 'permissions';
  } else {
    return 'other';
  }
}

function generateErrorRecommendations(patterns: any[], operationStats: any, tableStats: any): string[] {
  const recommendations = [];
  
  // Check for timeout issues
  const timeoutPatterns = patterns.filter(p => p.category === 'timeout');
  if (timeoutPatterns.length > 0) {
    recommendations.push('Consider optimizing queries or increasing timeout limits - multiple timeout errors detected');
  }

  // Check for constraint violations
  const constraintPatterns = patterns.filter(p => p.category === 'constraint_violation');
  if (constraintPatterns.length > 0) {
    recommendations.push('Review data validation logic - constraint violations detected');
  }

  // Check for high-frequency operations
  const topFailedOp = Object.entries(operationStats).sort((a, b) => b[1] - a[1])[0];
  if (topFailedOp && topFailedOp[1] > 5) {
    recommendations.push(`Operation "${topFailedOp[0]}" is failing frequently (${topFailedOp[1]} times) - needs investigation`);
  }

  // Check for table-specific issues
  const topFailedTable = Object.entries(tableStats).sort((a, b) => b[1] - a[1])[0];
  if (topFailedTable && topFailedTable[1] > 5) {
    recommendations.push(`Table "${topFailedTable[0]}" is involved in many failures (${topFailedTable[1]} times) - check schema/queries`);
  }

  if (recommendations.length === 0) {
    recommendations.push('No specific patterns detected - errors appear to be isolated incidents');
  }

  return recommendations;
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
