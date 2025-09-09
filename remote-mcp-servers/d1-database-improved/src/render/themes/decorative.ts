// ============================================================================
// Decorative Elements System for Travel Proposal Themes
// ============================================================================

export interface DecorativeConfig {
  emoji: {
    hotel: string;
    flight: string;
    location: string;
    activity: string;
    transport: string;
    food: string;
    money: string;
    calendar: string;
    star: string;
    check: string;
    info: string;
    warning: string;
  };
  icons?: {
    // SVG icon definitions - placeholder for future implementation
    hotel: string;
    flight: string;
    location: string;
  };
  separators: {
    section: string;
    item: string;
    list: string;
  };
  bullets: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const DECORATIVE_STYLES: Record<string, DecorativeConfig> = {
  'none': {
    emoji: {
      hotel: '',
      flight: '',
      location: '',
      activity: '',
      transport: '',
      food: '',
      money: '',
      calendar: '',
      star: '',
      check: '',
      info: '',
      warning: ''
    },
    separators: {
      section: '',
      item: '',
      list: ''
    },
    bullets: {
      primary: '•',
      secondary: '◦',
      accent: '▪'
    }
  },
  
  'minimal-emoji': {
    emoji: {
      hotel: '🏨',
      flight: '✈️',
      location: '🌍',
      activity: '🎭',
      transport: '🚗',
      food: '🍽️',
      money: '💰',
      calendar: '📅',
      star: '⭐',
      check: '✅',
      info: 'ℹ️',
      warning: '⚠️'
    },
    separators: {
      section: ' • ',
      item: ' | ',
      list: ' → '
    },
    bullets: {
      primary: '▶',
      secondary: '▸',
      accent: '▪'
    }
  },
  
  'rich-emoji': {
    emoji: {
      hotel: '🏨🛏️',
      flight: '✈️🌤️',
      location: '🌍📍',
      activity: '🎭🎪🎨',
      transport: '🚗🚕🚌',
      food: '🍽️🥂🍾',
      money: '💰💳💎',
      calendar: '📅🗓️',
      star: '⭐🌟✨',
      check: '✅💚',
      info: 'ℹ️📋',
      warning: '⚠️🚨'
    },
    separators: {
      section: ' ✨ ',
      item: ' 🔸 ',
      list: ' ➡️ '
    },
    bullets: {
      primary: '🔹',
      secondary: '🔸',
      accent: '💎'
    }
  },
  
  'icons-only': {
    emoji: {
      hotel: '',
      flight: '',
      location: '',
      activity: '',
      transport: '',
      food: '',
      money: '',
      calendar: '',
      star: '',
      check: '',
      info: '',
      warning: ''
    },
    icons: {
      hotel: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 21V11H21V21H3Z"/></svg>',
      flight: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"/></svg>',
      location: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22S19 14.25 19 9C19 5.13 15.87 2 12 2Z"/></svg>'
    },
    separators: {
      section: ' │ ',
      item: ' · ',
      list: ' → '
    },
    bullets: {
      primary: '▶',
      secondary: '▸',
      accent: '▪'
    }
  }
};

// Helper function to get decorative configuration safely
export function getDecorativeConfig(styleName: string): DecorativeConfig {
  const config = DECORATIVE_STYLES[styleName];
  if (!config) {
    console.warn(`Decorative style '${styleName}' not found, falling back to none`);
    return DECORATIVE_STYLES['none'];
  }
  return config;
}

// Apply decorative elements to content based on style
export function applyDecorative(content: string, element: keyof DecorativeConfig['emoji'], style: string): string {
  const config = getDecorativeConfig(style);
  const decoration = config.emoji[element];
  
  if (!decoration) {
    return content;
  }
  
  return `${decoration} ${content}`;
}

// Generate section headers with decorative elements
export function decorateSection(title: string, level: 'h1' | 'h2' | 'h3' | 'h4', style: string): string {
  const config = getDecorativeConfig(style);
  
  if (style === 'none') {
    return title;
  }
  
  // Add appropriate decorative elements based on section type
  if (title.toLowerCase().includes('hotel') || title.toLowerCase().includes('accommodation')) {
    return applyDecorative(title, 'hotel', style);
  }
  if (title.toLowerCase().includes('flight')) {
    return applyDecorative(title, 'flight', style);
  }
  if (title.toLowerCase().includes('activity') || title.toLowerCase().includes('tour')) {
    return applyDecorative(title, 'activity', style);
  }
  if (title.toLowerCase().includes('cost') || title.toLowerCase().includes('price') || title.toLowerCase().includes('financial')) {
    return applyDecorative(title, 'money', style);
  }
  if (title.toLowerCase().includes('location') || title.toLowerCase().includes('destination')) {
    return applyDecorative(title, 'location', style);
  }
  
  return title;
}

// Generate decorative list items
export function decorateListItem(content: string, type: 'primary' | 'secondary' | 'accent', style: string): string {
  const config = getDecorativeConfig(style);
  const bullet = config.bullets[type];
  
  return `${bullet} ${content}`;
}

// Generate decorative separators for inline content
export function getSeparator(type: keyof DecorativeConfig['separators'], style: string): string {
  const config = getDecorativeConfig(style);
  return config.separators[type];
}

// Generate CSS for icon styles
export function generateIconStyles(): string {
  return `
    .icon {
      width: 1em;
      height: 1em;
      display: inline-block;
      vertical-align: -0.125em;
      fill: currentColor;
      margin-right: 0.25em;
    }
    
    .icon-small {
      width: 0.8em;
      height: 0.8em;
    }
    
    .icon-large {
      width: 1.2em;
      height: 1.2em;
    }
    
    /* Context-specific icon colors */
    .hotel-section .icon { color: var(--primary-color); }
    .flight-section .icon { color: var(--accent-color); }
    .activity-section .icon { color: var(--success-color); }
    .financial-section .icon { color: var(--price-highlight); }
  `.trim();
}

// Apply decorative styling to hotel amenities
export function decorateAmenities(amenities: string[], style: string): string[] {
  const config = getDecorativeConfig(style);
  
  if (style === 'none') {
    return amenities;
  }
  
  return amenities.map(amenity => {
    // Add context-appropriate decorations
    if (amenity.toLowerCase().includes('wifi')) {
      return `📶 ${amenity}`;
    }
    if (amenity.toLowerCase().includes('spa') || amenity.toLowerCase().includes('wellness')) {
      return `🧘 ${amenity}`;
    }
    if (amenity.toLowerCase().includes('restaurant') || amenity.toLowerCase().includes('dining')) {
      return config.emoji.food ? `${config.emoji.food} ${amenity}` : amenity;
    }
    if (amenity.toLowerCase().includes('pool') || amenity.toLowerCase().includes('swimming')) {
      return `🏊 ${amenity}`;
    }
    if (amenity.toLowerCase().includes('gym') || amenity.toLowerCase().includes('fitness')) {
      return `💪 ${amenity}`;
    }
    if (amenity.toLowerCase().includes('parking')) {
      return `🅿️ ${amenity}`;
    }
    if (amenity.toLowerCase().includes('view')) {
      return `👀 ${amenity}`;
    }
    
    // Default decoration based on style
    return style === 'minimal-emoji' ? `${config.bullets.primary} ${amenity}` : amenity;
  });
}

// Generate star ratings with decorative elements
export function generateStarRating(rating: number | undefined, style: string): string {
  if (!rating) return '';
  
  const config = getDecorativeConfig(style);
  const starSymbol = config.emoji.star || '★';
  const emptyStarSymbol = '☆';
  
  const fullStars = Math.floor(rating);
  const emptyStars = 5 - fullStars;
  
  return starSymbol.repeat(fullStars) + emptyStarSymbol.repeat(emptyStars);
}

// Format currency with decorative elements
export function formatCurrencyWithDecoration(amount: number, currency: string = 'USD', style: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
  
  const config = getDecorativeConfig(style);
  
  if (style === 'none') {
    return formatted;
  }
  
  return `${config.emoji.money} ${formatted}`;
}

// Generate check marks for refundable/confirmed items
export function decorateCheckItem(text: string, checked: boolean, style: string): string {
  const config = getDecorativeConfig(style);
  
  if (style === 'none') {
    return checked ? `✓ ${text}` : text;
  }
  
  const checkSymbol = checked ? config.emoji.check : '';
  return checkSymbol ? `${checkSymbol} ${text}` : text;
}