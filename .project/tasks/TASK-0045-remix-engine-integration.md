# TASK-0045: Remix Engine Integration

## Overview
Integrate the theme system with the template architecture to create a unified remix engine. This engine will combine base templates with theme variations to generate hundreds of possible proposal combinations dynamically.

## Files to Modify
- `src/render/engine.ts` - Main template engine
- `src/render/proposal-generator.ts` - Proposal generation logic
- `src/tools/proposal-tools.ts` - Tool integration

## Core Integration Points

### Enhanced Template Engine (`engine.ts`)
```typescript
export class TemplateEngine {
  private themeEngine: ThemeEngine;
  
  constructor() {
    this.themeEngine = new ThemeEngine();
  }
  
  // New method for remix-aware rendering
  async renderWithRemix(
    templateName: string,
    data: ProposalData, 
    remix: ProposalRemix
  ): Promise<string> {
    try {
      // Get the template function
      const templateFn = getTemplate(remix.template);
      
      // Apply theme customizations
      const finalTheme = this.applyCustomizations(remix.theme, remix.customizations);
      
      // Generate the HTML
      return templateFn(data, finalTheme);
      
    } catch (error) {
      console.error('Remix rendering error:', error);
      throw new Error(`Failed to render with remix: ${error.message}`);
    }
  }
  
  // Apply customizations to base theme
  private applyCustomizations(
    baseTheme: ThemeRemix, 
    customizations?: ProposalRemix['customizations']
  ): ThemeRemix {
    if (!customizations) return baseTheme;
    
    const customTheme = { ...baseTheme };
    
    // Apply emoji preferences
    if (customizations.includeEmoji === false) {
      customTheme.decorative = 'none';
    }
    
    // Apply color overrides (future enhancement)
    if (customizations.colorOverrides) {
      // Logic to merge color overrides
    }
    
    return customTheme;
  }
  
  // Backward compatibility method
  async render(
    templateName: string, 
    data: TripData, 
    options?: TemplateOptions
  ): Promise<string> {
    // Convert legacy data format to new format
    const proposalData = this.convertLegacyData(data);
    
    // Use default remix for backward compatibility
    const defaultRemix: ProposalRemix = {
      template: templateName as any || 'detailed',
      theme: {
        colorScheme: 'professional-blue',
        typography: 'corporate',
        decorative: 'none',
        layout: 'spacious'
      }
    };
    
    return this.renderWithRemix(templateName, proposalData, defaultRemix);
  }
}
```

### Updated Proposal Generator (`proposal-generator.ts`)
```typescript
export class ProposalGenerator {
  // Enhanced generation with remix support
  async generateProposalWithRemix(
    tripData: TripData,
    remix: ProposalRemix,
    options?: TemplateOptions  
  ): Promise<GeneratedProposal> {
    try {
      console.log(`Generating proposal with remix - Template: ${remix.template}, Theme: ${remix.theme.colorScheme}`);
      
      // 1. Convert trip data to proposal format
      const proposalData = await this.convertToProposalData(tripData);
      
      // 2. Process images if requested
      if (options?.include_images !== false) {
        proposalData.hotels = await this.imageProcessor.processHotelImages(proposalData.hotels);
      }
      
      // 3. Render with remix
      const html = await this.templateEngine.renderWithRemix(
        remix.template,
        proposalData,
        remix
      );
      
      // 4. Calculate costs and create proposal record
      const totalCost = this.calculateTotalCost(proposalData);
      const totalCommission = this.calculateTotalCommission(proposalData);
      
      const proposal: GeneratedProposal = {
        proposal_id: this.generateProposalId(tripData.trip_id),
        trip_id: tripData.trip_id,
        template_name: `${remix.template}-${remix.theme.colorScheme}`,
        rendered_html: html,
        json_payload: JSON.stringify({
          ...proposalData,
          remix_config: remix,
          generated_at: new Date().toISOString()
        }),
        total_cost: totalCost,
        total_commission: totalCommission,
        created_at: new Date().toISOString()
      };
      
      return proposal;
      
    } catch (error) {
      console.error('Error generating remixed proposal:', error);
      throw new Error(`Failed to generate proposal: ${error.message}`);
    }
  }
  
  // Data conversion helper
  private async convertToProposalData(tripData: TripData): Promise<ProposalData> {
    // Convert existing TripData format to comprehensive ProposalData format
    return {
      trip_spec: {
        party: { adults: 2, children: 0 }, // Default - could be enhanced from trip data
        legs: this.extractLegsFromTrip(tripData),
        prefs: {
          styles: [],
          budget_per_night: 0,
          refundable: true,
          breakfast: false
        }
      },
      hotels: tripData.hotels || [],
      rooms: [], // Could be populated from additional data
      flights: [], // Future enhancement
      ground: [], // Future enhancement  
      tours: this.convertActivitiesToTours(tripData.activities || []),
      financials: this.generateFinancials(tripData),
      next_steps: this.generateNextSteps(tripData),
      free_panels: [] // Future enhancement
    };
  }
}
```

