/**
 * Session Management and Error Analysis Utilities
 * TASK-2025-110: Database Error Logging Integration
 */

/**
 * Generate a unique session ID for tracking related operations
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `session_${timestamp}_${random}`;
}

/**
 * Convert technical error messages to human-readable format
 */
export function getHumanReadableError(errorMessage: string): string {
  const errorLower = errorMessage.toLowerCase();
  
  // Common D1/SQLite error patterns
  if (errorLower.includes('pattern too complex') || errorLower.includes('like or glob pattern too complex')) {
    return 'Search pattern is too complex for the database';
  }
  
  if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
    return 'Query took too long to complete';
  }
  
  if (errorLower.includes('constraint failed') || errorLower.includes('unique constraint')) {
    return 'Data already exists or violates database rules';
  }
  
  if (errorLower.includes('no such table')) {
    return 'Database table not found';
  }
  
  if (errorLower.includes('no such column')) {
    return 'Database column not found';
  }
  
  if (errorLower.includes('syntax error')) {
    return 'Database query has invalid syntax';
  }
  
  if (errorLower.includes('connection')) {
    return 'Database connection failed';
  }
  
  if (errorLower.includes('permission') || errorLower.includes('access denied')) {
    return 'Database access permission denied';
  }
  
  if (errorLower.includes('disk') || errorLower.includes('storage')) {
    return 'Database storage issue';
  }
  
  if (errorLower.includes('network')) {
    return 'Network connection to database failed';
  }
  
  // If no specific pattern matches, return a cleaned version
  return errorMessage
    .replace(/^\w+Error:\s*/i, '') // Remove "Error: " prefix
    .replace(/\s+at\s+.*/s, '') // Remove stack trace info
    .trim();
}

/**
 * Suggest alternative tools or approaches based on the failed operation
 */
export function suggestAlternativeTool(operation: string, input?: any): string {
  const suggestions: { [key: string]: string } = {
    'complex_query_search': 'Try get_anything with simpler terms',
    'get_anything': 'Use create_trip_with_client for new trips',
    'partial_match_search': 'Try exact search with trip names',
    'word_search': 'Use create_client_v2 for new clients',
    'create_trip': 'Check create_trip_with_client for trips with clients',
    'create_client': 'Use bulk_trip_operations to assign existing clients',
    'assign_client': 'Try create_client_v2 first, then assign',
    'workflow_advance': 'Use initialize_workflow first',
    'workflow_step': 'Check get_workflow_status for current state',
    'update_status': 'Try bulk_trip_operations with status update',
    'add_note': 'Use bulk_trip_operations with add_note operation'
  };
  
  // Try direct match first
  if (suggestions[operation]) {
    return suggestions[operation];
  }
  
  // Try partial matches
  for (const [key, suggestion] of Object.entries(suggestions)) {
    if (operation.includes(key) || key.includes(operation)) {
      return suggestion;
    }
  }
  
  // Context-based suggestions
  if (input && typeof input === 'object') {
    if (input.query && typeof input.query === 'string') {
      if (input.query.toLowerCase().includes('create')) {
        return 'Use create_trip_with_client or create_client_v2';
      }
      if (input.query.toLowerCase().includes('workflow')) {
        return 'Try get_workflow_status or advance_workflow_phase';
      }
      if (input.query.toLowerCase().includes('client')) {
        return 'Try create_client_v2 or get_anything with email';
      }
    }
  }
  
  return 'Try get_anything with specific search terms';
}

/**
 * Extract table names from SQL query for error context
 */
export function extractTableNames(sqlQuery?: string): string {
  if (!sqlQuery) return '';
  
  const tablePattern = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const matches = sqlQuery.match(tablePattern);
  
  if (!matches) return '';
  
  const tables = matches.map(match => 
    match.replace(/^(?:FROM|JOIN|INTO|UPDATE)\s+/i, '').trim()
  );
  
  return [...new Set(tables)].join(', '); // Remove duplicates
}

/**
 * Sanitize SQL query for logging (remove sensitive data)
 */
export function sanitizeQueryForLogging(sqlQuery: string): string {
  return sqlQuery
    .replace(/'[^']*'/g, "'***'") // Replace string literals
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'YYYY-MM-DD') // Replace dates
    .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, 'email@domain.com') // Replace emails
    .replace(/\b\d{10,}\b/g, 'XXXXXXXXXX') // Replace long numbers
    .trim();
}