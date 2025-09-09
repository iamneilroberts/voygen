// ============================================================================
// Preset UI Integration - Enhanced User Interface Support for Remix Presets
// ============================================================================

import { ProposalData, ThemeRemix, ProposalRemix } from './types';
import { REMIX_PRESETS, PRESET_INFO, PresetInfo, getAllPresets } from './themes/presets';
import { presetManager } from './preset-manager';
import { remixSystem } from './remix-system';

// ============================================================================
// Visual Preview System
// ============================================================================

export interface PresetPreview {
  preset_key: string;
  name: string;
  description: string;
  visual_preview: {
    color_swatch: string;
    typography_sample: string;
    decorative_elements: string[];
    layout_preview: string;
  };
  compatibility_info: {
    best_templates: string[];
    client_types: string[];
    use_case_tags: string[];
  };
  customization_options: {
    can_customize_colors: boolean;
    can_customize_typography: boolean;
    can_customize_layout: boolean;
    available_modifications: string[];
  };
}

export interface UIPresetRecommendation {
  preset_key: string;
  confidence: number;
  confidence_label: 'Very High' | 'High' | 'Medium' | 'Low';
  reasoning: string[];
  visual_indicators: {
    match_score_color: string;
    recommendation_icon: string;
    priority_badge?: string;
  };
  quick_preview: {
    sample_headline: string;
    sample_text: string;
    color_preview: string;
  };
}

export interface PresetGallery {
  featured_presets: PresetPreview[];
  category_groups: {
    business: PresetPreview[];
    luxury: PresetPreview[];
    modern: PresetPreview[];
    family: PresetPreview[];
  };
  customization_showcase: {
    base_preset: string;
    variations: Array<{
      name: string;
      preview: PresetPreview;
      modification_description: string;
    }>;
  };
}

// ============================================================================
// Preset UI Integration Class
// ============================================================================

export class PresetUIIntegration {
  
  // ============================================================================
  // Visual Preview Generation
  // ============================================================================
  
  // Generate comprehensive visual previews for all presets
  generatePresetGallery(): PresetGallery {
    const allPresets = getAllPresets();
    const featuredPresets = allPresets.map(({ key, info }) => this.createPresetPreview(key, info));
    
    return {
      featured_presets: featuredPresets,
      category_groups: {
        business: featuredPresets.filter(p => p.compatibility_info.client_types.includes('corporate') || p.compatibility_info.client_types.includes('executive')),
        luxury: featuredPresets.filter(p => p.preset_key === 'luxury' || p.compatibility_info.client_types.includes('luxury')),
        modern: featuredPresets.filter(p => p.preset_key === 'modern' || p.compatibility_info.use_case_tags.includes('tech-savvy')),
        family: featuredPresets.filter(p => p.compatibility_info.client_types.includes('family') || p.compatibility_info.use_case_tags.includes('leisure'))
      },
      customization_showcase: this.generateCustomizationShowcase()
    };
  }
  
  // Create detailed preview for a single preset
  createPresetPreview(presetKey: string, presetInfo: PresetInfo): PresetPreview {
    const theme = presetInfo.theme;
    
    return {
      preset_key: presetKey,
      name: presetInfo.name,
      description: presetInfo.description,
      visual_preview: {
        color_swatch: this.getColorSwatchForScheme(theme.colorScheme),
        typography_sample: this.getTypographySample(theme.typography),
        decorative_elements: this.getDecorativeElements(theme.decorative),
        layout_preview: this.getLayoutPreview(theme.layout)
      },
      compatibility_info: {
        best_templates: presetInfo.recommended_templates,
        client_types: this.extractClientTypes(presetInfo.use_cases),
        use_case_tags: this.generateUseCaseTags(presetInfo.use_cases)
      },
      customization_options: {
        can_customize_colors: true,
        can_customize_typography: true,
        can_customize_layout: theme.layout !== 'executive', // Executive layout is fixed
        available_modifications: this.getAvailableModifications(presetKey, theme)
      }
    };
  }
  
