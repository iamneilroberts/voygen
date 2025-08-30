/**
 * Template Document MCP Server
 * Enhanced with proper Handlebars rendering to fix template issues
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Handlebars from 'handlebars';

function getCssStyles(): string {
  return `
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --accent-color: #e74c3c;
  --text-color: #333;
  --bg-color: #f5f5f7;
  --card-bg: #ffffff;
  --shadow: 0 2px 10px rgba(0,0,0,0.1);
  --border-radius: 12px;
  --transition: all 0.3s ease;
  --flight-color: #2980b9;
  --rental-color: #27ae60;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--bg-color);
}

.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

header {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  padding: 4rem 2rem;
  text-align: center;
  border-radius: var(--border-radius);
  margin-bottom: 3rem;
  box-shadow: var(--shadow);
}

h1 { 
  font-size: 3rem; 
  margin-bottom: 1rem; 
  font-weight: 700;
  letter-spacing: -1px;
}

.subtitle { 
  font-size: 1.4rem; 
  opacity: 0.9; 
  margin-bottom: 1rem; 
}

.trip-overview {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.trip-overview span {
  background: rgba(255,255,255,0.2);
  padding: 0.5rem 1.5rem;
  border-radius: 25px;
  backdrop-filter: blur(10px);
}

.card {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}

.section-title {
  color: var(--primary-color);
  font-size: 2rem;
  margin-bottom: 1.5rem;
  position: relative;
  padding-bottom: 0.5rem;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 60px;
  height: 3px;
  background: var(--accent-color);
  border-radius: 2px;
}

.day-section {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);
  border-left: 5px solid var(--secondary-color);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.day-header h3 {
  color: var(--primary-color);
  font-size: 1.5rem;
}

.date {
  color: var(--secondary-color);
  font-weight: 500;
}

.accommodation-card, .activity-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid var(--secondary-color);
}

/* Flight Card Styling */
.flight-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-left: 5px solid var(--flight-color);
}

.flight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.flight-header h4 {
  color: var(--flight-color);
  font-size: 1.2rem;
  margin: 0;
}

.flight-number {
  background: var(--flight-color);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-weight: bold;
  font-size: 0.9rem;
}

.flight-details {
  margin-top: 1rem;
}

.flight-leg {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.departure, .arrival {
  flex: 1;
  text-align: center;
}

.departure h5, .arrival h5 {
  color: var(--flight-color);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.airport {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 0.2rem;
}

.city {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}

.datetime {
  font-weight: 500;
  color: var(--primary-color);
}

.flight-arrow {
  font-size: 2rem;
  color: var(--flight-color);
  font-weight: bold;
}

.flight-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
  font-size: 0.9rem;
}

.duration {
  color: #666;
}

.confirmation {
  font-weight: bold;
  color: var(--flight-color);
}

/* Rental Car Styling */
.rental-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  border-left: 5px solid var(--rental-color);
}

.rental-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.rental-header h4 {
  color: var(--rental-color);
  font-size: 1.2rem;
  margin: 0;
}

.vehicle-type {
  background: var(--rental-color);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-weight: bold;
  font-size: 0.9rem;
}

.rental-details {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.rental-pickup, .rental-dropoff {
  flex: 1;
  text-align: center;
}

.rental-pickup h5, .rental-dropoff h5 {
  color: var(--rental-color);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.location {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}

.rental-arrow {
  font-size: 2rem;
  color: var(--rental-color);
  font-weight: bold;
}

.rental-meta {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.rental-cost {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-weight: 500;
}

.daily-rate {
  color: #666;
}

.total-cost {
  color: var(--rental-color);
  font-weight: bold;
}

.rental-features {
  margin-bottom: 1rem;
}

.rental-features ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.rental-features li {
  margin-bottom: 0.3rem;
  color: #666;
}

.activity-card.kim-gem {
  border-left-color: #ffd700;
  background: linear-gradient(to right, rgba(255,215,0,0.1), #f8f9fa);
}

.gem-badge {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #333;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  display: inline-block;
  margin-left: 0.5rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.price {
  color: var(--accent-color);
  font-weight: 600;
  font-size: 1.1rem;
}

.price-breakdown {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  margin-top: 1rem;
}

footer {
  text-align: center;
  padding: 3rem 0;
  color: #666;
  border-top: 1px solid #e0e0e0;
  margin-top: 3rem;
}

/* Enhanced Standard Sections Styling */

/* Checklist Section */
.checklist-section {
  margin: 2rem 0;
}

.checklist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.checklist-category h4 {
  color: var(--primary-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--accent-color);
}

.checklist-items {
  list-style: none;
  padding: 0;
}

.checklist-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.checklist-item input[type="checkbox"] {
  margin-right: 0.75rem;
  transform: scale(1.2);
}

/* Travel Information */
.travel-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.info-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--secondary-color);
}

.emergency-contacts {
  border-left-color: var(--accent-color);
}

.contact-item,
.guideline-item {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.contact-type {
  background: var(--accent-color);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.phrase-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: rgba(255,255,255,0.5);
  border-radius: 6px;
}

.phrase-english {
  font-weight: 500;
}

.phrase-local {
  font-style: italic;
  color: var(--primary-color);
}

/* Enhanced Transportation */
.transport-category {
  margin-bottom: 2rem;
}

.transport-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.transport-card, .intercity-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--secondary-color);
}

.transport-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.transport-apps {
  background: var(--secondary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.route-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.transport-method {
  background: var(--primary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.journey-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.journey-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
}

.luggage-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.luggage-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--flight-color);
}

.luggage-item {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: rgba(255,255,255,0.5);
  border-radius: 6px;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.tip-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--accent-color);
}

/* Dining Section */
.dining-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.restaurant-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--rental-color);
}

