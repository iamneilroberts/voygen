/**
 * Test Suite for Template Components - TASK-0041 Component Tests
 * 
 * Tests individual template components to ensure modular architecture
 * and proper component rendering across different themes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  HeaderComponent,
  HotelCardComponent,
  RoomDetailsComponent,
  FlightComponent,
  GroundTransportComponent,
  TourComponent,
  CostSummaryComponent,
  NextStepsComponent,
  FooterComponent,
  CORE_COMPONENTS
} from '../src/render/templates/components';
import { ThemeRemix, ProposalData } from '../src/render/types';
import { TemplateContext } from '../src/render/templates/base-template';
import { ThemeEngine } from '../src/render/themes/theme-engine';

// Test fixtures
const mockProposalData: ProposalData = {
  trip_id: "test_trip_001",
  trip_name: "European Adventure",
  destinations: "Paris, Rome, Barcelona",
  start_date: "2024-06-01",
  end_date: "2024-06-15",
  client: {
    name: "John & Jane Doe",
    email: "johndoe@example.com",
    phone: "+1-555-0123"
  },
  trip_spec: {
    party_name: "European Adventure",
    legs: [
      {
        dest_name: "Paris",
        nights: 5,
        dep_date: "2024-06-01",
        ret_date: "2024-06-06"
      }
    ]
  },
  hotels: [
    {
      name: "Le Grand Hotel Paris",
      location: "Paris",
      star_rating: 5,
      price_per_night: 450,
      amenities: ["Spa", "Restaurant", "WiFi"],
      commission_percent: 20,
      refundable: true
    }
  ],
  financials: {
    total_cost: 2340,
    currency: "USD"
  }
} as ProposalData;

const mockTheme: ThemeRemix = {
  colorScheme: 'professional-blue',
  typography: 'corporate',
  decorative: 'none',
  layout: 'spacious'
};

const mockContext: TemplateContext = {
  data: mockProposalData,
  remix: mockTheme,
  theme: new ThemeEngine(),
  options: {},
  helpers: {
    formatCurrency: (amount: number, currency = 'USD') => `$${amount.toLocaleString()}`,
    formatDate: (date: string | Date) => new Date(date).toLocaleDateString(),
    formatDateRange: (start: string | Date, end: string | Date) => `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`,
    pluralize: (count: number, singular: string, plural?: string) => count === 1 ? `${count} ${singular}` : `${count} ${plural || singular + 's'}`,
    decorateSection: (title: string, level = 'h1') => title,
    applyDecorative: (content: string, element: string) => content,
    generateStarRating: (rating: number) => '★'.repeat(rating),
    formatPhone: (phone: string) => phone,
    calculateNights: (checkin: string, checkout: string) => Math.ceil((new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)),
    getHotelAmenities: (amenities: string[]) => amenities.join(', '),
    safeDivide: (a: number, b: number, fallback = 0) => b !== 0 ? a / b : fallback
  }
};

describe('Template Components Tests', () => {
  describe('Core Components Registry', () => {
    it('should have all required core components', () => {
      expect(HeaderComponent).toBeDefined();
      expect(HotelCardComponent).toBeDefined();
      expect(RoomDetailsComponent).toBeDefined();
      expect(FlightComponent).toBeDefined();
      expect(GroundTransportComponent).toBeDefined();
      expect(TourComponent).toBeDefined();
      expect(CostSummaryComponent).toBeDefined();
      expect(NextStepsComponent).toBeDefined();
      expect(FooterComponent).toBeDefined();
      expect(CORE_COMPONENTS).toHaveLength(9);
    });

    it('should provide component functions', () => {
      CORE_COMPONENTS.forEach(component => {
        expect(typeof component.render).toBe('function');
        expect(component.name).toBeDefined();
      });
    });
  });

  describe('HeaderComponent', () => {
    it('should render complete header with all elements', () => {
      const html = HeaderComponent.render(null, mockContext);
      
      expect(html).toContain(mockContext.data.trip_spec?.party_name || 'Travel Proposal');
      expect(html).toContain('header');
    });

    it('should apply theme-specific styling', () => {
      const luxuryContext = {
        ...mockContext,
        theme: { ...mockContext.theme, colorScheme: 'luxury' }
      };
      
      const html = HeaderComponent(luxuryContext);
      expect(html).toContain('class=');
      expect(html).toBeDefined();
    });

    it('should handle missing client data gracefully', () => {
      const contextWithoutClient = {
        ...mockContext,
        proposal: { ...mockContext.proposal, client: undefined as any }
      };
      
      expect(() => HeaderComponent(contextWithoutClient)).not.toThrow();
    });
  });

  describe('HotelCardComponent', () => {
    it('should render hotel with all details', () => {
      const hotel = mockContext.proposal.hotels[0];
      const html = HotelCardComponent(mockContext, hotel);
      
      expect(html).toContain(hotel.name);
      expect(html).toContain(hotel.city);
      expect(html).toContain(hotel.star_rating?.toString());
      expect(html).toContain(hotel.lead_price?.amount.toString());
      expect(html).toContain(hotel.lead_price?.currency);
    });

    it('should render amenities list', () => {
      const hotel = mockContext.proposal.hotels[0];
      const html = HotelCardComponent(mockContext, hotel);
      
      hotel.amenities?.forEach(amenity => {
        expect(html).toContain(amenity);
      });
    });

    it('should handle hotels without images', () => {
      const hotelNoImage = { 
        ...mockContext.proposal.hotels[0], 
        images: undefined 
      };
      
      const html = HotelCardComponent(mockContext, hotelNoImage);
      expect(html).toBeDefined();
      expect(html).toContain(hotelNoImage.name);
    });

    it('should display star rating correctly', () => {
      const fiveStarHotel = { 
        ...mockContext.proposal.hotels[0], 
        star_rating: 5 
      };
      
      const html = HotelCardComponent(mockContext, fiveStarHotel);
      expect(html).toMatch(/★|star|rating/i);
    });
  });

  describe('RoomDetailsComponent', () => {
    it('should render room information', () => {
      const hotel = mockContext.proposal.hotels[0];
      const html = RoomDetailsComponent(mockContext, hotel);
      
      expect(html).toBeDefined();
      expect(html).toContain('room');
    });

    it('should show cancellation policy when available', () => {
      const hotelWithPolicy = {
        ...mockContext.proposal.hotels[0],
        cancellation_deadline: "2024-05-25"
      };
      
      const html = RoomDetailsComponent(mockContext, hotelWithPolicy);
      expect(html).toContain('cancel');
    });
  });

  describe('FlightComponent', () => {
    it('should render flight details', () => {
      const flight = mockContext.proposal.flights![0];
      const html = FlightComponent(mockContext, flight);
      
      expect(html).toContain(flight.origin);
      expect(html).toContain(flight.destination);
      expect(html).toContain(flight.airline);
      expect(html).toContain(flight.pricing?.total.toString());
    });

    it('should handle flights without pricing', () => {
      const flightNoPricing = {
        ...mockContext.proposal.flights![0],
        pricing: undefined
      };
      
      const html = FlightComponent(mockContext, flightNoPricing);
      expect(html).toBeDefined();
      expect(html).toContain(flightNoPricing.origin);
    });
  });

  describe('GroundTransportComponent', () => {
    it('should render ground transport details', () => {
      const transport = mockContext.proposal.ground![0];
      const html = GroundTransportComponent(mockContext, transport);
      
      expect(html).toContain(transport.type);
      expect(html).toContain(transport.description);
      expect(html).toContain(transport.total?.toString());
    });

    it('should handle different transport types', () => {
      const carRental = {
        type: "car_rental",
        description: "Luxury sedan for 3 days",
        total: 180
      };
      
      const html = GroundTransportComponent(mockContext, carRental);
      expect(html).toContain('car_rental');
      expect(html).toContain('Luxury sedan');
    });
  });

  describe('TourComponent', () => {
    it('should render tour information', () => {
      const tour = mockContext.proposal.tours![0];
      const html = TourComponent(mockContext, tour);
      
      expect(html).toContain(tour.title);
      expect(html).toContain(tour.highlights_md);
      expect(html).toContain(tour.total?.toString());
      expect(html).toContain(tour.duration);
    });

    it('should render markdown content in highlights', () => {
      const tourWithMarkdown = {
        title: "City Walking Tour",
        highlights_md: "**Private guide** included\n- Historical sites\n- Local cuisine",
        total: 95,
        duration: "4 hours"
      };
      
      const html = TourComponent(mockContext, tourWithMarkdown);
      expect(html).toContain('<strong>');
      expect(html).toContain('<li>');
    });
  });

  describe('CostSummaryComponent', () => {
    it('should render financial summary', () => {
      const html = CostSummaryComponent(mockContext);
      
      expect(html).toContain(mockContext.proposal.financials?.total_due.toString());
      expect(html).toContain('total');
    });

    it('should show itemized costs when available', () => {
      const html = CostSummaryComponent(mockContext);
      
      expect(html).toContain('hotel'); // Should show hotel costs
      if (mockContext.proposal.tours?.length) {
        expect(html).toContain('tour');
      }
    });

    it('should handle different currencies', () => {
      const contextWithEuro = {
        ...mockContext,
        proposal: {
          ...mockContext.proposal,
          hotels: [{
            ...mockContext.proposal.hotels[0],
            lead_price: { amount: 400, currency: "EUR" }
          }]
        }
      };
      
      const html = CostSummaryComponent(contextWithEuro);
      expect(html).toContain('EUR');
    });
  });

  describe('NextStepsComponent', () => {
    it('should render next steps information', () => {
      const html = NextStepsComponent(mockContext);
      
      expect(html).toContain('next');
      expect(html).toContain('contact');
    });

    it('should include agent contact information when available', () => {
      const contextWithAgent = {
        ...mockContext,
        proposal: {
          ...mockContext.proposal,
          agent: {
            name: "Travel Agent Smith",
            email: "agent@example.com",
            phone: "+1-555-0199"
          }
        }
      };
      
      const html = NextStepsComponent(contextWithAgent);
      expect(html).toContain('Travel Agent Smith');
      expect(html).toContain('agent@example.com');
    });
  });

  describe('FooterComponent', () => {
    it('should render footer with branding', () => {
      const html = FooterComponent(mockContext);
      
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });

    it('should include generation timestamp', () => {
      const html = FooterComponent(mockContext);
      expect(html).toMatch(/\d{4}/); // Should contain a year
    });
  });

  describe('Component Theme Integration', () => {
    const themes: ThemeRemix[] = [
      { colorScheme: 'professional', typography: 'modern', decorative: 'minimal', layout: 'standard' },
      { colorScheme: 'luxury', typography: 'elegant', decorative: 'rich', layout: 'immersive' },
      { colorScheme: 'executive', typography: 'clean', decorative: 'minimal', layout: 'efficient' },
      { colorScheme: 'friendly', typography: 'relaxed', decorative: 'moderate', layout: 'comfortable' }
    ];

    themes.forEach(theme => {
      it(`should render components with ${theme.colorScheme} theme`, () => {
        const themedContext = { ...mockContext, theme };
        
        const headerHtml = HeaderComponent(themedContext);
        const hotelHtml = HotelCardComponent(themedContext, mockContext.proposal.hotels[0]);
        const summaryHtml = CostSummaryComponent(themedContext);
        
        expect(headerHtml).toBeDefined();
        expect(hotelHtml).toBeDefined();
        expect(summaryHtml).toBeDefined();
      });
    });
  });

  describe('Component Error Handling', () => {
    it('should handle missing data gracefully', () => {
      const emptyContext = {
        proposal: { trip_id: "test" } as ProposalData,
        theme: mockContext.theme,
        options: {}
      };
      
      expect(() => HeaderComponent(emptyContext)).not.toThrow();
      expect(() => CostSummaryComponent(emptyContext)).not.toThrow();
      expect(() => FooterComponent(emptyContext)).not.toThrow();
    });

    it('should handle null/undefined component data', () => {
      expect(() => HotelCardComponent(mockContext, null as any)).not.toThrow();
      expect(() => TourComponent(mockContext, undefined as any)).not.toThrow();
      expect(() => FlightComponent(mockContext, null as any)).not.toThrow();
    });
  });

  describe('Component HTML Validation', () => {
    it('should generate valid HTML structure', () => {
      const hotel = mockContext.proposal.hotels[0];
      const html = HotelCardComponent(mockContext, hotel);
      
      // Basic HTML structure validation
      expect(html).not.toContain('<>');
      expect(html).not.toContain('</>');
      
      // Should not have unclosed tags (basic check)
      const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
      const closeTags = (html.match(/<\/[^>]*>/g) || []).length;
      const selfClosingTags = (html.match(/<[^>]*\/>/g) || []).length;
      
      expect(openTags).toBe(closeTags + selfClosingTags);
    });

    it('should escape special characters in content', () => {
      const hotelWithSpecialChars = {
        ...mockContext.proposal.hotels[0],
        name: "Hotel <script>alert('xss')</script> & Spa"
      };
      
      const html = HotelCardComponent(mockContext, hotelWithSpecialChars);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&amp;');
    });
  });

  describe('Component Accessibility', () => {
    it('should include proper ARIA labels', () => {
      const html = HeaderComponent(mockContext);
      expect(html).toMatch(/aria-label|role|alt=/);
    });

    it('should use semantic HTML elements', () => {
      const hotel = mockContext.proposal.hotels[0];
      const html = HotelCardComponent(mockContext, hotel);
      
      expect(html).toMatch(/<(article|section|header|footer|nav|main|aside)/);
    });
  });
});