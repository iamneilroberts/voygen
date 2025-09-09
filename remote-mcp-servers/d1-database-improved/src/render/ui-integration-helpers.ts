// ============================================================================
// UI Integration Helpers - Frontend Integration Support for Remix System
// ============================================================================

import { ProposalData, ThemeRemix, ProposalRemix } from './types';
import { PRESET_INFO } from './themes/presets';
import { presetUIIntegration } from './preset-ui-integration';
import { customPresetManager } from './custom-preset-manager';
import { presetAnalyticsManager } from './preset-analytics';
import { remixSystem } from './remix-system';

// ============================================================================
// Frontend Component Integration Types
// ============================================================================

export interface ComponentIntegrationConfig {
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla';
  typescript: boolean;
  styling_approach: 'css-modules' | 'styled-components' | 'tailwind' | 'scss' | 'css';
  state_management: 'redux' | 'zustand' | 'vuex' | 'pinia' | 'context' | 'none';
  ui_library?: 'mui' | 'antd' | 'chakra' | 'mantine' | 'headless' | 'custom';
}

export interface PresetSelectorConfig {
  show_previews: boolean;
  allow_customization: boolean;
  enable_search: boolean;
  enable_filtering: boolean;
  default_view: 'grid' | 'list' | 'carousel';
  categories_to_show: ('business' | 'luxury' | 'modern' | 'family')[];
  max_presets_per_page: number;
  enable_favorites: boolean;
  show_ratings: boolean;
  show_usage_stats: boolean;
}

export interface PresetCustomizationConfig {
  allow_color_changes: boolean;
  allow_typography_changes: boolean;
  allow_layout_changes: boolean;
  allow_decorative_changes: boolean;
  show_live_preview: boolean;
  enable_preset_saving: boolean;
  validation_level: 'strict' | 'moderate' | 'permissive';
  show_compatibility_warnings: boolean;
}

export interface AnalyticsDashboardConfig {
  show_usage_metrics: boolean;
  show_performance_metrics: boolean;
  show_user_feedback: boolean;
  show_trending_presets: boolean;
  enable_ab_testing: boolean;
  refresh_interval_minutes: number;
  export_formats: ('json' | 'csv' | 'pdf')[];
}

// ============================================================================
// Component Generation Templates
// ============================================================================

export interface ComponentTemplate {
  name: string;
  framework: string;
  description: string;
  props_interface?: string;
  component_code: string;
  styling_code?: string;
  hooks_code?: string;
  types_code?: string;
  dependencies: string[];
  usage_example: string;
}

export interface APIIntegrationTemplate {
  name: string;
  description: string;
  client_code: string;
  types_code: string;
  hooks_code?: string;
  utils_code?: string;
  dependencies: string[];
  usage_example: string;
}

// ============================================================================
// UI Integration Helpers Class
// ============================================================================

export class UIIntegrationHelpers {
  
  // ============================================================================
  // Component Template Generation
  // ============================================================================
  
  // Generate preset selector component
  generatePresetSelectorComponent(
    framework: ComponentIntegrationConfig['framework'],
    config: PresetSelectorConfig
  ): ComponentTemplate {
    
    switch (framework) {
      case 'react':
        return this.generateReactPresetSelector(config);
      case 'vue':
        return this.generateVuePresetSelector(config);
      default:
        throw new Error(`Framework ${framework} not supported yet`);
    }
  }
  
  // Generate preset customization component
  generatePresetCustomizationComponent(
    framework: ComponentIntegrationConfig['framework'],
    config: PresetCustomizationConfig
  ): ComponentTemplate {
    
    switch (framework) {
      case 'react':
        return this.generateReactPresetCustomization(config);
      case 'vue':
        return this.generateVuePresetCustomization(config);
      default:
        throw new Error(`Framework ${framework} not supported yet`);
    }
  }
  
  // Generate analytics dashboard component
  generateAnalyticsDashboardComponent(
    framework: ComponentIntegrationConfig['framework'],
    config: AnalyticsDashboardConfig
  ): ComponentTemplate {
    
    switch (framework) {
      case 'react':
        return this.generateReactAnalyticsDashboard(config);
      default:
        throw new Error(`Framework ${framework} not supported yet`);
    }
  }
  
  // ============================================================================
  // API Integration Templates
  // ============================================================================
  
