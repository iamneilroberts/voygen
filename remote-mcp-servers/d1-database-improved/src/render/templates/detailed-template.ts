// ============================================================================
// Detailed Template - Comprehensive Travel Proposal
// ============================================================================

import { BaseTemplate, TemplateContext } from './base-template';
import { CORE_COMPONENTS } from './components';

export class DetailedTemplate extends BaseTemplate {
  
  getTemplateName(): string {
    return 'detailed';
  }
  
  getDescription(): string {
    return 'Comprehensive template with full details, descriptions, and explanations. Perfect for luxury travel and complex itineraries.';
  }
  
  getSuitableFor(): string[] {
    return [
      'Luxury travel proposals',
      'Complex multi-destination trips',
      'High-value bookings',
      'First-time clients needing full context',
      'Detailed vacation planning'
    ];
  }
  
  protected registerComponents(): void {
    CORE_COMPONENTS.forEach(component => {
      this.registerComponent(component);
    });
  }
  
  protected renderTemplate(context: TemplateContext): string {
    const { data, helpers } = context;
    
    // Header section
    const header = this.renderComponent('header', null, context);
    
    // Introduction section
    const intro = this.renderIntroduction(context);
    
    // Hotels section
    const hotels = this.renderHotelsSection(context);
    
    // Flights section
    const flights = this.renderFlightsSection(context);
    
    // Ground transportation section
    const ground = this.renderGroundSection(context);
    
    // Tours and activities section
    const tours = this.renderToursSection(context);
    
    // Cost summary section
    const costSummary = this.renderCostSection(context);
    
    // Insurance section (if available)
    const insurance = this.renderInsuranceSection(context);
    
    // Next steps section
    const nextSteps = this.renderComponent('next-steps', null, context);
    
    // Footer
    const footer = this.renderComponent('footer', null, context);
    
    return `
      ${header}
      
      <main class="content">
        ${intro}
        ${hotels}
        ${flights}
        ${ground}
        ${tours}
        ${costSummary}
        ${insurance}
        ${nextSteps}
      </main>
      
      ${footer}
    `;
  }
  
  private renderIntroduction(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    if (!trip) return '';
    
    const title = helpers.decorateSection('About Your Trip', 'h3');
    const destination = trip.legs?.[0]?.dest_name || 'your destination';
    const partySize = trip.party?.adults || 2;
    const children = trip.party?.children || 0;
    
    const partyText = children > 0 ? 
      `${helpers.pluralize(partySize, 'adult')} and ${helpers.pluralize(children, 'child', 'children')}` :
      helpers.pluralize(partySize, 'traveler');
    
    return `
      <section class="section introduction">
        <h3>${title}</h3>
        <div class="intro-content">
          <p>We're excited to present this carefully curated travel experience for ${partyText} to ${destination}. 
          This proposal includes handpicked accommodations, transportation options, and activities designed to create 
          unforgettable memories.</p>
          
          ${trip.prefs?.styles && trip.prefs.styles.length > 0 ? `
            <div class="travel-style">
              <strong>Travel Style:</strong> ${trip.prefs.styles.join(', ')}
            </div>
          ` : ''}
          
          ${trip.prefs?.budget_per_night ? `
            <div class="budget-preference">
              <strong>Accommodation Budget:</strong> ${helpers.formatCurrency(trip.prefs.budget_per_night)} per night
            </div>
          ` : ''}
          
          <p class="personalization-note">Every element of this itinerary has been selected based on your preferences 
          and our destination expertise. We're here to customize any aspect to perfectly match your vision.</p>
        </div>
      </section>
    `;
  }
  
  private renderHotelsSection(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.hotels || data.hotels.length === 0) return '';
    
    const title = helpers.decorateSection('Accommodations', 'h3');
    
    const hotelsHtml = data.hotels.map(hotel => {
      const hotelCard = this.renderComponent('hotel-card', hotel, context);
      
      // Add room details if available
      const relatedRooms = data.rooms?.filter(room => 
        room.hotel_id === hotel.hotel_id || room.hotel_name === hotel.name
      ) || [];
      
      const roomsHtml = relatedRooms.length > 0 ? `
        <div class="room-options">
          <h5>Room Options:</h5>
          ${relatedRooms.map(room => 
            this.renderComponent('room-details', room, context)
          ).join('')}
        </div>
      ` : '';
      
      return `
        <div class="hotel-section">
          ${hotelCard}
          ${roomsHtml}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section hotels">
        <h3>${title}</h3>
        <div class="hotels-intro">
          <p>We've selected these accommodations based on their exceptional service, prime locations, and unique character. 
          Each property offers a distinct experience while maintaining the highest standards of comfort and hospitality.</p>
        </div>
        ${hotelsHtml}
      </section>
    `;
  }
  
  private renderFlightsSection(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.flights || data.flights.length === 0) return '';
    
    const title = helpers.decorateSection('Flight Arrangements', 'h3');
    
    const flightsHtml = data.flights.map(flight => 
      this.renderComponent('flight', flight, context)
    ).join('');
    
    return `
      <section class="section flights">
        <h3>${title}</h3>
        <div class="flights-intro">
          <p>Your flight arrangements have been carefully selected to optimize your travel time while providing 
          comfort and value. All flights are subject to availability and final confirmation.</p>
        </div>
        ${flightsHtml}
        
        <div class="flight-notes">
          <h4>Important Flight Information:</h4>
          <ul>
            <li>Please arrive at the airport at least 2 hours before domestic flights and 3 hours before international flights</li>
            <li>Check-in online 24 hours before departure to secure your preferred seats</li>
            <li>Ensure your identification documents are valid and will not expire during your trip</li>
            <li>Review baggage policies and restrictions for your specific airline</li>
          </ul>
        </div>
      </section>
    `;
  }
  
