# TASK-0044: Template Architecture Implementation

## Overview
Create a modular template architecture with 4 distinct base templates and reusable components. This system will work with the custom template engine (no Nunjucks) and support theme remixing through CSS variables and dynamic content insertion.

## Template Structure
```
src/render/templates/
  layouts/
    detailed.ts       # Comprehensive proposal layout
    condensed.ts      # Executive summary layout  
    fancy.ts          # Premium/luxury layout
    functional.ts     # Clean minimal layout
  components/
    hotel-card.ts     # Hotel listing component
    city-section.ts   # Destination section component
    cost-summary.ts   # Financial breakdown component
    flight-info.ts    # Flight itinerary component
    activity-list.ts  # Tours and activities component
    next-steps.ts     # Action items component
    header.ts         # Proposal header component
    footer.ts         # Proposal footer component
  base/
    html-base.ts      # Base HTML structure
    css-base.ts       # Base CSS styles
```

## Template Implementation Strategy

### Base Templates as Functions
Since we can't use Nunjucks, implement templates as TypeScript functions:

```typescript
// layouts/detailed.ts
export function detailedTemplate(data: ProposalData, theme: ThemeRemix): string {
  const css = generateCSS(theme);
  const decorative = getDecorativeConfig(theme.decorative);
  
  return `
    ${htmlBase(data.trip_spec.title, css)}
    <body class="${theme.layout}">
      ${headerComponent(data, theme)}
      
      <main class="proposal-content">
        ${tripOverviewSection(data, theme)}
        ${destinationsSection(data, theme)}
        ${accommodationsSection(data, theme)}
        ${flightsSection(data, theme)}
        ${activitiesSection(data, theme)}
        ${financialsSection(data, theme)}
        ${nextStepsSection(data, theme)}
      </main>
      
      ${footerComponent(data, theme)}
    </body>
    </html>
  `;
}
```

### Component System
```typescript
// components/hotel-card.ts
export function hotelCardComponent(
  hotel: HotelOffering, 
  room?: RoomOffering, 
  theme: ThemeRemix
): string {
  const decorative = getDecorativeConfig(theme.decorative);
  const colors = getColorPalette(theme.colorScheme);
  
  return `
    <div class="hotel-card" style="--card-border: ${colors.border}">
      <h4>
        ${decorative.emoji.hotel} ${hotel.name}
      </h4>
      <div class="hotel-meta">
        <div class="location">
          ${decorative.emoji.location} ${hotel.city}
        </div>
        <div class="rating">
          ${generateStarRating(hotel.star_rating)}
        </div>
        ${hotel.lead_price ? `
          <div class="price">
            ${decorative.emoji.money} ${formatCurrency(hotel.lead_price)}
          </div>
        ` : ''}
      </div>
      ${hotel.amenities ? generateAmenities(hotel.amenities, theme) : ''}
      ${room ? generateRoomRates(room, theme) : ''}
    </div>
  `;
}
```

## The Four Base Templates

### 1. Detailed Template (`layouts/detailed.ts`)
**Purpose**: Comprehensive proposal with all available information
**Sections**: 
- Trip overview with party details and dates
- Detailed destination descriptions
- Full hotel information with rates and policies
- Flight itineraries with segments
- Complete activity listings
- Detailed financial breakdown
- Next steps checklist
- Insurance options

**Characteristics**:
- Maximum information density
- Professional business presentation
- Suitable for complex multi-destination trips
- Best for informed clients who want all details

### 2. Condensed Template (`layouts/condensed.ts`)
**Purpose**: Executive summary format focusing on key decisions
**Sections**:
- Trip summary (dates, destinations, party)
- Selected accommodations (top recommendations only)
- Key flights (main segments only)
- Highlight activities
- Total cost summary
- Primary next steps

**Characteristics**:
- Clean, scannable format
- Essential information only
- Perfect for busy executives
- Quick decision-making focus

### 3. Fancy Template (`layouts/fancy.ts`)
**Purpose**: Premium presentation for luxury travel
**Sections**:
- Elegant trip introduction with imagery focus
- Curated accommodation experiences
- Premium flight options
- Exclusive activities and experiences  
- Luxury service inclusions
- VIP treatment details
- Concierge next steps

**Characteristics**:
- Visual-first design
- Premium language and descriptions
- Luxury branding elements
- Emphasizes exclusive experiences

### 4. Functional Template (`layouts/functional.ts`)
**Purpose**: Clean, minimal design for straightforward presentation
**Sections**:
- Basic trip information
- Hotel selections with essential details
- Transportation summary
- Activity overview
- Cost breakdown
- Action items

**Characteristics**:
- Minimal visual design
- Fast loading and processing
- No decorative elements
- Information-focused

## Theme Integration Points

### CSS Variables
Each template uses CSS custom properties for theming:
```css
.hotel-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  font-family: var(--body-font);
}
```

### Dynamic Content
Templates adapt content based on theme:
```typescript
// In template functions
const sectionTitle = theme.decorative === 'rich-emoji' 
  ? `🏨🛏️ Accommodations 🌟`
  : theme.decorative === 'minimal-emoji'
  ? `🏨 Accommodations`
  : 'Accommodations';
```

### Responsive Behavior
All templates work across devices:
```typescript
const responsiveCSS = `
  @media (max-width: 768px) {
    .hotel-meta { grid-template-columns: 1fr; }
    .cost-breakdown { flex-direction: column; }
  }
`;
```

## Template Registry
```typescript
// templates/registry.ts
export const TEMPLATE_REGISTRY = {
  'detailed': detailedTemplate,
  'condensed': condensedTemplate, 
  'fancy': fancyTemplate,
  'functional': functionalTemplate
};

export function getTemplate(name: string): TemplateFunction {
  const template = TEMPLATE_REGISTRY[name];
  if (!template) {
    throw new Error(`Template not found: ${name}`);
  }
  return template;
}
```

## Integration with Engine
Update `engine.ts` to use new template system:
```typescript
async render(
  templateName: string, 
  data: ProposalData, 
  remix: ProposalRemix
): Promise<string> {
  const template = getTemplate(templateName);
  return template(data, remix.theme);
}
```

## Acceptance Criteria
- [ ] 4 distinct base templates implemented and working
- [ ] Component system with reusable parts
- [ ] Theme variables integrated throughout
- [ ] Responsive design on all templates
- [ ] Professional visual quality
- [ ] Performance: <200ms template rendering
- [ ] Template registry and selection system
- [ ] Consistent component interfaces

## Priority: High
## Estimated Time: 2-3 hours  
## Dependencies: TASK-0042 (Data Models), TASK-0043 (Theme System)