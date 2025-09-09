/**
 * Integration Tests for Complete Proposal Generation Workflow
 * 
 * Tests the end-to-end proposal generation process including:
 * - Data conversion and validation
 * - Template selection and rendering  
 * - Theme application
 * - Performance requirements
 * - Database integration
 * - Error handling and recovery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ProposalGenerator } from '../../src/render/proposal-generator';
import { templateFactory } from '../../src/render/templates';
import { ThemeEngine } from '../../src/render/themes/theme-engine';
import { ProposalData, ThemeRemix, TripData, GeneratedProposal } from '../../src/render/types';

// Mock database for testing
class MockDatabase {
  private proposals: Map<string, any> = new Map();
  
  async saveProposal(proposal: GeneratedProposal): Promise<void> {
    this.proposals.set(proposal.proposal_id, proposal);
  }
  
  async getProposal(proposalId: string): Promise<GeneratedProposal | null> {
    return this.proposals.get(proposalId) || null;
  }
  
  clear(): void {
    this.proposals.clear();
  }
}

describe('Proposal Generation Workflow Integration Tests', () => {
  let proposalGenerator: ProposalGenerator;
  let mockDb: MockDatabase;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
    mockDb = new MockDatabase();
  });

  afterEach(() => {
    mockDb.clear();
    templateFactory.clearCache();
  });

  describe('End-to-End Proposal Generation', () => {
    const sampleTripData: TripData = {
      trip_id: "integration_test_001",
      title: "Luxury Mediterranean Cruise",
      destinations: "Barcelona, Nice, Rome, Santorini",
      start_date: "2024-07-15",
      end_date: "2024-07-22",
      client: {
        name: "Michael & Sarah Johnson",
        email: "mjohnson@example.com",
        phone: "+1-555-0167"
      },
      hotels: [
        {
          id: "hotel_bcn_001",
          name: "Hotel Arts Barcelona",
          city: "Barcelona",
          star_rating: 5,
          lead_price: { amount: 580, currency: "USD" },
          amenities: ["Spa", "Pool", "Restaurant", "WiFi", "Beach Access"],
          commission_amount: 116,
          images: [
            { url: "https://example.com/hotel-arts-exterior.jpg", caption: "Hotel exterior with beach view" },
            { url: "https://example.com/hotel-arts-pool.jpg", caption: "Rooftop infinity pool" }
          ]
        },
        {
          id: "hotel_rome_001", 
          name: "The St. Regis Rome",
          city: "Rome",
          star_rating: 5,
          lead_price: { amount: 650, currency: "USD" },
          amenities: ["Concierge", "Spa", "Restaurant", "WiFi", "Butler Service"],
          commission_amount: 130
        }
      ],
      activities: [
        {
          name: "Sagrada Familia Private Tour",
          description: "Skip-the-line access with expert architecture guide",
          price: 85,
          duration: "2 hours"
        },
        {
          name: "Vatican Museums & Sistine Chapel",
          description: "Early morning private access before public opening", 
          price: 150,
          duration: "3 hours"
        },
        {
          name: "Sunset Catamaran Cruise in Santorini",
          description: "Private yacht with dinner and wine tasting",
          price: 320,
          duration: "4 hours"
        }
      ],
      total_cost: 4850,
      total_commission: 485
    };

    it('should complete full workflow for luxury travel proposal', async () => {
      // Test luxury remix configuration
      const luxuryRemix = {
        template: 'fancy',
        theme: {
          colorScheme: 'luxury',
          typography: 'elegant',
          decorative: 'rich',
          layout: 'immersive'
        }
      };

      const startTime = performance.now();
      
      const proposal = await proposalGenerator.generateProposalWithRemix(
        sampleTripData,
        luxuryRemix,
        { include_images: true }
      );
      
      const endTime = performance.now();
      const generationTime = endTime - startTime;

      // Verify proposal structure
      expect(proposal.proposal_id).toBeDefined();
      expect(proposal.trip_id).toBe(sampleTripData.trip_id);
      expect(proposal.template_name).toContain('fancy');
      expect(proposal.template_name).toContain('luxury');
      expect(proposal.rendered_html).toContain('<!DOCTYPE html');
      expect(proposal.total_cost).toBeGreaterThan(0);
      expect(proposal.total_commission).toBeGreaterThan(0);

      // Verify HTML content quality
      const html = proposal.rendered_html;
      expect(html).toContain(sampleTripData.title);
      expect(html).toContain(sampleTripData.client.name);
      expect(html).toContain('Hotel Arts Barcelona');
      expect(html).toContain('The St. Regis Rome');
      expect(html).toContain('Sagrada Familia');
      expect(html).toContain('Vatican Museums');
      expect(html).toContain('Santorini');

      // Verify responsive design
      expect(html).toContain('viewport');
      expect(html).toMatch(/@media.*max-width/);

      // Verify performance requirement (sub-500ms)
      expect(generationTime).toBeLessThan(500);

      // Save to mock database
      await mockDb.saveProposal(proposal);
      const savedProposal = await mockDb.getProposal(proposal.proposal_id);
      expect(savedProposal).toEqual(proposal);
    });

    it('should handle business travel workflow efficiently', async () => {
      const businessTripData: TripData = {
        trip_id: "business_test_001",
        title: "Executive Business Trip - London",
        destinations: "London",
        start_date: "2024-06-10",
        end_date: "2024-06-12", 
        client: {
          name: "Robert Chen",
          email: "rchen@corporation.com",
          phone: "+1-555-0199"
        },
        hotels: [
          {
            id: "hotel_london_001",
            name: "The Langham London",
            city: "London",
            star_rating: 5,
            lead_price: { amount: 420, currency: "USD" },
            amenities: ["Business Center", "WiFi", "Concierge"],
            commission_amount: 84
          }
        ],
        activities: [
          {
            name: "Airport Transfer - Executive Car",
            description: "Luxury sedan with professional driver",
            price: 95,
            duration: "1 hour"
          }
        ],
        total_cost: 1175,
        total_commission: 118
      };

      const executiveRemix = {
        template: 'condensed',
        theme: {
          colorScheme: 'executive',
          typography: 'clean',
          decorative: 'minimal',
          layout: 'efficient'
        }
      };

      const proposal = await proposalGenerator.generateProposalWithRemix(
        businessTripData,
        executiveRemix,
        { include_images: false }
      );

      expect(proposal.template_name).toContain('condensed');
      expect(proposal.template_name).toContain('executive');
      expect(proposal.rendered_html).toContain('Executive Business Trip');
      expect(proposal.rendered_html).toContain('The Langham London');
    });

    it('should generate multiple theme variations for same trip', async () => {
      const themeVariations = [
        { colorScheme: 'professional', typography: 'modern', decorative: 'minimal', layout: 'standard' },
        { colorScheme: 'luxury', typography: 'elegant', decorative: 'rich', layout: 'immersive' },
        { colorScheme: 'friendly', typography: 'relaxed', decorative: 'moderate', layout: 'comfortable' },
        { colorScheme: 'modern', typography: 'bold', decorative: 'geometric', layout: 'dynamic' }
      ];

      const proposals: GeneratedProposal[] = [];

      for (const theme of themeVariations) {
        const remix = { template: 'detailed', theme };
        const proposal = await proposalGenerator.generateProposalWithRemix(
          sampleTripData,
          remix
        );
        proposals.push(proposal);
      }

      // Verify all proposals generated successfully
      expect(proposals).toHaveLength(4);

      // Verify each has unique template name reflecting theme
      const templateNames = proposals.map(p => p.template_name);
      expect(new Set(templateNames).size).toBe(4); // All unique

      // Verify HTML content differs between themes
      const htmlContents = proposals.map(p => p.rendered_html);
      for (let i = 0; i < htmlContents.length; i++) {
        for (let j = i + 1; j < htmlContents.length; j++) {
          expect(htmlContents[i]).not.toBe(htmlContents[j]);
        }
      }
    });
  });

  describe('Data Conversion and Validation Workflow', () => {
    it('should handle legacy TripData conversion seamlessly', async () => {
      const legacyTrip: TripData = {
        trip_id: "legacy_001",
        title: "Family Vacation",
        destinations: "Orlando",
        start_date: "2024-08-01",
        end_date: "2024-08-07",
        client: {
          name: "Smith Family",
          email: "smith@example.com"
        },
        hotels: [
          {
            id: "disney_hotel_001",
            name: "Disney Grand Floridian",
            city: "Orlando",
            star_rating: 4,
            lead_price: { amount: 380, currency: "USD" },
            amenities: ["Pool", "Kids Club", "Restaurant"]
          }
        ],
        activities: [
          {
            name: "Magic Kingdom Tickets",
            description: "4-day park hopper passes for family of 4",
            price: 1200
          }
        ],
        total_cost: 3580
      };

      // Generate using legacy method
      const legacyProposal = await proposalGenerator.generateProposal(legacyTrip, 'detailed');
      
      // Generate using new remix method  
      const remixProposal = await proposalGenerator.generateProposalWithRemix(
        legacyTrip,
        {
          template: 'detailed',
          theme: {
            colorScheme: 'friendly',
            typography: 'relaxed', 
            decorative: 'moderate',
            layout: 'comfortable'
          }
        }
      );

      // Both should work and contain same core content
      expect(legacyProposal.rendered_html).toContain('Family Vacation');
      expect(legacyProposal.rendered_html).toContain('Disney Grand Floridian');
      
      expect(remixProposal.rendered_html).toContain('Family Vacation');
      expect(remixProposal.rendered_html).toContain('Disney Grand Floridian');
    });

    it('should validate comprehensive ProposalData workflow', async () => {
      const comprehensiveData: ProposalData = {
        trip_id: "comprehensive_001",
        title: "Ultimate European Adventure",
        destinations: "London, Paris, Rome, Barcelona",
        start_date: "2024-09-01", 
        end_date: "2024-09-14",
        client: {
          name: "Adventure Seekers Inc.",
          email: "adventures@example.com",
          phone: "+1-555-0145"
        },
        trip_spec: {
          party: { adults: 4, children: 2 },
          legs: [
            { destination: "London", nights: 3 },
            { destination: "Paris", nights: 4 },
            { destination: "Rome", nights: 3 },
            { destination: "Barcelona", nights: 3 }
          ],
          prefs: {
            styles: ["adventure", "family", "cultural"],
            budget_per_night: 320
          }
        },
        hotels: [
          {
            id: "london_hotel",
            name: "The Savoy London",
            city: "London",
            star_rating: 5,
            lead_price: { amount: 450, currency: "USD" },
            amenities: ["Family Rooms", "Pool", "Restaurant"],
            commission_amount: 90
          },
          {
            id: "paris_hotel", 
            name: "Hotel Le Bristol Paris",
            city: "Paris",
            star_rating: 5,
            lead_price: { amount: 520, currency: "USD" },
            amenities: ["Kids Club", "Spa", "Restaurant"],
            commission_amount: 104
          }
        ],
        tours: [
          {
            title: "London Eye & Thames Cruise",
            highlights_md: "Family-friendly **London Eye** experience with:\n- Private pod access\n- 30-minute Thames cruise\n- Professional guide",
            total: 280,
            duration: "3 hours"
          },
          {
            title: "Louvre Family Discovery Tour", 
            highlights_md: "Engaging **family tour** featuring:\n- Child-friendly explanations\n- Interactive games\n- Skip-the-line access",
            total: 320,
            duration: "2.5 hours"
          }
        ],
        flights: [
          {
            origin: "JFK",
            destination: "LHR", 
            airline: "British Airways",
            pricing: { total: 2400 }
          }
        ],
        ground: [
          {
            type: "transfer",
            description: "Family-friendly airport transfers with car seats",
            total: 150
          }
        ],
        financials: {
          total_due: 8950,
          agent_private: {
            commission_total: 895
          }
        }
      };

      // Validate data first
      const validation = proposalGenerator.validateProposalData(comprehensiveData);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Generate with family-friendly theme
      const proposal = await proposalGenerator.generateProposalWithTemplate(
        comprehensiveData,
        'detailed',
        {
          colorScheme: 'friendly',
          typography: 'relaxed',
          decorative: 'moderate', 
          layout: 'comfortable'
        }
      );

      expect(proposal.rendered_html).toContain('Ultimate European Adventure');
      expect(proposal.rendered_html).toContain('Adventure Seekers Inc.');
      expect(proposal.rendered_html).toContain('London Eye');
      expect(proposal.rendered_html).toContain('Louvre Family');
      expect(proposal.rendered_html).toContain('<strong>'); // Markdown rendered
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid trip data gracefully', async () => {
      const invalidTripData = {
        trip_id: '',  // Invalid: empty trip_id
        title: 'Test Trip',
        hotels: []    // Invalid: no hotels
      } as TripData;

      await expect(
        proposalGenerator.generateProposal(invalidTripData, 'detailed')
      ).rejects.toThrow();
    });

    it('should handle unknown template names', async () => {
      const validTripData: TripData = {
        trip_id: "fallback_test",
        title: "Test Trip",
        destinations: "Test City",
        start_date: "2024-06-01",
        end_date: "2024-06-03",
        client: { name: "Test Client", email: "test@example.com" },
        hotels: [{
          id: "test_hotel",
          name: "Test Hotel",
          city: "Test City",
          lead_price: { amount: 100, currency: "USD" }
        }]
      };

      // Should fall back to detailed template
      const proposal = await proposalGenerator.generateProposal(
        validTripData, 
        'nonexistent_template'
      );

      expect(proposal.rendered_html).toBeDefined();
      expect(proposal.rendered_html).toContain('Test Trip');
    });

    it('should handle theme validation errors', async () => {
      const validProposalData: ProposalData = {
        trip_id: "theme_error_test",
        title: "Theme Test Trip",
        destinations: "Test City",
        start_date: "2024-06-01", 
        end_date: "2024-06-03",
        client: { name: "Test Client", email: "test@example.com" },
        trip_spec: {
          party: { adults: 2, children: 0 },
          legs: [{ destination: "Test City", nights: 2 }]
        },
        hotels: [{
          id: "test_hotel",
          name: "Test Hotel", 
          city: "Test City",
          lead_price: { amount: 100, currency: "USD" }
        }]
      };

      const invalidTheme = {
        colorScheme: 'invalid_color',
        typography: 'invalid_typography',
        decorative: 'invalid_decorative',
        layout: 'invalid_layout'
      } as ThemeRemix;

      await expect(
        proposalGenerator.generateProposalWithTemplate(
          validProposalData,
          'detailed',
          invalidTheme
        )
      ).rejects.toThrow('Invalid theme configuration');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent proposal generations', async () => {
      const tripVariations = Array.from({ length: 5 }, (_, i) => ({
        trip_id: `concurrent_test_${i}`,
        title: `Concurrent Trip ${i}`,
        destinations: `City ${i}`,
        start_date: "2024-06-01",
        end_date: "2024-06-03", 
        client: { name: `Client ${i}`, email: `client${i}@example.com` },
        hotels: [{
          id: `hotel_${i}`,
          name: `Hotel ${i}`,
          city: `City ${i}`,
          lead_price: { amount: 100 + i * 50, currency: "USD" }
        }]
      } as TripData));

      const startTime = performance.now();
      
      const proposalPromises = tripVariations.map(trip =>
        proposalGenerator.generateProposal(trip, 'detailed')
      );
      
      const proposals = await Promise.all(proposalPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerProposal = totalTime / proposals.length;

      expect(proposals).toHaveLength(5);
      expect(avgTimePerProposal).toBeLessThan(500); // Average should be under 500ms

      // Verify all unique
      const tripIds = proposals.map(p => p.trip_id);
      expect(new Set(tripIds).size).toBe(5);
    });

    it('should maintain template cache efficiency', async () => {
      const testTrip: TripData = {
        trip_id: "cache_test",
        title: "Cache Test Trip", 
        destinations: "Test City",
        start_date: "2024-06-01",
        end_date: "2024-06-03",
        client: { name: "Test Client", email: "test@example.com" },
        hotels: [{
          id: "cache_hotel",
          name: "Cache Hotel",
          city: "Test City", 
          lead_price: { amount: 200, currency: "USD" }
        }]
      };

      // First generation (cold cache)
      const startCold = performance.now();
      await proposalGenerator.generateProposal(testTrip, 'detailed');
      const endCold = performance.now();
      const coldTime = endCold - startCold;

      // Second generation (warm cache)
      const startWarm = performance.now();
      await proposalGenerator.generateProposal(testTrip, 'detailed');
      const endWarm = performance.now();
      const warmTime = endWarm - startWarm;

      // Warm cache should be faster
      expect(warmTime).toBeLessThan(coldTime);
      expect(warmTime).toBeLessThan(200); // Should be very fast with cache
    });
  });

  describe('Template Statistics and Monitoring', () => {
    it('should provide comprehensive system statistics', async () => {
      const stats = proposalGenerator.getGenerationStats();
      
      expect(stats.templatesAvailable).toBe(4);
      expect(stats.themeCombinations).toBeGreaterThan(100);
      expect(stats.imageProcessingSupported).toBe(true);
    });

    it('should track template usage patterns', () => {
      const templates = proposalGenerator.getAvailableTemplates();
      
      expect(templates).toHaveLength(4);
      
      const templateStats = templateFactory.getTemplateStats();
      expect(templateStats.totalTemplates).toBe(4);
      expect(templateStats.availableTemplates).toContain('detailed');
      expect(templateStats.availableTemplates).toContain('condensed');
      expect(templateStats.availableTemplates).toContain('fancy');
      expect(templateStats.availableTemplates).toContain('functional');
    });
  });
});