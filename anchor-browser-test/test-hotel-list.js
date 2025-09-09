require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function getHotelList(destination, checkIn, checkOut) {
  console.log(`🏨 Getting hotel availability for ${destination} (${checkIn} - ${checkOut})...`);
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    // Step 1: Create session (with rate limiting)
    console.log('🌐 Creating browser session...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    
    const session = await anchor.sessions.create({});
    const sessionId = session.data?.id;
    
    if (!sessionId) {
      throw new Error('Failed to create session');
    }
    
    console.log(`✅ Session created: ${sessionId}`);

    // Step 2: Login (with rate limiting)
    console.log('🔐 Logging in...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    
    await anchor.tools.performWebTask({
      prompt: `Go to the login page and log in with email: ${process.env.CPMAXX_EMAIL} and password: ${process.env.CPMAXX_PASSWORD}`,
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      sessionId: sessionId,
      agent: 'browser-use'
    });

    console.log('✅ Login completed');

    // Step 3: Hotel search (with rate limiting)
    console.log('🔍 Performing hotel search...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
    
    const searchResult = await anchor.tools.performWebTask({
      prompt: `Navigate to https://cpmaxx.cruiseplannersnet.com/HotelEngine and search for hotels:
      - Location: ${destination}
      - Check-in: ${checkIn}
      - Check-out: ${checkOut}
      
      After results load, extract ONLY hotel names and prices. Return the results as a simple JSON array:
      [
        {"name": "Hotel Name 1", "price": "$123"},
        {"name": "Hotel Name 2", "price": "$456"},
        {"name": "Hotel Name 3", "price": "$789"}
      ]
      
      Focus ONLY on hotel names and prices. Don't try to get ratings, amenities, or detailed descriptions. 
      Speed is more important than completeness. Return the JSON array immediately when you find hotel data.`,
      sessionId: sessionId,
      agent: 'browser-use',
      output_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "string" }
          },
          required: ["name", "price"]
        }
      }
    });

    console.log('✅ Hotel search completed');

    // Extract the hotel list
    const hotelData = searchResult.data?.result;
    
    if (hotelData) {
      console.log('\n🎉 Hotel availability found:');
      
      // Try to parse as JSON if it's a string
      let hotels;
      if (typeof hotelData === 'string') {
        try {
          hotels = JSON.parse(hotelData);
        } catch {
          // If not JSON, extract hotel info from text
          console.log('Raw result:', hotelData);
          return { hotels: [], raw: hotelData };
        }
      } else {
        hotels = hotelData;
      }

      if (Array.isArray(hotels)) {
        hotels.forEach((hotel, index) => {
          console.log(`${index + 1}. ${hotel.name} - ${hotel.price}`);
        });
        
        return {
          destination,
          checkIn,
          checkOut,
          hotelCount: hotels.length,
          hotels: hotels,
          timestamp: new Date().toISOString()
        };
      }
    }

    console.log('⚠️ No structured hotel data found');
    return { hotels: [], raw: hotelData };

  } catch (error) {
    console.error('❌ Error getting hotel list:', error.message);
    
    // Handle rate limiting gracefully
    if (error.status === 429) {
      console.log('⏱️ Rate limited. Waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
      throw new Error('Rate limited - please retry in 1 minute');
    }
    
    throw error;
  }
}

// Test function
async function testHotelList() {
  console.log('🚀 Testing hotel availability extraction...\n');
  
  try {
    const result = await getHotelList('Seattle, WA', '03/15/2026', '03/16/2026');
    
    console.log('\n📋 Final Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.hotels && result.hotels.length > 0) {
      console.log('\n✅ SUCCESS: Hotel availability data extracted for autonomous planning!');
      console.log(`Found ${result.hotels.length} available hotels`);
    } else {
      console.log('\n⚠️ No hotels found - check the raw result above');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Export for use in other modules
module.exports = { getHotelList };

// Run test if called directly
if (require.main === module) {
  testHotelList().then(() => {
    console.log('\n🏁 Hotel list test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}