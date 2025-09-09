// ============================================================================
// Template Components Library
// ============================================================================

import { TemplateComponent, TemplateContext } from './base-template';
import { HotelOffering, RoomOffering, FlightItin, GroundItem, TourItem, Financials } from '../types';

// Header Component
export const HeaderComponent: TemplateComponent = {
  name: 'header',
  render: (data: any, context: TemplateContext) => {
    const { trip_spec } = context.data;
    const { helpers } = context;
    
    const tripName = trip_spec?.party_name || 'Travel Proposal';
    const destination = trip_spec?.legs?.[0]?.dest_name || 'Destination';
    const dateRange = trip_spec?.legs?.[0] ? 
      helpers.formatDateRange(trip_spec.legs[0].dep_date, trip_spec.legs[0].ret_date) : '';
    
    const title = helpers.decorateSection(tripName, 'h1');
    const subtitle = helpers.decorateSection(`${destination}`, 'h2');
    
    return `
      <header class="header">
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
        ${dateRange ? `<div class="trip-dates">${dateRange}</div>` : ''}
      </header>
    `;
  }
};

// Hotel Card Component
export const HotelCardComponent: TemplateComponent = {
  name: 'hotel-card',
  render: (hotel: HotelOffering, context: TemplateContext) => {
    const { helpers, remix } = context;
    
    const name = helpers.decorateSection(hotel.name, 'h4');
    const rating = hotel.star_rating ? helpers.generateStarRating(hotel.star_rating) : '';
    const location = hotel.location || '';
    const price = hotel.price_per_night ? helpers.formatCurrency(hotel.price_per_night) : '';
    const amenities = hotel.amenities ? helpers.getHotelAmenities(hotel.amenities) : '';
    
    // Calculate nights if check dates available
    const nights = hotel.checkin_date && hotel.checkout_date ? 
      helpers.calculateNights(hotel.checkin_date, hotel.checkout_date) : 0;
    const nightsText = nights > 0 ? helpers.pluralize(nights, 'night') : '';
    
    const totalCost = price && nights > 0 ? 
      helpers.formatCurrency(hotel.price_per_night! * nights) : '';
    
    return `
      <div class="hotel hotel-card">
        <h4>${name}</h4>
        <div class="hotel-meta">
          ${rating ? `<div class="rating">${rating}</div>` : ''}
          ${location ? `<div class="location">${location}</div>` : ''}
          ${price ? `<div class="price">${price}/night</div>` : ''}
        </div>
        
        ${nightsText ? `<div class="nights">${nightsText}</div>` : ''}
        ${totalCost ? `<div class="total-cost">Total: <span class="price">${totalCost}</span></div>` : ''}
        
        ${hotel.refundable ? '<span class="refundable-badge">Refundable</span>' : ''}
        ${hotel.commission_percent ? `<span class="commission-indicator">${hotel.commission_percent}% commission</span>` : ''}
        
        ${amenities ? `
          <div class="amenities">
            <div class="amenity-list">${amenities}</div>
          </div>
        ` : ''}
        
        ${hotel.description ? `
          <div class="description">${hotel.description}</div>
        ` : ''}
      </div>
    `;
  }
};

// Room Details Component
export const RoomDetailsComponent: TemplateComponent = {
  name: 'room-details',
  render: (room: RoomOffering, context: TemplateContext) => {
    const { helpers } = context;
    
    const name = helpers.decorateSection(room.room_type, 'h5');
    const price = room.price_per_night ? helpers.formatCurrency(room.price_per_night) : '';
    const occupancy = room.max_occupancy ? helpers.pluralize(room.max_occupancy, 'guest') : '';
    
    return `
      <div class="room-details">
        <h5>${name}</h5>
        <div class="room-meta">
          ${price ? `<span class="price">${price}/night</span>` : ''}
          ${occupancy ? `<span class="occupancy">${occupancy}</span>` : ''}
        </div>
        
        ${room.bed_type ? `<div class="bed-type">Bed: ${room.bed_type}</div>` : ''}
        ${room.amenities && room.amenities.length > 0 ? `
          <div class="room-amenities">
            ${helpers.getHotelAmenities(room.amenities)}
          </div>
        ` : ''}
      </div>
    `;
  }
};

