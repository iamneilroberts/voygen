// ============================================================================
// Preset Manager - Advanced Preset Management and Customization
// ============================================================================

import { ProposalData, ThemeRemix, ProposalRemix } from './types';
import { REMIX_PRESETS, PRESET_INFO, getPreset, getPresetInfo, PresetInfo } from './themes';
import { templateFactory } from './templates';
import { remixEngine } from './remix-engine';

export interface CustomPreset {
  name: string;
  display_name: string;
  description: string;
  theme: ThemeRemix;
  template_preferences: string[];
  use_cases: string[];
  target_audience: string[];
  created_by?: string;
  created_at: string;
  tags: string[];
  is_public: boolean;
}

export interface PresetRecommendation {
  preset_name: string;
  confidence: number;
  reasoning: string[];
  template_recommendation: string;
  use_case_match: string[];
  customization_suggestions?: {
    color_adjustments?: string[];
    typography_suggestions?: string[];
    layout_optimizations?: string[];
  };
}

export interface PresetAnalysis {
  preset_name: string;
  theme_breakdown: {
    color_scheme: string;
    typography: string;
    decorative: string;
    layout: string;
  };
  strengths: string[];
  best_use_cases: string[];
  template_compatibility: Record<string, number>; // template -> compatibility score
  customization_potential: {
    color_variants: string[];
    typography_alternatives: string[];
    suitable_modifications: string[];
  };
}

export class PresetManager {
  private customPresets: Map<string, CustomPreset> = new Map();
  private presetUsageStats: Map<string, { uses: number; last_used: string }> = new Map();
  
  // ============================================================================
  // Preset Discovery and Recommendation
  // ============================================================================
  
  // Get comprehensive preset recommendations for a trip
  getPresetRecommendations(proposalData: ProposalData): PresetRecommendation[] {
    const recommendations: PresetRecommendation[] = [];
    
    // Analyze trip characteristics
    const tripAnalysis = this.analyzeTripCharacteristics(proposalData);
    
    // Evaluate each built-in preset
    Object.entries(PRESET_INFO).forEach(([presetName, presetInfo]) => {
      const recommendation = this.evaluatePresetForTrip(presetName, presetInfo, tripAnalysis, proposalData);
      if (recommendation.confidence > 0.3) { // Only include reasonable matches
        recommendations.push(recommendation);
      }
    });
    
    // Evaluate custom presets
    this.customPresets.forEach((customPreset, presetName) => {
      const recommendation = this.evaluateCustomPresetForTrip(customPreset, tripAnalysis, proposalData);
      if (recommendation.confidence > 0.3) {
        recommendations.push(recommendation);
      }
    });
    
    // Sort by confidence and return top recommendations
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }
  
  // Get the single best preset recommendation
  getBestPresetRecommendation(proposalData: ProposalData): PresetRecommendation {
    const recommendations = this.getPresetRecommendations(proposalData);
    return recommendations[0];
  }
  
  // Get preset recommendations by client type
  getPresetsByClientType(clientType: 'corporate' | 'luxury' | 'family' | 'executive' | 'leisure'): PresetRecommendation[] {
    const presetMatches: Record<string, PresetRecommendation> = {};
    
    // Map client types to preset strengths
    const clientPresetMap = {
      corporate: ['professional', 'executive'],
      luxury: ['luxury', 'fancy'],
      family: ['friendly', 'detailed'],
      executive: ['executive', 'professional'],
      leisure: ['friendly', 'modern']
    };
    
    const preferredPresets = clientPresetMap[clientType] || ['professional'];
    
    preferredPresets.forEach((presetName, index) => {
      if (PRESET_INFO[presetName]) {
        const presetInfo = PRESET_INFO[presetName];
        presetMatches[presetName] = {
          preset_name: presetName,
          confidence: 0.9 - (index * 0.1), // First choice gets higher confidence
          reasoning: [
            `Optimized for ${clientType} clients`,
            ...presetInfo.use_cases.slice(0, 2)
          ],
          template_recommendation: presetInfo.recommended_templates[0],
          use_case_match: presetInfo.use_cases.filter(uc => 
            uc.toLowerCase().includes(clientType) || 
            (clientType === 'corporate' && uc.toLowerCase().includes('business'))
          )
        };
      }
    });
    
    return Object.values(presetMatches).sort((a, b) => b.confidence - a.confidence);
  }
  
