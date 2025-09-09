# Task: Intent-Based Query System
**Phase**: 4 - Advanced Features  
**Priority**: Medium  
**Duration**: 2-3 days  
**Dependencies**: phase1-2-mcp-server-tools  

## Objective
Create an intelligent query system that understands natural language intent and provides templated responses for common travel planning patterns.

## Deliverables
- [ ] Intent recognition system
- [ ] Templated query patterns
- [ ] Fallback to fact table queries
- [ ] Admin ad-hoc SQL interface (dev only)

## Implementation Steps

### 1. Intent Classification System (Day 1)
**Location**: `/remote-mcp-servers/d1-database-improved/src/services/intent-classifier.ts`

#### Core Intent Categories
```typescript
enum QueryIntent {
  // Trip planning intents
  FIND_TRIPS = 'find_trips',
  COMPARE_OPTIONS = 'compare_options',
  CHECK_AVAILABILITY = 'check_availability',
  
  // Client management
  CLIENT_HISTORY = 'client_history',
  CLIENT_PREFERENCES = 'client_preferences',
  
  // Financial analysis
  COMMISSION_ANALYSIS = 'commission_analysis',
  BUDGET_PLANNING = 'budget_planning',
  COST_BREAKDOWN = 'cost_breakdown',
  
  // Reporting
  PERFORMANCE_METRICS = 'performance_metrics',
  BOOKING_TRENDS = 'booking_trends',
  
  // Generic queries
  GENERAL_SEARCH = 'general_search',
  COMPLEX_QUERY = 'complex_query'
}

interface IntentMatch {
  intent: QueryIntent;
  confidence: number;
  entities: Map<string, string>;
  parameters: Record<string, any>;
}
```

#### Intent Matcher Implementation
```typescript
export class IntentClassifier {
  private patterns: Map<QueryIntent, Pattern[]>;
  
  constructor() {
    this.patterns = this.buildPatterns();
  }
  
  classify(query: string): IntentMatch {
    const normalized = this.normalizeQuery(query);
    const matches = [];
    
    for (const [intent, patterns] of this.patterns) {
      for (const pattern of patterns) {
        const match = this.matchPattern(normalized, pattern);
        if (match.score > 0.3) {
          matches.push({
            intent,
            confidence: match.score,
            entities: match.entities,
            parameters: match.parameters
          });
        }
      }
    }
    
    // Return highest confidence match
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches[0] || this.createFallbackMatch(query);
  }
  
  private buildPatterns(): Map<QueryIntent, Pattern[]> {
    return new Map([
      [QueryIntent.FIND_TRIPS, [
        {
          keywords: ['trips', 'find', 'search', 'show'],
          entities: ['destination', 'client', 'date'],
          template: 'find_trips_by_{entity}'
        },
        {
          keywords: ['upcoming', 'future', 'next'],
          entities: ['month', 'year'],
          template: 'upcoming_trips'
        }
      ]],
      
      [QueryIntent.COMMISSION_ANALYSIS, [
        {
          keywords: ['commission', 'earnings', 'revenue'],
          entities: ['period', 'client', 'trip'],
          template: 'commission_report'
        },
        {
          keywords: ['optimize', 'maximize', 'increase'],
          entities: ['commission'],
          template: 'commission_optimization'
        }
      ]],
      
      [QueryIntent.CLIENT_HISTORY, [
        {
          keywords: ['client', 'customer', 'history'],
          entities: ['name', 'email'],
          template: 'client_trip_history'
        },
        {
          keywords: ['preferences', 'likes', 'dislikes'],
          entities: ['client'],
          template: 'client_preferences'
        }
      ]]
    ]);
  }
}
```

### 2. Template Query System (Day 1-2)
**Location**: `/src/services/template-queries.ts`

