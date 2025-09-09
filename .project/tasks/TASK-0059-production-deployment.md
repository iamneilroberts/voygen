# TASK-0059: Production Deployment & Integration

## Task Overview
**Priority**: High  
**Estimated Time**: 3-4 days  
**Dependencies**: TASK-0055, TASK-0056, TASK-0057, TASK-0058  
**Assignee**: Development Team  

## Objective
Deploy the complete Anchor Browser MCP server to production with full integration into the Voygen travel agent system, including LibreChat configuration, monitoring setup, and operational procedures.

## Success Criteria
- [ ] Production deployment to Cloudflare Workers
- [ ] LibreChat integration with MCP server
- [ ] D1 database migrations applied successfully  
- [ ] Full integration with existing d1-database MCP server
- [ ] Monitoring and alerting system operational
- [ ] Performance testing and optimization complete
- [ ] Documentation and operational procedures ready
- [ ] User training and rollout plan executed

## Technical Requirements

### 1. Production Deployment Architecture
```
Production Environment:
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge Network                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ mcp-anchor-     │  │ d1-database-    │  │   LibreChat     │ │
│  │   browser       │  │  improved       │  │   Frontend      │ │
│  │ (CF Workers)    │  │ (CF Workers)    │  │    (VPS)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Session Pool  │  │ D1 Database     │  │  User Sessions  │ │
│  │   (KV Store)    │  │ (SQLite Edge)   │  │   (MongoDB)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │ External APIs
┌─────────────────▼───────────────────────────────────────────────┐
│               Anchor Browser API                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Browser Sessions│  │  Data Extract   │  │ Proxy Network   │ │
│  │  $0.01/create   │  │   $0.05/hour    │  │   $4/GB         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Cloudflare Workers Deployment
```typescript
// Production wrangler.toml configuration
name = "mcp-anchor-browser"
main = "dist/index.js"
compatibility_date = "2024-09-07"
compatibility_flags = ["nodejs_compat"]
workers_dev = false

# Production environment
[env.production]
vars = { 
  ENVIRONMENT = "production",
  VERSION = "1.0.0",
  LOG_LEVEL = "info"
}

# Custom domain
routes = [
  { pattern = "mcp-anchor-browser.voygen.app/*", custom_domain = true }
]

# D1 Database binding
[[env.production.d1_databases]]
binding = "DB"
database_name = "voygen-travel-db"
database_id = "your-production-d1-id"

# KV Store for session caching
[[env.production.kv_namespaces]]
binding = "SESSION_CACHE"
id = "your-production-kv-id"
preview_id = "your-preview-kv-id"

# Environment secrets (set via Wrangler CLI)
[env.production.vars]
# Set via: wrangler secret put ANCHOR_API_KEY --env production
ANCHOR_API_KEY = "sk-your-production-anchor-key"
DAILY_BUDGET_LIMIT = "50.00"
MONTHLY_BUDGET_LIMIT = "1000.00"
MAX_CONCURRENT_SESSIONS = "5"

# Resource limits for production
[limits]
cpu_ms = 30000        # 30 second CPU limit
memory_mb = 128       # 128MB memory limit

# Analytics and monitoring
[observability]
enabled = true
```

### 3. Database Migration & Setup
```typescript
// migrations/013_anchor_browser_integration.sql
BEGIN TRANSACTION;

-- Session tracking for Anchor Browser
CREATE TABLE IF NOT EXISTS anchor_sessions (
  session_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'idle', 'unhealthy', 'expired')),
  created_at TEXT DEFAULT (datetime('now')),
  last_used TEXT DEFAULT (datetime('now')),
  usage_count INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0.01,
  health_score REAL DEFAULT 1.0,
  metadata_json TEXT
);

CREATE INDEX idx_anchor_sessions_platform ON anchor_sessions(platform);
CREATE INDEX idx_anchor_sessions_status ON anchor_sessions(status);
CREATE INDEX idx_anchor_sessions_last_used ON anchor_sessions(last_used);

-- Cost tracking for optimization engine
CREATE TABLE IF NOT EXISTS cost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  cost REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  result_count INTEGER DEFAULT 0,
  cost_per_result REAL,
  cost_per_minute REAL,
  optimization_applied TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_cost_tracking_platform ON cost_tracking(platform);
