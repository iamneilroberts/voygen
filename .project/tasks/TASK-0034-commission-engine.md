# Task: Commission Calculation Engine
**Phase**: 2 - Data Extraction Integration  
**Priority**: High  
**Duration**: 2-3 days  
**Dependencies**: phase1-2-mcp-server-tools  

## Objective
Implement a comprehensive commission calculation and optimization engine that maximizes revenue while meeting client preferences.

## Deliverables
- [ ] Commission rule engine implementation
- [ ] Refundable vs non-refundable optimization
- [ ] Commission reporting tools
- [ ] Analytics and insights system

## Implementation Steps

### 1. Commission Data Model (Day 1)
**Location**: `/remote-mcp-servers/d1-database-improved/src/models/commission.ts`

```typescript
interface CommissionRate {
  id: number;
  site: 'navitrip' | 'trisept' | 'vax';
  accommodation_type: 'hotel' | 'resort' | 'villa';
  rate_type?: 'standard' | 'refundable' | 'promo';
  commission_percent: number;
  min_commission_amount?: number;
  effective_from?: string;
  effective_until?: string;
  notes?: string;
}

interface CommissionRule {
  id: number;
  rule_name: string;
  rule_type: 'prefer_refundable' | 'min_commission' | 'max_budget' | 'custom';
  conditions: {
    trip_budget?: { min?: number; max?: number };
    client_tier?: 'standard' | 'premium' | 'vip';
    destination?: string[];
    travel_dates?: { start?: string; end?: string };
    min_nights?: number;
  };
  actions: {
    commission_multiplier?: number;
    prefer_sites?: string[];
    require_refundable?: boolean;
    min_commission_percent?: number;
  };
  priority: number;
  active: boolean;
}

interface CommissionCalculation {
  base_price: number;
  commission_percent: number;
  commission_amount: number;
  
  // Breakdown
  room_commission: number;
  package_commission?: number;
  addon_commission?: number;
  
  // Adjustments
  volume_bonus?: number;
  promotional_bonus?: number;
  
  // Totals
  total_commission: number;
  effective_rate: number;
  
  // Metadata
  calculation_date: string;
  rules_applied: string[];
  warnings?: string[];
}
```

### 2. Rule Engine Implementation (Day 1)
**Location**: `/remote-mcp-servers/d1-database-improved/src/services/commission-engine.ts`

#### Rule Evaluation System
```typescript
class CommissionRuleEngine {
  private rules: CommissionRule[] = [];
  
  async loadRules(db: D1Database): Promise<void> {
    // Load active rules from database
    // Sort by priority
  }
  
  evaluateRules(context: RuleContext): RuleResult[] {
    // Evaluate each rule against context
    // Return applicable rules in priority order
  }
  
  applyRules(
    calculation: CommissionCalculation,
    rules: RuleResult[]
  ): CommissionCalculation {
    // Apply rule actions to calculation
    // Track which rules were applied
  }
}
```

#### Context Builder
- [ ] Extract trip context
  - Budget constraints
  - Client preferences
  - Travel dates
  - Destination

- [ ] Load client history
  - Previous bookings
  - Tier status
  - Preferences

- [ ] Gather market data
  - Seasonal factors
  - Demand indicators
  - Competition rates

### 3. Optimization Algorithms (Day 2)
**Location**: `/remote-mcp-servers/d1-database-improved/src/services/commission-optimizer.ts`

#### Refundable vs Non-Refundable Optimizer
```typescript
interface OptimizationStrategy {
  name: string;
  weight: number;
  
  score(option: HotelOption): number;
}

class RefundableOptimizer implements OptimizationStrategy {
  score(option: HotelOption): number {
    // Higher score for refundable options
    // Consider commission difference
    // Factor in cancellation likelihood
  }
}
```

#### Multi-Objective Optimization
- [ ] Define optimization objectives
  - Maximize total commission
  - Meet budget constraints
  - Satisfy client preferences
  - Ensure availability

- [ ] Implement scoring algorithm
  ```typescript
  function scoreHotelOption(
    hotel: HotelOption,
    objectives: Objective[]
  ): number {
    let totalScore = 0;
    
    for (const objective of objectives) {
      const score = objective.evaluate(hotel);
      totalScore += score * objective.weight;
    }
    
    return totalScore;
  }
  ```

