// ============================================================================
// Typography System for Travel Proposal Themes
// ============================================================================

export interface TypographyConfig {
  fontFamily: {
    heading: string;
    body: string;
    accent: string;
  };
  fontSize: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    body: string;
    small: string;
    caption: string;
  };
  fontWeight: {
    light: number;
    regular: number;
    medium: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

export const TYPOGRAPHY_STYLES: Record<string, TypographyConfig> = {
  'corporate': {
    fontFamily: {
      heading: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      body: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      accent: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    },
    fontSize: {
      h1: '2.5rem',
      h2: '1.8rem',
      h3: '1.5rem',
      h4: '1.3rem',
      body: '1rem',
      small: '0.9rem',
      caption: '0.8rem'
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 600
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.6,
      relaxed: 1.8
    },
    letterSpacing: {
      tight: '-0.5px',
      normal: '0px',
      wide: '0.5px'
    }
  },
  
  'elegant': {
    fontFamily: {
      heading: '"Playfair Display", "Georgia", "Times New Roman", serif',
      body: '"Source Sans Pro", "Helvetica Neue", "Arial", sans-serif',
      accent: '"Playfair Display", "Georgia", "Times New Roman", serif'
    },
    fontSize: {
      h1: '2.8rem',
      h2: '2.0rem',
      h3: '1.6rem',
      h4: '1.4rem',
      body: '1.1rem',
      small: '1rem',
      caption: '0.9rem'
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.7,
      relaxed: 1.9
    },
    letterSpacing: {
      tight: '-0.3px',
      normal: '0px',
      wide: '0.8px'
    }
  },
  
  'modern': {
    fontFamily: {
      heading: '"Inter", "SF Pro Display", system-ui, sans-serif',
      body: '"Inter", "SF Pro Text", system-ui, sans-serif',
      accent: '"JetBrains Mono", "SF Mono", "Monaco", monospace'
    },
    fontSize: {
      h1: '2.2rem',
      h2: '1.7rem',
      h3: '1.4rem',
      h4: '1.2rem',
      body: '0.95rem',
      small: '0.85rem',
      caption: '0.75rem'
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 600
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    },
    letterSpacing: {
      tight: '-0.4px',
      normal: '0px',
      wide: '0.4px'
    }
  },
  
  'classic': {
    fontFamily: {
      heading: '"Minion Pro", "Times New Roman", "Georgia", serif',
      body: '"Minion Pro", "Times New Roman", "Georgia", serif',
      accent: '"Helvetica Neue", "Arial", sans-serif'
    },
    fontSize: {
      h1: '2.6rem',
      h2: '1.9rem',
      h3: '1.6rem',
      h4: '1.4rem',
      body: '1.1rem',
      small: '1rem',
      caption: '0.9rem'
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.65,
      relaxed: 1.85
    },
    letterSpacing: {
      tight: '-0.2px',
      normal: '0px',
      wide: '0.6px'
    }
  }
};

// Helper function to get typography configuration safely
export function getTypographyConfig(styleName: string): TypographyConfig {
  const config = TYPOGRAPHY_STYLES[styleName];
  if (!config) {
    console.warn(`Typography style '${styleName}' not found, falling back to corporate`);
    return TYPOGRAPHY_STYLES['corporate'];
  }
  return config;
}

// Generate CSS custom properties for typography
export function generateTypographyVariables(config: TypographyConfig): string {
  return `
    :root {
      /* Font families */
      --font-heading: ${config.fontFamily.heading};
      --font-body: ${config.fontFamily.body};
      --font-accent: ${config.fontFamily.accent};
      
      /* Font sizes */
      --font-size-h1: ${config.fontSize.h1};
      --font-size-h2: ${config.fontSize.h2};
      --font-size-h3: ${config.fontSize.h3};
      --font-size-h4: ${config.fontSize.h4};
      --font-size-body: ${config.fontSize.body};
      --font-size-small: ${config.fontSize.small};
      --font-size-caption: ${config.fontSize.caption};
      
      /* Font weights */
      --font-weight-light: ${config.fontWeight.light};
      --font-weight-regular: ${config.fontWeight.regular};
      --font-weight-medium: ${config.fontWeight.medium};
      --font-weight-bold: ${config.fontWeight.bold};
      
      /* Line heights */
      --line-height-tight: ${config.lineHeight.tight};
      --line-height-normal: ${config.lineHeight.normal};
      --line-height-relaxed: ${config.lineHeight.relaxed};
      
      /* Letter spacing */
      --letter-spacing-tight: ${config.letterSpacing.tight};
      --letter-spacing-normal: ${config.letterSpacing.normal};
      --letter-spacing-wide: ${config.letterSpacing.wide};
    }
  `.trim();
}

// Generate typography CSS classes
export function generateTypographyClasses(config: TypographyConfig): string {
  return `
    /* Base typography */
    body {
      font-family: var(--font-body);
      font-size: var(--font-size-body);
      font-weight: var(--font-weight-regular);
      line-height: var(--line-height-normal);
      letter-spacing: var(--letter-spacing-normal);
    }
    
    /* Headings */
    h1, .h1 {
      font-family: var(--font-heading);
      font-size: var(--font-size-h1);
      font-weight: var(--font-weight-light);
      line-height: var(--line-height-tight);
      letter-spacing: var(--letter-spacing-tight);
      margin-bottom: 1rem;
    }
    
    h2, .h2 {
      font-family: var(--font-heading);
      font-size: var(--font-size-h2);
      font-weight: var(--font-weight-regular);
      line-height: var(--line-height-tight);
      letter-spacing: var(--letter-spacing-normal);
      margin-bottom: 0.8rem;
    }
    
    h3, .h3 {
      font-family: var(--font-heading);
      font-size: var(--font-size-h3);
      font-weight: var(--font-weight-medium);
      line-height: var(--line-height-normal);
      letter-spacing: var(--letter-spacing-normal);
      margin-bottom: 0.6rem;
    }
    
    h4, .h4 {
      font-family: var(--font-heading);
      font-size: var(--font-size-h4);
      font-weight: var(--font-weight-medium);
      line-height: var(--line-height-normal);
      letter-spacing: var(--letter-spacing-normal);
      margin-bottom: 0.5rem;
    }
    
    /* Body text variants */
    .text-small {
      font-size: var(--font-size-small);
    }
    
    .text-caption {
      font-size: var(--font-size-caption);
      color: var(--text-light-color);
    }
    
    /* Font weight utilities */
    .font-light { font-weight: var(--font-weight-light); }
    .font-regular { font-weight: var(--font-weight-regular); }
    .font-medium { font-weight: var(--font-weight-medium); }
    .font-bold { font-weight: var(--font-weight-bold); }
    
    /* Line height utilities */
    .leading-tight { line-height: var(--line-height-tight); }
    .leading-normal { line-height: var(--line-height-normal); }
    .leading-relaxed { line-height: var(--line-height-relaxed); }
    
    /* Letter spacing utilities */
    .tracking-tight { letter-spacing: var(--letter-spacing-tight); }
    .tracking-normal { letter-spacing: var(--letter-spacing-normal); }
    .tracking-wide { letter-spacing: var(--letter-spacing-wide); }
    
    /* Accent font for special elements */
    .font-accent {
      font-family: var(--font-accent);
    }
  `.trim();
}

// Generate responsive typography for mobile devices
export function generateResponsiveTypography(): string {
  return `
    @media (max-width: 768px) {
      :root {
        --font-size-h1: 2rem;
        --font-size-h2: 1.5rem;
        --font-size-h3: 1.3rem;
        --font-size-h4: 1.1rem;
        --font-size-body: 0.95rem;
        --font-size-small: 0.85rem;
        --font-size-caption: 0.75rem;
      }
    }
    
    @media (max-width: 480px) {
      :root {
        --font-size-h1: 1.8rem;
        --font-size-h2: 1.4rem;
        --font-size-h3: 1.2rem;
        --font-size-h4: 1rem;
        --font-size-body: 0.9rem;
        --font-size-small: 0.8rem;
        --font-size-caption: 0.7rem;
      }
    }
  `.trim();
}