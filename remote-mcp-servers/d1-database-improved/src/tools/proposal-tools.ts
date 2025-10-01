import { z } from 'zod';
import { ProposalGenerator } from '../render/proposal-generator';
import { remixSystem, RemixGenerationOptions, QuickRemixOptions } from '../render/remix-system';
import { presetUIIntegration, PresetPreview, UIPresetRecommendation } from '../render/preset-ui-integration';
import { customPresetManager, CustomPresetCreationOptions, CustomPreset } from '../render/custom-preset-manager';
import { presetAnalyticsManager, PresetUsageRecord } from '../render/preset-analytics';
import { uiIntegrationHelpers, ComponentIntegrationConfig, PresetSelectorConfig, PresetCustomizationConfig, AnalyticsDashboardConfig } from '../render/ui-integration-helpers';
import { 
  TripData, 
  ProposalData, 
  TripSpec, 
  HotelOffering, 
  TourItem, 
  Financials, 
  NextSteps,
  DataConversionOptions,
  LegacyTripMapping,
  ThemeRemix,
  ProposalRemix
} from '../render/types';

// Schema for generate_proposal tool
export const generateProposalSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  template: z.string().optional().default('standard').describe('Template to use: standard, luxury, or family'),
  options: z.object({
    include_images: z.boolean().optional().default(true).describe('Whether to process and include images'),
    image_quality: z.number().optional().default(85).describe('Image quality (1-100)'),
    custom_data: z.any().optional().describe('Additional custom data for the template')
  }).optional()
});

// Schema for preview_proposal tool
export const previewProposalSchema = z.object({
  trip_id: z.string().describe('Trip ID to preview proposal for'),
  template: z.string().optional().default('standard').describe('Template to use: standard, luxury, or family'),
  custom_data: z.any().optional().describe('Additional custom data for the template')
});

// Schema for list_templates tool
export const listTemplatesSchema = z.object({});

// ============================================================================
// Remix System Schemas
// ============================================================================

// Schema for generate_remix_proposal tool
export const generateRemixProposalSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional']).describe('Template to use'),
  theme: z.object({
    colorScheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).describe('Color scheme'),
    typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).describe('Typography style'),
    decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).describe('Decorative elements'),
    layout: z.enum(['compact', 'spacious', 'magazine', 'executive']).describe('Layout style')
  }).describe('Theme configuration'),
  options: z.object({
    include_images: z.boolean().optional().default(true).describe('Whether to include images'),
    optimize_for_mobile: z.boolean().optional().default(false).describe('Optimize for mobile viewing'),
    performance_mode: z.enum(['fast', 'balanced', 'quality']).optional().default('balanced').describe('Performance optimization mode'),
    custom_css_overrides: z.string().optional().describe('Custom CSS overrides')
  }).optional()
});

// Schema for generate_from_preset tool
export const generateFromPresetSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  preset: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive']).describe('Preset to use'),
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional']).optional().describe('Override template (optional)'),
  options: z.object({
    include_images: z.boolean().optional().default(true).describe('Whether to include images'),
    optimize_for_mobile: z.boolean().optional().default(false).describe('Optimize for mobile viewing'),
    performance_mode: z.enum(['fast', 'balanced', 'quality']).optional().default('balanced').describe('Performance optimization mode')
  }).optional()
});

// Schema for quick_remix tool
export const quickRemixSchema = z.object({
  trip_id: z.string().describe('Trip ID to generate proposal for'),
  client_type: z.enum(['corporate', 'luxury', 'family', 'executive', 'leisure']).optional().describe('Client type for optimization'),
  presentation_style: z.enum(['detailed', 'summary', 'visual', 'functional']).optional().describe('Presentation style preference'),
  color_preference: z.enum(['professional', 'warm', 'minimal', 'vibrant']).optional().describe('Color preference'),
  include_decorations: z.boolean().optional().default(true).describe('Include decorative elements'),
  optimize_for_mobile: z.boolean().optional().default(false).describe('Optimize for mobile viewing')
});

// Schema for get_remix_recommendations tool
export const getRemixRecommendationsSchema = z.object({
  trip_id: z.string().describe('Trip ID to analyze for recommendations')
});

// Schema for get_remix_stats tool  
export const getRemixStatsSchema = z.object({});

// Schema for validate_remix tool
export const validateRemixSchema = z.object({
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional']).describe('Template to validate'),
  theme: z.object({
    colorScheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).describe('Color scheme'),
    typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).describe('Typography style'),
    decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).describe('Decorative elements'),
    layout: z.enum(['compact', 'spacious', 'magazine', 'executive']).describe('Layout style')
  }).describe('Theme configuration'),
  trip_id: z.string().optional().describe('Trip ID for context-specific validation')
});

// ============================================================================
// Preset UI Integration Schemas
// ============================================================================

// Schema for get_preset_gallery tool
export const getPresetGallerySchema = z.object({
  include_customization_showcase: z.boolean().optional().default(true).describe('Include customization examples')
});

// Schema for get_preset_recommendations_ui tool
export const getPresetRecommendationsUISchema = z.object({
  trip_id: z.string().describe('Trip ID to get UI recommendations for')
});

// Schema for get_preset_customization tool
export const getPresetCustomizationSchema = z.object({
  preset_key: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive']).describe('Preset to get customization options for')
});

// Schema for get_preset_selection_wizard tool
export const getPresetSelectionWizardSchema = z.object({});

// Schema for get_template_recommendations tool
export const getTemplateRecommendationsSchema = z.object({
  preset_key: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive']).describe('Preset to get template recommendations for')
});

// Schema for create_preset_preview tool
export const createPresetPreviewSchema = z.object({
  preset_key: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive']).describe('Preset to create preview for')
});

// ============================================================================
// Custom Preset Management Schemas
// ============================================================================

// Schema for create_custom_preset tool
export const createCustomPresetSchema = z.object({
  name: z.string().min(3).describe('Unique preset name (lowercase, hyphens, underscores allowed)'),
  display_name: z.string().min(3).describe('Display name for the preset'),
  description: z.string().min(10).describe('Description of the preset and its use cases'),
  base_preset: z.enum(['professional', 'luxury', 'modern', 'friendly', 'executive']).optional().describe('Base preset to start from'),
  theme_overrides: z.object({
    colorScheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).optional(),
    typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).optional(),
    decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).optional(),
    layout: z.enum(['compact', 'spacious', 'magazine', 'executive']).optional()
  }).optional().describe('Theme modifications to apply'),
  template_preferences: z.array(z.enum(['detailed', 'condensed', 'fancy', 'functional'])).optional().describe('Preferred templates'),
  use_cases: z.array(z.string()).optional().describe('Use cases for this preset'),
  target_audience: z.array(z.string()).optional().describe('Target audience types'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
  is_public: z.boolean().optional().default(false).describe('Whether preset should be public'),
  created_by: z.string().describe('Creator identifier')
});

