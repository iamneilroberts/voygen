import { Logger } from './logger';

export enum ErrorCode {
  ANCHOR_API_ERROR = 'ANCHOR_API_ERROR',
  ANCHOR_SESSION_ERROR = 'ANCHOR_SESSION_ERROR',
  ANCHOR_CONNECTION_ERROR = 'ANCHOR_CONNECTION_ERROR',
  MCP_REQUEST_ERROR = 'MCP_REQUEST_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUDGET_EXCEEDED_ERROR = 'BUDGET_EXCEEDED_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class AnchorMCPError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AnchorMCPError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      stack: this.stack
    };
  }
}

export class AnchorApiError extends AnchorMCPError {
  constructor(message: string, details?: any, statusCode?: number) {
    super(ErrorCode.ANCHOR_API_ERROR, message, details, statusCode);
    this.name = 'AnchorApiError';
  }
}

export class AnchorSessionError extends AnchorMCPError {
  constructor(message: string, sessionId?: string) {
    super(ErrorCode.ANCHOR_SESSION_ERROR, message, { sessionId });
    this.name = 'AnchorSessionError';
  }
}

export class BudgetExceededError extends AnchorMCPError {
  constructor(message: string, currentSpend: number, limit: number) {
    super(ErrorCode.BUDGET_EXCEEDED_ERROR, message, { currentSpend, limit });
    this.name = 'BudgetExceededError';
  }
}

export class RateLimitError extends AnchorMCPError {
  constructor(message: string, retryAfter?: number) {
    super(ErrorCode.RATE_LIMIT_ERROR, message, { retryAfter }, 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends AnchorMCPError {
  constructor(message: string, field?: string, value?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, { field, value }, 400);
    this.name = 'ValidationError';
  }
}

export interface ErrorHandler {
  handleError(error: Error, context?: string): Promise<void>;
  isRetryableError(error: Error): boolean;
  getRetryDelay(error: Error, attempt: number): number;
}

export class DefaultErrorHandler implements ErrorHandler {
  constructor(private logger: Logger) {}

  async handleError(error: Error, context?: string): Promise<void> {
    const contextStr = context ? `[${context}] ` : '';
    
    if (error instanceof AnchorMCPError) {
      this.logger.error(`${contextStr}${error.name}: ${error.message}`, {
        code: error.code,
        details: error.details,
        statusCode: error.statusCode
      });
    } else {
      this.logger.error(`${contextStr}Unexpected error: ${error.message}`, {
        stack: error.stack
      });
    }
  }

  isRetryableError(error: Error): boolean {
    if (error instanceof AnchorMCPError) {
      switch (error.code) {
        case ErrorCode.ANCHOR_CONNECTION_ERROR:
        case ErrorCode.RATE_LIMIT_ERROR:
          return true;
        case ErrorCode.ANCHOR_API_ERROR:
          return error.statusCode !== 401 && error.statusCode !== 403;
        default:
          return false;
      }
    }
    
    return false;
  }

  getRetryDelay(error: Error, attempt: number): number {
    if (error instanceof RateLimitError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000;
    }
    
    const baseDelay = 1000;
    const exponentialBackoff = Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1;
    
    return baseDelay * exponentialBackoff * (1 + jitter);
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  errorHandler: ErrorHandler,
  maxAttempts: number = 3,
  context?: string
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      await errorHandler.handleError(lastError, context);
      
      if (attempt === maxAttempts || !errorHandler.isRetryableError(lastError)) {
        throw lastError;
      }
      
      const delay = errorHandler.getRetryDelay(lastError, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export function sanitizeError(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error instanceof AnchorMCPError && {
        code: error.code,
        details: error.details,
        statusCode: error.statusCode
      })
    };
  }
  
  if (typeof error === 'object' && error !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(error)) {
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return String(error);
}

export function createMCPErrorResponse(error: Error): any {
  const sanitized = sanitizeError(error);
  
  return {
    content: [{
      type: 'text',
      text: `Error: ${sanitized.message || 'Unknown error occurred'}`
    }],
    isError: true,
    _meta: {
      error: sanitized
    }
  };
}