  // ============================================================================
  // UI Recommendation System
  // ============================================================================
  
  // Generate UI-optimized recommendations with visual indicators
  async generateUIRecommendations(proposalData: ProposalData): Promise<UIPresetRecommendation[]> {
    const recommendations = presetManager.getPresetRecommendations(proposalData);
    
    return recommendations.map(rec => ({
      preset_key: rec.preset_name,
      confidence: rec.confidence,
      confidence_label: this.getConfidenceLabel(rec.confidence),
      reasoning: rec.reasoning,
      visual_indicators: {
        match_score_color: this.getMatchScoreColor(rec.confidence),
        recommendation_icon: this.getRecommendationIcon(rec.preset_name),
        priority_badge: rec.confidence > 0.8 ? 'BEST MATCH' : undefined
      },
      quick_preview: this.generateQuickPreview(rec.preset_name, proposalData)
    }));
  }
  
  // Generate contextual quick preview based on trip data
  generateQuickPreview(presetKey: string, proposalData: ProposalData): { sample_headline: string; sample_text: string; color_preview: string } {
    const preset = PRESET_INFO[presetKey];
    const theme = preset.theme;
    
    // Generate contextual sample text based on trip characteristics
    const destination = proposalData.itinerary.destinations[0]?.destination || 'Your Destination';
    const duration = this.calculateTripDuration(proposalData);
    
    let sampleHeadline: string;
    let sampleText: string;
    
    switch (presetKey) {
      case 'luxury':
        sampleHeadline = `Exclusive ${destination} Experience`;
        sampleText = `Indulge in ${duration} of premium luxury with curated experiences, world-class accommodations, and personalized service that exceeds every expectation.`;
        break;
      case 'professional':
        sampleHeadline = `${destination} Business Travel Proposal`;
        sampleText = `Comprehensive ${duration} business travel solution with strategic accommodations, efficient transportation, and professional meeting facilities.`;
        break;
      case 'modern':
        sampleHeadline = `Smart ${destination} Adventure`;
        sampleText = `Experience ${destination} through ${duration} of modern travel with tech-integrated solutions, contemporary accommodations, and innovative experiences.`;
        break;
      case 'friendly':
        sampleHeadline = `Amazing ${destination} Getaway!`;
        sampleText = `Join us for ${duration} of unforgettable memories in ${destination} with family-friendly activities, comfortable stays, and delightful local experiences! ✈️🌍`;
        break;
      case 'executive':
        sampleHeadline = `${destination} Executive Brief`;
        sampleText = `${duration} executive travel: premium efficiency, strategic locations, streamlined logistics.`;
        break;
      default:
        sampleHeadline = `${destination} Travel Proposal`;
        sampleText = `Comprehensive ${duration} travel experience with carefully selected accommodations and curated activities.`;
    }
    
    return {
      sample_headline: sampleHeadline,
      sample_text: sampleText,
      color_preview: this.getColorSwatchForScheme(theme.colorScheme)
    };
  }
  
  // ============================================================================
  // Interactive Preset Customization
  // ============================================================================
  