  // Generate API client for preset operations
  generateAPIClient(framework: ComponentIntegrationConfig['framework']): APIIntegrationTemplate {
    const clientCode = `
// API Client for Preset System
class PresetAPIClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  // Get all presets with gallery information
  async getPresetGallery(includeCustomization: boolean = true) {
    const response = await fetch(\`\${this.baseUrl}/get-preset-gallery\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_customization_showcase: includeCustomization })
    });
    return response.json();
  }
  
  // Get UI-optimized recommendations for a trip
  async getPresetRecommendationsUI(tripId: string) {
    const response = await fetch(\`\${this.baseUrl}/get-preset-recommendations-ui\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId })
    });
    return response.json();
  }
  
  // Generate proposal from preset
  async generateFromPreset(tripId: string, preset: string, template?: string) {
    const response = await fetch(\`\${this.baseUrl}/generate-from-preset\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        trip_id: tripId,
        preset,
        template,
        options: { include_images: true, optimize_for_mobile: false }
      })
    });
    return response.json();
  }
  
  // Generate quick remix
  async generateQuickRemix(tripId: string, quickOptions: any) {
    const response = await fetch(\`\${this.baseUrl}/quick-remix\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, ...quickOptions })
    });
    return response.json();
  }
  
  // Create custom preset
  async createCustomPreset(presetData: any) {
    const response = await fetch(\`\${this.baseUrl}/create-custom-preset\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presetData)
    });
    return response.json();
  }
  
  // Record preset usage for analytics
  async recordPresetUsage(usageData: any) {
    const response = await fetch(\`\${this.baseUrl}/record-preset-usage\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usageData)
    });
    return response.json();
  }
  
  // Get preset analytics
  async getPresetAnalytics(presetName: string) {
    const response = await fetch(\`\${this.baseUrl}/get-preset-analytics\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset_name: presetName })
    });
    return response.json();
  }
}

export default PresetAPIClient;
`;

    const typesCode = `
// TypeScript types for Preset API
export interface PresetGalleryResponse {
  success: boolean;
  gallery: {
    featured_presets: PresetPreview[];
    category_groups: {
      business: PresetPreview[];
      luxury: PresetPreview[];
      modern: PresetPreview[];
      family: PresetPreview[];
    };
    customization_showcase: any;
  };
  total_presets: number;
}

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
}

export interface PresetRecommendation {
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
`;

    const hooksCode = framework === 'react' ? `
// React hooks for preset operations
import { useState, useEffect, useCallback } from 'react';
import { PresetAPIClient } from './preset-api-client';

export function usePresetGallery(apiClient: PresetAPIClient) {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadGallery();
  }, []);
  
  const loadGallery = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPresetGallery();
      if (response.success) {
        setGallery(response.gallery);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);
  
  return { gallery, loading, error, reload: loadGallery };
}

export function usePresetRecommendations(apiClient: PresetAPIClient, tripId: string) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (tripId) {
      loadRecommendations();
    }
  }, [tripId]);
  
  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPresetRecommendationsUI(tripId);
      if (response.success) {
        setRecommendations(response.recommendations);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, tripId]);
  
  return { recommendations, loading, error, reload: loadRecommendations };
}

export function usePresetGeneration(apiClient: PresetAPIClient) {
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  
  const generateFromPreset = useCallback(async (tripId: string, preset: string, template?: string) => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await apiClient.generateFromPreset(tripId, preset, template);
      
      if (response.success) {
        setLastResult(response);
        
        // Record usage for analytics
        await apiClient.recordPresetUsage({
          preset_name: preset,
          preset_type: 'built_in',
          user_id: 'current-user-id', // Would get from auth context
          session_id: 'current-session-id',
          context: {
            trip_id: tripId,
            template_used: template || response.template,
            generation_time_ms: Date.now(), // Would track actual time
            success: true
          },
          performance_metrics: {
            generation_time: Date.now(), // Would measure actual time
            cache_hit: false, // Would get from response
            template_compatibility_score: 1.0,
            theme_consistency_score: 1.0
          }
        });
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [apiClient]);
  
  return { generateFromPreset, generating, lastResult, error };
}
` : '';

    return {
      name: 'Preset API Client',
      description: 'Complete API client for preset system integration',
      client_code: clientCode,
      types_code: typesCode,
      hooks_code: hooksCode,
      dependencies: ['fetch API or axios'],
      usage_example: `
const apiClient = new PresetAPIClient('https://api.yourapp.com');
const gallery = await apiClient.getPresetGallery();
console.log('Available presets:', gallery.featured_presets);
`
    };
  }
  
