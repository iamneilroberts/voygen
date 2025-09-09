// ============================================================================
// Preset Analytics - Usage Tracking and Performance Analysis
// ============================================================================

import { ProposalData, ThemeRemix } from './types';
import { CustomPreset } from './preset-manager';
import { PRESET_INFO } from './themes/presets';

// ============================================================================
// Analytics Data Types
// ============================================================================

export interface PresetUsageRecord {
  id: string;
  preset_name: string;
  preset_type: 'built_in' | 'custom';
  user_id: string;
  session_id: string;
  timestamp: string;
  context: {
    trip_id?: string;
    template_used?: string;
    generation_time_ms: number;
    file_size_bytes?: number;
    success: boolean;
    error_type?: string;
  };
  user_feedback?: {
    rating: number; // 1-5 stars
    comments?: string;
    would_use_again: boolean;
  };
  performance_metrics: {
    generation_time: number;
    cache_hit: boolean;
    template_compatibility_score: number;
    theme_consistency_score: number;
  };
}

export interface PresetAnalytics {
  preset_name: string;
  preset_type: 'built_in' | 'custom';
  usage_stats: {
    total_uses: number;
    unique_users: number;
    success_rate: number;
    average_rating: number;
    last_used: string;
    first_used: string;
    uses_last_7_days: number;
    uses_last_30_days: number;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
  };
  performance_stats: {
    average_generation_time: number;
    cache_hit_rate: number;
    average_compatibility_score: number;
    average_theme_consistency: number;
    error_rate: number;
    common_error_types: Array<{ type: string; count: number }>;
  };
  user_feedback: {
    average_rating: number;
    total_ratings: number;
    would_use_again_percentage: number;
    common_feedback_themes: string[];
    recent_comments: string[];
  };
  template_compatibility: {
    detailed: { uses: number; success_rate: number; avg_rating: number };
    condensed: { uses: number; success_rate: number; avg_rating: number };
    fancy: { uses: number; success_rate: number; avg_rating: number };
    functional: { uses: number; success_rate: number; avg_rating: number };
  };
  optimization_suggestions: string[];
}

export interface SystemAnalytics {
  overview: {
    total_preset_uses: number;
    unique_presets_used: number;
    active_users: number;
    success_rate: number;
    average_generation_time: number;
  };
  preset_rankings: {
    most_popular: Array<{ preset_name: string; uses: number; success_rate: number }>;
    highest_rated: Array<{ preset_name: string; rating: number; total_ratings: number }>;
    fastest_generation: Array<{ preset_name: string; avg_time: number; uses: number }>;
    most_consistent: Array<{ preset_name: string; consistency_score: number; uses: number }>;
  };
  trends: {
    daily_usage: Array<{ date: string; uses: number; success_rate: number }>;
    weekly_growth: number; // percentage
    popular_combinations: Array<{
      preset: string;
      template: string;
      uses: number;
      success_rate: number;
    }>;
  };
  user_behavior: {
    average_presets_per_user: number;
    preset_switching_rate: number;
    customization_adoption_rate: number;
    feedback_participation_rate: number;
  };
  recommendations: {
    presets_to_promote: string[];
    presets_needing_improvement: string[];
    feature_requests: string[];
    performance_optimizations: string[];
  };
}

export interface PerformanceBenchmark {
  preset_name: string;
  template: string;
  metrics: {
    generation_time_p50: number;
    generation_time_p95: number;
    generation_time_p99: number;
    cache_hit_rate: number;
    success_rate: number;
    memory_usage_mb: number;
    cpu_usage_percentage: number;
  };
  comparison_to_baseline: {
    generation_time_ratio: number; // 1.0 = same as baseline, <1.0 = faster
    memory_efficiency_ratio: number;
    overall_score: number; // 0-100
  };
  recommendations: string[];
}

// ============================================================================
// Preset Analytics Manager
// ============================================================================

export class PresetAnalyticsManager {
  private usageRecords: PresetUsageRecord[] = [];
  private analyticsCache: Map<string, PresetAnalytics> = new Map();
  private systemAnalyticsCache: SystemAnalytics | null = null;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;
  
  // ============================================================================
  // Usage Tracking
  // ============================================================================
  