CREATE INDEX idx_cost_tracking_created_at ON cost_tracking(created_at);
CREATE INDEX idx_cost_tracking_search_id ON cost_tracking(search_id);

-- Budget and alert management
CREATE TABLE IF NOT EXISTS budget_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  alert_data TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_budget_alerts_severity ON budget_alerts(severity);
CREATE INDEX idx_budget_alerts_created_at ON budget_alerts(created_at);

-- Optimization metrics tracking
CREATE TABLE IF NOT EXISTS optimization_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  baseline_value REAL,
  improvement_percent REAL,
  date_recorded TEXT DEFAULT (date('now')),
  metadata_json TEXT
);

CREATE INDEX idx_optimization_metrics_type ON optimization_metrics(metric_type);
CREATE INDEX idx_optimization_metrics_date ON optimization_metrics(date_recorded);

COMMIT;
```

### 4. LibreChat Integration Configuration
```yaml
# config/librechat-production.yaml
version: 1.1.0
cache: true
debug: false

registration:
  socialLogins: ['google', 'github']
  
endpoints:
  custom:
    - name: "Voygen Travel Agent Pro"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-sonnet-20241022"]
        fetch: false
      titleConvo: true
      titleModel: "claude-3-5-sonnet-20241022"
      modelDisplayLabel: "Claude 3.5 Sonnet"
      
      # Production system instructions
      serverInstructions: |
        You are Voygen, an AI travel agent with access to advanced travel data extraction and client management tools.
        
        PRODUCTION TOOL USAGE:
        - Use mcp-anchor-browser for autonomous hotel, flight, and package searches
        - Use mcp-d1-database for client management, trip planning, and data storage
        - Use mcp-chrome for user-assisted tasks and importing existing bookings
        
        COST OPTIMIZATION (CRITICAL):
        - ALWAYS check cache before performing new searches (use search tools with forceRefresh=false)
        - Batch similar searches when possible (multiple destinations, date ranges)
        - Prefer off-peak search times for non-urgent requests
        - Monitor daily budget limits and adjust search scope accordingly
        
        SEARCH STRATEGY:
        - CPMaxx: Primary for hotel searches with commission data
        - VAX: Vacation packages and all-inclusive deals  
        - Delta: Flight + hotel combinations
        - Generic: Multi-platform comparison searches
        
        QUALITY ASSURANCE:
        - Verify extracted data quality before presenting to clients
        - Flag low-confidence results for manual review
        - Always provide source platform and last-updated timestamps
        
        WORKFLOW INTEGRATION:
        - Link all searches to specific trips when applicable
        - Update trip facts automatically after data extraction
        - Generate proposals only after cost optimization review

      # Production MCP server endpoints
      mcpServers:
        # Anchor Browser MCP Server (Primary search tool)
        - url: "https://mcp-anchor-browser.voygen.app/sse"
          name: "mcp-anchor-browser"
          apiKey: "${ANCHOR_MCP_API_KEY}"
          timeout: 120000
          retries: 2
          tools:
            - "search_hotels"
            - "search_hotels_cpmaxx" 
            - "search_hotels_vax"
            - "search_flights"
            - "search_packages"
            - "get_cost_metrics"
            - "get_session_status" 
            - "cleanup_sessions"
            - "invalidate_cache"
          
        # Enhanced D1 Database MCP Server
        - url: "https://d1-database-improved.somotravel.workers.dev/sse"
          name: "mcp-d1-database"
          timeout: 60000
          retries: 3
          tools:
            - "get_anything"
            - "create_trip_with_client"
            - "bulk_trip_operations"
            - "generate_proposal"
            - "publish_travel_document_with_dashboard_update"
            - "advance_workflow_phase"
            - "get_workflow_status"
            - "continue_trip"

        # Chrome MCP for user-assisted tasks  
        - url: "sse://localhost:3001/mcp-chrome"
          name: "mcp-chrome"
          optional: true
          tools:
            - "chrome_screenshot"
            - "chrome_navigate"
            - "chrome_get_web_content"
            - "chrome_extract_hotels"

