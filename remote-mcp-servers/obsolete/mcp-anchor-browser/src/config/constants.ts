export const MCP_SERVER_CONFIG = {
  name: 'mcp-anchor-browser',
  version: '1.0.0',
  description: 'MCP server for Anchor Browser integration with travel data extraction',
  capabilities: {
    tools: true,
    logging: true,
    resources: false,
    prompts: false
  }
} as const;

export const ANCHOR_API_CONFIG = {
  baseUrl: 'https://api.anchorbrowser.io',
  version: 'v1',
  defaultTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000
} as const;

export const SESSION_CONFIG = {
  defaultTtlMinutes: 30,
  maxConcurrentSessions: 10,
  cleanupIntervalMinutes: 15,
  defaultViewport: {
    width: 1920,
    height: 1080
  },
  defaultUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
} as const;

export const BUDGET_CONFIG = {
  defaultDailyLimit: 50, // USD
  defaultMonthlyLimit: 1000, // USD
  costPerSession: 0.01,
  costPerScreenshot: 0.02,
  costPerExtraction: 0.01,
  costPerNavigation: 0.005,
  costPerInteraction: 0.001,
  warningThresholds: {
    daily: 0.8, // 80% of daily budget
    monthly: 0.9 // 90% of monthly budget
  }
} as const;

export const ERROR_CONFIG = {
  retryableStatusCodes: [429, 502, 503, 504],
  maxRetryAttempts: 3,
  retryDelayMs: {
    min: 1000,
    max: 10000,
    multiplier: 2
  },
  timeouts: {
    connection: 10000,
    request: 30000,
    session: 300000 // 5 minutes
  }
} as const;

export const CACHE_CONFIG = {
  sessionCacheTtl: 1800, // 30 minutes
  metricsCacheTtl: 300, // 5 minutes
  healthCheckCacheTtl: 60, // 1 minute
  maxCacheSize: 1000,
  keys: {
    sessionPrefix: 'session:',
    metricsPrefix: 'metrics:',
    healthPrefix: 'health:',
    budgetPrefix: 'budget:'
  }
} as const;

export const LOGGING_CONFIG = {
  levels: {
    development: ['debug', 'info', 'warn', 'error'],
    production: ['info', 'warn', 'error']
  },
  maxLogLength: 1000,
  sensitiveFields: ['apiKey', 'token', 'password', 'secret', 'authorization'],
  contextFields: ['sessionId', 'userId', 'requestId']
} as const;

export const EXTRACTION_CONFIG = {
  maxElements: 1000,
  maxTextLength: 10000,
  defaultTimeout: 10000,
  supportedFormats: ['text', 'html', 'json'],
  defaultSelectors: {
    hotels: '.hotel-card, .property-card, [data-testid="property-card"]',
    prices: '.price, .rate, [data-testid="price"]',
    availability: '.available, .booking-button, [data-testid="availability"]',
    reviews: '.review, .rating, [data-testid="review"]',
    amenities: '.amenity, .facility, [data-testid="amenity"]'
  }
} as const;

export const RATE_LIMITING_CONFIG = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  burstLimit: 10,
  windowSizeMinutes: 1,
  penaltyMultiplier: 2,
  maxPenaltyMinutes: 60
} as const;

export const HEALTH_CHECK_CONFIG = {
  intervalSeconds: 30,
  timeoutMs: 5000,
  maxConsecutiveFailures: 3,
  endpoints: {
    anchor: '/health',
    database: '/ping',
    cache: '/status'
  }
} as const;

export const WORKER_CONFIG = {
  maxMemoryMB: 128,
  maxCpuTime: 50, // milliseconds
  maxSubrequests: 50,
  maxKvReads: 1000,
  maxKvWrites: 1000,
  maxD1Queries: 50
} as const;

export const TOOL_DESCRIPTIONS = {
  test_anchor_connection: 'Test connection to Anchor Browser API and check service status',
  get_server_status: 'Get MCP server status, configuration, and active sessions',
  create_session: 'Create a new Anchor Browser automation session with custom configuration',
  navigate: 'Navigate to a URL in an existing session with wait conditions',
  screenshot: 'Take a screenshot of the current page with various options',
  extract_data: 'Extract structured data from the current page using CSS selectors',
  click_element: 'Click on an element or specific coordinates',
  type_text: 'Type text into an input field with typing simulation',
  wait_for_element: 'Wait for an element to appear, disappear, or meet conditions',
  get_session_metrics: 'Get detailed metrics and statistics for a session',
  close_session: 'Close an active session and free resources',
  get_budget_status: 'Get current budget usage and remaining limits'
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

export const MIME_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  EVENT_STREAM: 'text/event-stream'
} as const;

export function getEnvironmentConfig(environment: 'development' | 'production') {
  const baseConfig = {
    logLevel: LOGGING_CONFIG.levels[environment],
    sessionTtl: SESSION_CONFIG.defaultTtlMinutes,
    maxSessions: SESSION_CONFIG.maxConcurrentSessions,
    budgetLimits: {
      daily: BUDGET_CONFIG.defaultDailyLimit,
      monthly: BUDGET_CONFIG.defaultMonthlyLimit
    }
  };

  if (environment === 'development') {
    return {
      ...baseConfig,
      debugMode: true,
      verboseLogging: true,
      strictValidation: false
    };
  }

  return {
    ...baseConfig,
    debugMode: false,
    verboseLogging: false,
    strictValidation: true
  };
}

export function validateEnvironment(env: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.ANCHOR_API_KEY) {
    errors.push('ANCHOR_API_KEY is required');
  }

  if (!env.VERSION) {
    errors.push('VERSION should be set');
  }

  if (!env.ENVIRONMENT || !['development', 'production'].includes(env.ENVIRONMENT)) {
    errors.push('ENVIRONMENT must be either "development" or "production"');
  }

  if (env.DAILY_BUDGET_LIMIT && isNaN(parseFloat(env.DAILY_BUDGET_LIMIT))) {
    errors.push('DAILY_BUDGET_LIMIT must be a valid number');
  }

  if (env.MONTHLY_BUDGET_LIMIT && isNaN(parseFloat(env.MONTHLY_BUDGET_LIMIT))) {
    errors.push('MONTHLY_BUDGET_LIMIT must be a valid number');
  }

  if (env.MAX_CONCURRENT_SESSIONS && isNaN(parseInt(env.MAX_CONCURRENT_SESSIONS))) {
    errors.push('MAX_CONCURRENT_SESSIONS must be a valid integer');
  }

  if (env.SESSION_TTL_MINUTES && isNaN(parseInt(env.SESSION_TTL_MINUTES))) {
    errors.push('SESSION_TTL_MINUTES must be a valid integer');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}