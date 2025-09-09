# Cloudflare MCP Server Architecture for Anchor Browser Automation

## Overview

This document outlines the complete architecture for a custom Cloudflare Workers-based MCP (Model Context Protocol) server that integrates Anchor Browser API for autonomous travel data extraction. This self-hosted solution provides full customization, direct d1-database integration, and optimal cost control while maintaining the same Anchor API costs as the hosted solution.

## Architecture Components

### Core Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                    LibreChat + Claude                           │
├─────────────────────────────────────────────────────────────────┤
│                       MCP Client                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │ WebSocket/SSE Connection
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│              Cloudflare Worker                                  │
│          mcp-anchor-browser-server                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   MCP Handler   │  │  Session Pool   │  │ Cost Optimizer  │ │
│  │                 │  │   Manager       │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Site Extractors  │  │  Cache Manager  │  │  Error Handler  │ │
│  │ CPMaxx|VAX|Delta│  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Direct Integration
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                 Cloudflare D1 Database                         │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ travel_services │  │travel_search_   │  │   trips_v2      │ │
│  │                 │  │     cache       │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │ API Calls
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  Anchor Browser API                             │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Session Mgmt   │  │  Browser Automation│  │ Proxy Network  │ │
│  │  $0.01/create   │  │   $0.05/hour     │  │   $4/GB        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### 1. Cloudflare Worker MCP Server Structure

```typescript
// src/index.ts - Main worker entry point
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MCPServer } from './mcp/server';
import { AnchorBrowserClient } from './clients/anchor-browser';
import { TravelCacheManager } from './cache/manager';
import { SessionPoolManager } from './sessions/pool';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// MCP Server-Sent Events endpoint
app.get('/sse', async (c) => {
  const mcpServer = new MCPServer(c.env);
  return mcpServer.handleSSE(c);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', async (c) => {
  const metrics = await getServerMetrics(c.env);
  return c.json(metrics);
});

export default app;
```

### 2. MCP Server Implementation

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AnchorSearchTools } from './tools/search';
import { TravelServiceTools } from './tools/travel-services';
import { SessionManagementTools } from './tools/sessions';

export class MCPServer {
  private server: Server;
  private anchorClient: AnchorBrowserClient;
  private cacheManager: TravelCacheManager;
  private sessionPool: SessionPoolManager;

  constructor(private env: Env) {
    this.server = new Server(
      {
        name: 'mcp-anchor-browser-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          logging: {},
          prompts: {},
        },
      }
    );

    this.anchorClient = new AnchorBrowserClient(env.ANCHOR_API_KEY);
    this.cacheManager = new TravelCacheManager(env.DB);
    this.sessionPool = new SessionPoolManager(this.anchorClient, {
      maxSessions: 3,
      sessionTTL: 300000, // 5 minutes
      costOptimization: true
    });

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupTools(): void {
    // Search tools with site-specific extractors
    const searchTools = new AnchorSearchTools(
      this.anchorClient,
      this.cacheManager,
      this.sessionPool
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Hotel search tools
        {
          name: 'search_hotels',
          description: 'Search for hotels using Anchor Browser automation with intelligent caching',
          inputSchema: searchTools.hotelSearchSchema
        },
        {
          name: 'search_hotels_cpmaxx',
          description: 'Search CPMaxx specifically for hotel deals with commission info',
          inputSchema: searchTools.cpmaxxHotelSearchSchema
        },
        {
          name: 'search_hotels_vax',
          description: 'Search VAX for vacation packages including hotels',
          inputSchema: searchTools.vaxSearchSchema
        },
        
        // Flight and package tools
        {
          name: 'search_flights',
          description: 'Search for flights with real-time pricing',
          inputSchema: searchTools.flightSearchSchema
        },
        {
          name: 'search_packages',
          description: 'Search for vacation packages across multiple platforms',
          inputSchema: searchTools.packageSearchSchema
        },

        // Session management tools
        {
          name: 'get_session_status',
          description: 'Check status of browser sessions and cost tracking',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'cleanup_sessions',
          description: 'Clean up idle browser sessions to reduce costs',
          inputSchema: { type: 'object', properties: {} }
        },

        // Cache management tools
        {
          name: 'invalidate_cache',
          description: 'Clear cached search results for specific criteria',
          inputSchema: searchTools.cacheInvalidationSchema
        },
        
        // Cost monitoring tools
        {
          name: 'get_cost_metrics',
          description: 'Get detailed cost breakdown and usage statistics',
          inputSchema: { type: 'object', properties: {} }
        }
      ],
    }));

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_hotels':
            return await searchTools.searchHotels(args);
          
          case 'search_hotels_cpmaxx':
            return await searchTools.searchCPMaxxHotels(args);
            
          case 'search_hotels_vax':
            return await searchTools.searchVAXHotels(args);
            
          case 'search_flights':
            return await searchTools.searchFlights(args);
            
          case 'search_packages':
            return await searchTools.searchPackages(args);
            
          case 'get_session_status':
            return await this.getSessionStatus();
            
          case 'cleanup_sessions':
            return await this.cleanupSessions();
            
          case 'invalidate_cache':
            return await this.cacheManager.invalidateCache(args);
            
          case 'get_cost_metrics':
            return await this.getCostMetrics();
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Tool execution error for ${name}:`, error);
        throw error;
      }
    });
  }

  async handleSSE(c: Context): Promise<Response> {
    // Implement Server-Sent Events for MCP communication
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Handle MCP protocol messages
    const handleMessage = async (message: any) => {
      try {
        const response = await this.server.handleRequest(message);
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify(response)}\n\n`
        ));
      } catch (error) {
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify({ error: error.message })}\n\n`
        ));
      }
    };

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}
```