  // ============================================================================
  // Preset Analysis and Information
  // ============================================================================
  
  // Get detailed analysis of a preset
  analyzePreset(presetName: string): PresetAnalysis {
    let presetInfo: PresetInfo;
    let theme: ThemeRemix;
    
    // Check if it's a built-in or custom preset
    if (PRESET_INFO[presetName]) {
      presetInfo = PRESET_INFO[presetName];
      theme = getPreset(presetName);
    } else if (this.customPresets.has(presetName)) {
      const customPreset = this.customPresets.get(presetName)!;
      theme = customPreset.theme;
      presetInfo = {
        name: customPreset.display_name,
        description: customPreset.description,
        use_cases: customPreset.use_cases,
        theme: customPreset.theme,
        preview_text: `Custom preset: ${customPreset.description}`,
        recommended_templates: customPreset.template_preferences
      };
    } else {
      throw new Error(`Preset '${presetName}' not found`);
    }
    
    // Analyze theme components
    const themeBreakdown = {
      color_scheme: theme.colorScheme,
      typography: theme.typography,
      decorative: theme.decorative,
      layout: theme.layout
    };
    
    // Determine strengths based on theme combination
    const strengths = this.analyzePresetStrengths(theme, presetInfo);
    
    // Calculate template compatibility scores
    const templateCompatibility = this.calculateTemplateCompatibility(theme, presetInfo);
    
    // Suggest customization options
    const customizationPotential = this.analyzeCustomizationPotential(theme);
    
    return {
      preset_name: presetName,
      theme_breakdown: themeBreakdown,
      strengths,
      best_use_cases: presetInfo.use_cases,
      template_compatibility: templateCompatibility,
      customization_potential
    };
  }
  