fileStrategy: "firebase"
speechToText:
  enabled: true
textToSpeech:
  enabled: true
```

### 5. Monitoring & Observability Setup
```typescript
// src/monitoring/production-monitor.ts
export class ProductionMonitor {
  constructor(private env: Env) {}

  async setupMonitoring(): Promise<void> {
    // Set up Cloudflare Analytics
    await this.configureCloudflareAnalytics();
    
    // Initialize cost monitoring
    await this.initializeCostMonitoring();
    
    // Set up health checks
    await this.setupHealthChecks();
    
    // Configure alerting
    await this.configureAlerting();
  }

  private async configureCloudflareAnalytics(): Promise<void> {
    // Configure Cloudflare Web Analytics
    // Track key metrics: requests, errors, latency, geographical distribution
  }

  private async initializeCostMonitoring(): Promise<void> {
    // Real-time cost tracking dashboard
    const costDashboard = new CostDashboard(this.env);
    await costDashboard.initialize();
    
    // Set up budget alerts
    const budgetMonitor = new BudgetMonitor(this.env);
    await budgetMonitor.setupAlerts({
      dailyThreshold: parseFloat(this.env.DAILY_BUDGET_LIMIT || '50'),
      monthlyThreshold: parseFloat(this.env.MONTHLY_BUDGET_LIMIT || '1000'),
      alertWebhook: this.env.ALERT_WEBHOOK_URL
    });
  }

  async recordMetric(metric: ProductionMetric): Promise<void> {
    // Store in D1 for analysis
    await this.env.DB.prepare(`
      INSERT INTO production_metrics (
        metric_name, metric_value, tags, timestamp
      ) VALUES (?, ?, ?, datetime('now'))
    `).bind(
      metric.name,
      metric.value,
      JSON.stringify(metric.tags),
    ).run();

    // Send to external monitoring if configured
    if (this.env.EXTERNAL_MONITORING_URL) {
      await this.sendToExternalMonitoring(metric);
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [sessionHealth, databaseHealth, anchorHealth, costHealth] = await Promise.all([
      this.checkSessionHealth(),
      this.checkDatabaseHealth(), 
      this.checkAnchorAPIHealth(),
      this.checkCostHealth()
    ]);

    return {
      overall: this.calculateOverallHealth([sessionHealth, databaseHealth, anchorHealth, costHealth]),
      components: {
        sessions: sessionHealth,
        database: databaseHealth,
        anchorAPI: anchorHealth,
        costs: costHealth
      },
      timestamp: new Date().toISOString()
    };
  }
}

// src/monitoring/cost-dashboard.ts  
export class CostDashboard {
  async generateDashboardData(): Promise<DashboardData> {
    const timeframe = '24h';
    
    const [costMetrics, performanceMetrics, optimizationMetrics] = await Promise.all([
      this.getCostMetrics(timeframe),
      this.getPerformanceMetrics(timeframe),
      this.getOptimizationMetrics(timeframe)
    ]);

    return {
      costs: {
        current: costMetrics.current,
        budget: costMetrics.budget,
        projected: costMetrics.projected,
        breakdown: costMetrics.platformBreakdown
      },
      performance: {
        searchCount: performanceMetrics.searchCount,
        averageLatency: performanceMetrics.averageLatency,
        successRate: performanceMetrics.successRate,
        errorRate: performanceMetrics.errorRate
      },
      optimization: {
        costSavings: optimizationMetrics.totalSavings,
        cacheHitRate: optimizationMetrics.cacheHitRate,
        sessionReuseRate: optimizationMetrics.sessionReuseRate,
        recommendations: optimizationMetrics.activeRecommendations
      },
      alerts: await this.getActiveAlerts()
    };
  }
}
```

### 6. Deployment Scripts & CI/CD
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

echo "🚀 Starting Voygen Anchor MCP Production Deployment"

# Environment check
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set"
  exit 1
fi

# Build application
echo "📦 Building application..."
npm run build

# Run tests
echo "🧪 Running production tests..."
npm run test:production

# Database migrations
echo "🗄️ Running database migrations..."
wrangler d1 migrations apply voygen-travel-db --env production

# Deploy to Cloudflare Workers
echo "☁️ Deploying to Cloudflare Workers..."
wrangler deploy --env production

# Verify deployment
echo "✅ Verifying deployment..."
curl -f https://mcp-anchor-browser.voygen.app/health || exit 1

# Update LibreChat configuration
echo "🔄 Updating LibreChat configuration..."
./scripts/update-librechat-config.sh production

# Run smoke tests
echo "🔍 Running smoke tests..."
npm run test:smoke:production

echo "✅ Production deployment complete!"
echo "📊 Dashboard: https://dash.cloudflare.com/workers"
echo "🔍 Monitoring: https://mcp-anchor-browser.voygen.app/metrics"
```

### 7. Production Testing Suite
```typescript
// tests/production/smoke-tests.ts
describe('Production Smoke Tests', () => {
  const baseUrl = 'https://mcp-anchor-browser.voygen.app';
  
  test('Health check endpoint', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
    expect(health.environment).toBe('production');
  });

  test('MCP server connection', async () => {
    const mcpClient = new MCPClient(`${baseUrl}/sse`);
    const tools = await mcpClient.listTools();
    
    expect(tools).toContain('search_hotels');
    expect(tools).toContain('get_cost_metrics');
  });

  test('Anchor API connectivity', async () => {
    const response = await fetch(`${baseUrl}/api/test-anchor`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.ANCHOR_API_KEY}` }
    });
    
    expect(response.status).toBe(200);
  });

  test('Database connectivity', async () => {
    const response = await fetch(`${baseUrl}/api/db-health`);
    expect(response.status).toBe(200);
    
    const dbHealth = await response.json();
    expect(dbHealth.connected).toBe(true);
  });

  test('Cost tracking accuracy', async () => {
    // Perform a small test search and verify cost tracking
    const searchResult = await performTestSearch();
    expect(searchResult.cost).toBeGreaterThan(0);
    expect(searchResult.tracked).toBe(true);
  });
});

