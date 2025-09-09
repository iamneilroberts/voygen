// ============================================================================
// Custom Preset Manager - Advanced Custom Preset Creation and Management
// ============================================================================

import { ProposalData, ThemeRemix } from './types';
import { REMIX_PRESETS, PRESET_INFO, validatePresetTemplateMatch } from './themes/presets';
import { CustomPreset, PresetRecommendation } from './preset-manager';

// ============================================================================
// Custom Preset Database Schema (for D1 integration)
// ============================================================================

export interface CustomPresetRecord {
  id: string;
  name: string;
  display_name: string;
  description: string;
  theme_config: string; // JSON serialized ThemeRemix
  template_preferences: string; // JSON serialized string array
  use_cases: string; // JSON serialized string array
  target_audience: string; // JSON serialized string array
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string; // JSON serialized string array
  is_public: boolean;
  usage_count: number;
  last_used: string | null;
  rating: number | null;
  base_preset?: string; // Original preset this was derived from
}

// ============================================================================
// Custom Preset Creation and Validation
// ============================================================================

export interface CustomPresetCreationOptions {
  base_preset?: string;
  theme_overrides?: Partial<ThemeRemix>;
  template_preferences?: string[];
  use_cases?: string[];
  target_audience?: string[];
  tags?: string[];
  is_public?: boolean;
  created_by: string;
}

export interface PresetValidationResult {
  is_valid: boolean;
  warnings: string[];
  suggestions: string[];
  compatibility_score: number;
  theme_analysis: {
    color_compatibility: number;
    typography_compatibility: number;
    layout_compatibility: number;
    decorative_compatibility: number;
  };
}

export interface CustomPresetTemplate {
  name: string;
  description: string;
  theme: ThemeRemix;
  suggested_use_cases: string[];
  suggested_audience: string[];
  customization_notes: string[];
}

// ============================================================================
// Custom Preset Manager Class
// ============================================================================

export class CustomPresetManager {
  private customPresets: Map<string, CustomPreset> = new Map();
  private presetTemplates: CustomPresetTemplate[] = [];
  
  constructor() {
    this.initializePresetTemplates();
  }
  
  // ============================================================================
  // Custom Preset Creation
  // ============================================================================
  
  // Create a new custom preset
  createCustomPreset(
    name: string,
    display_name: string,
    description: string,
    options: CustomPresetCreationOptions
  ): { success: boolean; preset?: CustomPreset; errors?: string[] } {
    
    const errors = this.validatePresetCreation(name, display_name, description, options);
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    // Build theme configuration
    let theme: ThemeRemix;
    if (options.base_preset && REMIX_PRESETS[options.base_preset]) {
      // Start with base preset and apply overrides
      theme = {
        ...REMIX_PRESETS[options.base_preset],
        ...options.theme_overrides
      };
    } else if (options.theme_overrides) {
      // Create from scratch with defaults
      theme = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'none',
        layout: 'spacious',
        ...options.theme_overrides
      };
    } else {
      return { success: false, errors: ['Either base_preset or theme_overrides must be provided'] };
    }
    
    // Create custom preset
    const customPreset: CustomPreset = {
      name,
      display_name,
      description,
      theme,
      template_preferences: options.template_preferences || ['detailed'],
      use_cases: options.use_cases || [],
      target_audience: options.target_audience || [],
      created_by: options.created_by,
      created_at: new Date().toISOString(),
      tags: options.tags || [],
      is_public: options.is_public ?? false
    };
    
    // Store in memory cache
    this.customPresets.set(name, customPreset);
    
