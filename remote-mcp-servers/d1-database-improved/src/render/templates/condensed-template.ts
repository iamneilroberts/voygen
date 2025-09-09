// ============================================================================
// Condensed Template - Executive Summary Style
// ============================================================================

import { BaseTemplate, TemplateContext } from './base-template';
import { CORE_COMPONENTS } from './components';

export class CondensedTemplate extends BaseTemplate {
  
  getTemplateName(): string {
    return 'condensed';
  }
  
  getDescription(): string {
    return 'Executive summary format with key details only. Perfect for busy travelers who want essential information at a glance.';
  }
  
  getSuitableFor(): string[] {
    return [
      'Executive travelers',
      'Quick decision making',
      'Simple trip proposals',
      'Repeat clients',
      'Mobile-first viewing'
    ];
  }
  
  protected registerComponents(): void {
    CORE_COMPONENTS.forEach(component => {
      this.registerComponent(component);
    });
  }
  
  protected renderTemplate(context: TemplateContext): string {
    const { data } = context;
    
    // Header section
    const header = this.renderComponent('header', null, context);
    
    // Trip overview
    const overview = this.renderTripOverview(context);
    
    // Hotels (condensed format)
    const hotels = this.renderHotelsCondensed(context);
    
    // Transportation summary
    const transport = this.renderTransportSummary(context);
    
    // Activities summary
    const activities = this.renderActivitiesSummary(context);
    
    // Cost summary
    const costSummary = this.renderComponent('cost-summary', data.financials, context);
    
    // Next steps
    const nextSteps = this.renderComponent('next-steps', null, context);
    
    // Footer
    const footer = this.renderComponent('footer', null, context);
    
    return `
      ${header}
      
      <main class="content">
        ${overview}
        ${hotels}
        ${transport}
        ${activities}
        ${costSummary}
        ${nextSteps}
      </main>
      
      ${footer}
    `;
  }
  
  private renderTripOverview(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    if (!trip) return '';
    
    const title = helpers.decorateSection('Trip Summary', 'h3');
    const destination = trip.legs?.[0]?.dest_name || 'Destination';
    const partySize = trip.party?.adults || 2;
    const children = trip.party?.children || 0;
    
    const partyText = children > 0 ? 
      `${partySize}A/${children}C` : // Abbreviated format
      `${partySize} ${partySize === 1 ? 'traveler' : 'travelers'}`;
    
    const duration = trip.legs?.[0] && trip.legs[0].dep_date && trip.legs[0].ret_date ?
      helpers.calculateNights(trip.legs[0].dep_date, trip.legs[0].ret_date) : 0;
    
    return `
      <section class="section overview">
        <h3>${title}</h3>
        <div class="overview-grid">
          <div class="overview-item">
            <strong>Destination:</strong> ${destination}
          </div>
          <div class="overview-item">
            <strong>Travelers:</strong> ${partyText}
          </div>
          ${duration > 0 ? `
            <div class="overview-item">
              <strong>Duration:</strong> ${helpers.pluralize(duration, 'night')}
            </div>
          ` : ''}
          ${trip.prefs?.budget_per_night ? `
            <div class="overview-item">
              <strong>Budget:</strong> ${helpers.formatCurrency(trip.prefs.budget_per_night)}/night
            </div>
          ` : ''}
        </div>
      </section>
    `;
  }
  
  private renderHotelsCondensed(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.hotels || data.hotels.length === 0) return '';
    
    const title = helpers.decorateSection('Accommodations', 'h3');
    
    const hotelsHtml = data.hotels.map(hotel => {
      const name = hotel.name;
      const rating = hotel.star_rating ? helpers.generateStarRating(hotel.star_rating) : '';
      const price = hotel.price_per_night ? helpers.formatCurrency(hotel.price_per_night) : '';
      const location = hotel.location || '';
      
      const nights = hotel.checkin_date && hotel.checkout_date ? 
        helpers.calculateNights(hotel.checkin_date, hotel.checkout_date) : 0;
      const totalCost = price && nights > 0 ? 
        helpers.formatCurrency(hotel.price_per_night! * nights) : '';
      
      return `
        <div class="hotel-condensed">
          <div class="hotel-header">
            <h4>${name} ${rating}</h4>
            <div class="hotel-price">
              ${price ? `${price}/night` : ''}
              ${totalCost && nights > 0 ? ` • ${totalCost} total` : ''}
            </div>
          </div>
          ${location ? `<div class="hotel-location">${location}</div>` : ''}
          ${hotel.refundable ? '<span class="refundable-badge">Refundable</span>' : ''}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section hotels-condensed">
        <h3>${title}</h3>
        ${hotelsHtml}
      </section>
    `;
  }
  
  private renderTransportSummary(context: TemplateContext): string {
    const { data, helpers } = context;
    
    const hasFlights = data.flights && data.flights.length > 0;
    const hasGround = data.ground && data.ground.length > 0;
    
    if (!hasFlights && !hasGround) return '';
    
    const title = helpers.decorateSection('Transportation', 'h3');
    
    let transportHtml = '';
    
    if (hasFlights) {
      const flightsSummary = data.flights!.map(flight => {
        const route = `${flight.origin_city || flight.origin_airport || 'Origin'} → ${flight.destination_city || flight.destination_airport || 'Destination'}`;
        const airline = flight.airline || 'TBD';
        const price = flight.price ? helpers.formatCurrency(flight.price) : '';
        
        return `
          <div class="transport-item">
            <strong>Flight:</strong> ${route} (${airline})
            ${price ? ` - ${price}` : ''}
          </div>
        `;
      }).join('');
      
      transportHtml += flightsSummary;
    }
    
    if (hasGround) {
      const groundSummary = data.ground!.map(ground => {
        const type = ground.type || 'Transportation';
        const route = ground.pickup_location && ground.dropoff_location ? 
          `${ground.pickup_location} → ${ground.dropoff_location}` : '';
        const price = ground.price ? helpers.formatCurrency(ground.price) : '';
        
        return `
          <div class="transport-item">
            <strong>${type}:</strong> ${route}
            ${price ? ` - ${price}` : ''}
          </div>
        `;
      }).join('');
      
      transportHtml += groundSummary;
    }
    
    return `
      <section class="section transport-summary">
        <h3>${title}</h3>
        ${transportHtml}
      </section>
    `;
  }
  
  private renderActivitiesSummary(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.tours || data.tours.length === 0) return '';
    
    const title = helpers.decorateSection('Activities', 'h3');
    
    const activitiesHtml = data.tours.map(tour => {
      const name = tour.name;
      const duration = tour.duration_hours ? 
        `${tour.duration_hours}h` : '';
      const price = tour.price_per_person ? 
        helpers.formatCurrency(tour.price_per_person) + '/pp' : '';
      
      return `
        <div class="activity-item">
          <strong>${name}</strong>
          ${duration ? ` (${duration})` : ''}
          ${price ? ` - ${price}` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section activities-summary">
        <h3>${title}</h3>
        ${activitiesHtml}
      </section>
    `;
  }
}