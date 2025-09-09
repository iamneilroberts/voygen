require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function getFullHotelResults() {
  console.log('🔍 Attempting to get FULL hotel extraction results...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    // Try a very focused extraction request
    const response = await anchor.tools.performWebTask({
      prompt: `I need the COMPLETE list of Seattle hotels from the previous cpmaxx search. Please:

1. Go to cpmaxx.cruiseplannersnet.com 
2. Login with kim.henderson@cruiseplanners.com / SomoTravel2022!
3. Navigate to HotelEngine 
4. Search: Seattle, WA from March 1-2, 2026
5. Extract ALL hotels from the results page - not just the first few

IMPORTANT: Return the COMPLETE list in this exact JSON format:
[
  {"name": "Hotel 1", "price": "$123", "address": "123 Main St"},
  {"name": "Hotel 2", "price": "$456", "address": "456 Oak Ave"},
  ...ALL OTHER HOTELS...
]

Don't stop at 3-5 hotels. Get the FULL list - scroll if needed to see all results.`,
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      agent: 'browser-use',
      output_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "string" },
            address: { type: "string" }
          },
          required: ["name", "price"]
        }
      }
    });

    console.log('\n📋 FULL API RESPONSE:');
    console.log('Response keys:', Object.keys(response));
    console.log('Data keys:', response.data ? Object.keys(response.data) : 'No data');
    
    // Parse using our discovered structure
    const actualResult = response.data?.result?.result || response.data?.result;
    
    console.log('\n🎯 RAW EXTRACTED CONTENT:');
    console.log('Content type:', typeof actualResult);
    console.log('Content length:', typeof actualResult === 'string' ? actualResult.length : 'N/A');
    console.log('Content preview (first 500 chars):');
    console.log(typeof actualResult === 'string' ? actualResult.substring(0, 500) : actualResult);
    
    // Try to parse as JSON
    if (typeof actualResult === 'string') {
      // Look for JSON array
      const jsonMatch = actualResult.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const hotels = JSON.parse(jsonMatch[0]);
          console.log('\n🏨 COMPLETE HOTEL LIST:');
          console.log(`Found ${hotels.length} total hotels:`);
          
          hotels.forEach((hotel, index) => {
            console.log(`${index + 1}. ${hotel.name} - ${hotel.price}${hotel.address ? ` (${hotel.address})` : ''}`);
          });
          
          console.log('\n📋 FULL JSON DATA:');
          console.log(JSON.stringify(hotels, null, 2));
          
          return {
            totalHotels: hotels.length,
            hotels: hotels,
            success: true
          };
          
        } catch (error) {
          console.log('❌ JSON parsing failed:', error.message);
          console.log('Raw JSON string was:', jsonMatch[0].substring(0, 200) + '...');
        }
      } else {
        console.log('⚠️ No JSON array pattern found in result');
        console.log('Full content:');
        console.log(actualResult);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.status === 429) {
      console.log('\n⏱️ Rate Limited');
      console.log('💡 Check your session history at: https://app.anchorbrowser.io/sessions');
      console.log('💡 Look for successful sessions and check the Agent Logs for complete results');
    }
  }
}

getFullHotelResults().then(() => {
  console.log('\n🏁 Full results extraction completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Failed:', error);
  process.exit(1);
});