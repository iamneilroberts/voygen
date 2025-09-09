export interface AnchorSession {
  id: string;
  status: 'active' | 'idle' | 'closed' | 'error';
  createdAt: Date;
  lastUsed: Date;
  totalCost: number;
  metadata?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    proxy?: string;
    region?: string;
    cdpUrl?: string;
    liveViewUrl?: string;
  };
}

export interface AnchorSessionConfig {
  proxy?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  headless?: boolean;
  timeout?: number;
  region?: string;
  extensions?: string[];
  initialUrl?: string;
}

export interface AnchorNavigateOptions {
  url: string;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AnchorScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
  selector?: string;
}

export interface AnchorExtractOptions {
  selector?: string;
  attribute?: string;
  multiple?: boolean;
  format?: 'text' | 'html' | 'json';
  schema?: any;
}

export interface AnchorClickOptions {
  selector?: string;
  coordinates?: { x: number; y: number };
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface AnchorTypeOptions {
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface AnchorWaitOptions {
  selector?: string;
  timeout?: number;
  visible?: boolean;
  hidden?: boolean;
}

export interface AnchorApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  cost?: number;
  duration?: number;
  timestamp: string;
}

export interface AnchorHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  profilesAvailable?: number;
  timestamp?: string;
  regions?: string[];
  limits?: {
    concurrent_sessions: number;
    daily_requests: number;
    monthly_budget: number;
  };
}

export interface SessionMetrics {
  sessionId: string;
  totalRequests: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastActivity: Date;
  createdAt: Date;
}

export interface BudgetLimits {
  dailyBudget: number;
  monthlyBudget: number;
  currentDailySpend: number;
  currentMonthlySpend: number;
  remainingDailyBudget: number;
  remainingMonthlyBudget: number;
}

export interface ExtractionResult {
  data: any;
  metadata: {
    url: string;
    timestamp: string;
    selector?: string;
    extractionTime: number;
    dataType: string;
    confidence?: number;
  };
  cost: number;
}