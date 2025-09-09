// ============================================================================
// Theme System - Central Export Hub
// ============================================================================

// Main Theme Engine
import { ThemeEngine as TE } from './theme-engine';
export { TE as ThemeEngine };

// Import for internal use in createThemeSystem
import { REMIX_PRESETS as RP } from './presets';
import { COLOR_SCHEMES as CS } from './color-schemes';

// Color System
export {
  ColorPalette,
  COLOR_SCHEMES,
  getColorPalette,
  generateColorVariables,
  getContrastingTextColor,
  generateStateVariants
} from './color-schemes';

// Typography System
export {
  TypographyConfig,
  TYPOGRAPHY_STYLES,
  getTypographyConfig,
  generateTypographyVariables,
  generateTypographyClasses,
  generateResponsiveTypography
} from './typography';

// Decorative Elements System
export {
  DecorativeConfig,
  DECORATIVE_STYLES,
  getDecorativeConfig,
  applyDecorative,
  decorateSection,
  decorateListItem,
  getSeparator,
  generateIconStyles,
  decorateAmenities,
  generateStarRating,
  formatCurrencyWithDecoration,
  decorateCheckItem
} from './decorative';

// Layout System
export {
  LayoutConfig,
  LAYOUT_STYLES,
  getLayoutConfig,
  generateLayoutVariables,
  generateLayoutClasses,
  generateResponsiveLayout,
  generatePrintLayout,
  generateLayoutUtilities,
  getSpacing,
  getGridConfig
} from './layout';

// Preset System
export {
  PresetInfo,
  REMIX_PRESETS,
  PRESET_INFO,
  PRESET_SUMMARY,
  getPreset,
  getPresetInfo,
  getAllPresets,
  getPresetsByUseCase,
  getPresetsByClientType,
  generatePresetCombinations,
  getRecommendedPresetForTemplate,
  validatePresetTemplateMatch
} from './presets';

// Helper function to create a complete theme system instance
export function createThemeSystem(): {
  engine: TE;
  presets: typeof RP;
  colorSchemes: typeof CS;
  stats: ReturnType<TE['getThemeStats']>;
} {
  const engine = new TE();
  
  return {
    engine,
    presets: RP,
    colorSchemes: CS,
    stats: engine.getThemeStats()
  };
}

// Quick theme generation helper
export function generateThemeCSS(
  colorScheme: string,
  typography: string,
  decorative: string,
  layout: string
): string {
  const engine = new ThemeEngine();
  
  return engine.generateCSS({
    colorScheme: colorScheme as any,
    typography: typography as any,
    decorative: decorative as any,
    layout: layout as any
  });
}

// Theme validation helper
export function validateThemeConfiguration(
  colorScheme: string,
  typography: string,
  decorative: string,
  layout: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const engine = new ThemeEngine();
  
  return engine.validateTheme({
    colorScheme: colorScheme as any,
    typography: typography as any,
    decorative: decorative as any,
    layout: layout as any
  });
}