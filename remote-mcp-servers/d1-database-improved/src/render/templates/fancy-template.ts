// ============================================================================
// Fancy Template - Premium Visual Experience
// ============================================================================

import { BaseTemplate, TemplateContext } from './base-template';
import { CORE_COMPONENTS } from './components';

export class FancyTemplate extends BaseTemplate {
  
  getTemplateName(): string {
    return 'fancy';
  }
  
  getDescription(): string {
    return 'Premium visual template with rich styling, elegant presentation, and immersive content. Perfect for luxury travel and special occasions.';
  }
  
  getSuitableFor(): string[] {
    return [
      'Luxury travel experiences',
      'Honeymoon packages',
      'Anniversary trips',
      'VIP client presentations',
      'High-end leisure travel'
    ];
  }
  
  protected registerComponents(): void {
    CORE_COMPONENTS.forEach(component => {
      this.registerComponent(component);
    });
  }
  
  protected renderTemplate(context: TemplateContext): string {
    const { data } = context;
    
    // Enhanced header with tagline
    const header = this.renderEnhancedHeader(context);
    
    // Destination story
    const destinationStory = this.renderDestinationStory(context);
    
    // Featured accommodations with rich content
    const hotels = this.renderFeaturedHotels(context);
    
    // Journey details (flights in narrative style)
    const journey = this.renderJourneyDetails(context);
    
    // Curated experiences
    const experiences = this.renderCuratedExperiences(context);
    
    // Investment presentation
    const investment = this.renderInvestmentPresentation(context);
    
    // Exclusive benefits
    const benefits = this.renderExclusiveBenefits(context);
    
    // Next steps with premium touch
    const nextSteps = this.renderPremiumNextSteps(context);
    
    // Enhanced footer
    const footer = this.renderEnhancedFooter(context);
    
    return `
      ${header}
      
      <main class="content fancy-content">
        ${destinationStory}
        ${hotels}
        ${journey}
        ${experiences}
        ${investment}
        ${benefits}
        ${nextSteps}
      </main>
      
      ${footer}
    `;
  }
  
  private renderEnhancedHeader(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    const tripName = trip?.party_name || 'Your Extraordinary Journey';
    const destination = trip?.legs?.[0]?.dest_name || 'Paradise';
    const dateRange = trip?.legs?.[0] ? 
      helpers.formatDateRange(trip.legs[0].dep_date, trip.legs[0].ret_date) : '';
    
    const decoratedTitle = helpers.decorateSection(tripName, 'h1');
    const decoratedSubtitle = helpers.decorateSection(`An Unforgettable Experience in ${destination}`, 'h2');
    
    return `
      <header class="header fancy-header">
        <div class="header-overlay">
          <h1>${decoratedTitle}</h1>
          <h2>${decoratedSubtitle}</h2>
          ${dateRange ? `<div class="trip-dates elegant-dates">${dateRange}</div>` : ''}
          <div class="header-tagline">
            ${helpers.applyDecorative('Crafted exclusively for you', 'tagline')}
          </div>
        </div>
      </header>
    `;
  }
  
  private renderDestinationStory(context: TemplateContext): string {
    const { data, helpers } = context;
    const trip = data.trip_spec;
    
    if (!trip?.legs?.[0]) return '';
    
    const destination = trip.legs[0].dest_name || 'your destination';
    const title = helpers.decorateSection(`Discover ${destination}`, 'h3');
    
    // Create engaging destination narrative based on preferences
    const styles = trip.prefs?.styles || [];
    const isLuxury = styles.includes('luxury') || styles.includes('premium');
    const isAdventure = styles.includes('adventure') || styles.includes('active');
    const isCultural = styles.includes('cultural') || styles.includes('historical');
    
    let narrativeText = `${destination} awaits with its unique blend of natural beauty, rich culture, and unforgettable experiences.`;
    
    if (isLuxury) {
      narrativeText = `Experience the epitome of luxury in ${destination}, where world-class hospitality meets breathtaking natural beauty. Every moment has been carefully curated to exceed your expectations.`;
    } else if (isAdventure) {
      narrativeText = `${destination} beckons with thrilling adventures and spectacular landscapes. From exhilarating activities to serene moments of natural wonder, your journey will be filled with extraordinary memories.`;
    } else if (isCultural) {
      narrativeText = `Immerse yourself in the rich tapestry of ${destination}'s culture and history. Ancient traditions blend seamlessly with modern sophistication, creating a truly authentic and enriching experience.`;
    }
    
    return `
      <section class="section destination-story">
        <h3>${title}</h3>
        <div class="story-content">
          <p class="story-intro">${narrativeText}</p>
          <div class="experience-promise">
            <p>${helpers.applyDecorative('This carefully crafted itinerary combines must-see highlights with hidden gems, ensuring your journey is both comprehensive and deeply personal.', 'promise')}</p>
          </div>
        </div>
      </section>
    `;
  }
  
