export interface Env {
  ANCHOR_API_KEY: string;
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: 'development' | 'production';
  VERSION: string;
  MCP_AUTH_KEY?: string;
  DAILY_BUDGET_LIMIT?: string;
  MONTHLY_BUDGET_LIMIT?: string;
  MAX_CONCURRENT_SESSIONS?: string;
  SESSION_TTL_MINUTES?: string;
}

declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = any>(): Promise<T | null>;
    all<T = any>(): Promise<D1Result<T>>;
    run(): Promise<D1Result>;
  }

  interface D1Result<T = any> {
    results: T[];
    success: boolean;
    meta: {
      duration: number;
      rows_read: number;
      rows_written: number;
    };
  }

  interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: {
      expirationTtl?: number;
      expiration?: number;
      metadata?: any;
    }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
      keys: { name: string; expiration?: number; metadata?: any }[];
      list_complete: boolean;
      cursor?: string;
    }>;
  }
}