// ============================================================================
// Theme Engine - Central Theme Management System
// ============================================================================

import { ThemeRemix } from '../types';
import { ColorPalette, getColorPalette, generateColorVariables } from './color-schemes';
import { TypographyConfig, getTypographyConfig, generateTypographyVariables, generateTypographyClasses, generateResponsiveTypography } from './typography';
import { DecorativeConfig, getDecorativeConfig, applyDecorative, decorateSection, generateIconStyles } from './decorative';
import { LayoutConfig, getLayoutConfig, generateLayoutVariables, generateLayoutClasses, generateResponsiveLayout, generatePrintLayout, generateLayoutUtilities } from './layout';
import { getPreset, getPresetInfo, PresetInfo } from './presets';

export class ThemeEngine {
  private cssCache: Map<string, string> = new Map();
  
  // Generate complete CSS for a theme combination
  generateCSS(remix: ThemeRemix): string {
    const cacheKey = this.getCacheKey(remix);
    
    // Return cached CSS if available
    if (this.cssCache.has(cacheKey)) {
      return this.cssCache.get(cacheKey)!;
    }
    
    try {
      // Get configurations
      const colorPalette = getColorPalette(remix.colorScheme);
      const typographyConfig = getTypographyConfig(remix.typography);
      const decorativeConfig = getDecorativeConfig(remix.decorative);
      const layoutConfig = getLayoutConfig(remix.layout);
      
      // Generate CSS sections
      const css = this.buildCompleteCSS({
        colorPalette,
        typographyConfig,
        decorativeConfig,
        layoutConfig,
        remix
      });
      
      // Cache the result
      this.cssCache.set(cacheKey, css);
      
      return css;
      
    } catch (error) {
      console.error('Error generating theme CSS:', error);
      // Return fallback CSS
      return this.generateFallbackCSS();
    }
  }
  
  // Apply decorative elements to content
  applyDecorative(content: string, element: keyof DecorativeConfig['emoji'], styleName: string): string {
    return applyDecorative(content, element, styleName);
  }
  
  // Get color palette for scheme
  getColorPalette(schemeName: string): ColorPalette {
    return getColorPalette(schemeName);
  }
  
  // Get typography configuration
  getTypography(styleName: string): TypographyConfig {
    return getTypographyConfig(styleName);
  }
  
  // Get layout configuration
  getLayout(styleName: string): LayoutConfig {
    return getLayoutConfig(styleName);
  }
  
  // Apply theme context to template data
  applyThemeContext(context: any, remix: ThemeRemix): any {
    const colorPalette = getColorPalette(remix.colorScheme);
    const decorativeConfig = getDecorativeConfig(remix.decorative);
    
    return {
      ...context,
      theme: {
        colors: colorPalette,
        decorative: decorativeConfig,
        remix: remix
      },
      // Helper functions available in templates
      helpers: {
        decorateSection: (title: string, level: 'h1' | 'h2' | 'h3' | 'h4' = 'h3') => 
          decorateSection(title, level, remix.decorative),
        applyDecorative: (content: string, element: keyof DecorativeConfig['emoji']) => 
          applyDecorative(content, element, remix.decorative),
        formatCurrency: (amount: number, currency: string = 'USD') => 
          new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
      }
    };
  }
  
  // Generate preview CSS for testing
  generatePreviewCSS(remix: ThemeRemix, includeLayout: boolean = true): string {
    try {
      const colorPalette = getColorPalette(remix.colorScheme);
      const typographyConfig = getTypographyConfig(remix.typography);
      const layoutConfig = includeLayout ? getLayoutConfig(remix.layout) : null;
      
      let css = `
        /* Theme Preview CSS */
        ${generateColorVariables(colorPalette)}
        ${generateTypographyVariables(typographyConfig)}
        ${layoutConfig ? generateLayoutVariables(layoutConfig) : ''}
        
        /* Base styling */
        body {
          font-family: var(--font-body);
          color: var(--text-color);
          background-color: var(--background-color);
          line-height: var(--line-height-normal);
        }
        
        .preview-card {
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: ${layoutConfig?.cards.borderRadius || '8px'};
          padding: ${layoutConfig?.cards.padding || '20px'};
          margin-bottom: ${layoutConfig?.spacing.component || '20px'};
          box-shadow: ${layoutConfig?.cards.shadow || '0 2px 4px rgba(0,0,0,0.1)'};
        }
        
        .preview-title {
          color: var(--primary-color);
          font-family: var(--font-heading);
          font-size: var(--font-size-h3);
          margin-bottom: ${layoutConfig?.spacing.item || '12px'};
        }
      `.trim();
      
      return css;
      
    } catch (error) {
      console.error('Error generating preview CSS:', error);
      return this.generateFallbackCSS();
    }
  }
  
