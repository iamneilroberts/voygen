// ============================================================================
// Template System - Central Registry and Exports
// ============================================================================

// Base template system
export { BaseTemplate, TemplateComponent, TemplateContext, TemplateHelpers } from './base-template';

// Core components
export { CORE_COMPONENTS } from './components';
export {
  HeaderComponent,
  HotelCardComponent,
  RoomDetailsComponent,
  FlightComponent,
  GroundTransportComponent,
  TourComponent,
  CostSummaryComponent,
  NextStepsComponent,
  FooterComponent
} from './components';

// Template implementations
export { DetailedTemplate } from './detailed-template';
export { CondensedTemplate } from './condensed-template';
export { FancyTemplate } from './fancy-template';
export { FunctionalTemplate } from './functional-template';

// Template registry and factory
import { DetailedTemplate } from './detailed-template';
import { CondensedTemplate } from './condensed-template';
import { FancyTemplate } from './fancy-template';
import { FunctionalTemplate } from './functional-template';
import { BaseTemplate } from './base-template';
import { ProposalData, ThemeRemix, TemplateOptions } from '../types';

export interface TemplateInfo {
  name: string;
  description: string;
  suitableFor: string[];
  class: new () => BaseTemplate;
}

export const TEMPLATE_REGISTRY: Record<string, TemplateInfo> = {
  detailed: {
    name: 'Detailed',
    description: 'Comprehensive template with full details, descriptions, and explanations. Perfect for luxury travel and complex itineraries.',
    suitableFor: [
      'Luxury travel proposals',
      'Complex multi-destination trips',
      'High-value bookings',
      'First-time clients needing full context',
      'Detailed vacation planning'
    ],
    class: DetailedTemplate
  },
  
  condensed: {
    name: 'Condensed',
    description: 'Executive summary format with key details only. Perfect for busy travelers who want essential information at a glance.',
    suitableFor: [
      'Executive travelers',
      'Quick decision making',
      'Simple trip proposals',
      'Repeat clients',
      'Mobile-first viewing'
    ],
    class: CondensedTemplate
  },
  
  fancy: {
    name: 'Fancy',
    description: 'Premium visual template with rich styling, elegant presentation, and immersive content. Perfect for luxury travel and special occasions.',
    suitableFor: [
      'Luxury travel experiences',
      'Honeymoon packages',
      'Anniversary trips',
      'VIP client presentations',
      'High-end leisure travel'
    ],
    class: FancyTemplate
  },
  
  functional: {
    name: 'Functional',
    description: 'Clean, information-focused template optimized for clarity and quick scanning. Perfect for straightforward travel proposals.',
    suitableFor: [
      'Business travel',
      'Budget-conscious travelers',
      'Simple itineraries',
      'Quick bookings',
      'Information-heavy proposals'
    ],
    class: FunctionalTemplate
  }
};

export class TemplateFactory {
  private templateCache: Map<string, BaseTemplate> = new Map();
  
  // Create template instance
  createTemplate(templateName: string): BaseTemplate {
    // Return cached instance if available
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }
    
    // Get template info
    const templateInfo = TEMPLATE_REGISTRY[templateName];
    if (!templateInfo) {
      console.warn(`Template '${templateName}' not found, falling back to 'detailed'`);
      return this.createTemplate('detailed');
    }
    
    // Create new instance
    const template = new templateInfo.class();
    
    // Cache the instance
    this.templateCache.set(templateName, template);
    