  // Get customization options for a preset
  getPresetCustomizationOptions(presetKey: string): {
    color_options: Array<{ scheme: string; label: string; preview: string }>;
    typography_options: Array<{ style: string; label: string; preview: string }>;
    decorative_options: Array<{ style: string; label: string; preview: string[] }>;
    layout_options: Array<{ style: string; label: string; preview: string }>;
    preset_variations: Array<{ name: string; theme: ThemeRemix; description: string }>;
  } {
    const basePreset = PRESET_INFO[presetKey];
    
    return {
      color_options: [
        { scheme: 'professional-blue', label: 'Professional Blue', preview: '#2563eb' },
        { scheme: 'luxury-gold', label: 'Luxury Gold', preview: '#d97706' },
        { scheme: 'minimal-gray', label: 'Minimal Gray', preview: '#6b7280' },
        { scheme: 'vibrant-teal', label: 'Vibrant Teal', preview: '#0891b2' },
        { scheme: 'sunset-orange', label: 'Sunset Orange', preview: '#ea580c' }
      ],
      typography_options: [
        { style: 'corporate', label: 'Corporate', preview: 'Clean, professional system fonts' },
        { style: 'elegant', label: 'Elegant', preview: 'Sophisticated serif typography' },
        { style: 'modern', label: 'Modern', preview: 'Contemporary geometric fonts' },
        { style: 'classic', label: 'Classic', preview: 'Timeless traditional fonts' }
      ],
      decorative_options: [
        { style: 'none', label: 'None', preview: [] },
        { style: 'minimal-emoji', label: 'Minimal Icons', preview: ['🏨', '✈️', '🌍'] },
        { style: 'rich-emoji', label: 'Rich Icons', preview: ['🏨', '✈️', '🌍', '🎭', '🍽️', '🎪', '🚗'] },
        { style: 'icons-only', label: 'SVG Icons', preview: ['hotel-icon', 'plane-icon', 'globe-icon'] }
      ],
      layout_options: [
        { style: 'compact', label: 'Compact', preview: 'Dense information layout' },
        { style: 'spacious', label: 'Spacious', preview: 'Generous whitespace' },
        { style: 'magazine', label: 'Magazine', preview: 'Editorial-style layout' },
        { style: 'executive', label: 'Executive', preview: 'Streamlined summary format' }
      ],
      preset_variations: this.generatePresetVariations(presetKey, basePreset.theme)
    };
  }
  
  // Generate preset variations for customization showcase
  generatePresetVariations(basePresetKey: string, baseTheme: ThemeRemix): Array<{ name: string; theme: ThemeRemix; description: string }> {
    const variations: Array<{ name: string; theme: ThemeRemix; description: string }> = [];
    
    // Color variations
    if (baseTheme.colorScheme !== 'professional-blue') {
      variations.push({
        name: `${basePresetKey}-professional`,
        theme: { ...baseTheme, colorScheme: 'professional-blue' },
        description: 'Professional blue color variant'
      });
    }
    
    if (baseTheme.colorScheme !== 'luxury-gold') {
      variations.push({
        name: `${basePresetKey}-luxury`,
        theme: { ...baseTheme, colorScheme: 'luxury-gold' },
        description: 'Luxury gold color variant'
      });
    }
    
    // Typography variations
    if (baseTheme.typography !== 'elegant') {
      variations.push({
        name: `${basePresetKey}-elegant`,
        theme: { ...baseTheme, typography: 'elegant' },
        description: 'Elegant typography variant'
      });
    }
    
    // Layout variations
    if (baseTheme.layout !== 'magazine' && basePresetKey !== 'executive') {
      variations.push({
        name: `${basePresetKey}-magazine`,
        theme: { ...baseTheme, layout: 'magazine' },
        description: 'Magazine-style layout variant'
      });
    }
    
    return variations.slice(0, 3); // Limit to top 3 variations
  }
  
  // ============================================================================
  // User Experience Helpers
  // ============================================================================
  
