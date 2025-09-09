# TASK-0057: Session Pool Management System

## Task Overview
**Priority**: High  
**Estimated Time**: 2-3 days  
**Dependencies**: TASK-0055 (Foundation), TASK-0056 (Extractors)  
**Assignee**: Development Team  

## Objective
Implement an intelligent session pool management system that optimizes Anchor Browser session usage, reduces costs through session reuse, and provides automatic cleanup and monitoring capabilities.

## Success Criteria
- [ ] Session pool with configurable size and TTL settings
- [ ] Automatic session cleanup and health monitoring
- [ ] Cost tracking and optimization metrics
- [ ] Session reuse strategies for different platforms
- [ ] Concurrent session management with queuing
- [ ] Error recovery and session failover mechanisms
- [ ] Real-time monitoring and alerting

## Technical Requirements

### 1. Session Pool Architecture
```
src/sessions/
├── pool/
│   ├── session-pool.ts             # Main pool manager
│   ├── session-factory.ts          # Session creation logic
│   ├── pool-config.ts              # Configuration management
│   └── session-health.ts           # Health monitoring
├── management/
│   ├── session-manager.ts          # Individual session management
│   ├── cleanup-service.ts          # Automated cleanup
│   ├── cost-tracker.ts             # Cost tracking
│   └── metrics-collector.ts        # Performance metrics
├── strategies/
│   ├── reuse-strategy.ts           # Session reuse logic
│   ├── allocation-strategy.ts      # Session allocation
│   └── cleanup-strategy.ts         # Cleanup strategies
└── monitoring/
    ├── health-monitor.ts           # Real-time health checks
    ├── performance-monitor.ts      # Performance tracking
    └── alert-manager.ts            # Alert notifications
```