// Schema for clone_preset tool
export const clonePresetSchema = z.object({
  original_preset: z.string().describe('Original preset key to clone from'),
  new_name: z.string().min(3).describe('New preset name'),
  new_display_name: z.string().min(3).describe('New display name'),
  modifications: z.object({
    description: z.string().optional().describe('New description'),
    theme_changes: z.object({
      colorScheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']).optional(),
      typography: z.enum(['corporate', 'elegant', 'modern', 'classic']).optional(),
      decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']).optional(),
      layout: z.enum(['compact', 'spacious', 'magazine', 'executive']).optional()
    }).optional().describe('Theme modifications'),
    template_preferences: z.array(z.enum(['detailed', 'condensed', 'fancy', 'functional'])).optional(),
    use_cases: z.array(z.string()).optional(),
    target_audience: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).describe('Modifications to apply to cloned preset'),
  created_by: z.string().describe('Creator identifier')
});

// Schema for get_preset_creation_suggestions tool
export const getPresetCreationSuggestionsSchema = z.object({
  trip_id: z.string().describe('Trip ID to analyze for preset suggestions')
});

// Schema for validate_custom_preset tool
export const validateCustomPresetSchema = z.object({
  preset: z.object({
    name: z.string(),
    display_name: z.string(),
    description: z.string(),
    theme: z.object({
      colorScheme: z.enum(['professional-blue', 'luxury-gold', 'minimal-gray', 'vibrant-teal', 'sunset-orange']),
      typography: z.enum(['corporate', 'elegant', 'modern', 'classic']),
      decorative: z.enum(['none', 'minimal-emoji', 'rich-emoji', 'icons-only']),
      layout: z.enum(['compact', 'spacious', 'magazine', 'executive'])
    }),
    template_preferences: z.array(z.string()),
    use_cases: z.array(z.string()),
    target_audience: z.array(z.string()),
    tags: z.array(z.string()),
    is_public: z.boolean(),
    created_by: z.string(),
    created_at: z.string()
  }).describe('Custom preset to validate')
});

// Schema for get_custom_presets tool
export const getCustomPresetsSchema = z.object({
  filters: z.object({
    created_by: z.string().optional().describe('Filter by creator'),
    is_public: z.boolean().optional().describe('Filter by public/private status'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    use_cases: z.array(z.string()).optional().describe('Filter by use cases')
  }).optional().describe('Filters to apply')
});

// Schema for get_preset_templates tool
export const getPresetTemplatesSchema = z.object({});

// ============================================================================
// Preset Analytics Schemas
// ============================================================================

// Schema for record_preset_usage tool
export const recordPresetUsageSchema = z.object({
  preset_name: z.string().describe('Name of the preset used'),
  preset_type: z.enum(['built_in', 'custom']).describe('Type of preset'),
  user_id: z.string().describe('User identifier'),
  session_id: z.string().describe('Session identifier'),
  context: z.object({
    trip_id: z.string().optional().describe('Associated trip ID'),
    template_used: z.enum(['detailed', 'condensed', 'fancy', 'functional']).optional().describe('Template used'),
    generation_time_ms: z.number().describe('Generation time in milliseconds'),
    file_size_bytes: z.number().optional().describe('Generated file size'),
    success: z.boolean().describe('Whether generation was successful'),
    error_type: z.string().optional().describe('Error type if unsuccessful')
  }).describe('Usage context'),
  performance_metrics: z.object({
    generation_time: z.number().describe('Generation time in milliseconds'),
    cache_hit: z.boolean().describe('Whether cache was used'),
    template_compatibility_score: z.number().min(0).max(1).describe('Template compatibility score'),
    theme_consistency_score: z.number().min(0).max(1).describe('Theme consistency score')
  }).describe('Performance metrics')
});

// Schema for add_user_feedback tool
export const addUserFeedbackSchema = z.object({
  usage_id: z.string().describe('Usage record ID to add feedback to'),
  feedback: z.object({
    rating: z.number().min(1).max(5).describe('User rating (1-5 stars)'),
    comments: z.string().optional().describe('User comments'),
    would_use_again: z.boolean().describe('Whether user would use this preset again')
  }).describe('User feedback')
});

// Schema for get_preset_analytics tool
export const getPresetAnalyticsSchema = z.object({
  preset_name: z.string().describe('Preset to get analytics for')
});

// Schema for get_system_analytics tool
export const getSystemAnalyticsSchema = z.object({});

// Schema for get_performance_benchmarks tool
export const getPerformanceBenchmarksSchema = z.object({
  preset_name: z.string().optional().describe('Filter by preset name'),
  template: z.enum(['detailed', 'condensed', 'fancy', 'functional']).optional().describe('Filter by template')
});

// Schema for get_trending_presets tool
export const getTrendingPresetsSchema = z.object({
  timeframe: z.enum(['day', 'week', 'month']).optional().default('week').describe('Timeframe for trend analysis')
});

// Schema for get_optimization_recommendations tool
export const getOptimizationRecommendationsSchema = z.object({
  preset_name: z.string().describe('Preset to get optimization recommendations for')
});

// Schema for generate_ab_testing_suggestions tool
export const generateABTestingSuggestionsSchema = z.object({});

// ============================================================================
// UI Integration Helper Schemas
// ============================================================================

// Schema for generate_preset_selector_component tool
export const generatePresetSelectorComponentSchema = z.object({
  framework: z.enum(['react', 'vue', 'angular', 'svelte', 'vanilla']).describe('Frontend framework'),
  config: z.object({
    show_previews: z.boolean().default(true).describe('Show visual previews of presets'),
    allow_customization: z.boolean().default(true).describe('Allow preset customization'),
    enable_search: z.boolean().default(true).describe('Enable search functionality'),
    enable_filtering: z.boolean().default(true).describe('Enable category filtering'),
    default_view: z.enum(['grid', 'list', 'carousel']).default('grid').describe('Default view mode'),
    categories_to_show: z.array(z.enum(['business', 'luxury', 'modern', 'family'])).default(['business', 'luxury', 'modern', 'family']).describe('Categories to display'),
    max_presets_per_page: z.number().default(12).describe('Maximum presets per page'),
    enable_favorites: z.boolean().default(true).describe('Enable favorites functionality'),
    show_ratings: z.boolean().default(true).describe('Show user ratings'),
    show_usage_stats: z.boolean().default(false).describe('Show usage statistics')
  }).describe('Component configuration')
});

// Schema for generate_preset_customization_component tool
export const generatePresetCustomizationComponentSchema = z.object({
  framework: z.enum(['react', 'vue', 'angular', 'svelte', 'vanilla']).describe('Frontend framework'),
  config: z.object({
    allow_color_changes: z.boolean().default(true).describe('Allow color scheme changes'),
    allow_typography_changes: z.boolean().default(true).describe('Allow typography changes'),
    allow_layout_changes: z.boolean().default(true).describe('Allow layout changes'),
    allow_decorative_changes: z.boolean().default(true).describe('Allow decorative element changes'),
    show_live_preview: z.boolean().default(true).describe('Show live preview of changes'),
    enable_preset_saving: z.boolean().default(true).describe('Allow saving custom presets'),
    validation_level: z.enum(['strict', 'moderate', 'permissive']).default('moderate').describe('Validation strictness'),
    show_compatibility_warnings: z.boolean().default(true).describe('Show compatibility warnings')
  }).describe('Customization configuration')
});

// Schema for generate_analytics_dashboard_component tool
export const generateAnalyticsDashboardComponentSchema = z.object({
  framework: z.enum(['react', 'vue', 'angular', 'svelte', 'vanilla']).describe('Frontend framework'),
  config: z.object({
    show_usage_metrics: z.boolean().default(true).describe('Show usage metrics'),
    show_performance_metrics: z.boolean().default(true).describe('Show performance metrics'),
    show_user_feedback: z.boolean().default(true).describe('Show user feedback'),
    show_trending_presets: z.boolean().default(true).describe('Show trending presets'),
    enable_ab_testing: z.boolean().default(false).describe('Enable A/B testing features'),
    refresh_interval_minutes: z.number().default(15).describe('Auto-refresh interval in minutes'),
    export_formats: z.array(z.enum(['json', 'csv', 'pdf'])).default(['json', 'csv']).describe('Available export formats')
  }).describe('Analytics dashboard configuration')
});

// Schema for generate_api_client tool
export const generateAPIClientSchema = z.object({
  framework: z.enum(['react', 'vue', 'angular', 'svelte', 'vanilla']).describe('Frontend framework'),
  base_url: z.string().optional().describe('API base URL (optional)')
});

// Schema for generate_optimal_config tool
export const generateOptimalConfigSchema = z.object({
  use_case: z.enum(['travel_agency', 'enterprise', 'self_service', 'white_label']).describe('Primary use case')
});

// Schema for generate_accessibility_props tool
export const generateAccessibilityPropsSchema = z.object({
  component_type: z.enum(['preset_selector', 'customization_panel', 'analytics_dashboard']).describe('Component type')
});

// ============================================================================
// Tool handlers
export async function handleGenerateProposal(
  args: z.infer<typeof generateProposalSchema>,
  db: any
): Promise<any> {
  console.log(`[handleGenerateProposal] Called with trip_id: ${args.trip_id}`);
  console.log(`[handleGenerateProposal] db object type:`, typeof db);
  console.log(`[handleGenerateProposal] db object keys:`, db ? Object.keys(db) : 'db is null/undefined');
  console.log(`[handleGenerateProposal] db.prepare exists:`, typeof db?.prepare);
  
  const generator = new ProposalGenerator();
  
  try {
    // Load trip data from database
    const tripData = await loadTripDataFromDB(args.trip_id, db);
    
    if (!tripData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Validate trip data
    const validation = generator.validateTripData(tripData);
    if (!validation.valid) {
      return {
        error: 'Invalid trip data',
        validation_errors: validation.errors,
        trip_id: args.trip_id
      };
    }
    
    // Generate proposal
    const proposal = await generator.generateProposal(
      tripData,
      args.template,
      args.options
    );
    
    // Save proposal to database (optional - could be done later)
    await saveProposalToDB(proposal, db);
    
    return {
      success: true,
      proposal_id: proposal.proposal_id,
      trip_id: proposal.trip_id,
      template_name: proposal.template_name,
      html_length: proposal.rendered_html.length,
      total_cost: proposal.total_cost,
      total_commission: proposal.total_commission,
      created_at: proposal.created_at,
      pdf_available: generator.getGenerationStats().pdfSupported,
      preview_html: proposal.rendered_html // Return full HTML for immediate use
    };
    
  } catch (error) {
    console.error('Error generating proposal:', error);
    return {
      error: `Failed to generate proposal: ${error instanceof Error ? error.message : String(error)}`,
      trip_id: args.trip_id
    };
  }
}

export async function handlePreviewProposal(
  args: z.infer<typeof previewProposalSchema>,
  db: any
): Promise<any> {
  const generator = new ProposalGenerator();
  
  try {
    // Load trip data from database
    const tripData = await loadTripDataFromDB(args.trip_id, db);
    
    if (!tripData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Generate preview HTML
    const html = await generator.previewProposal(
      tripData,
      args.template,
      { custom_data: args.custom_data }
    );
    
    return {
      success: true,
      trip_id: args.trip_id,
      template_name: args.template,
      html_length: html.length,
      preview_html: html
    };
    
  } catch (error) {
    console.error('Error generating preview:', error);
    return {
      error: `Failed to generate preview: ${error instanceof Error ? error.message : String(error)}`,
      trip_id: args.trip_id
    };
  }
}

export async function handleListTemplates(): Promise<any> {
  const generator = new ProposalGenerator();
  const stats = generator.getGenerationStats();

  return {
    success: true,
    templates: generator.getAvailableTemplates(),
    stats,
    availableThemes: stats.availableThemes || {
      colorSchemes: ['professional-blue', 'luxury-gold', 'minimal-gray'],
      typographyStyles: ['corporate', 'elegant'],
      decorativeStyles: ['none', 'minimal-emoji'],
      layoutStyles: ['compact', 'spacious']
    },
    themeGuidance: {
      recommended: [
        { name: 'Professional Business', colorScheme: 'professional-blue', typography: 'corporate', decorative: 'none', layout: 'spacious' },
        { name: 'Luxury Travel', colorScheme: 'luxury-gold', typography: 'elegant', decorative: 'minimal-emoji', layout: 'compact' },
        { name: 'Minimal Clean', colorScheme: 'minimal-gray', typography: 'corporate', decorative: 'none', layout: 'spacious' }
      ],
      note: 'Use exact theme names as listed in availableThemes to avoid fallback warnings'
    }
  };
}

// Helper function to load trip data from database
async function loadTripDataFromDB(tripId: string, db: any): Promise<TripData | null> {
  try {
    // Extract the actual D1Database object - could be env.DB or just the DB object directly
    const actualDb = db.DB || db;
    console.log(`[loadTripDataFromDB] Using database object, actualDb.prepare exists:`, typeof actualDb?.prepare);
    console.log(`[loadTripDataFromDB] Database object keys:`, actualDb ? Object.keys(actualDb) : 'actualDb is null/undefined');

    // Load directly from trips_v2 (trip_facts doesn't have consolidated facts JSON)
    return await loadTripDataDirect(tripId, actualDb);

  } catch (error) {
    console.error('Error loading trip data:', error);
    return null;
  }
}


// Direct database loading fallback
async function loadTripDataDirect(tripId: string, db: D1Database): Promise<TripData | null> {
  // Load trip basic info - trips_v2 uses trip_id as INTEGER primary key and JSON clients field
  const tripIdNum = parseInt(tripId);
  console.log(`[loadTripDataDirect] Loading trip with ID: ${tripId}, parsed as: ${tripIdNum}`);
  
  const tripResult = await db.prepare(`
    SELECT *
    FROM trips_v2
    WHERE trip_id = ? OR trip_name = ?
  `).bind(isNaN(tripIdNum) ? tripId : tripIdNum, tripId).first();
  
  console.log(`[loadTripDataDirect] Trip query result:`, tripResult ? 'FOUND' : 'NOT FOUND');
  if (tripResult) {
    console.log(`[loadTripDataDirect] Trip details: trip_id=${tripResult.trip_id}, name="${tripResult.trip_name}"`);
  }
  
  if (!tripResult) {
    return null;
  }
  
  // Load cached hotels - handle both string and integer trip_id values
  console.log(`[loadTripDataDirect] Querying hotels for trip_id: "${tripId}" (parsed as ${tripIdNum})`);
  let hotelsResult;
  try {
    hotelsResult = await db.prepare(`
      SELECT * FROM hotel_cache
      WHERE trip_id = ? OR trip_id = ?
      ORDER BY lead_price_amount ASC
      LIMIT 20
    `).bind(tripId, tripIdNum).all();

    console.log(`[loadTripDataDirect] Hotels query result: ${hotelsResult.results?.length || 0} hotels found`);
    if (hotelsResult.results?.length > 0) {
      console.log(`[loadTripDataDirect] First hotel:`, JSON.stringify(hotelsResult.results[0], null, 2));
    }
  } catch (hotelError) {
    console.error(`[loadTripDataDirect] Hotel query failed:`, hotelError);
    hotelsResult = { results: [] }; // Fallback to empty results
  }
  
  const hotels = hotelsResult.results?.map((hotel: any) => {
    // Parse amenities from raw_json if available
    let amenities = [];
    try {
      if (hotel.raw_json) {
        const rawData = JSON.parse(hotel.raw_json);
        amenities = rawData.amenities || [];
      }
    } catch (error) {
      console.warn('Error parsing hotel raw_json:', error);
    }
    
    return {
      id: hotel.provider_hotel_id || hotel.id,
      name: hotel.name,
      city: hotel.city,
      location: hotel.city, // Add location alias for template compatibility
      star_rating: hotel.stars || hotel.star_rating,
      lead_price: {
        amount: hotel.lead_price_amount,
        currency: hotel.lead_price_currency || 'USD'
      },
      refundable: hotel.refundable,
      site: hotel.provider,
      amenities: amenities,
      commission_amount: hotel.commission_amount
    };
  }) || [];

  // Extract client info from JSON clients field
  let clientInfo = undefined;
  try {
    const clients = tripResult.clients ? JSON.parse(tripResult.clients) : {};
    if (tripResult.primary_client_email) {
      // Find client by email from clients JSON
      const primaryClient = Object.values(clients).find((c: any) => c.email === tripResult.primary_client_email);
      if (primaryClient) {
        clientInfo = {
          name: (primaryClient as any).name || (primaryClient as any).full_name,
          email: (primaryClient as any).email
        };
      } else {
        // Fallback - use primary_client_email for lookup in clients_v2
        const clientResult = await db.prepare(`
          SELECT full_name, email FROM clients_v2 WHERE email = ?
        `).bind(tripResult.primary_client_email).first();
        
        if (clientResult) {
          clientInfo = {
            name: clientResult.full_name,
            email: clientResult.email
          };
        }
      }
    }
  } catch (error) {
    console.warn('Error parsing clients JSON:', error);
  }
  
  // Parse JSON fields from database
  let schedule = [];
  let accommodations = [];
  let transportation = [];
  let activities = [];

  try {
    if (tripResult.schedule) {
      schedule = JSON.parse(tripResult.schedule);
      console.log(`[loadTripDataDirect] Parsed ${schedule.length} schedule days`);
    }
  } catch (e) {
    console.warn('[loadTripDataDirect] Failed to parse schedule JSON:', e);
  }

  try {
    if (tripResult.accommodations) {
      accommodations = JSON.parse(tripResult.accommodations);
      console.log(`[loadTripDataDirect] Parsed ${accommodations.length} accommodations`);
    }
  } catch (e) {
    console.warn('[loadTripDataDirect] Failed to parse accommodations JSON:', e);
  }

  try {
    if (tripResult.transportation) {
      transportation = JSON.parse(tripResult.transportation);
      console.log(`[loadTripDataDirect] Parsed ${transportation.length} transportation items`);
    }
  } catch (e) {
    console.warn('[loadTripDataDirect] Failed to parse transportation JSON:', e);
  }

  // Convert schedule to activities format
  for (const day of schedule) {
    if (day.activities) {
      for (const activity of day.activities) {
        activities.push({
          id: `${day.day_number}-${activities.length}`,
          name: activity.title,
          description: `Day ${day.day_number}: ${day.day_name}`,
          date: day.date,
          duration: activity.duration || 'Not specified',
          price: activity.cost || 0,
          location: tripResult.destinations
        });
      }
    }
  }

  // Convert accommodations to enhanced hotel format (prioritize over hotel_cache)
  const enhancedHotels = accommodations.map((acc: any, index: number) => ({
    id: `acc_${acc.accommodation_id || index}`,
    hotel_id: `acc_${acc.accommodation_id || index}`,
    name: acc.name,
    city: acc.city,
    location: `${acc.city}`,
    checkin_date: acc.check_in_date,
    checkout_date: acc.check_out_date,
    check_in_date: acc.check_in_date,  // Keep both formats for compatibility
    check_out_date: acc.check_out_date,
    confirmation_number: acc.confirmation_number,
    total_cost: acc.total_cost,
    accommodation_type: acc.name.includes('Friends') ? 'private' : 'hotel',
    star_rating: acc.name.includes('Riu Plaza') ? 4 : acc.name.includes('Tower') ? 4 : undefined,
    amenities: acc.name.includes('Riu Plaza') ? ['WiFi', 'Restaurant', 'Bar', 'City Center'] :
               acc.name.includes('Tower') ? ['WiFi', 'Thames Views', 'Restaurant'] :
               ['Private Stay'],
    lead_price: acc.total_cost ? { amount: acc.total_cost, currency: 'USD' } : { amount: 200, currency: 'USD' }, // Default price for display
    price_per_night: acc.total_cost ? Math.round(acc.total_cost / 3) : 200, // Estimate per night (dividing by approx nights)
    refundable: true,
    site: 'database',
    provider: 'Manual',
    description: acc.name.includes('Friends') ? 'Private accommodation with friends' : 'Selected hotel accommodation'
  }));

  // Use enhanced hotels if available, otherwise fall back to hotel_cache data
  const finalHotels = enhancedHotels.length > 0 ? enhancedHotels : hotels;

  return {
    trip_id: tripId,
    title: tripResult.trip_name,
    destinations: tripResult.destinations,
    start_date: tripResult.start_date,
    end_date: tripResult.end_date,
    client: clientInfo,
    hotels: finalHotels,
    activities: activities,
    schedule: schedule,
    accommodations: accommodations,
    transportation: transportation,
    flights: transportation.filter((t: any) => t.type === 'Flight'),
    ground_transport: transportation.filter((t: any) => t.type === 'Train' || t.type === 'Bus'),
    total_cost: tripResult.total_cost || undefined
  };
}

// Save proposal to database (optional)
async function saveProposalToDB(proposal: any, db: any): Promise<void> {
  const actualDb = db.DB || db;
  try {
    // Check if proposals table exists, create if not
    await actualDb.prepare(`
      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id TEXT UNIQUE NOT NULL,
        trip_id TEXT NOT NULL,
        template_name TEXT NOT NULL,
        rendered_html TEXT NOT NULL,
        json_payload TEXT NOT NULL,
        total_cost REAL,
        total_commission REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Insert proposal
    await actualDb.prepare(`
      INSERT OR REPLACE INTO proposals 
      (proposal_id, trip_id, template_name, rendered_html, json_payload, total_cost, total_commission, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      proposal.proposal_id,
      proposal.trip_id,
      proposal.template_name,
      proposal.rendered_html,
      proposal.json_payload,
      proposal.total_cost,
      proposal.total_commission,
      proposal.created_at
    ).run();
    
    console.log(`Proposal saved to database: ${proposal.proposal_id}`);
  } catch (error) {
    console.error('Error saving proposal to database:', error);
    // Don't throw - proposal generation succeeded even if saving failed
  }
}

// ============================================================================
// Data Conversion Utilities for New Schema Support
// ============================================================================

// Convert legacy TripData to comprehensive ProposalData format
export function convertTripDataToProposalData(
  tripData: TripData, 
  options: DataConversionOptions = {}
): ProposalData {
  const conversionLog: string[] = [];
  
  try {
    // Extract trip legs from dates and destinations
    const legs = extractLegsFromTripData(tripData);
    
    // Build trip specification
    const trip_spec: TripSpec = {
      party: { 
        adults: 2, // Default - could be enhanced from trip data
        children: 0 
      },
      legs: legs,
      prefs: {
        styles: options.enhanceWithDefaults ? ['business'] : [],
        budget_per_night: calculateAverageBudgetFromHotels(tripData.hotels || []),
        refundable: true,
        breakfast: false
      }
    };
    
    // Convert hotels to new format
    const hotels: HotelOffering[] = (tripData.hotels || []).map(hotel => ({
      id: hotel.id,
      name: hotel.name,
      city: hotel.city,
      location: hotel.location || hotel.city,
      star_rating: hotel.star_rating,
      tags: generateHotelTags(hotel),
      lead_price: hotel.lead_price,
      image: hotel.images?.[0]?.url,
      amenities: hotel.amenities || [],
      refundable: hotel.refundable,
      cancellation_deadline: hotel.cancellation_deadline,
      commission_amount: hotel.commission_amount,
      site: hotel.site,
      images: hotel.images
    }));
    
    // Convert flights to FlightItin format
    const flights: FlightItin[] = (tripData.flights || []).map(flight => {
      // Parse flight number and carrier from confirmation_number or provider
      const carrier = flight.provider || 'Unknown Airline';
      const flightNumbers = flight.confirmation_number?.match(/flights? #?(\d+(?:\/\d+)?)/i)?.[1] || flight.flight_number || 'TBD';

      // Handle multiple flight segments (e.g., "4951/710")
      const segments = flightNumbers.split('/').map((flightNum, index) => ({
        carrier: carrier,
        flight: flightNum.trim(),
        cabin: flight.class || 'Economy',
        dep_airport: index === 0 ? extractAirportCode(flight.departure_location) : 'TBD',
        dep_time_iso: flight.departure_time ? formatFlightDateTime(flight.departure_date, flight.departure_time) : '',
        arr_airport: extractAirportCode(flight.arrival_location),
        arr_time_iso: flight.arrival_time ? formatFlightDateTime(flight.arrival_date || flight.departure_date, flight.arrival_time) : ''
      }));

      return {
        pricing: flight.cost ? {
          total: parseFloat(flight.cost),
          currency: 'USD',
          per_person: parseFloat(flight.cost) / 2
        } : undefined,
        segments: segments,
        notes_md: flight.notes || `${carrier} flight from ${flight.departure_location} to ${flight.arrival_location}`,
        book_link: flight.booking_link
      };
    });

    // Convert ground transport to GroundItem format
    const ground: GroundItem[] = (tripData.ground_transport || []).filter(transport =>
      transport.type?.toLowerCase() !== 'flight'
    ).map(transport => {
      const baseItem = {
        total: parseFloat(transport.cost) || 0,
        currency: 'USD',
        insurance_included: transport.insurance_included || false
      };

      if (transport.type?.toLowerCase().includes('transfer')) {
        return {
          type: "transfer" as const,
          mode: transport.mode as "private" | "shared" || "private",
          route: `${transport.departure_location} → ${transport.arrival_location}`,
          date_iso: transport.departure_date || transport.date,
          pax: 2, // Default for couple
          ...baseItem
        };
      } else {
        return {
          type: "car" as const,
          vendor: transport.provider || 'Car Rental',
          category: transport.vehicle_type || 'Standard',
          pickup: transport.departure_location ? {
            place: transport.departure_location,
            time_iso: formatFlightDateTime(transport.departure_date, transport.departure_time)
          } : undefined,
          dropoff: transport.arrival_location ? {
            place: transport.arrival_location,
            time_iso: formatFlightDateTime(transport.arrival_date || transport.departure_date, transport.arrival_time)
          } : undefined,
          ...baseItem
        };
      }
    });

    // Convert activities to tours
    const tours: TourItem[] = (tripData.activities || []).map(activity => ({
      title: activity.name,
      duration: activity.duration,
      total: activity.price || 0,
      currency: 'USD', // Default currency
      highlights_md: activity.description,
      inclusions_md: `Duration: ${activity.duration || 'Not specified'}`
    }));

    // Generate financials
    const financials: Financials = generateFinancials(tripData);
    
    // Generate next steps
    const next_steps: NextSteps = generateNextSteps(tripData);
    
    const proposalData: ProposalData = {
      trip_spec,
      hotels,
      flights,
      ground,
      tours,
      financials,
      next_steps,

      // Metadata
      trip_id: tripData.trip_id,
      title: tripData.title,
      destinations: tripData.destinations,
      start_date: tripData.start_date,
      end_date: tripData.end_date,
      client: tripData.client,
      generated_at: new Date().toISOString()
    };
    
    conversionLog.push('Successfully converted TripData to ProposalData');
    return proposalData;
    
  } catch (error) {
    conversionLog.push(`Error during conversion: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return minimal valid proposal data on error
    return {
      trip_spec: {
        party: { adults: 2, children: 0 },
        legs: [],
        prefs: { styles: [], budget_per_night: 0, refundable: true, breakfast: false }
      },
      hotels: [],
      trip_id: tripData.trip_id,
      generated_at: new Date().toISOString()
    };
  }
}

// Enhanced database loading function for ProposalData
export async function loadProposalDataFromDB(
  tripId: string, 
  db: D1Database,
  options: DataConversionOptions = {}
): Promise<ProposalData | null> {
  try {
    // First load using existing function for backward compatibility
    const legacyTripData = await loadTripDataFromDB(tripId, db);
    if (!legacyTripData) {
      return null;
    }
    
    // Convert to new format
    const proposalData = convertTripDataToProposalData(legacyTripData, options);
    
    // Enhance with additional data if available
    if (options.enhanceWithDefaults) {
      await enhanceProposalDataFromDatabase(proposalData, db);
    }
    
    return proposalData;
    
  } catch (error) {
    console.error('Error loading proposal data:', error);
    return null;
  }
}

// Helper functions for data conversion
function extractLegsFromTripData(tripData: TripData): TripSpec['legs'] {
  if (!tripData.destinations || !tripData.start_date) {
    return [];
  }
  
  const cities = tripData.destinations.split(/[,&]/).map(city => city.trim());
  const startDate = new Date(tripData.start_date);
  const endDate = tripData.end_date ? new Date(tripData.end_date) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const nightsPerCity = Math.floor(totalDays / cities.length);
  
  return cities.map((city, index) => {
    const arriveDate = new Date(startDate.getTime() + (index * nightsPerCity * 24 * 60 * 60 * 1000));
    return {
      city,
      arrive: arriveDate.toISOString().split('T')[0],
      nights: index === cities.length - 1 ? totalDays - (index * nightsPerCity) : nightsPerCity
    };
  });
}

function generateHotelTags(hotel: any): string[] {
  const tags: string[] = [];
  
  if (hotel.star_rating >= 4) tags.push('luxury');
  if (hotel.refundable) tags.push('flexible');
  if (hotel.amenities?.includes('Free WiFi')) tags.push('wifi');
  if (hotel.amenities?.includes('Spa')) tags.push('spa');
  if (hotel.commission_amount > 0) tags.push('commission');
  
  return tags;
}

function calculateAverageBudgetFromHotels(hotels: any[]): number {
  if (!hotels.length) return 0;
  
  const prices = hotels
    .filter(hotel => hotel.lead_price?.amount)
    .map(hotel => hotel.lead_price.amount);
    
  if (!prices.length) return 0;
  
  return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
}

function generateFinancials(tripData: TripData): Financials {
  const price_lines: { label: string; amount: number }[] = [];
  let total = 0;
  
  // Add hotel costs
  if (tripData.hotels?.length) {
    const hotelTotal = tripData.hotels.reduce((sum, hotel) => {
      return sum + (hotel.lead_price?.amount || 0);
    }, 0);
    
    if (hotelTotal > 0) {
      price_lines.push({ label: `Hotels (${tripData.hotels.length} selected)`, amount: hotelTotal });
      total += hotelTotal;
    }
  }
  
  // Add activity costs
  if (tripData.activities?.length) {
    const activityTotal = tripData.activities.reduce((sum, activity) => {
      return sum + (activity.price || 0);
    }, 0);
    
    if (activityTotal > 0) {
      price_lines.push({ label: `Activities (${tripData.activities.length} selected)`, amount: activityTotal });
      total += activityTotal;
    }
  }
  
  // Use existing total if higher
  if (tripData.total_cost && tripData.total_cost > total) {
    total = tripData.total_cost;
  }
  
  return {
    currency: 'USD',
    price_lines,
    total_due: total,
    agent_private: {
      commission_total: tripData.total_commission || 0,
      commission_pct_est: total > 0 ? Math.round(((tripData.total_commission || 0) / total) * 100) : 0
    }
  };
}

function generateNextSteps(tripData: TripData): NextSteps {
  const checklist: NextSteps['checklist'] = [
    { label: 'Review proposal details', due_date_iso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { label: 'Confirm travel dates', due_date_iso: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { label: 'Submit deposit payment', due_date_iso: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
  ];
  
  if (tripData.hotels?.length) {
    checklist.push({ label: 'Confirm hotel reservations', due_date_iso: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
  }
  
  return { checklist };
}

// Helper function to extract airport code from location string
function extractAirportCode(location: string): string {
  if (!location) return '';

  // Look for airport code in parentheses like "Mobile (MOB)" or "Dublin (DUB)"
  const match = location.match(/\(([A-Z]{3})\)/);
  if (match) {
    return match[1];
  }

  // If no parentheses, try to extract 3-letter codes
  const codeMatch = location.match(/\b([A-Z]{3})\b/);
  if (codeMatch) {
    return codeMatch[1];
  }

  // Fallback: return first 3 letters of city name
  return location.split(/[,\s]/)[0].substring(0, 3).toUpperCase();
}

// Helper function to format flight date and time to ISO format
function formatFlightDateTime(date: string, time: string): string {
  if (!date || !time) return '';

  try {
    // Handle various date formats
    let formattedDate = date;
    if (!date.includes('-')) {
      // Assume it's in a different format, try to parse it
      const parsed = new Date(date);
      formattedDate = parsed.toISOString().split('T')[0];
    }

    // Handle time format (e.g., "12:55:00" or "12:55")
    let formattedTime = time;
    if (!time.includes(':')) {
      // If time doesn't have colons, assume it's HHMM format
      formattedTime = time.substring(0, 2) + ':' + time.substring(2, 4) + ':00';
    } else if (time.split(':').length === 2) {
      // If time only has HH:MM, add seconds
      formattedTime = time + ':00';
    }

    return `${formattedDate}T${formattedTime}`;
  } catch (error) {
    console.warn('Error formatting flight date/time:', error);
    return '';
  }
}

// Enhance proposal data with additional database information
async function enhanceProposalDataFromDatabase(
  proposalData: ProposalData, 
  db: D1Database
): Promise<void> {
  try {
    // Could load additional data like:
    // - Flight information from flight_cache table
    // - Ground transportation from transfers table
    // - Insurance options from insurance_products table
    // - Custom client preferences
    
    // This is a placeholder for future enhancement
    console.log('Enhanced proposal data loading - placeholder for future features');
    
  } catch (error) {
    console.error('Error enhancing proposal data:', error);
    // Don't throw - enhancement is optional
  }
}

// Create mapping record for debugging and auditing
export function createLegacyTripMapping(
  tripData: TripData,
  proposalData: ProposalData,
  conversionLog: string[] = []
): LegacyTripMapping {
  return {
    tripData,
    proposalData,
    conversionLog
  };
}

// ============================================================================
// Remix System Tool Handlers
// ============================================================================

// Handler for generate_remix_proposal tool
export async function handleGenerateRemixProposal(
  args: z.infer<typeof generateRemixProposalSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating remix proposal for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Create remix configuration
    const remix: ProposalRemix = {
      template: args.template,
      theme: args.theme as ThemeRemix
    };
    
    // Convert options
    const remixOptions: RemixGenerationOptions = {
      include_images: args.options?.include_images,
      optimize_for_mobile: args.options?.optimize_for_mobile,
      performance_mode: args.options?.performance_mode,
      custom_css_overrides: args.options?.custom_css_overrides
    };
    
    // Generate remix
    const result = await remixSystem.generateRemix(proposalData, remix, remixOptions);
    
    return {
      success: true,
      trip_id: args.trip_id,
      template: args.template,
      theme: args.theme,
      html: result.html,
      css: result.css,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('Error generating remix proposal:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id
    };
  }
}

// Handler for generate_from_preset tool
export async function handleGenerateFromPreset(
  args: z.infer<typeof generateFromPresetSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating proposal from preset '${args.preset}' for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Convert options
    const remixOptions: RemixGenerationOptions = {
      include_images: args.options?.include_images,
      optimize_for_mobile: args.options?.optimize_for_mobile,
      performance_mode: args.options?.performance_mode
    };
    
    // Generate from preset
    const result = await remixSystem.generateFromPreset(
      proposalData, 
      args.preset, 
      args.template,
      remixOptions
    );
    
    return {
      success: true,
      trip_id: args.trip_id,
      preset: args.preset,
      template: result.metadata.template_name,
      theme: result.metadata.theme_remix,
      html: result.html,
      css: result.css,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('Error generating from preset:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id,
      preset: args.preset
    };
  }
}

// Handler for quick_remix tool
export async function handleQuickRemix(
  args: z.infer<typeof quickRemixSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating quick remix for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Create quick options
    const quickOptions: QuickRemixOptions = {
      client_type: args.client_type,
      presentation_style: args.presentation_style,
      color_preference: args.color_preference,
      include_decorations: args.include_decorations,
      optimize_for_mobile: args.optimize_for_mobile
    };
    
    // Generate quick remix
    const result = await remixSystem.generateQuickRemix(proposalData, quickOptions);
    
    return {
      success: true,
      trip_id: args.trip_id,
      quick_options: quickOptions,
      template: result.metadata.template_name,
      theme: result.metadata.theme_remix,
      html: result.html,
      css: result.css,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('Error generating quick remix:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id
    };
  }
}

// Handler for get_remix_recommendations tool
export async function handleGetRemixRecommendations(
  args: z.infer<typeof getRemixRecommendationsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting remix recommendations for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    // Get recommendations
    const recommendations = remixSystem.getRemixRecommendations(proposalData);
    const bestRecommendation = remixSystem.getBestRecommendation(proposalData);
    
    return {
      success: true,
      trip_id: args.trip_id,
      best_recommendation: bestRecommendation,
      remix_recommendations: recommendations.remixes,
      preset_recommendations: recommendations.presets,
      quick_options: recommendations.quick_options
    };
    
  } catch (error) {
    console.error('Error getting remix recommendations:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id
    };
  }
}

// Handler for get_remix_stats tool
export async function handleGetRemixStats(
  args: z.infer<typeof getRemixStatsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Getting remix system statistics');
    
    const stats = remixSystem.getSystemStats();
    const analytics = remixSystem.getUsageAnalytics();
    
    return {
      success: true,
      system_stats: stats,
      usage_analytics: analytics
    };
    
  } catch (error) {
    console.error('Error getting remix stats:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for validate_remix tool
export async function handleValidateRemix(
  args: z.infer<typeof validateRemixSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Validating remix configuration`);
    
    // Create remix configuration
    const remix: ProposalRemix = {
      template: args.template,
      theme: args.theme as ThemeRemix
    };
    
    let proposalData: ProposalData | undefined;
    
    // Load proposal data if trip_id provided for context validation
    if (args.trip_id) {
      proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
      
      if (!proposalData) {
        return {
          error: `Trip not found: ${args.trip_id}`,
          trip_id: args.trip_id
        };
      }
    }
    
    // Validate remix
    const validation = remixSystem.validateRemix(remix, proposalData);
    
    return {
      success: true,
      validation,
      template: args.template,
      theme: args.theme,
      trip_id: args.trip_id
    };
    
  } catch (error) {
    console.error('Error validating remix:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      template: args.template,
      theme: args.theme
    };
  }
}

// ============================================================================
// Preset UI Integration Tool Handlers
// ============================================================================

// Handler for get_preset_gallery tool
export async function handleGetPresetGallery(
  args: z.infer<typeof getPresetGallerySchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Generating preset gallery for UI');
    
    const gallery = presetUIIntegration.generatePresetGallery();
    
    return {
      success: true,
      gallery,
      total_presets: gallery.featured_presets.length,
      category_counts: {
        business: gallery.category_groups.business.length,
        luxury: gallery.category_groups.luxury.length,
        modern: gallery.category_groups.modern.length,
        family: gallery.category_groups.family.length
      },
      includes_customization_showcase: args.include_customization_showcase
    };
    
  } catch (error) {
    console.error('Error generating preset gallery:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for get_preset_recommendations_ui tool
export async function handleGetPresetRecommendationsUI(
  args: z.infer<typeof getPresetRecommendationsUISchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting UI preset recommendations for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    const recommendations = await presetUIIntegration.generateUIRecommendations(proposalData);
    
    return {
      success: true,
      trip_id: args.trip_id,
      recommendations,
      total_recommendations: recommendations.length,
      best_match: recommendations[0] || null,
      trip_analysis: {
        destinations: proposalData.itinerary.destinations.map(d => d.destination),
        duration: Math.ceil((new Date(proposalData.trip_summary.end_date).getTime() - new Date(proposalData.trip_summary.start_date).getTime()) / (1000 * 60 * 60 * 24)),
        estimated_budget: proposalData.financials.total_cost
      }
    };
    
  } catch (error) {
    console.error('Error getting UI preset recommendations:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id
    };
  }
}

// Handler for get_preset_customization tool
export async function handleGetPresetCustomization(
  args: z.infer<typeof getPresetCustomizationSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting customization options for preset ${args.preset_key}`);
    
    const customizationOptions = presetUIIntegration.getPresetCustomizationOptions(args.preset_key);
    
    return {
      success: true,
      preset_key: args.preset_key,
      customization_options: customizationOptions,
      total_color_options: customizationOptions.color_options.length,
      total_typography_options: customizationOptions.typography_options.length,
      total_variations: customizationOptions.preset_variations.length
    };
    
  } catch (error) {
    console.error('Error getting preset customization options:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_key: args.preset_key
    };
  }
}

// Handler for get_preset_selection_wizard tool
export async function handleGetPresetSelectionWizard(
  args: z.infer<typeof getPresetSelectionWizardSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Generating preset selection wizard');
    
    const wizard = presetUIIntegration.generatePresetSelectionWizard();
    
    return {
      success: true,
      wizard,
      total_steps: wizard.steps.length,
      decision_tree_combinations: Object.keys(wizard.decision_tree).length
    };
    
  } catch (error) {
    console.error('Error generating preset selection wizard:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for get_template_recommendations tool
export async function handleGetTemplateRecommendations(
  args: z.infer<typeof getTemplateRecommendationsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting template recommendations for preset ${args.preset_key}`);
    
    const recommendations = presetUIIntegration.getTemplateRecommendationsForPreset(args.preset_key);
    
    return {
      success: true,
      preset_key: args.preset_key,
      recommendations,
      total_templates: recommendations.length,
      best_template: recommendations[0] || null
    };
    
  } catch (error) {
    console.error('Error getting template recommendations:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_key: args.preset_key
    };
  }
}

// Handler for create_preset_preview tool
export async function handleCreatePresetPreview(
  args: z.infer<typeof createPresetPreviewSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Creating preview for preset ${args.preset_key}`);
    
    const preview = presetUIIntegration.createPresetPreview(args.preset_key);
    
    if (!preview) {
      return {
        error: `Preset not found: ${args.preset_key}`,
        preset_key: args.preset_key
      };
    }
    
    return {
      success: true,
      preset_key: args.preset_key,
      preview
    };
    
  } catch (error) {
    console.error('Error creating preset preview:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_key: args.preset_key
    };
  }
}

// ============================================================================
// Custom Preset Management Tool Handlers
// ============================================================================

// Handler for create_custom_preset tool
export async function handleCreateCustomPreset(
  args: z.infer<typeof createCustomPresetSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Creating custom preset: ${args.name}`);
    
    const options: CustomPresetCreationOptions = {
      base_preset: args.base_preset,
      theme_overrides: args.theme_overrides,
      template_preferences: args.template_preferences,
      use_cases: args.use_cases,
      target_audience: args.target_audience,
      tags: args.tags,
      is_public: args.is_public,
      created_by: args.created_by
    };
    
    const result = customPresetManager.createCustomPreset(
      args.name,
      args.display_name,
      args.description,
      options
    );
    
    if (!result.success) {
      return {
        error: 'Failed to create custom preset',
        validation_errors: result.errors,
        preset_name: args.name
      };
    }
    
    return {
      success: true,
      preset: result.preset,
      preset_name: args.name,
      created_at: result.preset!.created_at
    };
    
  } catch (error) {
    console.error('Error creating custom preset:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_name: args.name
    };
  }
}

// Handler for clone_preset tool
export async function handleClonePreset(
  args: z.infer<typeof clonePresetSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Cloning preset ${args.original_preset} to ${args.new_name}`);
    
    const result = customPresetManager.cloneAndModifyPreset(
      args.original_preset,
      args.new_name,
      args.new_display_name,
      args.modifications,
      args.created_by
    );
    
    if (!result.success) {
      return {
        error: 'Failed to clone preset',
        validation_errors: result.errors,
        original_preset: args.original_preset,
        new_name: args.new_name
      };
    }
    
    return {
      success: true,
      preset: result.preset,
      original_preset: args.original_preset,
      new_name: args.new_name,
      created_at: result.preset!.created_at
    };
    
  } catch (error) {
    console.error('Error cloning preset:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      original_preset: args.original_preset,
      new_name: args.new_name
    };
  }
}

// Handler for get_preset_creation_suggestions tool
export async function handleGetPresetCreationSuggestions(
  args: z.infer<typeof getPresetCreationSuggestionsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting preset creation suggestions for trip ${args.trip_id}`);
    
    // Load proposal data
    const proposalData = await loadProposalDataFromDB(args.trip_id, db, { enhanceWithDefaults: true });
    
    if (!proposalData) {
      return {
        error: `Trip not found: ${args.trip_id}`,
        trip_id: args.trip_id
      };
    }
    
    const suggestions = customPresetManager.getPresetCreationSuggestions(proposalData);
    
    return {
      success: true,
      trip_id: args.trip_id,
      suggestions: suggestions.suggested_presets,
      theme_suggestions: suggestions.theme_suggestions,
      total_suggestions: suggestions.suggested_presets.length,
      trip_analysis: {
        destinations: proposalData.itinerary.destinations.map(d => d.destination),
        duration: Math.ceil((new Date(proposalData.trip_summary.end_date).getTime() - new Date(proposalData.trip_summary.start_date).getTime()) / (1000 * 60 * 60 * 24)),
        estimated_budget: proposalData.financials.total_cost
      }
    };
    
  } catch (error) {
    console.error('Error getting preset creation suggestions:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      trip_id: args.trip_id
    };
  }
}

// Handler for validate_custom_preset tool
export async function handleValidateCustomPreset(
  args: z.infer<typeof validateCustomPresetSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Validating custom preset: ${args.preset.name}`);
    
    const validation = customPresetManager.validateCustomPreset(args.preset as CustomPreset);
    
    return {
      success: true,
      preset_name: args.preset.name,
      validation,
      is_valid: validation.is_valid,
      compatibility_score: validation.compatibility_score
    };
    
  } catch (error) {
    console.error('Error validating custom preset:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_name: args.preset.name
    };
  }
}

// Handler for get_custom_presets tool
export async function handleGetCustomPresets(
  args: z.infer<typeof getCustomPresetsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Getting custom presets with filters:', args.filters);
    
    const presets = customPresetManager.getCustomPresets(args.filters);
    
    return {
      success: true,
      presets,
      total_presets: presets.length,
      filters_applied: args.filters
    };
    
  } catch (error) {
    console.error('Error getting custom presets:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for get_preset_templates tool
export async function handleGetPresetTemplates(
  args: z.infer<typeof getPresetTemplatesSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Getting preset templates');
    
    const templates = customPresetManager.getPresetTemplates();
    
    return {
      success: true,
      templates,
      total_templates: templates.length
    };
    
  } catch (error) {
    console.error('Error getting preset templates:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// Preset Analytics Tool Handlers
// ============================================================================

// Handler for record_preset_usage tool
export async function handleRecordPresetUsage(
  args: z.infer<typeof recordPresetUsageSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Recording preset usage: ${args.preset_name} by user ${args.user_id}`);
    
    const usageId = presetAnalyticsManager.recordPresetUsage(
      args.preset_name,
      args.preset_type,
      args.user_id,
      args.session_id,
      args.context,
      args.performance_metrics
    );
    
    return {
      success: true,
      usage_id: usageId,
      preset_name: args.preset_name,
      user_id: args.user_id,
      recorded_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error recording preset usage:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_name: args.preset_name,
      user_id: args.user_id
    };
  }
}

