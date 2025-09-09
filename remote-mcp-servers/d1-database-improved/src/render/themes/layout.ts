// ============================================================================
// Layout System for Travel Proposal Themes
// ============================================================================

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
    breakpoints: {
      sm: string;
      md: string;
      lg: string;
    };
  };
  cards: {
    borderRadius: string;
    padding: string;
    shadow: string;
    hoverShadow: string;
  };
}

export const LAYOUT_STYLES: Record<string, LayoutConfig> = {
  'compact': {
    spacing: {
      section: '16px',
      component: '12px',
      item: '6px',
      tight: '4px'
    },
    containers: {
      maxWidth: '800px',
      padding: '12px',
      margin: '0 auto'
    },
    grid: {
      columns: 2,
      gap: '12px',
      breakpoints: {
        sm: '480px',
        md: '768px',
        lg: '1024px'
      }
    },
    cards: {
      borderRadius: '6px',
      padding: '16px',
      shadow: '0 2px 4px rgba(0,0,0,0.1)',
      hoverShadow: '0 4px 8px rgba(0,0,0,0.15)'
    }
  },
  
  'spacious': {
    spacing: {
      section: '48px',
      component: '32px',
      item: '16px',
      tight: '8px'
    },
    containers: {
      maxWidth: '1000px',
      padding: '32px',
      margin: '0 auto'
    },
    grid: {
      columns: 2,
      gap: '24px',
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px'
      }
    },
    cards: {
      borderRadius: '12px',
      padding: '32px',
      shadow: '0 10px 25px rgba(0,0,0,0.1)',
      hoverShadow: '0 15px 35px rgba(0,0,0,0.15)'
    }
  },
  
  'magazine': {
    spacing: {
      section: '40px',
      component: '24px',
      item: '12px',
      tight: '6px'
    },
    containers: {
      maxWidth: '900px',
      padding: '24px',
      margin: '0 auto'
    },
    grid: {
      columns: 3,
      gap: '20px',
      breakpoints: {
        sm: '600px',
        md: '900px',
        lg: '1200px'
      }
    },
    cards: {
      borderRadius: '8px',
      padding: '24px',
      shadow: '0 6px 20px rgba(0,0,0,0.08)',
      hoverShadow: '0 10px 30px rgba(0,0,0,0.12)'
    }
  },
  
  'executive': {
    spacing: {
      section: '20px',
      component: '16px',
      item: '8px',
      tight: '4px'
    },
    containers: {
      maxWidth: '850px',
      padding: '20px',
      margin: '0 auto'
    },
    grid: {
      columns: 1,
      gap: '16px',
      breakpoints: {
        sm: '600px',
        md: '768px',
        lg: '1024px'
      }
    },
    cards: {
      borderRadius: '4px',
      padding: '20px',
      shadow: '0 2px 8px rgba(0,0,0,0.06)',
      hoverShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }
  }
};

// Helper function to get layout configuration safely
export function getLayoutConfig(styleName: string): LayoutConfig {
  const config = LAYOUT_STYLES[styleName];
  if (!config) {
    console.warn(`Layout style '${styleName}' not found, falling back to spacious`);
    return LAYOUT_STYLES['spacious'];
  }
  return config;
}

// Generate CSS custom properties for layout
export function generateLayoutVariables(config: LayoutConfig): string {
  return `
    :root {
      /* Spacing */
      --spacing-section: ${config.spacing.section};
      --spacing-component: ${config.spacing.component};
      --spacing-item: ${config.spacing.item};
      --spacing-tight: ${config.spacing.tight};
      
      /* Container */
      --container-max-width: ${config.containers.maxWidth};
      --container-padding: ${config.containers.padding};
      --container-margin: ${config.containers.margin};
      
      /* Grid */
      --grid-columns: ${config.grid.columns};
      --grid-gap: ${config.grid.gap};
      
      /* Cards */
      --card-border-radius: ${config.cards.borderRadius};
      --card-padding: ${config.cards.padding};
      --card-shadow: ${config.cards.shadow};
      --card-hover-shadow: ${config.cards.hoverShadow};
      
      /* Breakpoints */
      --breakpoint-sm: ${config.grid.breakpoints.sm};
      --breakpoint-md: ${config.grid.breakpoints.md};
      --breakpoint-lg: ${config.grid.breakpoints.lg};
    }
  `.trim();
}