    return template;
  }
  
  // Get all available templates
  getAvailableTemplates(): Array<{ key: string; info: TemplateInfo }> {
    return Object.entries(TEMPLATE_REGISTRY).map(([key, info]) => ({
      key,
      info
    }));
  }
  
  // Get template info
  getTemplateInfo(templateName: string): TemplateInfo | undefined {
    return TEMPLATE_REGISTRY[templateName];
  }
  
  // Check if template exists
  hasTemplate(templateName: string): boolean {
    return templateName in TEMPLATE_REGISTRY;
  }
  
  // Render template with data
  async renderTemplate(
    templateName: string,
    data: ProposalData,
    remix: ThemeRemix,
    options: TemplateOptions = {}
  ): Promise<string> {
    const template = this.createTemplate(templateName);
    return await template.render(data, remix, options);
  }
  
  // Get template recommendations based on trip characteristics
  getRecommendedTemplates(tripCharacteristics: {
    luxury?: boolean;
    business?: boolean;
    simple?: boolean;
    detailed?: boolean;
    visual?: boolean;
  }): string[] {
    const recommendations: string[] = [];
    
    if (tripCharacteristics.luxury) {
      recommendations.push('fancy', 'detailed');
    }
    
    if (tripCharacteristics.business) {
      recommendations.push('condensed', 'functional');
    }
    
    if (tripCharacteristics.simple) {
      recommendations.push('functional', 'condensed');
    }
    
    if (tripCharacteristics.detailed) {
      recommendations.push('detailed', 'fancy');
    }
    
    if (tripCharacteristics.visual) {
      recommendations.push('fancy', 'detailed');
    }
    
    // Default recommendations if no characteristics specified
    if (recommendations.length === 0) {
      recommendations.push('detailed', 'condensed');
    }
    
    // Remove duplicates and return
    return [...new Set(recommendations)];
  }
  
  // Clear template cache
  clearCache(): void {
    this.templateCache.clear();
  }
  
  // Get template statistics
  getTemplateStats(): {
    totalTemplates: number;
    cachedInstances: number;
    availableTemplates: string[];
  } {
    return {
      totalTemplates: Object.keys(TEMPLATE_REGISTRY).length,
      cachedInstances: this.templateCache.size,
      availableTemplates: Object.keys(TEMPLATE_REGISTRY)
    };
  }
}

// Default factory instance
export const templateFactory = new TemplateFactory();

// Convenience function to render any template
export async function renderTemplate(
  templateName: string,
  data: ProposalData,
  remix: ThemeRemix,
  options: TemplateOptions = {}
): Promise<string> {
  return await templateFactory.renderTemplate(templateName, data, remix, options);
}

// Convenience function to get template info
export function getTemplateInfo(templateName: string): TemplateInfo | undefined {
  return templateFactory.getTemplateInfo(templateName);
}

// Convenience function to get all templates
export function getAllTemplates(): Array<{ key: string; info: TemplateInfo }> {
  return templateFactory.getAvailableTemplates();
}

// Template validation helper
export function validateTemplate(templateName: string): { valid: boolean; error?: string } {
  if (!templateFactory.hasTemplate(templateName)) {
    return {
      valid: false,
      error: `Template '${templateName}' not found. Available templates: ${Object.keys(TEMPLATE_REGISTRY).join(', ')}`
    };
  }
  
  return { valid: true };
}

// Template compatibility helper
export function getTemplatePresetCompatibility(): Record<string, string[]> {
  return {
    detailed: ['professional', 'luxury', 'friendly'],
    condensed: ['executive', 'professional', 'modern'],
    fancy: ['luxury', 'friendly', 'professional'],
    functional: ['modern', 'executive', 'professional']
  };
}

// Summary for documentation
export const TEMPLATE_SYSTEM_SUMMARY = {
  totalTemplates: Object.keys(TEMPLATE_REGISTRY).length,
  templateNames: Object.keys(TEMPLATE_REGISTRY),
  components: [
    'HeaderComponent',
    'HotelCardComponent', 
    'RoomDetailsComponent',
    'FlightComponent',
    'GroundTransportComponent',
    'TourComponent',
    'CostSummaryComponent',
    'NextStepsComponent',
    'FooterComponent'
  ],
  features: [
    'Modular component architecture',
    'Theme-aware rendering',
    'Template caching system',
    'Responsive HTML output',
    'Template recommendation engine',
    'Comprehensive error handling'
  ]
};