  // ============================================================================
  // Configuration Helpers
  // ============================================================================
  
  // Generate optimal configuration for a specific use case
  generateOptimalConfig(useCase: 'travel_agency' | 'enterprise' | 'self_service' | 'white_label'): {
    preset_selector: PresetSelectorConfig;
    customization: PresetCustomizationConfig;
    analytics: AnalyticsDashboardConfig;
    recommendations: string[];
  } {
    
    switch (useCase) {
      case 'travel_agency':
        return {
          preset_selector: {
            show_previews: true,
            allow_customization: true,
            enable_search: true,
            enable_filtering: true,
            default_view: 'grid',
            categories_to_show: ['business', 'luxury', 'modern', 'family'],
            max_presets_per_page: 12,
            enable_favorites: true,
            show_ratings: true,
            show_usage_stats: true
          },
          customization: {
            allow_color_changes: true,
            allow_typography_changes: true,
            allow_layout_changes: false, // Keep layouts consistent
            allow_decorative_changes: true,
            show_live_preview: true,
            enable_preset_saving: true,
            validation_level: 'moderate',
            show_compatibility_warnings: true
          },
          analytics: {
            show_usage_metrics: true,
            show_performance_metrics: true,
            show_user_feedback: true,
            show_trending_presets: true,
            enable_ab_testing: true,
            refresh_interval_minutes: 15,
            export_formats: ['json', 'csv', 'pdf']
          },
          recommendations: [
            'Enable client branding options for white-label proposals',
            'Integrate with CRM for automatic client type detection',
            'Add preset recommendations based on destination type',
            'Implement approval workflows for custom presets'
          ]
        };
        
      case 'enterprise':
        return {
          preset_selector: {
            show_previews: true,
            allow_customization: false, // Strict brand consistency
            enable_search: true,
            enable_filtering: true,
            default_view: 'list',
            categories_to_show: ['business'],
            max_presets_per_page: 8,
            enable_favorites: false,
            show_ratings: false,
            show_usage_stats: false
          },
          customization: {
            allow_color_changes: false, // Brand consistency
            allow_typography_changes: false,
            allow_layout_changes: false,
            allow_decorative_changes: false,
            show_live_preview: true,
            enable_preset_saving: false,
            validation_level: 'strict',
            show_compatibility_warnings: true
          },
          analytics: {
            show_usage_metrics: true,
            show_performance_metrics: true,
            show_user_feedback: false,
            show_trending_presets: false,
            enable_ab_testing: false,
            refresh_interval_minutes: 30,
            export_formats: ['json', 'csv']
          },
          recommendations: [
            'Create enterprise-specific preset templates',
            'Integrate with corporate design systems',
            'Add compliance and approval workflows',
            'Implement role-based access controls'
          ]
        };
        
      case 'self_service':
        return {
          preset_selector: {
            show_previews: true,
            allow_customization: true,
            enable_search: true,
            enable_filtering: true,
            default_view: 'carousel',
            categories_to_show: ['modern', 'family'],
            max_presets_per_page: 6,
            enable_favorites: true,
            show_ratings: true,
            show_usage_stats: false
          },
          customization: {
            allow_color_changes: true,
            allow_typography_changes: false, // Simplified for non-experts
            allow_layout_changes: false,
            allow_decorative_changes: true,
            show_live_preview: true,
            enable_preset_saving: true,
            validation_level: 'permissive',
            show_compatibility_warnings: false
          },
          analytics: {
            show_usage_metrics: false,
            show_performance_metrics: false,
            show_user_feedback: false,
            show_trending_presets: true,
            enable_ab_testing: false,
            refresh_interval_minutes: 60,
            export_formats: ['json']
          },
          recommendations: [
            'Add guided preset selection wizard',
            'Include helpful tooltips and explanations',
            'Provide preset recommendations based on trip type',
            'Add one-click preset application'
          ]
        };
        
      default:
        throw new Error(`Use case ${useCase} not supported`);
    }
  }
  
  // ============================================================================
  // Accessibility Helpers
  // ============================================================================
  