#### Query Templates
```typescript
export class TemplateQueryBuilder {
  private templates: Map<string, QueryTemplate>;
  
  constructor() {
    this.templates = this.buildTemplates();
  }
  
  buildQuery(
    template: string,
    parameters: Record<string, any>
  ): DatabaseQuery {
    const queryTemplate = this.templates.get(template);
    if (!queryTemplate) {
      throw new Error(`Unknown template: ${template}`);
    }
    
    return {
      sql: this.interpolateTemplate(queryTemplate.sql, parameters),
      params: this.buildParams(queryTemplate.params, parameters),
      postProcess: queryTemplate.postProcess
    };
  }
  
  private buildTemplates(): Map<string, QueryTemplate> {
    return new Map([
      ['find_trips_by_destination', {
        sql: `
          SELECT tf.facts, t.status, t.created_at
          FROM trip_facts tf
          JOIN Trips t ON tf.trip_id = t.trip_id
          WHERE JSON_EXTRACT(tf.facts, '$.destination') LIKE ?
          ORDER BY t.created_at DESC
          LIMIT ?
        `,
        params: ['%{destination}%', '{limit:10}'],
        postProcess: (results) => this.enrichTripResults(results)
      }],
      
      ['commission_report', {
        sql: `
          SELECT 
            tf.trip_id,
            JSON_EXTRACT(tf.facts, '$.client.name') as client_name,
            JSON_EXTRACT(tf.facts, '$.destination') as destination,
            tf.total_commission_potential,
            JSON_EXTRACT(tf.facts, '$.bookings.confirmed_commission') as actual_commission
          FROM trip_facts tf
          WHERE tf.updated_at >= ?
          ORDER BY tf.total_commission_potential DESC
        `,
        params: ['{start_date}'],
        postProcess: (results) => this.calculateCommissionSummary(results)
      }],
      
      ['client_trip_history', {
        sql: `
          SELECT tf.facts
          FROM trip_facts tf
          WHERE JSON_EXTRACT(tf.facts, '$.client.email') = ?
          ORDER BY JSON_EXTRACT(tf.facts, '$.dates.start') DESC
        `,
        params: ['{client_email}'],
        postProcess: (results) => this.buildClientProfile(results)
      }],
      
      ['upcoming_trips', {
        sql: `
          SELECT tf.facts, t.status
          FROM trip_facts tf
          JOIN Trips t ON tf.trip_id = t.trip_id
          WHERE JSON_EXTRACT(tf.facts, '$.dates.start') >= date('now')
          AND t.status IN ('planning', 'confirmed')
          ORDER BY JSON_EXTRACT(tf.facts, '$.dates.start') ASC
        `,
        params: [],
        postProcess: (results) => this.groupByMonth(results)
      }]
    ]);
  }
}
```

### 3. Smart Query Engine (Day 2)
**Location**: `/src/services/smart-query-engine.ts`

#### Main Query Engine
```typescript
export class SmartQueryEngine {
  private intentClassifier: IntentClassifier;
  private templateBuilder: TemplateQueryBuilder;
  private factQuerier: FactTableQuerier;
  
  async processQuery(
    query: string,
    context?: QueryContext
  ): Promise<QueryResult> {
    try {
      // 1. Classify intent
      const intent = this.intentClassifier.classify(query);
      
      // 2. Try template query first
      if (intent.confidence > 0.7) {
        const templateResult = await this.executeTemplateQuery(intent);
        if (templateResult.success) {
          return templateResult;
        }
      }
      
      // 3. Fallback to fact table search
      const factResult = await this.searchFactTable(query, intent);
      if (factResult.success) {
        return factResult;
      }
      
      // 4. Last resort: semantic search
      return await this.semanticSearch(query, context);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: this.suggestAlternativeQuery(query)
      };
    }
  }
  
  private async executeTemplateQuery(
    intent: IntentMatch
  ): Promise<QueryResult> {
    const template = this.findBestTemplate(intent);
    if (!template) {
      return { success: false, error: 'No suitable template found' };
    }
    
    // Build and execute query
    const dbQuery = this.templateBuilder.buildQuery(template, intent.parameters);
    const results = await this.executeQuery(dbQuery);
    
    return {
      success: true,
      data: results,
      source: 'template',
      template_used: template,
      confidence: intent.confidence
    };
  }
  
  private async searchFactTable(
    query: string,
    intent: IntentMatch
  ): Promise<QueryResult> {
    // Extract search terms and build fact table query
    const searchTerms = this.extractSearchTerms(query);
    const factQuery = this.buildFactSearchQuery(searchTerms, intent);
    
    const results = await this.executeQuery(factQuery);
    
    return {
      success: results.length > 0,
      data: results,
      source: 'fact_table',
      search_terms: searchTerms
    };
  }
  
  private buildFactSearchQuery(
    terms: string[],
    intent: IntentMatch
  ): DatabaseQuery {
    // Build JSON search across fact table
    const conditions = terms.map(term => 
      `tf.facts LIKE '%${term}%'`
    ).join(' AND ');
    
    const sql = `
      SELECT 
        tf.trip_id,
        tf.facts,
        tf.lead_price_min,
        tf.total_commission_potential
      FROM trip_facts tf
      WHERE ${conditions}
      ORDER BY tf.updated_at DESC
      LIMIT 20
    `;
    
    return { sql, params: [] };
  }
}
```

### 4. Admin SQL Interface (Day 2-3)
**Location**: `/src/tools/admin-sql.ts` (Development Only)

