// ============================================================================
// Base Template Engine for Travel Proposals
// ============================================================================

import { ProposalData, ThemeRemix, TemplateOptions } from '../types';
import { ThemeEngine } from '../themes/theme-engine';

export interface TemplateComponent {
  name: string;
  render(data: any, context: TemplateContext): string;
  dependencies?: string[];
}

export interface TemplateContext {
  data: ProposalData;
  remix: ThemeRemix;
  theme: ThemeEngine;
  helpers: TemplateHelpers;
  options: TemplateOptions;
}

export interface TemplateHelpers {
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date) => string;
  formatDateRange: (start: string | Date, end: string | Date) => string;
  pluralize: (count: number, singular: string, plural?: string) => string;
  decorateSection: (title: string, level?: 'h1' | 'h2' | 'h3' | 'h4') => string;
  applyDecorative: (content: string, element: string) => string;
  generateStarRating: (rating: number) => string;
  formatPhone: (phone: string) => string;
  calculateNights: (checkin: string, checkout: string) => number;
  getHotelAmenities: (amenities: string[]) => string;
  safeDivide: (a: number, b: number, fallback?: number) => number;
}

export abstract class BaseTemplate {
  protected themeEngine: ThemeEngine;
  protected components: Map<string, TemplateComponent>;
  
  constructor() {
    this.themeEngine = new ThemeEngine();
    this.components = new Map();
    this.registerComponents();
  }
  
  abstract getTemplateName(): string;
  abstract getDescription(): string;
  abstract getSuitableFor(): string[];
  
  // Register all components for this template
  protected abstract registerComponents(): void;
  
  // Main render method
  async render(data: ProposalData, remix: ThemeRemix, options: TemplateOptions = {}): Promise<string> {
    const context = this.createContext(data, remix, options);
    
    try {
      const css = this.themeEngine.generateCSS(remix);
      const html = this.renderTemplate(context);
      
      return this.wrapInDocument(html, css, context);
      
    } catch (error) {
      console.error(`Error rendering template ${this.getTemplateName()}:`, error);
      return this.renderFallback(data, remix);
    }
  }
  
  // Create template context with helpers
  private createContext(data: ProposalData, remix: ThemeRemix, options: TemplateOptions): TemplateContext {
    return {
      data,
      remix,
      theme: this.themeEngine,
      options,
      helpers: {
        formatCurrency: (amount: number, currency: string = 'USD') => {
          return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency 
          }).format(amount);
        },
        
        formatDate: (date: string | Date) => {
          const d = date instanceof Date ? date : new Date(date);
          return d.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        },
        
        formatDateRange: (start: string | Date, end: string | Date) => {
          const startDate = start instanceof Date ? start : new Date(start);
          const endDate = end instanceof Date ? end : new Date(end);
          
          const startStr = startDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
          
          const endStr = endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          return `${startStr} - ${endStr}`;
        },
        
        pluralize: (count: number, singular: string, plural?: string) => {
          const word = count === 1 ? singular : (plural || singular + 's');
          return `${count} ${word}`;
        },
        
        decorateSection: (title: string, level: 'h1' | 'h2' | 'h3' | 'h4' = 'h3') => {
          return this.themeEngine.applyDecorative(title, 'section', remix.decorative);
        },
        
        applyDecorative: (content: string, element: string) => {
          return this.themeEngine.applyDecorative(content, element as any, remix.decorative);
        },
        
        generateStarRating: (rating: number) => {
          const stars = Math.floor(rating);
          const halfStar = rating % 1 >= 0.5;
          
          if (remix.decorative === 'none') {
            return `${rating}/5`;
          } else if (remix.decorative === 'icons-only') {
            return '★'.repeat(stars) + (halfStar ? '☆' : '');
          } else {
            return '⭐'.repeat(stars) + (halfStar ? '⭐' : '');
          }
        },
        
        formatPhone: (phone: string) => {
          // Simple US phone formatting
          const cleaned = phone.replace(/\D/g, '');
          if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
          }
          return phone;
        },
        
        calculateNights: (checkin: string, checkout: string) => {
          const start = new Date(checkin);
          const end = new Date(checkout);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },
        
        getHotelAmenities: (amenities: string[]) => {
          if (!amenities?.length) return '';
          
          if (remix.decorative === 'none') {
            return amenities.join(', ');
          } else if (remix.decorative === 'minimal-emoji') {
            return amenities.map(a => `• ${a}`).join('  ');
          } else if (remix.decorative === 'rich-emoji') {
            const emojiMap: Record<string, string> = {
              'WiFi': '📶',
              'Pool': '🏊',
              'Fitness': '💪',
              'Spa': '🧖',
              'Restaurant': '🍽️',
              'Bar': '🍸',
              'Parking': '🚗',
              'Pet Friendly': '🐕',
              'Beach Access': '🏖️',
              'Business Center': '💼'
            };
            
            return amenities.map(a => {
              const emoji = emojiMap[a] || '✨';
              return `${emoji} ${a}`;
            }).join('  ');
          }
          
          return amenities.join(', ');
        },
        
        safeDivide: (a: number, b: number, fallback: number = 0) => {
          return b !== 0 ? a / b : fallback;
        }
      }
    };
  }
  
  // Abstract method for template-specific rendering
  protected abstract renderTemplate(context: TemplateContext): string;
  
  // Wrap content in full HTML document
  protected wrapInDocument(html: string, css: string, context: TemplateContext): string {
    const { data, remix } = context;
    const tripName = data.trip_spec?.party_name || 'Travel Proposal';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tripName}</title>
  <style>${css}</style>
</head>
<body>
  <div class="proposal-container">
    ${html}
  </div>
</body>
</html>`;
  }
  
  // Fallback rendering for errors
  protected renderFallback(data: ProposalData, remix: ThemeRemix): string {
    const fallbackCSS = this.themeEngine.generatePreviewCSS(remix, false);
    const tripName = data.trip_spec?.party_name || 'Travel Proposal';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tripName}</title>
  <style>${fallbackCSS}</style>
</head>
<body>
  <div class="proposal-container">
    <header class="header">
      <h1>${tripName}</h1>
      <p>Error rendering proposal - using fallback template</p>
    </header>
    <main class="content">
      <div class="section">
        <h3>Trip Details</h3>
        <p>Please contact your travel advisor for complete proposal details.</p>
      </div>
    </main>
  </div>
</body>
</html>`;
  }
  
  // Register a component
  protected registerComponent(component: TemplateComponent): void {
    this.components.set(component.name, component);
  }
  
  // Get registered component
  protected getComponent(name: string): TemplateComponent | undefined {
    return this.components.get(name);
  }
  
  // Render a specific component
  protected renderComponent(name: string, data: any, context: TemplateContext): string {
    const component = this.getComponent(name);
    if (!component) {
      console.warn(`Component '${name}' not found`);
      return `<!-- Component '${name}' not found -->`;
    }
    
    try {
      return component.render(data, context);
    } catch (error) {
      console.error(`Error rendering component '${name}':`, error);
      return `<!-- Error rendering component '${name}' -->`;
    }
  }
}