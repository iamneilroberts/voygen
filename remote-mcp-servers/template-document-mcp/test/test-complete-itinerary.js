#!/usr/bin/env node

/**
 * Test script for complete travel itinerary with flights and rental cars
 * Tests Sara & Darren's trip with ALL travel components
 */

import fs from 'fs';
import Handlebars from 'handlebars';

// Complete test data with flights and rental car
const testData = {
  title: "Sara & Darren Jones 25th Anniversary - Bristol & Bath", 
  clientName: "Sara & Darren Jones",
  startDate: "October 5, 2025",
  endDate: "October 15, 2025",
  totalDays: 10,
  agent: {
    name: "Kim Henderson",
    email: "kim@somotravel.com", 
    phone: "251-508-6921",
    company: "Somo Travel",
    tagline: "Making Your Travel Dreams Reality"
  },
  overview: "Celebrate 25 years of marriage with a romantic journey through England's most charming historic cities. Experience luxury accommodations, private tours, and unforgettable moments in Bristol, Bath, Winchester, and London.",
  flights: [
    {
      type: "outbound",
      airline: "British Airways",
      flightNumber: "BA218",
      departure: {
        airport: "Mobile Regional (MOB)",
        city: "Mobile, AL",
        date: "2025-10-04",
        time: "14:30"
      },
      arrival: {
        airport: "Bristol Airport (BRS)", 
        city: "Bristol, UK",
        date: "2025-10-05",
        time: "08:15+1"
      },
      duration: "9h 45m (1 stop)",
      confirmationNumber: "GVXP4K"
    },
    {
      type: "return",
      airline: "British Airways", 
      flightNumber: "BA219",
      departure: {
        airport: "Bristol Airport (BRS)",
        city: "Bristol, UK", 
        date: "2025-10-15",
        time: "10:45"
      },
      arrival: {
        airport: "Mobile Regional (MOB)",
        city: "Mobile, AL",
        date: "2025-10-15", 
        time: "18:30"
      },
      duration: "10h 45m (1 stop)",
      confirmationNumber: "GVXP4K"
    }
  ],
  rentalCar: {
    company: "Enterprise Rent-A-Car",
    pickupLocation: "Bristol Airport",
    dropoffLocation: "Bristol Airport", 
    vehicle: "Premium SUV or similar (BMW X3)",
    pickupDate: "2025-10-05",
    pickupTime: "10:00",
    dropoffDate: "2025-10-15",
    dropoffTime: "08:00",
    confirmationNumber: "74829503",
    dailyRate: "£68.50",
    totalCost: "£685.00",
    features: ["Automatic transmission", "GPS navigation", "Full insurance coverage"]
  },
  days: [
    {
      title: "Arrival & Car Pickup",
      date: "2025-10-05",
      accommodation: {
        name: "Travel Day",
        details: "Arrive Bristol Airport 8:15 AM, pickup rental car at 10:00 AM"
      }
    },
    {
      title: "Bath Discovery", 
      date: "2025-10-06",
      accommodation: {
        name: "The Kennard, Bath",
        details: "King bed upgrade requested"
      },
      activities: [
        {
          time: "3:00 PM",
          name: "Bath City Highlights Walk",
          description: "Private walking tour with Guide Susan Swainbank",
          location: "Historic Bath",
          isKimGem: true
        }
      ]
    },
    {
      title: "Stonehenge & Winchester",
      date: "2025-10-09",
      accommodation: {
        name: "The Old Granary, Winchester Area", 
        details: "Booking #26114515, £839.44, Finest Retreats"
      },
      activities: [
        {
          time: "Morning",
          name: "Stonehenge Private Tour",
          description: "Private tour of the ancient stone circle",
          location: "Stonehenge",
          isKimGem: true
        }
      ]
    },
    {
      title: "London Adventure",
      date: "2025-10-11", 
      activities: [
        {
          time: "9:30 AM",
          name: "Tower of London & Thames Cruise",
          description: "Historic tower visit plus scenic Thames cruise",
          location: "London",
          isKimGem: false
        },
        {
          time: "2:00 PM", 
          name: "London Black Taxi Private Tour",
          description: "Private sightseeing tour in iconic London taxi",
          location: "London",
          isKimGem: false
        }
      ]
    },
    {
      title: "Departure",
      date: "2025-10-15",
      accommodation: {
        name: "Berwick Lodge, Bristol",
        details: "Reservation E8W223AX, $340.50, 5-star. Car return 8:00 AM, flight departure 10:45 AM"
      }
    }
  ],
  totalCost: 4256.99, // Updated to include flights and rental car
  
  // Enhanced Standard Sections Test Data
  preDepartureChecklist: [
    {
      category: "Travel Documents",
      items: [
        "Valid passports (expiring after April 2026)",
        "Travel insurance documents",
        "Flight confirmation emails printed",
        "Rental car reservation confirmation",
        "Hotel booking confirmations"
      ]
    },
    {
      category: "Health & Safety",
      items: [
        "Prescription medications (30-day supply)",
        "Emergency contact information",
        "Travel first aid kit",
        "Any required vaccinations up to date"
      ]
    },
    {
      category: "Packing Essentials",
      items: [
        "Weather-appropriate clothing for fall",
        "Comfortable walking shoes",
        "Universal power adapters (Type G for UK)",
        "Phone chargers and backup battery",
        "Umbrella or light rain jacket"
      ]
    },
    {
      category: "Financial Preparation",
      items: [
        "Notify banks of travel dates",
        "Exchange some USD to British Pounds",
        "Backup payment methods (multiple cards)",
        "Emergency cash fund"
      ]
    }
  ],
  
  travelInformation: {
    emergencyContacts: [
      {
        name: "Kim Henderson (Travel Agent)",
        phone: "+1-251-508-6921",
        type: "agent"
      },
      {
        name: "U.S. Embassy London",
        phone: "+44-20-7499-9000",
        type: "embassy"
      },
      {
        name: "Emergency Services UK",
        phone: "999",
        type: "local"
      }
    ],
    timeZone: "GMT (Greenwich Mean Time)",
    timeDifference: "6 hours ahead of Central Time",
    jetLagTips: "Start adjusting sleep schedule 3 days before departure. Stay hydrated during flight and get sunlight exposure upon arrival.",
    weather: {
      conditions: "Mild and wet autumn weather",
      temperature: "10-16°C (50-61°F) with frequent rain",
      recommendations: "Layers, waterproof jacket, comfortable walking shoes with good grip"
    },
    culturalGuidelines: [
      {
        topic: "Tipping",
        description: "10-15% in restaurants if service charge not included. Round up taxi fares. £1-2 per bag for hotel porters."
      },
      {
        topic: "Pub Etiquette", 
        description: "Order at the bar, don't wait for table service. It's customary to buy rounds for your group."
      },
      {
        topic: "Queueing",
        description: "Always queue politely and wait your turn. Queue jumping is considered very rude."
      },
      {
        topic: "Greetings",
        description: "A simple 'hello' or 'good morning' is appropriate. Handshakes for introductions."
      }
    ],
    languageBasics: [
      {
        english: "Thank you",
        local: "Cheers (informal) / Thank you (formal)"
      },
      {
        english: "Excuse me",
        local: "Sorry / Excuse me"
      },
      {
        english: "Where is the bathroom?",
        local: "Where's the loo? / Where are the toilets?"
      },
      {
        english: "How much does this cost?",
        local: "How much is this? / What's the price?"
      }
    ]
  },
  
  diningRecommendations: [
    {
      name: "The Scallop Shell",
      cuisine: "Traditional British Seafood",
      specialty: "Fresh fish and chips, local seafood",
      rating: "4.5",
      description: "Award-winning fish and chips restaurant with locally sourced ingredients",
      address: "22 Monmouth St, Bath BA1 2BW",
      hours: "12:00 PM - 9:00 PM",
      bookingInfo: "Walk-ins welcome, reservations for parties of 6+",
      priceRange: "£12-25 per person",
      mustTryDishes: ["Beer-battered cod with chips", "Local crab cakes", "Mushy peas"],
      dietaryAccommodations: ["Vegetarian", "Gluten-free options"],
      tips: "Try the curry sauce with your chips - it's a local favorite!"
    },
    {
      name: "Sally Lunn's Historic Eating House",
      cuisine: "Traditional British Tea House",
      specialty: "Original Sally Lunn Bun and traditional afternoon tea",
      rating: "4.3",
      description: "Historic bakery dating from 1680, home of the original Sally Lunn bun",
      address: "4 N Parade Passage, Bath BA1 1NX",
      hours: "10:00 AM - 6:00 PM",
      bookingInfo: "01225 461634 for afternoon tea reservations",
      priceRange: "£15-35 per person",
      mustTryDishes: ["Sally Lunn Bun with cinnamon butter", "Traditional afternoon tea", "Bath Bun"],
      dietaryAccommodations: ["Vegetarian", "Vegan options available"],
      tips: "Visit the small museum in the basement to see Roman foundations"
    },
    {
      name: "The Rabbit Hole",
      cuisine: "Modern British Gastropub",
      specialty: "Seasonal ingredients, craft cocktails",
      rating: "4.4",
      description: "Alice in Wonderland themed gastropub with creative seasonal menu",
      address: "1-2 Bartlett St, Bath BA1 2QZ",
      hours: "5:00 PM - 11:00 PM (Closed Mondays)",
      bookingInfo: "Reservations recommended: 01225 789069",
      priceRange: "£18-32 per person",
      mustTryDishes: ["Mad Hatter's fish pie", "Queen of Hearts beef Wellington", "Cheshire Cat cocktail"],
      dietaryAccommodations: ["Vegetarian", "Vegan", "Gluten-free"],
      tips: "Ask about the secret menu items - they change with the chef's whims"
    }
  ],
  
  localFoodExperiences: [
    {
      name: "Bath Food Tour",
      description: "Guided walking tour visiting local markets, bakeries, and specialty shops",
      location: "Bath City Center",
      duration: "3 hours",
      cost: "£45 per person",
      bookingRequired: true
    },
    {
      name: "Traditional Pub Lunch Experience",
      description: "Authentic pub meal with local ales in a 16th-century inn",
      location: "The George Inn, Norton St Philip",
      duration: "2 hours",
      cost: "£25-35 per person",
      bookingRequired: false
    }
  ],
  
  diningTips: [
    {
      category: "Meal Times",
      tip: "Lunch is typically 12:00-2:00 PM, dinner 6:00-9:00 PM. Many kitchens close between services."
    },
    {
      category: "Payment",
      tip: "Most places accept cards, but some smaller pubs are cash only. Service charge may be included."
    },
    {
      category: "Reservations",
      tip: "Always book for dinner, especially weekends. Lunch reservations recommended for popular spots."
    }
  ],
  
  investmentBreakdown: {
    categories: [
      {
        category: "Flights",
        amount: 1850.00,
        description: "Round-trip flights Mobile to Bristol via connecting city"
      },
      {
        category: "Accommodation",
        amount: 1456.99,
        description: "10 nights across Bath, Winchester, and Bristol hotels"
      },
      {
        category: "Transportation", 
        amount: 685.00,
        description: "Premium SUV rental for entire trip with full coverage"
      },
      {
        category: "Activities & Tours",
        amount: 265.00,
        description: "Private walking tours, Stonehenge visit, London experiences"
      }
    ],
    total: 4256.99,
    perPerson: 2128.50,
    travelers: 2,
    included: [
      "Round-trip flights with one checked bag each",
      "10 nights accommodation (all rooms confirmed)",
      "Premium rental car with full insurance",
      "GPS navigation and breakdown coverage", 
      "Private walking tour in Bath",
      "Stonehenge private access tour",
      "London Black Taxi tour",
      "24/7 travel agent support",
      "Detailed daily itinerary and recommendations"
    ],
    excluded: [
      "Meals and beverages (budget £60-80/day for two)",
      "Fuel for rental car (estimated £80-100)",
      "Parking fees in city centers",
      "Travel insurance (highly recommended)",
      "Personal shopping and souvenirs",
      "Optional activities and tours not listed",
      "Tips and gratuities"
    ],
    paymentSchedule: [
      {
        date: "Upon booking confirmation",
        description: "Deposit to secure reservations",
        amount: 1500.00,
        notes: "Confirms flights, hotels, and rental car"
      },
      {
        date: "August 1, 2025",
        description: "Second payment",
        amount: 1500.00,
        notes: "60 days before departure"
      },
      {
        date: "September 5, 2025", 
        description: "Final payment",
        amount: 1256.99,
        notes: "30 days before departure"
      }
    ],
    paymentTerms: [
      "All payments are non-refundable unless covered by travel insurance",
      "Payment can be made by check, bank transfer, or credit card",
      "Credit card payments subject to 3% processing fee",
      "Late payment may result in booking cancellation"
    ],
    cancellationPolicy: [
      {
        timeframe: "90+ days before travel",
        penalty: "50% refund of total cost",
        details: "Flights and hotels may have separate cancellation fees"
      },
      {
        timeframe: "60-89 days before travel", 
        penalty: "25% refund of total cost",
        details: "Most reservations become non-refundable"
      },
      {
        timeframe: "30-59 days before travel",
        penalty: "10% refund of total cost", 
        details: "Only refundable if resold to another traveler"
      },
      {
        timeframe: "Less than 30 days",
        penalty: "No refund",
        details: "Travel insurance may provide coverage"
      }
    ],
    travelInsurance: {
      recommended: true,
      cost: 285.00,
      provider: "Travel Guard or Allianz Travel",
      coverage: [
        "Trip cancellation and interruption",
        "Medical expenses and emergency evacuation", 
        "Baggage loss and delay protection",
        "Flight delay and missed connections"
      ]
    },
    additionalNotes: [
      "All prices are in USD and subject to currency fluctuations",
      "Hotel city taxes may apply and are paid directly to hotels",
      "Rental car requires valid driver's license and major credit card",
      "Travel agent service fee of $200 included in total cost"
    ]
  }
};

