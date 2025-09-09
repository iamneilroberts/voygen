/**
 * Test Suite for TASK-0041: Professional Travel Proposal Remix System
 * 
 * This test suite validates the proposal remix system including:
 * - 4 base templates (detailed, condensed, fancy, functional)
 * - Theme remix system with multiple variations
 * - Dynamic CSS generation and theme application
 * - Template factory and registry
 * - Professional web-ready output
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ProposalGenerator } from '../src/render/proposal-generator';
import { 
  templateFactory, 
  TemplateFactory, 
  TEMPLATE_REGISTRY,
  validateTemplate,
  getTemplatePresetCompatibility,
  getAllTemplates 
} from '../src/render/templates';
import { ThemeEngine } from '../src/render/themes/theme-engine';
import { ProposalData, ThemeRemix, TemplateOptions, TripData } from '../src/render/types';

// Test data fixtures
const mockTripData: TripData = {
  trip_id: "test_trip_001",
  title: "European Adventure",
  destinations: "Paris, Rome, Barcelona",
  start_date: "2024-06-01",
  end_date: "2024-06-15",
  client: {
    name: "John & Jane Doe",
    email: "johndoe@example.com",
    phone: "+1-555-0123"
  },
  hotels: [
    {
      id: "hotel_001",
      name: "Le Grand Hotel Paris",
      city: "Paris",
      star_rating: 5,
      lead_price: { amount: 450, currency: "USD" },
      amenities: ["Spa", "Restaurant", "WiFi"],
      commission_amount: 90
    },
    {
      id: "hotel_002", 
      name: "Roma Luxury Suites",
      city: "Rome",
      star_rating: 4,
      lead_price: { amount: 320, currency: "USD" },
      amenities: ["Pool", "Gym", "WiFi"],
      commission_amount: 64
    }
  ],
  activities: [
    {
      name: "Louvre Museum Tour",
      description: "Private guided tour of the world's largest art museum",
      price: 120,
      duration: "3 hours"
    }
  ],
  total_cost: 2340,
  total_commission: 234
};

const mockProposalData: ProposalData = {
  trip_id: "test_trip_001",
  title: "European Adventure",
  destinations: "Paris, Rome, Barcelona", 
  start_date: "2024-06-01",
  end_date: "2024-06-15",
  client: {
    name: "John & Jane Doe",
    email: "johndoe@example.com",
    phone: "+1-555-0123"
  },
  trip_spec: {
    party: { adults: 2, children: 0 },
    legs: [
      { destination: "Paris", nights: 5 },
      { destination: "Rome", nights: 4 },
      { destination: "Barcelona", nights: 4 }
    ],
    prefs: {
      styles: ["luxury"],
      budget_per_night: 400
    }
  },
  hotels: [
    {
      id: "hotel_001",
      name: "Le Grand Hotel Paris", 
      city: "Paris",
      star_rating: 5,
      lead_price: { amount: 450, currency: "USD" },
      amenities: ["Spa", "Restaurant", "WiFi"],
      commission_amount: 90
    }
  ],
  tours: [
    {
      title: "Louvre Museum Tour",
      highlights_md: "Private guided tour of the world's largest art museum",
      total: 120,
      duration: "3 hours"
    }
  ],
  financials: {
    total_due: 2340,
    agent_private: {
      commission_total: 234
    }
  }
};

const mockThemeRemix: ThemeRemix = {
  colorScheme: 'professional',
  typography: 'modern',
  decorative: 'minimal',
  layout: 'standard'
};

describe('Proposal Remix System - Core Architecture', () => {
  let proposalGenerator: ProposalGenerator;
  let themeEngine: ThemeEngine;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
    themeEngine = new ThemeEngine();
  });

  describe('Template Registry', () => {
    it('should have exactly 4 base templates', () => {
      const templates = getAllTemplates();
      expect(templates).toHaveLength(4);
      
      const templateNames = templates.map(t => t.key);
      expect(templateNames).toContain('detailed');
      expect(templateNames).toContain('condensed');
      expect(templateNames).toContain('fancy');
      expect(templateNames).toContain('functional');
    });

    it('should provide complete template information', () => {
      Object.entries(TEMPLATE_REGISTRY).forEach(([key, info]) => {
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.suitableFor).toBeInstanceOf(Array);
        expect(info.suitableFor.length).toBeGreaterThan(0);
        expect(info.class).toBeDefined();
      });
    });

    it('should validate template names correctly', () => {
      expect(validateTemplate('detailed').valid).toBe(true);
      expect(validateTemplate('nonexistent').valid).toBe(false);
      expect(validateTemplate('nonexistent').error).toContain('not found');
    });
  });

  describe('Template Factory', () => {
    let factory: TemplateFactory;

    beforeEach(() => {
      factory = new TemplateFactory();
    });

    it('should create template instances', () => {
      const template = factory.createTemplate('detailed');
      expect(template).toBeDefined();
      expect(template.render).toBeDefined();
    });

    it('should cache template instances', () => {
      const template1 = factory.createTemplate('detailed');
      const template2 = factory.createTemplate('detailed');
      expect(template1).toBe(template2);
    });

    it('should fall back to detailed template for unknown names', () => {
      const template = factory.createTemplate('unknown');
      expect(template).toBeDefined();
    });

    it('should provide template statistics', () => {
      factory.createTemplate('detailed');
      factory.createTemplate('fancy');
      
      const stats = factory.getTemplateStats();
      expect(stats.totalTemplates).toBe(4);
      expect(stats.cachedInstances).toBe(2);
      expect(stats.availableTemplates).toHaveLength(4);
    });
  });

  describe('Theme System Integration', () => {
    it('should validate theme configurations', () => {
      const validTheme: ThemeRemix = {
        colorScheme: 'professional',
        typography: 'modern',
        decorative: 'minimal',
        layout: 'standard'
      };

      const validation = themeEngine.validateTheme(validTheme);
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid theme configurations', () => {
      const invalidTheme = {
        colorScheme: 'invalid_color',
        typography: 'modern',
        decorative: 'minimal',
        layout: 'standard'
      } as ThemeRemix;

      const validation = themeEngine.validateTheme(invalidTheme);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it('should provide theme statistics', () => {
      const stats = themeEngine.getThemeStats();
      expect(stats.totalCombinations).toBeGreaterThan(0);
      expect(stats.colorSchemes).toBeInstanceOf(Array);
      expect(stats.typographyOptions).toBeInstanceOf(Array);
      expect(stats.decorativeStyles).toBeInstanceOf(Array);
    });
  });
});

describe('Template Rendering Tests', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('Basic Template Rendering', () => {
    it('should render detailed template', async () => {
      const html = await templateFactory.renderTemplate(
        'detailed',
        mockProposalData,
        mockThemeRemix
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockProposalData.title);
      expect(html).toContain(mockProposalData.client.name);
      expect(html).toContain('Le Grand Hotel Paris');
    });

    it('should render condensed template', async () => {
      const html = await templateFactory.renderTemplate(
        'condensed',
        mockProposalData,
        mockThemeRemix
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockProposalData.title);
      expect(html).toBeDefined();
    });

    it('should render fancy template', async () => {
      const luxuryTheme: ThemeRemix = {
        colorScheme: 'luxury',
        typography: 'elegant',
        decorative: 'rich',
        layout: 'immersive'
      };

      const html = await templateFactory.renderTemplate(
        'fancy',
        mockProposalData,
        luxuryTheme
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockProposalData.title);
    });

    it('should render functional template', async () => {
      const functionalTheme: ThemeRemix = {
        colorScheme: 'modern',
        typography: 'clean',
        decorative: 'minimal',
        layout: 'efficient'
      };

      const html = await templateFactory.renderTemplate(
        'functional',
        mockProposalData,
        functionalTheme
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockProposalData.title);
    });
  });

  describe('Theme Application', () => {
    const themes: ThemeRemix[] = [
      { colorScheme: 'professional', typography: 'modern', decorative: 'minimal', layout: 'standard' },
      { colorScheme: 'luxury', typography: 'elegant', decorative: 'rich', layout: 'immersive' },
      { colorScheme: 'executive', typography: 'clean', decorative: 'minimal', layout: 'efficient' },
      { colorScheme: 'friendly', typography: 'relaxed', decorative: 'moderate', layout: 'comfortable' }
    ];

    themes.forEach(theme => {
      it(`should apply ${theme.colorScheme} theme correctly`, async () => {
        const html = await templateFactory.renderTemplate(
          'detailed',
          mockProposalData,
          theme
        );

        expect(html).toContain('<!DOCTYPE html');
        expect(html).toContain('<style>');
        expect(html).toMatch(/--primary-color|--accent-color|--background-color/);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should include mobile-responsive CSS', async () => {
      const html = await templateFactory.renderTemplate(
        'detailed',
        mockProposalData,
        mockThemeRemix
      );

      expect(html).toContain('viewport');
      expect(html).toMatch(/@media.*screen.*max-width|@media.*mobile/i);
    });

    it('should include responsive grid classes', async () => {
      const html = await templateFactory.renderTemplate(
        'detailed',
        mockProposalData,
        mockThemeRemix
      );

      expect(html).toMatch(/grid|flex|responsive/);
    });
  });
});

describe('Proposal Generation Workflow', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('Legacy Support', () => {
    it('should generate proposal from legacy TripData', async () => {
      const proposal = await proposalGenerator.generateProposal(
        mockTripData,
        'detailed'
      );

      expect(proposal.proposal_id).toBeDefined();
      expect(proposal.trip_id).toBe(mockTripData.trip_id);
      expect(proposal.template_name).toBe('detailed');
      expect(proposal.rendered_html).toContain('<!DOCTYPE html');
      expect(proposal.total_cost).toBe(mockTripData.total_cost);
    });

    it('should preview proposal from legacy TripData', async () => {
      const html = await proposalGenerator.previewProposal(
        mockTripData,
        'condensed'
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockTripData.title);
    });
  });

  describe('Enhanced Remix Support', () => {
    it('should generate proposal with remix configuration', async () => {
      const remix = {
        template: 'fancy',
        theme: {
          colorScheme: 'luxury',
          typography: 'elegant', 
          decorative: 'rich',
          layout: 'immersive'
        }
      };

      const proposal = await proposalGenerator.generateProposalWithRemix(
        mockTripData,
        remix
      );

      expect(proposal.proposal_id).toBeDefined();
      expect(proposal.template_name).toContain('fancy');
      expect(proposal.template_name).toContain('luxury');
      expect(proposal.rendered_html).toContain('<!DOCTYPE html');
    });

    it('should generate proposal from ProposalData with template and theme', async () => {
      const proposal = await proposalGenerator.generateProposalWithTemplate(
        mockProposalData,
        'detailed',
        mockThemeRemix
      );

      expect(proposal.proposal_id).toBeDefined();
      expect(proposal.template_name).toContain('detailed');
      expect(proposal.template_name).toContain('professional');
      expect(proposal.rendered_html).toContain('<!DOCTYPE html');
    });

    it('should preview proposal with template and theme', async () => {
      const html = await proposalGenerator.previewProposalWithTemplate(
        mockProposalData,
        'fancy',
        mockThemeRemix
      );

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain(mockProposalData.title);
    });
  });

  describe('Cost Calculations', () => {
    it('should calculate comprehensive costs correctly', async () => {
      const proposal = await proposalGenerator.generateProposalWithTemplate(
        mockProposalData,
        'detailed',
        mockThemeRemix
      );

      expect(proposal.total_cost).toBeGreaterThan(0);
      expect(proposal.total_commission).toBeGreaterThan(0);
    });
  });
});

describe('Template Recommendations', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('Template Recommendations', () => {
    it('should recommend templates for luxury trips', () => {
      const luxuryData = {
        ...mockProposalData,
        trip_spec: {
          ...mockProposalData.trip_spec,
          prefs: { styles: ['luxury'], budget_per_night: 500 }
        }
      };

      const recommendations = proposalGenerator.getTemplateRecommendations(luxuryData);
      expect(recommendations).toContain('fancy');
      expect(recommendations).toContain('detailed');
    });

    it('should recommend templates for business trips', () => {
      const businessData = {
        ...mockProposalData,
        trip_spec: {
          ...mockProposalData.trip_spec,
          prefs: { styles: ['business'] }
        }
      };

      const recommendations = proposalGenerator.getTemplateRecommendations(businessData);
      expect(recommendations).toContain('condensed');
      expect(recommendations).toContain('functional');
    });

    it('should recommend themes for luxury trips', () => {
      const luxuryData = {
        ...mockProposalData,
        trip_spec: {
          ...mockProposalData.trip_spec,
          prefs: { styles: ['luxury'], budget_per_night: 500 }
        }
      };

      const recommendations = proposalGenerator.getThemeRecommendations(luxuryData);
      expect(recommendations).toContain('luxury');
      expect(recommendations).toContain('professional');
    });
  });

  describe('Template Preset Compatibility', () => {
    it('should provide compatible theme presets for each template', () => {
      const compatibility = getTemplatePresetCompatibility();
      
      expect(compatibility.detailed).toContain('professional');
      expect(compatibility.condensed).toContain('executive'); 
      expect(compatibility.fancy).toContain('luxury');
      expect(compatibility.functional).toContain('modern');
    });
  });
});

describe('Data Validation', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('TripData Validation', () => {
    it('should validate complete TripData', () => {
      const validation = proposalGenerator.validateTripData(mockTripData);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject TripData without trip_id', () => {
      const invalidData = { ...mockTripData, trip_id: '' };
      const validation = proposalGenerator.validateTripData(invalidData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('trip_id is required');
    });

    it('should reject TripData without hotels', () => {
      const invalidData = { ...mockTripData, hotels: [] };
      const validation = proposalGenerator.validateTripData(invalidData);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('hotel'))).toBe(true);
    });
  });

  describe('ProposalData Validation', () => {
    it('should validate complete ProposalData', () => {
      const validation = proposalGenerator.validateProposalData(mockProposalData);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject ProposalData without trip_spec', () => {
      const invalidData = { ...mockProposalData, trip_spec: undefined as any };
      const validation = proposalGenerator.validateProposalData(invalidData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('trip_spec is required');
    });
  });
});

describe('Performance Requirements', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('Generation Speed', () => {
    it('should generate proposal under 500ms performance target', async () => {
      const startTime = Date.now();
      
      await proposalGenerator.previewProposal(mockTripData, 'detailed');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500);
    });

    it('should handle template caching efficiently', async () => {
      // First render to populate cache
      await templateFactory.renderTemplate('detailed', mockProposalData, mockThemeRemix);
      
      const startTime = Date.now();
      await templateFactory.renderTemplate('detailed', mockProposalData, mockThemeRemix);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

describe('System Statistics', () => {
  let proposalGenerator: ProposalGenerator;

  beforeAll(() => {
    proposalGenerator = new ProposalGenerator();
  });

  describe('Generation Statistics', () => {
    it('should provide comprehensive generation statistics', () => {
      const stats = proposalGenerator.getGenerationStats();
      
      expect(stats.templatesAvailable).toBe(4);
      expect(stats.themeCombinations).toBeGreaterThan(0);
      expect(stats.pdfSupported).toBeDefined();
      expect(stats.imageProcessingSupported).toBe(true);
    });

    it('should track available templates correctly', () => {
      const templates = proposalGenerator.getAvailableTemplates();
      
      expect(templates).toHaveLength(4);
      templates.forEach(template => {
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
      });
    });
  });
});