# TASK-0047: Testing and Validation

## Overview
Implement comprehensive testing for the proposal remix system to ensure all template and theme combinations work correctly, generate valid HTML, and meet professional quality standards.

## Testing Strategy

### 1. Unit Tests for Core Components

#### Theme Engine Tests (`src/render/themes/__tests__/theme-engine.test.ts`)
```typescript
describe('ThemeEngine', () => {
  test('generates valid CSS for all color schemes', () => {
    const themeEngine = new ThemeEngine();
    
    Object.keys(COLOR_SCHEMES).forEach(scheme => {
      const css = themeEngine.generateCSS({
        colorScheme: scheme,
        typography: 'corporate',
        decorative: 'none', 
        layout: 'spacious'
      });
      
      expect(css).toContain('--primary-color');
      expect(css).toContain('--background-color');
      expect(css).not.toContain('undefined');
      expect(css).not.toContain('null');
    });
  });
  
  test('applies decorative elements correctly', () => {
    const themeEngine = new ThemeEngine();
    const content = 'Hotel Name';
    
    const withEmoji = themeEngine.applyDecorative(content, 'minimal-emoji');
    expect(withEmoji).toContain('🏨');
    
    const withoutEmoji = themeEngine.applyDecorative(content, 'none');
    expect(withoutEmoji).toBe(content);
  });
});
```

#### Template Tests (`src/render/templates/__tests__/templates.test.ts`)
```typescript
describe('Template System', () => {
  const mockTripData = {
    trip_spec: { party: { adults: 2, children: 0 }, legs: [], prefs: {} },
    hotels: [{ id: '1', name: 'Test Hotel', city: 'Test City', site: 'test' }]
  };
  
  test('all templates generate valid HTML', () => {
    Object.keys(TEMPLATE_REGISTRY).forEach(templateName => {
      const template = getTemplate(templateName);
      const html = template(mockTripData, REMIX_PRESETS.professional);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
    });
  });
  
  test('templates handle missing data gracefully', () => {
    const minimalData = { trip_spec: { party: { adults: 1, children: 0 }, legs: [], prefs: {} } };
    
    Object.keys(TEMPLATE_REGISTRY).forEach(templateName => {
      expect(() => {
        const template = getTemplate(templateName);
        template(minimalData, REMIX_PRESETS.professional);
      }).not.toThrow();
    });
  });
});
```

### 2. Integration Tests

#### Remix Engine Integration (`src/render/__tests__/integration.test.ts`)
```typescript
describe('Remix Engine Integration', () => {
  let templateEngine: TemplateEngine;
  let generator: ProposalGenerator;
  
  beforeEach(() => {
    templateEngine = new TemplateEngine();
    generator = new ProposalGenerator();
  });
  
  test('generates proposals for all preset combinations', async () => {
    const testTripData = await createTestTripData();
    
    const combinations = [];
    Object.keys(TEMPLATE_REGISTRY).forEach(template => {
      Object.keys(REMIX_PRESETS).forEach(preset => {
        combinations.push({ template, preset });
      });
    });
    
    for (const { template, preset } of combinations) {
      const remix = {
        template: template as any,
        theme: REMIX_PRESETS[preset]
      };
      
      const proposal = await generator.generateProposalWithRemix(testTripData, remix);
      
      expect(proposal.rendered_html).toBeDefined();
      expect(proposal.rendered_html.length).toBeGreaterThan(1000);
      expect(proposal.template_name).toContain(template);
    }
  });
  
  test('backward compatibility with existing API', async () => {
    const testTripData = await createTestTripData();
    
    // Old API should still work
    const legacyHtml = await templateEngine.render('standard', testTripData);
    expect(legacyHtml).toBeDefined();
    expect(legacyHtml).toContain('<!DOCTYPE html>');
  });
});
```

### 3. Visual Quality Tests

#### HTML Validation (`src/render/__tests__/html-validation.test.ts`)
```typescript
import { JSDOM } from 'jsdom';

describe('HTML Quality Validation', () => {
  test('generated HTML is valid and well-formed', async () => {
    const testCombinations = [
      { template: 'detailed', preset: 'professional' },
      { template: 'condensed', preset: 'luxury' },
      { template: 'fancy', preset: 'modern' },
      { template: 'functional', preset: 'friendly' }
    ];
    
    for (const { template, preset } of testCombinations) {
      const html = await generateTestProposal(template, preset);
      
      // Parse with JSDOM to validate structure
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Check required elements
      expect(document.DOCTYPE).toBeDefined();
      expect(document.querySelector('html')).toBeTruthy();
      expect(document.querySelector('head')).toBeTruthy();
      expect(document.querySelector('body')).toBeTruthy();
      expect(document.querySelector('title')).toBeTruthy();
      
      // Check for CSS injection
      const styles = document.querySelectorAll('style');
      expect(styles.length).toBeGreaterThan(0);
      
      // Check responsive meta tag
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport).toBeTruthy();
      
      // Validate no broken template variables
      expect(html).not.toContain('{{');
      expect(html).not.toContain('}}');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('[object Object]');
    }
  });
  
  test('CSS is valid and complete', async () => {
    Object.keys(REMIX_PRESETS).forEach(presetName => {
      const theme = REMIX_PRESETS[presetName];
      const themeEngine = new ThemeEngine();
      const css = themeEngine.generateCSS(theme);
      
      // Check for required CSS properties
      expect(css).toContain('--primary-color');
      expect(css).toContain('--text-color');
      expect(css).toContain('font-family');
      expect(css).toContain('@media');
      
      // Validate no CSS errors
      expect(css).not.toContain('undefined');
      expect(css).not.toContain('NaN');
      expect(css).not.toMatch(/:\s*;/); // Empty properties
    });
  });
});
```