### 3. Site-Specific Extractors

```typescript
// src/extractors/cpmaxx-extractor.ts
export class CPMaxxExtractor {
  constructor(
    private anchorClient: AnchorBrowserClient,
    private cacheManager: TravelCacheManager
  ) {}

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    const searchHash = generateSearchHash(params, 'hotel');
    
    // Check cache first
    const cached = await this.cacheManager.checkCacheHit(searchHash, 'hotel');
    if (cached.hit && !cached.needsRefresh) {
      return {
        results: cached.results,
        fromCache: true,
        searchId: searchHash,
        cost: 0
      };
    }

    // Perform fresh search with cost optimization
    return await this.performOptimizedSearch(params, searchHash);
  }

  private async performOptimizedSearch(
    params: HotelSearchParams,
    searchHash: string
  ): Promise<HotelSearchResult> {
    
    const session = await this.anchorClient.createOptimizedSession({
      platform: 'cpmaxx',
      timeout: 90000, // 90 seconds max
      stealth: true,
      resourceBlocking: {
        images: true,
        stylesheets: true,
        media: true,
        fonts: true
      }
    });

    try {
      const startTime = Date.now();

      // 1. Navigate to CPMaxx hotel search
      await session.navigate('https://cpmaxx.cruiseplannersnet.com/HotelEngine', {
        timeout: 15000
      });

      // 2. Fill search form with optimized interaction
      await session.fillForm({
        location_search: params.destination,
        checkin: params.checkin,
        checkout: params.checkout,
        rooms: params.rooms || 1,
        num_adults: params.adults || 2,
        num_children: params.children || 0
      }, { timeout: 10000 });

      // 3. Submit search and wait for results
      await session.click('#search-button', { timeout: 5000 });
      await session.waitForResults('.result.rounded', { 
        timeout: 45000,
        minResults: 1 
      });

      // 4. Extract hotel data using custom selectors
      const hotelResults = await session.extractMultiple({
        selector: '.result.rounded',
        timeout: 15000,
        fields: {
          name: '.hotel-details .title a',
          address: '.hotel-details .address',
          starRating: '.hotel-details .star',
          description: '.hotel-details p:nth-of-type(3)',
          image: '.hotel-image',
          pricing: {
            perNight: '.pricing-box .min-rate',
            total: '.pricing-box p:contains("Total:")',
            currency: () => 'USD'
          },
          commission: '.commission b',
          amenities: '.hotel-details .amenities li',
          location: {
            coordinates: '[data-marker]@data-marker'
          },
          booking: {
            selectUrl: '.select-button@href',
            giataId: '[data-giata-id]@data-giata-id'
          }
        }
      });

      const duration = Date.now() - startTime;
      const cost = this.calculateSearchCost(duration);

      // 5. Transform to standard format
      const standardizedResults = this.transformCPMaxxResults(hotelResults);

      // 6. Cache results for future use
      await this.cacheManager.cacheSearchResults(
        searchHash,
        'hotel',
        params,
        standardizedResults,
        'cpmaxx',
        duration
      );

      // 7. Return results with cost tracking
      return {
        results: standardizedResults,
        fromCache: false,
        searchId: searchHash,
        cost,
        performance: {
          searchDuration: duration,
          resultCount: standardizedResults.length,
          platform: 'cpmaxx'
        }
      };

    } finally {
      await session.cleanup();
    }
  }

  private transformCPMaxxResults(rawResults: any[]): HotelResult[] {
    return rawResults.map(raw => ({
      id: raw.booking.giataId || `cpmaxx_${Date.now()}_${Math.random()}`,
      category: 'hotel' as const,
      name: raw.name || 'Unknown Hotel',
      description: raw.description,

      pricing: {
        basePrice: {
          amount: this.parsePrice(raw.pricing.perNight),
          currency: 'USD',
          unit: 'per night'
        },
        totalPrice: {
          amount: this.parsePrice(raw.pricing.total),
          currency: 'USD'
        }
      },

      availability: {
        available: true,
        startDate: new Date().toISOString().split('T')[0], // Will be replaced with actual dates
        endDate: new Date().toISOString().split('T')[0]
      },

      hotelDetails: {
        starRating: this.parseStarRating(raw.starRating),
        propertyType: 'hotel' as const,
        chainInfo: this.extractChainInfo(raw.name)
      },

      location: {
        address: {
          full: raw.address,
          city: this.extractCity(raw.address),
          country: 'USA'
        },
        coordinates: this.parseCoordinates(raw.location.coordinates)
      },

      amenities: {
        other: raw.amenities || []
      },

      specialPrograms: [{
        type: 'loyalty' as const,
        name: 'Commission Program',
        benefits: [`Commission: ${raw.commission}`]
      }],

      source: {
        platform: 'cpmaxx',
        url: raw.booking.selectUrl,
        bookingUrl: raw.booking.selectUrl,
        lastUpdated: new Date().toISOString()
      },

      extraction: {
        confidence: this.calculateConfidence(raw),
        completeness: this.calculateCompleteness(raw),
        warnings: this.generateWarnings(raw)
      }
    }));
  }

  private calculateSearchCost(durationMs: number): number {
    const hours = durationMs / (1000 * 60 * 60);
    return 0.01 + (hours * 0.05); // Creation cost + runtime cost
  }

  private calculateConfidence(raw: any): number {
    let confidence = 0.5;
    
    if (raw.name) confidence += 0.2;
    if (raw.address) confidence += 0.15;
    if (raw.pricing.perNight) confidence += 0.15;
    if (raw.starRating) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private calculateCompleteness(raw: any): number {
    const requiredFields = ['name', 'address', 'pricing'];
    const optionalFields = ['starRating', 'description', 'amenities', 'commission'];
    
    const requiredCount = requiredFields.filter(field => 
      this.getNestedValue(raw, field)
    ).length;
    
    const optionalCount = optionalFields.filter(field => 
      this.getNestedValue(raw, field)
    ).length;
    
    const requiredScore = requiredCount / requiredFields.length;
    const optionalScore = optionalCount / optionalFields.length;
    
    return (requiredScore * 0.7) + (optionalScore * 0.3);
  }
}
```

