// ============================================================================
// Remix Engine - Central Orchestrator for Template + Theme Combinations
// ============================================================================

import { ProposalData, ThemeRemix, ProposalRemix, TemplateOptions } from './types';
import { TemplateFactory, templateFactory } from './templates';
import { ThemeEngine, createThemeSystem, REMIX_PRESETS, getPreset, getPresetInfo } from './themes';
import { convertTripDataToProposalData } from '../tools/proposal-tools';

export interface RemixGenerationOptions extends TemplateOptions {
  // Remix-specific options
  optimize_for_mobile?: boolean;
  generate_pdf?: boolean;
  include_preview_css?: boolean;
  performance_mode?: 'fast' | 'balanced' | 'quality';
  
  // Advanced customization
  custom_css_overrides?: string;
  component_visibility?: Record<string, boolean>;
  section_ordering?: string[];
}

export interface RemixValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: {
    better_templates?: string[];
    better_themes?: string[];
    compatibility_notes?: string[];
  };
}

export interface RemixGenerationResult {
  html: string;
  css: string;
  metadata: {
    template_name: string;
    theme_remix: ThemeRemix;
    generation_time_ms: number;
    total_combinations_possible: number;
    used_preset?: string;
    performance_metrics: {
      css_cache_hit: boolean;
      template_cache_hit: boolean;
      components_rendered: number;
    };
  };
}

export interface RemixRecommendation {
  template: string;
  theme: string;
  preset?: string;
  confidence: number;
  reasoning: string[];
  use_cases: string[];
}

export class RemixEngine {
  private templateFactory: TemplateFactory;
  private themeSystem: ReturnType<typeof createThemeSystem>;
  private generationCache: Map<string, RemixGenerationResult>;
  
  constructor() {
    this.templateFactory = templateFactory;
    this.themeSystem = createThemeSystem();
    this.generationCache = new Map();
  }
  
  // ============================================================================
  // Core Remix Generation
  // ============================================================================
  