  // Generate step-by-step preset selection wizard
  generatePresetSelectionWizard(): {
    steps: Array<{
      step_number: number;
      title: string;
      description: string;
      options: Array<{
        key: string;
        label: string;
        description: string;
        preview?: string;
        leads_to_presets: string[];
      }>;
    }>;
    decision_tree: Record<string, string[]>;
  } {
    return {
      steps: [
        {
          step_number: 1,
          title: 'What type of client is this for?',
          description: 'Choose the primary audience for this travel proposal',
          options: [
            {
              key: 'corporate',
              label: 'Corporate/Business',
              description: 'Professional business travelers and corporate clients',
              preview: '#2563eb',
              leads_to_presets: ['professional', 'executive']
            },
            {
              key: 'luxury',
              label: 'Luxury/Premium',
              description: 'High-end clientele seeking premium experiences',
              preview: '#d97706',
              leads_to_presets: ['luxury', 'professional']
            },
            {
              key: 'family',
              label: 'Family/Leisure',
              description: 'Families and leisure travelers',
              preview: '#ea580c',
              leads_to_presets: ['friendly', 'modern']
            },
            {
              key: 'tech_savvy',
              label: 'Modern/Tech-Savvy',
              description: 'Contemporary travelers who appreciate modern design',
              preview: '#0891b2',
              leads_to_presets: ['modern', 'friendly']
            }
          ]
        },
        {
          step_number: 2,
          title: 'How should the proposal feel?',
          description: 'Select the desired tone and presentation style',
          options: [
            {
              key: 'formal',
              label: 'Formal & Professional',
              description: 'Clean, corporate, and business-focused',
              leads_to_presets: ['professional', 'executive']
            },
            {
              key: 'elegant',
              label: 'Elegant & Sophisticated',
              description: 'Refined, upscale, and premium feeling',
              leads_to_presets: ['luxury', 'professional']
            },
            {
              key: 'friendly',
              label: 'Warm & Approachable',
              description: 'Personal, inviting, and family-oriented',
              leads_to_presets: ['friendly', 'modern']
            },
            {
              key: 'efficient',
              label: 'Quick & Efficient',
              description: 'Streamlined for fast decision-making',
              leads_to_presets: ['executive', 'modern']
            }
          ]
        }
      ],
      decision_tree: {
        'corporate+formal': ['professional', 'executive'],
        'corporate+efficient': ['executive', 'professional'],
        'luxury+elegant': ['luxury', 'professional'],
        'luxury+formal': ['professional', 'luxury'],
        'family+friendly': ['friendly', 'modern'],
        'family+elegant': ['friendly', 'luxury'],
        'tech_savvy+friendly': ['modern', 'friendly'],
        'tech_savvy+efficient': ['modern', 'executive']
      }
    };
  }
  
