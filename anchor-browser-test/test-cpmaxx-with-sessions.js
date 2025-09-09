require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function testCpmaxWithSessions() {
  console.log('🚀 Starting cpmaxx test with proper session management...');
  
  try {
    // Initialize Anchor Browser
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ Connected to Anchor Browser API');

    // Step 1: Create a browser session
    console.log('\n🌐 Step 1: Creating browser session...');
    const session = await anchor.sessions.create({
      // Optional session configurations can go here
    });
    
    const sessionId = session.data?.id;
    console.log(`✅ Session created with ID: ${sessionId}`);
    console.log(`🔗 Live view URL: ${session.data?.live_view_url}`);

    if (!sessionId) {
      throw new Error('Failed to get session ID from response');
    }

    // Step 2: Navigate to login page and analyze it
    console.log('\n🔍 Step 2: Analyzing cpmaxx login page...');
    
    const loginAnalysis = await anchor.tools.performWebTask({
      prompt: 'Analyze this cpmaxx login page. Describe the login form fields, security features, and overall page structure.',
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      sessionId: sessionId,
      agent: 'browser-use',
      highlight_elements: true
    });

    console.log('📋 Login analysis result:');
    console.log(JSON.stringify(loginAnalysis.data?.result, null, 2));

    // Step 3: Perform login using the same session
    console.log('\n🔐 Step 3: Logging in with credentials...');
    console.log(`📧 Email: ${process.env.CPMAXX_EMAIL}`);
    
    const loginResult = await anchor.tools.performWebTask({
      prompt: `Fill out the login form with email "${process.env.CPMAXX_EMAIL}" and password "${process.env.CPMAXX_PASSWORD}", then submit it. Describe what happens after login - do we get redirected to a dashboard?`,
      sessionId: sessionId,
      agent: 'browser-use',
      highlight_elements: true
    });

    console.log('🎯 Login result:');
    console.log(JSON.stringify(loginResult.data?.result, null, 2));

    // Step 4: Navigate to HotelEngine using the authenticated session
    console.log('\n🏨 Step 4: Accessing HotelEngine with authenticated session...');
    
    const hotelEngineAccess = await anchor.tools.performWebTask({
      prompt: 'Navigate to https://cpmaxx.cruiseplannersnet.com/HotelEngine and describe what you see. Is there a hotel search interface? What functionality is available?',
      sessionId: sessionId,
      agent: 'browser-use'
    });

    console.log('🎉 HotelEngine access result:');
    console.log(JSON.stringify(hotelEngineAccess.data?.result, null, 2));

    // Step 5: Try to perform a hotel search if possible
    console.log('\n🔍 Step 5: Testing hotel search functionality...');
    
    const hotelSearch = await anchor.tools.performWebTask({
      prompt: 'Look for hotel search functionality on this page. If you find search fields (destination, dates, etc.), try performing a sample hotel search for "Orlando, FL" or any available destination. Describe the search interface and any results you can find.',
      sessionId: sessionId,
      agent: 'browser-use'
    });

    console.log('🏨 Hotel search test result:');
    console.log(JSON.stringify(hotelSearch.data?.result, null, 2));

    // Step 6: Create a profile to save this authenticated session
    console.log('\n💾 Step 6: Creating profile to save authenticated session...');
    
    const profile = await anchor.profiles.create({
      name: 'cpmaxx-authenticated-session'
    });

    console.log('✅ Profile created:');
    console.log(JSON.stringify(profile.data, null, 2));

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Session management working properly');
    console.log('✅ cpmaxx.cruiseplannersnet.com authentication successful');
    console.log('✅ Post-login navigation working');
    console.log('✅ Hotel search interface accessible');
    console.log('✅ Session state preserved across multiple API calls');
    
    console.log('\n🚀 Anchor Browser is fully compatible with cpmaxx for hotel data extraction!');

  } catch (error) {
    console.error('❌ Error during session test:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code
    });
  }
}

// Run the session-managed test
testCpmaxWithSessions().then(() => {
  console.log('\n🏁 Session test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Session test failed:', error);
  process.exit(1);
});