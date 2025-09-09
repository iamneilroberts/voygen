import { Env } from '../types/env';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class WorkerLogger implements Logger {
  constructor(
    private env: Env,
    private context?: string
  ) {}

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}] ` : '';
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    
    return `[${timestamp}] [${level}] ${contextStr}${message}${argsStr}`;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    if (this.env.ENVIRONMENT === 'production') {
      return ['info', 'warn', 'error'].includes(level);
    }
    return true;
  }

  debug(message: string, ...args: any[]): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('DEBUG', message, ...args));
  }

  info(message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('INFO', message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('WARN', message, ...args));
  }

  error(message: string, ...args: any[]): void {
    if (!this.shouldLog('error')) return;
    console.error(this.formatMessage('ERROR', message, ...args));
  }

  withContext(context: string): Logger {
    return new WorkerLogger(this.env, context);
  }
}

export function createLogger(env: Env, context?: string): Logger {
  return new WorkerLogger(env, context);
}

export async function logToDatabase(env: Env, level: string, message: string, metadata?: any): Promise<void> {
  try {
    if (!env.DB) return;

    const stmt = env.DB.prepare(`
      INSERT INTO logs (timestamp, level, message, metadata, service) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      new Date().toISOString(),
      level,
      message,
      JSON.stringify(metadata || {}),
      'mcp-anchor-browser'
    ).run();
  } catch (error) {
    console.error('Failed to log to database:', error);
  }
}

export function logPerformance<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      logger.debug(`Starting ${operation}`);
      const result = await fn();
      const duration = Date.now() - startTime;
      logger.debug(`Completed ${operation} in ${duration}ms`);
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed ${operation} after ${duration}ms:`, error);
      reject(error);
    }
  });
}