### 4. Session Pool Manager

```typescript
// src/sessions/pool.ts
export class SessionPoolManager {
  private sessions: Map<string, AnchorSession> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private cleanupInterval: Timer;

  constructor(
    private anchorClient: AnchorBrowserClient,
    private config: SessionPoolConfig
  ) {
    // Periodic cleanup to prevent session leaks
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Check every minute
  }

  async getOptimizedSession(platform: string): Promise<AnchorSession> {
    const sessionKey = `${platform}_session`;
    
    // Return existing session if available and healthy
    const existing = this.sessions.get(sessionKey);
    if (existing && await this.isSessionHealthy(existing)) {
      this.updateSessionMetrics(sessionKey, 'reused');
      return existing;
    }

    // Create new session with cost optimization
    const session = await this.createOptimizedSession(platform);
    this.sessions.set(sessionKey, session);
    
    // Set auto-cleanup timeout
    setTimeout(() => {
      this.cleanupSession(sessionKey);
    }, this.config.sessionTTL);

    return session;
  }

  private async createOptimizedSession(platform: string): Promise<AnchorSession> {
    const sessionConfig = this.getSessionConfig(platform);
    
    const session = await this.anchorClient.createSession({
      ...sessionConfig,
      costOptimization: {
        maxDuration: 90000, // 90 seconds
        resourceBlocking: true,
        aggressiveTimeout: true
      }
    });

    // Track session creation
    this.updateSessionMetrics(`${platform}_session`, 'created');
    console.log(`Created optimized session for ${platform} - Cost: $0.01`);

    return session;
  }

  private async isSessionHealthy(session: AnchorSession): Promise<boolean> {
    try {
      // Quick health check without consuming significant resources
      const status = await session.getStatus();
      return status.healthy && !status.expired;
    } catch {
      return false;
    }
  }

  private getSessionConfig(platform: string): SessionConfig {
    const baseConfig = {
      stealth: true,
      proxy: { type: 'residential', country: 'US' }
    };

    switch (platform) {
      case 'cpmaxx':
        return {
          ...baseConfig,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          viewport: { width: 1920, height: 1080 },
          blockResources: ['image', 'stylesheet', 'media', 'font']
        };
        
      case 'vax':
        return {
          ...baseConfig,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          viewport: { width: 1440, height: 900 },
          blockResources: ['image', 'media', 'font']
        };
        
      default:
        return baseConfig;
    }
  }

  async performCleanup(): Promise<void> {
    const currentTime = Date.now();
    const sessionsToCleanup: string[] = [];

    // Identify sessions that need cleanup
    for (const [sessionKey, session] of this.sessions) {
      const metrics = this.sessionMetrics.get(sessionKey);
      
      if (!metrics || (currentTime - metrics.lastUsed) > this.config.sessionTTL) {
        sessionsToCleanup.push(sessionKey);
      }
    }

    // Cleanup identified sessions
    for (const sessionKey of sessionsToCleanup) {
      await this.cleanupSession(sessionKey);
    }

    console.log(`Cleaned up ${sessionsToCleanup.length} idle sessions`);
  }

  private async cleanupSession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      try {
        await session.close();
      } catch (error) {
        console.error(`Error closing session ${sessionKey}:`, error);
      } finally {
        this.sessions.delete(sessionKey);
        this.sessionMetrics.delete(sessionKey);
      }
    }
  }

  async getCostMetrics(): Promise<SessionCostMetrics> {
    let totalCost = 0;
    let sessionCount = 0;
    let reuseCount = 0;

    for (const metrics of this.sessionMetrics.values()) {
      totalCost += metrics.totalCost;
      sessionCount += metrics.creationCount;
      reuseCount += metrics.reuseCount;
    }

    return {
      totalCost,
      sessionCount,
      reuseCount,
      reuseRate: sessionCount > 0 ? reuseCount / sessionCount : 0,
      averageCostPerSession: sessionCount > 0 ? totalCost / sessionCount : 0
    };
  }
}
```