### 2. Core Session Pool Implementation
```typescript
// src/sessions/pool/session-pool.ts
export interface SessionPoolConfig {
  maxSessions: number;
  sessionTTL: number;
  healthCheckInterval: number;
  cleanupInterval: number;
  costOptimization: {
    enabled: boolean;
    maxSessionCost: number;
    maxDailyBudget: number;
  };
  platforms: {
    [platform: string]: PlatformConfig;
  };
}

export interface PlatformConfig {
  maxConcurrentSessions: number;
  sessionTimeout: number;
  resourceBlocking: ResourceBlockingConfig;
  retryConfig: RetryConfig;
}

export interface SessionMetrics {
  sessionId: string;
  platform: string;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  totalCost: number;
  status: SessionStatus;
  healthScore: number;
}

export enum SessionStatus {
  ACTIVE = 'active',
  IDLE = 'idle', 
  UNHEALTHY = 'unhealthy',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}

export class SessionPool {
  private sessions: Map<string, ManagedSession> = new Map();
  private platformQueues: Map<string, SessionRequest[]> = new Map();
  private metrics: SessionMetrics[] = [];
  private healthMonitor: HealthMonitor;
  private costTracker: CostTracker;
  private cleanupService: CleanupService;

  constructor(
    private config: SessionPoolConfig,
    private anchorClient: AnchorBrowserClient,
    private db: D1Database
  ) {
    this.healthMonitor = new HealthMonitor(this.config);
    this.costTracker = new CostTracker(this.db);
    this.cleanupService = new CleanupService(this.config);
    
    this.startBackgroundServices();
  }

  async getSession(platform: string, priority: number = 0): Promise<ManagedSession> {
    // Check budget constraints
    await this.enforcebudgetLimits();
    
    // Try to get existing healthy session for platform
    const existingSession = this.findAvailableSession(platform);
    if (existingSession) {
      this.updateSessionUsage(existingSession.id);
      return existingSession;
    }

    // Check if we can create new session
    if (this.canCreateNewSession(platform)) {
      return await this.createNewSession(platform);
    }

    // Queue request if at capacity
    return await this.queueSessionRequest(platform, priority);
  }

  private findAvailableSession(platform: string): ManagedSession | null {
    for (const [sessionId, session] of this.sessions) {
      if (
        session.platform === platform &&
        session.status === SessionStatus.ACTIVE &&
        !session.isInUse &&
        this.healthMonitor.isHealthy(session)
      ) {
        return session;
      }
    }
    return null;
  }

  private canCreateNewSession(platform: string): boolean {
    const totalSessions = this.sessions.size;
    const platformSessions = this.getPlatformSessionCount(platform);
    const platformConfig = this.config.platforms[platform];

    return (
      totalSessions < this.config.maxSessions &&
      platformSessions < platformConfig.maxConcurrentSessions
    );
  }

  private async createNewSession(platform: string): Promise<ManagedSession> {
    const platformConfig = this.config.platforms[platform];
    
    try {
      // Create Anchor Browser session with platform-specific config
      const anchorSession = await this.anchorClient.createOptimizedSession({
        platform,
        timeout: platformConfig.sessionTimeout,
        resourceBlocking: platformConfig.resourceBlocking,
        costOptimization: this.config.costOptimization
      });

      // Wrap in managed session
      const managedSession = new ManagedSession(
        anchorSession,
        platform,
        platformConfig,
        this.costTracker
      );

      // Register session
      this.sessions.set(managedSession.id, managedSession);
      this.updateMetrics(managedSession);

      console.log(`Created new session for ${platform}: ${managedSession.id} (Cost: $0.01)`);
      
      return managedSession;

    } catch (error) {
      console.error(`Failed to create session for ${platform}:`, error);
      throw new SessionCreationError(`Session creation failed: ${error.message}`);
    }
  }

  private async queueSessionRequest(platform: string, priority: number): Promise<ManagedSession> {
    return new Promise((resolve, reject) => {
      const request: SessionRequest = {
        platform,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        timeout: setTimeout(() => {
          reject(new Error('Session request timeout'));
        }, 30000) // 30 second timeout
      };

      if (!this.platformQueues.has(platform)) {
        this.platformQueues.set(platform, []);
      }

      // Insert request based on priority
      const queue = this.platformQueues.get(platform)!;
      const insertIndex = queue.findIndex(r => r.priority < priority);
      
      if (insertIndex === -1) {
        queue.push(request);
      } else {
        queue.splice(insertIndex, 0, request);
      }
    });
  }

  async releaseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isInUse = false;
    session.lastUsed = new Date();
    
    this.updateMetrics(session);

    // Process any queued requests for this platform
    await this.processQueuedRequests(session.platform);
  }

  private async processQueuedRequests(platform: string): Promise<void> {
    const queue = this.platformQueues.get(platform);
    if (!queue || queue.length === 0) return;

    const availableSession = this.findAvailableSession(platform);
    if (availableSession) {
      const request = queue.shift()!;
      clearTimeout(request.timeout);
      
      this.updateSessionUsage(availableSession.id);
      request.resolve(availableSession);
    }
  }

  private startBackgroundServices(): void {
    // Health monitoring
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Cleanup service
    setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    // Metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute

    // Budget monitoring
    setInterval(() => {
      this.checkBudgetLimits();
    }, 300000); // Every 5 minutes
  }

  private async performHealthChecks(): Promise<void> {
    const healthChecks = Array.from(this.sessions.values()).map(async (session) => {
      const isHealthy = await this.healthMonitor.checkSession(session);
      
      if (!isHealthy) {
        session.status = SessionStatus.UNHEALTHY;
        console.warn(`Session ${session.id} marked as unhealthy`);
        
        // Attempt recovery or cleanup
        await this.handleUnhealthySession(session);
      }
    });

    await Promise.allSettled(healthChecks);
  }

  private async handleUnhealthySession(session: ManagedSession): Promise<void> {
    try {
      // Try to recover session
      const recovered = await session.attemptRecovery();
      
      if (recovered) {
        session.status = SessionStatus.ACTIVE;
        console.log(`Recovered session ${session.id}`);
      } else {
        // Clean up unhealthy session
        await this.cleanupSession(session.id);
      }
    } catch (error) {
      console.error(`Failed to handle unhealthy session ${session.id}:`, error);
      await this.cleanupSession(session.id);
    }
  }

  private async performCleanup(): Promise<void> {
    const sessionsToCleanup: string[] = [];
    const currentTime = Date.now();

    for (const [sessionId, session] of this.sessions) {
      const age = currentTime - session.createdAt.getTime();
      const timeSinceLastUse = currentTime - session.lastUsed.getTime();

      // Cleanup expired sessions
      if (age > this.config.sessionTTL) {
        sessionsToCleanup.push(sessionId);
        continue;
      }

      // Cleanup idle sessions beyond threshold
      if (
        timeSinceLastUse > this.config.sessionTTL * 0.5 &&
        session.status === SessionStatus.IDLE &&
        !session.isInUse
      ) {
        sessionsToCleanup.push(sessionId);
      }
    }

    // Perform cleanup
    const cleanupPromises = sessionsToCleanup.map(sessionId =>
      this.cleanupSession(sessionId)
    );

    await Promise.allSettled(cleanupPromises);

    if (sessionsToCleanup.length > 0) {
      console.log(`Cleaned up ${sessionsToCleanup.length} sessions`);
    }
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Close the underlying Anchor session
      await session.close();
      
      // Remove from pool
      this.sessions.delete(sessionId);
      
      // Update metrics
      await this.costTracker.recordSessionCleanup(session);
      
      console.log(`Session ${sessionId} cleaned up (Total cost: $${session.totalCost})`);

    } catch (error) {
      console.error(`Error cleaning up session ${sessionId}:`, error);
    }
  }

  async getPoolMetrics(): Promise<PoolMetrics> {
    const sessions = Array.from(this.sessions.values());
    const totalCost = sessions.reduce((sum, session) => sum + session.totalCost, 0);
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === SessionStatus.ACTIVE).length,
      idleSessions: sessions.filter(s => s.status === SessionStatus.IDLE).length,
      unhealthySessions: sessions.filter(s => s.status === SessionStatus.UNHEALTHY).length,
      totalCost,
      averageSessionAge: this.calculateAverageAge(sessions),
      platformDistribution: this.getPlatformDistribution(),
      queuedRequests: this.getTotalQueuedRequests(),
      recentMetrics: this.getRecentMetrics()
    };
  }

  private async enforcebudgetLimits(): Promise<void> {
    if (!this.config.costOptimization.enabled) return;

    const dailyCost = await this.costTracker.getDailyCost();
    const maxDailyBudget = this.config.costOptimization.maxDailyBudget;

    if (dailyCost > maxDailyBudget) {
      throw new BudgetExceededError(`Daily budget exceeded: $${dailyCost} > $${maxDailyBudget}`);
    }
  }
}
```