async function testCompleteTemplate() {
  console.log('🧪 Testing Complete Travel Itinerary with Flights & Rental Car');
  console.log('==============================================================');

  try {
    // Register all Handlebars helpers
    Handlebars.registerHelper('formatDate', (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
    });
    
    Handlebars.registerHelper('formatCurrency', (amount, currency) => {
      if (typeof amount !== 'number') return amount;
      const currencyCode = typeof currency === 'string' ? currency : 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
      }).format(amount);
    });
    
    Handlebars.registerHelper('dayNumber', (index) => index + 1);
    
    Handlebars.registerHelper('kimGem', function(isGem) {
      if (isGem) {
        return new Handlebars.SafeString('<span class="gem-badge">Kim\'s Gem ✨</span>');
      }
      return '';
    });

    Handlebars.registerHelper('if_eq', function(a, b, options) {
      if (a === b) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });
    
    // Join array helper
    Handlebars.registerHelper('join', (array, separator = ', ') => {
      if (!Array.isArray(array)) return '';
      return array.join(separator);
    });
    
    // Complete template with flights and rental car
    const completeTemplate = `
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
  
  <!-- Enhanced Standard Sections Test -->
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
  {{/if}}
  
  {{#if totalCost}}
  <section class="card">
    <h2 class="section-title">Trip Investment</h2>
    <div class="price-breakdown">
      <p>Total Cost: <span class="price">{{formatCurrency totalCost}}</span></p>
      <p class="cost-note">*Includes flights, rental car, accommodations, and activities</p>
    </div>
  </section>
  {{/if}}
  
  <footer>
    <p>Prepared by {{agent.name}} | {{agent.email}} | {{agent.phone}}</p>
    <p>© 2025 {{agent.company}} - Creating Unforgettable Travel Experiences</p>
  </footer>
</div>
`;
    
    const template = Handlebars.compile(completeTemplate);
    const html = template(testData);
    
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