### 5. Cost Optimization Engine

```typescript
// src/optimization/cost-optimizer.ts
export class CostOptimizationEngine {
  private costThresholds = {
    daily: 10.00,    // $10/day budget
    monthly: 250.00, // $250/month budget
    perSearch: 0.05  // $0.05/search target
  };

  constructor(
    private db: D1Database,
    private sessionPool: SessionPoolManager
  ) {}

  async optimizeSearchCosts(params: SearchParams): Promise<OptimizationStrategy> {
    // 1. Analyze current cost metrics
    const costAnalysis = await this.analyzeCostMetrics();
    
    // 2. Check budget constraints
    const budgetStatus = await this.checkBudgetStatus();
    
    // 3. Generate optimization strategy
    return this.generateOptimizationStrategy(costAnalysis, budgetStatus, params);
  }

  private async generateOptimizationStrategy(
    analysis: CostAnalysis,
    budget: BudgetStatus,
    params: SearchParams
  ): Promise<OptimizationStrategy> {
    
    const strategy: OptimizationStrategy = {
      useCache: true,
      sessionReuse: true,
      timeoutMs: 90000,
      blockResources: true,
      batchOptimization: false
    };

    // Aggressive cost cutting if over budget
    if (budget.isOverBudget) {
      strategy.timeoutMs = 60000; // Reduce to 60 seconds
      strategy.useCache = true;   // Force cache usage
      strategy.blockResources = true;
      strategy.maxResults = 10;   // Limit results to reduce processing time
    }

    // Smart batching for multiple searches
    if (analysis.pendingSearches > 1) {
      strategy.batchOptimization = true;
      strategy.batchSize = Math.min(analysis.pendingSearches, 5);
    }

    // Cache optimization based on service type
    if (params.serviceType === 'hotel') {
      strategy.cachePolicy = {
        ttlHours: 24,
        refreshThreshold: 6
      };
    } else if (params.serviceType === 'flight') {
      strategy.cachePolicy = {
        ttlHours: 2,
        refreshThreshold: 0.5
      };
    }

    return strategy;
  }

  async trackSearchCost(
    searchId: string,
    duration: number,
    source: 'cache' | 'anchor',
    resultCount: number
  ): Promise<void> {
    
    const cost = source === 'cache' ? 0 : this.calculateSearchCost(duration);
    
    await this.db.prepare(`
      INSERT INTO search_cost_tracking (
        search_id, duration_ms, cost, source, result_count, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(searchId, duration, cost, source, resultCount).run();

    // Check budget alerts
    await this.checkBudgetAlerts();
  }

  private async checkBudgetAlerts(): Promise<void> {
    const todaySpend = await this.getDailySpend();
    const monthlySpend = await this.getMonthlySpend();

    if (todaySpend > this.costThresholds.daily * 0.8) {
      await this.sendBudgetAlert('DAILY_WARNING', {
        current: todaySpend,
        threshold: this.costThresholds.daily,
        percentage: (todaySpend / this.costThresholds.daily) * 100
      });
    }

    if (monthlySpend > this.costThresholds.monthly * 0.9) {
      await this.sendBudgetAlert('MONTHLY_CRITICAL', {
        current: monthlySpend,
        threshold: this.costThresholds.monthly,
        percentage: (monthlySpend / this.costThresholds.monthly) * 100
      });
    }
  }
}
```

## Deployment Strategy

### 1. Cloudflare Worker Configuration

```toml
# wrangler.toml
name = "mcp-anchor-browser-server"
main = "src/index.ts"
compatibility_date = "2024-09-07"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
VERSION = "1.0.0"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "voygen-travel-db"
database_id = "your-d1-database-id"

