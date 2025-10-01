import { 
  AnchorSession, 
  AnchorSessionConfig, 
  AnchorNavigateOptions,
  AnchorScreenshotOptions,
  AnchorExtractOptions,
  AnchorClickOptions,
  AnchorTypeOptions,
  AnchorWaitOptions,
  AnchorApiResponse,
  AnchorHealthCheck,
  SessionMetrics,
  BudgetLimits,
  ExtractionResult
} from '../types/anchor';
import { createLogger, Logger } from '../utils/logger';
import { 
  AnchorApiError, 
  AnchorSessionError, 
  BudgetExceededError, 
  RateLimitError,
  DefaultErrorHandler,
  withRetry
} from '../utils/errors';
import { Env } from '../types/env';

export class AnchorBrowserClient {
  private baseUrl = 'https://api.anchorbrowser.io';
  private logger: Logger;
  private errorHandler: DefaultErrorHandler;
  private sessions: Map<string, AnchorSession> = new Map();

  constructor(private apiKey: string, private env?: Env) {
    if (!apiKey) {
      throw new Error('Anchor API key is required');
    }

    this.logger = createLogger(env || { ENVIRONMENT: 'development' } as any, 'AnchorBrowserClient');
    this.errorHandler = new DefaultErrorHandler(this.logger);
  }