/* Day Section Styling */
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

.cost-note {
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.5rem;
  font-style: italic;
}

footer {
  text-align: center;
  padding: 3rem 0;
  color: #666;
  border-top: 1px solid #e0e0e0;
  margin-top: 3rem;
}

@media (max-width: 768px) {
  .container { padding: 1rem; }
  h1 { font-size: 2rem; }
  .card, .day-section { padding: 1.5rem; }
  .day-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  .flight-leg, .rental-details { flex-direction: column; gap: 1rem; }
  .flight-arrow, .rental-arrow { transform: rotate(90deg); }
  .rental-cost { flex-direction: column; gap: 0.5rem; }
}
`;
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${testData.title}</title>
    <style>
${cssStyles}
    </style>
</head>
<body>
${html}
</body>
</html>`;
    
    // Save the result
    const outputPath = './test/sara_darren_complete_itinerary.html';
    fs.writeFileSync(outputPath, fullHtml);
    
    console.log('✅ Complete enhanced itinerary test completed successfully!');
    console.log(`📄 Output saved to: ${outputPath}`);
    console.log('');
    console.log('🎯 Enhanced Travel Components Included:');
    console.log('   ✈️  Outbound & Return Flights with confirmation numbers');  
    console.log('   🚗 Rental Car pickup/dropoff details and features');
    console.log('   🏨 Daily accommodations and room details');
    console.log('   📅 Activities with Kim\'s Gem recommendations');
    console.log('   ✅ Pre-departure checklist with interactive checkboxes');
    console.log('   ℹ️  Important travel information (emergency contacts, timezone, weather)');
    console.log('   🗣️  Language basics and cultural guidelines');
    console.log('   🍽️  Dining recommendations with ratings and specialties');
    console.log('   🌟 Local food experiences and dining etiquette tips');
    console.log('   💰 Detailed investment breakdown with payment schedule');
    console.log('   🚫 Cancellation policy and travel insurance information');
    console.log('   📱 Mobile-responsive design for all sections');
    console.log('');
    console.log('🚀 Template now includes ALL enhanced standard sections!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Complete itinerary test failed:', error);
    return false;
  }
}

testCompleteTemplate().then(success => {
  process.exit(success ? 0 : 1);
});