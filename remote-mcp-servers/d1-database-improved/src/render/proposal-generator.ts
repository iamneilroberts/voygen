import { TemplateEngine } from './engine';
import { templateFactory, TemplateFactory, renderTemplate, getAllTemplates } from './templates';
import { ThemeEngine } from './themes/theme-engine';
import { BatchImageProcessor } from './image-manager';
import { PDFGenerator } from './pdf-generator';
import { 
  TripData, 
  ProposalData, 
  GeneratedProposal, 
  TemplateOptions, 
  ProposalRemix,
  ThemeRemix 
} from './types';
import { convertTripDataToProposalData } from '../tools/proposal-tools';

export class ProposalGenerator {
  private templateEngine: TemplateEngine;
  private templateFactory: TemplateFactory;
  private themeEngine: ThemeEngine;
  private imageProcessor: BatchImageProcessor;
  private pdfGenerator: PDFGenerator;
  
  constructor() {
    this.templateEngine = new TemplateEngine();
    this.templateFactory = templateFactory;
    this.themeEngine = new ThemeEngine();
    this.imageProcessor = new BatchImageProcessor();
    this.pdfGenerator = new PDFGenerator();
  }
  
  async generateProposal(
    tripData: TripData,
    templateName: string = 'standard',
    options?: TemplateOptions
  ): Promise<GeneratedProposal> {
    try {
      console.log(`Generating proposal for trip ${tripData.trip_id} with template ${templateName}`);
      
      // 1. Process images if requested
      let processedData = tripData;
      if (options?.include_images !== false) {
        console.log('Processing images...');
        processedData = await this.imageProcessor.processProposalImages(tripData);
      }
      
      // 2. Render HTML
      console.log('Rendering HTML template...');
      const html = await this.templateEngine.render(templateName, processedData, options);
      
      // 3. Generate PDF (stubbed for Cloudflare Workers)
      let pdfBuffer: Buffer | null = null;
      const pdfCapabilities = this.pdfGenerator.getCapabilities();
      
      if (pdfCapabilities.available) {
        console.log('Generating PDF...');
        pdfBuffer = await this.pdfGenerator.generatePDF(html);
      } else {
        console.log('PDF generation not available:', pdfCapabilities.reason);
      }
      
      // 4. Calculate costs
      const totalCost = this.calculateTotalCost(processedData);
      const totalCommission = this.calculateTotalCommission(processedData);
      
      // 5. Create proposal record
      const proposal: GeneratedProposal = {
        proposal_id: this.generateProposalId(tripData.trip_id),
        trip_id: tripData.trip_id,
        template_name: templateName,
        rendered_html: html,
        json_payload: JSON.stringify({
          ...processedData,
          template_options: options,
          generated_at: new Date().toISOString(),
          pdf_available: pdfCapabilities.available
        }),
        total_cost: totalCost,
        total_commission: totalCommission,
        created_at: new Date().toISOString()
      };
      
      console.log(`Proposal generated successfully: ${proposal.proposal_id}`);
      return proposal;
      
    } catch (error) {
      console.error('Error generating proposal:', error);
      throw new Error(`Failed to generate proposal: ${error.message}`);
    }
  }
  
  async previewProposal(
    tripData: TripData,
    templateName: string = 'standard',
    options?: TemplateOptions
  ): Promise<string> {
    try {
      console.log(`Generating preview for trip ${tripData.trip_id}`);
      
      // Process images for preview
      let processedData = tripData;
      if (options?.include_images !== false) {
        processedData = await this.imageProcessor.processProposalImages(tripData);
      }
      
      // Render HTML only
      return await this.templateEngine.render(templateName, processedData, options);
    } catch (error) {
      console.error('Error generating preview:', error);
      throw new Error(`Failed to generate preview: ${error.message}`);
    }
  }
  
  private generateProposalId(tripId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `proposal_${tripId}_${timestamp}_${random}`;
  }
  
  private calculateTotalCost(tripData: TripData): number {
    let total = 0;
    
    // Add hotel costs
    if (tripData.hotels && Array.isArray(tripData.hotels)) {
      for (const hotel of tripData.hotels) {
        if (hotel.lead_price?.amount) {
          total += hotel.lead_price.amount;
        }
      }
    }
    
    // Add activity costs
    if (tripData.activities && Array.isArray(tripData.activities)) {
      for (const activity of tripData.activities) {
        if (activity.price) {
          total += activity.price;
        }
      }
    }
    
    // Use existing total_cost if available and higher
    if (tripData.total_cost && tripData.total_cost > total) {
      total = tripData.total_cost;
    }
    
    return Math.round(total * 100) / 100; // Round to 2 decimal places
  }
  
