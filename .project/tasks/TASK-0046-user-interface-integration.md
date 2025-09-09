# TASK-0046: User Interface Integration

## Overview
Create a user-friendly interface for the remix system through MCP tool parameters and presets. This will make it easy for travel agents to select and customize proposal themes without needing technical knowledge.

## Enhanced Tool Parameters

### Updated MCP Tool Schemas

```typescript
// Enhanced generate_proposal tool
export const generateProposalSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  
  // Template selection
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional'])
    .optional()
    .default('detailed')
    .describe('Base template: detailed (comprehensive), condensed (summary), fancy (luxury), functional (minimal)'),
  
  // Quick preset selection
  style_preset: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive'])
    .optional()
    .describe('Style preset: professional (blue corporate), luxury (gold elegant), modern (teal clean), friendly (orange with emoji), executive (minimal gray)'),
  
  // Advanced customization
  advanced_styling: z.object({
    color_scheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).optional(),
    typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).optional(),
    decorative_style: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).optional(),
    layout_density: z.enum(['compact', 'spacious', 'magazine', 'executive']).optional()
  }).optional().describe('Advanced styling options - overrides style_preset if provided'),
  
  // Content options
  content_options: z.object({
    include_images: z.boolean().optional().default(true).describe('Include hotel and destination images'),
    show_agent_notes: z.boolean().optional().default(false).describe('Include agent-only information like commissions'),
    emoji_level: z.enum(['none', 'minimal', 'full']).optional().describe('Override decorative emoji usage')
  }).optional(),
  
  // Output options  
  output_options: z.object({
    image_quality: z.number().min(1).max(100).optional().default(85).describe('Image quality for web optimization'),
    optimize_for: z.enum(['web', 'print', 'email']).optional().default('web').describe('Optimize output for specific use case')
  }).optional()
});

// Preset explorer tool
export const listPresetsSchema = z.object({
  show_examples: z.boolean().optional().default(false).describe('Include example screenshots or descriptions')
});

// Template comparison tool
export const compareTemplatesSchema = z.object({
  trip_id: z.string().describe('Trip ID to use for comparison'),
  templates: z.array(z.enum(['detailed', 'condensed', 'fancy', 'functional'])).optional().describe('Templates to compare, defaults to all'),
  preset: z.string().optional().default('professional').describe('Style preset to use for comparison')
});
```

### Preset System with Descriptions

```typescript
export const STYLE_PRESETS = {
  professional: {
    name: 'Professional',
    description: 'Clean corporate look with blue color scheme, perfect for business travel',
    use_cases: ['Corporate clients', 'Business trips', 'Executive presentations'],
    theme: {
      colorScheme: 'professional-blue',
      typography: 'corporate', 
      decorative: 'none',
      layout: 'spacious'
    },
    preview_text: 'Blue theme, clean fonts, no decorative elements, spacious layout'
  },
  
  luxury: {
    name: 'Luxury',
    description: 'Elegant gold theme for premium travel experiences',
    use_cases: ['High-end leisure travel', 'Luxury accommodations', 'VIP clients'],
    theme: {
      colorScheme: 'luxury-gold',
      typography: 'elegant',
      decorative: 'minimal-emoji',
      layout: 'magazine'
    },
    preview_text: 'Gold accents, elegant serif fonts, minimal travel icons, magazine-style layout'
  },
  
  modern: {
    name: 'Modern',
    description: 'Contemporary teal design with clean icons and modern typography',
    use_cases: ['Tech-savvy clients', 'Millennials/Gen-Z', 'Urban destinations'],
    theme: {
      colorScheme: 'vibrant-teal',
      typography: 'modern', 
      decorative: 'icons-only',
      layout: 'compact'
    },
    preview_text: 'Teal colors, modern sans-serif fonts, SVG icons, compact layout'
  },
  
  friendly: {
    name: 'Friendly',
    description: 'Warm orange theme with travel emoji for a personal touch',
    use_cases: ['Family travel', 'Vacation planning', 'Leisure clients'],
    theme: {
      colorScheme: 'sunset-orange',
      typography: 'modern',
      decorative: 'rich-emoji', 
      layout: 'spacious'
    },
    preview_text: 'Warm orange colors, friendly fonts, full emoji set (🏨✈️🌍), airy layout'
  },
  
  executive: {
    name: 'Executive',
    description: 'Minimal gray design for quick decision-making',
    use_cases: ['Time-pressed executives', 'Summary reports', 'Quick approvals'],
    theme: {
      colorScheme: 'minimal-gray',
      typography: 'corporate',
      decorative: 'none',
      layout: 'executive'
    },
    preview_text: 'Minimal gray palette, corporate fonts, no decorations, executive layout'
  }
};
```

### Tool Implementation