### 3. Managed Session Wrapper
```typescript
// src/sessions/management/session-manager.ts
export class ManagedSession {
  public readonly id: string;
  public readonly platform: string;
  public readonly createdAt: Date;
  public lastUsed: Date;
  public usageCount: number = 0;
  public totalCost: number = 0.01; // Creation cost
  public status: SessionStatus = SessionStatus.ACTIVE;
  public isInUse: boolean = false;
  public healthScore: number = 1.0;

  private readonly anchorSession: AnchorSession;
  private readonly config: PlatformConfig;
  private readonly costTracker: CostTracker;
  private usageStartTime: number | null = null;

  constructor(
    anchorSession: AnchorSession,
    platform: string,
    config: PlatformConfig,
    costTracker: CostTracker
  ) {
    this.id = anchorSession.id;
    this.platform = platform;
    this.anchorSession = anchorSession;
    this.config = config;
    this.costTracker = costTracker;
    this.createdAt = new Date();
    this.lastUsed = new Date();
  }

  async use<T>(operation: (session: AnchorSession) => Promise<T>): Promise<T> {
    if (this.isInUse) {
      throw new SessionInUseError(`Session ${this.id} is already in use`);
    }

    this.isInUse = true;
    this.usageStartTime = Date.now();
    this.usageCount++;

    try {
      const result = await Promise.race([
        operation(this.anchorSession),
        this.createTimeoutPromise()
      ]);

      this.updateCostTracking();
      this.lastUsed = new Date();
      
      return result;

    } catch (error) {
      this.handleUsageError(error);
      throw error;
    } finally {
      this.isInUse = false;
      this.usageStartTime = null;
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new SessionTimeoutError(`Session ${this.id} operation timed out`));
      }, this.config.sessionTimeout);
    });
  }

  private updateCostTracking(): void {
    if (this.usageStartTime) {
      const durationMs = Date.now() - this.usageStartTime;
      const hours = durationMs / (1000 * 60 * 60);
      const cost = hours * 0.05; // $0.05 per hour

      this.totalCost += cost;
      this.costTracker.recordUsage(this.id, durationMs, cost);
    }
  }

  private handleUsageError(error: any): void {
    console.error(`Session ${this.id} usage error:`, error);
    
    // Decrease health score based on error type
    if (error instanceof SessionTimeoutError) {
      this.healthScore = Math.max(0, this.healthScore - 0.2);
    } else if (error instanceof NetworkError) {
      this.healthScore = Math.max(0, this.healthScore - 0.1);
    } else {
      this.healthScore = Math.max(0, this.healthScore - 0.3);
    }

    // Mark as unhealthy if score is too low
    if (this.healthScore < 0.5) {
      this.status = SessionStatus.UNHEALTHY;
    }
  }

  async attemptRecovery(): Promise<boolean> {
    try {
      // Test basic functionality
      const healthCheck = await this.anchorSession.getStatus();
      
      if (healthCheck.healthy) {
        this.healthScore = Math.min(1.0, this.healthScore + 0.3);
        this.status = SessionStatus.ACTIVE;
        return true;
      }
    } catch (error) {
      console.error(`Recovery failed for session ${this.id}:`, error);
    }
    
    return false;
  }

  async close(): Promise<void> {
    try {
      this.status = SessionStatus.TERMINATED;
      await this.anchorSession.close();
    } catch (error) {
      console.error(`Error closing session ${this.id}:`, error);
    }
  }

  getMetrics(): SessionMetrics {
    return {
      sessionId: this.id,
      platform: this.platform,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      usageCount: this.usageCount,
      totalCost: this.totalCost,
      status: this.status,
      healthScore: this.healthScore
    };
  }
}
```