// Generate layout CSS classes
export function generateLayoutClasses(config: LayoutConfig): string {
  return `
    /* Container */
    .proposal-container {
      max-width: var(--container-max-width);
      margin: var(--container-margin);
      padding: var(--container-padding);
    }
    
    /* Spacing utilities */
    .section { margin-bottom: var(--spacing-section); }
    .component { margin-bottom: var(--spacing-component); }
    .item { margin-bottom: var(--spacing-item); }
    .tight { margin-bottom: var(--spacing-tight); }
    
    /* Grid system */
    .grid {
      display: grid;
      grid-template-columns: repeat(var(--grid-columns), 1fr);
      gap: var(--grid-gap);
    }
    
    .grid-1 { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    
    /* Card components */
    .card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: var(--card-border-radius);
      padding: var(--card-padding);
      box-shadow: var(--card-shadow);
      transition: box-shadow 0.3s ease, transform 0.2s ease;
    }
    
    .card:hover {
      box-shadow: var(--card-hover-shadow);
      transform: translateY(-2px);
    }
    
    .card-flat {
      box-shadow: none;
      border: 1px solid var(--border-color);
    }
    
    .card-elevated {
      box-shadow: var(--card-hover-shadow);
    }
    
    /* Flexbox utilities */
    .flex { display: flex; }
    .flex-column { flex-direction: column; }
    .flex-row { flex-direction: row; }
    .flex-wrap { flex-wrap: wrap; }
    .flex-center { align-items: center; justify-content: center; }
    .flex-between { justify-content: space-between; }
    .flex-around { justify-content: space-around; }
    .flex-start { justify-content: flex-start; }
    .flex-end { justify-content: flex-end; }
    
    /* Hotel cards specific styling */
    .hotel-card {
      background: var(--hotel-card-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--card-border-radius);
      margin-bottom: var(--spacing-component);
      padding: var(--card-padding);
      transition: all 0.3s ease;
    }
    
    .hotel-card:hover {
      box-shadow: var(--card-hover-shadow);
    }
    
    .hotel-meta {
      display: grid;
      grid-template-columns: repeat(var(--grid-columns), 1fr);
      gap: var(--spacing-item);
      margin-bottom: var(--spacing-item);
    }
    
    /* Cost summary styling */
    .cost-breakdown {
      display: grid;
      grid-template-columns: repeat(var(--grid-columns), 1fr);
      gap: var(--grid-gap);
      margin-top: var(--spacing-item);
    }
    
    /* Content sections */
    .section {
      margin-bottom: var(--spacing-section);
    }
    
    .section h3 {
      color: var(--primary-color);
      margin-bottom: var(--spacing-component);
      border-bottom: 2px solid var(--border-color);
      padding-bottom: var(--spacing-tight);
    }
  `.trim();
}