### Tool Integration (`proposal-tools.ts`)
```typescript
// Update schemas to support remix
export const generateProposalSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional']).optional().default('detailed'),
  remix: z.string().optional().describe('Remix preset: professional, luxury, modern, friendly, executive'),
  custom_remix: z.object({
    color_scheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).optional(),
    typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).optional(),
    decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).optional(),
    layout: z.enum(['compact', 'spacious', 'magazine', 'executive']).optional()
  }).optional().describe('Custom remix configuration'),
  options: z.object({
    include_images: z.boolean().optional().default(true),
    image_quality: z.number().optional().default(85),
    show_commissions: z.boolean().optional().default(false)
  }).optional()
});

// Enhanced proposal generation handler
export async function handleGenerateProposal(
  args: z.infer<typeof generateProposalSchema>,
  db: D1Database
): Promise<any> {
  const generator = new ProposalGenerator();
  
  try {
    // Load trip data
    const tripData = await loadTripDataFromDB(args.trip_id, db);
    if (!tripData) {
      return { error: `Trip not found: ${args.trip_id}` };
    }
    
    // Determine remix configuration
    const remix = buildRemixConfig(args);
    
    // Generate proposal with remix
    const proposal = await generator.generateProposalWithRemix(
      tripData,
      remix,
      {
        ...args.options,
        custom_data: { show_commissions: args.options?.show_commissions }
      }
    );
    
    // Save to database
    await saveProposalToDB(proposal, db);
    
    return {
      success: true,
      proposal_id: proposal.proposal_id,
      trip_id: proposal.trip_id,
      template_used: remix.template,
      theme_applied: remix.theme,
      html_length: proposal.rendered_html.length,
      preview_html: proposal.rendered_html
    };
    
  } catch (error) {
    return {
      error: `Failed to generate proposal: ${error.message}`,
      trip_id: args.trip_id
    };
  }
}

// Helper to build remix configuration
function buildRemixConfig(args: any): ProposalRemix {
  // Use preset if specified
  if (args.remix && REMIX_PRESETS[args.remix]) {
    const preset = REMIX_PRESETS[args.remix];
    return {
      template: args.template || 'detailed',
      theme: preset,
      customizations: {
        showCommissions: args.options?.show_commissions,
        includeEmoji: preset.decorative !== 'none'
      }
    };
  }
  
  // Use custom remix if specified
  if (args.custom_remix) {
    return {
      template: args.template || 'detailed',
      theme: {
        colorScheme: args.custom_remix.color_scheme || 'professional-blue',
        typography: args.custom_remix.typography || 'corporate',
        decorative: args.custom_remix.decorative || 'none',
        layout: args.custom_remix.layout || 'spacious'
      },
      customizations: {
        showCommissions: args.options?.show_commissions
      }
    };
  }
  
  // Default remix
  return {
    template: args.template || 'detailed',
    theme: REMIX_PRESETS['professional']
  };
}
```

## Remix Validation and Error Handling

```typescript
// Validation helper
export function validateRemixConfig(remix: ProposalRemix): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate template exists
  if (!TEMPLATE_REGISTRY[remix.template]) {
    errors.push(`Invalid template: ${remix.template}`);
  }
  
  // Validate theme components
  if (!COLOR_SCHEMES[remix.theme.colorScheme]) {
    errors.push(`Invalid color scheme: ${remix.theme.colorScheme}`);
  }
  
  if (!TYPOGRAPHY_STYLES[remix.theme.typography]) {
    errors.push(`Invalid typography: ${remix.theme.typography}`);
  }
  
  // Add more validations...
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Performance Optimizations

1. **Template Caching**: Cache compiled template functions
2. **CSS Generation Caching**: Cache generated CSS for theme combinations  
3. **Lazy Loading**: Only load theme components when needed
4. **Memory Management**: Clean up large objects after generation

## Acceptance Criteria
- [ ] Remix engine integrates with existing template system
- [ ] All theme combinations generate valid HTML
- [ ] Tool parameters support remix presets and custom configurations
- [ ] Backward compatibility with existing proposal generation
- [ ] Performance: <500ms total generation time
- [ ] Error handling for invalid remix configurations
- [ ] Validation for all remix parameters

## Priority: High
## Estimated Time: 1-2 hours
## Dependencies: TASK-0043 (Theme System), TASK-0044 (Template Architecture)