### 4. Cost Tracking System
```typescript
// src/sessions/management/cost-tracker.ts
export class CostTracker {
  constructor(private db: D1Database) {}

  async recordUsage(sessionId: string, durationMs: number, cost: number): Promise<void> {
    await this.db.prepare(`
      INSERT INTO session_usage_log (
        session_id, duration_ms, cost, timestamp, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(sessionId, durationMs, cost, Date.now()).run();
  }

  async recordSessionCleanup(session: ManagedSession): Promise<void> {
    await this.db.prepare(`
      INSERT INTO session_lifecycle_log (
        session_id, platform, total_usage_count, total_cost, 
        created_at, closed_at, lifetime_ms
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    `).bind(
      session.id,
      session.platform,
      session.usageCount,
      session.totalCost,
      session.createdAt.toISOString(),
      Date.now() - session.createdAt.getTime()
    ).run();
  }

  async getDailyCost(): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total_cost
      FROM session_usage_log 
      WHERE date(created_at) = date('now')
    `).first();

    return result?.total_cost || 0;
  }

  async getMonthlyCost(): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total_cost
      FROM session_usage_log 
      WHERE date(created_at) >= date('now', 'start of month')
    `).first();

    return result?.total_cost || 0;
  }

  async getCostAnalytics(): Promise<CostAnalytics> {
    // Implementation for detailed cost analytics
    const daily = await this.getDailyCost();
    const monthly = await this.getMonthlyCost();
    
    const sessionStats = await this.db.prepare(`
      SELECT 
        platform,
        COUNT(*) as session_count,
        AVG(total_cost) as avg_cost_per_session,
        SUM(total_cost) as total_platform_cost
      FROM session_lifecycle_log
      WHERE date(created_at) >= date('now', '-7 days')
      GROUP BY platform
    `).all();

    return {
      dailyCost: daily,
      monthlyCost: monthly,
      platformBreakdown: sessionStats,
      costTrends: await this.getCostTrends()
    };
  }
}
```

### 5. Health Monitoring
```typescript
// src/sessions/monitoring/health-monitor.ts
export class HealthMonitor {
  constructor(private config: SessionPoolConfig) {}

  async checkSession(session: ManagedSession): Promise<boolean> {
    try {
      // Basic availability check
      const status = await session.anchorSession.getStatus();
      if (!status.healthy) return false;

      // Performance check
      const responseTime = await this.measureResponseTime(session);
      if (responseTime > 10000) return false; // 10 second threshold

      // Resource usage check
      const resourceUsage = await this.checkResourceUsage(session);
      if (resourceUsage.memoryMB > 500) return false; // Memory threshold

      return true;

    } catch (error) {
      console.error(`Health check failed for session ${session.id}:`, error);
      return false;
    }
  }

