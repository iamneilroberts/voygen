// ============================================================================
// Theme Presets for Travel Proposal Remix System
// ============================================================================

import { ThemeRemix } from '../types';

export interface PresetInfo {
  name: string;
  description: string;
  use_cases: string[];
  theme: ThemeRemix;
  preview_text: string;
  recommended_templates: string[];
}

export const REMIX_PRESETS: Record<string, ThemeRemix> = {
  professional: {
    colorScheme: 'professional-blue',
    typography: 'corporate', 
    decorative: 'none',
    layout: 'spacious'
  },
  
  luxury: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'minimal-emoji',
    layout: 'magazine'
  },
  
  modern: {
    colorScheme: 'vibrant-teal',
    typography: 'modern',
    decorative: 'icons-only',
    layout: 'compact'
  },
  
  friendly: {
    colorScheme: 'sunset-orange', 
    typography: 'modern',
    decorative: 'rich-emoji',
    layout: 'spacious'
  },
  
  executive: {
    colorScheme: 'minimal-gray',
    typography: 'corporate',
    decorative: 'none', 
    layout: 'executive'
  }
};

export const PRESET_INFO: Record<string, PresetInfo> = {
  professional: {
    name: 'Professional',
    description: 'Clean corporate look with blue color scheme, perfect for business travel and formal presentations',
    use_cases: [
      'Corporate clients',
      'Business trip proposals',
      'Executive presentations',
      'Formal client meetings'
    ],
    theme: REMIX_PRESETS.professional,
    preview_text: 'Blue corporate theme, clean system fonts, no decorative elements, spacious professional layout',
    recommended_templates: ['detailed', 'condensed']
  },
  
  luxury: {
    name: 'Luxury',
    description: 'Elegant gold theme with sophisticated typography for premium travel experiences',
    use_cases: [
      'High-end leisure travel',
      'Luxury accommodation proposals',
      'VIP client experiences',
      'Premium service offerings'
    ],
    theme: REMIX_PRESETS.luxury,
    preview_text: 'Gold accent colors, elegant serif fonts, minimal travel icons (🏨✈️🌍), magazine-style layout',
    recommended_templates: ['fancy', 'detailed']
  },
  
  modern: {
    name: 'Modern',
    description: 'Contemporary teal design with clean icons and modern typography for tech-savvy clients',
    use_cases: [
      'Tech-savvy clients',
      'Millennial/Gen-Z travelers',
      'Urban destination packages',
      'Digital-first presentations'
    ],
    theme: REMIX_PRESETS.modern,
    preview_text: 'Vibrant teal colors, modern geometric fonts, clean SVG icons, compact efficient layout',
    recommended_templates: ['functional', 'condensed']
  },
  
  friendly: {
    name: 'Friendly',
    description: 'Warm orange theme with travel emoji for a personal, approachable touch',
    use_cases: [
      'Family travel planning',
      'Vacation packages',
      'Leisure travel clients',
      'Personal relationship building'
    ],
    theme: REMIX_PRESETS.friendly,
    preview_text: 'Warm sunset colors, friendly modern fonts, rich emoji set (🏨✈️🌍🎭🍽️), spacious airy layout',
    recommended_templates: ['detailed', 'fancy']
  },
  
  executive: {
    name: 'Executive',
    description: 'Minimal gray design optimized for quick decision-making and time-pressed executives',
    use_cases: [
      'Time-pressed executives',
      'Quick approval processes',
      'Summary reports',
      'Streamlined presentations'
    ],
    theme: REMIX_PRESETS.executive,
    preview_text: 'Minimal gray palette, corporate system fonts, no decorations, executive-optimized layout',
    recommended_templates: ['condensed', 'functional']
  }
};

// Helper function to get preset safely
export function getPreset(presetName: string): ThemeRemix {
  const preset = REMIX_PRESETS[presetName];
  if (!preset) {
    console.warn(`Preset '${presetName}' not found, falling back to professional`);
    return REMIX_PRESETS.professional;
  }
  return preset;
}