  // Get user-friendly template recommendations for a preset
  getTemplateRecommendationsForPreset(presetKey: string): Array<{
    template: string;
    label: string;
    description: string;
    compatibility_score: number;
    best_for: string[];
    sample_content: string;
  }> {
    const presetInfo = PRESET_INFO[presetKey];
    const allTemplates = ['detailed', 'condensed', 'fancy', 'functional'];
    
    return allTemplates.map(template => {
      const isRecommended = presetInfo.recommended_templates.includes(template);
      const compatibility = isRecommended ? 1.0 : 0.7;
      
      return {
        template,
        label: this.getTemplateLabel(template),
        description: this.getTemplateDescription(template),
        compatibility_score: compatibility,
        best_for: this.getTemplateBestFor(template),
        sample_content: this.generateTemplateSample(template, presetKey)
      };
    }).sort((a, b) => b.compatibility_score - a.compatibility_score);
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private getColorSwatchForScheme(colorScheme: string): string {
    const colorMap: Record<string, string> = {
      'professional-blue': '#2563eb',
      'luxury-gold': '#d97706',
      'minimal-gray': '#6b7280',
      'vibrant-teal': '#0891b2',
      'sunset-orange': '#ea580c'
    };
    return colorMap[colorScheme] || '#2563eb';
  }
  
  private getTypographySample(typography: string): string {
    const samples: Record<string, string> = {
      'corporate': 'Clean Professional Typography',
      'elegant': 'Sophisticated Serif Typography',
      'modern': 'Contemporary Geometric Fonts',
      'classic': 'Timeless Traditional Fonts'
    };
    return samples[typography] || samples.corporate;
  }
  
  private getDecorativeElements(decorative: string): string[] {
    const elements: Record<string, string[]> = {
      'none': [],
      'minimal-emoji': ['🏨', '✈️', '🌍'],
      'rich-emoji': ['🏨', '✈️', '🌍', '🎭', '🍽️', '🎪', '🚗'],
      'icons-only': ['hotel-icon', 'plane-icon', 'globe-icon']
    };
    return elements[decorative] || [];
  }
  
  private getLayoutPreview(layout: string): string {
    const previews: Record<string, string> = {
      'compact': 'Dense, information-rich layout',
      'spacious': 'Generous whitespace, easy to read',
      'magazine': 'Editorial-style with visual hierarchy',
      'executive': 'Streamlined summary format'
    };
    return previews[layout] || previews.spacious;
  }
  
  private extractClientTypes(useCases: string[]): string[] {
    const types: string[] = [];
    useCases.forEach(useCase => {
      const lower = useCase.toLowerCase();
      if (lower.includes('corporate') || lower.includes('business')) types.push('corporate');
      if (lower.includes('luxury') || lower.includes('premium')) types.push('luxury');
      if (lower.includes('family')) types.push('family');
      if (lower.includes('executive')) types.push('executive');
      if (lower.includes('leisure')) types.push('leisure');
    });
    return [...new Set(types)];
  }
  
  private generateUseCaseTags(useCases: string[]): string[] {
    const tags: string[] = [];
    useCases.forEach(useCase => {
      const lower = useCase.toLowerCase();
      if (lower.includes('tech')) tags.push('tech-savvy');
      if (lower.includes('formal') || lower.includes('professional')) tags.push('formal');
      if (lower.includes('quick') || lower.includes('fast')) tags.push('efficient');
      if (lower.includes('personal') || lower.includes('relationship')) tags.push('relationship-focused');
    });
    return tags;
  }
  
  private getAvailableModifications(presetKey: string, theme: ThemeRemix): string[] {
    const modifications: string[] = [];
    
    modifications.push('Change color scheme');
    modifications.push('Adjust typography style');
    
    if (theme.layout !== 'executive') {
      modifications.push('Modify layout style');
    }
    
    if (theme.decorative !== 'none') {
      modifications.push('Customize decorative elements');
    } else {
      modifications.push('Add decorative elements');
    }
    
    modifications.push('Create custom variant');
    
    return modifications;
  }
  
  private getConfidenceLabel(confidence: number): 'Very High' | 'High' | 'Medium' | 'Low' {
    if (confidence >= 0.8) return 'Very High';
    if (confidence >= 0.6) return 'High';
    if (confidence >= 0.4) return 'Medium';
    return 'Low';
  }
  
  private getMatchScoreColor(confidence: number): string {
    if (confidence >= 0.8) return '#22c55e'; // Green
    if (confidence >= 0.6) return '#3b82f6'; // Blue
    if (confidence >= 0.4) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  }
  
  private getRecommendationIcon(presetKey: string): string {
    const icons: Record<string, string> = {
      'professional': '💼',
      'luxury': '✨',
      'modern': '🚀',
      'friendly': '😊',
      'executive': '⚡'
    };
    return icons[presetKey] || '📋';
  }
  
  private calculateTripDuration(proposalData: ProposalData): string {
    const startDate = new Date(proposalData.trip_summary.start_date);
    const endDate = new Date(proposalData.trip_summary.end_date);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  }
  
  private generateCustomizationShowcase(): {
    base_preset: string;
    variations: Array<{
      name: string;
      preview: PresetPreview;
      modification_description: string;
    }>;
  } {
    const basePreset = 'professional';
    const baseInfo = PRESET_INFO[basePreset];
    
    const variations = [
      {
        name: 'Luxury Blue',
        theme: { ...baseInfo.theme, colorScheme: 'luxury-gold' as const, typography: 'elegant' as const },
        modification_description: 'Professional preset with luxury gold colors and elegant typography'
      },
      {
        name: 'Modern Professional',
        theme: { ...baseInfo.theme, colorScheme: 'vibrant-teal' as const, typography: 'modern' as const, decorative: 'icons-only' as const },
        modification_description: 'Professional preset with modern teal colors and clean icons'
      },
      {
        name: 'Executive Professional',
        theme: { ...baseInfo.theme, layout: 'executive' as const, decorative: 'none' as const },
        modification_description: 'Professional preset optimized for executive summary format'
      }
    ];
    
    return {
      base_preset: basePreset,
      variations: variations.map(variation => ({
        name: variation.name,
        preview: this.createPresetPreview(
          variation.name.toLowerCase().replace(' ', '-'), 
          {
            ...baseInfo,
            name: variation.name,
            theme: variation.theme
          }
        ),
        modification_description: variation.modification_description
      }))
    };
  }
  
  private getTemplateLabel(template: string): string {
    const labels: Record<string, string> = {
      'detailed': 'Detailed',
      'condensed': 'Condensed',
      'fancy': 'Fancy',
      'functional': 'Functional'
    };
    return labels[template] || template;
  }
  
  private getTemplateDescription(template: string): string {
    const descriptions: Record<string, string> = {
      'detailed': 'Comprehensive information with full sections and detailed breakdowns',
      'condensed': 'Streamlined format focusing on key information and summary details',
      'fancy': 'Rich visual presentation with enhanced styling and premium appearance',
      'functional': 'Clean, minimal approach focusing on essential information and functionality'
    };
    return descriptions[template] || 'Standard template layout';
  }
  
  private getTemplateBestFor(template: string): string[] {
    const bestFor: Record<string, string[]> = {
      'detailed': ['Complex trips', 'Multiple destinations', 'Corporate presentations', 'Comprehensive planning'],
      'condensed': ['Executive summaries', 'Quick approvals', 'Simple trips', 'Mobile viewing'],
      'fancy': ['Luxury experiences', 'Special occasions', 'Premium clients', 'Marketing presentations'],
      'functional': ['Tech-savvy clients', 'Digital-first approach', 'Simple layouts', 'Fast loading']
    };
    return bestFor[template] || ['General purpose'];
  }
  
  private generateTemplateSample(template: string, presetKey: string): string {
    const samples: Record<string, Record<string, string>> = {
      'detailed': {
        'professional': '📋 Executive Summary\n📍 Destinations & Itinerary\n🏨 Accommodations\n✈️ Transportation\n💰 Investment Summary',
        'luxury': '✨ Curated Experience Overview\n🌍 Exclusive Destinations\n🏛️ Premium Accommodations\n🚁 Private Transportation\n💎 Investment Details',
        'modern': '🎯 Trip Overview\n📍 Smart Destinations\n🏨 Modern Accommodations\n🚀 Efficient Transportation\n💳 Cost Breakdown',
        'friendly': '🌟 Your Amazing Adventure!\n🗺️ Exciting Destinations\n🏡 Comfortable Stays\n🚗 Easy Transportation\n💰 Simple Pricing',
        'executive': '⚡ Executive Brief\n📍 Key Destinations\n🏨 Strategic Accommodations\n✈️ Efficient Transport\n💼 Investment'
      },
      'condensed': {
        'professional': 'Business Travel Summary:\n• 3 destinations, 5 days\n• Premium accommodations\n• All transportation included\n• Total: $4,250',
        'luxury': 'Luxury Experience Brief:\n• Exclusive itinerary\n• 5-star accommodations\n• Private transportation\n• Investment: $12,500',
        'modern': 'Smart Travel Package:\n• Tech-optimized journey\n• Contemporary hotels\n• Flexible transport\n• Cost: $3,750',
        'friendly': 'Your Perfect Getaway! ✈️\n• Fun destinations\n• Great hotels\n• Easy travel\n• Price: $2,850',
        'executive': 'Executive Summary:\n• 3 cities, 4 days\n• Strategic locations\n• Efficient logistics\n• $4,100'
      },
      'fancy': {
        'professional': '𝒫𝓇𝑒𝓂𝒾𝓊𝓂 𝐵𝓊𝓈𝒾𝓃𝑒𝓈𝓈 𝐸𝓍𝓅𝑒𝓇𝒾𝑒𝓃𝒸𝑒\n◆ Curated destinations with strategic value\n◆ Executive accommodations and amenities\n◆ Seamless transportation solutions\n◆ Comprehensive investment overview',
        'luxury': '𝒜 𝒥𝑜𝓊𝓇𝓃𝑒𝓎 𝒷𝑒𝓎𝑜𝓃𝒹 𝐸𝓍𝓅𝑒𝒸𝓉𝒶𝓉𝒾𝑜𝓃\n♦ Extraordinary destinations awaiting discovery\n♦ Exquisite accommodations of unparalleled luxury\n♦ Exclusive transportation experiences\n♦ Investment in memories that last forever',
        'modern': '𝚂𝚖𝚊𝚛𝚝 𝚃𝚛𝚊𝚟𝚎𝚕 𝙸𝚗𝚗𝚘𝚟𝚊𝚝𝚒𝚘𝚗\n▸ Next-gen destinations with modern appeal\n▸ Tech-integrated accommodations\n▸ Innovative transportation solutions\n▸ Transparent pricing with smart value',
        'friendly': '𝒴𝑜𝓊𝓇 𝒜𝓂𝒶𝓏𝒾𝓃𝑔 𝒜𝒹𝓋𝑒𝓃𝓉𝓊𝓇𝑒 𝒜𝓌𝒶𝒾𝓉𝓈! ✨\n🌟 Incredible destinations filled with wonder\n🏡 Cozy accommodations that feel like home\n🚗 Comfortable transportation for the family\n💫 Amazing value for unforgettable memories',
        'executive': '𝔼𝕩𝕖𝕔𝕦𝕥𝕚𝕧𝕖 𝔼𝔰𝔰𝔢𝔫𝔱𝔦𝔞𝔩𝔰\n→ Strategic destination selection\n→ Premium efficiency accommodations\n→ Streamlined transportation\n→ Optimized investment allocation'
      },
      'functional': {
        'professional': 'BUSINESS TRAVEL DETAILS\nDestinations: 3 locations\nDuration: 5 days\nAccommodations: Business-class\nTransport: Included\nTotal: $4,250',
        'luxury': 'LUXURY TRAVEL PACKAGE\nExclusive destinations\n5-star accommodations\nPrivate transportation\nAll-inclusive experience\nInvestment: $12,500',
        'modern': 'TRAVEL PACKAGE INFO\nSmart destinations\nModern hotels\nFlexible transport\nTech-optimized\nCost: $3,750',
        'friendly': 'FAMILY VACATION PLAN\nFun destinations\nFamily-friendly hotels\nEasy transportation\nGreat value\nPrice: $2,850',
        'executive': 'EXECUTIVE BRIEF\n3 cities / 4 days\nStrategic locations\nEfficient logistics\nOptimized schedule\n$4,100'
      }
    };
    
    return samples[template]?.[presetKey] || `${template} template sample for ${presetKey} preset`;
  }
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

export const presetUIIntegration = new PresetUIIntegration();

// Convenience functions for easy integration
export function generatePresetGallery(): PresetGallery {
  return presetUIIntegration.generatePresetGallery();
}

export async function getUIRecommendations(proposalData: ProposalData): Promise<UIPresetRecommendation[]> {
  return presetUIIntegration.generateUIRecommendations(proposalData);
}

export function getPresetCustomization(presetKey: string) {
  return presetUIIntegration.getPresetCustomizationOptions(presetKey);
}

export function getPresetSelectionWizard() {
  return presetUIIntegration.generatePresetSelectionWizard();
}

export function getTemplateRecommendations(presetKey: string) {
  return presetUIIntegration.getTemplateRecommendationsForPreset(presetKey);
}

// Quick access to visual preview generation
export function createPresetPreview(presetKey: string): PresetPreview | null {
  const presetInfo = PRESET_INFO[presetKey];
  if (!presetInfo) return null;
  
  return presetUIIntegration.createPresetPreview(presetKey, presetInfo);
}

export default presetUIIntegration;