```typescript
// List available presets
export async function handleListPresets(
  args: z.infer<typeof listPresetsSchema>
): Promise<any> {
  const presets = Object.entries(STYLE_PRESETS).map(([key, preset]) => ({
    preset_name: key,
    display_name: preset.name,
    description: preset.description,
    use_cases: preset.use_cases,
    preview: preset.preview_text,
    ...(args.show_examples && {
      theme_details: preset.theme,
      example_elements: generatePresetExamples(preset.theme)
    })
  }));
  
  return {
    success: true,
    available_presets: presets,
    usage: 'Use preset_name in the style_preset parameter when generating proposals',
    total_combinations: `${Object.keys(STYLE_PRESETS).length} presets × 4 templates = ${Object.keys(STYLE_PRESETS).length * 4} combinations available`
  };
}

// Template comparison
export async function handleCompareTemplates(
  args: z.infer<typeof compareTemplatesSchema>,
  db: D1Database
): Promise<any> {
  const generator = new ProposalGenerator();
  
  try {
    const tripData = await loadTripDataFromDB(args.trip_id, db);
    if (!tripData) {
      return { error: `Trip not found: ${args.trip_id}` };
    }
    
    const templatesToCompare = args.templates || ['detailed', 'condensed', 'fancy', 'functional'];
    const preset = STYLE_PRESETS[args.preset] || STYLE_PRESETS.professional;
    
    const comparisons = [];
    
    for (const template of templatesToCompare) {
      const remix: ProposalRemix = {
        template: template as any,
        theme: preset.theme
      };
      
      try {
        const proposal = await generator.generateProposalWithRemix(tripData, remix);
        
        comparisons.push({
          template_name: template,
          template_description: getTemplateDescription(template),
          html_size: proposal.rendered_html.length,
          generation_time: 'Generated successfully',
          preview_snippet: proposal.rendered_html.substring(0, 200) + '...',
          recommended_for: getTemplateRecommendations(template)
        });
        
      } catch (error) {
        comparisons.push({
          template_name: template,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      trip_id: args.trip_id,
      preset_used: args.preset,
      template_comparisons: comparisons,
      recommendation: generateTemplateRecommendation(tripData, comparisons)
    };
    
  } catch (error) {
    return {
      error: `Failed to compare templates: ${error.message}`,
      trip_id: args.trip_id
    };
  }
}

// Helper functions for user guidance
function getTemplateDescription(template: string): string {
  const descriptions = {
    detailed: 'Comprehensive proposal with all available information, best for complex trips',
    condensed: 'Executive summary focusing on key decisions and costs',
    fancy: 'Premium presentation emphasizing luxury and exclusive experiences',
    functional: 'Clean, minimal design for straightforward information delivery'
  };
  return descriptions[template] || 'Template description not available';
}

function getTemplateRecommendations(template: string): string[] {
  const recommendations = {
    detailed: ['Multi-destination trips', 'Corporate travel', 'Clients who want full information'],
    condensed: ['Busy executives', 'Quick approvals', 'Summary presentations'],
    fancy: ['Luxury travel', 'High-end clients', 'Premium experiences'],
    functional: ['Budget travel', 'Simple itineraries', 'Fast loading needed']
  };
  return recommendations[template] || [];
}
```

### Usage Examples and Documentation

```typescript
// Generate example outputs for documentation
export function generateUsageExamples(): any {
  return {
    basic_usage: {
      description: 'Generate a professional detailed proposal',
      mcp_call: {
        tool: 'generate_proposal',
        parameters: {
          trip_id: 'trip_123',
          template: 'detailed',
          style_preset: 'professional'
        }
      }
    },
    
    luxury_condensed: {
      description: 'Create a luxury-themed executive summary',
      mcp_call: {
        tool: 'generate_proposal', 
        parameters: {
          trip_id: 'trip_123',
          template: 'condensed',
          style_preset: 'luxury',
          content_options: {
            show_agent_notes: false,
            emoji_level: 'minimal'
          }
        }
      }
    },
    
    custom_styling: {
      description: 'Use advanced custom styling options',
      mcp_call: {
        tool: 'generate_proposal',
        parameters: {
          trip_id: 'trip_123',
          template: 'fancy',
          advanced_styling: {
            color_scheme: 'sunset-orange',
            typography: 'elegant',
            decorative_style: 'rich-emoji',
            layout_density: 'magazine'
          }
        }
      }
    },
    
    preset_exploration: {
      description: 'Explore available style presets',
      mcp_call: {
        tool: 'list_presets',
        parameters: {
          show_examples: true
        }
      }
    },
    
    template_comparison: {
      description: 'Compare how different templates look with the same data',
      mcp_call: {
        tool: 'compare_templates',
        parameters: {
          trip_id: 'trip_123',
          preset: 'modern'
        }
      }
    }
  };
}
```

## Error Messages and User Guidance

```typescript
export const USER_GUIDANCE = {
  invalid_preset: "Invalid style preset. Use 'list_presets' tool to see available options.",
  
  template_recommendations: {
    'detailed': 'Best for: Complex trips, informed clients who want all details, business travel',
    'condensed': 'Best for: Busy executives, quick decisions, summary presentations', 
    'fancy': 'Best for: Luxury travel, premium experiences, high-end clients',
    'functional': 'Best for: Simple trips, budget travel, fast loading requirements'
  },
  
  preset_recommendations: {
    'professional': 'Professional corporate clients, business travel, formal presentations',
    'luxury': 'High-end leisure travel, luxury accommodations, VIP treatment',
    'modern': 'Tech-savvy clients, contemporary destinations, clean aesthetics',
    'friendly': 'Family travel, vacation planning, personal touch desired',
    'executive': 'Time-pressed decision makers, minimal distractions, quick approval'
  },
  
  common_combinations: [
    { template: 'detailed', preset: 'professional', use_case: 'Corporate travel proposals' },
    { template: 'condensed', preset: 'executive', use_case: 'Executive summary reports' },
    { template: 'fancy', preset: 'luxury', use_case: 'Premium travel experiences' },
    { template: 'functional', preset: 'modern', use_case: 'Clean, efficient presentations' }
  ]
};
```

## Acceptance Criteria
- [ ] Enhanced MCP tool schemas support all remix options
- [ ] Style presets provide easy selection with clear descriptions
- [ ] Template comparison tool helps users choose appropriate layouts
- [ ] Error messages guide users toward valid configurations
- [ ] Documentation includes usage examples and recommendations
- [ ] User interface is intuitive for non-technical travel agents
- [ ] All preset combinations generate valid, professional proposals

## Priority: Medium
## Estimated Time: 1 hour
## Dependencies: TASK-0045 (Remix Engine Integration)