  // Generate proposal with complete remix control
  async generateRemix(
    proposalData: ProposalData,
    remix: ProposalRemix,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Generating remix: ${remix.template} + ${remix.theme.colorScheme}/${remix.theme.typography}/${remix.theme.decorative}/${remix.theme.layout}`);
      
      // 1. Validate remix configuration
      const validation = this.validateRemix(remix, proposalData);
      if (!validation.valid) {
        throw new Error(`Invalid remix configuration: ${validation.errors.join(', ')}`);
      }
      
      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Remix warnings:', validation.warnings);
      }
      
      // 2. Check cache first
      const cacheKey = this.generateCacheKey(proposalData, remix, options);
      if (this.generationCache.has(cacheKey)) {
        const cached = this.generationCache.get(cacheKey)!;
        console.log('Using cached remix result');
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            performance_metrics: {
              ...cached.metadata.performance_metrics,
              css_cache_hit: true,
              template_cache_hit: true
            }
          }
        };
      }
      
      // 3. Generate CSS theme
      const css = this.themeSystem.engine.generateCSS(remix.theme);
      
      // 4. Apply performance optimizations if requested
      const optimizedOptions = this.applyPerformanceOptimizations(options);
      
      // 5. Render HTML with template
      const html = await this.templateFactory.renderTemplate(
        remix.template,
        proposalData,
        remix.theme,
        optimizedOptions
      );
      
      // 6. Apply CSS overrides if provided
      const finalCss = options.custom_css_overrides 
        ? `${css}\n\n/* Custom Overrides */\n${options.custom_css_overrides}`
        : css;
      
      // 7. Create result
      const result: RemixGenerationResult = {
        html,
        css: finalCss,
        metadata: {
          template_name: remix.template,
          theme_remix: remix.theme,
          generation_time_ms: Date.now() - startTime,
          total_combinations_possible: this.getTotalCombinations(),
          used_preset: remix.preset_name,
          performance_metrics: {
            css_cache_hit: this.themeSystem.engine['cssCache'].has(this.themeSystem.engine['getCacheKey'](remix.theme)),
            template_cache_hit: this.templateFactory['templateCache'].has(remix.template),
            components_rendered: this.countComponentsInTemplate(remix.template)
          }
        }
      };
      
      // 8. Cache the result (limit cache size)
      if (this.generationCache.size > 100) {
        const firstKey = this.generationCache.keys().next().value;
        this.generationCache.delete(firstKey);
      }
      this.generationCache.set(cacheKey, result);
      
      console.log(`Remix generated in ${result.metadata.generation_time_ms}ms`);
      return result;
      
    } catch (error) {
      console.error('Error generating remix:', error);
      throw new Error(`Failed to generate remix: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Generate remix from preset
  async generateFromPreset(
    proposalData: ProposalData,
    presetName: string,
    templateName?: string,
    options: RemixGenerationOptions = {}
  ): Promise<RemixGenerationResult> {
    try {
      // Get preset theme
      const presetTheme = getPreset(presetName);
      const presetInfo = getPresetInfo(presetName);
      
      // Determine template - use provided or recommend from preset
      const finalTemplate = templateName || this.recommendTemplateForPreset(presetName, proposalData);
      
      // Create remix configuration
      const remix: ProposalRemix = {
        template: finalTemplate,
        theme: presetTheme,
        preset_name: presetName
      };
      
      console.log(`Generating from preset '${presetName}' with template '${finalTemplate}'`);
      return await this.generateRemix(proposalData, remix, options);
      
    } catch (error) {
      console.error(`Error generating from preset '${presetName}':`, error);
      throw new Error(`Failed to generate from preset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // ============================================================================
  // Intelligent Recommendations
  // ============================================================================
  
  // Get comprehensive remix recommendations
  getRemixRecommendations(proposalData: ProposalData): RemixRecommendation[] {
    const recommendations: RemixRecommendation[] = [];
    
    // Analyze trip characteristics
    const isLuxury = this.analyzeTripCharacteristic('luxury', proposalData);
    const isBusiness = this.analyzeTripCharacteristic('business', proposalData);
    const isFamily = this.analyzeTripCharacteristic('family', proposalData);
    const isSimple = this.analyzeTripCharacteristic('simple', proposalData);
    const isComplex = this.analyzeTripCharacteristic('complex', proposalData);
    
    // Generate recommendations based on analysis
    if (isLuxury) {
      recommendations.push({
        template: 'fancy',
        theme: 'luxury',
        preset: 'luxury',
        confidence: 0.95,
        reasoning: ['High-end accommodations detected', 'Premium budget range', 'Luxury travel styles indicated'],
        use_cases: ['VIP client presentations', 'High-end leisure travel', 'Premium service offerings']
      });
      
      recommendations.push({
        template: 'detailed',
        theme: 'luxury',
        preset: 'luxury',
        confidence: 0.85,
        reasoning: ['Complex itinerary benefits from detailed presentation', 'Luxury clients expect comprehensive information'],
        use_cases: ['Luxury travel proposals', 'Complex multi-destination trips']
      });
    }
    
    if (isBusiness) {
      recommendations.push({
        template: 'condensed',
        theme: 'executive',
        preset: 'executive',
        confidence: 0.92,
        reasoning: ['Short trip duration', 'Business travel indicators', 'Time-efficient presentation needed'],
        use_cases: ['Executive travelers', 'Quick decision making', 'Streamlined presentations']
      });
      
      recommendations.push({
        template: 'functional',
        theme: 'professional',
        preset: 'professional',
        confidence: 0.88,
        reasoning: ['Business focus requires clear information presentation', 'Professional appearance expected'],
        use_cases: ['Corporate clients', 'Business trip proposals']
      });
    }
    
    if (isFamily) {
      recommendations.push({
        template: 'detailed',
        theme: 'friendly',
        preset: 'friendly',
        confidence: 0.90,
        reasoning: ['Family travel with children', 'Multiple travelers require detailed planning', 'Friendly approach appreciated'],
        use_cases: ['Family travel planning', 'Vacation packages', 'Personal relationship building']
      });
    }
    
    if (isSimple) {
      recommendations.push({
        template: 'functional',
        theme: 'modern',
        preset: 'modern',
        confidence: 0.87,
        reasoning: ['Simple itinerary suits clean presentation', 'Modern approach for straightforward trips'],
        use_cases: ['Simple itineraries', 'Budget-conscious travelers', 'Quick bookings']
      });
    }
    
    if (isComplex) {
      recommendations.push({
        template: 'detailed',
        theme: 'professional',
        preset: 'professional',
        confidence: 0.90,
        reasoning: ['Complex itinerary requires comprehensive presentation', 'Multiple components need detailed explanation'],
        use_cases: ['Complex multi-destination trips', 'Detailed vacation planning']
      });
    }
    
    // Default recommendation if no specific characteristics detected
    if (recommendations.length === 0) {
      recommendations.push({
        template: 'detailed',
        theme: 'professional',
        preset: 'professional',
        confidence: 0.75,
        reasoning: ['Safe default for most travel proposals', 'Professional appearance suitable for all clients'],
        use_cases: ['General travel proposals', 'When client preferences unknown']
      });
    }
    
    // Sort by confidence and return top recommendations
    return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }
  
  // Get the single best remix recommendation
  getBestRemixRecommendation(proposalData: ProposalData): RemixRecommendation {
    const recommendations = this.getRemixRecommendations(proposalData);
    return recommendations[0]; // Already sorted by confidence
  }
  
  // ============================================================================
  // Validation and Analysis
  // ============================================================================
  
  // Comprehensive remix validation
  validateRemix(remix: ProposalRemix, proposalData?: ProposalData): RemixValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: RemixValidationResult['recommendations'] = {};
    
    // Validate template
    if (!this.templateFactory.hasTemplate(remix.template)) {
      const available = this.templateFactory.getAvailableTemplates().map(t => t.key);
      errors.push(`Template '${remix.template}' not found. Available: ${available.join(', ')}`);
      recommendations.better_templates = available.slice(0, 3);
    }
    
    // Validate theme
    const themeValidation = this.themeSystem.engine.validateTheme(remix.theme);
    if (!themeValidation.valid) {
      errors.push(...themeValidation.errors.map(e => `Theme error: ${e}`));
    }
    warnings.push(...themeValidation.warnings.map(w => `Theme warning: ${w}`));
    
    // Validate preset if specified
    if (remix.preset_name) {
      try {
        getPresetInfo(remix.preset_name);
      } catch (error) {
        warnings.push(`Preset '${remix.preset_name}' not found, ignoring preset reference`);
      }
    }
    
    // Cross-validation between template and theme
    const compatibility = this.analyzeTemplateThemeCompatibility(remix.template, remix.theme);
    if (!compatibility.optimal) {
      warnings.push(...compatibility.warnings);
      if (compatibility.better_themes) {
        recommendations.better_themes = compatibility.better_themes;
      }
    }
    
    // Context-specific validation if proposal data provided
    if (proposalData) {
      const contextValidation = this.validateRemixForContext(remix, proposalData);
      warnings.push(...contextValidation.warnings);
      if (contextValidation.suggestions.length > 0) {
        recommendations.compatibility_notes = contextValidation.suggestions;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations: Object.keys(recommendations).length > 0 ? recommendations : undefined
    };
  }
  
  // ============================================================================
  // Utility and Helper Methods
  // ============================================================================
  
  // Generate all possible remix combinations
  getAllRemixCombinations(): Array<{ template: string; theme: ThemeRemix; combination_name: string }> {
    const templates = this.templateFactory.getAvailableTemplates();
    const combinations: Array<{ template: string; theme: ThemeRemix; combination_name: string }> = [];
    
    const colorSchemes = ['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange'];
    const typographies = ['corporate', 'elegant', 'modern', 'classic'];
    const decoratives = ['none', 'minimal-emoji', 'rich-emoji', 'icons-only'];
    const layouts = ['compact', 'spacious', 'magazine', 'executive'];
    
    templates.forEach(({ key: template }) => {
      colorSchemes.forEach(colorScheme => {
        typographies.forEach(typography => {
          decoratives.forEach(decorative => {
            layouts.forEach(layout => {
              const theme: ThemeRemix = {
                colorScheme: colorScheme as any,
                typography: typography as any,
                decorative: decorative as any,
                layout: layout as any
              };
              
              combinations.push({
                template,
                theme,
                combination_name: `${template}-${colorScheme}-${typography}-${decorative}-${layout}`
              });
            });
          });
        });
      });
    });
    
    return combinations;
  }
  
  // Get total number of possible combinations
  getTotalCombinations(): number {
    const templateCount = this.templateFactory.getAvailableTemplates().length;
    const themeStats = this.themeSystem.stats;
    return templateCount * themeStats.totalCombinations;
  }
  
  // Get remix engine statistics
  getRemixStats(): {
    templates: number;
    themes: number;
    total_combinations: number;
    presets: number;
    cache_size: number;
    generation_cache_size: number;
  } {
    return {
      templates: this.templateFactory.getAvailableTemplates().length,
      themes: this.themeSystem.stats.totalCombinations,
      total_combinations: this.getTotalCombinations(),
      presets: Object.keys(REMIX_PRESETS).length,
      cache_size: this.themeSystem.stats.cacheSize,
      generation_cache_size: this.generationCache.size
    };
  }
  
  // Clear all caches
  clearCaches(): void {
    this.themeSystem.engine.clearCache();
    this.templateFactory.clearCache();
    this.generationCache.clear();
    console.log('All remix engine caches cleared');
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private generateCacheKey(proposalData: ProposalData, remix: ProposalRemix, options: RemixGenerationOptions): string {
    const dataHash = this.hashObject({
      trip_id: proposalData.trip_id,
      hotels_count: proposalData.hotels?.length || 0,
      tours_count: proposalData.tours?.length || 0,
      flights_count: proposalData.flights?.length || 0
    });
    
    const remixKey = `${remix.template}-${remix.theme.colorScheme}-${remix.theme.typography}-${remix.theme.decorative}-${remix.theme.layout}`;
    const optionsHash = this.hashObject(options);
    
    return `${dataHash}-${remixKey}-${optionsHash}`;
  }
  
  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').slice(0, 16);
  }
  
  private applyPerformanceOptimizations(options: RemixGenerationOptions): TemplateOptions {
    const mode = options.performance_mode || 'balanced';
    
    const optimized: TemplateOptions = { ...options };
    
    switch (mode) {
      case 'fast':
        optimized.include_images = false;
        optimized.minimize_css = true;
        break;
      case 'quality':
        optimized.include_images = true;
        optimized.generate_responsive_css = true;
        break;
      default: // balanced
        optimized.include_images = options.include_images !== false;
        break;
    }
    
    return optimized;
  }
  
  private countComponentsInTemplate(templateName: string): number {
    // This is a rough estimate based on template complexity
    const componentCounts = {
      'detailed': 9,
      'fancy': 8,
      'condensed': 6,
      'functional': 7
    };
    
    return componentCounts[templateName as keyof typeof componentCounts] || 7;
  }
  
  private recommendTemplateForPreset(presetName: string, proposalData: ProposalData): string {
    const presetInfo = getPresetInfo(presetName);
    
    // Use preset's recommended templates and match with proposal characteristics
    if (presetInfo.recommended_templates.length > 0) {
      // For now, return the first recommended template
      // In a more sophisticated implementation, we'd analyze proposal data
      return presetInfo.recommended_templates[0];
    }
    
    return 'detailed'; // Safe default
  }
  
  private analyzeTripCharacteristic(characteristic: string, proposalData: ProposalData): boolean {
    switch (characteristic) {
      case 'luxury':
        return this.isLuxuryTrip(proposalData);
      case 'business':
        return this.isBusinessTrip(proposalData);
      case 'family':
        return (proposalData.trip_spec?.party?.children || 0) > 0;
      case 'simple':
        return this.isSimpleTrip(proposalData);
      case 'complex':
        return this.isComplexTrip(proposalData);
      default:
        return false;
    }
  }
  
  private isLuxuryTrip(proposalData: ProposalData): boolean {
    const avgPrice = this.calculateAverageHotelPrice(proposalData.hotels || []);
    const hasLuxuryStyles = proposalData.trip_spec?.prefs?.styles?.includes('luxury') || false;
    const hasHighBudget = (proposalData.trip_spec?.prefs?.budget_per_night || 0) > 300;
    
    return avgPrice > 400 || hasLuxuryStyles || hasHighBudget;
  }
  
  private isBusinessTrip(proposalData: ProposalData): boolean {
    const hasBusinessStyles = proposalData.trip_spec?.prefs?.styles?.includes('business') || false;
    const isShortTrip = this.calculateTripDuration(proposalData) <= 3;
    
    return hasBusinessStyles || isShortTrip;
  }
  
  private isSimpleTrip(proposalData: ProposalData): boolean {
    return (
      (proposalData.hotels?.length || 0) <= 2 &&
      (proposalData.tours?.length || 0) <= 2 &&
      (proposalData.flights?.length || 0) <= 2
    );
  }
  
  private isComplexTrip(proposalData: ProposalData): boolean {
    return (
      (proposalData.hotels?.length || 0) > 2 ||
      (proposalData.tours?.length || 0) > 3 ||
      (proposalData.flights?.length || 0) > 2 ||
      this.calculateTripDuration(proposalData) > 7
    );
  }
  
  private calculateAverageHotelPrice(hotels: any[]): number {
    if (!hotels?.length) return 0;
    
    const prices = hotels
      .map(h => h.lead_price?.amount || h.price_per_night || 0)
      .filter(p => p > 0);
    
    return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  }
  
  private calculateTripDuration(proposalData: ProposalData): number {
    if (!proposalData.start_date || !proposalData.end_date) return 0;
    
    const start = new Date(proposalData.start_date);
    const end = new Date(proposalData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  private analyzeTemplateThemeCompatibility(template: string, theme: ThemeRemix): {
    optimal: boolean;
    warnings: string[];
    better_themes?: string[];
  } {
    const warnings: string[] = [];
    const better_themes: string[] = [];
    
    // Check for known incompatibilities
    if (template === 'executive' && theme.decorative === 'rich-emoji') {
      warnings.push('Executive template works better with minimal decorations');
      better_themes.push('executive', 'professional');
    }
    
    if (template === 'fancy' && theme.colorScheme === 'minimal-gray') {
      warnings.push('Fancy template designed for richer color schemes');
      better_themes.push('luxury', 'professional');
    }
    
    if (template === 'functional' && theme.typography === 'elegant') {
      warnings.push('Functional template optimized for clean typography');
      better_themes.push('modern', 'professional');
    }
    
    return {
      optimal: warnings.length === 0,
      warnings,
      better_themes: better_themes.length > 0 ? better_themes : undefined
    };
  }
  
  private validateRemixForContext(remix: ProposalRemix, proposalData: ProposalData): {
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check if template matches trip complexity
    const isComplex = this.isComplexTrip(proposalData);
    const isSimple = this.isSimpleTrip(proposalData);
    
    if (isComplex && (remix.template === 'condensed' || remix.template === 'functional')) {
      warnings.push('Complex trip might benefit from detailed template');
      suggestions.push('Consider using "detailed" or "fancy" template for complex itineraries');
    }
    
    if (isSimple && remix.template === 'detailed') {
      suggestions.push('Simple trips might be well-served by "condensed" or "functional" templates');
    }
    
    // Check if theme matches trip characteristics
    if (this.isLuxuryTrip(proposalData) && remix.theme.colorScheme === 'minimal-gray') {
      suggestions.push('Luxury trips often benefit from warmer color schemes like "luxury-gold" or "professional-blue"');
    }
    
    if (this.isBusinessTrip(proposalData) && remix.theme.decorative === 'rich-emoji') {
      suggestions.push('Business travel typically works better with minimal decorations');
    }
    
    return { warnings, suggestions };
  }
}

// Default remix engine instance
export const remixEngine = new RemixEngine();