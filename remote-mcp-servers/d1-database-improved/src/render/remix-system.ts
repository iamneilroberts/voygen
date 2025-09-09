// ============================================================================
// Remix System - Complete Template + Theme Remixing System
// ============================================================================

import { ProposalData, ThemeRemix, ProposalRemix, TemplateOptions } from './types';
import { RemixEngine, RemixGenerationOptions, RemixGenerationResult, RemixRecommendation, remixEngine } from './remix-engine';
import { PresetManager, PresetRecommendation, PresetAnalysis, CustomPreset, presetManager } from './preset-manager';
import { convertTripDataToProposalData } from '../tools/proposal-tools';

// Re-export key types for convenience
export {
  ProposalRemix,
  ThemeRemix,
  RemixGenerationOptions,
  RemixGenerationResult,
  RemixRecommendation,
  PresetRecommendation,
  PresetAnalysis,
  CustomPreset
};

export interface RemixSystemStats {
  templates: {
    total: number;
    available: string[];
  };
  themes: {
    color_schemes: number;
    typography_styles: number;
    decorative_styles: number;
    layout_styles: number;
    total_combinations: number;
  };
  presets: {
    built_in: number;
    custom: number;
    total: number;
  };
  total_remix_combinations: number;
  cache_stats: {
    theme_cache_size: number;
    template_cache_size: number;
    generation_cache_size: number;
  };
}

export interface QuickRemixOptions {
  client_type?: 'corporate' | 'luxury' | 'family' | 'executive' | 'leisure';
  presentation_style?: 'detailed' | 'summary' | 'visual' | 'functional';
  color_preference?: 'professional' | 'warm' | 'minimal' | 'vibrant';
  include_decorations?: boolean;
  optimize_for_mobile?: boolean;
}

export interface RemixBatchRequest {
  proposal_data: ProposalData;
  remixes: Array<{
    name: string;
    template: string;
    theme: ThemeRemix;
    options?: RemixGenerationOptions;
  }>;
}

export interface RemixBatchResult {
  results: Array<{
    name: string;
    success: boolean;
    result?: RemixGenerationResult;
    error?: string;
  }>;
  summary: {
    total_requested: number;
    successful: number;
    failed: number;
    total_generation_time_ms: number;
  };
}

export class RemixSystem {
  private engine: RemixEngine;
  private presetManager: PresetManager;
  
  constructor() {
    this.engine = remixEngine;
    this.presetManager = presetManager;
  }
  
  // ============================================================================
  // Main Remix Generation Methods
  // ============================================================================
  
  // Generate proposal with full remix control
  async generateRemix(
    proposalData: ProposalData,
    remix: ProposalRemix,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    return await this.engine.generateRemix(proposalData, remix, options);
  }
  
  // Generate proposal from preset (most common use case)
  async generateFromPreset(
    proposalData: ProposalData,
    presetName: string,
    templateName?: string,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    // Record preset usage for analytics
    this.presetManager.recordPresetUsage(presetName);
    
    return await this.engine.generateFromPreset(proposalData, presetName, templateName, options);
  }
  
  // Quick generation with simplified options
  async generateQuickRemix(
    proposalData: ProposalData,
    quickOptions: QuickRemixOptions = {},
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    // Convert quick options to full remix configuration
    const remix = this.convertQuickOptionsToRemix(proposalData, quickOptions);
    
    return await this.engine.generateRemix(proposalData, remix, options);
  }
  