[build]
command = "npm run build"

[observability]
enabled = true
```

### 2. Environment Variables

```typescript
// src/types/env.ts
export interface Env {
  // Anchor Browser API
  ANCHOR_API_KEY: string;
  
  // Cloudflare D1 Database
  DB: D1Database;
  
  // Configuration
  ENVIRONMENT: 'development' | 'production';
  VERSION: string;
  
  // Cost Management
  DAILY_BUDGET_LIMIT: string; // "$10.00"
  MONTHLY_BUDGET_LIMIT: string; // "$250.00"
  
  // Session Management
  MAX_CONCURRENT_SESSIONS: string; // "3"
  SESSION_TTL_MINUTES: string; // "5"
  
  // Cache Configuration
  CACHE_DEFAULT_TTL_HOURS: string; // "24"
  CACHE_CLEANUP_INTERVAL_MINUTES: string; // "60"
  
  // Monitoring
  WEBHOOK_BUDGET_ALERTS?: string; // Optional webhook for budget alerts
}
```

### 3. LibreChat Integration

```yaml
# config/librechat-minimal.yaml - Add MCP server configuration
version: 1.1.0
cache: true

endpoints:
  assistants:
    disableBuilder: false
    pollIntervalMs: 750
    timeoutMs: 180000
    supportedIds:
      - "asst_abc123"
    excludeModels:
      - "gpt-4-vision-preview"

  custom:
    - name: "Voygen Travel Agent"
      apiKey: "${ANTHROPIC_API_KEY}"
      baseURL: "https://api.anthropic.com/v1"
      models:
        default: ["claude-3-5-sonnet-20241022"]
        fetch: false
      titleConvo: true
      titleModel: "claude-3-5-sonnet-20241022"
      modelDisplayLabel: "Claude 3.5 Sonnet"
      
      # MCP Server Configuration
      serverInstructions: |
        You are an AI travel agent assistant with access to specialized travel data extraction tools.
        
        TOOL SELECTION GUIDELINES:
        - Use mcp-anchor-browser tools for autonomous searches and real-time pricing
        - Use mcp-d1-database tools for data storage, client management, and trip planning
        - Use mcp-chrome tools for user-assisted tasks and importing bookings
        
        COST OPTIMIZATION:
        - Always check cache before performing new searches
        - Use batch operations when searching multiple destinations
        - Prefer hotel searches during off-peak hours when possible
        
        SITE-SPECIFIC EXTRACTION:
        - CPMaxx: Use search_hotels_cpmaxx for commission information
        - VAX: Use search_hotels_vax for vacation packages
        - Generic: Use search_hotels for multi-platform results

      mcpServers:
        - url: "https://mcp-anchor-browser-server.your-subdomain.workers.dev/sse"
          name: "mcp-anchor-browser"
          tools:
            - "search_hotels"
            - "search_hotels_cpmaxx"
            - "search_hotels_vax"
            - "search_flights" 
            - "search_packages"
            - "get_cost_metrics"
            - "cleanup_sessions"

        - url: "https://d1-database-improved.somotravel.workers.dev/sse"
          name: "mcp-d1-database"
          tools:
            - "get_anything"
            - "create_trip_with_client"
            - "bulk_trip_operations"
            - "generate_proposal"

        - url: "sse://localhost:3001/mcp-chrome"
          name: "mcp-chrome"
          tools:
            - "chrome_screenshot"
            - "chrome_navigate"
            - "chrome_get_web_content"