// Generate responsive layout CSS
export function generateResponsiveLayout(config: LayoutConfig): string {
  return `
    /* Tablet */
    @media (max-width: ${config.grid.breakpoints.md}) {
      .proposal-container {
        padding: calc(var(--container-padding) * 0.75);
      }
      
      .grid,
      .hotel-meta,
      .cost-breakdown {
        grid-template-columns: 1fr;
      }
      
      .section {
        margin-bottom: calc(var(--spacing-section) * 0.8);
      }
      
      .card {
        padding: calc(var(--card-padding) * 0.8);
      }
    }
    
    /* Mobile */
    @media (max-width: ${config.grid.breakpoints.sm}) {
      .proposal-container {
        padding: calc(var(--container-padding) * 0.5);
      }
      
      .section {
        margin-bottom: calc(var(--spacing-section) * 0.6);
      }
      
      .component {
        margin-bottom: calc(var(--spacing-component) * 0.75);
      }
      
      .card {
        padding: calc(var(--card-padding) * 0.6);
        border-radius: calc(var(--card-border-radius) * 0.8);
      }
      
      /* Stack everything on mobile */
      .grid,
      .hotel-meta,
      .cost-breakdown {
        grid-template-columns: 1fr;
        gap: calc(var(--grid-gap) * 0.75);
      }
    }
    
    /* Large screens */
    @media (min-width: ${config.grid.breakpoints.lg}) {
      .proposal-container {
        padding: calc(var(--container-padding) * 1.2);
      }
      
      /* Magazine and spacious layouts can use more columns on large screens */
      ${config.grid.columns >= 2 ? `
        .grid {
          grid-template-columns: repeat(${Math.min(config.grid.columns + 1, 4)}, 1fr);
        }
      ` : ''}
    }
  `.trim();
}

// Generate print-specific layout CSS
export function generatePrintLayout(): string {
  return `
    @media print {
      .proposal-container {
        max-width: none;
        margin: 0;
        padding: 20px;
      }
      
      .section {
        break-inside: avoid;
        margin-bottom: 24px;
      }
      
      .card,
      .hotel-card {
        break-inside: avoid;
        box-shadow: none !important;
        border: 1px solid #ddd;
        margin-bottom: 16px;
      }
      
      .grid,
      .hotel-meta,
      .cost-breakdown {
        break-inside: avoid;
      }
      
      /* Ensure proper spacing for print */
      h1, h2, h3, h4 {
        page-break-after: avoid;
      }
      
      /* Hide interactive elements */
      .card:hover {
        transform: none !important;
        box-shadow: none !important;
      }
    }
  `.trim();
}

// Get specific spacing value for context
export function getSpacing(type: keyof LayoutConfig['spacing'], layoutStyle: string): string {
  const config = getLayoutConfig(layoutStyle);
  return config.spacing[type];
}

// Get grid configuration for responsive design
export function getGridConfig(layoutStyle: string): LayoutConfig['grid'] {
  const config = getLayoutConfig(layoutStyle);
  return config.grid;
}

// Generate layout-specific utility classes
export function generateLayoutUtilities(config: LayoutConfig): string {
  return `
    /* Margin utilities */
    .m-0 { margin: 0; }
    .m-tight { margin: var(--spacing-tight); }
    .m-item { margin: var(--spacing-item); }
    .m-component { margin: var(--spacing-component); }
    .m-section { margin: var(--spacing-section); }
    
    .mt-0 { margin-top: 0; }
    .mt-tight { margin-top: var(--spacing-tight); }
    .mt-item { margin-top: var(--spacing-item); }
    .mt-component { margin-top: var(--spacing-component); }
    .mt-section { margin-top: var(--spacing-section); }
    
    .mb-0 { margin-bottom: 0; }
    .mb-tight { margin-bottom: var(--spacing-tight); }
    .mb-item { margin-bottom: var(--spacing-item); }
    .mb-component { margin-bottom: var(--spacing-component); }
    .mb-section { margin-bottom: var(--spacing-section); }
    
    /* Padding utilities */
    .p-0 { padding: 0; }
    .p-tight { padding: var(--spacing-tight); }
    .p-item { padding: var(--spacing-item); }
    .p-component { padding: var(--spacing-component); }
    
    /* Width utilities */
    .w-full { width: 100%; }
    .w-half { width: 50%; }
    .w-third { width: 33.333%; }
    .w-quarter { width: 25%; }
    
    /* Text alignment */
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    /* Display utilities */
    .block { display: block; }
    .inline { display: inline; }
    .inline-block { display: inline-block; }
    .hidden { display: none; }
  `.trim();
}