  // Generate accessibility-compliant component props
  generateAccessibilityProps(componentType: 'preset_selector' | 'customization_panel' | 'analytics_dashboard'): {
    aria_labels: Record<string, string>;
    keyboard_shortcuts: Array<{ key: string; action: string; description: string }>;
    color_contrast_requirements: string[];
    screen_reader_descriptions: Record<string, string>;
  } {
    
    switch (componentType) {
      case 'preset_selector':
        return {
          aria_labels: {
            preset_grid: 'Preset selection grid',
            preset_item: 'Preset option: {preset_name}',
            preview_button: 'Preview {preset_name}',
            select_button: 'Select {preset_name} preset',
            filter_button: 'Filter presets',
            search_input: 'Search presets by name or description'
          },
          keyboard_shortcuts: [
            { key: 'Arrow Keys', action: 'Navigate presets', description: 'Use arrow keys to navigate between preset options' },
            { key: 'Enter/Space', action: 'Select preset', description: 'Press Enter or Space to select the focused preset' },
            { key: 'Escape', action: 'Close preview', description: 'Press Escape to close preset preview modal' },
            { key: 'Tab', action: 'Navigate controls', description: 'Tab through preset options and controls' }
          ],
          color_contrast_requirements: [
            'Preset titles must have 4.5:1 contrast ratio against background',
            'Selection indicators must have 3:1 contrast ratio',
            'Color swatches should have accessible labels, not rely on color alone'
          ],
          screen_reader_descriptions: {
            preset_info: 'Preset {name}: {description}. Recommended for {use_cases}. Compatibility score: {score}',
            color_swatch: 'Color scheme: {scheme_name}',
            rating: 'User rating: {rating} out of 5 stars based on {count} reviews'
          }
        };
        
      default:
        return {
          aria_labels: {},
          keyboard_shortcuts: [],
          color_contrast_requirements: [],
          screen_reader_descriptions: {}
        };
    }
  }
  
  // ============================================================================
  // Private Component Generation Methods
  // ============================================================================
  
