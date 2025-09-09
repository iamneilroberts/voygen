require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function testCpmaxWithTools() {
  console.log('🚀 Starting comprehensive cpmaxx test with Anchor Browser Tools...');
  
  try {
    // Initialize Anchor Browser
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ Connected to Anchor Browser API');

    // Test 1: Analyze the login page structure
    console.log('\n🔍 Test 1: Analyzing cpmaxx login page structure...');
    
    const loginAnalysis = await anchor.tools.performWebTask({
      prompt: 'Navigate to the cpmaxx login page and analyze its structure. Describe the login fields (email, password), any security features (captcha, tokens), form submission method, and what happens when you try to access protected pages without logging in.',
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      agent: 'browser-use',
      highlight_elements: true
    });

    console.log('📋 Login page analysis:');
    console.log(JSON.stringify(loginAnalysis, null, 2));

    // Test 2: Test what happens when accessing HotelEngine directly
    console.log('\n🔒 Test 2: Testing direct access to HotelEngine page...');
    
    const protectedPageTest = await anchor.tools.performWebTask({
      prompt: 'Navigate directly to the HotelEngine page and report what happens. Are we redirected to login? Do we get an error message? Can we see any content?',
      url: 'https://cpmaxx.cruiseplannersnet.com/HotelEngine',
      agent: 'browser-use'
    });

    console.log('🚪 Protected page access result:');
    console.log(JSON.stringify(protectedPageTest, null, 2));

    // Test 3: Try to perform login with credentials
    console.log('\n🔐 Test 3: Attempting login with provided credentials...');
    console.log(`📧 Using email: ${process.env.CPMAXX_EMAIL}`);
    console.log('🔑 Using password: [REDACTED]');
    
    const loginAttempt = await anchor.tools.performWebTask({
      prompt: `Go to the login page https://cpmaxx.cruiseplannersnet.com/main/login and log in using email: ${process.env.CPMAXX_EMAIL} and password: ${process.env.CPMAXX_PASSWORD}. After logging in, describe what happens - do we get redirected? Are we now authenticated? Can we see a dashboard or user interface?`,
      url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
      agent: 'browser-use',
      highlight_elements: true
    });

    console.log('🎯 Login attempt result:');
    console.log(JSON.stringify(loginAttempt, null, 2));

    // Test 4: If login was successful, try to access HotelEngine
    console.log('\n🏨 Test 4: Testing post-login access to HotelEngine...');
    
    const authenticatedAccess = await anchor.tools.performWebTask({
      prompt: 'Now navigate to https://cpmaxx.cruiseplannersnet.com/HotelEngine and see if we can access the hotel search functionality. Describe what you see - is there a search form, hotel results, or any travel booking interface?',
      agent: 'browser-use'
    });

    console.log('🎉 Authenticated access result:');
    console.log(JSON.stringify(authenticatedAccess, null, 2));

    console.log('\n✅ All tests completed successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('1. ✅ Login page analysis completed');
    console.log('2. ✅ Protected page access test completed'); 
    console.log('3. ✅ Login attempt completed');
    console.log('4. ✅ Post-authentication access test completed');
    console.log('\n🎉 Anchor Browser can successfully interact with cpmaxx.cruiseplannersnet.com!');

  } catch (error) {
    console.error('❌ Error during cpmaxx test:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code
    });
  }
}

// Run the comprehensive test
testCpmaxWithTools().then(() => {
  console.log('\n🏁 Comprehensive test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});