#### Secure SQL Interface
```typescript
export class AdminSQLInterface {
  private allowedOperations: Set<string>;
  private safetyChecks: SafetyCheck[];
  
  constructor() {
    this.allowedOperations = new Set([
      'SELECT', 'EXPLAIN', 'DESCRIBE', 'SHOW'
    ]);
    
    this.safetyChecks = [
      this.checkReadOnly,
      this.checkTableAccess,
      this.checkResourceLimits
    ];
  }
  
  async executeAdminQuery(
    sql: string,
    adminKey: string
  ): Promise<AdminQueryResult> {
    // Verify admin access
    if (!this.verifyAdminAccess(adminKey)) {
      throw new Error('Unauthorized admin access');
    }
    
    // Parse and validate SQL
    const parsed = this.parseSQL(sql);
    
    // Run safety checks
    for (const check of this.safetyChecks) {
      const result = await check(parsed);
      if (!result.safe) {
        throw new Error(`Safety check failed: ${result.reason}`);
      }
    }
    
    // Execute query with timeout
    const startTime = Date.now();
    const results = await this.executeWithTimeout(sql, 30000);
    const duration = Date.now() - startTime;
    
    return {
      results,
      duration,
      rows_affected: results.length,
      warnings: this.generateWarnings(parsed),
      execution_plan: await this.getExecutionPlan(sql)
    };
  }
  
  private checkReadOnly(parsed: ParsedSQL): SafetyResult {
    const operation = parsed.operation.toUpperCase();
    
    if (!this.allowedOperations.has(operation)) {
      return {
        safe: false,
        reason: `Write operation ${operation} not allowed in admin interface`
      };
    }
    
    return { safe: true };
  }
  
  private checkResourceLimits(parsed: ParsedSQL): SafetyResult {
    // Check for potential expensive operations
    if (parsed.hasJoins > 3) {
      return {
        safe: false,
        reason: 'Query has too many joins (max 3)'
      };
    }
    
    if (!parsed.hasLimit || parsed.limit > 1000) {
      return {
        safe: false,
        reason: 'Query must have LIMIT <= 1000'
      };
    }
    
    return { safe: true };
  }
}
```

### 5. MCP Tool Integration (Day 3)
**Location**: `/src/tools/query-tools.ts`

#### Tool: `smart_query`
```typescript
{
  name: 'smart_query',
  description: 'Process natural language queries about trips and clients',
  inputSchema: {
    query: string;
    context?: {
      trip_id?: string;
      client_id?: string;
      date_range?: {
        start: string;
        end: string;
      };
    };
    max_results?: number;
    include_debug?: boolean;
  }
}

export async function smartQueryHandler(
  db: D1Database,
  input: SmartQueryInput
): Promise<SmartQueryResult> {
  const engine = new SmartQueryEngine(db);
  
  const result = await engine.processQuery(
    input.query,
    input.context
  );
  
  if (input.include_debug) {
    result.debug = {
      intent_classification: engine.getLastIntentMatch(),
      template_used: result.template_used,
      execution_time: result.execution_time
    };
  }
  
  return result;
}
```

#### Tool: `admin_sql` (Development Only)
```typescript
{
  name: 'admin_sql',
  description: 'Execute read-only SQL queries (admin only)',
  inputSchema: {
    sql: string;
    admin_key: string;
    explain?: boolean;
  }
}
```

### 6. Query Optimization and Caching (Day 3)
**Location**: `/src/services/query-cache.ts`

#### Query Result Caching
```typescript
export class QueryCache {
  private cache: Map<string, CachedResult>;
  private ttl: number = 300000; // 5 minutes
  
  async get(
    query: string,
    context?: QueryContext
  ): Promise<QueryResult | null> {
    const key = this.generateCacheKey(query, context);
    const cached = this.cache.get(key);
    
    if (cached && !this.isExpired(cached)) {
      return cached.result;
    }
    
    return null;
  }
  
  async set(
    query: string,
    context: QueryContext,
    result: QueryResult
  ): Promise<void> {
    const key = this.generateCacheKey(query, context);
    
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0
    });
    
    // Cleanup old entries
    this.cleanup();
  }
  
  private generateCacheKey(
    query: string,
    context?: QueryContext
  ): string {
    const normalized = query.toLowerCase().trim();
    const contextStr = context ? JSON.stringify(context) : '';
    return `${normalized}:${contextStr}`;
  }
}
```

## Success Criteria
- Intent classification >80% accuracy
- Template queries execute <100ms
- Fallback to fact table works seamlessly
- Admin interface is secure and safe
- Query cache reduces response time by 50%+

## Testing Strategy

### Unit Tests
- [ ] Intent classification accuracy
- [ ] Template query building
- [ ] Safety checks for admin interface
- [ ] Cache hit/miss logic

### Integration Tests
- [ ] End-to-end query processing
- [ ] Fallback mechanisms
- [ ] Error handling
- [ ] Performance under load

### Security Tests
- [ ] Admin access controls
- [ ] SQL injection prevention
- [ ] Resource limit enforcement
- [ ] Read-only operation validation

## Example Queries to Support

```
Natural Language → Intent → Template/Query

"Show me trips to Hawaii" 
→ FIND_TRIPS 
→ find_trips_by_destination

"What's the commission on the Smith family trip?"
→ COMMISSION_ANALYSIS 
→ trip_commission_breakdown

"Find clients who prefer luxury hotels"
→ CLIENT_PREFERENCES 
→ clients_by_preference

"Upcoming trips next month"
→ FIND_TRIPS + TIME_FILTER
→ upcoming_trips

"Best commission opportunities"
→ COMMISSION_ANALYSIS
→ top_commission_trips
```

## Notes
- Consider implementing query suggestions
- Add support for follow-up questions
- Plan for multi-language support
- Implement query performance monitoring
- Consider natural language response generation