// Flight Information Component
export const FlightComponent: TemplateComponent = {
  name: 'flight',
  render: (flight: FlightItin, context: TemplateContext) => {
    const { helpers } = context;
    
    const title = helpers.decorateSection('Flight Details', 'h4');
    const airline = flight.airline || 'Airline TBD';
    const departure = flight.departure_time ? 
      helpers.formatDate(flight.departure_time) : flight.departure_date || '';
    const arrival = flight.arrival_time ? 
      helpers.formatDate(flight.arrival_time) : flight.arrival_date || '';
    
    return `
      <div class="flight">
        <h4>${title}</h4>
        <div class="flight-details">
          <div class="airline">${airline}</div>
          ${flight.flight_number ? `<div class="flight-number">Flight ${flight.flight_number}</div>` : ''}
          
          <div class="flight-route">
            <div class="departure">
              <strong>From:</strong> ${flight.origin_airport || flight.origin_city || 'Departure'}
              ${departure ? `<br><span class="time">${departure}</span>` : ''}
            </div>
            <div class="arrival">
              <strong>To:</strong> ${flight.destination_airport || flight.destination_city || 'Arrival'}
              ${arrival ? `<br><span class="time">${arrival}</span>` : ''}
            </div>
          </div>
          
          ${flight.price ? `<div class="flight-price">Price: ${helpers.formatCurrency(flight.price)}</div>` : ''}
          ${flight.refundable ? '<span class="refundable-badge">Refundable</span>' : ''}
        </div>
      </div>
    `;
  }
};

// Ground Transportation Component
export const GroundTransportComponent: TemplateComponent = {
  name: 'ground-transport',
  render: (ground: GroundItem, context: TemplateContext) => {
    const { helpers } = context;
    
    const title = helpers.decorateSection(ground.type || 'Transportation', 'h4');
    const provider = ground.provider || '';
    const price = ground.price ? helpers.formatCurrency(ground.price) : '';
    
    return `
      <div class="ground-transport">
        <h4>${title}</h4>
        <div class="ground-details">
          ${provider ? `<div class="provider">${provider}</div>` : ''}
          ${ground.pickup_location ? `<div class="pickup">Pickup: ${ground.pickup_location}</div>` : ''}
          ${ground.dropoff_location ? `<div class="dropoff">Drop-off: ${ground.dropoff_location}</div>` : ''}
          ${ground.pickup_time ? `<div class="pickup-time">Time: ${helpers.formatDate(ground.pickup_time)}</div>` : ''}
          ${price ? `<div class="ground-price">Cost: ${price}</div>` : ''}
        </div>
        
        ${ground.description ? `<div class="description">${ground.description}</div>` : ''}
      </div>
    `;
  }
};