// tests/production/load-tests.ts
describe('Production Load Tests', () => {
  test('Concurrent session handling', async () => {
    const concurrentRequests = 10;
    const promises = Array(concurrentRequests).fill(null).map(() =>
      performTestSearch()
    );
    
    const results = await Promise.all(promises);
    
    // All requests should succeed
    expect(results.every(r => r.success)).toBe(true);
    
    // Total cost should be optimized through session reuse
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    expect(totalCost).toBeLessThan(concurrentRequests * 0.1); // Less than $0.10 each
  });

  test('Budget enforcement', async () => {
    // Test that budget limits are enforced
    const highCostSearch = {
      destinations: ['New York', 'London', 'Tokyo', 'Sydney', 'Paris'],
      dateRanges: ['2024-12-01/2024-12-07', '2024-12-15/2024-12-21'],
      platforms: ['cpmaxx', 'vax', 'delta']
    };
    
    const result = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      body: JSON.stringify(highCostSearch)
    });
    
    // Should be throttled or optimized if would exceed budget
    expect([200, 429]).toContain(result.status);
  });
});
```

## Implementation Steps

### Step 1: Environment Preparation (Day 1)
1. Set up production Cloudflare Workers environment
2. Configure production D1 database with migrations
3. Set up KV namespace for session caching
4. Configure environment variables and secrets

### Step 2: Application Deployment (Day 1-2)  
1. Build and deploy MCP server to production
2. Configure custom domain and SSL certificates
3. Set up database migrations and initial data
4. Validate all service integrations

### Step 3: LibreChat Integration (Day 2)
1. Update LibreChat configuration for production
2. Configure MCP server connections
3. Test end-to-end workflow integration
4. Validate tool permissions and access

### Step 4: Monitoring & Observability (Day 2-3)
1. Set up Cloudflare Analytics and monitoring
2. Configure cost tracking and budget alerts
3. Implement health checks and status endpoints
4. Set up external monitoring integrations

### Step 5: Testing & Validation (Day 3-4)
1. Run comprehensive production test suite
2. Perform load testing and performance validation
3. Test cost optimization and budget enforcement
4. Validate monitoring and alerting systems

### Step 6: Documentation & Training (Day 4)
1. Update operational documentation
2. Create user guides and training materials
3. Set up deployment and maintenance procedures
4. Conduct team training and knowledge transfer

## Performance Requirements

### Response Times
- Health checks: < 200ms
- MCP tool execution: < 30s (with optimization)
- Cost tracking: < 100ms
- Session operations: < 500ms

### Availability
- Uptime target: 99.9% (8.76 hours downtime/year)
- Recovery time: < 5 minutes for service restoration
- Data consistency: 100% for cost and billing data

### Scalability
- Concurrent searches: Up to 50 simultaneous
- Daily search volume: Up to 5,000 searches  
- Monthly cost tracking: Up to 150,000 records
- Session pool: Up to 20 concurrent sessions

## Monitoring & Alerting

### Key Metrics
- **Availability**: Service uptime and response times
- **Cost**: Real-time spend tracking and budget utilization
- **Performance**: Search success rates and latency
- **Quality**: Data extraction confidence and completeness
- **Usage**: Tool usage patterns and user activity

### Alert Thresholds
- **Critical**: Service down, budget exceeded
- **High**: High error rate (>5%), cost 90% of budget  
- **Medium**: Degraded performance, cost 80% of budget
- **Low**: Usage anomalies, optimization opportunities

## Security Considerations

### API Security
- Rate limiting on all endpoints
- API key validation and rotation
- Input validation and sanitization
- CORS configuration for allowed origins

### Data Protection
- Encryption in transit (TLS 1.3)
- Sensitive data encryption at rest
- Access logging and audit trails
- PII handling compliance (GDPR/CCPA)

### Cost Security
- Budget limits and automatic cutoffs
- Usage monitoring and anomaly detection
- API key usage tracking
- Cost allocation and reporting

## Operational Procedures

### Deployment Process
1. Feature development and testing
2. Staging environment validation
3. Production deployment with rollback plan
4. Post-deployment verification and monitoring

### Incident Response
1. Automated alerting and notification
2. Incident triage and assessment
3. Resolution and service restoration
4. Post-incident analysis and improvements

### Maintenance Windows
- Scheduled maintenance: Weekends, low-usage hours
- Emergency maintenance: 24/7 capability
- Rollback procedures: Automated rollback triggers
- Communication: User notification system

## Risk Mitigation

### Technical Risks
- **Service Dependencies**: Health checks and fallbacks
- **Cost Overruns**: Multiple budget controls and alerts
- **Performance Issues**: Monitoring and auto-scaling
- **Data Loss**: Backup and recovery procedures

### Business Risks
- **User Impact**: Gradual rollout and feature flags
- **Revenue Impact**: Cost optimization and ROI tracking
- **Compliance**: Regular security and data audits
- **Competitive**: Feature differentiation and quality

## Success Metrics

### Technical Success
- [ ] 99.9% uptime achieved
- [ ] < 30s average search completion time
- [ ] 60-80% cost reduction vs baseline
- [ ] < 1% error rate on production searches

### Business Success
- [ ] Successful user onboarding and training
- [ ] Positive user feedback on search quality
- [ ] Cost savings meeting ROI projections
- [ ] Operational procedures documented and tested

## Deliverables

1. **Production MCP Server** deployed and operational
2. **LibreChat Integration** fully configured and tested
3. **Monitoring & Alerting** system active
4. **Documentation** complete and up-to-date
5. **Operational Procedures** documented and tested
6. **Training Materials** created and delivered
7. **Performance Metrics** baseline established

## Post-Deployment Actions

### Week 1: Stabilization
- Monitor system performance and stability
- Address any production issues or bugs
- Fine-tune optimization parameters
- User feedback collection and analysis

### Month 1: Optimization
- Performance analysis and improvements
- Cost optimization refinements
- Feature enhancement based on usage
- Operational procedure refinements

### Ongoing: Evolution
- Regular performance reviews
- Cost optimization continuous improvement
- Feature roadmap planning and execution
- System scaling and architecture evolution

This production deployment plan ensures a robust, scalable, and cost-effective deployment of the Anchor Browser MCP server while maintaining the highest standards of reliability and performance for the Voygen travel agent system.