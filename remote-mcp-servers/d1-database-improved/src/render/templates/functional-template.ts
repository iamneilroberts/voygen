// ============================================================================
// Functional Template - Clean Information-First Design
// ============================================================================

import { BaseTemplate, TemplateContext } from './base-template';
import { CORE_COMPONENTS } from './components';

export class FunctionalTemplate extends BaseTemplate {
  
  getTemplateName(): string {
    return 'functional';
  }
  
  getDescription(): string {
    return 'Clean, information-focused template optimized for clarity and quick scanning. Perfect for straightforward travel proposals.';
  }
  
  getSuitableFor(): string[] {
    return [
      'Business travel',
      'Budget-conscious travelers',
      'Simple itineraries',
      'Quick bookings',
      'Information-heavy proposals'
    ];
  }
  
  protected registerComponents(): void {
    CORE_COMPONENTS.forEach(component => {
      this.registerComponent(component);
    });
  }
  
  protected renderTemplate(context: TemplateContext): string {
    const { data } = context;
    
    // Clean header
    const header = this.renderCleanHeader(context);
    
    // Trip information table
    const tripInfo = this.renderTripInformation(context);
    
    // Accommodations list
    const hotels = this.renderHotelsList(context);
    
    // Transportation details
    const transport = this.renderTransportationDetails(context);
    
    // Activities list
    const activities = this.renderActivitiesList(context);
    
    // Cost breakdown
    const costBreakdown = this.renderCostBreakdown(context);
    
    // Booking information
    const bookingInfo = this.renderBookingInformation(context);
    
    // Footer with essentials
    const footer = this.renderComponent('footer', null, context);
    
    return `
      ${header}
      
      <main class="content functional-content">
        ${tripInfo}
        ${hotels}
        ${transport}
        ${activities}
        ${costBreakdown}
        ${bookingInfo}
      </main>
      
      ${footer}
    `;
  }
  
  private renderCleanHeader(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    const tripName = trip?.party_name || 'Travel Proposal';
    const destination = trip?.legs?.[0]?.dest_name || 'Destination';
    const dateRange = trip?.legs?.[0] ? 
      helpers.formatDateRange(trip.legs[0].dep_date, trip.legs[0].ret_date) : '';
    
    return `
      <header class="header functional-header">
        <h1>${tripName}</h1>
        <h2>${destination}</h2>
        ${dateRange ? `<div class="trip-dates">${dateRange}</div>` : ''}
      </header>
    `;
  }
  