  // Track preset usage
  recordPresetUsage(
    presetName: string,
    presetType: 'built_in' | 'custom',
    userId: string,
    sessionId: string,
    context: PresetUsageRecord['context'],
    performanceMetrics: PresetUsageRecord['performance_metrics']
  ): string {
    const record: PresetUsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      preset_name: presetName,
      preset_type: presetType,
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      context,
      performance_metrics: performanceMetrics
    };
    
    this.usageRecords.push(record);
    
    // Invalidate cache
    this.invalidateCache();
    
    return record.id;
  }
  
  // Add user feedback to usage record
  addUserFeedback(
    usageId: string,
    feedback: PresetUsageRecord['user_feedback']
  ): boolean {
    const record = this.usageRecords.find(r => r.id === usageId);
    if (!record) {
      return false;
    }
    
    record.user_feedback = feedback;
    this.invalidateCache();
    return true;
  }
  
  // ============================================================================
  // Analytics Generation
  // ============================================================================
  
  // Get comprehensive analytics for a specific preset
  getPresetAnalytics(presetName: string): PresetAnalytics {
    const cacheKey = `preset_${presetName}`;
    
    if (this.analyticsCache.has(cacheKey) && !this.isCacheExpired()) {
      return this.analyticsCache.get(cacheKey)!;
    }
    
    const records = this.usageRecords.filter(r => r.preset_name === presetName);
    
    if (records.length === 0) {
      return this.createEmptyPresetAnalytics(presetName);
    }
    
    const analytics = this.computePresetAnalytics(presetName, records);
    this.analyticsCache.set(cacheKey, analytics);
    
    return analytics;
  }
  
  // Get system-wide analytics
  getSystemAnalytics(): SystemAnalytics {
    if (this.systemAnalyticsCache && !this.isCacheExpired()) {
      return this.systemAnalyticsCache;
    }
    
    const analytics = this.computeSystemAnalytics();
    this.systemAnalyticsCache = analytics;
    this.lastCacheUpdate = Date.now();
    
    return analytics;
  }
  
  // Get performance benchmarks for preset-template combinations
  getPerformanceBenchmarks(presetName?: string, template?: string): PerformanceBenchmark[] {
    let records = this.usageRecords;
    
    if (presetName) {
      records = records.filter(r => r.preset_name === presetName);
    }
    
    if (template) {
      records = records.filter(r => r.context.template_used === template);
    }
    
    // Group by preset-template combination
    const combinations = new Map<string, PresetUsageRecord[]>();
    
    records.forEach(record => {
      const key = `${record.preset_name}-${record.context.template_used || 'unknown'}`;
      if (!combinations.has(key)) {
        combinations.set(key, []);
      }
      combinations.get(key)!.push(record);
    });
    
    return Array.from(combinations.entries()).map(([key, records]) => {
      const [preset, template] = key.split('-');
      return this.computePerformanceBenchmark(preset, template, records);
    });
  }
  
  // Get trending presets
  getTrendingPresets(timeframe: 'day' | 'week' | 'month' = 'week'): Array<{
    preset_name: string;
    trend_score: number;
    usage_growth: number;
    current_popularity: number;
  }> {
    const cutoffDate = new Date();
    switch (timeframe) {
      case 'day':
        cutoffDate.setDate(cutoffDate.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
    }
    
    const recentRecords = this.usageRecords.filter(r => 
      new Date(r.timestamp) >= cutoffDate
    );
    
    // Calculate usage by preset
    const presetUsage = new Map<string, number>();
    recentRecords.forEach(record => {
      const count = presetUsage.get(record.preset_name) || 0;
      presetUsage.set(record.preset_name, count + 1);
    });
    
    // Calculate trend scores (simplified - in production would use more sophisticated analysis)
    return Array.from(presetUsage.entries()).map(([presetName, recentUses]) => {
      const totalUses = this.usageRecords.filter(r => r.preset_name === presetName).length;
      const usageGrowth = totalUses > 0 ? (recentUses / totalUses) * 100 : 0;
      const popularity = recentUses / recentRecords.length * 100;
      
      return {
        preset_name: presetName,
        trend_score: usageGrowth * 0.6 + popularity * 0.4,
        usage_growth: usageGrowth,
        current_popularity: popularity
      };
    }).sort((a, b) => b.trend_score - a.trend_score);
  }
  
  // ============================================================================
  // Optimization and Recommendations
  // ============================================================================
  
  // Get optimization recommendations for a preset
  getOptimizationRecommendations(presetName: string): {
    performance_optimizations: string[];
    user_experience_improvements: string[];
    compatibility_enhancements: string[];
    marketing_suggestions: string[];
  } {
    const analytics = this.getPresetAnalytics(presetName);
    const recommendations = {
      performance_optimizations: [] as string[],
      user_experience_improvements: [] as string[],
      compatibility_enhancements: [] as string[],
      marketing_suggestions: [] as string[]
    };
    
    // Performance optimizations
    if (analytics.performance_stats.average_generation_time > 2000) {
      recommendations.performance_optimizations.push('Optimize theme CSS generation for faster rendering');
    }
    
    if (analytics.performance_stats.cache_hit_rate < 0.7) {
      recommendations.performance_optimizations.push('Improve caching strategy for theme and template combinations');
    }
    
    if (analytics.performance_stats.error_rate > 0.1) {
      recommendations.performance_optimizations.push('Investigate and fix common error patterns');
    }
    
    // User experience improvements
    if (analytics.user_feedback.average_rating < 4.0) {
      recommendations.user_experience_improvements.push('Review user feedback to identify UI/UX issues');
    }
    
    if (analytics.user_feedback.would_use_again_percentage < 80) {
      recommendations.user_experience_improvements.push('Add preset customization options to improve user satisfaction');
    }
    
    // Compatibility enhancements
    Object.entries(analytics.template_compatibility).forEach(([template, stats]) => {
      if (stats.success_rate < 0.9) {
        recommendations.compatibility_enhancements.push(`Improve compatibility with ${template} template`);
      }
    });
    
    // Marketing suggestions
    if (analytics.usage_stats.uses_last_30_days < 10 && analytics.user_feedback.average_rating >= 4.0) {
      recommendations.marketing_suggestions.push('Promote this well-rated but underused preset');
    }
    
    if (analytics.usage_stats.trend_direction === 'increasing') {
      recommendations.marketing_suggestions.push('Feature this trending preset in recommendations');
    }
    
    return recommendations;
  }
  
  // Generate A/B testing suggestions
  generateABTestingSuggestions(): Array<{
    test_name: string;
    description: string;
    hypothesis: string;
    metrics_to_track: string[];
    estimated_impact: 'low' | 'medium' | 'high';
  }> {
    const systemAnalytics = this.getSystemAnalytics();
    const suggestions = [];
    
    // Test color scheme preferences
    suggestions.push({
      test_name: 'Color Scheme Preference Test',
      description: 'Test user preference between warm and cool color schemes for luxury presets',
      hypothesis: 'Users prefer warm gold tones for luxury travel over cool blue tones',
      metrics_to_track: ['usage_rate', 'user_rating', 'completion_rate'],
      estimated_impact: 'medium' as const
    });
    
    // Test decorative element density
    if (systemAnalytics.user_behavior.customization_adoption_rate < 0.3) {
      suggestions.push({
        test_name: 'Decorative Elements Density',
        description: 'Test optimal amount of decorative elements (emoji/icons) in presets',
        hypothesis: 'Moderate decorative element usage increases engagement without overwhelming',
        metrics_to_track: ['user_engagement', 'preset_satisfaction', 'customization_rate'],
        estimated_impact: 'high' as const
      });
    }
    
    // Test recommendation algorithm
    suggestions.push({
      test_name: 'Recommendation Algorithm',
      description: 'Test different recommendation approaches for preset selection',
      hypothesis: 'Trip-context-aware recommendations perform better than popularity-based',
      metrics_to_track: ['recommendation_acceptance_rate', 'user_satisfaction', 'task_completion_time'],
      estimated_impact: 'high' as const
    });
    
    return suggestions;
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private computePresetAnalytics(presetName: string, records: PresetUsageRecord[]): PresetAnalytics {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Usage stats
    const uniqueUsers = new Set(records.map(r => r.user_id)).size;
    const successfulRecords = records.filter(r => r.context.success);
    const successRate = records.length > 0 ? successfulRecords.length / records.length : 0;
    
    const ratingsRecords = records.filter(r => r.user_feedback?.rating);
    const averageRating = ratingsRecords.length > 0 
      ? ratingsRecords.reduce((sum, r) => sum + r.user_feedback!.rating, 0) / ratingsRecords.length 
      : 0;
    
    const last7DaysUses = records.filter(r => new Date(r.timestamp) >= last7Days).length;
    const last30DaysUses = records.filter(r => new Date(r.timestamp) >= last30Days).length;
    
    // Performance stats
    const generationTimes = records.map(r => r.performance_metrics.generation_time);
    const averageGenerationTime = generationTimes.reduce((sum, time) => sum + time, 0) / generationTimes.length;
    
    const cacheHits = records.filter(r => r.performance_metrics.cache_hit).length;
    const cacheHitRate = records.length > 0 ? cacheHits / records.length : 0;
    
    const errors = records.filter(r => !r.context.success);
    const errorRate = records.length > 0 ? errors.length / records.length : 0;
    
    // Template compatibility
    const templateCompatibility = this.computeTemplateCompatibility(records);
    
    return {
      preset_name: presetName,
      preset_type: this.getPresetType(presetName),
      usage_stats: {
        total_uses: records.length,
        unique_users: uniqueUsers,
        success_rate: successRate,
        average_rating: averageRating,
        last_used: records.length > 0 ? records[records.length - 1].timestamp : '',
        first_used: records.length > 0 ? records[0].timestamp : '',
        uses_last_7_days: last7DaysUses,
        uses_last_30_days: last30DaysUses,
        trend_direction: this.calculateTrendDirection(records)
      },
      performance_stats: {
        average_generation_time: averageGenerationTime,
        cache_hit_rate: cacheHitRate,
        average_compatibility_score: records.reduce((sum, r) => sum + r.performance_metrics.template_compatibility_score, 0) / records.length,
        average_theme_consistency: records.reduce((sum, r) => sum + r.performance_metrics.theme_consistency_score, 0) / records.length,
        error_rate: errorRate,
        common_error_types: this.getCommonErrorTypes(errors)
      },
      user_feedback: {
        average_rating: averageRating,
        total_ratings: ratingsRecords.length,
        would_use_again_percentage: this.calculateWouldUseAgainPercentage(records),
        common_feedback_themes: this.extractFeedbackThemes(records),
        recent_comments: this.getRecentComments(records)
      },
      template_compatibility: templateCompatibility,
      optimization_suggestions: this.generateOptimizationSuggestions(presetName, records)
    };
  }
  
  private computeSystemAnalytics(): SystemAnalytics {
    const allRecords = this.usageRecords;
    const uniquePresets = new Set(allRecords.map(r => r.preset_name)).size;
    const uniqueUsers = new Set(allRecords.map(r => r.user_id)).size;
    const successfulRecords = allRecords.filter(r => r.context.success);
    
    return {
      overview: {
        total_preset_uses: allRecords.length,
        unique_presets_used: uniquePresets,
        active_users: uniqueUsers,
        success_rate: allRecords.length > 0 ? successfulRecords.length / allRecords.length : 0,
        average_generation_time: allRecords.reduce((sum, r) => sum + r.performance_metrics.generation_time, 0) / allRecords.length
      },
      preset_rankings: this.computePresetRankings(allRecords),
      trends: this.computeTrends(allRecords),
      user_behavior: this.computeUserBehavior(allRecords),
      recommendations: this.generateSystemRecommendations(allRecords)
    };
  }
  
  private computePerformanceBenchmark(presetName: string, template: string, records: PresetUsageRecord[]): PerformanceBenchmark {
    const generationTimes = records.map(r => r.performance_metrics.generation_time).sort((a, b) => a - b);
    const cacheHits = records.filter(r => r.performance_metrics.cache_hit).length;
    const successfulRecords = records.filter(r => r.context.success);
    
    return {
      preset_name: presetName,
      template,
      metrics: {
        generation_time_p50: this.percentile(generationTimes, 50),
        generation_time_p95: this.percentile(generationTimes, 95),
        generation_time_p99: this.percentile(generationTimes, 99),
        cache_hit_rate: records.length > 0 ? cacheHits / records.length : 0,
        success_rate: records.length > 0 ? successfulRecords.length / records.length : 0,
        memory_usage_mb: 0, // Would be tracked in production
        cpu_usage_percentage: 0 // Would be tracked in production
      },
      comparison_to_baseline: {
        generation_time_ratio: 1.0, // Would compare to baseline in production
        memory_efficiency_ratio: 1.0,
        overall_score: Math.min(100, (1 - this.percentile(generationTimes, 50) / 5000) * 100)
      },
      recommendations: []
    };
  }
  
  private createEmptyPresetAnalytics(presetName: string): PresetAnalytics {
    return {
      preset_name: presetName,
      preset_type: this.getPresetType(presetName),
      usage_stats: {
        total_uses: 0,
        unique_users: 0,
        success_rate: 0,
        average_rating: 0,
        last_used: '',
        first_used: '',
        uses_last_7_days: 0,
        uses_last_30_days: 0,
        trend_direction: 'stable'
      },
      performance_stats: {
        average_generation_time: 0,
        cache_hit_rate: 0,
        average_compatibility_score: 0,
        average_theme_consistency: 0,
        error_rate: 0,
        common_error_types: []
      },
      user_feedback: {
        average_rating: 0,
        total_ratings: 0,
        would_use_again_percentage: 0,
        common_feedback_themes: [],
        recent_comments: []
      },
      template_compatibility: {
        detailed: { uses: 0, success_rate: 0, avg_rating: 0 },
        condensed: { uses: 0, success_rate: 0, avg_rating: 0 },
        fancy: { uses: 0, success_rate: 0, avg_rating: 0 },
        functional: { uses: 0, success_rate: 0, avg_rating: 0 }
      },
      optimization_suggestions: []
    };
  }
  
  private getPresetType(presetName: string): 'built_in' | 'custom' {
    return PRESET_INFO[presetName] ? 'built_in' : 'custom';
  }
  
  private calculateTrendDirection(records: PresetUsageRecord[]): 'increasing' | 'decreasing' | 'stable' {
    if (records.length < 4) return 'stable';
    
    const now = new Date();
    const midpoint = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    
    const recentUses = records.filter(r => new Date(r.timestamp) > midpoint).length;
    const olderUses = records.filter(r => new Date(r.timestamp) <= midpoint).length;
    
    const recentRate = recentUses / 15; // uses per day in recent period
    const olderRate = olderUses / 15; // uses per day in older period
    
    if (recentRate > olderRate * 1.2) return 'increasing';
    if (recentRate < olderRate * 0.8) return 'decreasing';
    return 'stable';
  }
  
  private computeTemplateCompatibility(records: PresetUsageRecord[]) {
    const templates = ['detailed', 'condensed', 'fancy', 'functional'];
    const compatibility: any = {};
    
    templates.forEach(template => {
      const templateRecords = records.filter(r => r.context.template_used === template);
      const successful = templateRecords.filter(r => r.context.success);
      const ratings = templateRecords.filter(r => r.user_feedback?.rating);
      
      compatibility[template] = {
        uses: templateRecords.length,
        success_rate: templateRecords.length > 0 ? successful.length / templateRecords.length : 0,
        avg_rating: ratings.length > 0 ? 
          ratings.reduce((sum, r) => sum + r.user_feedback!.rating, 0) / ratings.length : 0
      };
    });
    
    return compatibility;
  }
  
  private generateOptimizationSuggestions(presetName: string, records: PresetUsageRecord[]): string[] {
    const suggestions: string[] = [];
    
    const averageTime = records.reduce((sum, r) => sum + r.performance_metrics.generation_time, 0) / records.length;
    if (averageTime > 3000) {
      suggestions.push('Consider optimizing CSS generation for faster performance');
    }
    
    const errorRate = records.filter(r => !r.context.success).length / records.length;
    if (errorRate > 0.1) {
      suggestions.push('Investigate frequent errors and improve error handling');
    }
    
    const ratings = records.filter(r => r.user_feedback?.rating);
    const avgRating = ratings.length > 0 ? 
      ratings.reduce((sum, r) => sum + r.user_feedback!.rating, 0) / ratings.length : 0;
    
    if (avgRating < 3.5) {
      suggestions.push('Review user feedback to identify areas for improvement');
    }
    
    return suggestions;
  }
  
  private computePresetRankings(records: PresetUsageRecord[]) {
    const presetStats = new Map<string, any>();
    
    records.forEach(record => {
      if (!presetStats.has(record.preset_name)) {
        presetStats.set(record.preset_name, {
          uses: 0,
          successful: 0,
          ratings: [],
          generationTimes: []
        });
      }
      
      const stats = presetStats.get(record.preset_name);
      stats.uses++;
      if (record.context.success) stats.successful++;
      if (record.user_feedback?.rating) stats.ratings.push(record.user_feedback.rating);
      stats.generationTimes.push(record.performance_metrics.generation_time);
    });
    
    const presetArray = Array.from(presetStats.entries()).map(([name, stats]) => ({
      preset_name: name,
      uses: stats.uses,
      success_rate: stats.uses > 0 ? stats.successful / stats.uses : 0,
      rating: stats.ratings.length > 0 ? stats.ratings.reduce((a: number, b: number) => a + b) / stats.ratings.length : 0,
      total_ratings: stats.ratings.length,
      avg_time: stats.generationTimes.reduce((a: number, b: number) => a + b) / stats.generationTimes.length
    }));
    
    return {
      most_popular: presetArray.sort((a, b) => b.uses - a.uses).slice(0, 5),
      highest_rated: presetArray.filter(p => p.total_ratings > 0).sort((a, b) => b.rating - a.rating).slice(0, 5),
      fastest_generation: presetArray.sort((a, b) => a.avg_time - b.avg_time).slice(0, 5),
      most_consistent: presetArray.sort((a, b) => b.success_rate - a.success_rate).slice(0, 5)
    };
  }
  
  private computeTrends(records: PresetUsageRecord[]) {
    // Simplified trend computation
    const dailyUsage: { [key: string]: { uses: number; successful: number } } = {};
    
    records.forEach(record => {
      const date = record.timestamp.split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = { uses: 0, successful: 0 };
      }
      dailyUsage[date].uses++;
      if (record.context.success) dailyUsage[date].successful++;
    });
    
    return {
      daily_usage: Object.entries(dailyUsage).map(([date, stats]) => ({
        date,
        uses: stats.uses,
        success_rate: stats.uses > 0 ? stats.successful / stats.uses : 0
      })),
      weekly_growth: 0, // Would calculate actual growth in production
      popular_combinations: [] // Would analyze preset-template combinations
    };
  }
  
  private computeUserBehavior(records: PresetUsageRecord[]) {
    const uniqueUsers = new Set(records.map(r => r.user_id));
    const usersWithFeedback = new Set(records.filter(r => r.user_feedback).map(r => r.user_id));
    
    return {
      average_presets_per_user: records.length / uniqueUsers.size,
      preset_switching_rate: 0, // Would calculate switching patterns
      customization_adoption_rate: 0, // Would track custom preset usage
      feedback_participation_rate: usersWithFeedback.size / uniqueUsers.size
    };
  }
  
  private generateSystemRecommendations(records: PresetUsageRecord[]) {
    return {
      presets_to_promote: [],
      presets_needing_improvement: [],
      feature_requests: [],
      performance_optimizations: []
    };
  }
  
  private getCommonErrorTypes(errorRecords: PresetUsageRecord[]): Array<{ type: string; count: number }> {
    const errorCounts = new Map<string, number>();
    
    errorRecords.forEach(record => {
      const errorType = record.context.error_type || 'unknown';
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    });
    
    return Array.from(errorCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  private calculateWouldUseAgainPercentage(records: PresetUsageRecord[]): number {
    const feedbackRecords = records.filter(r => r.user_feedback?.would_use_again !== undefined);
    if (feedbackRecords.length === 0) return 0;
    
    const wouldUseAgain = feedbackRecords.filter(r => r.user_feedback!.would_use_again).length;
    return (wouldUseAgain / feedbackRecords.length) * 100;
  }
  
  private extractFeedbackThemes(records: PresetUsageRecord[]): string[] {
    // Simplified theme extraction - in production would use NLP
    const comments = records
      .filter(r => r.user_feedback?.comments)
      .map(r => r.user_feedback!.comments!);
    
    const themes: string[] = [];
    
    comments.forEach(comment => {
      const lower = comment.toLowerCase();
      if (lower.includes('slow') || lower.includes('performance')) {
        themes.push('performance');
      }
      if (lower.includes('color') || lower.includes('theme')) {
        themes.push('visual design');
      }
      if (lower.includes('easy') || lower.includes('simple')) {
        themes.push('usability');
      }
    });
    
    return [...new Set(themes)];
  }
  
  private getRecentComments(records: PresetUsageRecord[]): string[] {
    return records
      .filter(r => r.user_feedback?.comments)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
      .map(r => r.user_feedback!.comments!);
  }
  
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }
  
  private invalidateCache(): void {
    this.analyticsCache.clear();
    this.systemAnalyticsCache = null;
  }
  
  private isCacheExpired(): boolean {
    return Date.now() - this.lastCacheUpdate > this.cacheTTL;
  }
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

export const presetAnalyticsManager = new PresetAnalyticsManager();

export default presetAnalyticsManager;