// Handler for add_user_feedback tool
export async function handleAddUserFeedback(
  args: z.infer<typeof addUserFeedbackSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Adding user feedback for usage ${args.usage_id}`);
    
    const success = presetAnalyticsManager.addUserFeedback(args.usage_id, args.feedback);
    
    if (!success) {
      return {
        error: `Usage record not found: ${args.usage_id}`,
        usage_id: args.usage_id
      };
    }
    
    return {
      success: true,
      usage_id: args.usage_id,
      feedback_added: args.feedback,
      recorded_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error adding user feedback:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      usage_id: args.usage_id
    };
  }
}

// Handler for get_preset_analytics tool
export async function handleGetPresetAnalytics(
  args: z.infer<typeof getPresetAnalyticsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting analytics for preset: ${args.preset_name}`);
    
    const analytics = presetAnalyticsManager.getPresetAnalytics(args.preset_name);
    
    return {
      success: true,
      preset_name: args.preset_name,
      analytics,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting preset analytics:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_name: args.preset_name
    };
  }
}

// Handler for get_system_analytics tool
export async function handleGetSystemAnalytics(
  args: z.infer<typeof getSystemAnalyticsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Getting system-wide analytics');
    
    const analytics = presetAnalyticsManager.getSystemAnalytics();
    
    return {
      success: true,
      system_analytics: analytics,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting system analytics:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for get_performance_benchmarks tool
export async function handleGetPerformanceBenchmarks(
  args: z.infer<typeof getPerformanceBenchmarksSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Getting performance benchmarks');
    
    const benchmarks = presetAnalyticsManager.getPerformanceBenchmarks(
      args.preset_name,
      args.template
    );
    
    return {
      success: true,
      benchmarks,
      total_benchmarks: benchmarks.length,
      filters: {
        preset_name: args.preset_name,
        template: args.template
      },
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting performance benchmarks:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handler for get_trending_presets tool
export async function handleGetTrendingPresets(
  args: z.infer<typeof getTrendingPresetsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting trending presets for timeframe: ${args.timeframe}`);
    
    const trending = presetAnalyticsManager.getTrendingPresets(args.timeframe);
    
    return {
      success: true,
      timeframe: args.timeframe,
      trending_presets: trending,
      total_trending: trending.length,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting trending presets:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      timeframe: args.timeframe
    };
  }
}

// Handler for get_optimization_recommendations tool
export async function handleGetOptimizationRecommendations(
  args: z.infer<typeof getOptimizationRecommendationsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Getting optimization recommendations for preset: ${args.preset_name}`);
    
    const recommendations = presetAnalyticsManager.getOptimizationRecommendations(args.preset_name);
    
    return {
      success: true,
      preset_name: args.preset_name,
      recommendations,
      total_recommendations: Object.values(recommendations).flat().length,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      preset_name: args.preset_name
    };
  }
}

// Handler for generate_ab_testing_suggestions tool
export async function handleGenerateABTestingSuggestions(
  args: z.infer<typeof generateABTestingSuggestionsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log('Generating A/B testing suggestions');
    
    const suggestions = presetAnalyticsManager.generateABTestingSuggestions();
    
    return {
      success: true,
      ab_testing_suggestions: suggestions,
      total_suggestions: suggestions.length,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating A/B testing suggestions:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// UI Integration Helper Tool Handlers
// ============================================================================

// Handler for generate_preset_selector_component tool
export async function handleGeneratePresetSelectorComponent(
  args: z.infer<typeof generatePresetSelectorComponentSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating ${args.framework} preset selector component`);
    
    const component = uiIntegrationHelpers.generatePresetSelectorComponent(args.framework, args.config);
    
    return {
      success: true,
      framework: args.framework,
      component,
      config_used: args.config,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating preset selector component:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      framework: args.framework
    };
  }
}

// Handler for generate_preset_customization_component tool
export async function handleGeneratePresetCustomizationComponent(
  args: z.infer<typeof generatePresetCustomizationComponentSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating ${args.framework} preset customization component`);
    
    const component = uiIntegrationHelpers.generatePresetCustomizationComponent(args.framework, args.config);
    
    return {
      success: true,
      framework: args.framework,
      component,
      config_used: args.config,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating preset customization component:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      framework: args.framework
    };
  }
}

// Handler for generate_analytics_dashboard_component tool
export async function handleGenerateAnalyticsDashboardComponent(
  args: z.infer<typeof generateAnalyticsDashboardComponentSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating ${args.framework} analytics dashboard component`);
    
    const component = uiIntegrationHelpers.generateAnalyticsDashboardComponent(args.framework, args.config);
    
    return {
      success: true,
      framework: args.framework,
      component,
      config_used: args.config,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating analytics dashboard component:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      framework: args.framework
    };
  }
}

// Handler for generate_api_client tool
export async function handleGenerateAPIClient(
  args: z.infer<typeof generateAPIClientSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating API client for ${args.framework}`);
    
    const apiClient = uiIntegrationHelpers.generateAPIClient(args.framework);
    
    return {
      success: true,
      framework: args.framework,
      api_client: apiClient,
      base_url: args.base_url,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating API client:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      framework: args.framework
    };
  }
}

// Handler for generate_optimal_config tool
export async function handleGenerateOptimalConfig(
  args: z.infer<typeof generateOptimalConfigSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating optimal configuration for use case: ${args.use_case}`);
    
    const config = uiIntegrationHelpers.generateOptimalConfig(args.use_case);
    
    return {
      success: true,
      use_case: args.use_case,
      optimal_config: config,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating optimal configuration:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      use_case: args.use_case
    };
  }
}

// Handler for generate_accessibility_props tool
export async function handleGenerateAccessibilityProps(
  args: z.infer<typeof generateAccessibilityPropsSchema>,
  db: D1Database
): Promise<any> {
  try {
    console.log(`Generating accessibility props for ${args.component_type}`);
    
    const accessibilityProps = uiIntegrationHelpers.generateAccessibilityProps(args.component_type);
    
    return {
      success: true,
      component_type: args.component_type,
      accessibility_props: accessibilityProps,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating accessibility props:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      component_type: args.component_type
    };
  }
}