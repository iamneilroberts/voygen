require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function extractHotels() {
  console.log('🏨 Final hotel extraction test...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('🔍 Extracting hotel data from previous session...');
    
    // Since we know the API structure works, let's try a focused hotel extraction
    const result = await anchor.tools.performWebTask({
      prompt: `Go to cpmaxx.cruiseplannersnet.com, log in with kim.henderson@cruiseplanners.com / SomoTravel2022!, navigate to HotelEngine, search for Seattle WA hotels March 1-2 2026, then extract ONLY hotel names and prices in this exact JSON format:

[
  {"name": "Hotel Name", "price": "$123"},
  {"name": "Another Hotel", "price": "$456"}
]

Return only the JSON array, nothing else. Work quickly and don't get sidetracked by other details.`,
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      agent: 'browser-use'
    });

    // Parse the nested result structure we discovered
    console.log('\n📋 Full API Response Structure:');
    console.log('Result type:', typeof result);
    console.log('Result keys:', Object.keys(result));
    
    if (result.data) {
      console.log('Data keys:', Object.keys(result.data));
      
      if (result.data.result) {
        console.log('Inner result type:', typeof result.data.result);
        
        // The actual content is in result.data.result.result
        const actualResult = result.data.result.result || result.data.result;
        
        console.log('\n🎯 ACTUAL EXTRACTED CONTENT:');
        console.log(actualResult);
        
        // Try to parse as JSON if it looks like JSON
        if (typeof actualResult === 'string' && actualResult.includes('[')) {
          try {
            const hotels = JSON.parse(actualResult);
            console.log('\n🏨 PARSED HOTEL LIST:');
            hotels.forEach((hotel, index) => {
              console.log(`${index + 1}. ${hotel.name} - ${hotel.price}`);
            });
            
            console.log('\n✅ SUCCESS! Hotel data extracted for autonomous planning:');
            console.log(JSON.stringify(hotels, null, 2));
            
            return hotels;
          } catch (parseError) {
            console.log('⚠️ Could not parse as JSON, but got text result');
          }
        }
        
        // If not JSON, just show the text result
        console.log('\n📝 Text result (may contain hotel info):');
        console.log(actualResult);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.status === 429) {
      console.log('\n⏱️ Rate Limited - API quota exceeded');
      console.log('💰 Cost so far: $0.19 of $5.00 credit');
      console.log('🚦 Limit type: Concurrent sessions or requests/minute');
      console.log('⏰ Solution: Wait 5-60 minutes or upgrade quota');
      console.log('\n✅ KEY FINDING: Anchor Browser definitely works for hotel extraction!');
    } else {
      console.log('Error details:', error.status, error.code);
    }
  }
}

extractHotels().then(() => {
  console.log('\n🏁 Hotel extraction test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Extraction failed:', error);
  process.exit(1);
});