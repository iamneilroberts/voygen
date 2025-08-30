/**
 * Provider Knowledge Query Optimizer for TASK-2025-091
 * Optimized queries for provider_knowledge, trip_products, verification_checks, and proposal_versions
 */

import { D1Database } from '@cloudflare/workers-types';

export interface ProviderKnowledgeQuery {
  provider_type?: string;
  success_rate_min?: number;
  confidence_level?: 'low' | 'medium' | 'high';
  is_active?: boolean;
  limit?: number;
}

export interface TripProductQuery {
  trip_id?: number;
  product_type?: string;
  destination_city?: string;
  travel_date?: string;
  budget_max?: number;
  recommendation_tier?: string;
  availability_status?: string;
  limit?: number;
}

export interface VerificationCheckQuery {
  target_type?: string;
  check_type?: string;
  is_valid?: boolean;
  needs_review?: boolean;
  due_before?: string;
  limit?: number;
}

export interface ProposalVersionQuery {
  proposal_base_id?: string;
  status?: string;
  is_current_version?: boolean;
  trip_id?: number;
  created_after?: string;
  limit?: number;
}

export class ProviderKnowledgeOptimizer {
  constructor(private db: D1Database) {}

  /**
   * Optimized provider knowledge search with performance monitoring
   */
  async searchProviders(query: ProviderKnowledgeQuery): Promise<any> {
    const startTime = Date.now();
    
    try {
      let sql = `
        SELECT 
          provider_id,
          provider_name,
          base_url,
          provider_type,
          success_rate,
          confidence_level,
          total_attempts,
          successful_extractions,
          last_extraction_at,
          is_active
        FROM provider_knowledge
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (query.provider_type) {
        sql += ` AND provider_type = ?`;
        params.push(query.provider_type);
      }
      
      if (query.success_rate_min !== undefined) {
        sql += ` AND success_rate >= ?`;
        params.push(query.success_rate_min);
      }
      
      if (query.confidence_level) {
        sql += ` AND confidence_level = ?`;
        params.push(query.confidence_level);
      }
      
      if (query.is_active !== undefined) {
        sql += ` AND is_active = ?`;
        params.push(query.is_active ? 1 : 0);
      }
      
      sql += ` ORDER BY success_rate DESC, confidence_level DESC`;
      
      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }
      
      const result = await this.db.prepare(sql).bind(...params).all();
      
      const duration = Date.now() - startTime;
      console.log(`Provider search completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Provider search failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimized trip products search with 3-tier pricing
   */
  async searchTripProducts(query: TripProductQuery): Promise<any> {
    const startTime = Date.now();
    
    try {
      let sql = `
        SELECT 
          tp.product_id,
          tp.trip_id,
          tp.product_type,
          tp.product_name,
          tp.destination_city,
          tp.destination_country,
          tp.travel_date,
          tp.pricing_tiers,
          tp.budget_price,
          tp.standard_price,
          tp.premium_price,
          tp.currency,
          tp.availability_status,
          tp.recommendation_tier,
          tp.data_quality_score,
          tp.relevance_score,
          pk.provider_name,
          pk.success_rate as provider_success_rate
        FROM trip_products tp
        LEFT JOIN provider_knowledge pk ON tp.provider_id = pk.provider_id
        WHERE tp.is_active = true
      `;
      
      const params: any[] = [];
      
      if (query.trip_id) {
        sql += ` AND tp.trip_id = ?`;
        params.push(query.trip_id);
      }
      
      if (query.product_type) {
        sql += ` AND tp.product_type = ?`;
        params.push(query.product_type);
      }
      
      if (query.destination_city) {
        sql += ` AND tp.destination_city LIKE ?`;
        params.push(`%${query.destination_city}%`);
      }
      
      if (query.travel_date) {
        sql += ` AND tp.travel_date = ?`;
        params.push(query.travel_date);
      }
      
      if (query.budget_max) {
        sql += ` AND tp.budget_price <= ?`;
        params.push(query.budget_max);
      }
      
      if (query.recommendation_tier) {
        sql += ` AND tp.recommendation_tier = ?`;
        params.push(query.recommendation_tier);
      }
      
      if (query.availability_status) {
        sql += ` AND tp.availability_status = ?`;
        params.push(query.availability_status);
      }
      
      // Add cache expiry check
      sql += ` AND (tp.cache_expiry IS NULL OR tp.cache_expiry > datetime('now'))`;
      
      sql += ` ORDER BY tp.recommendation_tier DESC, tp.relevance_score DESC, tp.data_quality_score DESC`;
      
      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }
      
      const result = await this.db.prepare(sql).bind(...params).all();
      
      const duration = Date.now() - startTime;
      console.log(`Trip products search completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Trip products search failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimized verification checks query
   */
  async getVerificationStatus(query: VerificationCheckQuery): Promise<any> {
    const startTime = Date.now();
    
    try {
      let sql = `
        SELECT 
          vc.check_id,
          vc.target_type,
          vc.target_id,
          vc.check_type,
          vc.check_subtype,
          vc.check_status,
          vc.is_valid,
          vc.confidence_score,
          vc.last_checked_at,
          vc.next_check_at,
          vc.manual_review_required,
          vc.priority,
          vc.error_details
        FROM verification_checks vc
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (query.target_type) {
        sql += ` AND vc.target_type = ?`;
        params.push(query.target_type);
      }
      
      if (query.check_type) {
        sql += ` AND vc.check_type = ?`;
        params.push(query.check_type);
      }
      
      if (query.is_valid !== undefined) {
        sql += ` AND vc.is_valid = ?`;
        params.push(query.is_valid ? 1 : 0);
      }
      
      if (query.needs_review) {
        sql += ` AND vc.manual_review_required = true`;
      }
      
      if (query.due_before) {
        sql += ` AND (vc.next_check_at IS NULL OR vc.next_check_at <= ?)`;
        params.push(query.due_before);
      }
      
      sql += ` ORDER BY vc.priority DESC, vc.next_check_at ASC`;
      
      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }
      
      const result = await this.db.prepare(sql).bind(...params).all();
      
      const duration = Date.now() - startTime;
      console.log(`Verification status query completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Verification status query failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimized proposal versions query
   */
  async getProposalVersions(query: ProposalVersionQuery): Promise<any> {
    const startTime = Date.now();
    
    try {
      let sql = `
        SELECT 
          pv.version_id,
          pv.proposal_base_id,
          pv.version_number,
          pv.version_label,
          pv.trip_id,
          pv.status,
          pv.is_current_version,
          pv.content_summary,
          pv.client_approval_status,
          pv.created_by,
          pv.created_at,
          pv.word_count,
          pv.view_count,
          pv.client_view_count,
          t.trip_name,
          t.primary_client_email
        FROM proposal_versions pv
        LEFT JOIN trips_v2 t ON pv.trip_id = t.trip_id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (query.proposal_base_id) {
        sql += ` AND pv.proposal_base_id = ?`;
        params.push(query.proposal_base_id);
      }
      
      if (query.status) {
        sql += ` AND pv.status = ?`;
        params.push(query.status);
      }
      
      if (query.is_current_version !== undefined) {
        sql += ` AND pv.is_current_version = ?`;
        params.push(query.is_current_version ? 1 : 0);
      }
      
      if (query.trip_id) {
        sql += ` AND pv.trip_id = ?`;
        params.push(query.trip_id);
      }
      
      if (query.created_after) {
        sql += ` AND pv.created_at >= ?`;
        params.push(query.created_after);
      }
      
      sql += ` ORDER BY pv.created_at DESC, pv.version_number DESC`;
      
      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }
      
      const result = await this.db.prepare(sql).bind(...params).all();
      
      const duration = Date.now() - startTime;
      console.log(`Proposal versions query completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Proposal versions query failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Fast dashboard summary for workflow implementation
   */
  async getWorkflowDashboard(): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Parallel execution of multiple queries for dashboard
      const [
        activeProviders,
        recentProducts,
        failedChecks,
        currentProposals
      ] = await Promise.all([
        // Active providers summary
        this.db.prepare(`
          SELECT 
            provider_type,
            COUNT(*) as total_providers,
            AVG(success_rate) as avg_success_rate,
            COUNT(CASE WHEN confidence_level = 'high' THEN 1 END) as high_confidence_count
          FROM provider_knowledge 
          WHERE is_active = true
          GROUP BY provider_type
          ORDER BY avg_success_rate DESC
        `).all(),
        
        // Recent trip products (last 7 days)
        this.db.prepare(`
          SELECT 
            product_type,
            COUNT(*) as product_count,
            AVG(data_quality_score) as avg_quality,
            COUNT(CASE WHEN availability_status = 'available' THEN 1 END) as available_count
          FROM trip_products 
          WHERE created_at >= datetime('now', '-7 days')
            AND is_active = true
          GROUP BY product_type
        `).all(),
        
        // Failed verification checks needing attention
        this.db.prepare(`
          SELECT 
            check_type,
            COUNT(*) as failed_count,
            COUNT(CASE WHEN manual_review_required = true THEN 1 END) as needs_review_count
          FROM verification_checks 
          WHERE is_valid = false 
            OR check_status = 'failed'
          GROUP BY check_type
          ORDER BY failed_count DESC
          LIMIT 10
        `).all(),
        
        // Current proposals by status
        this.db.prepare(`
          SELECT 
            status,
            client_approval_status,
            COUNT(*) as proposal_count,
            AVG(word_count) as avg_word_count
          FROM proposal_versions 
          WHERE is_current_version = true
          GROUP BY status, client_approval_status
          ORDER BY proposal_count DESC
        `).all()
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`Workflow dashboard query completed in ${duration}ms`);
      
      return {
        performance: {
          query_duration_ms: duration,
          queries_executed: 4
        },
        providers: activeProviders.results,
        recent_products: recentProducts.results,
        failed_checks: failedChecks.results,
        proposals: currentProposals.results,
        summary: {
          total_active_providers: activeProviders.results?.reduce((sum: number, p: any) => sum + p.total_providers, 0) || 0,
          total_recent_products: recentProducts.results?.reduce((sum: number, p: any) => sum + p.product_count, 0) || 0,
          total_failed_checks: failedChecks.results?.reduce((sum: number, c: any) => sum + c.failed_count, 0) || 0,
          total_current_proposals: currentProposals.results?.reduce((sum: number, p: any) => sum + p.proposal_count, 0) || 0
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Workflow dashboard query failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Progressive learning update for providers
   */
  async updateProviderLearning(providerId: number, success: boolean, extractionData?: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (success) {
        await this.db.prepare(`
          UPDATE provider_knowledge 
          SET 
            successful_extractions = successful_extractions + 1,
            total_attempts = total_attempts + 1,
            success_rate = CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL),
            last_extraction_at = datetime('now'),
            data_quality_score = CASE 
              WHEN CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.9 THEN 1.0
              WHEN CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.7 THEN 0.8
              WHEN CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.5 THEN 0.6
              ELSE 0.4
            END,
            confidence_level = CASE 
              WHEN CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.8 THEN 'high'
              WHEN CAST(successful_extractions + 1 AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.6 THEN 'medium'
              ELSE 'low'
            END,
            updated_at = datetime('now')
          WHERE provider_id = ?
        `).bind(providerId).run();
      } else {
        await this.db.prepare(`
          UPDATE provider_knowledge 
          SET 
            total_attempts = total_attempts + 1,
            success_rate = CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL),
            data_quality_score = CASE 
              WHEN CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.9 THEN 1.0
              WHEN CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.7 THEN 0.8
              WHEN CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.5 THEN 0.6
              ELSE 0.4
            END,
            confidence_level = CASE 
              WHEN CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.8 THEN 'high'
              WHEN CAST(successful_extractions AS REAL) / CAST(total_attempts + 1 AS REAL) >= 0.6 THEN 'medium'
              ELSE 'low'
            END,
            updated_at = datetime('now')
          WHERE provider_id = ?
        `).bind(providerId).run();
      }
      
      const duration = Date.now() - startTime;
      console.log(`Provider learning update completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Provider learning update failed after ${duration}ms:`, error);
      throw error;
    }
  }
}

// Performance constants for <500ms target
export const PERFORMANCE_TARGETS = {
  PROVIDER_SEARCH_MAX_MS: 100,
  TRIP_PRODUCTS_SEARCH_MAX_MS: 150,
  VERIFICATION_CHECK_MAX_MS: 80,
  PROPOSAL_QUERY_MAX_MS: 120,
  DASHBOARD_QUERY_MAX_MS: 400,
  LEARNING_UPDATE_MAX_MS: 50
};

export default ProviderKnowledgeOptimizer;