  private renderFeaturedHotels(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.hotels || data.hotels.length === 0) return '';
    
    const title = helpers.decorateSection('Your Luxury Accommodations', 'h3');
    
    const hotelsHtml = data.hotels.map(hotel => {
      const name = helpers.decorateSection(hotel.name, 'h4');
      const rating = hotel.star_rating ? helpers.generateStarRating(hotel.star_rating) : '';
      const location = hotel.location || '';
      const price = hotel.price_per_night ? helpers.formatCurrency(hotel.price_per_night) : '';
      
      const nights = hotel.checkin_date && hotel.checkout_date ? 
        helpers.calculateNights(hotel.checkin_date, hotel.checkout_date) : 0;
      const nightsText = nights > 0 ? helpers.pluralize(nights, 'night') : '';
      
      // Enhanced description for fancy template
      const description = hotel.description || 
        `This exceptional property offers unparalleled comfort and service, perfectly positioned to enhance your ${data.trip_spec?.legs?.[0]?.dest_name || 'destination'} experience.`;
      
      const amenitiesList = hotel.amenities ? helpers.getHotelAmenities(hotel.amenities) : '';
      
      return `
        <div class="hotel fancy-hotel">
          <div class="hotel-showcase">
            <h4>${name}</h4>
            <div class="hotel-credentials">
              ${rating ? `<div class="rating-display">${rating}</div>` : ''}
              ${location ? `<div class="prime-location">${helpers.applyDecorative(location, 'location')}</div>` : ''}
            </div>
          </div>
          
          <div class="hotel-narrative">
            <p class="hotel-description">${description}</p>
          </div>
          
          ${amenitiesList ? `
            <div class="luxury-amenities">
              <h5>${helpers.decorateSection('Exclusive Amenities', 'h5')}</h5>
              <div class="amenities-showcase">${amenitiesList}</div>
            </div>
          ` : ''}
          
          <div class="hotel-investment">
            ${price ? `
              <div class="nightly-rate">
                <span class="rate-label">Nightly Rate:</span>
                <span class="rate-value">${price}</span>
              </div>
            ` : ''}
            ${nightsText ? `<div class="stay-duration">${nightsText} of luxury</div>` : ''}
            ${hotel.refundable ? '<div class="flexibility-badge">Flexible Booking Available</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <section class="section featured-hotels">
        <h3>${title}</h3>
        <div class="hotels-intro">
          <p>Each accommodation has been personally selected for its exceptional character, impeccable service, and unique ability to enhance your travel experience. These are not merely places to stay, but integral parts of your journey's story.</p>
        </div>
        ${hotelsHtml}
      </section>
    `;
  }
  
  private renderJourneyDetails(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.flights || data.flights.length === 0) return '';
    
    const title = helpers.decorateSection('Your Journey Begins', 'h3');
    
    const flightsHtml = data.flights.map(flight => {
      const airline = flight.airline || 'Premium Airline';
      const route = `${flight.origin_city || flight.origin_airport || 'Your City'} to ${flight.destination_city || flight.destination_airport || 'Paradise'}`;
      const departure = flight.departure_time ? 
        helpers.formatDate(flight.departure_time) : flight.departure_date || '';
      const arrival = flight.arrival_time ? 
        helpers.formatDate(flight.arrival_time) : flight.arrival_date || '';
      
      return `
        <div class="journey-segment">
          <h4>${helpers.decorateSection(route, 'h4')}</h4>
          <div class="journey-details">
            <div class="airline-service">
              <strong>Airline:</strong> ${airline}
              ${flight.flight_number ? ` • Flight ${flight.flight_number}` : ''}
            </div>
            
            <div class="journey-timeline">
              ${departure ? `<div class="departure-moment"><strong>Departure:</strong> ${departure}</div>` : ''}
              ${arrival ? `<div class="arrival-moment"><strong>Arrival:</strong> ${arrival}</div>` : ''}
            </div>
            
            ${flight.price ? `
              <div class="journey-investment">
                <strong>Flight Investment:</strong> ${helpers.formatCurrency(flight.price)}
              </div>
            ` : ''}
            
            ${flight.refundable ? '<div class="journey-flexibility">Flexible Booking Terms Available</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <section class="section journey-details">
        <h3>${title}</h3>
        <div class="journey-intro">
          <p>Your adventure begins the moment you step aboard. We've arranged premium flight experiences that set the tone for the extraordinary journey ahead.</p>
        </div>
        ${flightsHtml}
        
        <div class="journey-comfort">
          <h4>${helpers.decorateSection('Travel in Comfort', 'h4')}</h4>
          <p>All flight arrangements prioritize your comfort and convenience, with carefully selected departure times and premium airline partners known for exceptional service.</p>
        </div>
      </section>
    `;
  }
  
  private renderCuratedExperiences(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.tours || data.tours.length === 0) return '';
    
    const title = helpers.decorateSection('Curated Experiences', 'h3');
    
    const experiencesHtml = data.tours.map(tour => {
      const name = helpers.decorateSection(tour.name, 'h4');
      const duration = tour.duration_hours ? 
        `${tour.duration_hours} hours of wonder` : '';
      const price = tour.price_per_person ? 
        helpers.formatCurrency(tour.price_per_person) + ' per person' : '';
      
      const enhancedDescription = tour.description || 
        `This exclusive experience offers unique insights and unforgettable moments that showcase the very best of your destination.`;
      
      return `
        <div class="curated-experience">
          <h4>${name}</h4>
          <div class="experience-essence">
            <p class="experience-description">${enhancedDescription}</p>
          </div>
          
          <div class="experience-details">
            ${duration ? `<div class="experience-duration">${helpers.applyDecorative(duration, 'duration')}</div>` : ''}
            ${tour.start_time ? `<div class="experience-timing">Begins: ${helpers.formatDate(tour.start_time)}</div>` : ''}
            ${price ? `<div class="experience-investment">Investment: ${price}</div>` : ''}
          </div>
          
          ${tour.included && tour.included.length > 0 ? `
            <div class="experience-inclusions">
              <h5>${helpers.decorateSection('What Makes This Special', 'h5')}</h5>
              <ul class="inclusions-list">
                ${tour.included.map(item => `<li>${helpers.applyDecorative(item, 'inclusion')}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${tour.meeting_point ? `
            <div class="experience-logistics">
              <strong>Meeting Point:</strong> ${tour.meeting_point}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <section class="section curated-experiences">
        <h3>${title}</h3>
        <div class="experiences-philosophy">
          <p>Beyond the ordinary tourist path lie experiences that transform travel into profound personal journeys. Each activity has been chosen not just for what you'll see, but for how it will make you feel and what memories you'll treasure forever.</p>
        </div>
        ${experiencesHtml}
      </section>
    `;
  }
  
  private renderInvestmentPresentation(context: TemplateContext): string {
    const { data } = context;
    
    if (!data.financials) return '';
    
    const costSummary = this.renderComponent('cost-summary', data.financials, context);
    
    return `
      <section class="section investment-presentation">
        ${costSummary}
        
        <div class="value-philosophy">
          <h4>${context.helpers.decorateSection('The Value of Exceptional Experiences', 'h4')}</h4>
          <p>This investment represents more than a trip—it's a collection of moments, memories, and experiences that will enrich your life long after you return home. Every element has been chosen for its ability to create lasting impressions and authentic connections.</p>
        </div>
        
        <div class="exclusive-value">
          <h4>${context.helpers.decorateSection('What You Receive', 'h4')}</h4>
          <div class="value-highlights">
            <div class="value-item">${context.helpers.applyDecorative('Handpicked accommodations with exclusive amenities', 'value')}</div>
            <div class="value-item">${context.helpers.applyDecorative('Private experiences unavailable to general travelers', 'value')}</div>
            <div class="value-item">${context.helpers.applyDecorative('24/7 concierge support throughout your journey', 'value')}</div>
            <div class="value-item">${context.helpers.applyDecorative('Insider access and local connections', 'value')}</div>
            <div class="value-item">${context.helpers.applyDecorative('Flexible arrangements tailored to your preferences', 'value')}</div>
          </div>
        </div>
      </section>
    `;
  }
  
  private renderExclusiveBenefits(context: TemplateContext): string {
    const { helpers } = context;
    
    const title = helpers.decorateSection('Exclusive Benefits', 'h3');
    
    return `
      <section class="section exclusive-benefits">
        <h3>${title}</h3>
        <div class="benefits-grid">
          <div class="benefit-item">
            <h4>${helpers.decorateSection('VIP Treatment', 'h4')}</h4>
            <p>Enjoy priority check-in, room upgrades when available, and special recognition at each property as our valued client.</p>
          </div>
          
          <div class="benefit-item">
            <h4>${helpers.decorateSection('Expert Curation', 'h4')}</h4>
            <p>Every recommendation comes from our destination specialists who have personally experienced each element of your itinerary.</p>
          </div>
          
          <div class="benefit-item">
            <h4>${helpers.decorateSection('Seamless Experience', 'h4')}</h4>
            <p>From arrival to departure, every detail is coordinated to ensure your journey flows effortlessly from one amazing moment to the next.</p>
          </div>
          
          <div class="benefit-item">
            <h4>${helpers.decorateSection('Peace of Mind', 'h4')}</h4>
            <p>Our partnerships with premium suppliers and 24/7 support ensure you can relax and enjoy every moment of your extraordinary journey.</p>
          </div>
        </div>
      </section>
    `;
  }
  
  private renderPremiumNextSteps(context: TemplateContext): string {
    const { data, helpers } = context;
    
    if (!data.next_steps?.steps || data.next_steps.steps.length === 0) {
      return this.renderDefaultPremiumNextSteps(context);
    }
    
    const title = helpers.decorateSection('Beginning Your Journey', 'h3');
    
    return `
      <section class="section premium-next-steps">
        <h3>${title}</h3>
        
        <div class="next-steps-intro">
          <p>Your extraordinary journey is just a few simple steps away. We've made the booking process as elegant and effortless as the experience itself.</p>
        </div>
        
        ${data.next_steps.deadline ? `
          <div class="gentle-deadline">
            <p>${helpers.applyDecorative(`We'll hold these arrangements until ${helpers.formatDate(data.next_steps.deadline)}`, 'deadline')}</p>
          </div>
        ` : ''}
        
        <ol class="premium-steps-list">
          ${data.next_steps.steps.map((step, index) => {
            const decoratedStep = helpers.applyDecorative(step, 'checklist');
            return `<li class="premium-step">${decoratedStep}</li>`;
          }).join('')}
        </ol>
        
        ${data.next_steps.contact_info ? `
          <div class="personal-service">
            <h4>${helpers.decorateSection('Your Personal Travel Specialist', 'h4')}</h4>
            <div class="contact-details premium-contact">
              ${data.next_steps.contact_info.name ? `<div class="specialist-name">${data.next_steps.contact_info.name}</div>` : ''}
              ${data.next_steps.contact_info.email ? `<div class="specialist-email"><a href="mailto:${data.next_steps.contact_info.email}">${data.next_steps.contact_info.email}</a></div>` : ''}
              ${data.next_steps.contact_info.phone ? `<div class="specialist-phone">${helpers.formatPhone(data.next_steps.contact_info.phone)}</div>` : ''}
            </div>
            <p class="personal-touch">I'm here to ensure every aspect of your journey exceeds your expectations.</p>
          </div>
        ` : ''}
      </section>
    `;
  }
  
  private renderDefaultPremiumNextSteps(context: TemplateContext): string {
    const { helpers } = context;
    
    const title = helpers.decorateSection('Beginning Your Journey', 'h3');
    
    return `
      <section class="section premium-next-steps">
        <h3>${title}</h3>
        
        <div class="next-steps-intro">
          <p>Your extraordinary journey awaits. Let's make it a reality.</p>
        </div>
        
        <ol class="premium-steps-list">
          <li class="premium-step">${helpers.applyDecorative('Review and approve this curated itinerary', 'checklist')}</li>
          <li class="premium-step">${helpers.applyDecorative('Discuss any personal preferences or modifications', 'checklist')}</li>
          <li class="premium-step">${helpers.applyDecorative('Secure your reservations with our preferred payment terms', 'checklist')}</li>
          <li class="premium-step">${helpers.applyDecorative('Receive your detailed travel documentation and mobile access', 'checklist')}</li>
        </ol>
        
        <div class="personal-service">
          <h4>${helpers.decorateSection('Your Dedicated Travel Specialist', 'h4')}</h4>
          <p class="personal-touch">I'm personally committed to ensuring your journey exceeds every expectation.</p>
        </div>
      </section>
    `;
  }
  
  private renderEnhancedFooter(context: TemplateContext): string {
    const { helpers } = context;
    
    return `
      <footer class="footer fancy-footer">
        <div class="footer-elegance">
          <p class="crafted-note">${helpers.applyDecorative('This proposal has been thoughtfully crafted exclusively for you', 'signature')}</p>
          <p class="validity-note">Arrangements held until ${helpers.formatDate(new Date(Date.now() + 7*24*60*60*1000))}</p>
          <p class="quality-promise">Every element reflects our commitment to exceptional travel experiences</p>
        </div>
        <div class="footer-signature">
          <p class="preparation-date">Prepared with care on ${helpers.formatDate(new Date())}</p>
        </div>
      </footer>
    `;
  }
}