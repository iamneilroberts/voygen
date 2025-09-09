// ============================================================================
// Color Schemes for Travel Proposal Themes
// ============================================================================

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
  // Additional semantic colors
  hotelCard: string;
  priceHighlight: string;
  rating: string;
  refundable: string;
  commission: string;
}

export const COLOR_SCHEMES: Record<string, ColorPalette> = {
  'professional-blue': {
    primary: '#2a5aa0',
    secondary: '#1e3d6f',
    accent: '#4a90e2',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#333333',
    textLight: '#666666',
    border: '#e1e8ed',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    // Semantic colors
    hotelCard: '#fafbfc',
    priceHighlight: '#2a5aa0',
    rating: '#ffa500',
    refundable: '#e8f5e8',
    commission: '#28a745'
  },
  
  'luxury-gold': {
    primary: '#d4af37',
    secondary: '#b8860b',
    accent: '#ffd700',
    background: '#fefefe',
    surface: '#f9f7f4',
    text: '#2c2c2c',
    textLight: '#5a5a5a',
    border: '#e8dcc6',
    success: '#8b7355',
    warning: '#daa520',
    error: '#cd853f',
    // Semantic colors
    hotelCard: '#faf8f5',
    priceHighlight: '#d4af37',
    rating: '#daa520',
    refundable: '#f0f8e8',
    commission: '#8b7355'
  },
  
  'minimal-gray': {
    primary: '#6c757d',
    secondary: '#495057',
    accent: '#868e96',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textLight: '#6c757d',
    border: '#dee2e6',
    success: '#198754',
    warning: '#ffc107',
    error: '#dc3545',
    // Semantic colors
    hotelCard: '#f8f9fa',
    priceHighlight: '#495057',
    rating: '#ffc107',
    refundable: '#d1edff',
    commission: '#198754'
  },
  
  'vibrant-teal': {
    primary: '#20c997',
    secondary: '#17a2b8',
    accent: '#6f42c1',
    background: '#ffffff',
    surface: '#f0fdf4',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#d1fae5',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    // Semantic colors
    hotelCard: '#f0fdfa',
    priceHighlight: '#059669',
    rating: '#f59e0b',
    refundable: '#ecfdf5',
    commission: '#10b981'
  },
  
  'sunset-orange': {
    primary: '#ff6b35',
    secondary: '#e55100',
    accent: '#ff9800',
    background: '#fffbf7',
    surface: '#fff4e6',
    text: '#2d1810',
    textLight: '#8b4513',
    border: '#ffe0b3',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    // Semantic colors
    hotelCard: '#fff8f0',
    priceHighlight: '#ff6b35',
    rating: '#ff9800',
    refundable: '#e8f5e8',
    commission: '#4caf50'
  }
};

// Helper function to get color palette safely
export function getColorPalette(schemeName: string): ColorPalette {
  const palette = COLOR_SCHEMES[schemeName];
  if (!palette) {
    console.warn(`Color scheme '${schemeName}' not found, falling back to professional-blue`);
    return COLOR_SCHEMES['professional-blue'];
  }
  return palette;
}

// Generate CSS custom properties for a color palette
export function generateColorVariables(palette: ColorPalette): string {
  return `
    :root {
      --primary-color: ${palette.primary};
      --secondary-color: ${palette.secondary};
      --accent-color: ${palette.accent};
      --background-color: ${palette.background};
      --surface-color: ${palette.surface};
      --text-color: ${palette.text};
      --text-light-color: ${palette.textLight};
      --border-color: ${palette.border};
      --success-color: ${palette.success};
      --warning-color: ${palette.warning};
      --error-color: ${palette.error};
      
      /* Semantic colors for travel components */
      --hotel-card-bg: ${palette.hotelCard};
      --price-highlight: ${palette.priceHighlight};
      --rating-color: ${palette.rating};
      --refundable-bg: ${palette.refundable};
      --commission-color: ${palette.commission};
    }
  `.trim();
}

// Get contrasting text color for backgrounds
export function getContrastingTextColor(backgroundColor: string): string {
  // Simple contrast calculation - could be enhanced with proper algorithms
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Generate hover and active states for colors
export function generateStateVariants(baseColor: string): {
  hover: string;
  active: string;
  disabled: string;
} {
  // Simple color manipulation - in production might use color libraries
  return {
    hover: adjustBrightness(baseColor, -10),
    active: adjustBrightness(baseColor, -20),
    disabled: adjustOpacity(baseColor, 0.5)
  };
}

// Utility functions for color manipulation
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
}

function adjustOpacity(hex: string, opacity: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = num >> 16;
  const G = num >> 8 & 0x00FF;
  const B = num & 0x0000FF;
  
  return `rgba(${R}, ${G}, ${B}, ${opacity})`;
}