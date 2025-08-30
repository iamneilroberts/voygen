/**
 * Error Recording Utilities for Database Error Logging Integration
 * TASK-2025-110: Database Error Logging Integration
 */

import { D1Database } from '@cloudflare/workers-types';
import { generateSessionId, getHumanReadableError, suggestAlternativeTool } from './session-management';

export interface ErrorRecordingContext {
  attempted_operation: string;
  error_message: string;
  sql_query?: string;
  table_names?: string;
  context?: any;
  session_id?: string;
  suggested_tool?: string;
}

/**
 * Record a database error with full context information
 */
export async function recordDatabaseError(
  db: D1Database,
  context: ErrorRecordingContext
): Promise<string> {
  try {
    const sessionId = context.session_id || generateSessionId();
    const suggestedTool = context.suggested_tool || suggestAlternativeTool(context.attempted_operation);
    
    await db.prepare(`
      INSERT INTO db_errors (
        attempted_operation, error_message, sql_query, 
        table_names, context, session_id, suggested_tool
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      context.attempted_operation,
      context.error_message,
      context.sql_query || null,
      context.table_names || null,
      JSON.stringify(context.context || {}),
      sessionId,
      suggestedTool
    ).run();

    return sessionId;
  } catch (recordingError) {
    console.error('Failed to record database error:', recordingError);
    // Don't throw - error recording failure shouldn't crash the main operation
    return '';
  }
}

/**
 * Generate a user-friendly error response with specific guidance
 */
export function createErrorResponse(
  error: any, 
  operation: string, 
  input?: any,
  sessionId?: string
): {
  response: string;
  error: string;
  suggestion: string;
  session_id?: string;
} {
  const humanError = getHumanReadableError(error.message);
  const suggestion = getSuggestionForOperation(operation, input);
  
  return {
    response: `${operation} failed: ${humanError}. ${suggestion}`,
    error: 'specific_database_error',
    suggestion: suggestion,
    session_id: sessionId
  };
}

/**
 * Get operation-specific suggestions for users
 */
function getSuggestionForOperation(operation: string, input?: any): string {
  const suggestions = {
    'complex_query_search': 'Try searching with specific terms like "Smith Hawaii" or "December trips" instead of complex phrases.',
    'get_anything': 'Use specific trip names, client names, or single keywords for best results.',
    'partial_match_search': 'Search with exact trip names or client emails for more accurate results.',
    'word_search': 'Try simpler search terms like individual names or dates.',
    'create_trip': 'Ensure all required fields are provided and dates are in YYYY-MM-DD format.',
    'assign_client': 'Verify the client exists or provide full client details to create a new one.',
    'workflow_operations': 'Check that the trip exists and workflow is properly initialized.',
    'default': 'Please try a simpler approach or contact support if the issue persists.'
  };
  
  // Try to match operation to suggestion
  for (const [key, suggestion] of Object.entries(suggestions)) {
    if (operation.includes(key) || key === operation) {
      return suggestion;
    }
  }
  
  // Check input for context
  if (input && typeof input === 'object') {
    if (input.query && typeof input.query === 'string') {
      if (input.query.length > 50) {
        return 'Try breaking your search into smaller, more specific terms.';
      }
      if (input.query.split(' ').length > 4) {
        return 'Use fewer search terms for better results. Try 1-2 key words.';
      }
    }
  }
  
  return suggestions.default;
}

/**
 * Analyze error patterns to detect common issues
 */
export function analyzeErrorPattern(errorMessage: string): {
  pattern: string;
  category: 'complexity' | 'timeout' | 'data' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high';
} {
  const errorLower = errorMessage.toLowerCase();
  
  if (errorLower.includes('pattern too complex') || errorLower.includes('like or glob pattern too complex')) {
    return {
      pattern: 'complex_like_pattern',
      category: 'complexity',
      severity: 'medium'
    };
  }
  
  if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
    return {
      pattern: 'query_timeout',
      category: 'timeout',
      severity: 'high'
    };
  }
  
  if (errorLower.includes('constraint') || errorLower.includes('unique')) {
    return {
      pattern: 'data_constraint',
      category: 'data',
      severity: 'medium'
    };
  }
  
  if (errorLower.includes('permission') || errorLower.includes('access denied')) {
    return {
      pattern: 'permission_denied',
      category: 'permission',
      severity: 'high'
    };
  }
  
  return {
    pattern: 'unknown_error',
    category: 'unknown',
    severity: 'medium'
  };
}

/**
 * Check if an error should bypass normal handling (for fallback strategies)
 */
export function shouldBypassForComplexity(error: any): boolean {
  const message = error?.message || '';
  return message.includes('pattern too complex') || 
         message.includes('LIKE or GLOB pattern too complex');
}

/**
 * Extract meaningful context from operation input for error recording
 */
export function extractOperationContext(operation: string, input: any, additionalContext?: any): any {
  const context: any = {
    operation: operation,
    timestamp: new Date().toISOString()
  };
  
  // Extract relevant fields from input
  if (input) {
    if (typeof input === 'object') {
      // Common fields to capture
      const relevantFields = ['query', 'trip_identifier', 'client_email', 'trip_name', 'phase', 'status'];
      for (const field of relevantFields) {
        if (input[field] !== undefined) {
          context[field] = input[field];
        }
      }
      
      // Add complexity assessment if available
      if (input.query) {
        context.query_length = input.query.length;
        context.word_count = input.query.split(' ').length;
      }
    } else {
      context.input_type = typeof input;
      context.input_value = String(input);
    }
  }
  
  // Add additional context if provided
  if (additionalContext) {
    context.additional = additionalContext;
  }
  
  return context;
}