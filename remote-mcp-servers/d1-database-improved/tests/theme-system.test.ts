/**
 * Test Suite for Theme System - TASK-0041 Component
 * 
 * Tests the theme remix system with multiple color schemes,
 * typography options, and decorative styles.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ThemeEngine } from '../src/render/themes/theme-engine';
import { ThemeRemix } from '../src/render/types';

describe('Theme System Tests', () => {
  let themeEngine: ThemeEngine;

  beforeAll(() => {
    themeEngine = new ThemeEngine();
  });

  describe('Theme Configuration', () => {
    const validThemes: ThemeRemix[] = [
      {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      },
      {
        colorScheme: 'luxury-gold',
        typography: 'elegant',
        decorative: 'none',
        layout: 'immersive'
      },
      {
        colorScheme: 'executive',
        typography: 'clean',
        decorative: 'minimal-emoji',
        layout: 'efficient'
      },
      {
        colorScheme: 'friendly',
        typography: 'relaxed',
        decorative: 'moderate',
        layout: 'comfortable'
      },
      {
        colorScheme: 'modern',
        typography: 'bold',
        decorative: 'geometric',
        layout: 'dynamic'
      }
    ];

    validThemes.forEach(theme => {
      it(`should validate ${theme.colorScheme} theme configuration`, () => {
        const validation = themeEngine.validateTheme(theme);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toBeUndefined();
      });
    });

    it('should provide theme statistics', () => {
      const stats = themeEngine.getThemeStats();
      expect(stats.totalCombinations).toBeGreaterThan(100); // 5+ color schemes × 4+ typography × 4+ decorative × 4+ layout
      expect(stats.colorSchemes.length).toBeGreaterThanOrEqual(5);
      expect(stats.typographyOptions.length).toBeGreaterThanOrEqual(4);
      expect(stats.decorativeStyles.length).toBeGreaterThanOrEqual(4);
      expect(stats.layoutOptions.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('CSS Generation', () => {
    const testTheme: ThemeRemix = {
      colorScheme: 'professional-blue',
      typography: 'corporate',
      decorative: 'minimal-emoji', 
      layout: 'spacious'
    };

    it('should generate CSS variables for color scheme', () => {
      const css = themeEngine.generateThemeCSS(testTheme);
      
      expect(css).toContain('--primary-color');
      expect(css).toContain('--secondary-color');
      expect(css).toContain('--accent-color');
      expect(css).toContain('--background-color');
      expect(css).toContain('--text-color');
    });

    it('should generate typography styles', () => {
      const css = themeEngine.generateThemeCSS(testTheme);
      
      expect(css).toContain('--font-family-primary');
      expect(css).toContain('--font-family-secondary');
      expect(css).toContain('--font-size-base');
      expect(css).toContain('--line-height');
    });

    it('should generate layout styles', () => {
      const css = themeEngine.generateThemeCSS(testTheme);
      
      expect(css).toContain('--container-max-width');
      expect(css).toContain('--spacing-unit');
      expect(css).toContain('--border-radius');
    });

    it('should include decorative elements', () => {
      const luxuryTheme: ThemeRemix = {
        colorScheme: 'luxury-gold',
        typography: 'elegant',
        decorative: 'none',
        layout: 'immersive'
      };

      const css = themeEngine.generateThemeCSS(luxuryTheme);
      
      expect(css).toContain('--decoration-intensity');
      expect(css).toContain('box-shadow');
    });
  });

  describe('Theme Combination Logic', () => {
    it('should handle all possible theme combinations', () => {
      const stats = themeEngine.getThemeStats();
      const expectedCombinations = stats.colorSchemes.length * 
                                   stats.typographyOptions.length * 
                                   stats.decorativeStyles.length * 
                                   stats.layoutOptions.length;
      
      expect(stats.totalCombinations).toBe(expectedCombinations);
    });

    it('should generate unique CSS for different combinations', () => {
      const theme1: ThemeRemix = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      };

      const theme2: ThemeRemix = {
        colorScheme: 'luxury-gold',
        typography: 'elegant', 
        decorative: 'none',
        layout: 'immersive'
      };

      const css1 = themeEngine.generateThemeCSS(theme1);
      const css2 = themeEngine.generateThemeCSS(theme2);

      expect(css1).not.toBe(css2);
    });
  });

  describe('Responsive Theme Support', () => {
    it('should generate mobile-responsive theme CSS', () => {
      const theme: ThemeRemix = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      };

      const css = themeEngine.generateThemeCSS(theme, { responsive: true });
      
      expect(css).toMatch(/@media.*max-width.*768px/);
      expect(css).toMatch(/@media.*max-width.*480px/);
    });

    it('should adjust typography for mobile', () => {
      const theme: ThemeRemix = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      };

      const css = themeEngine.generateThemeCSS(theme, { responsive: true });
      
      expect(css).toContain('--font-size-mobile');
      expect(css).toContain('--line-height-mobile');
    });
  });

  describe('Theme Validation', () => {
    it('should reject invalid color schemes', () => {
      const invalidTheme = {
        colorScheme: 'invalid_color',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      } as ThemeRemix;

      const validation = themeEngine.validateTheme(invalidTheme);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid color scheme: invalid_color');
    });

    it('should reject invalid typography', () => {
      const invalidTheme = {
        colorScheme: 'professional-blue',
        typography: 'invalid_typography',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      } as ThemeRemix;

      const validation = themeEngine.validateTheme(invalidTheme);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid typography: invalid_typography');
    });

    it('should reject invalid decorative style', () => {
      const invalidTheme = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'invalid_decorative',
        layout: 'spacious'
      } as ThemeRemix;

      const validation = themeEngine.validateTheme(invalidTheme);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid decorative style: invalid_decorative');
    });

    it('should reject invalid layout', () => {
      const invalidTheme = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'invalid_layout'
      } as ThemeRemix;

      const validation = themeEngine.validateTheme(invalidTheme);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid layout: invalid_layout');
    });
  });

  describe('Theme Presets', () => {
    it('should provide predefined theme presets', () => {
      const presets = themeEngine.getThemePresets();
      
      expect(presets.professional).toBeDefined();
      expect(presets.luxury).toBeDefined();
      expect(presets.executive).toBeDefined();
      expect(presets.friendly).toBeDefined();
      expect(presets.modern).toBeDefined();
    });

    it('should validate all predefined presets', () => {
      const presets = themeEngine.getThemePresets();
      
      Object.values(presets).forEach(preset => {
        const validation = themeEngine.validateTheme(preset);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('Dark Mode Support', () => {
    it('should generate dark mode variants', () => {
      const theme: ThemeRemix = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      };

      const css = themeEngine.generateThemeCSS(theme, { darkMode: true });
      
      expect(css).toContain('@media (prefers-color-scheme: dark)');
      expect(css).toContain('--background-color-dark');
      expect(css).toContain('--text-color-dark');
    });
  });

  describe('Print-Friendly Styles', () => {
    it('should generate print-optimized CSS', () => {
      const theme: ThemeRemix = {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'minimal-emoji',
        layout: 'spacious'
      };

      const css = themeEngine.generateThemeCSS(theme, { printOptimized: true });
      
      expect(css).toContain('@media print');
      expect(css).toContain('color: black');
      expect(css).toContain('background: white');
    });
  });
});