// Helper function to get preset info safely
export function getPresetInfo(presetName: string): PresetInfo {
  const info = PRESET_INFO[presetName];
  if (!info) {
    console.warn(`Preset info for '${presetName}' not found, falling back to professional`);
    return PRESET_INFO.professional;
  }
  return info;
}

// Get all available presets with their information
export function getAllPresets(): Array<{ key: string; info: PresetInfo }> {
  return Object.entries(PRESET_INFO).map(([key, info]) => ({
    key,
    info
  }));
}

// Get preset recommendations based on use case
export function getPresetsByUseCase(useCase: string): string[] {
  const lowerUseCase = useCase.toLowerCase();
  const matchingPresets: string[] = [];
  
  Object.entries(PRESET_INFO).forEach(([key, info]) => {
    if (info.use_cases.some(uc => uc.toLowerCase().includes(lowerUseCase))) {
      matchingPresets.push(key);
    }
  });
  
  return matchingPresets.length > 0 ? matchingPresets : ['professional'];
}

// Get preset recommendations based on client type
export function getPresetsByClientType(clientType: 'corporate' | 'leisure' | 'luxury' | 'family' | 'executive'): string[] {
  const recommendations = {
    corporate: ['professional', 'executive'],
    leisure: ['friendly', 'modern'],
    luxury: ['luxury', 'professional'],
    family: ['friendly', 'modern'],
    executive: ['executive', 'professional']
  };
  
  return recommendations[clientType] || ['professional'];
}

// Generate preset combinations for testing
export function generatePresetCombinations(templates: string[]): Array<{
  template: string;
  preset: string;
  combination_name: string;
}> {
  const combinations: Array<{
    template: string;
    preset: string;
    combination_name: string;
  }> = [];
  
  templates.forEach(template => {
    Object.keys(REMIX_PRESETS).forEach(preset => {
      combinations.push({
        template,
        preset,
        combination_name: `${template}-${preset}`
      });
    });
  });
  
  return combinations;
}

// Get the most suitable preset for a template
export function getRecommendedPresetForTemplate(template: string): string {
  const templatePreferences = {
    'detailed': 'professional',
    'condensed': 'executive',
    'fancy': 'luxury',
    'functional': 'modern'
  };
  
  return templatePreferences[template as keyof typeof templatePreferences] || 'professional';
}

// Validate if a preset works well with a template
export function validatePresetTemplateMatch(preset: string, template: string): {
  compatible: boolean;
  recommendations?: string[];
  warnings?: string[];
} {
  const presetInfo = getPresetInfo(preset);
  
  // Check if template is in recommended list
  const isRecommended = presetInfo.recommended_templates.includes(template);
  
  if (isRecommended) {
    return { compatible: true };
  }
  
  // Provide specific guidance for non-recommended combinations
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  if (preset === 'executive' && template === 'fancy') {
    warnings.push('Executive preset is designed for minimal presentation, may not suit fancy template\'s rich styling');
    recommendations.push('Consider professional or luxury presets for fancy template');
  }
  
  if (preset === 'luxury' && template === 'functional') {
    warnings.push('Luxury preset emphasizes elegance, may conflict with functional template\'s minimal approach');
    recommendations.push('Consider modern or professional presets for functional template');
  }
  
  return {
    compatible: true, // Allow all combinations but provide guidance
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Export summary for documentation
export const PRESET_SUMMARY = {
  total_presets: Object.keys(REMIX_PRESETS).length,
  total_combinations: Object.keys(REMIX_PRESETS).length * 4, // 4 base templates
  color_schemes: ['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange'],
  typography_styles: ['corporate', 'elegant', 'modern', 'classic'],
  decorative_styles: ['none', 'minimal-emoji', 'rich-emoji', 'icons-only'],
  layout_styles: ['compact', 'spacious', 'magazine', 'executive'],
  use_case_coverage: [
    'Corporate business travel',
    'Luxury leisure experiences',
    'Modern tech-savvy clients',
    'Family-friendly presentations',
    'Executive decision-making'
  ]
};