  private async measureResponseTime(session: ManagedSession): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Simple operation to measure response time
      await session.anchorSession.getStatus();
      return Date.now() - startTime;
    } catch (error) {
      return Infinity; // Failed operations count as infinite response time
    }
  }

  private async checkResourceUsage(session: ManagedSession): Promise<ResourceUsage> {
    // Implementation would depend on Anchor Browser API capabilities
    // This is a placeholder for resource monitoring
    return {
      memoryMB: 100,
      cpuPercent: 15,
      networkMbps: 2
    };
  }

  isHealthy(session: ManagedSession): boolean {
    return (
      session.status === SessionStatus.ACTIVE &&
      session.healthScore > 0.5 &&
      !this.isSessionStale(session)
    );
  }

  private isSessionStale(session: ManagedSession): boolean {
    const staleThreshold = this.config.sessionTTL * 0.8;
    const age = Date.now() - session.lastUsed.getTime();
    return age > staleThreshold;
  }
}
```

## Implementation Steps

### Step 1: Core Pool Infrastructure (Day 1)
1. Implement SessionPool class with basic functionality
2. Create ManagedSession wrapper class
3. Set up session lifecycle management
4. Add basic health monitoring

### Step 2: Cost Tracking & Optimization (Day 1-2)
1. Implement CostTracker with database integration
2. Add budget enforcement mechanisms
3. Create cost analytics and reporting
4. Test cost calculation accuracy

### Step 3: Advanced Features (Day 2)
1. Implement session queuing system
2. Add platform-specific configurations
3. Create health monitoring and recovery
4. Implement cleanup strategies

### Step 4: Monitoring & Alerting (Day 2-3)
1. Add real-time metrics collection
2. Implement alert system for budget/health
3. Create monitoring dashboard endpoints
4. Performance optimization and tuning

### Step 5: Integration & Testing (Day 3)
1. Integration with extractor system
2. Load testing with concurrent sessions
3. Failover and recovery testing
4. Cost optimization validation

## Testing Strategy

### Unit Tests
- [ ] Session pool operations (create, reuse, cleanup)
- [ ] Cost calculation accuracy
- [ ] Health monitoring algorithms
- [ ] Queue management logic

### Integration Tests
- [ ] Multi-platform session management
- [ ] Concurrent usage scenarios
- [ ] Error recovery mechanisms
- [ ] Budget enforcement testing

### Load Tests
- [ ] High concurrency session requests
- [ ] Session pool under stress
- [ ] Memory and resource usage
- [ ] Cost optimization under load

## Performance Targets

- **Session Reuse Rate**: > 80%
- **Average Session Lifetime**: 5-10 minutes
- **Pool Response Time**: < 100ms
- **Cleanup Efficiency**: > 95% successful cleanups
- **Cost Reduction**: 60-70% vs individual sessions

## Monitoring & Alerting

### Key Metrics
- Session pool utilization
- Cost per platform per day
- Session health scores
- Queue wait times
- Error rates and recovery success

### Alert Conditions
- Daily budget > 80% consumed
- Session creation failures > 5%
- Unhealthy session rate > 20%
- Queue wait times > 30 seconds

## Deliverables

1. **Complete Session Pool System** with intelligent management
2. **Cost Tracking Infrastructure** with analytics
3. **Health Monitoring System** with automatic recovery
4. **Performance Monitoring** and alerting
5. **Integration APIs** for extractor systems
6. **Comprehensive Test Suite** covering all scenarios

## Risk Mitigation

### Session Leaks
- Automatic cleanup with multiple safety nets
- Resource monitoring and alerts
- Session lifecycle tracking

### Cost Overruns
- Real-time budget monitoring
- Automatic session limiting
- Cost projection and alerting

### Performance Issues
- Session health monitoring
- Automatic failover mechanisms
- Performance metrics and optimization

## Next Steps

After completion:
- TASK-0058: Cost Optimization Engine Integration
- TASK-0059: Cache System Integration  
- TASK-0060: Production Deployment
- TASK-0061: Monitoring & Alerting System