  private renderGroundSection(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.ground || data.ground.length === 0) return '';
    
    const title = helpers.decorateSection('Transportation', 'h3');
    
    const groundHtml = data.ground.map(transport => 
      this.renderComponent('ground-transport', transport, context)
    ).join('');
    
    return `
      <section class="section ground-transport">
        <h3>${title}</h3>
        <div class="transport-intro">
          <p>We've arranged reliable transportation to ensure smooth transitions throughout your journey. 
          All transfers are with licensed, professional drivers familiar with local routes and conditions.</p>
        </div>
        ${groundHtml}
      </section>
    `;
  }
  
  private renderToursSection(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.tours || data.tours.length === 0) return '';
    
    const title = helpers.decorateSection('Tours & Experiences', 'h3');
    
    const toursHtml = data.tours.map(tour => 
      this.renderComponent('tour', tour, context)
    ).join('');
    
    return `
      <section class="section tours">
        <h3>${title}</h3>
        <div class="tours-intro">
          <p>These carefully selected experiences showcase the best of your destination, from cultural highlights 
          to hidden gems known only to locals. Each tour is led by expert guides who bring the destination to life 
          with insider knowledge and engaging storytelling.</p>
        </div>
        ${toursHtml}
        
        <div class="tour-notes">
          <h4>Tour Booking Notes:</h4>
          <ul>
            <li>All tours are subject to weather conditions and may be rescheduled if necessary</li>
            <li>Comfortable walking shoes and weather-appropriate clothing are recommended</li>
            <li>Please inform us of any dietary restrictions or accessibility needs</li>
            <li>Gratuities for guides are appreciated but not mandatory</li>
          </ul>
        </div>
      </section>
    `;
  }
  
  private renderCostSection(context: TemplateContext): string {
    const { data } = context;
    
    if (!data.financials) return '';
    
    const costSummary = this.renderComponent('cost-summary', data.financials, context);
    
    return `
      <section class="section cost-section">
        ${costSummary}
        
        <div class="value-statement">
          <h4>What's Included in Your Investment:</h4>
          <ul>
            <li>Carefully selected accommodations with premium locations</li>
            <li>Professional travel planning and 24/7 support during your trip</li>
            <li>Exclusive access to local experiences and insider recommendations</li>
            <li>Flexible booking options with our preferred partners</li>
            <li>Detailed travel documentation and mobile itinerary access</li>
          </ul>
        </div>
        
        <div class="pricing-notes">
          <h4>Pricing Information:</h4>
          <p>All prices are quoted in ${data.financials.currency || 'USD'} and are subject to availability. 
          Final pricing will be confirmed at the time of booking. Some services may require deposits or 
          advance payment. We'll work with you to structure payments that fit your preferences.</p>
        </div>
      </section>
    `;
  }
  
  private renderInsuranceSection(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.insurance) return '';
    
    const title = helpers.decorateSection('Travel Protection', 'h3');
    
    return `
      <section class="section insurance">
        <h3>${title}</h3>
        <div class="insurance-content">
          ${data.insurance.recommended ? `
            <div class="insurance-recommendation">
              <p><strong>We strongly recommend travel insurance for this trip.</strong></p>
              <p>${data.insurance.reason || 'Travel insurance protects your investment and provides peace of mind.'}</p>
            </div>
          ` : ''}
          
          ${data.insurance.coverage_options && data.insurance.coverage_options.length > 0 ? `
            <h4>Recommended Coverage:</h4>
            <ul>
              ${data.insurance.coverage_options.map(option => `<li>${option}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${data.insurance.cost ? `
            <div class="insurance-cost">
              <strong>Estimated Cost:</strong> ${helpers.formatCurrency(data.insurance.cost)}
            </div>
          ` : ''}
          
          <div class="insurance-note">
            <p>We can arrange comprehensive travel insurance through our trusted partners. 
            Coverage options include trip cancellation, medical emergencies, baggage loss, and travel delays. 
            Please let us know if you'd like a detailed quote.</p>
          </div>
        </div>
      </section>
    `;
  }
}