    return { success: true, preset: customPreset };
  }
  
  // Create custom preset from existing preset with modifications
  cloneAndModifyPreset(
    originalPresetKey: string,
    newName: string,
    newDisplayName: string,
    modifications: {
      description?: string;
      theme_changes?: Partial<ThemeRemix>;
      template_preferences?: string[];
      use_cases?: string[];
      target_audience?: string[];
      tags?: string[];
    },
    createdBy: string
  ): { success: boolean; preset?: CustomPreset; errors?: string[] } {
    
    // Check if original preset exists
    const originalPreset = PRESET_INFO[originalPresetKey] || this.customPresets.get(originalPresetKey);
    if (!originalPreset) {
      return { success: false, errors: [`Original preset '${originalPresetKey}' not found`] };
    }
    
    // Extract base theme and info
    const baseTheme = originalPreset.theme;
    const baseInfo = PRESET_INFO[originalPresetKey];
    
    const options: CustomPresetCreationOptions = {
      base_preset: originalPresetKey,
      theme_overrides: modifications.theme_changes,
      template_preferences: modifications.template_preferences || baseInfo?.recommended_templates,
      use_cases: modifications.use_cases || baseInfo?.use_cases,
      target_audience: modifications.target_audience || ['general'],
      tags: modifications.tags || [],
      is_public: false,
      created_by: createdBy
    };
    
    return this.createCustomPreset(
      newName,
      newDisplayName,
      modifications.description || `Modified version of ${originalPresetKey}`,
      options
    );
  }
  
  // ============================================================================
  // Preset Templates and Suggestions
  // ============================================================================
  
  // Get preset creation suggestions based on trip data
  getPresetCreationSuggestions(proposalData: ProposalData): {
    suggested_presets: Array<{
      name: string;
      display_name: string;
      description: string;
      theme: ThemeRemix;
      reasoning: string[];
      confidence: number;
    }>;
    theme_suggestions: {
      colors: Array<{ scheme: string; reason: string }>;
      typography: Array<{ style: string; reason: string }>;
      decorative: Array<{ style: string; reason: string }>;
      layout: Array<{ style: string; reason: string }>;
    };
  } {
    
    const analysis = this.analyzeTripForCustomPreset(proposalData);
    const suggestions: any[] = [];
    
    // Generate custom preset suggestions based on analysis
    if (analysis.is_luxury && analysis.is_business) {
      suggestions.push({
        name: `${analysis.primary_destination.toLowerCase().replace(/\s+/g, '-')}-executive-luxury`,
        display_name: `${analysis.primary_destination} Executive Luxury`,
        description: `Premium business travel preset tailored for luxury experiences in ${analysis.primary_destination}`,
        theme: {
          colorScheme: 'luxury-gold',
          typography: 'elegant',
          decorative: 'minimal-emoji',
          layout: 'magazine'
        },
        reasoning: ['Combines business efficiency with luxury presentation', 'Premium destination detected', 'High budget indicates luxury expectations'],
        confidence: 0.9
      });
    }
    
    if (analysis.is_family && analysis.duration > 7) {
      suggestions.push({
        name: `extended-family-${analysis.primary_destination.toLowerCase().replace(/\s+/g, '-')}`,
        display_name: `Extended Family ${analysis.primary_destination}`,
        description: `Family-friendly preset optimized for extended stays in ${analysis.primary_destination}`,
        theme: {
          colorScheme: 'sunset-orange',
          typography: 'modern',
          decorative: 'rich-emoji',
          layout: 'spacious'
        },
        reasoning: ['Extended duration suggests comprehensive planning needs', 'Family-friendly destination', 'Multiple accommodations require clear organization'],
        confidence: 0.85
      });
    }
    
    if (analysis.is_tech_destination) {
      suggestions.push({
        name: `tech-hub-${analysis.primary_destination.toLowerCase().replace(/\s+/g, '-')}`,
        display_name: `Tech Hub ${analysis.primary_destination}`,
        description: `Modern preset for tech-savvy travelers visiting innovation centers`,
        theme: {
          colorScheme: 'vibrant-teal',
          typography: 'modern',
          decorative: 'icons-only',
          layout: 'compact'
        },
        reasoning: ['Tech-oriented destination detected', 'Modern traveler profile', 'Efficient information presentation preferred'],
        confidence: 0.8
      });
    }
    
    return {
      suggested_presets: suggestions,
      theme_suggestions: this.generateThemeSuggestions(analysis)
    };
  }
  
  // Get available preset templates for quick customization
  getPresetTemplates(): CustomPresetTemplate[] {
    return this.presetTemplates;
  }
  
  // ============================================================================
  // Preset Management Operations
  // ============================================================================
  
  // Update an existing custom preset
  updateCustomPreset(
    presetName: string,
    updates: {
      display_name?: string;
      description?: string;
      theme?: Partial<ThemeRemix>;
      template_preferences?: string[];
      use_cases?: string[];
      target_audience?: string[];
      tags?: string[];
      is_public?: boolean;
    }
  ): { success: boolean; preset?: CustomPreset; errors?: string[] } {
    
    const existingPreset = this.customPresets.get(presetName);
    if (!existingPreset) {
      return { success: false, errors: [`Custom preset '${presetName}' not found`] };
    }
    
    // Apply updates
    const updatedPreset: CustomPreset = {
      ...existingPreset,
      display_name: updates.display_name || existingPreset.display_name,
      description: updates.description || existingPreset.description,
      theme: updates.theme ? { ...existingPreset.theme, ...updates.theme } : existingPreset.theme,
      template_preferences: updates.template_preferences || existingPreset.template_preferences,
      use_cases: updates.use_cases || existingPreset.use_cases,
      target_audience: updates.target_audience || existingPreset.target_audience,
      tags: updates.tags || existingPreset.tags,
      is_public: updates.is_public !== undefined ? updates.is_public : existingPreset.is_public
    };
    
    // Validate updated preset
    const validation = this.validateCustomPreset(updatedPreset);
    if (!validation.is_valid) {
      return { success: false, errors: validation.warnings };
    }
    
    this.customPresets.set(presetName, updatedPreset);
    return { success: true, preset: updatedPreset };
  }
  
  // Delete a custom preset
  deleteCustomPreset(presetName: string): { success: boolean; errors?: string[] } {
    if (!this.customPresets.has(presetName)) {
      return { success: false, errors: [`Custom preset '${presetName}' not found`] };
    }
    
    this.customPresets.delete(presetName);
    return { success: true };
  }
  
  // Get all custom presets (optionally filtered)
  getCustomPresets(filters?: {
    created_by?: string;
    is_public?: boolean;
    tags?: string[];
    use_cases?: string[];
  }): CustomPreset[] {
    let presets = Array.from(this.customPresets.values());
    
    if (filters) {
      if (filters.created_by) {
        presets = presets.filter(p => p.created_by === filters.created_by);
      }
      if (filters.is_public !== undefined) {
        presets = presets.filter(p => p.is_public === filters.is_public);
      }
      if (filters.tags && filters.tags.length > 0) {
        presets = presets.filter(p => 
          filters.tags!.some(tag => p.tags.includes(tag))
        );
      }
      if (filters.use_cases && filters.use_cases.length > 0) {
        presets = presets.filter(p => 
          filters.use_cases!.some(useCase => p.use_cases.includes(useCase))
        );
      }
    }
    
    return presets;
  }
  
  // ============================================================================
  // Validation and Analysis
  // ============================================================================
  
  // Validate custom preset configuration
  validateCustomPreset(preset: CustomPreset): PresetValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let compatibilityScore = 1.0;
    
    // Validate theme consistency
    const themeAnalysis = this.analyzeThemeCompatibility(preset.theme);
    
    if (themeAnalysis.color_compatibility < 0.7) {
      warnings.push('Color scheme may not work well with selected typography');
      compatibilityScore -= 0.1;
    }
    
    if (themeAnalysis.layout_compatibility < 0.7) {
      warnings.push('Layout style may conflict with decorative elements');
      compatibilityScore -= 0.1;
    }
    
    // Validate template preferences
    preset.template_preferences.forEach(template => {
      const templateMatch = validatePresetTemplateMatch(preset.name, template);
      if (templateMatch.warnings) {
        warnings.push(...templateMatch.warnings);
        compatibilityScore -= 0.05;
      }
      if (templateMatch.recommendations) {
        suggestions.push(...templateMatch.recommendations);
      }
    });
    
    // Check for common issues
    if (preset.theme.decorative === 'rich-emoji' && preset.theme.typography === 'elegant') {
      suggestions.push('Consider using minimal-emoji with elegant typography for better visual balance');
    }
    
    if (preset.theme.layout === 'executive' && preset.theme.decorative !== 'none') {
      warnings.push('Executive layout is optimized for minimal decorative elements');
      compatibilityScore -= 0.15;
    }
    
    return {
      is_valid: warnings.length === 0,
      warnings,
      suggestions,
      compatibility_score: Math.max(0, compatibilityScore),
      theme_analysis: themeAnalysis
    };
  }
  
  // ============================================================================
  // Database Integration Methods (for future D1 integration)
  // ============================================================================
  
  // Convert custom preset to database record
  presetToDbRecord(preset: CustomPreset, id?: string): CustomPresetRecord {
    return {
      id: id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: preset.name,
      display_name: preset.display_name,
      description: preset.description,
      theme_config: JSON.stringify(preset.theme),
      template_preferences: JSON.stringify(preset.template_preferences),
      use_cases: JSON.stringify(preset.use_cases),
      target_audience: JSON.stringify(preset.target_audience),
      created_by: preset.created_by || 'system',
      created_at: preset.created_at,
      updated_at: new Date().toISOString(),
      tags: JSON.stringify(preset.tags),
      is_public: preset.is_public,
      usage_count: 0,
      last_used: null,
      rating: null
    };
  }
  
  // Convert database record to custom preset
  dbRecordToPreset(record: CustomPresetRecord): CustomPreset {
    return {
      name: record.name,
      display_name: record.display_name,
      description: record.description,
      theme: JSON.parse(record.theme_config),
      template_preferences: JSON.parse(record.template_preferences),
      use_cases: JSON.parse(record.use_cases),
      target_audience: JSON.parse(record.target_audience),
      created_by: record.created_by,
      created_at: record.created_at,
      tags: JSON.parse(record.tags),
      is_public: record.is_public
    };
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private validatePresetCreation(
    name: string,
    display_name: string,
    description: string,
    options: CustomPresetCreationOptions
  ): string[] {
    const errors: string[] = [];
    
    // Name validation
    if (!name || name.length < 3) {
      errors.push('Preset name must be at least 3 characters long');
    }
    if (!/^[a-z0-9-_]+$/.test(name)) {
      errors.push('Preset name can only contain lowercase letters, numbers, hyphens, and underscores');
    }
    if (REMIX_PRESETS[name] || this.customPresets.has(name)) {
      errors.push('Preset name already exists');
    }
    
    // Display name validation
    if (!display_name || display_name.length < 3) {
      errors.push('Display name must be at least 3 characters long');
    }
    
    // Description validation
    if (!description || description.length < 10) {
      errors.push('Description must be at least 10 characters long');
    }
    
    // Created by validation
    if (!options.created_by) {
      errors.push('created_by field is required');
    }
    
    return errors;
  }
  
  private analyzeTripForCustomPreset(proposalData: ProposalData) {
    const destinations = proposalData.itinerary.destinations;
    const startDate = new Date(proposalData.trip_summary.start_date);
    const endDate = new Date(proposalData.trip_summary.end_date);
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const budget = proposalData.financials.total_cost;
    
    const primary_destination = destinations[0]?.destination || 'Unknown';
    
    // Analyze trip characteristics
    const is_luxury = budget > 5000 || destinations.some(d => 
      d.destination.toLowerCase().includes('luxury') ||
      d.destination.toLowerCase().includes('resort') ||
      d.destination.toLowerCase().includes('premium')
    );
    
    const is_business = proposalData.trip_summary.trip_type?.toLowerCase().includes('business') ||
                       duration <= 5;
                       
    const is_family = proposalData.trip_summary.trip_type?.toLowerCase().includes('family') ||
                     destinations.some(d => d.destination.toLowerCase().includes('family'));
                     
    const is_tech_destination = primary_destination.toLowerCase().includes('silicon valley') ||
                               primary_destination.toLowerCase().includes('tech') ||
                               primary_destination.toLowerCase().includes('innovation');
    
    return {
      primary_destination,
      duration,
      budget,
      is_luxury,
      is_business,
      is_family,
      is_tech_destination,
      destination_count: destinations.length
    };
  }
  
  private generateThemeSuggestions(analysis: any) {
    return {
      colors: [
        { scheme: 'professional-blue', reason: 'Versatile and professional for business contexts' },
        { scheme: 'luxury-gold', reason: analysis.is_luxury ? 'Premium feel for luxury experiences' : 'Adds elegance to any presentation' },
        { scheme: 'vibrant-teal', reason: analysis.is_tech_destination ? 'Modern and tech-forward' : 'Contemporary and engaging' },
        { scheme: 'sunset-orange', reason: analysis.is_family ? 'Warm and family-friendly' : 'Approachable and welcoming' }
      ],
      typography: [
        { style: 'corporate', reason: 'Clean and professional for business contexts' },
        { style: 'elegant', reason: analysis.is_luxury ? 'Sophisticated for premium experiences' : 'Refined and upscale feeling' },
        { style: 'modern', reason: analysis.duration < 7 ? 'Efficient for quick trips' : 'Contemporary and readable' }
      ],
      decorative: [
        { style: 'minimal-emoji', reason: 'Subtle visual enhancement without distraction' },
        { style: 'rich-emoji', reason: analysis.is_family ? 'Engaging for family presentations' : 'Adds visual interest and warmth' },
        { style: 'icons-only', reason: analysis.is_tech_destination ? 'Clean modern aesthetic' : 'Professional with visual elements' }
      ],
      layout: [
        { style: 'spacious', reason: 'Readable and professional for most contexts' },
        { style: 'magazine', reason: analysis.is_luxury ? 'Premium editorial feel' : 'Visually striking presentation' },
        { style: 'executive', reason: analysis.duration < 5 ? 'Streamlined for quick decisions' : 'Efficient summary format' }
      ]
    };
  }
  
  private analyzeThemeCompatibility(theme: ThemeRemix) {
    // Simplified compatibility analysis - in a real system this would be more sophisticated
    let color_compatibility = 1.0;
    let typography_compatibility = 1.0;
    let layout_compatibility = 1.0;
    let decorative_compatibility = 1.0;
    
    // Check for known incompatible combinations
    if (theme.colorScheme === 'minimal-gray' && theme.decorative === 'rich-emoji') {
      decorative_compatibility = 0.6; // Gray theme with rich decorations may clash
    }
    
    if (theme.typography === 'elegant' && theme.layout === 'executive') {
      typography_compatibility = 0.7; // Elegant fonts may not suit executive brevity
    }
    
    if (theme.layout === 'compact' && theme.decorative === 'rich-emoji') {
      layout_compatibility = 0.8; // Compact layout may not have space for rich decorations
    }
    
    return {
      color_compatibility,
      typography_compatibility,
      layout_compatibility,
      decorative_compatibility
    };
  }
  
  private initializePresetTemplates() {
    this.presetTemplates = [
      {
        name: 'Corporate Modern',
        description: 'Clean corporate aesthetic with modern touches',
        theme: {
          colorScheme: 'professional-blue',
          typography: 'modern',
          decorative: 'icons-only',
          layout: 'spacious'
        },
        suggested_use_cases: ['Corporate presentations', 'Business proposals', 'Professional meetings'],
        suggested_audience: ['corporate', 'executive'],
        customization_notes: ['Consider luxury-gold for premium clients', 'Switch to elegant typography for high-end presentations']
      },
      {
        name: 'Luxury Experience',
        description: 'Premium aesthetic for high-end travel experiences',
        theme: {
          colorScheme: 'luxury-gold',
          typography: 'elegant',
          decorative: 'minimal-emoji',
          layout: 'magazine'
        },
        suggested_use_cases: ['Luxury travel', 'Premium experiences', 'VIP clients'],
        suggested_audience: ['luxury', 'premium'],
        customization_notes: ['Rich-emoji can add warmth for leisure luxury', 'Corporate typography for business luxury']
      },
      {
        name: 'Family Adventure',
        description: 'Warm and approachable for family travel',
        theme: {
          colorScheme: 'sunset-orange',
          typography: 'modern',
          decorative: 'rich-emoji',
          layout: 'spacious'
        },
        suggested_use_cases: ['Family vacations', 'Group travel', 'Leisure trips'],
        suggested_audience: ['family', 'leisure'],
        customization_notes: ['Vibrant-teal for tech-savvy families', 'Minimal decorations for simpler presentations']
      }
    ];
  }
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

export const customPresetManager = new CustomPresetManager();

export default customPresetManager;