  // Validate theme configuration
  validateTheme(remix: ThemeRemix): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate color scheme
    try {
      getColorPalette(remix.colorScheme);
    } catch (error) {
      errors.push(`Invalid color scheme: ${remix.colorScheme}`);
    }
    
    // Validate typography
    try {
      getTypographyConfig(remix.typography);
    } catch (error) {
      errors.push(`Invalid typography style: ${remix.typography}`);
    }
    
    // Validate decorative style
    try {
      getDecorativeConfig(remix.decorative);
    } catch (error) {
      errors.push(`Invalid decorative style: ${remix.decorative}`);
    }
    
    // Validate layout
    try {
      getLayoutConfig(remix.layout);
    } catch (error) {
      errors.push(`Invalid layout style: ${remix.layout}`);
    }
    
    // Check for potentially conflicting combinations
    if (remix.decorative === 'rich-emoji' && remix.layout === 'executive') {
      warnings.push('Rich emoji decorations may conflict with executive layout\'s minimal design');
    }
    
    if (remix.typography === 'elegant' && remix.decorative === 'icons-only') {
      warnings.push('Elegant typography with icons-only may create visual inconsistency');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Get theme statistics
  getThemeStats(): {
    colorSchemes: number;
    typographyStyles: number;
    decorativeStyles: number;
    layoutStyles: number;
    totalCombinations: number;
    cacheSize: number;
  } {
    return {
      colorSchemes: 5,
      typographyStyles: 4,
      decorativeStyles: 4,
      layoutStyles: 4,
      totalCombinations: 5 * 4 * 4 * 4, // 320 combinations
      cacheSize: this.cssCache.size
    };
  }
  
  // Clear CSS cache
  clearCache(): void {
    this.cssCache.clear();
  }
  
  // Get preset information
  getPresetInfo(presetName: string): PresetInfo {
    return getPresetInfo(presetName);
  }
  
  // Apply preset to get theme remix
  applyPreset(presetName: string): ThemeRemix {
    return getPreset(presetName);
  }
  
  // Private helper methods
  private buildCompleteCSS({
    colorPalette,
    typographyConfig,
    decorativeConfig,
    layoutConfig,
    remix
  }: {
    colorPalette: ColorPalette;
    typographyConfig: TypographyConfig;
    decorativeConfig: DecorativeConfig;
    layoutConfig: LayoutConfig;
    remix: ThemeRemix;
  }): string {
    return `
/* ============================================================================ */
/* Generated Theme CSS - ${remix.colorScheme}/${remix.typography}/${remix.decorative}/${remix.layout} */
/* ============================================================================ */

${generateColorVariables(colorPalette)}

${generateTypographyVariables(typographyConfig)}

${generateLayoutVariables(layoutConfig)}

/* Base Styles */
* { 
  margin: 0; 
  padding: 0; 
  box-sizing: border-box; 
}

body {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: var(--text-color);
  background: linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.secondary} 100%);
  min-height: 100vh;
  padding: var(--container-padding);
}

/* Typography Classes */
${generateTypographyClasses(typographyConfig)}

/* Layout Classes */
${generateLayoutClasses(layoutConfig)}

/* Icon Styles */
${generateIconStyles()}

/* Layout Utilities */
${generateLayoutUtilities(layoutConfig)}

/* Travel-Specific Components */
.proposal-container {
  background: var(--background-color);
  border-radius: var(--card-border-radius);
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  overflow: hidden;
  max-width: var(--container-max-width);
  margin: var(--container-margin);
}

.header {
  background: linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.secondary} 100%);
  color: white;
  padding: calc(var(--container-padding) * 1.5) var(--container-padding);
  text-align: center;
}

.header h1 {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-light);
  margin-bottom: var(--spacing-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.header h2 {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-regular);
  margin-bottom: var(--spacing-item);
  opacity: 0.95;
}

.trip-dates {
  font-size: var(--font-size-body);
  opacity: 0.9;
  margin-top: var(--spacing-tight);
}

.content { 
  padding: calc(var(--container-padding) * 1.2) var(--container-padding); 
}

.hotel {
  background: var(--hotel-card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--card-border-radius);
  margin-bottom: var(--spacing-component);
  padding: var(--card-padding);
  transition: all 0.3s ease;
}

.hotel:hover {
  box-shadow: var(--card-hover-shadow);
}

.hotel h4 {
  font-size: var(--font-size-h4);
  color: var(--secondary-color);
  margin-bottom: var(--spacing-item);
  font-weight: var(--font-weight-medium);
}

.price {
  font-weight: var(--font-weight-bold);
  color: var(--price-highlight);
  font-size: calc(var(--font-size-body) * 1.2);
}

.rating {
  color: var(--rating-color);
  font-size: var(--font-size-body);
}

.refundable-badge {
  display: inline-block;
  background: var(--refundable-bg);
  color: var(--success-color);
  padding: var(--spacing-tight) calc(var(--spacing-tight) * 2);
  border-radius: calc(var(--card-border-radius) / 2);
  font-size: var(--font-size-small);
  margin-top: var(--spacing-tight);
}

.commission-indicator {
  color: var(--commission-color);
  font-weight: var(--font-weight-bold);
  margin-left: var(--spacing-tight);
}

.amenities {
  margin-top: var(--spacing-item);
}

.amenity {
  display: inline-block;
  background: ${colorPalette.accent}20;
  color: ${colorPalette.primary};
  padding: calc(var(--spacing-tight) / 2) var(--spacing-tight);
  margin: calc(var(--spacing-tight) / 2) var(--spacing-tight) calc(var(--spacing-tight) / 2) 0;
  border-radius: calc(var(--card-border-radius) * 1.5);
  font-size: var(--font-size-small);
}

.summary {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--card-border-radius);
  padding: var(--card-padding);
  text-align: center;
}

.summary h3 {
  color: var(--primary-color);
  margin-bottom: var(--spacing-item);
  border: none;
  padding: 0;
}

.cost-amount {
  font-size: calc(var(--font-size-h3) * 1.2);
  font-weight: var(--font-weight-bold);
  color: var(--primary-color);
}

.footer {
  margin-top: var(--spacing-section);
  padding-top: var(--spacing-component);
  border-top: 1px solid var(--border-color);
  text-align: center;
  color: var(--text-light-color);
  font-size: var(--font-size-small);
}

/* Responsive Design */
${generateResponsiveLayout(layoutConfig)}

/* Responsive Typography */
${generateResponsiveTypography()}

/* Print Styles */
${generatePrintLayout()}

/* Theme-specific Adjustments */
${this.generateThemeSpecificCSS(remix, colorPalette)}
    `.trim();
  }
  
  private generateThemeSpecificCSS(remix: ThemeRemix, colorPalette: ColorPalette): string {
    let css = '';
    
    // Add theme-specific adjustments
    if (remix.colorScheme === 'luxury-gold') {
      css += `
        .header {
          background: linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.secondary} 100%);
        }
        .amenity {
          background: ${colorPalette.primary}15;
          border: 1px solid ${colorPalette.primary}30;
        }
      `;
    }
    
    if (remix.layout === 'executive') {
      css += `
        .header {
          padding: var(--container-padding);
        }
        .content {
          padding: var(--container-padding);
        }
      `;
    }
    
    if (remix.decorative === 'rich-emoji') {
      css += `
        .section h3::before {
          margin-right: var(--spacing-tight);
        }
      `;
    }
    
    return css;
  }
  
  private getCacheKey(remix: ThemeRemix): string {
    return `${remix.colorScheme}-${remix.typography}-${remix.decorative}-${remix.layout}`;
  }
  
  private generateFallbackCSS(): string {
    return `
      body {
        font-family: system-ui, sans-serif;
        color: #333;
        background: #fff;
        line-height: 1.6;
        padding: 20px;
      }
      .proposal-container {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 30px;
      }
      .header {
        background: #2a5aa0;
        color: white;
        padding: 30px;
        text-align: center;
        border-radius: 8px 8px 0 0;
        margin: -30px -30px 30px -30px;
      }
    `.trim();
  }
}