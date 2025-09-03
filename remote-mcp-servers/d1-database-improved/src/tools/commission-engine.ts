/**
 * Commission calculation and optimization tools for D1 Travel Database
 * Handles commission rates, rules, and optimization logic
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

// Commission data structures
const CommissionRuleSchema = z.object({
  rule_name: z.string().describe("Human-readable rule name"),
  rule_type: z.enum(['prefer_refundable', 'min_commission', 'max_budget', 'custom']).describe("Type of rule"),
  conditions: z.object({
    trip_budget: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional().describe("Budget constraints"),
    client_tier: z.enum(['standard', 'premium', 'vip']).optional().describe("Client tier"),
    destination: z.array(z.string()).optional().describe("Applicable destinations"),
    travel_dates: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional().describe("Date range applicability"),
    min_nights: z.number().optional().describe("Minimum nights requirement")
  }).describe("Rule conditions"),
  actions: z.object({
    commission_multiplier: z.number().optional().describe("Commission multiplier"),
    prefer_sites: z.array(z.string()).optional().describe("Preferred sites"),
    require_refundable: z.boolean().optional().describe("Require refundable options"),
    min_commission_percent: z.number().optional().describe("Minimum commission percentage")
  }).describe("Actions to take when rule matches"),
  priority: z.number().default(0).describe("Rule priority (higher = more important)")
});

export function registerCommissionEngineTools(server: McpServer, getEnv: () => Env) {

  // Tool: configure_commission_rates
  server.tool(
    "configure_commission_rates",
    {
      site: z.enum(['navitrip', 'trisept', 'vax']).describe("Booking site"),
      accommodation_type: z.enum(['hotel', 'resort', 'villa']).default('hotel').describe("Accommodation type"),
      rate_type: z.enum(['standard', 'refundable', 'promo']).optional().describe("Rate type"),
      commission_percent: z.number().min(0).max(50).describe("Commission percentage"),
      min_commission_amount: z.number().optional().describe("Minimum commission amount"),
      effective_from: z.string().optional().describe("Effective start date (YYYY-MM-DD)"),
      effective_until: z.string().optional().describe("Effective end date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Additional notes")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        // Insert or update commission rate
        const result = await env.DB.prepare(`
          INSERT INTO commission_rates (
            site, accommodation_type, rate_type, commission_percent,
            min_commission_amount, effective_from, effective_until, notes,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          params.site,
          params.accommodation_type,
          params.rate_type,
          params.commission_percent,
          params.min_commission_amount || null,
          params.effective_from || null,
          params.effective_until || null,
          params.notes || null
        ).run();

        return {
          success: true,
          message: `Commission rate configured for ${params.site}`,
          rate_id: result.meta.last_row_id,
          configuration: {
            site: params.site,
            accommodation_type: params.accommodation_type,
            rate_type: params.rate_type,
            commission_percent: params.commission_percent,
            effective_from: params.effective_from,
            effective_until: params.effective_until
          }
        };

      } catch (error) {
        const errorMsg = `Failed to configure commission rate: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('configure_commission_rates', errorMsg, params);
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: create_commission_rule
  server.tool(
    "create_commission_rule",
    {
      ...CommissionRuleSchema.shape,
      active: z.boolean().default(true).describe("Is rule active")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        const result = await env.DB.prepare(`
          INSERT INTO commission_rules (
            rule_name, rule_type, conditions, actions, priority, active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          params.rule_name,
          params.rule_type,
          JSON.stringify(params.conditions),
          JSON.stringify(params.actions),
          params.priority,
          params.active ? 1 : 0
        ).run();

        return {
          success: true,
          message: `Commission rule "${params.rule_name}" created`,
          rule_id: result.meta.last_row_id,
          rule: {
            name: params.rule_name,
            type: params.rule_type,
            priority: params.priority,
            active: params.active
          }
        };

      } catch (error) {
        const errorMsg = `Failed to create commission rule: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('create_commission_rule', errorMsg, { rule_name: params.rule_name });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: optimize_commission
  server.tool(
    "optimize_commission",
    {
      trip_id: z.string().describe("Trip ID to optimize"),
      optimization_rules: z.array(z.string()).optional().describe("Specific rule names to apply"),
      budget_constraints: z.object({
        max_budget: z.number().optional(),
        min_budget: z.number().optional()
      }).optional().describe("Budget constraints"),
      client_preferences: z.object({
        preferred_tier: z.enum(['luxury', 'moderate', 'budget']).optional(),
        must_have_amenities: z.array(z.string()).optional(),
        location_preference: z.string().optional()
      }).optional().describe("Client preferences to consider"),
      return_top_n: z.number().default(5).max(20).describe("Number of optimized options to return")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        // Get available hotels for the trip
        const hotels = await env.DB.prepare(`
          SELECT * FROM hotel_cache 
          WHERE trip_id = ? 
          ORDER BY lead_price_amount ASC
        `).bind(params.trip_id).all();

        if (!hotels.results || hotels.results.length === 0) {
          return {
            success: false,
            error: "No hotels found for this trip"
          };
        }

        // Load applicable commission rules
        const rules = await env.DB.prepare(`
          SELECT * FROM commission_rules 
          WHERE active = 1 
          ORDER BY priority DESC
        `).all();

        // Load commission rates
        const rates = await env.DB.prepare(`
          SELECT * FROM commission_rates 
          WHERE (effective_until IS NULL OR effective_until >= date('now'))
          AND (effective_from IS NULL OR effective_from <= date('now'))
        `).all();

        // Score and optimize each hotel
        const optimizedHotels = [];

        for (const hotelRow of hotels.results) {
          const hotel = JSON.parse(hotelRow.json);
          const site = hotelRow.site;
          
          // Find applicable commission rate
          const applicableRate = rates.results?.find((rate: any) => 
            rate.site === site && 
            rate.accommodation_type === 'hotel' // Default for now
          );

          if (!applicableRate) continue;

          // Calculate base commission
          const baseCommission = hotelRow.lead_price_amount * (applicableRate.commission_percent / 100);
          
          // Apply commission rules
          let finalCommission = baseCommission;
          let appliedRules = [];
          let optimizationScore = 0;

          for (const ruleRow of rules.results || []) {
            const rule = {
              ...ruleRow,
              conditions: JSON.parse(ruleRow.conditions),
              actions: JSON.parse(ruleRow.actions)
            };

            // Check if rule applies (simplified logic)
            let ruleApplies = true;

            if (rule.conditions.trip_budget) {
              if (rule.conditions.trip_budget.max && hotelRow.lead_price_amount > rule.conditions.trip_budget.max) {
                ruleApplies = false;
              }
              if (rule.conditions.trip_budget.min && hotelRow.lead_price_amount < rule.conditions.trip_budget.min) {
                ruleApplies = false;
              }
            }

            if (ruleApplies) {
              appliedRules.push(rule.rule_name);
              
              // Apply rule actions
              if (rule.actions.commission_multiplier) {
                finalCommission *= rule.actions.commission_multiplier;
              }
              
              if (rule.actions.require_refundable && hotel.refundable) {
                optimizationScore += 20;
              }
              
              optimizationScore += rule.priority;
            }
          }

          // Calculate optimization score
          const commissionRate = (finalCommission / hotelRow.lead_price_amount) * 100;
          optimizationScore += commissionRate * 2; // Weight commission heavily
          
          // Add hotel features score
          if (hotel.star_rating) {
            optimizationScore += hotel.star_rating * 3;
          }
          if (hotel.review_score) {
            optimizationScore += hotel.review_score * 2;
          }
          if (hotel.refundable) {
            optimizationScore += 10;
          }

          optimizedHotels.push({
            hotel_id: hotelRow.id,
            hotel_data: hotel,
            site: site,
            original_price: hotelRow.lead_price_amount,
            base_commission: baseCommission,
            optimized_commission: finalCommission,
            commission_rate: commissionRate,
            optimization_score: optimizationScore,
            applied_rules: appliedRules,
            recommendation_reason: this.generateRecommendationReason(hotel, finalCommission, appliedRules)
          });
        }

        // Sort by optimization score and return top N
        optimizedHotels.sort((a, b) => b.optimization_score - a.optimization_score);
        const topOptions = optimizedHotels.slice(0, params.return_top_n);

        return {
          success: true,
          trip_id: params.trip_id,
          optimization_results: {
            total_hotels_analyzed: hotels.results.length,
            optimization_rules_applied: rules.results?.length || 0,
            top_options: topOptions,
            summary: {
              best_commission: topOptions[0]?.optimized_commission || 0,
              best_commission_rate: topOptions[0]?.commission_rate || 0,
              average_optimization_score: topOptions.reduce((sum, opt) => sum + opt.optimization_score, 0) / topOptions.length
            }
          }
        };

      } catch (error) {
        const errorMsg = `Commission optimization failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('optimize_commission', errorMsg, { trip_id: params.trip_id });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: calculate_trip_commission
  server.tool(
    "calculate_trip_commission",
    {
      trip_id: z.string().describe("Trip ID to calculate commission for"),
      include_potential: z.boolean().default(true).describe("Include potential commission from cached hotels")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        // Get actual bookings commission (if any)
        // This would come from actual booking records - simplified for now
        const actualCommission = 0; // Placeholder

        let potentialCommission = 0;
        let hotelOptions = [];

        if (params.include_potential) {
          // Calculate potential commission from cached hotels
          const hotels = await env.DB.prepare(`
            SELECT 
              hc.*,
              JSON_EXTRACT(hc.json, '$.commission_amount') as hotel_commission
            FROM hotel_cache hc
            WHERE hc.trip_id = ?
          `).bind(params.trip_id).all();

          // Get commission rates for calculation
          const rates = await env.DB.prepare(`
            SELECT * FROM commission_rates 
            WHERE (effective_until IS NULL OR effective_until >= date('now'))
            AND (effective_from IS NULL OR effective_from <= date('now'))
          `).all();

          for (const hotel of hotels.results || []) {
            const rate = rates.results?.find((r: any) => r.site === hotel.site);
            if (rate) {
              const commission = hotel.lead_price_amount * (rate.commission_percent / 100);
              potentialCommission += commission;
              
              hotelOptions.push({
                hotel_name: JSON.parse(hotel.json).name,
                site: hotel.site,
                price: hotel.lead_price_amount,
                commission: commission,
                commission_rate: rate.commission_percent
              });
            }
          }
        }

        return {
          success: true,
          trip_id: params.trip_id,
          commission_analysis: {
            actual_commission: actualCommission,
            potential_commission: potentialCommission,
            total_potential: actualCommission + potentialCommission,
            hotel_options: hotelOptions,
            summary: {
              best_commission_option: hotelOptions.length > 0 ? 
                hotelOptions.reduce((best, current) => 
                  current.commission > best.commission ? current : best
                ) : null,
              average_commission_rate: hotelOptions.length > 0 ?
                hotelOptions.reduce((sum, opt) => sum + opt.commission_rate, 0) / hotelOptions.length : 0
            }
          }
        };

      } catch (error) {
        const errorMsg = `Commission calculation failed: ${error instanceof Error ? error.message : String(error)}`;
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: get_commission_report
  server.tool(
    "get_commission_report",
    {
      period_days: z.number().default(30).describe("Report period in days"),
      group_by: z.enum(['site', 'client', 'month']).default('site').describe("How to group the report"),
      include_potential: z.boolean().default(true).describe("Include potential commission")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - params.period_days);

        // Get trip facts for commission analysis
        const trips = await env.DB.prepare(`
          SELECT 
            tf.trip_id,
            tf.facts,
            tf.total_commission_potential,
            tf.updated_at
          FROM trip_facts tf
          WHERE tf.updated_at >= ?
        `).bind(cutoffDate.toISOString()).all();

        const reportData: any = {};
        let totalPotential = 0;
        let totalActual = 0; // Placeholder

        for (const trip of trips.results || []) {
          const facts = JSON.parse(trip.facts);
          const commission = trip.total_commission_potential || 0;
          totalPotential += commission;

          let groupKey = '';
          if (params.group_by === 'site') {
            // Extract primary site from facts (simplified)
            groupKey = 'unknown_site';
          } else if (params.group_by === 'client') {
            groupKey = facts.client?.email || 'unknown_client';
          } else if (params.group_by === 'month') {
            const date = new Date(trip.updated_at);
            groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          }

          if (!reportData[groupKey]) {
            reportData[groupKey] = {
              group_key: groupKey,
              trip_count: 0,
              total_commission: 0,
              average_commission: 0
            };
          }

          reportData[groupKey].trip_count++;
          reportData[groupKey].total_commission += commission;
        }

        // Calculate averages
        Object.values(reportData).forEach((group: any) => {
          group.average_commission = group.total_commission / group.trip_count;
        });

        const sortedGroups = Object.values(reportData).sort((a: any, b: any) => 
          b.total_commission - a.total_commission
        );

        return {
          success: true,
          report: {
            period_days: params.period_days,
            group_by: params.group_by,
            total_trips: trips.results?.length || 0,
            total_potential_commission: totalPotential,
            total_actual_commission: totalActual,
            groups: sortedGroups,
            summary: {
              average_commission_per_trip: totalPotential / (trips.results?.length || 1),
              top_performing_group: sortedGroups[0]?.group_key || null
            }
          }
        };

      } catch (error) {
        const errorMsg = `Commission report generation failed: ${error instanceof Error ? error.message : String(error)}`;
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );
}

// Helper function to generate recommendation reasons
function generateRecommendationReason(hotel: any, commission: number, appliedRules: string[]): string {
  const reasons = [];
  
  if (commission > 0) {
    reasons.push(`$${commission.toFixed(2)} commission potential`);
  }
  
  if (hotel.refundable) {
    reasons.push("Refundable booking option");
  }
  
  if (hotel.star_rating >= 4) {
    reasons.push(`${hotel.star_rating}-star rating`);
  }
  
  if (hotel.review_score >= 8) {
    reasons.push(`High guest rating (${hotel.review_score}/10)`);
  }
  
  if (appliedRules.length > 0) {
    reasons.push(`Optimization rules applied: ${appliedRules.join(', ')}`);
  }
  
  return reasons.length > 0 ? reasons.join('; ') : 'Good value option';
}