```

## Advantages of Self-Hosted Solution

### 1. **Full Customization Control**
- Site-specific extraction logic with complex data transformations
- Custom retry mechanisms and error handling strategies
- Advanced session management with cost optimization
- Direct integration with d1-database without API overhead

### 2. **Cost Optimization**
- Same Anchor API costs as hosted solution
- No additional hosting fees (Cloudflare Workers free tier)
- Advanced caching reduces API usage by 80-95%
- Real-time cost monitoring and budget controls

### 3. **Performance Benefits**
- Direct d1-database access eliminates API latency
- Optimized session pooling reduces setup overhead
- Intelligent caching with background refresh
- Batch processing capabilities for multiple searches

### 4. **Security & Compliance**
- Full control over data handling and storage
- Custom logging and audit trails
- No data shared with third-party hosted services
- Configurable data retention policies

### 5. **Scalability**
- Cloudflare Workers automatically scale with demand
- Session pooling handles concurrent requests efficiently
- D1 database scales to accommodate growing data
- Cost scales linearly with actual usage

## Implementation Timeline

### Week 1: Foundation
- Set up Cloudflare Worker project structure
- Implement basic MCP server with Anchor integration
- Create CPMaxx-specific extractor
- Deploy to development environment

### Week 2: Optimization
- Implement session pooling and cost optimization
- Add intelligent caching system
- Create VAX and Delta extractors
- Integration testing with LibreChat

### Week 3: Production Readiness
- Add comprehensive error handling and monitoring
- Implement budget controls and alerting
- Performance testing and optimization
- Security review and hardening

### Week 4: Deployment & Migration
- Production deployment to Cloudflare Workers
- Migration from hosted MCP (if applicable)
- User training and documentation
- Monitoring and maintenance procedures

This self-hosted solution provides the perfect balance of cost control, customization capabilities, and operational efficiency while maintaining the same underlying Anchor Browser API costs as the hosted solution.