  private generateReactPresetSelector(config: PresetSelectorConfig): ComponentTemplate {
    const componentCode = `
import React, { useState, useEffect } from 'react';
import { PresetAPIClient, PresetPreview } from './preset-api-client';
import './PresetSelector.css';

interface PresetSelectorProps {
  apiClient: PresetAPIClient;
  onPresetSelect: (presetKey: string) => void;
  selectedPreset?: string;
  tripId?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  apiClient,
  onPresetSelect,
  selectedPreset,
  tripId
}) => {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('${config.default_view}');
  
  useEffect(() => {
    loadGallery();
  }, []);
  
  const loadGallery = async () => {
    try {
      const response = await apiClient.getPresetGallery(${config.allow_customization});
      if (response.success) {
        setGallery(response.gallery);
      }
    } catch (error) {
      console.error('Failed to load preset gallery:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredPresets = gallery?.featured_presets?.filter(preset => {
    const matchesSearch = preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         preset.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           preset.compatibility_info.client_types.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  }) || [];
  
  if (loading) {
    return <div className="preset-selector-loading">Loading presets...</div>;
  }
  
  return (
    <div className="preset-selector">
      {${config.enable_search} && (
        <div className="preset-search">
          <input
            type="text"
            placeholder="Search presets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search presets by name or description"
          />
        </div>
      )}
      
      {${config.enable_filtering} && (
        <div className="preset-filters">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter presets by category"
          >
            <option value="all">All Categories</option>
            ${config.categories_to_show.map(cat => 
              `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`
            ).join('\n            ')}
          </select>
        </div>
      )}
      
      <div className={\`preset-grid preset-grid-\${viewMode}\`}>
        {filteredPresets.slice(0, ${config.max_presets_per_page}).map(preset => (
          <div
            key={preset.preset_key}
            className={\`preset-card \${selectedPreset === preset.preset_key ? 'selected' : ''}\`}
            onClick={() => onPresetSelect(preset.preset_key)}
            role="button"
            tabIndex={0}
            aria-label={\`Select \${preset.name} preset\`}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onPresetSelect(preset.preset_key);
              }
            }}
          >
            {${config.show_previews} && (
              <div className="preset-preview">
                <div
                  className="color-swatch"
                  style={{ backgroundColor: preset.visual_preview.color_swatch }}
                  aria-label={\`Color scheme: \${preset.visual_preview.color_swatch}\`}
                />
                <div className="typography-sample">
                  {preset.visual_preview.typography_sample}
                </div>
                {preset.visual_preview.decorative_elements.length > 0 && (
                  <div className="decorative-elements">
                    {preset.visual_preview.decorative_elements.slice(0, 3).join(' ')}
                  </div>
                )}
              </div>
            )}
            
            <div className="preset-info">
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
              
              <div className="preset-tags">
                {preset.compatibility_info.use_case_tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
              
              <div className="template-compatibility">
                <small>Best with: {preset.compatibility_info.best_templates.join(', ')}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresetSelector;
`;

    const stylingCode = `
/* PresetSelector.css */
.preset-selector {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.preset-search {
  margin-bottom: 20px;
}

.preset-search input {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.preset-search input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.preset-filters {
  margin-bottom: 20px;
}

.preset-filters select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.preset-grid {
  display: grid;
  gap: 20px;
}

.preset-grid-grid {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.preset-grid-list {
  grid-template-columns: 1fr;
}

.preset-grid-carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 20px;
  padding-bottom: 10px;
}

.preset-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 280px;
}

.preset-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.preset-card.selected {
  border-color: #2563eb;
  background: #f8fafc;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.preset-card:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.preset-preview {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
}

.typography-sample {
  font-size: 14px;
  color: #6b7280;
  flex: 1;
}

.decorative-elements {
  font-size: 16px;
}

.preset-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.preset-info p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.tag {
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
}

.template-compatibility {
  font-size: 12px;
  color: #9ca3af;
}

.preset-selector-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 16px;
  color: #6b7280;
}

/* Responsive design */
@media (max-width: 768px) {
  .preset-grid-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
  
  .preset-card {
    min-height: 240px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .preset-card {
    border-color: #000;
  }
  
  .preset-card:hover,
  .preset-card.selected {
    border-color: #0066cc;
    border-width: 3px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .preset-card {
    transition: none;
  }
  
  .preset-card:hover {
    transform: none;
  }
}
`;

    return {
      name: 'React Preset Selector',
      framework: 'react',
      description: 'Accessible preset selection component with search, filtering, and preview capabilities',
      component_code: componentCode,
      styling_code: stylingCode,
      dependencies: ['react', 'react-dom'],
      usage_example: `
import { PresetSelector } from './components/PresetSelector';
import { PresetAPIClient } from './api/preset-api-client';

const apiClient = new PresetAPIClient('https://api.yourapp.com');

function App() {
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  return (
    <PresetSelector
      apiClient={apiClient}
      onPresetSelect={setSelectedPreset}
      selectedPreset={selectedPreset}
      tripId="trip-123"
    />
  );
}
`
    };
  }
  
  private generateVuePresetSelector(config: PresetSelectorConfig): ComponentTemplate {
    // Vue implementation would go here
    return {
      name: 'Vue Preset Selector',
      framework: 'vue',
      description: 'Vue.js preset selector component',
      component_code: '// Vue implementation placeholder',
      dependencies: ['vue'],
      usage_example: '// Vue usage example'
    };
  }
  
  private generateReactPresetCustomization(config: PresetCustomizationConfig): ComponentTemplate {
    // React customization component implementation
    return {
      name: 'React Preset Customization',
      framework: 'react',
      description: 'Preset customization panel with live preview',
      component_code: '// React customization implementation placeholder',
      dependencies: ['react'],
      usage_example: '// React customization usage example'
    };
  }
  
  private generateVuePresetCustomization(config: PresetCustomizationConfig): ComponentTemplate {
    // Vue customization implementation
    return {
      name: 'Vue Preset Customization',
      framework: 'vue',
      description: 'Vue preset customization component',
      component_code: '// Vue customization implementation placeholder',
      dependencies: ['vue'],
      usage_example: '// Vue customization usage example'
    };
  }
  
  private generateReactAnalyticsDashboard(config: AnalyticsDashboardConfig): ComponentTemplate {
    // React analytics dashboard implementation
    return {
      name: 'React Analytics Dashboard',
      framework: 'react',
      description: 'Analytics dashboard for preset performance tracking',
      component_code: '// React analytics dashboard implementation placeholder',
      dependencies: ['react', 'chart.js'],
      usage_example: '// React analytics dashboard usage example'
    };
  }
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

export const uiIntegrationHelpers = new UIIntegrationHelpers();

export default uiIntegrationHelpers;