  private renderTripInformation(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    if (!trip) return '';
    
    const title = helpers.decorateSection('Trip Information', 'h3');
    const destination = trip.legs?.[0]?.dest_name || 'N/A';
    const partySize = trip.party?.adults || 2;
    const children = trip.party?.children || 0;
    
    const duration = trip.legs?.[0] && trip.legs[0].dep_date && trip.legs[0].ret_date ?
      helpers.calculateNights(trip.legs[0].dep_date, trip.legs[0].ret_date) : 0;
    
    return `
      <section class="section trip-information">
        <h3>${title}</h3>
        <table class="info-table">
          <tbody>
            <tr>
              <td><strong>Destination:</strong></td>
              <td>${destination}</td>
            </tr>
            <tr>
              <td><strong>Travelers:</strong></td>
              <td>${partySize} ${partySize === 1 ? 'adult' : 'adults'}${children > 0 ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''}</td>
            </tr>
            ${duration > 0 ? `
              <tr>
                <td><strong>Duration:</strong></td>
                <td>${helpers.pluralize(duration, 'night')}</td>
              </tr>
            ` : ''}
            ${trip.prefs?.budget_per_night ? `
              <tr>
                <td><strong>Budget per night:</strong></td>
                <td>${helpers.formatCurrency(trip.prefs.budget_per_night)}</td>
              </tr>
            ` : ''}
            ${trip.prefs?.styles && trip.prefs.styles.length > 0 ? `
              <tr>
                <td><strong>Travel style:</strong></td>
                <td>${trip.prefs.styles.join(', ')}</td>
              </tr>
            ` : ''}
            <tr>
              <td><strong>Refundable options:</strong></td>
              <td>${trip.prefs?.refundable ? 'Preferred' : 'Standard'}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
  }
  
  private renderHotelsList(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.hotels || data.hotels.length === 0) return '';
    
    const title = helpers.decorateSection('Accommodations', 'h3');
    
    const hotelsHtml = data.hotels.map((hotel, index) => {
      const name = hotel.name;
      const rating = hotel.star_rating ? `${hotel.star_rating} stars` : 'N/A';
      const location = hotel.location || 'N/A';
      const price = hotel.price_per_night ? helpers.formatCurrency(hotel.price_per_night) : 'N/A';
      
      const nights = hotel.checkin_date && hotel.checkout_date ? 
        helpers.calculateNights(hotel.checkin_date, hotel.checkout_date) : 0;
      const totalCost = price !== 'N/A' && nights > 0 ? 
        helpers.formatCurrency(hotel.price_per_night! * nights) : 'N/A';
      
      const checkinDate = hotel.checkin_date ? helpers.formatDate(hotel.checkin_date) : 'N/A';
      const checkoutDate = hotel.checkout_date ? helpers.formatDate(hotel.checkout_date) : 'N/A';
      
      return `
        <div class="hotel-functional">
          <h4>Hotel ${index + 1}: ${name}</h4>
          <table class="hotel-details-table">
            <tbody>
              <tr>
                <td><strong>Rating:</strong></td>
                <td>${rating}</td>
              </tr>
              <tr>
                <td><strong>Location:</strong></td>
                <td>${location}</td>
              </tr>
              <tr>
                <td><strong>Check-in:</strong></td>
                <td>${checkinDate}</td>
              </tr>
              <tr>
                <td><strong>Check-out:</strong></td>
                <td>${checkoutDate}</td>
              </tr>
              <tr>
                <td><strong>Nightly rate:</strong></td>
                <td>${price}</td>
              </tr>
              ${nights > 0 ? `
                <tr>
                  <td><strong>Total (${nights} nights):</strong></td>
                  <td>${totalCost}</td>
                </tr>
              ` : ''}
              <tr>
                <td><strong>Refundable:</strong></td>
                <td>${hotel.refundable ? 'Yes' : 'No'}</td>
              </tr>
              ${hotel.commission_percent ? `
                <tr>
                  <td><strong>Commission:</strong></td>
                  <td>${hotel.commission_percent}%</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
          
          ${hotel.amenities && hotel.amenities.length > 0 ? `
            <div class="hotel-amenities">
              <strong>Amenities:</strong>
              <ul class="amenities-list">
                ${hotel.amenities.map(amenity => `<li>${amenity}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${hotel.description ? `
            <div class="hotel-description">
              <strong>Description:</strong>
              <p>${hotel.description}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section hotels-list">
        <h3>${title}</h3>
        ${hotelsHtml}
      </section>
    `;
  }
  
  private renderTransportationDetails(context: TemplateContext): string {
    const { data, helpers } = context;
    
    const hasFlights = data.flights && data.flights.length > 0;
    const hasGround = data.ground && data.ground.length > 0;
    
    if (!hasFlights && !hasGround) return '';
    
    const title = helpers.decorateSection('Transportation', 'h3');
    
    let transportContent = '';
    
    if (hasFlights) {
      transportContent += `
        <div class="transportation-section">
          <h4>Flights</h4>
          ${data.flights!.map((flight, index) => {
            const airline = flight.airline || 'TBD';
            const flightNumber = flight.flight_number || 'TBD';
            const origin = flight.origin_city || flight.origin_airport || 'N/A';
            const destination = flight.destination_city || flight.destination_airport || 'N/A';
            const departure = flight.departure_time ? 
              helpers.formatDate(flight.departure_time) : flight.departure_date || 'N/A';
            const arrival = flight.arrival_time ? 
              helpers.formatDate(flight.arrival_time) : flight.arrival_date || 'N/A';
            const price = flight.price ? helpers.formatCurrency(flight.price) : 'N/A';
            
            return `
              <table class="flight-table">
                <tbody>
                  <tr>
                    <td colspan="2"><strong>Flight ${index + 1}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Airline:</strong></td>
                    <td>${airline}</td>
                  </tr>
                  <tr>
                    <td><strong>Flight number:</strong></td>
                    <td>${flightNumber}</td>
                  </tr>
                  <tr>
                    <td><strong>Route:</strong></td>
                    <td>${origin} → ${destination}</td>
                  </tr>
                  <tr>
                    <td><strong>Departure:</strong></td>
                    <td>${departure}</td>
                  </tr>
                  <tr>
                    <td><strong>Arrival:</strong></td>
                    <td>${arrival}</td>
                  </tr>
                  <tr>
                    <td><strong>Price:</strong></td>
                    <td>${price}</td>
                  </tr>
                  <tr>
                    <td><strong>Refundable:</strong></td>
                    <td>${flight.refundable ? 'Yes' : 'No'}</td>
                  </tr>
                </tbody>
              </table>
            `;
          }).join('')}
        </div>
      `;
    }
    
    if (hasGround) {
      transportContent += `
        <div class="transportation-section">
          <h4>Ground Transportation</h4>
          ${data.ground!.map((transport, index) => {
            const type = transport.type || 'Transportation';
            const provider = transport.provider || 'N/A';
            const pickup = transport.pickup_location || 'N/A';
            const dropoff = transport.dropoff_location || 'N/A';
            const pickupTime = transport.pickup_time ? 
              helpers.formatDate(transport.pickup_time) : 'N/A';
            const price = transport.price ? helpers.formatCurrency(transport.price) : 'N/A';
            
            return `
              <table class="ground-table">
                <tbody>
                  <tr>
                    <td colspan="2"><strong>${type} ${index + 1}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Provider:</strong></td>
                    <td>${provider}</td>
                  </tr>
                  <tr>
                    <td><strong>Pickup location:</strong></td>
                    <td>${pickup}</td>
                  </tr>
                  <tr>
                    <td><strong>Drop-off location:</strong></td>
                    <td>${dropoff}</td>
                  </tr>
                  <tr>
                    <td><strong>Pickup time:</strong></td>
                    <td>${pickupTime}</td>
                  </tr>
                  <tr>
                    <td><strong>Price:</strong></td>
                    <td>${price}</td>
                  </tr>
                </tbody>
              </table>
            `;
          }).join('')}
        </div>
      `;
    }
    
    return `
      <section class="section transportation-details">
        <h3>${title}</h3>
        ${transportContent}
      </section>
    `;
  }
  
  private renderActivitiesList(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.tours || data.tours.length === 0) return '';
    
    const title = helpers.decorateSection('Activities & Tours', 'h3');
    
    const activitiesHtml = data.tours.map((tour, index) => {
      const name = tour.name;
      const duration = tour.duration_hours ? `${tour.duration_hours} hours` : 'N/A';
      const startTime = tour.start_time ? helpers.formatDate(tour.start_time) : 'N/A';
      const price = tour.price_per_person ? helpers.formatCurrency(tour.price_per_person) : 'N/A';
      const maxParticipants = tour.max_participants || 'N/A';
      const meetingPoint = tour.meeting_point || 'N/A';
      
      return `
        <div class="activity-functional">
          <h4>Activity ${index + 1}: ${name}</h4>
          <table class="activity-table">
            <tbody>
              <tr>
                <td><strong>Duration:</strong></td>
                <td>${duration}</td>
              </tr>
              <tr>
                <td><strong>Start time:</strong></td>
                <td>${startTime}</td>
              </tr>
              <tr>
                <td><strong>Price per person:</strong></td>
                <td>${price}</td>
              </tr>
              <tr>
                <td><strong>Max participants:</strong></td>
                <td>${maxParticipants}</td>
              </tr>
              <tr>
                <td><strong>Meeting point:</strong></td>
                <td>${meetingPoint}</td>
              </tr>
            </tbody>
          </table>
          
          ${tour.description ? `
            <div class="activity-description">
              <strong>Description:</strong>
              <p>${tour.description}</p>
            </div>
          ` : ''}
          
          ${tour.included && tour.included.length > 0 ? `
            <div class="activity-inclusions">
              <strong>Included:</strong>
              <ul>
                ${tour.included.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section activities-list">
        <h3>${title}</h3>
        ${activitiesHtml}
      </section>
    `;
  }
  
  private renderCostBreakdown(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.financials) return '';
    
    const title = helpers.decorateSection('Cost Breakdown', 'h3');
    const currency = data.financials.currency || 'USD';
    const totalCost = data.financials.total_cost ? 
      helpers.formatCurrency(data.financials.total_cost, currency) : 'N/A';
    
    return `
      <section class="section cost-breakdown">
        <h3>${title}</h3>
        
        ${data.financials.cost_breakdown && Object.keys(data.financials.cost_breakdown).length > 0 ? `
          <table class="cost-table">
            <tbody>
              ${Object.entries(data.financials.cost_breakdown).map(([key, value]) => `
                <tr>
                  <td><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong></td>
                  <td>${helpers.formatCurrency(value, currency)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td><strong>Total Cost:</strong></td>
                <td><strong>${totalCost}</strong></td>
              </tr>
            </tbody>
          </table>
        ` : `
          <table class="cost-table">
            <tbody>
              <tr class="total-row">
                <td><strong>Total Cost:</strong></td>
                <td><strong>${totalCost}</strong></td>
              </tr>
            </tbody>
          </table>
        `}
        
        ${data.financials.payment_terms ? `
          <div class="payment-terms">
            <h4>Payment Terms</h4>
            <p>${data.financials.payment_terms}</p>
          </div>
        ` : ''}
        
        ${data.financials.cancellation_policy ? `
          <div class="cancellation-policy">
            <h4>Cancellation Policy</h4>
            <p>${data.financials.cancellation_policy}</p>
          </div>
        ` : ''}
      </section>
    `;
  }
  
  private renderBookingInformation(context: TemplateContext): string {
    const { data, helpers } = context;
    
    const title = helpers.decorateSection('Booking Information', 'h3');
    
    // Use next_steps if available, otherwise provide default booking steps
    const steps = data.next_steps?.steps || [
      'Review proposal details',
      'Confirm travel dates and preferences',
      'Provide traveler information and documents',
      'Complete payment as per agreed terms',
      'Receive booking confirmations and travel documents'
    ];
    
    const deadline = data.next_steps?.deadline ? 
      helpers.formatDate(data.next_steps.deadline) : 
      helpers.formatDate(new Date(Date.now() + 7*24*60*60*1000)); // 7 days from now
    
    return `
      <section class="section booking-information">
        <h3>${title}</h3>
        
        <div class="booking-steps">
          <h4>Booking Process</h4>
          <ol>
            ${steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
        
        <div class="important-dates">
          <table class="dates-table">
            <tbody>
              <tr>
                <td><strong>Proposal valid until:</strong></td>
                <td>${deadline}</td>
              </tr>
              <tr>
                <td><strong>Final payment due:</strong></td>
                <td>As per individual supplier terms</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        ${data.next_steps?.contact_info ? `
          <div class="contact-information">
            <h4>Contact Information</h4>
            <table class="contact-table">
              <tbody>
                ${data.next_steps.contact_info.name ? `
                  <tr>
                    <td><strong>Agent:</strong></td>
                    <td>${data.next_steps.contact_info.name}</td>
                  </tr>
                ` : ''}
                ${data.next_steps.contact_info.email ? `
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td><a href="mailto:${data.next_steps.contact_info.email}">${data.next_steps.contact_info.email}</a></td>
                  </tr>
                ` : ''}
                ${data.next_steps.contact_info.phone ? `
                  <tr>
                    <td><strong>Phone:</strong></td>
                    <td>${helpers.formatPhone(data.next_steps.contact_info.phone)}</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <div class="booking-notes">
          <h4>Important Notes</h4>
          <ul>
            <li>All prices are subject to availability and confirmation</li>
            <li>Deposits may be required to secure reservations</li>
            <li>Cancellation policies vary by supplier</li>
            <li>Travel insurance is recommended</li>
            <li>Valid identification required for all travelers</li>
          </ul>
        </div>
      </section>
    `;
  }
}