### 4. Performance Tests

#### Performance Benchmarks (`src/render/__tests__/performance.test.ts`)
```typescript
describe('Performance Tests', () => {
  test('proposal generation completes within time limits', async () => {
    const testTripData = await createLargeTripData(); // Trip with many hotels/activities
    
    const startTime = Date.now();
    
    const proposal = await generator.generateProposalWithRemix(
      testTripData,
      { template: 'detailed', theme: REMIX_PRESETS.professional }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(2000); // 2 seconds max
    expect(proposal.rendered_html.length).toBeGreaterThan(5000);
  });
  
  test('theme generation is fast', () => {
    const themeEngine = new ThemeEngine();
    
    Object.keys(REMIX_PRESETS).forEach(presetName => {
      const startTime = Date.now();
      
      const css = themeEngine.generateCSS(REMIX_PRESETS[presetName]);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // 50ms max
      expect(css.length).toBeGreaterThan(1000); // Substantial CSS generated
    });
  });
});
```

### 5. Real-world Data Tests

#### Database Integration Tests (`src/tools/__tests__/database-integration.test.ts`)
```typescript
describe('Database Integration', () => {
  test('handles real trip data from database', async () => {
    // This would require a test database or mocked database responses
    const mockDb = createMockDatabase();
    
    // Test with various trip configurations
    const tripConfigurations = [
      'trip_with_many_hotels',
      'trip_with_activities', 
      'trip_minimal_data',
      'trip_with_special_characters'
    ];
    
    for (const config of tripConfigurations) {
      const result = await handleGenerateProposal(
        {
          trip_id: config,
          template: 'detailed',
          style_preset: 'professional'
        },
        mockDb
      );
      
      expect(result.success).toBe(true);
      expect(result.preview_html).toBeDefined();
      expect(result.preview_html).toContain('<!DOCTYPE html>');
    }
  });
});
```

### 6. Visual Regression Tests

#### Screenshot Testing (Manual/Automated)
```typescript
// Using puppeteer or similar for visual testing
describe('Visual Regression Tests', () => {
  test('templates maintain visual consistency', async () => {
    // Generate proposals with fixed data
    const referenceData = await createReferenceTrip();
    
    const combinations = [
      'detailed-professional',
      'condensed-luxury', 
      'fancy-modern',
      'functional-friendly'
    ];
    
    for (const combo of combinations) {
      const [template, preset] = combo.split('-');
      const html = await generateTestProposal(template, preset);
      
      // Save for manual review or compare against baselines
      await saveHtmlForReview(`${combo}.html`, html);
      
      // Basic visual checks
      expect(html).toMatch(/<style.*>.*\.hotel-card.*<\/style>/s);
      expect(html).toMatch(/<div.*class.*hotel-card/);
    }
  });
});
```

## Test Data Creation

### Mock Data Generators
```typescript
export function createTestTripData(): ProposalData {
  return {
    trip_spec: {
      party: { adults: 2, children: 1 },
      legs: [
        { city: 'London', arrive: '2024-05-15', nights: 3 },
        { city: 'Paris', arrive: '2024-05-18', nights: 4 }
      ],
      prefs: { styles: ['luxury'], budget_per_night: 400, refundable: true, breakfast: true }
    },
    hotels: [
      {
        id: 'hotel_1',
        name: 'The Savoy London',
        city: 'London',
        star_rating: 5,
        lead_price: { amount: 650, currency: 'USD' },
        amenities: ['Free WiFi', 'Spa', 'Fine Dining'],
        refundable: true,
        site: 'Expedia'
      },
      {
        id: 'hotel_2', 
        name: 'Hôtel Ritz Paris',
        city: 'Paris',
        star_rating: 5,
        lead_price: { amount: 890, currency: 'USD' },
        amenities: ['Luxury Spa', 'Michelin Restaurant'],
        refundable: true,
        site: 'Booking.com'
      }
    ],
    tours: [
      {
        title: 'London Eye & Thames Cruise',
        total: 125, 
        currency: 'USD',
        highlights_md: 'Panoramic views of London from the famous observation wheel'
      }
    ],
    financials: {
      currency: 'USD',
      price_lines: [
        { label: 'Hotels (7 nights)', amount: 4590 },
        { label: 'Activities', amount: 250 }
      ],
      total_due: 4840
    }
  };
}
```

## Automated Testing Pipeline

### Test Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/render/**/*.ts',
    'src/tools/proposal-tools.ts',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Acceptance Criteria
- [ ] Unit tests for all theme and template components
- [ ] Integration tests for all preset combinations (20+ combinations)
- [ ] HTML validation passes for all generated proposals
- [ ] Performance tests confirm sub-2-second generation times
- [ ] Visual quality tests ensure professional appearance
- [ ] Database integration tests with various trip configurations
- [ ] Test coverage above 80% for render and tools modules
- [ ] Automated test pipeline in CI/CD

## Priority: High
## Estimated Time: 2-3 hours
## Dependencies: All other tasks (final validation step)