- [ ] Create selection algorithm
  - Rank all options by score
  - Apply constraints
  - Select top N options
  - Ensure diversity (L/M/H)

### 4. Commission Calculation Service (Day 2)
**Location**: `/remote-mcp-servers/d1-database-improved/src/services/commission-calculator.ts`

#### Base Calculation
- [ ] Load commission rates
  - Site-specific rates
  - Date-based rates
  - Promotional rates

- [ ] Calculate base commission
  ```typescript
  function calculateBaseCommission(
    booking: Booking,
    rates: CommissionRate[]
  ): number {
    const applicableRate = findApplicableRate(booking, rates);
    return booking.totalPrice * (applicableRate.percent / 100);
  }
  ```

#### Advanced Calculations
- [ ] Volume bonuses
  - Track monthly/quarterly volume
  - Apply tiered bonuses
  - Calculate incremental commission

- [ ] Package splitting
  - Identify package components
  - Allocate commission by component
  - Handle bundled discounts

- [ ] Multi-room calculations
  - Apply per-room rates
  - Handle group discounts
  - Calculate total commission

### 5. Reporting Tools (Day 3)
**Location**: `/remote-mcp-servers/d1-database-improved/src/tools/commission-reporting.ts`

#### Tool: `generate_commission_report`
- [ ] Input schema
  - trip_id or date range
  - grouping (by trip/client/site)
  - include_projections

- [ ] Report generation
  - Actual commissions earned
  - Potential commissions available
  - Optimization opportunities
  - Historical comparisons

#### Tool: `analyze_commission_performance`
- [ ] Metrics calculation
  - Average commission rate
  - Commission by site
  - Refundable vs non-refundable
  - Lost opportunities

- [ ] Insights generation
  - Identify patterns
  - Suggest optimizations
  - Flag anomalies

### 6. Integration Points (Day 3)
**Location**: `/remote-mcp-servers/d1-database-improved/src/tools/`

#### Update Existing Tools
- [ ] Modify `ingest_hotels`
  - Calculate commission on ingestion
  - Store commission data

- [ ] Enhance `query_hotels`
  - Add commission sorting
  - Filter by commission threshold
  - Include optimization score

- [ ] Update `query_trip_facts`
  - Include commission totals
  - Add commission breakdown

## Testing Strategy

### Unit Tests
- [ ] Commission calculation accuracy
- [ ] Rule evaluation logic
- [ ] Optimization algorithms
- [ ] Report generation

### Integration Tests
- [ ] End-to-end commission flow
- [ ] Database operations
- [ ] Multi-site calculations
- [ ] Report accuracy

### Validation Tests
- [ ] Commission rate accuracy
- [ ] Rule priority handling
- [ ] Edge cases (zero price, etc.)
- [ ] Currency handling

## Success Criteria
- Commission calculations accurate to $0.01
- Optimization increases average commission by 10%+
- Reports generate in <2 seconds
- All rules evaluate correctly
- No commission calculation errors in production

## Configuration Examples

### Default Commission Rates
```sql
INSERT INTO commission_rates (site, accommodation_type, rate_type, commission_percent) VALUES
('navitrip', 'hotel', 'standard', 10.0),
('navitrip', 'hotel', 'refundable', 12.0),
('trisept', 'hotel', 'standard', 8.0),
('trisept', 'resort', 'standard', 10.0),
('vax', 'hotel', 'standard', 9.0);
```

### Example Rules
```sql
INSERT INTO commission_rules (rule_name, rule_type, conditions, priority) VALUES
('Prefer Refundable', 'prefer_refundable', '{"trip_budget":{"min":5000}}', 100),
('Minimum Commission', 'min_commission', '{"min_commission_percent":8}', 90),
('VIP Client Bonus', 'custom', '{"client_tier":"vip"}', 80);
```

## Notes
- Consider caching commission calculations
- Implement audit logging for all calculations
- Design for easy rate updates
- Plan for retroactive commission adjustments
- Consider currency conversion handling