.restaurant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.cuisine-type {
  background: var(--rental-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.restaurant-rating {
  background: #ffd700;
  color: #333;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: bold;
}

.must-try-dishes ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.dietary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dietary-tag {
  background: var(--accent-color);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.experiences-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.experience-card {
  background: #f0f8ff;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--secondary-color);
}

.dining-tips {
  margin-top: 2rem;
}

.tips-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.tip-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid var(--accent-color);
}

/* Investment Section */
.cost-table {
  margin-bottom: 2rem;
}

.cost-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.cost-description {
  font-size: 0.9rem;
  color: #666;
  flex: 1;
  margin-left: 1rem;
}

.investment-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.inclusions,
.exclusions {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
}

.inclusions {
  border-left: 4px solid #28a745;
}

.exclusions {
  border-left: 4px solid #dc3545;
}

.inclusions ul,
.exclusions ul {
  margin-left: 1rem;
}

.payment-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.payment-milestone {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.payment-date {
  min-width: 120px;
}

.payment-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-notes {
  grid-column: 2;
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.5rem;
}

.terms-content {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
}

.policy-tiers {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.policy-tier {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #ffc107;
}

.policy-details {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.insurance-details {
  background: #f0f8ff;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--secondary-color);
}

.insurance-recommendation {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.insurance-coverage ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.additional-notes {
  margin-top: 2rem;
}

.notes-content {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
}

@media (max-width: 768px) {
  .container { padding: 1rem; }
  h1 { font-size: 2rem; }
  .card, .day-section { padding: 1.5rem; }
  .day-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  
  /* Mobile responsiveness for new sections */
  .checklist-grid,
  .travel-info-grid,
  .dining-grid,
  .transport-grid,
  .luggage-info,
  .tips-grid,
  .experiences-grid,
  .tips-list,
  .investment-breakdown-grid {
    grid-template-columns: 1fr;
  }
  
  .restaurant-header,
  .transport-header,
  .route-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .journey-details {
    grid-template-columns: 1fr;
  }
  
  .payment-milestone {
    grid-template-columns: 1fr;
  }
  
  .policy-tier {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .phrase-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .dietary-tags {
    justify-content: flex-start;
  }
}
`;
}

// Environment interface
interface Env {
  TRAVEL_ASSISTANT: D1Database;
}

// Template rendering engine with proper Handlebars support
class TemplateEngine {
  private static instance: TemplateEngine;

  constructor() {
    this.registerHelpers();
    // Partials registration moved to render method to avoid Worker startup issues
  }

  static getInstance(): TemplateEngine {
    if (!TemplateEngine.instance) {
      TemplateEngine.instance = new TemplateEngine();
    }
    return TemplateEngine.instance;
  }

  private registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: any) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number, currency = 'USD') => {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });

    // Join array helper
    Handlebars.registerHelper('join', (array: any[], separator = ', ') => {
      if (!Array.isArray(array)) return '';
      return array.join(separator);
    });

    // Conditional helper
    Handlebars.registerHelper('if_eq', function(this: any, a: any, b: any, options: any) {
      if (a === b) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });

    // Math helpers
    Handlebars.registerHelper('add', (a: number, b: number) => a + b);
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);

    // Day number helper for iterations
    Handlebars.registerHelper('dayNumber', (index: number) => index + 1);

    // Kim's Gem badge helper
    Handlebars.registerHelper('kimGem', function(isGem: boolean, options: any) {
      if (isGem) {
        return new Handlebars.SafeString('<span class="gem-badge">Kim\'s Gem ✨</span>');
      }
      return '';
    });

    // Progress bar helper
    Handlebars.registerHelper('progressBar', (percentage: number, total = 10) => {
      const filled = Math.round((percentage / 100) * total);
      const empty = total - filled;
      const bar = '██'.repeat(filled) + '░░'.repeat(empty);
      return new Handlebars.SafeString(`[${bar}] ${percentage}%`);
    });
  }

  private registerPartials(): void {
    // Register template partials with inline content
    // Pre-departure checklist partial
    const preDeparturePartial = `{{#if preDepartureChecklist}}
<section class="card checklist-section">
  <h2 class="section-title">✅ Pre-Departure Checklist</h2>
  <div class="checklist-grid">
    {{#each preDepartureChecklist}}
    <div class="checklist-category">
      <h4>{{category}}</h4>
      <ul class="checklist-items">
        {{#each items}}
        <li class="checklist-item">
          <input type="checkbox" id="checklist-{{@../index}}-{{@index}}">
          <label for="checklist-{{@../index}}-{{@index}}">{{this}}</label>
        </li>
        {{/each}}
      </ul>
    </div>
    {{/each}}
  </div>
</section>
{{/if}}`;

    // Travel information partial
    const travelInfoPartial = `{{#if travelInformation}}
<section class="card travel-info-section">
  <h2 class="section-title">ℹ️ Important Travel Information</h2>
  <div class="travel-info-grid">
    {{#if travelInformation.emergencyContacts}}
    <div class="info-card emergency-contacts">
      <h4>🆘 Emergency Contacts</h4>
      {{#each travelInformation.emergencyContacts}}
      <div class="contact-item">
        <strong>{{name}}</strong>
        <p>{{phone}}</p>
        <span class="contact-type">{{type}}</span>
      </div>
      {{/each}}
    </div>
    {{/if}}
    
    {{#if travelInformation.timeZone}}
    <div class="info-card timezone-info">
      <h4>🕐 Time Zone Information</h4>
      <p><strong>Local Time:</strong> {{travelInformation.timeZone}}</p>
      <p><strong>Time Difference:</strong> {{travelInformation.timeDifference}}</p>
      {{#if travelInformation.jetLagTips}}
      <p><strong>Jet Lag Tips:</strong> {{travelInformation.jetLagTips}}</p>
      {{/if}}
    </div>
    {{/if}}
    
    {{#if travelInformation.weather}}
    <div class="info-card weather-info">
      <h4>🌤️ Weather & Climate</h4>
      <p><strong>Expected Weather:</strong> {{travelInformation.weather.conditions}}</p>
      <p><strong>Temperature Range:</strong> {{travelInformation.weather.temperature}}</p>
      {{#if travelInformation.weather.recommendations}}
      <p><strong>Clothing Recommendations:</strong> {{travelInformation.weather.recommendations}}</p>
      {{/if}}
    </div>
    {{/if}}
    
    {{#if travelInformation.culturalGuidelines}}
    <div class="info-card cultural-guidelines">
      <h4>🌍 Cultural Guidelines</h4>
      {{#each travelInformation.culturalGuidelines}}
      <div class="guideline-item">
        <strong>{{topic}}:</strong> {{description}}
      </div>
      {{/each}}
    </div>
    {{/if}}

    {{#if travelInformation.languageBasics}}
    <div class="info-card language-basics">
      <h4>🗣️ Language Basics</h4>
      {{#each travelInformation.languageBasics}}
      <div class="phrase-item">
        <span class="phrase-english">{{english}}</span>
        <span class="phrase-local">{{local}}</span>
      </div>
      {{/each}}
    </div>
    {{/if}}
  </div>
</section>
{{/if}}`;

    // Dining recommendations partial
    const diningPartial = `{{#if diningRecommendations}}
<section class="card dining-section">
  <h2 class="section-title">🍽️ Dining Recommendations</h2>
  <div class="dining-grid">
    {{#each diningRecommendations}}
    <div class="restaurant-card">
      <div class="restaurant-header">
        <h4>{{name}}</h4>
        <span class="cuisine-type">{{cuisine}}</span>
        {{#if rating}}
        <span class="restaurant-rating">⭐ {{rating}}</span>
        {{/if}}
      </div>
      <div class="restaurant-details">
        {{#if specialty}}
        <p class="specialty"><strong>Specialty:</strong> {{specialty}}</p>
        {{/if}}
        {{#if description}}
        <p class="restaurant-description">{{description}}</p>
        {{/if}}
        {{#if address}}
        <p class="address">📍 {{address}}</p>
        {{/if}}
        {{#if hours}}
        <p class="hours">🕒 {{hours}}</p>
        {{/if}}
        {{#if bookingInfo}}
        <p class="booking-info">📞 {{bookingInfo}}</p>
        {{/if}}
        {{#if priceRange}}
        <p class="price-range">💰 {{priceRange}}</p>
        {{/if}}
        {{#if mustTryDishes}}
        <div class="must-try-dishes">
          <strong>Must-try dishes:</strong>
          <ul>
            {{#each mustTryDishes}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
        {{/if}}
        {{#if dietaryAccommodations}}
        <div class="dietary-accommodations">
          <strong>Dietary Options:</strong>
          <span class="dietary-tags">
            {{#each dietaryAccommodations}}
            <span class="dietary-tag">{{this}}</span>
            {{/each}}
          </span>
        </div>
        {{/if}}
        {{#if tips}}
        <p class="restaurant-tips">💡 <em>{{tips}}</em></p>
        {{/if}}
      </div>
    </div>
    {{/each}}
  </div>
</section>
{{/if}}`;

    // Investment breakdown partial
    const investmentPartial = `{{#if investmentBreakdown}}
<section class="card investment-section">
  <h2 class="section-title">💰 Trip Investment Breakdown</h2>
  <div class="investment-details">
    {{#if investmentBreakdown.categories}}
    <div class="cost-breakdown">
      <h4>Cost Categories</h4>
      <div class="cost-table">
        {{#each investmentBreakdown.categories}}
        <div class="cost-item">
          <span class="cost-category">{{category}}</span>
          <span class="cost-amount">{{formatCurrency amount}}</span>
          {{#if description}}
          <span class="cost-description">{{description}}</span>
          {{/if}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
    
    <div class="total-cost">
      <div class="total-line">
        <strong>Total Trip Investment: {{formatCurrency investmentBreakdown.total}}</strong>
      </div>
      {{#if investmentBreakdown.perPerson}}
      <div class="per-person">
        Per Person: {{formatCurrency investmentBreakdown.perPerson}}
      </div>
      {{/if}}
      {{#if investmentBreakdown.travelers}}
      <div class="travelers-count">
        For {{investmentBreakdown.travelers}} travelers
      </div>
      {{/if}}
    </div>
    
    <div class="investment-breakdown-grid">
      {{#if investmentBreakdown.included}}
      <div class="inclusions">
        <h4>✅ What's Included</h4>
        <ul>
          {{#each investmentBreakdown.included}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
      
      {{#if investmentBreakdown.excluded}}
      <div class="exclusions">
        <h4>❌ Not Included</h4>
        <ul>
          {{#each investmentBreakdown.excluded}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
    </div>
    
    {{#if investmentBreakdown.paymentSchedule}}
    <div class="payment-schedule">
      <h4>💳 Payment Schedule</h4>
      <div class="payment-timeline">
        {{#each investmentBreakdown.paymentSchedule}}
        <div class="payment-milestone">
          <div class="payment-date">
            <strong>{{date}}</strong>
          </div>
          <div class="payment-details">
            <span class="payment-description">{{description}}</span>
            <span class="payment-amount">{{formatCurrency amount}}</span>
          </div>
          {{#if notes}}
          <div class="payment-notes">{{notes}}</div>
          {{/if}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
    
    {{#if investmentBreakdown.cancellationPolicy}}
    <div class="cancellation-policy">
      <h4>🚫 Cancellation Policy</h4>
      <div class="policy-tiers">
        {{#each investmentBreakdown.cancellationPolicy}}
        <div class="policy-tier">
          <strong>{{timeframe}}</strong>
          <span class="penalty">{{penalty}}</span>
          {{#if details}}
          <p class="policy-details">{{details}}</p>
          {{/if}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
    
    {{#if investmentBreakdown.travelInsurance}}
    <div class="travel-insurance">
      <h4>🛡️ Travel Insurance</h4>
      <div class="insurance-details">
        {{#if investmentBreakdown.travelInsurance.recommended}}
        <p class="insurance-recommendation">
          <strong>✅ Travel insurance is highly recommended for this trip</strong>
        </p>
        {{/if}}
        {{#if investmentBreakdown.travelInsurance.cost}}
        <p class="insurance-cost">
          Estimated Cost: {{formatCurrency investmentBreakdown.travelInsurance.cost}}
        </p>
        {{/if}}
        {{#if investmentBreakdown.travelInsurance.coverage}}
        <div class="insurance-coverage">
          <strong>Recommended Coverage:</strong>
          <ul>
            {{#each investmentBreakdown.travelInsurance.coverage}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
        {{/if}}
        {{#if investmentBreakdown.travelInsurance.provider}}
        <p class="insurance-provider">
          Recommended Provider: {{investmentBreakdown.travelInsurance.provider}}
        </p>
        {{/if}}
      </div>
    </div>
    {{/if}}
  </div>
</section>
{{/if}}`;

    // Register all partials
    Handlebars.registerPartial('preDepartureChecklist', preDeparturePartial);
    Handlebars.registerPartial('travelInformation', travelInfoPartial);
    Handlebars.registerPartial('diningRecommendations', diningPartial);
    Handlebars.registerPartial('investmentBreakdown', investmentPartial);
  }

  async render(templateContent: string, data: any, cssStyles?: string): Promise<string> {
    try {
      const template = Handlebars.compile(templateContent);
      const html = template(data);
      
      // If CSS styles are provided, wrap in complete HTML document
      if (cssStyles) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title || 'Travel Document'}</title>
    <style>
${cssStyles}
    </style>
</head>
<body>
${html}
</body>
</html>`;
      }
      
      return html;
    } catch (error) {
      console.error('Template rendering error:', error);
      throw new Error(`Template rendering failed: ${(error as Error).message}`);
    }
  }
}

// Database helper functions
async function getTemplate(db: D1Database, templateId: string) {
  try {
    const result = await db.prepare(`
      SELECT template_id, template_name, template_type, html_template, css_styles, javascript_code, variables, is_active
      FROM HtmlDocumentTemplates 
      WHERE template_id = ? AND is_active = 1
    `).bind(templateId).first();
    
    return result;
  } catch (error) {
    console.error('Database error fetching template:', error);
    return null;
  }
}

async function listTemplates(db: D1Database, templateType?: string) {
  try {
    let query = `
      SELECT template_id, template_name, template_type, html_template, css_styles, variables, is_active
      FROM HtmlDocumentTemplates 
      WHERE is_active = 1
    `;
    const params: string[] = [];
    
    if (templateType) {
      query += ` AND template_type = ?`;
      params.push(templateType);
    }
    
    query += ` ORDER BY template_name`;
    
    const result = await db.prepare(query).bind(...params).all();
    return result.results;
  } catch (error) {
    console.error('Database error listing templates:', error);
    return [];
  }
}

async function logTemplateUsage(
  db: D1Database,
  templateId: string,
  documentId: string | null,
  variables: any,
  renderTime: number
) {
  try {
    await db.prepare(`
      INSERT INTO TemplateUsage (usage_id, template_id, document_id, used_at, used_by, variables_used, render_time_ms)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      templateId,
      documentId,
      'template-document-mcp',
      JSON.stringify(variables),
      renderTime
    ).run();
  } catch (error) {
    console.error('Failed to log template usage:', error);
    // Don't throw error for logging failures
  }
}

// Enhanced template for complete itinerary with flights and rental cars
function getItineraryTemplate(): string {
  return `
<div class="container">
  <header>
    <h1>{{title}}</h1>
    <p class="subtitle">{{startDate}} - {{endDate}}</p>
    <div class="trip-overview">
      <span>{{totalDays}} Days</span>
      <span>{{clientName}}</span>
    </div>
  </header>
  
  <section class="card">
    <h2 class="section-title">Your Travel Agent</h2>
    <p><strong>{{agent.name}}</strong></p>
    <p>{{agent.phone}} | {{agent.email}}</p>
    <p>{{agent.company}} - {{agent.tagline}}</p>
  </section>
  
  <section class="card">
    <h2 class="section-title">Trip Overview</h2>
    <p>{{overview}}</p>
  </section>

  {{#if flights}}
  <section class="card">
    <h2 class="section-title">✈️ Flight Information</h2>
    {{#each flights}}
    <div class="flight-card">
      <div class="flight-header">
        <h4>{{#if_eq type "outbound"}}Outbound Flight{{/if_eq}}{{#if_eq type "return"}}Return Flight{{/if_eq}}</h4>
        <span class="flight-number">{{airline}} {{flightNumber}}</span>
      </div>
      <div class="flight-details">
        <div class="flight-leg">
          <div class="departure">
            <h5>Departure</h5>
            <p class="airport">{{departure.airport}}</p>
            <p class="city">{{departure.city}}</p>
            <p class="datetime">{{formatDate departure.date}} at {{departure.time}}</p>
          </div>
          <div class="flight-arrow">→</div>
          <div class="arrival">
            <h5>Arrival</h5>
            <p class="airport">{{arrival.airport}}</p>
            <p class="city">{{arrival.city}}</p>
            <p class="datetime">{{formatDate arrival.date}} at {{arrival.time}}</p>
          </div>
        </div>
        <div class="flight-meta">
          <span class="duration">Duration: {{duration}}</span>
          <span class="confirmation">Confirmation: {{confirmationNumber}}</span>
        </div>
      </div>
    </div>
    {{/each}}
  </section>
  {{/if}}

  {{#if rentalCar}}
  <section class="card">
    <h2 class="section-title">🚗 Rental Car</h2>
    <div class="rental-card">
      <div class="rental-header">
        <h4>{{rentalCar.company}}</h4>
        <span class="vehicle-type">{{rentalCar.vehicle}}</span>
      </div>
      <div class="rental-details">
        <div class="rental-pickup">
          <h5>Pick-up</h5>
          <p class="location">{{rentalCar.pickupLocation}}</p>
          <p class="datetime">{{formatDate rentalCar.pickupDate}} at {{rentalCar.pickupTime}}</p>
        </div>
        <div class="rental-arrow">→</div>
        <div class="rental-dropoff">
          <h5>Drop-off</h5>
          <p class="location">{{rentalCar.dropoffLocation}}</p>
          <p class="datetime">{{formatDate rentalCar.dropoffDate}} at {{rentalCar.dropoffTime}}</p>
        </div>
      </div>
      <div class="rental-meta">
        <div class="rental-cost">
          <span class="daily-rate">Daily Rate: {{rentalCar.dailyRate}}</span>
          <span class="total-cost">Total Cost: {{rentalCar.totalCost}}</span>
        </div>
        <div class="rental-features">
          <p><strong>Included Features:</strong></p>
          <ul>
          {{#each rentalCar.features}}
            <li>{{this}}</li>
          {{/each}}
          </ul>
        </div>
        <p class="confirmation">Confirmation Number: <strong>{{rentalCar.confirmationNumber}}</strong></p>
      </div>
    </div>
  </section>
  {{/if}}
  
  <section>
    <h2 class="section-title">Daily Itinerary</h2>
    
    {{#each days}}
    <div class="day-section">
      <div class="day-header">
        <h3>Day {{dayNumber @index}}: {{title}}</h3>
        <span class="date">{{formatDate date}}</span>
      </div>
      
      {{#if accommodation}}
      <div class="accommodation-info">
        <h4>🏨 Accommodation</h4>
        <div class="accommodation-card">
          <h5>{{accommodation.name}}</h5>
          <p>{{accommodation.details}}</p>
        </div>
      </div>
      {{/if}}
      
      {{#if activities}}
      <div class="activities">
        <h4>📅 Activities</h4>
        {{#each activities}}
        <div class="activity-card{{#if isKimGem}} kim-gem{{/if}}">
          <div class="activity-time">{{time}}</div>
          <div class="activity-content">
            <h5>{{name}}{{kimGem isKimGem}}</h5>
            <p>{{description}}</p>
            <p class="location">📍 {{location}}</p>
          </div>
        </div>
        {{/each}}
      </div>
      {{/if}}
    </div>
    {{/each}}
  </section>

  <!-- New Enhanced Standard Sections -->
  {{#if preDepartureChecklist}}
  <section class="card checklist-section">
    <h2 class="section-title">✅ Pre-Departure Checklist</h2>
    <div class="checklist-grid">
      {{#each preDepartureChecklist}}
      <div class="checklist-category">
        <h4>{{category}}</h4>
        <ul class="checklist-items">
          {{#each items}}
          <li class="checklist-item">
            <input type="checkbox" id="checklist-{{@../index}}-{{@index}}">
            <label for="checklist-{{@../index}}-{{@index}}">{{this}}</label>
          </li>
          {{/each}}
        </ul>
      </div>
      {{/each}}
    </div>
  </section>
  {{/if}}

  {{#if travelInformation}}
  <section class="card travel-info-section">
    <h2 class="section-title">ℹ️ Important Travel Information</h2>
    <div class="travel-info-grid">
      {{#if travelInformation.emergencyContacts}}
      <div class="info-card emergency-contacts">
        <h4>🆘 Emergency Contacts</h4>
        {{#each travelInformation.emergencyContacts}}
        <div class="contact-item">
          <strong>{{name}}</strong>
          <p>{{phone}}</p>
          <span class="contact-type">{{type}}</span>
        </div>
        {{/each}}
      </div>
      {{/if}}
      
      {{#if travelInformation.timeZone}}
      <div class="info-card timezone-info">
        <h4>🕐 Time Zone Information</h4>
        <p><strong>Local Time:</strong> {{travelInformation.timeZone}}</p>
        <p><strong>Time Difference:</strong> {{travelInformation.timeDifference}}</p>
        {{#if travelInformation.jetLagTips}}
        <p><strong>Jet Lag Tips:</strong> {{travelInformation.jetLagTips}}</p>
        {{/if}}
      </div>
      {{/if}}
      
      {{#if travelInformation.weather}}
      <div class="info-card weather-info">
        <h4>🌤️ Weather & Climate</h4>
        <p><strong>Expected Weather:</strong> {{travelInformation.weather.conditions}}</p>
        <p><strong>Temperature Range:</strong> {{travelInformation.weather.temperature}}</p>
        {{#if travelInformation.weather.recommendations}}
        <p><strong>Clothing Recommendations:</strong> {{travelInformation.weather.recommendations}}</p>
        {{/if}}
      </div>
      {{/if}}
      
      {{#if travelInformation.culturalGuidelines}}
      <div class="info-card cultural-guidelines">
        <h4>🌍 Cultural Guidelines</h4>
        {{#each travelInformation.culturalGuidelines}}
        <div class="guideline-item">
          <strong>{{topic}}:</strong> {{description}}
        </div>
        {{/each}}
      </div>
      {{/if}}

      {{#if travelInformation.languageBasics}}
      <div class="info-card language-basics">
        <h4>🗣️ Language Basics</h4>
        {{#each travelInformation.languageBasics}}
        <div class="phrase-item">
          <span class="phrase-english">{{english}}</span>
          <span class="phrase-local">{{local}}</span>
        </div>
        {{/each}}
      </div>
      {{/if}}
    </div>
  </section>
  {{/if}}

  {{#if diningRecommendations}}
  <section class="card dining-section">
    <h2 class="section-title">🍽️ Dining Recommendations</h2>
    <div class="dining-grid">
      {{#each diningRecommendations}}
      <div class="restaurant-card">
        <div class="restaurant-header">
          <h4>{{name}}</h4>
          <span class="cuisine-type">{{cuisine}}</span>
          {{#if rating}}
          <span class="restaurant-rating">⭐ {{rating}}</span>
          {{/if}}
        </div>
        <div class="restaurant-details">
          {{#if specialty}}
          <p class="specialty"><strong>Specialty:</strong> {{specialty}}</p>
          {{/if}}
          {{#if description}}
          <p class="restaurant-description">{{description}}</p>
          {{/if}}
          {{#if address}}
          <p class="address">📍 {{address}}</p>
          {{/if}}
          {{#if hours}}
          <p class="hours">🕒 {{hours}}</p>
          {{/if}}
          {{#if bookingInfo}}
          <p class="booking-info">📞 {{bookingInfo}}</p>
          {{/if}}
          {{#if priceRange}}
          <p class="price-range">💰 {{priceRange}}</p>
          {{/if}}
          {{#if mustTryDishes}}
          <div class="must-try-dishes">
            <strong>Must-try dishes:</strong>
            <ul>
              {{#each mustTryDishes}}
              <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
          {{/if}}
          {{#if dietaryAccommodations}}
          <div class="dietary-accommodations">
            <strong>Dietary Options:</strong>
            <span class="dietary-tags">
              {{#each dietaryAccommodations}}
              <span class="dietary-tag">{{this}}</span>
              {{/each}}
            </span>
          </div>
          {{/if}}
          {{#if tips}}
          <p class="restaurant-tips">💡 <em>{{tips}}</em></p>
          {{/if}}
        </div>
      </div>
      {{/each}}
    </div>
    
    {{#if localFoodExperiences}}
    <div class="food-experiences">
      <h3>🌟 Local Food Experiences</h3>
      <div class="experiences-grid">
        {{#each localFoodExperiences}}
        <div class="experience-card">
          <h4>{{name}}</h4>
          <p>{{description}}</p>
          {{#if location}}
          <p class="experience-location">📍 {{location}}</p>
          {{/if}}
          {{#if duration}}
          <p class="experience-duration">⏱️ {{duration}}</p>
          {{/if}}
          {{#if cost}}
          <p class="experience-cost">💰 {{cost}}</p>
          {{/if}}
          {{#if bookingRequired}}
          <p class="booking-required">📝 Advance booking required</p>
          {{/if}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
    
    {{#if diningTips}}
    <div class="dining-tips">
      <h3>🍴 Dining Tips & Etiquette</h3>
      <div class="tips-list">
        {{#each diningTips}}
        <div class="tip-item">
          <strong>{{category}}:</strong> {{tip}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
  </section>
  {{/if}}

  {{#if investmentBreakdown}}
  <section class="card investment-section">
    <h2 class="section-title">💰 Trip Investment Breakdown</h2>
    <div class="investment-details">
      {{#if investmentBreakdown.categories}}
      <div class="cost-breakdown">
        <h4>Cost Categories</h4>
        <div class="cost-table">
          {{#each investmentBreakdown.categories}}
          <div class="cost-item">
            <span class="cost-category">{{category}}</span>
            <span class="cost-amount">{{formatCurrency amount}}</span>
            {{#if description}}
            <span class="cost-description">{{description}}</span>
            {{/if}}
          </div>
          {{/each}}
        </div>
      </div>
      {{/if}}
      
      <div class="total-cost">
        <div class="total-line">
          <strong>Total Trip Investment: {{formatCurrency investmentBreakdown.total}}</strong>
        </div>
        {{#if investmentBreakdown.perPerson}}
        <div class="per-person">
          Per Person: {{formatCurrency investmentBreakdown.perPerson}}
        </div>
        {{/if}}
        {{#if investmentBreakdown.travelers}}
        <div class="travelers-count">
          For {{investmentBreakdown.travelers}} travelers
        </div>
        {{/if}}
      </div>
      
      <div class="investment-breakdown-grid">
        {{#if investmentBreakdown.included}}
        <div class="inclusions">
          <h4>✅ What's Included</h4>
          <ul>
            {{#each investmentBreakdown.included}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
        {{/if}}
        
        {{#if investmentBreakdown.excluded}}
        <div class="exclusions">
          <h4>❌ Not Included</h4>
          <ul>
            {{#each investmentBreakdown.excluded}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
        {{/if}}
      </div>
      
      {{#if investmentBreakdown.paymentSchedule}}
      <div class="payment-schedule">
        <h4>💳 Payment Schedule</h4>
        <div class="payment-timeline">
          {{#each investmentBreakdown.paymentSchedule}}
          <div class="payment-milestone">
            <div class="payment-date">
              <strong>{{date}}</strong>
            </div>
            <div class="payment-details">
              <span class="payment-description">{{description}}</span>
              <span class="payment-amount">{{formatCurrency amount}}</span>
            </div>
            {{#if notes}}
            <div class="payment-notes">{{notes}}</div>
            {{/if}}
          </div>
          {{/each}}
        </div>
      </div>
      {{/if}}
      
      {{#if investmentBreakdown.paymentTerms}}
      <div class="payment-terms">
        <h4>📋 Payment Terms & Conditions</h4>
        <div class="terms-content">
          {{#each investmentBreakdown.paymentTerms}}
          <p>{{this}}</p>
          {{/each}}
        </div>
      </div>
      {{/if}}
      
      {{#if investmentBreakdown.cancellationPolicy}}
      <div class="cancellation-policy">
        <h4>🚫 Cancellation Policy</h4>
        <div class="policy-tiers">
          {{#each investmentBreakdown.cancellationPolicy}}
          <div class="policy-tier">
            <strong>{{timeframe}}</strong>
            <span class="penalty">{{penalty}}</span>
            {{#if details}}
            <p class="policy-details">{{details}}</p>
            {{/if}}
          </div>
          {{/each}}
        </div>
      </div>
      {{/if}}
      
      {{#if investmentBreakdown.travelInsurance}}
      <div class="travel-insurance">
        <h4>🛡️ Travel Insurance</h4>
        <div class="insurance-details">
          {{#if investmentBreakdown.travelInsurance.recommended}}
          <p class="insurance-recommendation">
            <strong>✅ Travel insurance is highly recommended for this trip</strong>
          </p>
          {{/if}}
          {{#if investmentBreakdown.travelInsurance.cost}}
          <p class="insurance-cost">
            Estimated Cost: {{formatCurrency investmentBreakdown.travelInsurance.cost}}
          </p>
          {{/if}}
          {{#if investmentBreakdown.travelInsurance.coverage}}
          <div class="insurance-coverage">
            <strong>Recommended Coverage:</strong>
            <ul>
              {{#each investmentBreakdown.travelInsurance.coverage}}
              <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
          {{/if}}
          {{#if investmentBreakdown.travelInsurance.provider}}
          <p class="insurance-provider">
            Recommended Provider: {{investmentBreakdown.travelInsurance.provider}}
          </p>
          {{/if}}
        </div>
      </div>
      {{/if}}
      
      {{#if investmentBreakdown.additionalNotes}}
      <div class="additional-notes">
        <h4>📝 Additional Notes</h4>
        <div class="notes-content">
          {{#each investmentBreakdown.additionalNotes}}
          <p>{{this}}</p>
          {{/each}}
        </div>
      </div>
      {{/if}}
    </div>
  </section>
  {{/if}}
  
  {{#if totalCost}}
  <section class="card">
    <h2 class="section-title">Trip Investment</h2>
    <div class="price-breakdown">
      <p>Total Cost: <span class="price">{{formatCurrency totalCost}}</span></p>
    </div>
  </section>
  {{/if}}
  
  <footer>
    <p>Prepared by {{agent.name}} | {{agent.email}} | {{agent.phone}}</p>
    <p>© 2025 {{agent.company}} - Creating Unforgettable Travel Experiences</p>
  </footer>
</div>
`;
}

// Create MCP Server
const server = new Server(
  {
    name: 'template-document-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_templates',
        description: 'List all available document templates',
        inputSchema: {
          type: 'object',
          properties: {
            template_type: {
              type: 'string',
              description: 'Filter templates by type (optional)'
            }
          }
        }
      },
      {
        name: 'get_template',
        description: 'Get a specific template by ID',
        inputSchema: {
          type: 'object',
          properties: {
            template_id: {
              type: 'string',
              description: 'The ID of the template to retrieve'
            }
          },
          required: ['template_id']
        }
      },
      {
        name: 'render_template',
        description: 'Render an HTML template with provided data using proper Handlebars',
        inputSchema: {
          type: 'object',
          properties: {
            template_id: {
              type: 'string',
              description: 'The ID of the template to render'
            },
            data: {
              type: 'object',
              description: 'The data to use for template rendering'
            },
            output_format: {
              type: 'string',
              enum: ['html', 'markdown'],
              default: 'html',
              description: 'Output format for the rendered document'
            }
          },
          required: ['template_id', 'data']
        }
      },
      {
        name: 'generate_itinerary',
        description: 'Generate a comprehensive travel itinerary with fixed template rendering',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Trip title'
            },
            clientName: {
              type: 'string',
              description: 'Client name'
            },
            startDate: {
              type: 'string',
              description: 'Trip start date'
            },
            endDate: {
              type: 'string',
              description: 'Trip end date'
            },
            totalDays: {
              type: 'number',
              description: 'Total number of days'
            },
            agent: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                company: { type: 'string' },
                tagline: { type: 'string' }
              },
              description: 'Travel agent information'
            },
            overview: {
              type: 'string',
              description: 'Trip overview description'
            },
            days: {
              type: 'array',
              description: 'Array of day objects with activities and accommodations',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string' },
                  accommodation: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      details: { type: 'string' }
                    }
                  },
                  activities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        time: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        location: { type: 'string' },
                        isKimGem: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            },
            totalCost: {
              type: 'number',
              description: 'Total trip cost'
            }
          },
          required: ['title', 'clientName', 'days']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const env = (globalThis as any).env as Env;
  
  if (!args) {
    throw new Error('Missing arguments');
  }

  try {
    switch (name) {
      case 'list_templates':
        const templates = await listTemplates(env.TRAVEL_ASSISTANT, (args as any).template_type);
        const templateList = templates.map((t: any) => ({
          template_id: t.template_id,
          template_name: t.template_name,
          template_type: t.template_type,
          variables: JSON.parse(t.variables || '[]')
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ templates: templateList }, null, 2)
            }
          ]
        };

      case 'get_template':
        const template = await getTemplate(env.TRAVEL_ASSISTANT, (args as any).template_id);
        if (!template) {
          throw new Error(`Template not found: ${(args as any).template_id}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(template, null, 2)
            }
          ]
        };

      case 'render_template':
        const startTime = Date.now();
        const templateData = await getTemplate(env.TRAVEL_ASSISTANT, (args as any).template_id);
        
        if (!templateData) {
          throw new Error(`Template not found: ${(args as any).template_id}`);
        }

        const engine = TemplateEngine.getInstance();
        const renderedHtml = await engine.render(
          templateData.html_template as string,
          (args as any).data,
          templateData.css_styles as string
        );

        const renderTime = Date.now() - startTime;
        await logTemplateUsage(
          env.TRAVEL_ASSISTANT,
          (args as any).template_id,
          null,
          (args as any).data,
          renderTime
        );

        let output = renderedHtml;
        if ((args as any).output_format === 'markdown') {
          // Simple HTML to markdown conversion
          output = renderedHtml
            .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
            .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
            .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
            .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n')
            .replace(/<li[^>]*>(.*?)<\/li>/g, '- $1')
            .replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
        }

        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };

      case 'generate_itinerary':
        const itineraryEngine = TemplateEngine.getInstance();
        const itineraryTemplate = getItineraryTemplate();
        
        // Enhanced CSS with flight and rental car styling
        const cssStyles = `
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --accent-color: #e74c3c;
  --text-color: #333;
  --bg-color: #f5f5f7;
  --card-bg: #ffffff;
  --shadow: 0 2px 10px rgba(0,0,0,0.1);
  --border-radius: 12px;
  --transition: all 0.3s ease;
  --flight-color: #2980b9;
  --rental-color: #27ae60;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--bg-color);
}

.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

header {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  padding: 4rem 2rem;
  text-align: center;
  border-radius: var(--border-radius);
  margin-bottom: 3rem;
  box-shadow: var(--shadow);
}

h1 { 
  font-size: 3rem; 
  margin-bottom: 1rem; 
  font-weight: 700;
  letter-spacing: -1px;
}

.subtitle { 
  font-size: 1.4rem; 
  opacity: 0.9; 
  margin-bottom: 1rem; 
}

.trip-overview {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.trip-overview span {
  background: rgba(255,255,255,0.2);
  padding: 0.5rem 1.5rem;
  border-radius: 25px;
  backdrop-filter: blur(10px);
}

.card {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}

.section-title {
  color: var(--primary-color);
  font-size: 2rem;
  margin-bottom: 1.5rem;
  position: relative;
  padding-bottom: 0.5rem;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 60px;
  height: 3px;
  background: var(--accent-color);
  border-radius: 2px;
}

.day-section {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);
  border-left: 5px solid var(--secondary-color);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.day-header h3 {
  color: var(--primary-color);
  font-size: 1.5rem;
}

.date {
  color: var(--secondary-color);
  font-weight: 500;
}

.accommodation-card, .activity-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid var(--secondary-color);
}

/* Flight Card Styling */
.flight-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-left: 5px solid var(--flight-color);
}

.flight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.flight-header h4 {
  color: var(--flight-color);
  font-size: 1.2rem;
  margin: 0;
}

.flight-number {
  background: var(--flight-color);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-weight: bold;
  font-size: 0.9rem;
}

.flight-details {
  margin-top: 1rem;
}

.flight-leg {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.departure, .arrival {
  flex: 1;
  text-align: center;
}

.departure h5, .arrival h5 {
  color: var(--flight-color);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.airport {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 0.2rem;
}

.city {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}

.datetime {
  font-weight: 500;
  color: var(--primary-color);
}

.flight-arrow {
  font-size: 2rem;
  color: var(--flight-color);
  font-weight: bold;
}

.flight-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
  font-size: 0.9rem;
}

.duration {
  color: #666;
}

.confirmation {
  font-weight: bold;
  color: var(--flight-color);
}

/* Rental Car Styling */
.rental-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  border-left: 5px solid var(--rental-color);
}

.rental-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.rental-header h4 {
  color: var(--rental-color);
  font-size: 1.2rem;
  margin: 0;
}

.vehicle-type {
  background: var(--rental-color);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-weight: bold;
  font-size: 0.9rem;
}

.rental-details {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.rental-pickup, .rental-dropoff {
  flex: 1;
  text-align: center;
}

.rental-pickup h5, .rental-dropoff h5 {
  color: var(--rental-color);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.location {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}

.rental-arrow {
  font-size: 2rem;
  color: var(--rental-color);
  font-weight: bold;
}

.rental-meta {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.rental-cost {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-weight: 500;
}

.daily-rate {
  color: #666;
}

.total-cost {
  color: var(--rental-color);
  font-weight: bold;
}

.rental-features {
  margin-bottom: 1rem;
}

.rental-features ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.rental-features li {
  margin-bottom: 0.3rem;
  color: #666;
}

.activity-card.kim-gem {
  border-left-color: #ffd700;
  background: linear-gradient(to right, rgba(255,215,0,0.1), #f8f9fa);
}

.gem-badge {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #333;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  display: inline-block;
  margin-left: 0.5rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.price {
  color: var(--accent-color);
  font-weight: 600;
  font-size: 1.1rem;
}

.price-breakdown {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  margin-top: 1rem;
}

footer {
  text-align: center;
  padding: 3rem 0;
  color: #666;
  border-top: 1px solid #e0e0e0;
  margin-top: 3rem;
}

/* Enhanced Standard Sections Styling */

/* Checklist Section */
.checklist-section {
  margin: 2rem 0;
}

.checklist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.checklist-category h4 {
  color: var(--primary-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--accent-color);
}

.checklist-items {
  list-style: none;
  padding: 0;
}

.checklist-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.checklist-item input[type="checkbox"] {
  margin-right: 0.75rem;
  transform: scale(1.2);
}

/* Travel Information */
.travel-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.info-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--secondary-color);
}

.emergency-contacts {
  border-left-color: var(--accent-color);
}

.contact-item,
.guideline-item {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.contact-type {
  background: var(--accent-color);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.phrase-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: rgba(255,255,255,0.5);
  border-radius: 6px;
}

.phrase-english {
  font-weight: 500;
}

.phrase-local {
  font-style: italic;
  color: var(--primary-color);
}

/* Enhanced Transportation */
.transport-category {
  margin-bottom: 2rem;
}

.transport-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.transport-card, .intercity-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--secondary-color);
}

.transport-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.transport-apps {
  background: var(--secondary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.route-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.transport-method {
  background: var(--primary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.journey-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.journey-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
}

.luggage-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.luggage-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--flight-color);
}

.luggage-item {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: rgba(255,255,255,0.5);
  border-radius: 6px;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.tip-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--accent-color);
}

/* Dining Section */
.dining-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.restaurant-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--rental-color);
}

.restaurant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.cuisine-type {
  background: var(--rental-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
}

.restaurant-rating {
  background: #ffd700;
  color: #333;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: bold;
}

.must-try-dishes ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.dietary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dietary-tag {
  background: var(--accent-color);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.experiences-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.experience-card {
  background: #f0f8ff;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid var(--secondary-color);
}

.dining-tips {
  margin-top: 2rem;
}

.tips-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.tip-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid var(--accent-color);
}

/* Investment Section */
.cost-table {
  margin-bottom: 2rem;
}

.cost-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.cost-description {
  font-size: 0.9rem;
  color: #666;
  flex: 1;
  margin-left: 1rem;
}

.investment-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.inclusions,
.exclusions {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
}

.inclusions {
  border-left: 4px solid #28a745;
}

.exclusions {
  border-left: 4px solid #dc3545;
}

.inclusions ul,
.exclusions ul {
  margin-left: 1rem;
}

.payment-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.payment-milestone {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.payment-date {
  min-width: 120px;
}

.payment-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-notes {
  grid-column: 2;
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.5rem;
}

.terms-content {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
}

.policy-tiers {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.policy-tier {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #ffc107;
}

.policy-details {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.insurance-details {
  background: #f0f8ff;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--secondary-color);
}

.insurance-recommendation {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.insurance-coverage ul {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.additional-notes {
  margin-top: 2rem;
}

.notes-content {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
}

@media (max-width: 768px) {
  .container { padding: 1rem; }
  h1 { font-size: 2rem; }
  .card, .day-section { padding: 1.5rem; }
  .day-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  
  /* Mobile responsiveness for new sections */
  .checklist-grid,
  .travel-info-grid,
  .dining-grid,
  .transport-grid,
  .luggage-info,
  .tips-grid,
  .experiences-grid,
  .tips-list,
  .investment-breakdown-grid {
    grid-template-columns: 1fr;
  }
  
  .restaurant-header,
  .transport-header,
  .route-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .journey-details {
    grid-template-columns: 1fr;
  }
  
  .payment-milestone {
    grid-template-columns: 1fr;
  }
  
  .policy-tier {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .phrase-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .dietary-tags {
    justify-content: flex-start;
  }
}
`;

        const itineraryHtml = await itineraryEngine.render(itineraryTemplate, args as any, cssStyles);

        return {
          content: [
            {
              type: 'text',
              text: itineraryHtml
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    throw error;
  }
});

// Cloudflare Worker export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Store env in global for access in handlers
      (globalThis as any).env = env;

      const url = new URL(request.url);
      console.log(`[DEBUG] Incoming request: ${request.method} ${url.pathname}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        server: 'template-document-mcp',
        version: '1.0.0' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // SSE endpoint for MCP remote connection - Direct JSON-RPC handling
    if (url.pathname === '/sse') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
          },
        });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json() as any;
          console.log('[DEBUG] Received MCP message:', JSON.stringify(body));

          let response;

          // Handle different MCP methods directly
          switch (body.method) {
            case "initialize":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  protocolVersion: "2025-06-18",
                  capabilities: {
                    tools: {}
                  },
                  serverInfo: {
                    name: "Template Document MCP",
                    version: "1.0.0"
                  }
                }
              };
              break;

            case "tools/list":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  tools: [
                    {
                      name: 'render_template',
                      description: 'Render a travel document template with provided data',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          templateId: { type: 'string', description: 'Template ID to use' },
                          data: { type: 'object', description: 'Data to populate the template' },
                          format: { type: 'string', enum: ['html', 'pdf'], description: 'Output format' }
                        },
                        required: ['data']
                      }
                    },
                    {
                      name: 'list_templates',
                      description: 'List available document templates',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', description: 'Filter by template type' }
                        }
                      }
                    }
                  ]
                }
              };
              break;

            case "tools/call":
              const toolName = body.params.name;
              const toolArgs = body.params.arguments || {};
              
              try {
                let result;
                switch (toolName) {
                  case 'render_template':
                    const templateEngine = TemplateEngine.getInstance();
                    const template = getItineraryTemplate();
                    const html = await templateEngine.render(template, toolArgs.data, getCssStyles());
                    
                    result = {
                      content: [{
                        type: 'text',
                        text: JSON.stringify({
                          success: true,
                          html: html,
                          format: toolArgs.format || 'html'
                        }, null, 2)
                      }]
                    };
                    break;

                  case 'list_templates':
                    const env = (this as any).env as Env;
                    const templates = await listTemplates(env.TRAVEL_ASSISTANT, toolArgs.type);
                    result = {
                      content: [{
                        type: 'text',
                        text: JSON.stringify({
                          success: true,
                          templates: templates
                        }, null, 2)
                      }]
                    };
                    break;

                  default:
                    throw new Error(`Unknown tool: ${toolName}`);
                }

                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  result: result
                };
              } catch (error) {
                console.error('[ERROR] Tool execution failed:', error);
                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  error: {
                    code: -32603,
                    message: "Internal error",
                    data: error instanceof Error ? error.message : JSON.stringify(error)
                  }
                };
              }
              break;

            default:
              response = {
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32601,
                  message: "Method not found",
                  data: `Unknown method: ${body.method}`
                }
              };
              break;
          }

          console.log('[DEBUG] Sending MCP response:', JSON.stringify(response));
          
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Accept',
            },
          });
        } catch (error) {
          console.error('[ERROR] SSE JSON-RPC handling failed:', error);
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error",
              data: error instanceof Error ? error.message : JSON.stringify(error)
            }
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          });
        }
      }
      
      return new Response('Method not allowed', { status: 405 });
    }

    return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('[CRITICAL ERROR] Worker exception caught:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Error message:', error instanceof Error ? error.message : JSON.stringify(error));
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
} satisfies ExportedHandler<Env>;