  // Generate multiple remix variations in batch
  async generateBatch(request: RemixBatchRequest): Promise<RemixBatchResult> {
    const startTime = Date.now();
    const results: RemixBatchResult['results'] = [];
    
    for (const remixRequest of request.remixes) {
      try {
        const remix: ProposalRemix = {
          template: remixRequest.template,
          theme: remixRequest.theme
        };
        
        const result = await this.engine.generateRemix(
          request.proposal_data,
          remix,
          remixRequest.options || {}
        );
        
        results.push({
          name: remixRequest.name,
          success: true,
          result
        });
        
      } catch (error) {
        results.push({
          name: remixRequest.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return {
      results,
      summary: {
        total_requested: request.remixes.length,
        successful,
        failed,
        total_generation_time_ms: Date.now() - startTime
      }
    };
  }
  
  // ============================================================================
  // Recommendation and Discovery
  // ============================================================================
  
  // Get comprehensive remix recommendations
  getRemixRecommendations(proposalData: ProposalData): {
    remixes: RemixRecommendation[];
    presets: PresetRecommendation[];
    quick_options: QuickRemixOptions[];
  } {
    const remixRecommendations = this.engine.getRemixRecommendations(proposalData);
    const presetRecommendations = this.presetManager.getPresetRecommendations(proposalData);
    
    // Generate quick options based on analysis
    const quickOptions = this.generateQuickOptionsRecommendations(proposalData);
    
    return {
      remixes: remixRecommendations,
      presets: presetRecommendations,
      quick_options: quickOptions
    };
  }
  
  // Get the single best recommendation
  getBestRecommendation(proposalData: ProposalData): {
    type: 'remix' | 'preset';
    recommendation: RemixRecommendation | PresetRecommendation;
  } {
    const remixRec = this.engine.getBestRemixRecommendation(proposalData);
    const presetRec = this.presetManager.getBestPresetRecommendation(proposalData);
    
    // Return the one with higher confidence
    if (remixRec.confidence >= presetRec.confidence) {
      return { type: 'remix', recommendation: remixRec };
    } else {
      return { type: 'preset', recommendation: presetRec };
    }
  }
  
  // Get recommendations by client type
  getRecommendationsByClientType(clientType: 'corporate' | 'luxury' | 'family' | 'executive' | 'leisure'): {
    presets: PresetRecommendation[];
    quick_options: QuickRemixOptions;
  } {
    const presets = this.presetManager.getPresetsByClientType(clientType);
    const quickOptions = this.getQuickOptionsForClientType(clientType);
    
    return { presets, quick_options: quickOptions };
  }
  
  // ============================================================================
  // Preset Management Interface
  // ============================================================================
  
  // Create custom preset
  createCustomPreset(
    name: string,
    config: Omit<CustomPreset, 'name' | 'created_at'>
  ): CustomPreset {
    return this.presetManager.createCustomPreset(name, config);
  }
  
  // Update custom preset
  updateCustomPreset(
    name: string,
    updates: Partial<Omit<CustomPreset, 'name' | 'created_at'>>
  ): CustomPreset {
    return this.presetManager.updateCustomPreset(name, updates);
  }
  
  // Delete custom preset
  deleteCustomPreset(name: string): boolean {
    return this.presetManager.deleteCustomPreset(name);
  }
  
  // Clone preset for customization
  clonePreset(
    sourcePresetName: string,
    newPresetName: string,
    modifications?: Partial<CustomPreset>
  ): CustomPreset {
    return this.presetManager.clonePreset(sourcePresetName, newPresetName, modifications);
  }
  
  // Get all presets
  getAllPresets(): ReturnType<PresetManager['getAllPresets']> {
    return this.presetManager.getAllPresets();
  }
  
  // Analyze preset
  analyzePreset(presetName: string): PresetAnalysis {
    return this.presetManager.analyzePreset(presetName);
  }
  
  // ============================================================================
  // System Information and Management
  // ============================================================================
  
  // Get comprehensive system statistics
  getSystemStats(): RemixSystemStats {
    const engineStats = this.engine.getRemixStats();
    const allPresets = this.presetManager.getAllPresets();
    const builtInPresets = allPresets.filter(p => p.type === 'built-in').length;
    const customPresets = allPresets.filter(p => p.type === 'custom').length;
    
    return {
      templates: {
        total: engineStats.templates,
        available: ['detailed', 'condensed', 'fancy', 'functional']
      },
      themes: {
        color_schemes: 5,
        typography_styles: 4,
        decorative_styles: 4,
        layout_styles: 4,
        total_combinations: 320
      },
      presets: {
        built_in: builtInPresets,
        custom: customPresets,
        total: builtInPresets + customPresets
      },
      total_remix_combinations: engineStats.total_combinations,
      cache_stats: {
        theme_cache_size: engineStats.cache_size,
        template_cache_size: engineStats.generation_cache_size,
        generation_cache_size: engineStats.generation_cache_size
      }
    };
  }
  
  // Get usage analytics
  getUsageAnalytics(): {
    most_popular_presets: string[];
    preset_usage_stats: Array<{ preset: string; uses: number; last_used: string }>;
    system_stats: RemixSystemStats;
  } {
    return {
      most_popular_presets: this.presetManager.getMostPopularPresets(),
      preset_usage_stats: this.presetManager.getPresetUsageStats(),
      system_stats: this.getSystemStats()
    };
  }
  
  // Clear all caches
  clearCaches(): void {
    this.engine.clearCaches();
    console.log('Remix system caches cleared');
  }
  
  // Validate remix configuration
  validateRemix(remix: ProposalRemix, proposalData?: ProposalData): ReturnType<RemixEngine['validateRemix']> {
    return this.engine.validateRemix(remix, proposalData);
  }
  
  // ============================================================================
  // Legacy Compatibility Methods
  // ============================================================================
  
  // Generate from legacy TripData (for backward compatibility)
  async generateFromTripData(
    tripData: any,
    remix: ProposalRemix,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    // Convert legacy TripData to ProposalData
    const proposalData = convertTripDataToProposalData(tripData, { enhanceWithDefaults: true });
    
    return await this.generateRemix(proposalData, remix, options);
  }
  
  // Generate from legacy TripData with preset
  async generateFromTripDataWithPreset(
    tripData: any,
    presetName: string,
    templateName?: string,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    const proposalData = convertTripDataToProposalData(tripData, { enhanceWithDefaults: true });
    
    return await this.generateFromPreset(proposalData, presetName, templateName, options);
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private convertQuickOptionsToRemix(proposalData: ProposalData, options: QuickRemixOptions): ProposalRemix {
    // Determine template based on presentation style
    let template = 'detailed'; // default
    switch (options.presentation_style) {
      case 'summary':
        template = 'condensed';
        break;
      case 'visual':
        template = 'fancy';
        break;
      case 'functional':
        template = 'functional';
        break;
      case 'detailed':
      default:
        template = 'detailed';
        break;
    }
    
    // Determine color scheme
    let colorScheme: ThemeRemix['colorScheme'] = 'professional-blue';
    switch (options.color_preference) {
      case 'warm':
        colorScheme = 'sunset-orange';
        break;
      case 'minimal':
        colorScheme = 'minimal-gray';
        break;
      case 'vibrant':
        colorScheme = 'vibrant-teal';
        break;
      case 'professional':
      default:
        colorScheme = 'professional-blue';
        break;
    }
    
    // Determine other theme aspects
    const typography: ThemeRemix['typography'] = options.client_type === 'luxury' ? 'elegant' : 'corporate';
    const decorative: ThemeRemix['decorative'] = options.include_decorations !== false ? 'minimal-emoji' : 'none';
    const layout: ThemeRemix['layout'] = options.optimize_for_mobile ? 'compact' : 'spacious';
    
    return {
      template,
      theme: {
        colorScheme,
        typography,
        decorative,
        layout
      }
    };
  }
  
  private generateQuickOptionsRecommendations(proposalData: ProposalData): QuickRemixOptions[] {
    const recommendations: QuickRemixOptions[] = [];
    
    // Analyze trip to generate appropriate quick options
    const isFamily = (proposalData.trip_spec?.party?.children || 0) > 0;
    const isLuxury = this.isLuxuryTrip(proposalData);
    const isBusiness = this.isBusinessTrip(proposalData);
    const isComplex = this.isComplexTrip(proposalData);
    
    if (isLuxury) {
      recommendations.push({
        client_type: 'luxury',
        presentation_style: 'visual',
        color_preference: 'warm',
        include_decorations: true,
        optimize_for_mobile: false
      });
    }
    
    if (isBusiness) {
      recommendations.push({
        client_type: 'executive',
        presentation_style: 'summary',
        color_preference: 'minimal',
        include_decorations: false,
        optimize_for_mobile: true
      });
    }
    
    if (isFamily) {
      recommendations.push({
        client_type: 'family',
        presentation_style: 'detailed',
        color_preference: 'warm',
        include_decorations: true,
        optimize_for_mobile: false
      });
    }
    
    if (isComplex) {
      recommendations.push({
        client_type: 'leisure',
        presentation_style: 'detailed',
        color_preference: 'professional',
        include_decorations: true,
        optimize_for_mobile: false
      });
    }
    
    // Default recommendation if no specific characteristics
    if (recommendations.length === 0) {
      recommendations.push({
        client_type: 'leisure',
        presentation_style: 'detailed',
        color_preference: 'professional',
        include_decorations: true,
        optimize_for_mobile: false
      });
    }
    
    return recommendations;
  }
  
  private getQuickOptionsForClientType(clientType: 'corporate' | 'luxury' | 'family' | 'executive' | 'leisure'): QuickRemixOptions {
    const baseOptions: Record<string, QuickRemixOptions> = {
      corporate: {
        client_type: 'corporate',
        presentation_style: 'functional',
        color_preference: 'professional',
        include_decorations: false,
        optimize_for_mobile: true
      },
      luxury: {
        client_type: 'luxury',
        presentation_style: 'visual',
        color_preference: 'warm',
        include_decorations: true,
        optimize_for_mobile: false
      },
      family: {
        client_type: 'family',
        presentation_style: 'detailed',
        color_preference: 'warm',
        include_decorations: true,
        optimize_for_mobile: false
      },
      executive: {
        client_type: 'executive',
        presentation_style: 'summary',
        color_preference: 'minimal',
        include_decorations: false,
        optimize_for_mobile: true
      },
      leisure: {
        client_type: 'leisure',
        presentation_style: 'detailed',
        color_preference: 'professional',
        include_decorations: true,
        optimize_for_mobile: false
      }
    };
    
    return baseOptions[clientType] || baseOptions.leisure;
  }
  
  private isLuxuryTrip(proposalData: ProposalData): boolean {
    const avgPrice = this.calculateAveragePrice(proposalData.hotels?.map(h => h.lead_price?.amount || h.price_per_night || 0) || []);
    const hasLuxuryStyles = proposalData.trip_spec?.prefs?.styles?.includes('luxury') || false;
    return avgPrice > 400 || hasLuxuryStyles;
  }
  
  private isBusinessTrip(proposalData: ProposalData): boolean {
    const hasBusinessStyles = proposalData.trip_spec?.prefs?.styles?.includes('business') || false;
    const isShortTrip = this.calculateDuration(proposalData) <= 3;
    return hasBusinessStyles || isShortTrip;
  }
  
  private isComplexTrip(proposalData: ProposalData): boolean {
    const componentCount = (proposalData.hotels?.length || 0) + (proposalData.tours?.length || 0) + (proposalData.flights?.length || 0);
    return componentCount > 5 || this.calculateDuration(proposalData) > 7;
  }
  
  private calculateAveragePrice(prices: number[]): number {
    const validPrices = prices.filter(p => p > 0);
    return validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;
  }
  
  private calculateDuration(proposalData: ProposalData): number {
    if (!proposalData.start_date || !proposalData.end_date) return 0;
    
    const start = new Date(proposalData.start_date);
    const end = new Date(proposalData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Default remix system instance
export const remixSystem = new RemixSystem();

// Convenience functions for easy access
export async function generateRemix(
  proposalData: ProposalData,
  remix: ProposalRemix,
  options?: RemixGenerationOptions
): Promise<RemixGenerationResult> {
  return await remixSystem.generateRemix(proposalData, remix, options);
}

export async function generateFromPreset(
  proposalData: ProposalData,
  presetName: string,
  templateName?: string,
  options?: RemixGenerationOptions
): Promise<RemixGenerationResult> {
  return await remixSystem.generateFromPreset(proposalData, presetName, templateName, options);
}

export async function generateQuickRemix(
  proposalData: ProposalData,
  quickOptions?: QuickRemixOptions,
  options?: RemixGenerationOptions
): Promise<RemixGenerationResult> {
  return await remixSystem.generateQuickRemix(proposalData, quickOptions, options);
}

export function getRemixRecommendations(proposalData: ProposalData): ReturnType<RemixSystem['getRemixRecommendations']> {
  return remixSystem.getRemixRecommendations(proposalData);
}

export function getBestRecommendation(proposalData: ProposalData): ReturnType<RemixSystem['getBestRecommendation']> {
  return remixSystem.getBestRecommendation(proposalData);
}

export function getSystemStats(): RemixSystemStats {
  return remixSystem.getSystemStats();
}