  private calculateTotalCommission(tripData: TripData): number {
    let total = 0;
    
    // Add hotel commissions
    if (tripData.hotels && Array.isArray(tripData.hotels)) {
      for (const hotel of tripData.hotels) {
        if (hotel.commission_amount) {
          total += hotel.commission_amount;
        }
      }
    }
    
    // Use existing total_commission if available and higher
    if (tripData.total_commission && tripData.total_commission > total) {
      total = tripData.total_commission;
    }
    
    return Math.round(total * 100) / 100; // Round to 2 decimal places
  }
  
  // Get available templates
  getAvailableTemplates(): Array<{ name: string; description: string; suitableFor?: string[] }> {
    return getAllTemplates().map(({ key, info }) => ({
      name: key,
      description: info.description,
      suitableFor: info.suitableFor
    }));
  }
  
  // Validate trip data before generation
  validateTripData(tripData: TripData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!tripData.trip_id) {
      errors.push('trip_id is required');
    }
    
    if (!tripData.hotels || !Array.isArray(tripData.hotels) || tripData.hotels.length === 0) {
      errors.push('At least one hotel is required for proposal generation');
    }
    
    // Validate hotel data
    if (tripData.hotels) {
      for (let i = 0; i < tripData.hotels.length; i++) {
        const hotel = tripData.hotels[i];
        if (!hotel.name) {
          errors.push(`Hotel at index ${i} is missing name`);
        }
        if (!hotel.city && !hotel.location) {
          errors.push(`Hotel at index ${i} is missing location information`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Get proposal generation statistics
  getGenerationStats(): {
    templatesAvailable: number;
    themeCombinations: number;
    pdfSupported: boolean;
    imageProcessingSupported: boolean;
  } {
    return {
      templatesAvailable: this.getAvailableTemplates().length,
      themeCombinations: this.themeEngine.getThemeStats().totalCombinations,
      pdfSupported: this.pdfGenerator.getCapabilities().available,
      imageProcessingSupported: true
    };
  }
  
  // ============================================================================
  // New Schema Support Methods
  // ============================================================================
  
  // Generate proposal with comprehensive ProposalData and remix support
  async generateProposalWithRemix(
    tripData: TripData,
    remix: ProposalRemix,
    options?: TemplateOptions  
  ): Promise<GeneratedProposal> {
    try {
      console.log(`Generating proposal with remix - Template: ${remix.template}, Theme: ${remix.theme.colorScheme}`);
      
      // 1. Convert trip data to comprehensive proposal format
      const proposalData = convertTripDataToProposalData(tripData, { 
        enhanceWithDefaults: true 
      });
      
      // 2. Process images if requested
      if (options?.include_images !== false) {
        proposalData.hotels = await this.processHotelImages(proposalData.hotels);
      }
      
      // 3. Generate proposal using new data model
      const proposal = await this.generateFromProposalData(
        proposalData,
        remix,
        options
      );
      
      return proposal;
      
    } catch (error) {
      console.error('Error generating remixed proposal:', error);
      throw new Error(`Failed to generate proposal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Generate proposal from comprehensive ProposalData
  async generateFromProposalData(
    proposalData: ProposalData,
    remix: ProposalRemix,
    options?: TemplateOptions
  ): Promise<GeneratedProposal> {
    try {
      console.log(`Generating proposal from ProposalData for trip ${proposalData.trip_id}`);
      
      // 1. Validate proposal data
      const validation = this.validateProposalData(proposalData);
      if (!validation.valid) {
        throw new Error(`Invalid proposal data: ${validation.errors.join(', ')}`);
      }
      
      // 2. Render HTML with new template system and remix
      const html = await this.templateFactory.renderTemplate(
        remix.template,
        proposalData,
        remix.theme,
        options
      );
      
      // 3. Generate PDF if available
      let pdfBuffer: Buffer | null = null;
      const pdfCapabilities = this.pdfGenerator.getCapabilities();
      
      if (pdfCapabilities.available) {
        console.log('Generating PDF...');
        pdfBuffer = await this.pdfGenerator.generatePDF(html);
      }
      
      // 4. Calculate comprehensive costs
      const totalCost = this.calculateComprehensiveCost(proposalData);
      const totalCommission = this.calculateComprehensiveCommission(proposalData);
      
      // 5. Create proposal record
      const proposal: GeneratedProposal = {
        proposal_id: this.generateProposalId(proposalData.trip_id),
        trip_id: proposalData.trip_id,
        template_name: `${remix.template}-${remix.theme.colorScheme}`,
        rendered_html: html,
        json_payload: JSON.stringify({
          ...proposalData,
          remix_config: remix,
          template_options: options,
          generated_at: new Date().toISOString(),
          pdf_available: pdfCapabilities.available
        }),
        total_cost: totalCost,
        total_commission: totalCommission,
        created_at: new Date().toISOString()
      };
      
      console.log(`Enhanced proposal generated successfully: ${proposal.proposal_id}`);
      return proposal;
      
    } catch (error) {
      console.error('Error generating proposal from ProposalData:', error);
      throw new Error(`Failed to generate proposal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // ============================================================================
  // Data Validation and Conversion
  // ============================================================================
  
  // Validate comprehensive proposal data
  validateProposalData(proposalData: ProposalData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!proposalData.trip_id) {
      errors.push('trip_id is required');
    }
    
    if (!proposalData.trip_spec) {
      errors.push('trip_spec is required');
    } else {
      if (!proposalData.trip_spec.party || proposalData.trip_spec.party.adults < 1) {
        errors.push('At least one adult is required in party');
      }
      
      if (!proposalData.trip_spec.legs || proposalData.trip_spec.legs.length === 0) {
        errors.push('At least one destination leg is required');
      }
    }
    
    if (!proposalData.hotels || proposalData.hotels.length === 0) {
      errors.push('At least one hotel is required for proposal generation');
    }
    
    // Validate hotel data
    if (proposalData.hotels) {
      for (let i = 0; i < proposalData.hotels.length; i++) {
        const hotel = proposalData.hotels[i];
        if (!hotel.name) {
          errors.push(`Hotel at index ${i} is missing name`);
        }
        if (!hotel.city) {
          errors.push(`Hotel at index ${i} is missing city`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Convert comprehensive ProposalData back to legacy TripData format for compatibility
  private convertToLegacyFormat(proposalData: ProposalData): TripData {
    return {
      trip_id: proposalData.trip_id,
      title: proposalData.title,
      destinations: proposalData.destinations,
      start_date: proposalData.start_date,
      end_date: proposalData.end_date,
      client: proposalData.client,
      hotels: proposalData.hotels.map(hotel => ({
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        location: hotel.location,
        star_rating: hotel.star_rating,
        lead_price: hotel.lead_price,
        amenities: hotel.amenities || [],
        refundable: hotel.refundable,
        cancellation_deadline: hotel.cancellation_deadline,
        commission_amount: hotel.commission_amount,
        site: hotel.site,
        images: hotel.images
      })),
      activities: proposalData.tours?.map(tour => ({
        name: tour.title,
        description: tour.highlights_md,
        price: tour.total,
        duration: tour.duration
      })) || [],
      total_cost: proposalData.financials?.total_due,
      total_commission: proposalData.financials?.agent_private?.commission_total
    };
  }
  
  // ============================================================================
  // Enhanced Cost Calculations
  // ============================================================================
  
  private calculateComprehensiveCost(proposalData: ProposalData): number {
    let total = 0;
    
    // Hotel costs
    if (proposalData.hotels) {
      for (const hotel of proposalData.hotels) {
        if (hotel.lead_price?.amount) {
          total += hotel.lead_price.amount;
        }
      }
    }
    
    // Tour costs
    if (proposalData.tours) {
      for (const tour of proposalData.tours) {
        total += tour.total || 0;
      }
    }
    
    // Flight costs
    if (proposalData.flights) {
      for (const flight of proposalData.flights) {
        if (flight.pricing?.total) {
          total += flight.pricing.total;
        }
      }
    }
    
    // Ground transportation costs
    if (proposalData.ground) {
      for (const ground of proposalData.ground) {
        total += ground.total || 0;
      }
    }
    
    // Use financials total if available and higher
    if (proposalData.financials?.total_due && proposalData.financials.total_due > total) {
      total = proposalData.financials.total_due;
    }
    
    return Math.round(total * 100) / 100;
  }
  
  private calculateComprehensiveCommission(proposalData: ProposalData): number {
    let total = 0;
    
    // Hotel commissions
    if (proposalData.hotels) {
      for (const hotel of proposalData.hotels) {
        if (hotel.commission_amount) {
          total += hotel.commission_amount;
        }
      }
    }
    
    // Use financials commission if available and higher
    if (proposalData.financials?.agent_private?.commission_total && 
        proposalData.financials.agent_private.commission_total > total) {
      total = proposalData.financials.agent_private.commission_total;
    }
    
    return Math.round(total * 100) / 100;
  }
  
  // Process hotel images for comprehensive data
  private async processHotelImages(hotels: any[]): Promise<any[]> {
    try {
      // Use existing image processor logic
      const processedHotels = await this.imageProcessor.processProposalImages({ hotels });
      return processedHotels.hotels || hotels;
    } catch (error) {
      console.error('Error processing hotel images:', error);
      return hotels; // Return original data on error
    }
  }
  
  // ============================================================================
  // Enhanced Template & Theme Methods
  // ============================================================================
  
  // Generate proposal with direct template and theme control
  async generateProposalWithTemplate(
    proposalData: ProposalData,
    templateName: string,
    themeRemix: ThemeRemix,
    options?: TemplateOptions
  ): Promise<GeneratedProposal> {
    try {
      console.log(`Generating proposal with template ${templateName} and theme ${themeRemix.colorScheme}`);
      
      // 1. Validate template and theme
      const templateValidation = this.validateTemplate(templateName);
      if (!templateValidation.valid) {
        throw new Error(templateValidation.error!);
      }
      
      const themeValidation = this.themeEngine.validateTheme(themeRemix);
      if (!themeValidation.valid) {
        throw new Error(`Invalid theme configuration: ${themeValidation.errors.join(', ')}`);
      }
      
      // 2. Validate proposal data
      const dataValidation = this.validateProposalData(proposalData);
      if (!dataValidation.valid) {
        throw new Error(`Invalid proposal data: ${dataValidation.errors.join(', ')}`);
      }
      
      // 3. Process images if requested
      let processedData = proposalData;
      if (options?.include_images !== false) {
        processedData = {
          ...proposalData,
          hotels: await this.processHotelImages(proposalData.hotels)
        };
      }
      
      // 4. Render HTML with new template system
      const html = await this.templateFactory.renderTemplate(
        templateName,
        processedData,
        themeRemix,
        options
      );
      
      // 5. Generate PDF if available
      let pdfBuffer: Buffer | null = null;
      const pdfCapabilities = this.pdfGenerator.getCapabilities();
      
      if (pdfCapabilities.available) {
        console.log('Generating PDF...');
        pdfBuffer = await this.pdfGenerator.generatePDF(html);
      }
      
      // 6. Calculate costs
      const totalCost = this.calculateComprehensiveCost(processedData);
      const totalCommission = this.calculateComprehensiveCommission(processedData);
      
      // 7. Create proposal record
      const proposal: GeneratedProposal = {
        proposal_id: this.generateProposalId(processedData.trip_id),
        trip_id: processedData.trip_id,
        template_name: `${templateName}-${themeRemix.colorScheme}-${themeRemix.typography}`,
        rendered_html: html,
        json_payload: JSON.stringify({
          ...processedData,
          template_name: templateName,
          theme_remix: themeRemix,
          template_options: options,
          generated_at: new Date().toISOString(),
          pdf_available: pdfCapabilities.available
        }),
        total_cost: totalCost,
        total_commission: totalCommission,
        created_at: new Date().toISOString()
      };
      
      console.log(`Enhanced proposal generated successfully: ${proposal.proposal_id}`);
      return proposal;
      
    } catch (error) {
      console.error('Error generating proposal with template and theme:', error);
      throw new Error(`Failed to generate proposal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Preview proposal with template and theme
  async previewProposalWithTemplate(
    proposalData: ProposalData,
    templateName: string,
    themeRemix: ThemeRemix,
    options?: TemplateOptions
  ): Promise<string> {
    try {
      console.log(`Generating preview with template ${templateName} and theme ${themeRemix.colorScheme}`);
      
      // Process images for preview if requested
      let processedData = proposalData;
      if (options?.include_images !== false) {
        processedData = {
          ...proposalData,
          hotels: await this.processHotelImages(proposalData.hotels)
        };
      }
      
      // Render HTML with new template system
      return await this.templateFactory.renderTemplate(
        templateName,
        processedData,
        themeRemix,
        options
      );
      
    } catch (error) {
      console.error('Error generating template preview:', error);
      throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Get template recommendations based on trip data
  getTemplateRecommendations(proposalData: ProposalData): string[] {
    const characteristics = {
      luxury: this.isLuxuryTrip(proposalData),
      business: this.isBusinessTrip(proposalData),
      simple: this.isSimpleTrip(proposalData),
      detailed: this.isDetailedTrip(proposalData),
      visual: this.isVisualTrip(proposalData)
    };
    
    return this.templateFactory.getRecommendedTemplates(characteristics);
  }
  
  // Get theme recommendations based on trip and client characteristics
  getThemeRecommendations(proposalData: ProposalData): string[] {
    const recommendations: string[] = [];
    
    if (this.isLuxuryTrip(proposalData)) {
      recommendations.push('luxury', 'professional');
    }
    
    if (this.isBusinessTrip(proposalData)) {
      recommendations.push('executive', 'professional');
    }
    
    if (this.isFamilyTrip(proposalData)) {
      recommendations.push('friendly', 'modern');
    }
    
    if (this.isModernClientTrip(proposalData)) {
      recommendations.push('modern', 'friendly');
    }
    
    // Default fallback
    if (recommendations.length === 0) {
      recommendations.push('professional');
    }
    
    return [...new Set(recommendations)];
  }
  
  // Validate template name
  private validateTemplate(templateName: string): { valid: boolean; error?: string } {
    if (!this.templateFactory.hasTemplate(templateName)) {
      const available = this.templateFactory.getAvailableTemplates()
        .map(t => t.key).join(', ');
      return {
        valid: false,
        error: `Template '${templateName}' not found. Available templates: ${available}`
      };
    }
    return { valid: true };
  }
  
  // Trip characteristic detection methods
  private isLuxuryTrip(proposalData: ProposalData): boolean {
    // Check for luxury indicators
    const avgHotelPrice = this.calculateAverageHotelPrice(proposalData.hotels);
    const hasLuxuryStyles = proposalData.trip_spec?.prefs?.styles?.includes('luxury') || false;
    const hasHighBudget = (proposalData.trip_spec?.prefs?.budget_per_night || 0) > 300;
    
    return avgHotelPrice > 400 || hasLuxuryStyles || hasHighBudget;
  }
  
  private isBusinessTrip(proposalData: ProposalData): boolean {
    // Check for business travel indicators
    const hasBusinessStyles = proposalData.trip_spec?.prefs?.styles?.includes('business') || false;
    const isShortTrip = this.calculateTripDuration(proposalData) <= 3;
    const isWeekday = true; // Would need actual date logic
    
    return hasBusinessStyles || (isShortTrip && isWeekday);
  }
  
  private isSimpleTrip(proposalData: ProposalData): boolean {
    // Check for simple trip indicators
    const hasMinimalComponents = (
      (proposalData.hotels?.length || 0) <= 2 &&
      (proposalData.tours?.length || 0) <= 2 &&
      (proposalData.flights?.length || 0) <= 2
    );
    
    return hasMinimalComponents;
  }
  
  private isDetailedTrip(proposalData: ProposalData): boolean {
    // Check for detailed trip indicators
    const hasMultipleComponents = (
      (proposalData.hotels?.length || 0) > 2 ||
      (proposalData.tours?.length || 0) > 3 ||
      (proposalData.flights?.length || 0) > 2 ||
      (proposalData.ground?.length || 0) > 2
    );
    
    const isLongTrip = this.calculateTripDuration(proposalData) > 7;
    
    return hasMultipleComponents || isLongTrip;
  }
  
  private isVisualTrip(proposalData: ProposalData): boolean {
    // Check for visual appeal indicators
    const isHoneymoon = proposalData.trip_spec?.prefs?.styles?.includes('honeymoon') || false;
    const isAnniversary = proposalData.trip_spec?.prefs?.styles?.includes('anniversary') || false;
    const hasSpecialOccasion = isHoneymoon || isAnniversary;
    
    return hasSpecialOccasion || this.isLuxuryTrip(proposalData);
  }
  
  private isFamilyTrip(proposalData: ProposalData): boolean {
    return (proposalData.trip_spec?.party?.children || 0) > 0;
  }
  
  private isModernClientTrip(proposalData: ProposalData): boolean {
    // Would typically check client preferences, age demographics, etc.
    // For now, infer from trip characteristics
    const hasModernStyles = proposalData.trip_spec?.prefs?.styles?.includes('modern') || false;
    const hasAdventureStyles = proposalData.trip_spec?.prefs?.styles?.includes('adventure') || false;
    
    return hasModernStyles || hasAdventureStyles;
  }
  
  // Helper calculation methods
  private calculateAverageHotelPrice(hotels: any[]): number {
    if (!hotels?.length) return 0;
    
    const prices = hotels
      .map(h => h.lead_price?.amount || h.price_per_night || 0)
      .filter(p => p > 0);
    
    return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  }
  
  private calculateTripDuration(proposalData: ProposalData): number {
    if (!proposalData.start_date || !proposalData.end_date) return 0;
    
    const start = new Date(proposalData.start_date);
    const end = new Date(proposalData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}