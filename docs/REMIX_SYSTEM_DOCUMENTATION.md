# Remix System Documentation

## Complete Guide to Template Types and Remix Usage

The Remix System provides a powerful way to generate travel proposals by combining **templates** with **themes** to create professional, customized documents. This guide covers all template types, remix capabilities, and provides extensive examples for developers and users.

## Table of Contents

1. [System Overview](#system-overview)
2. [Template Types](#template-types)
3. [Theme System](#theme-system)
4. [Remix Engine](#remix-engine)
5. [Preset System](#preset-system)
6. [API Usage Examples](#api-usage-examples)
7. [Advanced Customization](#advanced-customization)
8. [Best Practices](#best-practices)

---

## System Overview

The Remix System operates on a simple but powerful concept:

**Template + Theme = Professional Proposal**

- **Templates** define the structure, layout, and information organization
- **Themes** define the visual styling, colors, typography, and decorative elements
- **Remix Engine** intelligently combines them with validation and optimization

### Architecture

```
ProposalData → Template → Theme → Remix Engine → Generated Proposal
                ↑           ↑         ↑
            Structure   Styling   Intelligence
```

---

## Template Types

The system provides 4 professional template types, each optimized for different use cases and presentation styles.

### 1. Detailed Template

**Purpose**: Comprehensive information presentation with full sections and detailed breakdowns.

**Best For**:
- Complex multi-destination trips
- Corporate presentations requiring detailed planning
- Trips with multiple accommodation and transportation options
- Client situations requiring thorough documentation

**Structure**:
```
📋 Executive Summary
📍 Complete Destination Breakdown
  • Detailed itinerary for each location
  • Cultural highlights and recommendations
  • Local transportation options
🏨 Comprehensive Accommodations
  • Detailed hotel descriptions
  • Amenities and features breakdown
  • Room type specifications
✈️ Transportation Details
  • Flight information with alternatives
  • Ground transportation options
  • Transfer arrangements
🎭 Activities & Experiences
  • Detailed activity descriptions
  • Duration and scheduling information
  • Alternative options
💰 Complete Financial Breakdown
  • Itemized cost analysis
  • Payment schedules
  • Cancellation policies
📞 Next Steps & Contact Information
```

**Example Usage**:
```typescript
// Generate detailed template with luxury theme
const result = await generateRemix(proposalData, {
  template: 'detailed',
  theme: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'minimal-emoji',
    layout: 'spacious'
  }
});
```

**Sample Output Structure**:
```html
<div class="proposal detailed-template luxury-gold">
  <header class="executive-summary">
    <h1>🌟 Exclusive European Grand Tour Experience</h1>
    <div class="trip-overview">
      <p class="elegant-intro">Embark on a meticulously curated 14-day journey through Europe's most prestigious destinations...</p>
    </div>
  </header>
  
  <section class="destinations-detailed">
    <h2>📍 Your European Adventure Awaits</h2>
    <div class="destination-group">
      <div class="destination-card luxury">
        <h3>🏛️ Paris, France (4 days)</h3>
        <div class="cultural-highlights">
          <h4>Cultural Immersion</h4>
          <ul>
            <li>Private Louvre tour with art historian guide</li>
            <li>Seine river dinner cruise with champagne service</li>
            <li>Exclusive Versailles palace access</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  
  <section class="accommodations-comprehensive">
    <h2>🏨 Luxury Accommodations</h2>
    <div class="hotel-detailed">
      <h3>The Ritz Paris</h3>
      <div class="hotel-features">
        <p class="description">Historic palace hotel in Place Vendôme...</p>
        <div class="amenities-grid">
          <div class="amenity">🌟 Michelin-starred dining</div>
          <div class="amenity">🛁 Luxury spa facilities</div>
          <div class="amenity">🚗 Concierge services</div>
        </div>
      </div>
    </div>
  </section>
</div>
```

### 2. Condensed Template

**Purpose**: Streamlined format focusing on key information and summary details.

**Best For**:
- Executive summaries for time-pressed clients
- Quick approval processes
- Simple trips with straightforward requirements
- Mobile viewing and sharing

**Structure**:
```
⚡ Executive Summary
📍 Key Destinations (overview)
🏨 Essential Accommodations
✈️ Transportation Summary
💰 Investment Overview
📞 Quick Contact & Next Steps
```

**Example Usage**:
```typescript
// Generate condensed template for executive clients
const result = await generateRemix(proposalData, {
  template: 'condensed',
  theme: {
    colorScheme: 'minimal-gray',
    typography: 'corporate',
    decorative: 'none',
    layout: 'executive'
  }
});
```

**Sample Output Structure**:
```html
<div class="proposal condensed-template minimal-gray">
  <div class="executive-brief">
    <h1>European Business Travel - Executive Brief</h1>
    <div class="key-metrics">
      <span class="metric">📅 7 days</span>
      <span class="metric">📍 3 cities</span>
      <span class="metric">💼 Business class</span>
      <span class="metric">💰 $4,250</span>
    </div>
  </div>
  
  <div class="condensed-sections">
    <div class="section-row">
      <div class="destinations-summary">
        <h3>Destinations</h3>
        <ul class="city-list">
          <li>London (2 days) - Business meetings</li>
          <li>Amsterdam (3 days) - Conference attendance</li>
          <li>Berlin (2 days) - Client presentations</li>
        </ul>
      </div>
      
      <div class="logistics-summary">
        <h3>Logistics</h3>
        <ul class="logistics-list">
          <li>Direct flights included</li>
          <li>4-star business hotels</li>
          <li>Airport transfers arranged</li>
          <li>All meals covered</li>
        </ul>
      </div>
    </div>
  </div>
  
  <div class="action-summary">
    <h3>Next Steps</h3>
    <p>Approval required by: March 15, 2024</p>
    <p>Contact: travel@company.com | +1-555-0123</p>
  </div>
</div>
```

### 3. Fancy Template

**Purpose**: Rich visual presentation with enhanced styling and premium appearance.

**Best For**:
- Luxury travel experiences
- Special occasions and celebrations
- Premium client presentations
- Marketing and promotional materials

**Structure**:
```
✨ Elegant Experience Overview
🌍 Destination Showcase (visual-rich)
🏛️ Premium Accommodations (featured)
🚁 Exclusive Transportation
🎭 Curated Experiences (highlighted)
💎 Investment in Luxury
📞 Concierge Contact
```

**Example Usage**:
```typescript
// Generate fancy template for luxury experiences
const result = await generateRemix(proposalData, {
  template: 'fancy',
  theme: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'rich-emoji',
    layout: 'magazine'
  }
});
```

**Sample Output Structure**:
```html
<div class="proposal fancy-template luxury-gold magazine-layout">
  <header class="hero-section">
    <div class="luxury-badge">✨ Curated Luxury Experience ✨</div>
    <h1 class="fancy-title">𝒜 𝒥𝑜𝓊𝓇𝓃𝑒𝓎 𝒷𝑒𝓎𝑜𝓃𝒹 𝐸𝓍𝓅𝑒𝒸𝓉𝒶𝓉𝒾𝑜𝓃</h1>
    <p class="luxury-tagline">Indulge in the extraordinary with our bespoke Maldives luxury retreat</p>
  </header>
  
  <section class="destination-showcase">
    <div class="destination-hero">
      <h2 class="showcase-title">🌴 The Maldives: Your Private Paradise</h2>
      <div class="visual-story">
        <div class="story-element">
          <div class="fancy-icon">🏖️</div>
          <h3>Private Overwater Villa</h3>
          <p class="luxury-description">Wake up to crystal-clear lagoon views from your exclusive overwater sanctuary, complete with private infinity pool and dedicated butler service.</p>
        </div>
        <div class="story-element">
          <div class="fancy-icon">🐠</div>
          <h3>Underwater Restaurant</h3>
          <p class="luxury-description">Dine 16 feet below sea level surrounded by vibrant coral reefs and tropical marine life in the world's first all-glass underwater restaurant.</p>
        </div>
      </div>
    </div>
  </section>
  
  <section class="premium-accommodations">
    <h2 class="section-fancy-title">🏛️ The Ultimate in Luxury Living</h2>
    <div class="luxury-hotel-feature">
      <div class="hotel-crown">👑</div>
      <h3 class="hotel-fancy-name">Conrad Maldives Rangali Island</h3>
      <div class="luxury-highlights">
        <div class="highlight">🌟 Two private islands connected by bridge</div>
        <div class="highlight">🍾 Personal sommelier and wine cellar access</div>
        <div class="highlight">🧘‍♀️ Overwater spa with traditional treatments</div>
        <div class="highlight">🚁 Seaplane transfers with champagne service</div>
      </div>
    </div>
  </section>
  
  <section class="investment-luxury">
    <div class="luxury-investment-frame">
      <h2 class="investment-title">💎 Investment in Unforgettable Memories</h2>
      <div class="luxury-price-presentation">
        <div class="price-elegant">$18,750</div>
        <div class="price-subtitle">per couple for 7 nights of pure luxury</div>
        <div class="luxury-inclusions">
          <span class="inclusion">🍾 All meals & premium beverages</span>
          <span class="inclusion">✈️ Seaplane transfers</span>
          <span class="inclusion">🎭 Exclusive experiences</span>
          <span class="inclusion">🛎️ 24/7 butler service</span>
        </div>
      </div>
    </div>
  </section>
</div>
```

### 4. Functional Template

**Purpose**: Clean, minimal approach focusing on essential information and functionality.

**Best For**:
- Tech-savvy clients preferring clean interfaces
- Digital-first presentations
- Simple, straightforward trips
- Fast loading and mobile optimization

**Structure**:
```
TRAVEL PACKAGE DETAILS
Destinations: [List]
Duration: [X] days
Accommodations: [Type]
Transportation: [Details]
Total Cost: [Amount]
BOOKING INFORMATION
Contact: [Details]
NEXT STEPS
```

**Example Usage**:
```typescript
// Generate functional template for tech-savvy clients
const result = await generateRemix(proposalData, {
  template: 'functional',
  theme: {
    colorScheme: 'vibrant-teal',
    typography: 'modern',
    decorative: 'icons-only',
    layout: 'compact'
  }
});
```

**Sample Output Structure**:
```html
<div class="proposal functional-template vibrant-teal compact-layout">
  <header class="functional-header">
    <h1 class="clean-title">TOKYO TECH CONFERENCE TRAVEL</h1>
    <div class="key-info-bar">
      <span class="info-block">📅 March 20-25, 2024</span>
      <span class="info-block">📍 Tokyo, Japan</span>
      <span class="info-block">💰 $3,750</span>
    </div>
  </header>
  
  <main class="functional-content">
    <section class="info-grid">
      <div class="grid-item">
        <h3 class="functional-subtitle">DESTINATIONS</h3>
        <ul class="clean-list">
          <li>Tokyo (5 days)</li>
          <li>Conference venue: Tokyo Big Sight</li>
          <li>Hotel: Shibuya district</li>
        </ul>
      </div>
      
      <div class="grid-item">
        <h3 class="functional-subtitle">ACCOMMODATIONS</h3>
        <div class="hotel-functional">
          <strong>Hotel Name:</strong> Shibuya Sky Hotel<br>
          <strong>Type:</strong> Business suite<br>
          <strong>Features:</strong> High-speed WiFi, workspace, gym
        </div>
      </div>
      
      <div class="grid-item">
        <h3 class="functional-subtitle">TRANSPORTATION</h3>
        <div class="transport-list">
          ✈️ Round-trip flights (business class)<br>
          🚇 7-day Tokyo Metro pass included<br>
          🚗 Airport transfers arranged
        </div>
      </div>
      
      <div class="grid-item">
        <h3 class="functional-subtitle">COST BREAKDOWN</h3>
        <table class="cost-table">
          <tr><td>Flights:</td><td>$2,200</td></tr>
          <tr><td>Hotel (4 nights):</td><td>$800</td></tr>
          <tr><td>Transport:</td><td>$250</td></tr>
          <tr><td>Conference:</td><td>$500</td></tr>
          <tr class="total-row"><td><strong>TOTAL:</strong></td><td><strong>$3,750</strong></td></tr>
        </table>
      </div>
    </section>
  </main>
  
  <footer class="functional-footer">
    <div class="action-buttons">
      <button class="primary-action">BOOK NOW</button>
      <button class="secondary-action">MODIFY TRIP</button>
    </div>
    <div class="contact-minimal">
      📧 booking@techtravel.com | 📞 +1-555-0199
    </div>
  </footer>
</div>
```

---

## Theme System

Themes control the visual presentation of templates through four key components:

### Color Schemes

**professional-blue**: `#2563eb`
- Clean, corporate aesthetic
- High trust and reliability
- Best for business travel

**luxury-gold**: `#d97706`  
- Premium, sophisticated feel
- Warmth and exclusivity
- Best for luxury experiences

**minimal-gray**: `#6b7280`
- Clean, modern aesthetic
- Minimal distraction
- Best for executive summaries

**vibrant-teal**: `#0891b2`
- Fresh, modern appeal
- Tech-forward aesthetic  
- Best for younger demographics

**sunset-orange**: `#ea580c`
- Warm, approachable feel
- Family-friendly aesthetic
- Best for leisure travel

### Typography Styles

**corporate**: System fonts, clean and professional
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-weight: 400;
line-height: 1.5;
```

**elegant**: Sophisticated serif typography
```css
font-family: 'Playfair Display', 'Georgia', serif;
font-weight: 400;
line-height: 1.6;
letter-spacing: 0.5px;
```

**modern**: Contemporary geometric fonts
```css
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
font-weight: 400;
line-height: 1.4;
letter-spacing: -0.2px;
```

**classic**: Timeless traditional fonts
```css
font-family: 'Times New Roman', Times, serif;
font-weight: 400;
line-height: 1.7;
```

### Decorative Elements

**none**: No decorative elements
- Clean, minimal presentation
- Focus on content

**minimal-emoji**: Essential travel icons
- 🏨 ✈️ 🌍 (Hotels, flights, destinations)
- Subtle enhancement

**rich-emoji**: Complete travel icon set  
- 🏨 ✈️ 🌍 🎭 🍽️ 🎪 🚗 (Full experience icons)
- Warm, engaging presentation

**icons-only**: Clean SVG icons
- Professional iconography
- Scalable and accessible

### Layout Styles

**compact**: Dense information layout
- Efficient space usage
- Quick scanning

**spacious**: Generous whitespace
- Easy reading
- Premium feel

**magazine**: Editorial-style layout
- Visual hierarchy
- Engaging presentation

**executive**: Streamlined summary format
- Fast decision-making
- Key information focus

---

## Remix Engine

The Remix Engine intelligently combines templates and themes with validation, optimization, and caching.

### Basic Remix Generation

```typescript
import { remixSystem } from './render/remix-system';

// Basic remix with validation
const result = await remixSystem.generateRemix(proposalData, {
  template: 'detailed',
  theme: {
    colorScheme: 'professional-blue',
    typography: 'corporate',
    decorative: 'minimal-emoji',
    layout: 'spacious'
  }
});

console.log('Generated HTML:', result.html);
console.log('Generated CSS:', result.css);
console.log('Metadata:', result.metadata);
```

### Quick Remix (Simplified)

```typescript
// Quick remix with client-type optimization
const result = await remixSystem.generateQuickRemix(proposalData, {
  client_type: 'corporate',
  presentation_style: 'summary',
  color_preference: 'professional',
  include_decorations: false,
  optimize_for_mobile: true
});
```

### Batch Generation

```typescript
// Generate multiple remix variations
const variations = [
  { template: 'detailed', theme: { colorScheme: 'professional-blue', typography: 'corporate', decorative: 'none', layout: 'spacious' }},
  { template: 'condensed', theme: { colorScheme: 'minimal-gray', typography: 'corporate', decorative: 'none', layout: 'executive' }},
  { template: 'fancy', theme: { colorScheme: 'luxury-gold', typography: 'elegant', decorative: 'rich-emoji', layout: 'magazine' }}
];

const results = await remixSystem.generateBatch(proposalData, variations);

results.forEach((result, index) => {
  console.log(`Variation ${index + 1}:`, result.metadata.template_name);
});
```

---

## Preset System

Presets provide curated template + theme combinations for common use cases.

### Built-in Presets

#### Professional Preset
```typescript
const professionalPreset = {
  colorScheme: 'professional-blue',
  typography: 'corporate', 
  decorative: 'none',
  layout: 'spacious'
};

// Usage
const result = await remixSystem.generateFromPreset(proposalData, 'professional');
```

**Best For**: Corporate clients, business travel, formal presentations

#### Luxury Preset
```typescript
const luxuryPreset = {
  colorScheme: 'luxury-gold',
  typography: 'elegant',
  decorative: 'minimal-emoji',
  layout: 'magazine'
};

// Usage
const result = await remixSystem.generateFromPreset(proposalData, 'luxury');
```

**Best For**: High-end leisure travel, VIP clients, premium experiences

#### Modern Preset
```typescript
const modernPreset = {
  colorScheme: 'vibrant-teal',
  typography: 'modern',
  decorative: 'icons-only',
  layout: 'compact'
};

// Usage
const result = await remixSystem.generateFromPreset(proposalData, 'modern');
```

**Best For**: Tech-savvy clients, millennial/Gen-Z travelers, digital-first

#### Friendly Preset
```typescript
const friendlyPreset = {
  colorScheme: 'sunset-orange',
  typography: 'modern',
  decorative: 'rich-emoji',
  layout: 'spacious'
};

// Usage
const result = await remixSystem.generateFromPreset(proposalData, 'friendly');
```

**Best For**: Family travel, vacation packages, personal relationships

#### Executive Preset
```typescript
const executivePreset = {
  colorScheme: 'minimal-gray',
  typography: 'corporate',
  decorative: 'none', 
  layout: 'executive'
};

// Usage  
const result = await remixSystem.generateFromPreset(proposalData, 'executive');
```

**Best For**: Time-pressed executives, quick approvals, summary reports

### Custom Presets

```typescript
import { customPresetManager } from './render/custom-preset-manager';

// Create custom preset
const customResult = customPresetManager.createCustomPreset(
  'corporate-modern',
  'Corporate Modern',
  'Clean corporate aesthetic with modern touches',
  {
    base_preset: 'professional',
    theme_overrides: {
      typography: 'modern',
      decorative: 'icons-only'
    },
    template_preferences: ['detailed', 'condensed'],
    use_cases: ['Corporate presentations', 'Business proposals'],
    target_audience: ['corporate', 'executive'],
    tags: ['business', 'modern', 'clean'],
    is_public: false,
    created_by: 'user-123'
  }
);

if (customResult.success) {
  console.log('Created custom preset:', customResult.preset!.name);
}
```

---

## API Usage Examples

### MCP Tools Integration

The system provides 24 MCP tools for complete integration. Here are key examples:

#### Generate from Preset
```typescript
// MCP Tool: generate_from_preset
const args = {
  trip_id: "trip-abc123",
  preset: "luxury",
  template: "fancy", // Optional override
  options: {
    include_images: true,
    optimize_for_mobile: false,
    performance_mode: "quality"
  }
};

const result = await mcp.call('generate_from_preset', args);

if (result.success) {
  console.log('Generated HTML:', result.html);
  console.log('Template used:', result.template);
  console.log('Theme applied:', result.theme);
}
```

#### Get UI Recommendations
```typescript
// MCP Tool: get_preset_recommendations_ui
const recommendations = await mcp.call('get_preset_recommendations_ui', {
  trip_id: "trip-abc123"
});

console.log('Best match:', recommendations.best_match);
console.log('All recommendations:', recommendations.recommendations);

// Use the best recommendation
const bestPreset = recommendations.best_match.preset_key;
const generatedProposal = await mcp.call('generate_from_preset', {
  trip_id: "trip-abc123",
  preset: bestPreset
});
```

#### Quick Remix Generation
```typescript
// MCP Tool: quick_remix
const quickResult = await mcp.call('quick_remix', {
  trip_id: "trip-abc123",
  client_type: "luxury",
  presentation_style: "comprehensive",
  color_preference: "warm",
  include_decorations: true,
  optimize_for_mobile: false
});

console.log('Quick remix result:', quickResult);
```

### Frontend Integration Examples

#### React Component Usage
```typescript
import { PresetSelector } from './components/PresetSelector';
import { PresetAPIClient } from './api/preset-api-client';

const apiClient = new PresetAPIClient('https://api.yourapp.com');

function TravelProposalGenerator() {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [tripId, setTripId] = useState('trip-123');
  const [generatedProposal, setGeneratedProposal] = useState(null);
  
  const handlePresetSelect = async (presetKey) => {
    setSelectedPreset(presetKey);
    
    // Generate proposal with selected preset
    const result = await apiClient.generateFromPreset(tripId, presetKey);
    
    if (result.success) {
      setGeneratedProposal(result);
      
      // Record usage for analytics
      await apiClient.recordPresetUsage({
        preset_name: presetKey,
        preset_type: 'built_in',
        user_id: 'current-user',
        session_id: 'session-456',
        context: {
          trip_id: tripId,
          template_used: result.template,
          generation_time_ms: result.generation_time,
          success: true
        },
        performance_metrics: {
          generation_time: result.generation_time,
          cache_hit: result.cache_hit,
          template_compatibility_score: 1.0,
          theme_consistency_score: 1.0
        }
      });
    }
  };
  
  return (
    <div className="proposal-generator">
      <PresetSelector
        apiClient={apiClient}
        onPresetSelect={handlePresetSelect}
        selectedPreset={selectedPreset}
        tripId={tripId}
      />
      
      {generatedProposal && (
        <div className="generated-proposal">
          <h2>Generated Proposal</h2>
          <div 
            dangerouslySetInnerHTML={{ __html: generatedProposal.html }}
          />
          <style>{generatedProposal.css}</style>
        </div>
      )}
    </div>
  );
}
```

#### Vue.js Integration
```vue
<template>
  <div class="remix-interface">
    <div class="preset-selection">
      <h2>Choose a Preset</h2>
      <div class="preset-grid">
        <div 
          v-for="preset in presets" 
          :key="preset.preset_key"
          :class="['preset-card', { active: selectedPreset === preset.preset_key }]"
          @click="selectPreset(preset.preset_key)"
        >
          <div class="preset-preview">
            <div 
              class="color-swatch" 
              :style="{ backgroundColor: preset.visual_preview.color_swatch }"
            ></div>
            <div class="preset-info">
              <h3>{{ preset.name }}</h3>
              <p>{{ preset.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="template-selection" v-if="selectedPreset">
      <h2>Choose Template</h2>
      <select v-model="selectedTemplate" @change="generateProposal">
        <option value="">Auto-select best template</option>
        <option value="detailed">Detailed - Comprehensive information</option>
        <option value="condensed">Condensed - Executive summary</option>
        <option value="fancy">Fancy - Premium presentation</option>
        <option value="functional">Functional - Clean and minimal</option>
      </select>
    </div>
    
    <div class="proposal-output" v-if="generatedHtml">
      <div v-html="generatedHtml"></div>
      <component :is="'style'" v-html="generatedCss"></component>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RemixInterface',
  data() {
    return {
      presets: [],
      selectedPreset: null,
      selectedTemplate: '',
      generatedHtml: '',
      generatedCss: '',
      loading: false
    }
  },
  async mounted() {
    await this.loadPresets();
  },
  methods: {
    async loadPresets() {
      const response = await fetch('/api/get-preset-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_customization_showcase: true })
      });
      
      const data = await response.json();
      if (data.success) {
        this.presets = data.gallery.featured_presets;
      }
    },
    
    selectPreset(presetKey) {
      this.selectedPreset = presetKey;
      this.generateProposal();
    },
    
    async generateProposal() {
      if (!this.selectedPreset) return;
      
      this.loading = true;
      
      try {
        const response = await fetch('/api/generate-from-preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: this.$route.params.tripId,
            preset: this.selectedPreset,
            template: this.selectedTemplate || undefined,
            options: {
              include_images: true,
              optimize_for_mobile: this.$isMobile
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          this.generatedHtml = result.html;
          this.generatedCss = result.css;
        }
      } catch (error) {
        console.error('Generation failed:', error);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
```

---

## Advanced Customization

### Theme Customization

```typescript
// Create custom theme variations
const customTheme: ThemeRemix = {
  colorScheme: 'luxury-gold',
  typography: 'elegant',
  decorative: 'minimal-emoji',
  layout: 'magazine'
};

// Apply custom CSS overrides
const generationOptions: RemixGenerationOptions = {
  include_images: true,
  optimize_for_mobile: false,
  performance_mode: 'quality',
  custom_css_overrides: `
    .proposal-header {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: white;
      padding: 2rem;
    }
    
    .destination-card {
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      margin: 1.5rem 0;
    }
    
    .luxury-price {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(45deg, #d97706, #f59e0b);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  `
};

const result = await remixSystem.generateRemix(proposalData, {
  template: 'fancy',
  theme: customTheme
}, generationOptions);
```

### Component Visibility Control

```typescript
// Hide specific components
const generationOptions: RemixGenerationOptions = {
  component_visibility: {
    show_executive_summary: true,
    show_destinations: true,
    show_accommodations: true,
    show_transportation: true,
    show_activities: false, // Hide activities section
    show_financials: true,
    show_next_steps: true,
    show_emergency_contacts: false // Hide emergency contacts
  }
};
```

### Performance Optimization

```typescript
// Optimize for different performance requirements
const fastGeneration: RemixGenerationOptions = {
  performance_mode: 'fast',
  include_images: false,
  optimize_for_mobile: true,
  enable_caching: true
};

const qualityGeneration: RemixGenerationOptions = {
  performance_mode: 'quality',
  include_images: true,
  image_optimization: {
    format: 'webp',
    quality: 85,
    max_width: 1200
  },
  optimize_for_mobile: false,
  enable_caching: true
};
```

---

## Best Practices

### Template Selection Guidelines

**Use Detailed Template When:**
- Trip has multiple destinations (3+ locations)
- Complex itinerary with many activities
- Corporate clients requiring comprehensive documentation
- Budget over $5,000 requiring detailed breakdown
- Multiple travelers with different needs

**Use Condensed Template When:**
- Time-pressed executives need quick review
- Simple trips (1-2 destinations, under 5 days)
- Budget approvals requiring executive summary
- Mobile-first presentation needed
- Quick decision-making required

**Use Fancy Template When:**
- Luxury travel (budget over $8,000)
- Special occasions (honeymoons, anniversaries)
- VIP clients expecting premium presentation
- Marketing materials for high-end services
- First-time luxury clients needing inspiration

**Use Functional Template When:**
- Tech-savvy clients preferring minimal design
- Business travel with straightforward requirements
- Quick booking confirmations
- Digital-native younger demographics
- When fast loading is critical

### Theme Combination Best Practices

**Highly Recommended Combinations:**

```typescript
// Corporate Excellence
{
  template: 'detailed',
  theme: {
    colorScheme: 'professional-blue',
    typography: 'corporate',
    decorative: 'none',
    layout: 'spacious'
  }
}

// Luxury Experience
{
  template: 'fancy',
  theme: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'minimal-emoji',
    layout: 'magazine'
  }
}

// Modern Efficiency
{
  template: 'functional',
  theme: {
    colorScheme: 'vibrant-teal',
    typography: 'modern',
    decorative: 'icons-only',
    layout: 'compact'
  }
}

// Executive Summary
{
  template: 'condensed',
  theme: {
    colorScheme: 'minimal-gray',
    typography: 'corporate',
    decorative: 'none',
    layout: 'executive'
  }
}

// Family Friendly
{
  template: 'detailed',
  theme: {
    colorScheme: 'sunset-orange',
    typography: 'modern',
    decorative: 'rich-emoji',
    layout: 'spacious'
  }
}
```

**Avoid These Combinations:**

```typescript
// Poor combinations to avoid
{
  template: 'functional',
  theme: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'rich-emoji', // Conflicts with minimal functional approach
    layout: 'magazine'
  }
}

{
  template: 'fancy',
  theme: {
    colorScheme: 'minimal-gray',
    typography: 'corporate',
    decorative: 'none', // Undermines fancy template's rich presentation
    layout: 'executive'
  }
}
```

### Performance Optimization

**Caching Strategy:**
```typescript
// Enable intelligent caching
const options: RemixGenerationOptions = {
  enable_caching: true,
  cache_strategy: 'intelligent', // Cache based on content similarity
  cache_duration: 3600 // 1 hour cache
};
```

**Image Optimization:**
```typescript
// Optimize images for different use cases
const webOptimized: RemixGenerationOptions = {
  include_images: true,
  image_optimization: {
    format: 'webp',
    quality: 75,
    max_width: 800,
    lazy_loading: true
  }
};

const printOptimized: RemixGenerationOptions = {
  include_images: true,
  image_optimization: {
    format: 'jpeg',
    quality: 95,
    max_width: 2048,
    print_ready: true
  }
};
```

### Error Handling

```typescript
// Robust error handling
async function generateProposalWithFallback(proposalData: ProposalData, primaryRemix: ProposalRemix) {
  try {
    // Try primary generation
    return await remixSystem.generateRemix(proposalData, primaryRemix);
  } catch (error) {
    console.warn('Primary generation failed, trying fallback:', error.message);
    
    try {
      // Fallback to professional preset
      return await remixSystem.generateFromPreset(proposalData, 'professional');
    } catch (fallbackError) {
      console.error('Fallback generation also failed:', fallbackError.message);
      
      // Final fallback to basic generation
      return await basicProposalGenerator.generate(proposalData);
    }
  }
}
```

### Validation and Quality Assurance

```typescript
// Validate before generation
const validation = remixSystem.validateRemix({
  template: 'fancy',
  theme: {
    colorScheme: 'luxury-gold',
    typography: 'elegant',
    decorative: 'rich-emoji',
    layout: 'magazine'
  }
}, proposalData);

if (validation.isValid) {
  const result = await remixSystem.generateRemix(proposalData, remix);
} else {
  console.log('Validation warnings:', validation.warnings);
  console.log('Suggestions:', validation.suggestions);
  
  // Apply suggestions or use alternative
  const improvedRemix = applyValidationSuggestions(remix, validation.suggestions);
  const result = await remixSystem.generateRemix(proposalData, improvedRemix);
}
```

---

## Troubleshooting

### Common Issues and Solutions

**Issue: Generation is slow**
```typescript
// Solution: Use performance mode
const options: RemixGenerationOptions = {
  performance_mode: 'fast',
  include_images: false,
  enable_caching: true
};
```

**Issue: Template doesn't match theme well**
```typescript
// Solution: Use preset validation
const validation = validatePresetTemplateMatch('luxury', 'functional');
if (!validation.compatible) {
  console.log('Recommendations:', validation.recommendations);
  // Use recommended template instead
}
```

**Issue: Missing trip data**
```typescript
// Solution: Use data enhancement
const proposalData = await loadProposalDataFromDB(tripId, db, { 
  enhanceWithDefaults: true 
});
```

**Issue: Accessibility concerns**
```typescript
// Solution: Use accessibility-optimized generation
const options: RemixGenerationOptions = {
  accessibility_mode: 'enhanced',
  high_contrast: true,
  screen_reader_optimized: true
};
```

This comprehensive documentation provides everything needed to effectively use the template types and remix system for generating professional travel proposals. The combination of templates, themes, and intelligent remixing creates unlimited possibilities for customized, high-quality proposal generation.