  // Get all available presets (built-in and custom)
  getAllPresets(): Array<{ name: string; type: 'built-in' | 'custom'; info: PresetInfo | CustomPreset }> {
    const allPresets: Array<{ name: string; type: 'built-in' | 'custom'; info: PresetInfo | CustomPreset }> = [];
    
    // Add built-in presets
    Object.entries(PRESET_INFO).forEach(([name, info]) => {
      allPresets.push({ name, type: 'built-in', info });
    });
    
    // Add custom presets
    this.customPresets.forEach((customPreset, name) => {
      allPresets.push({ name, type: 'custom', info: customPreset });
    });
    
    return allPresets.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // ============================================================================
  // Custom Preset Management
  // ============================================================================
  
  // Create a new custom preset
  createCustomPreset(
    name: string,
    config: Omit<CustomPreset, 'name' | 'created_at'>
  ): CustomPreset {
    if (PRESET_INFO[name] || this.customPresets.has(name)) {
      throw new Error(`Preset '${name}' already exists`);
    }
    
    const customPreset: CustomPreset = {
      ...config,
      name,
      created_at: new Date().toISOString()
    };
    
    // Validate the preset
    const validation = this.validateCustomPreset(customPreset);
    if (!validation.valid) {
      throw new Error(`Invalid custom preset: ${validation.errors.join(', ')}`);
    }
    
    this.customPresets.set(name, customPreset);
    console.log(`Created custom preset: ${name}`);
    return customPreset;
  }
  
  // Update an existing custom preset
  updateCustomPreset(name: string, updates: Partial<Omit<CustomPreset, 'name' | 'created_at'>>): CustomPreset {
    if (!this.customPresets.has(name)) {
      throw new Error(`Custom preset '${name}' not found`);
    }
    
    const existing = this.customPresets.get(name)!;
    const updated = { ...existing, ...updates };
    
    // Validate the updated preset
    const validation = this.validateCustomPreset(updated);
    if (!validation.valid) {
      throw new Error(`Invalid preset update: ${validation.errors.join(', ')}`);
    }
    
    this.customPresets.set(name, updated);
    console.log(`Updated custom preset: ${name}`);
    return updated;
  }
  
  // Delete a custom preset
  deleteCustomPreset(name: string): boolean {
    if (PRESET_INFO[name]) {
      throw new Error('Cannot delete built-in presets');
    }
    
    const deleted = this.customPresets.delete(name);
    if (deleted) {
      this.presetUsageStats.delete(name);
      console.log(`Deleted custom preset: ${name}`);
    }
    
    return deleted;
  }
  
  // Clone an existing preset as a starting point for customization
  clonePreset(sourcePresetName: string, newPresetName: string, modifications?: Partial<CustomPreset>): CustomPreset {
    let sourceTheme: ThemeRemix;
    let sourceInfo: PresetInfo | CustomPreset;
    
    // Get source preset data
    if (PRESET_INFO[sourcePresetName]) {
      sourceTheme = getPreset(sourcePresetName);
      sourceInfo = PRESET_INFO[sourcePresetName];
    } else if (this.customPresets.has(sourcePresetName)) {
      const customPreset = this.customPresets.get(sourcePresetName)!;
      sourceTheme = customPreset.theme;
      sourceInfo = customPreset;
    } else {
      throw new Error(`Source preset '${sourcePresetName}' not found`);
    }
    
    // Create the new custom preset based on source
    const newPresetConfig: Omit<CustomPreset, 'name' | 'created_at'> = {
      display_name: `${sourceInfo.name} (Copy)`,
      description: `Customized version of ${sourceInfo.name}: ${sourceInfo.description}`,
      theme: { ...sourceTheme },
      template_preferences: 'recommended_templates' in sourceInfo 
        ? [...sourceInfo.recommended_templates]
        : ['detailed'],
      use_cases: [...sourceInfo.use_cases],
      target_audience: [],
      tags: ['custom', 'cloned'],
      is_public: false,
      ...modifications
    };
    
    return this.createCustomPreset(newPresetName, newPresetConfig);
  }
  
  // ============================================================================
  // Preset Usage and Analytics
  // ============================================================================
  
  // Track preset usage
  recordPresetUsage(presetName: string): void {
    const current = this.presetUsageStats.get(presetName) || { uses: 0, last_used: '' };
    this.presetUsageStats.set(presetName, {
      uses: current.uses + 1,
      last_used: new Date().toISOString()
    });
  }
  
  // Get preset usage statistics
  getPresetUsageStats(): Array<{ preset: string; uses: number; last_used: string }> {
    return Array.from(this.presetUsageStats.entries()).map(([preset, stats]) => ({
      preset,
      uses: stats.uses,
      last_used: stats.last_used
    })).sort((a, b) => b.uses - a.uses);
  }
  
  // Get most popular presets
  getMostPopularPresets(limit: number = 5): string[] {
    return this.getPresetUsageStats()
      .slice(0, limit)
      .map(stat => stat.preset);
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private analyzeTripCharacteristics(proposalData: ProposalData): {
    luxury_score: number;
    business_score: number;
    family_score: number;
    complexity_score: number;
    budget_level: 'low' | 'medium' | 'high';
    duration: number;
    destinations: number;
  } {
    const hotels = proposalData.hotels || [];
    const tours = proposalData.tours || [];
    const flights = proposalData.flights || [];
    
    // Calculate luxury score (0-1)
    const avgHotelPrice = this.calculateAveragePrice(hotels.map(h => h.lead_price?.amount || h.price_per_night || 0));
    const hasLuxuryStyles = proposalData.trip_spec?.prefs?.styles?.includes('luxury') || false;
    const luxury_score = Math.min(1, (avgHotelPrice / 500) * 0.6 + (hasLuxuryStyles ? 0.4 : 0));
    
    // Calculate business score (0-1)
    const hasBusinessStyles = proposalData.trip_spec?.prefs?.styles?.includes('business') || false;
    const isShortDuration = this.calculateDuration(proposalData) <= 3;
    const business_score = (hasBusinessStyles ? 0.6 : 0) + (isShortDuration ? 0.4 : 0);
    
    // Calculate family score (0-1)
    const hasChildren = (proposalData.trip_spec?.party?.children || 0) > 0;
    const family_score = hasChildren ? 1 : 0;
    
    // Calculate complexity score (0-1)
    const componentCount = hotels.length + tours.length + flights.length + (proposalData.ground?.length || 0);
    const complexity_score = Math.min(1, componentCount / 10);
    
    // Determine budget level
    let budget_level: 'low' | 'medium' | 'high' = 'medium';
    if (avgHotelPrice > 300) budget_level = 'high';
    else if (avgHotelPrice < 150) budget_level = 'low';
    
    return {
      luxury_score,
      business_score,
      family_score,
      complexity_score,
      budget_level,
      duration: this.calculateDuration(proposalData),
      destinations: proposalData.trip_spec?.legs?.length || 1
    };
  }
  
  private evaluatePresetForTrip(
    presetName: string, 
    presetInfo: PresetInfo, 
    tripAnalysis: ReturnType<typeof this.analyzeTripCharacteristics>,
    proposalData: ProposalData
  ): PresetRecommendation {
    let confidence = 0;
    const reasoning: string[] = [];
    const useCase_match: string[] = [];
    
    // Evaluate based on preset characteristics
    switch (presetName) {
      case 'luxury':
        confidence += tripAnalysis.luxury_score * 0.8;
        if (tripAnalysis.luxury_score > 0.6) {
          reasoning.push('High-end accommodations and budget detected');
          useCase_match.push('Luxury travel experiences');
        }
        break;
        
      case 'professional':
        confidence += 0.4; // Base confidence for professional
        if (tripAnalysis.business_score > 0.5) {
          confidence += 0.3;
          reasoning.push('Business travel characteristics identified');
          useCase_match.push('Corporate clients');
        }
        break;
        
      case 'executive':
        confidence += tripAnalysis.business_score * 0.9;
        if (tripAnalysis.duration <= 3) {
          confidence += 0.2;
          reasoning.push('Short duration suits executive format');
          useCase_match.push('Quick decision making');
        }
        break;
        
      case 'friendly':
        confidence += tripAnalysis.family_score * 0.8;
        if (tripAnalysis.family_score > 0) {
          reasoning.push('Family travel detected');
          useCase_match.push('Family travel planning');
        }
        if (tripAnalysis.budget_level === 'medium') {
          confidence += 0.2;
          reasoning.push('Budget level suits friendly approach');
        }
        break;
        
      case 'modern':
        if (tripAnalysis.complexity_score < 0.5) {
          confidence += 0.3;
          reasoning.push('Simple itinerary suits modern clean design');
          useCase_match.push('Simple itineraries');
        }
        break;
    }
    
    // Add complexity-based adjustments
    if (tripAnalysis.complexity_score > 0.7 && presetName === 'professional') {
      confidence += 0.2;
      reasoning.push('Complex itinerary benefits from professional presentation');
    }
    
    // Template recommendation
    const template_recommendation = presetInfo.recommended_templates[0] || 'detailed';
    
    return {
      preset_name: presetName,
      confidence: Math.min(1, confidence),
      reasoning,
      template_recommendation,
      use_case_match: useCase_match
    };
  }
  
  private evaluateCustomPresetForTrip(
    customPreset: CustomPreset,
    tripAnalysis: ReturnType<typeof this.analyzeTripCharacteristics>,
    proposalData: ProposalData
  ): PresetRecommendation {
    // For custom presets, use a simpler evaluation based on tags and use cases
    let confidence = 0.3; // Base confidence for custom presets
    const reasoning: string[] = ['Custom preset tailored for specific needs'];
    
    // Check if use cases match trip characteristics
    const matchingUseCases = customPreset.use_cases.filter(useCase => {
      const lowerUseCase = useCase.toLowerCase();
      
      if (tripAnalysis.luxury_score > 0.6 && lowerUseCase.includes('luxury')) return true;
      if (tripAnalysis.business_score > 0.6 && lowerUseCase.includes('business')) return true;
      if (tripAnalysis.family_score > 0 && lowerUseCase.includes('family')) return true;
      
      return false;
    });
    
    confidence += matchingUseCases.length * 0.15;
    
    return {
      preset_name: customPreset.name,
      confidence: Math.min(1, confidence),
      reasoning,
      template_recommendation: customPreset.template_preferences[0] || 'detailed',
      use_case_match: matchingUseCases
    };
  }
  
  private analyzePresetStrengths(theme: ThemeRemix, presetInfo: PresetInfo): string[] {
    const strengths: string[] = [];
    
    // Color scheme strengths
    switch (theme.colorScheme) {
      case 'professional-blue':
        strengths.push('Corporate-friendly appearance', 'Trustworthy and reliable impression');
        break;
      case 'luxury-gold':
        strengths.push('Premium and elegant aesthetic', 'High-end visual appeal');
        break;
      case 'minimal-gray':
        strengths.push('Clean and undistracting', 'Executive-focused design');
        break;
      case 'vibrant-teal':
        strengths.push('Modern and contemporary feel', 'Tech-savvy appearance');
        break;
      case 'sunset-orange':
        strengths.push('Warm and inviting tone', 'Family-friendly approach');
        break;
    }
    
    // Typography strengths
    switch (theme.typography) {
      case 'elegant':
        strengths.push('Sophisticated typography', 'Luxury-oriented presentation');
        break;
      case 'corporate':
        strengths.push('Professional readability', 'Business-appropriate fonts');
        break;
      case 'modern':
        strengths.push('Contemporary design language', 'Clean and readable');
        break;
    }
    
    // Layout strengths
    switch (theme.layout) {
      case 'executive':
        strengths.push('Optimized for quick scanning', 'Decision-focused layout');
        break;
      case 'spacious':
        strengths.push('Premium presentation space', 'Comfortable reading experience');
        break;
      case 'magazine':
        strengths.push('Visually engaging layout', 'Editorial-quality presentation');
        break;
    }
    
    return strengths;
  }
  
  private calculateTemplateCompatibility(theme: ThemeRemix, presetInfo: PresetInfo): Record<string, number> {
    const compatibility: Record<string, number> = {};
    const availableTemplates = templateFactory.getAvailableTemplates();
    
    availableTemplates.forEach(({ key: templateName }) => {
      let score = 0.5; // Base compatibility
      
      // Check if template is in recommended list
      if ('recommended_templates' in presetInfo && presetInfo.recommended_templates.includes(templateName)) {
        score += 0.4;
      }
      
      // Template-specific compatibility adjustments
      switch (templateName) {
        case 'fancy':
          if (theme.colorScheme === 'luxury-gold' || theme.typography === 'elegant') score += 0.2;
          if (theme.decorative === 'rich-emoji') score += 0.1;
          break;
        case 'executive':
          if (theme.layout === 'executive') score += 0.3;
          if (theme.decorative === 'none') score += 0.2;
          break;
        case 'detailed':
          if (theme.layout === 'spacious' || theme.layout === 'magazine') score += 0.2;
          break;
        case 'functional':
          if (theme.colorScheme === 'minimal-gray' || theme.typography === 'corporate') score += 0.2;
          break;
      }
      
      compatibility[templateName] = Math.min(1, score);
    });
    
    return compatibility;
  }
  
  private analyzeCustomizationPotential(theme: ThemeRemix): PresetAnalysis['customization_potential'] {
    // Suggest alternative options for each theme component
    const colorVariants = ['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']
      .filter(c => c !== theme.colorScheme);
    
    const typographyAlternatives = ['corporate', 'elegant', 'modern', 'classic']
      .filter(t => t !== theme.typography);
    
    const suitableModifications: string[] = [];
    
    // Suggest modifications based on current theme
    if (theme.decorative === 'none') {
      suitableModifications.push('Add minimal emoji for friendly touch');
    }
    if (theme.layout === 'compact') {
      suitableModifications.push('Switch to spacious layout for premium feel');
    }
    if (theme.colorScheme === 'minimal-gray') {
      suitableModifications.push('Try warmer colors for more engaging presentation');
    }
    
    return {
      color_variants: colorVariants.slice(0, 3),
      typography_alternatives: typographyAlternatives.slice(0, 2),
      suitable_modifications: suitableModifications
    };
  }
  
  private validateCustomPreset(preset: CustomPreset): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!preset.display_name?.trim()) {
      errors.push('Display name is required');
    }
    
    if (!preset.description?.trim()) {
      errors.push('Description is required');
    }
    
    if (!preset.theme) {
      errors.push('Theme configuration is required');
    } else {
      // Validate theme using the theme engine
      const themeValidation = remixEngine['themeSystem'].engine.validateTheme(preset.theme);
      if (!themeValidation.valid) {
        errors.push(...themeValidation.errors.map(e => `Theme error: ${e}`));
      }
    }
    
    if (!preset.use_cases || preset.use_cases.length === 0) {
      errors.push('At least one use case is required');
    }
    
    if (!preset.template_preferences || preset.template_preferences.length === 0) {
      errors.push('At least one template preference is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
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

// Default preset manager instance
export const presetManager = new PresetManager();