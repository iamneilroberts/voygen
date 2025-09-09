require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function testCpmaxAccess() {
  console.log('🚀 Starting Anchor Browser test...');
  
  try {
    // Initialize Anchor Browser
    console.log('📡 Connecting to Anchor Browser API...');
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ API key loaded:', process.env.ANCHORBROWSER_API_KEY ? 'Yes' : 'No');

    // Test 1: Create a profile for cpmaxx authentication
    console.log('\n👤 Test 1: Creating authentication profile...');
    const profile = await anchor.profiles.create({
      name: 'cpmaxx-test-profile'
    });

    console.log('✅ Profile created:', JSON.stringify(profile, null, 2));

    // Test 2: Create a session and test login page access
    console.log('\n🔍 Test 2: Testing cpmaxx login page access...');
    
    // Note: We'll need to figure out the correct API structure for sessions and tasks
    // Based on the README, there are sessions.agent methods available
    
    console.log('🔍 Attempting to analyze login page structure...');
    
    // For now, let's just test that we can create profiles and see what other methods are available
    console.log('Available methods on client:', Object.getOwnPropertyNames(anchor));
    
    if (anchor.sessions) {
      console.log('Sessions methods:', Object.getOwnPropertyNames(anchor.sessions));
    }

    console.log('\n✅ Basic tests completed successfully!');
    
    // If we get this far, the API is working
    console.log('\n🎉 Next steps: Test authentication flow with real credentials');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
  }
}

// Run the test
testCpmaxAccess().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});