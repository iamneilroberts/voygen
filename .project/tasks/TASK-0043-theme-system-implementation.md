# TASK-0043: Theme System Implementation

## Overview
Create a comprehensive theme system that allows for visual remixing of travel proposals. This system will generate dynamic CSS and handle decorative elements, typography, and color schemes without requiring separate template files.

## Files to Create
```
src/render/themes/
  theme-engine.ts       # Main theme engine class
  color-schemes.ts      # Color palette definitions
  typography.ts         # Font and spacing configurations  
  decorative.ts         # Emoji, icons, and decorative elements
  layout.ts            # Layout density and spacing configurations
  presets.ts           # Common theme combinations
```

## Theme Engine Architecture

### Core Theme Engine (`theme-engine.ts`)
```typescript
export class ThemeEngine {
  // Generate complete CSS for a theme combination
  generateCSS(remix: ThemeRemix): string;
  
  // Apply decorative elements to content
  applyDecorative(content: string, style: string): string;
  
  // Get color palette for scheme
  getColorPalette(scheme: string): ColorPalette;
  
  // Get typography configuration
  getTypography(style: string): TypographyConfig;
  
  // Get layout configuration
  getLayout(style: string): LayoutConfig;
  
  // Apply theme variables to template context
  applyThemeContext(context: any, remix: ThemeRemix): any;
}
```

### Color Schemes (`color-schemes.ts`)
```typescript
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textLight: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export const COLOR_SCHEMES = {
  'professional-blue': {
    primary: '#2a5aa0',
    secondary: '#1e3d6f', 
    accent: '#4a90e2',
    background: '#ffffff',
    surface: '#f8f9fa',
    // ... rest of palette
  },
  'luxury-gold': {
    primary: '#d4af37',
    secondary: '#b8860b',
    accent: '#ffd700',
    background: '#fefefe',
    surface: '#f9f7f4',
    // ... rest of palette
  },
  // ... other schemes
};
```

### Typography System (`typography.ts`)
```typescript
export interface TypographyConfig {
  fontFamily: {
    heading: string;
    body: string;
    accent: string;
  };
  fontSize: {
    h1: string; h2: string; h3: string; h4: string;
    body: string; small: string; caption: string;
  };
  fontWeight: {
    light: number; regular: number; medium: number; bold: number;
  };
  lineHeight: {
    tight: number; normal: number; relaxed: number;
  };
}

export const TYPOGRAPHY_STYLES = {
  'corporate': {
    fontFamily: {
      heading: '"Segoe UI", system-ui, -apple-system, sans-serif',
      body: '"Segoe UI", system-ui, -apple-system, sans-serif',
      accent: '"Segoe UI", system-ui, -apple-system, sans-serif'
    },
    // ... rest of config
  },
  'elegant': {
    fontFamily: {
      heading: '"Playfair Display", "Georgia", serif',
      body: '"Source Sans Pro", "Helvetica", sans-serif', 
      accent: '"Playfair Display", "Georgia", serif'
    },
    // ... rest of config
  },
  // ... other styles
};
```

### Decorative Elements (`decorative.ts`)
```typescript
export interface DecorativeConfig {
  emoji: {
    hotel: string;
    flight: string;
    location: string;
    activity: string;
    transport: string;
    food: string;
    money: string;
  };
  icons?: {
    // SVG icon definitions
  };
  separators: {
    section: string;
    item: string;
  };
}

export const DECORATIVE_STYLES = {
  'none': {
    emoji: {
      hotel: '', flight: '', location: '', 
      activity: '', transport: '', food: '', money: ''
    },
    separators: { section: '', item: '' }
  },
  'minimal-emoji': {
    emoji: {
      hotel: '🏨', flight: '✈️', location: '🌍',
      activity: '🎭', transport: '🚗', food: '🍽️', money: '💰'
    },
    separators: { section: ' • ', item: ' | ' }
  },
  'rich-emoji': {
    emoji: {
      hotel: '🏨🛏️', flight: '✈️🌤️', location: '🌍📍',
      activity: '🎭🎪🎨', transport: '🚗🚕🚌', food: '🍽️🥂', money: '💰💳'
    },
    separators: { section: ' ✨ ', item: ' 🔸 ' }
  },
  // ... other styles
};
```

### Layout Configuration (`layout.ts`)
```typescript
export interface LayoutConfig {
  spacing: {
    section: string;
    component: string; 
    item: string;
    tight: string;
  };
  containers: {
    maxWidth: string;
    padding: string;
    margin: string;
  };
  grid: {
    columns: number;
    gap: string;
  };
}

export const LAYOUT_STYLES = {
  'compact': {
    spacing: { section: '24px', component: '16px', item: '8px', tight: '4px' },
    containers: { maxWidth: '800px', padding: '16px', margin: '0 auto' },
    grid: { columns: 2, gap: '16px' }
  },
  'spacious': {
    spacing: { section: '48px', component: '32px', item: '16px', tight: '8px' },
    containers: { maxWidth: '1000px', padding: '32px', margin: '0 auto' },
    grid: { columns: 2, gap: '24px' }
  },
  // ... other layouts
};
```

### Theme Presets (`presets.ts`)
```typescript
export const REMIX_PRESETS: Record<string, ThemeRemix> = {
  'professional': {
    colorScheme: 'professional-blue',
    typography: 'corporate', 
    decorative: 'none',
    layout: 'spacious'
  },
  'luxury': {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'minimal-emoji', 
    layout: 'magazine'
  },
  'modern': {
    colorScheme: 'vibrant-teal',
    typography: 'modern',
    decorative: 'icons-only',
    layout: 'compact'
  },
  'friendly': {
    colorScheme: 'sunset-orange', 
    typography: 'modern',
    decorative: 'rich-emoji',
    layout: 'spacious'
  },
  'executive': {
    colorScheme: 'minimal-gray',
    typography: 'corporate',
    decorative: 'none', 
    layout: 'executive'
  }
};
```

## CSS Generation Strategy
1. **CSS Custom Properties**: Use CSS variables for dynamic theming
2. **Responsive Design**: All themes work on mobile and desktop
3. **Print Optimization**: Professional print layouts
4. **Performance**: Minimal CSS output, no unused styles

## Integration Points
1. **Template Engine**: Inject theme context and CSS
2. **Component System**: Theme-aware template components
3. **User Interface**: Easy preset selection and customization

## Acceptance Criteria
- [ ] Theme engine generates valid, optimized CSS
- [ ] 5+ color schemes implemented and tested
- [ ] 4+ typography styles working correctly  
- [ ] Decorative elements apply consistently
- [ ] Layout variations function properly
- [ ] Theme presets provide good default combinations
- [ ] Performance: <50ms theme generation time

## Priority: High  
## Estimated Time: 2-3 hours
## Dependencies: TASK-0042 (Data Model Alignment)