// Tour/Activity Component
export const TourComponent: TemplateComponent = {
  name: 'tour',
  render: (tour: TourItem, context: TemplateContext) => {
    const { helpers } = context;
    
    const title = helpers.decorateSection(tour.name, 'h4');
    const duration = tour.duration_hours ? 
      helpers.pluralize(tour.duration_hours, 'hour') : '';
    const price = tour.price_per_person ? 
      helpers.formatCurrency(tour.price_per_person) + ' per person' : '';
    
    return `
      <div class="tour">
        <h4>${title}</h4>
        <div class="tour-details">
          ${duration ? `<div class="duration">Duration: ${duration}</div>` : ''}
          ${tour.start_time ? `<div class="start-time">Starts: ${helpers.formatDate(tour.start_time)}</div>` : ''}
          ${price ? `<div class="tour-price">${price}</div>` : ''}
          ${tour.max_participants ? `<div class="max-participants">Max ${tour.max_participants} participants</div>` : ''}
        </div>
        
        ${tour.description ? `<div class="description">${tour.description}</div>` : ''}
        
        ${tour.included && tour.included.length > 0 ? `
          <div class="tour-inclusions">
            <strong>Includes:</strong>
            <ul>
              ${tour.included.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${tour.meeting_point ? `<div class="meeting-point">Meeting Point: ${tour.meeting_point}</div>` : ''}
      </div>
    `;
  }
};

// Cost Summary Component
export const CostSummaryComponent: TemplateComponent = {
  name: 'cost-summary',
  render: (financials: Financials, context: TemplateContext) => {
    const { helpers } = context;
    
    const title = helpers.decorateSection('Trip Investment', 'h3');
    const totalCost = financials.total_cost ? helpers.formatCurrency(financials.total_cost) : '';
    const currency = financials.currency || 'USD';
    
    return `
      <div class="summary cost-summary">
        <h3>${title}</h3>
        
        ${financials.cost_breakdown && Object.keys(financials.cost_breakdown).length > 0 ? `
          <div class="cost-breakdown">
            ${Object.entries(financials.cost_breakdown).map(([key, value]) => `
              <div class="cost-line">
                <span class="cost-label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                <span class="cost-value">${helpers.formatCurrency(value, currency)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${totalCost ? `
          <div class="total-cost-line">
            <span class="cost-label"><strong>Total Investment:</strong></span>
            <span class="cost-amount">${totalCost}</span>
          </div>
        ` : ''}
        
        ${financials.payment_terms ? `
          <div class="payment-terms">
            <h4>Payment Terms</h4>
            <p>${financials.payment_terms}</p>
          </div>
        ` : ''}
        
        ${financials.cancellation_policy ? `
          <div class="cancellation-policy">
            <h4>Cancellation Policy</h4>
            <p>${financials.cancellation_policy}</p>
          </div>
        ` : ''}
      </div>
    `;
  }
};

// Next Steps Component
export const NextStepsComponent: TemplateComponent = {
  name: 'next-steps',
  render: (data: any, context: TemplateContext) => {
    const { helpers } = context;
    const { next_steps } = context.data;
    
    if (!next_steps?.steps || next_steps.steps.length === 0) {
      return '';
    }
    
    const title = helpers.decorateSection('Next Steps', 'h3');
    
    return `
      <div class="section next-steps">
        <h3>${title}</h3>
        
        ${next_steps.deadline ? `
          <div class="deadline">
            <strong>Response needed by:</strong> ${helpers.formatDate(next_steps.deadline)}
          </div>
        ` : ''}
        
        <ol class="steps-list">
          ${next_steps.steps.map((step, index) => {
            const decoratedStep = helpers.applyDecorative(step, 'checklist');
            return `<li class="step-item">${decoratedStep}</li>`;
          }).join('')}
        </ol>
        
        ${next_steps.contact_info ? `
          <div class="contact-info">
            <h4>Questions? Contact:</h4>
            <div class="contact-details">
              ${next_steps.contact_info.name ? `<div class="contact-name">${next_steps.contact_info.name}</div>` : ''}
              ${next_steps.contact_info.email ? `<div class="contact-email"><a href="mailto:${next_steps.contact_info.email}">${next_steps.contact_info.email}</a></div>` : ''}
              ${next_steps.contact_info.phone ? `<div class="contact-phone">${helpers.formatPhone(next_steps.contact_info.phone)}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
};

// Footer Component
export const FooterComponent: TemplateComponent = {
  name: 'footer',
  render: (data: any, context: TemplateContext) => {
    const { helpers } = context;
    
    return `
      <footer class="footer">
        <p>This proposal was prepared specifically for you and is valid for 7 days from the date of creation.</p>
        <p>Prices are subject to availability and may change without notice. Final pricing will be confirmed at time of booking.</p>
        <p class="generated-date">Prepared on ${helpers.formatDate(new Date())}</p>
      </footer>
    `;
  }
};

// Export all components
export const CORE_COMPONENTS: TemplateComponent[] = [
  HeaderComponent,
  HotelCardComponent,
  RoomDetailsComponent,
  FlightComponent,
  GroundTransportComponent,
  TourComponent,
  CostSummaryComponent,
  NextStepsComponent,
  FooterComponent
];