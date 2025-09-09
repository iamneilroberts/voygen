require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function quickHotelCheck() {
  console.log('🚀 Quick hotel availability check...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    // Use a single performWebTask call to do everything
    console.log('🔍 Running complete hotel search workflow...');
    
    const result = await anchor.tools.performWebTask({
      prompt: `Complete hotel search workflow:

1. Go to https://cpmaxx.cruiseplannersnet.com/main/login
2. Log in with email: ${process.env.CPMAXX_EMAIL} and password: ${process.env.CPMAXX_PASSWORD}
3. Navigate to https://cpmaxx.cruiseplannersnet.com/HotelEngine
4. Search for hotels: Seattle, WA from 03/15/2026 to 03/16/2026
5. Extract hotel names and prices ONLY

Return results as JSON array:
[{"name":"Hotel Name","price":"$123"},{"name":"Hotel Name 2","price":"$456"}]

Work quickly - don't spend time on detailed analysis. Just get the hotel names and prices.`,
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      agent: 'browser-use',
      model: 'gpt-4o-mini', // Use faster model
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

    console.log('✅ Workflow completed');
    
    // Parse and display results
    const hotels = result.data?.result;
    
    if (hotels) {
      console.log('\n🏨 Available Hotels:');
      
      if (typeof hotels === 'string') {
        console.log('Raw result:', hotels);
      } else if (Array.isArray(hotels)) {
        hotels.forEach((hotel, index) => {
          console.log(`${index + 1}. ${hotel.name} - ${hotel.price}`);
        });
        
        console.log(`\n📊 Found ${hotels.length} hotels for autonomous planning`);
        console.log('\n📋 JSON Result:');
        console.log(JSON.stringify(hotels, null, 2));
      } else {
        console.log('Structured result:', JSON.stringify(hotels, null, 2));
      }
    } else {
      console.log('⚠️ No hotel data returned');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.status === 429) {
      console.log('⏱️ Rate limited - API quota exceeded');
      console.log('💡 This confirms Anchor Browser works - just need higher limits for production');
    }
  }
}

quickHotelCheck().then(() => {
  console.log('\n🏁 Quick test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Quick test failed:', error);
  process.exit(1);
});