  private getHeaders(): Record<string, string> {
    return {
      'anchor-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'mcp-anchor-browser/1.0.0'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<AnchorApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        throw new RateLimitError(`Rate limit exceeded`, retryAfter);
      }

      if (response.status === 402) {
        throw new BudgetExceededError(`Budget limit exceeded`, 0, 0);
      }

      const errorData = await response.json().catch(() => ({}));
      throw new AnchorApiError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        errorData,
        response.status
      );
    }

    return await response.json();
  }

  async testConnection(): Promise<AnchorHealthCheck> {
    try {
      this.logger.info('Testing Anchor Browser API connection');
      
      const response = await withRetry(
        () => this.makeRequest<{count: number, items: any[]}>('/v1/profiles'),
        this.errorHandler,
        3,
        'testConnection'
      );

      this.logger.info('Successfully connected to Anchor Browser API', { 
        profileCount: response.data?.count,
        profiles: response.data?.items?.length 
      });

      // Convert profiles response to health check format
      const healthCheck: AnchorHealthCheck = {
        status: 'healthy',
        version: '1.0.0',
        profilesAvailable: response.data?.count || 0
      };

      return healthCheck;
    } catch (error) {
      this.logger.error('Failed to connect to Anchor Browser API:', error);
      throw error;
    }
  }

  async createSession(config?: AnchorSessionConfig): Promise<AnchorSession> {
    try {
      this.logger.info('Creating new Anchor Browser session', { config });

      const sessionPayload = {
        session: {
          initial_url: config?.initialUrl || 'https://example.com'
        },
        browser: {
          headless: { active: true }
        }
      };

      const response = await withRetry(
        () => this.makeRequest<{ id: string; cdp_url: string; live_view_url: string }>('/v1/sessions', {
          method: 'POST',
          body: JSON.stringify(sessionPayload)
        }),
        this.errorHandler,
        3,
        'createSession'
      );

      if (!response.data?.id) {
        throw new AnchorSessionError('No session ID returned from API');
      }

      const session: AnchorSession = {
        id: response.data.id,
        status: 'active',
        createdAt: new Date(),
        lastUsed: new Date(),
        totalCost: 0.01, // Default cost
        metadata: {
          userAgent: config?.userAgent,
          viewport: config?.viewport,
          proxy: config?.proxy,
          region: config?.region,
          cdpUrl: response.data.cdp_url,
          liveViewUrl: response.data.live_view_url
        }
      };

      this.sessions.set(session.id, session);
      this.logger.info(`Created session ${session.id}`, { 
        cdpUrl: response.data.cdp_url,
        liveViewUrl: response.data.live_view_url
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<AnchorSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async navigate(sessionId: string, options: AnchorNavigateOptions): Promise<void> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.info(`Navigating session ${sessionId} to ${options.url}`);

      await withRetry(
        () => this.makeRequest(`/sessions/${sessionId}/navigate`, {
          method: 'POST',
          body: JSON.stringify(options)
        }),
        this.errorHandler,
        2,
        'navigate'
      );

      this.logger.info(`Successfully navigated to ${options.url}`);
    } catch (error) {
      this.logger.error(`Navigation failed for ${options.url}:`, error);
      throw error;
    }
  }

  async screenshot(sessionId: string, options?: AnchorScreenshotOptions): Promise<string> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.info(`Taking screenshot for session ${sessionId}`, options);

      const response = await withRetry(
        () => this.makeRequest<{ screenshot: string; cost: number }>(`/sessions/${sessionId}/screenshot`, {
          method: 'POST',
          body: JSON.stringify(options || {})
        }),
        this.errorHandler,
        2,
        'screenshot'
      );

      await this.addSessionCost(sessionId, response.data?.cost || 0.02);
      
      return response.data?.screenshot || '';
    } catch (error) {
      this.logger.error('Screenshot failed:', error);
      throw error;
    }
  }

  async extract(sessionId: string, options: AnchorExtractOptions): Promise<ExtractionResult> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.info(`Extracting data from session ${sessionId}`, options);

      const response = await withRetry(
        () => this.makeRequest<{
          data: any;
          metadata: any;
          cost: number;
        }>(`/sessions/${sessionId}/extract`, {
          method: 'POST',
          body: JSON.stringify(options)
        }),
        this.errorHandler,
        2,
        'extract'
      );

      await this.addSessionCost(sessionId, response.data?.cost || 0.01);

      return {
        data: response.data?.data,
        metadata: {
          ...response.data?.metadata,
          timestamp: new Date().toISOString(),
          extractionTime: response.duration || 0
        },
        cost: response.data?.cost || 0.01
      };
    } catch (error) {
      this.logger.error('Data extraction failed:', error);
      throw error;
    }
  }

  async click(sessionId: string, options: AnchorClickOptions): Promise<void> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.info(`Clicking in session ${sessionId}`, options);

      await withRetry(
        () => this.makeRequest(`/sessions/${sessionId}/click`, {
          method: 'POST',
          body: JSON.stringify(options)
        }),
        this.errorHandler,
        2,
        'click'
      );

      this.logger.debug('Click completed successfully');
    } catch (error) {
      this.logger.error('Click action failed:', error);
      throw error;
    }
  }

  async type(sessionId: string, options: AnchorTypeOptions): Promise<void> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.info(`Typing in session ${sessionId}`, { 
        selector: options.selector, 
        textLength: options.text.length 
      });

      await withRetry(
        () => this.makeRequest(`/sessions/${sessionId}/type`, {
          method: 'POST',
          body: JSON.stringify(options)
        }),
        this.errorHandler,
        2,
        'type'
      );

      this.logger.debug('Type action completed successfully');
    } catch (error) {
      this.logger.error('Type action failed:', error);
      throw error;
    }
  }

  async wait(sessionId: string, options: AnchorWaitOptions): Promise<void> {
    await this.updateSessionUsage(sessionId);

    try {
      this.logger.debug(`Waiting in session ${sessionId}`, options);

      await withRetry(
        () => this.makeRequest(`/sessions/${sessionId}/wait`, {
          method: 'POST',
          body: JSON.stringify(options)
        }),
        this.errorHandler,
        2,
        'wait'
      );

      this.logger.debug('Wait completed successfully');
    } catch (error) {
      this.logger.error('Wait action failed:', error);
      throw error;
    }
  }

  async getSessionMetrics(sessionId: string): Promise<SessionMetrics | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    try {
      const response = await this.makeRequest<{
        requests: number;
        errors: number;
        avgResponseTime: number;
      }>(`/sessions/${sessionId}/metrics`);

      return {
        sessionId,
        totalRequests: response.data?.requests || 0,
        totalCost: session.totalCost,
        averageResponseTime: response.data?.avgResponseTime || 0,
        errorRate: response.data?.errors || 0,
        lastActivity: session.lastUsed,
        createdAt: session.createdAt
      };
    } catch (error) {
      this.logger.warn(`Failed to get metrics for session ${sessionId}:`, error);
      return null;
    }
  }

  async getBudgetLimits(): Promise<BudgetLimits> {
    try {
      const response = await this.makeRequest<BudgetLimits>('/account/budget');
      return response.data!;
    } catch (error) {
      this.logger.warn('Failed to get budget limits:', error);
      return {
        dailyBudget: 100,
        monthlyBudget: 1000,
        currentDailySpend: 0,
        currentMonthlySpend: 0,
        remainingDailyBudget: 100,
        remainingMonthlyBudget: 1000
      };
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      await this.makeRequest(`/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'closed';
        this.logger.info(`Closed session ${sessionId}`, { totalCost: session.totalCost });
      }

      this.sessions.delete(sessionId);
    } catch (error) {
      this.logger.error(`Failed to close session ${sessionId}:`, error);
    }
  }

  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    this.logger.info(`Closing ${sessionIds.length} sessions`);

    await Promise.allSettled(
      sessionIds.map(id => this.closeSession(id))
    );
  }

  private async updateSessionUsage(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date();
    } else {
      throw new AnchorSessionError(`Session ${sessionId} not found`, sessionId);
    }
  }

  private async addSessionCost(sessionId: string, cost: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalCost += cost;
    }
  }

  getActiveSessions(): AnchorSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  getTotalCost(): number {
    return Array.from(this.sessions.values()).reduce((total, session) => {
      return total + session.totalCost;
    }, 0);
  }
}