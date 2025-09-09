require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function testCpmaxAuthentication() {
  console.log('🚀 Starting cpmaxx authentication test...');
  
  try {
    // Initialize Anchor Browser
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ Connected to Anchor Browser API');

    // Test 1: Create a browser session
    console.log('\n🌐 Test 1: Creating browser session...');
    
    // Let's explore the sessions.all() method first
    try {
      const sessions = await anchor.sessions.all();
      console.log('📋 Current sessions:', JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.log('ℹ️  No existing sessions or error:', error.message);
    }

    // Test 2: Try to use the agent to navigate to cpmaxx
    console.log('\n🤖 Test 2: Using agent to analyze cpmaxx login...');
    
    // Let's see what methods are available on agent
    if (anchor.agent) {
      console.log('🔍 Agent methods:', Object.getOwnPropertyNames(anchor.agent));
      
      try {
        // Try to create a task or navigate - we'll need to figure out the exact API
        const result = await anchor.agent.create({
          task: 'Navigate to https://cpmaxx.cruiseplannersnet.com/main/login and analyze the login form'
        });
        
        console.log('🎯 Agent task result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('⚠️  Agent create error:', error.message);
        
        // Try different approaches based on the available methods
        if (anchor.sessions && anchor.sessions.agent) {
          console.log('🔧 Trying sessions.agent approach...');
          try {
            const sessionResult = await anchor.sessions.agent.create({
              url: 'https://cpmaxx.cruiseplannersnet.com/main/login',
              task: 'Analyze this login page'
            });
            console.log('🎯 Session agent result:', JSON.stringify(sessionResult, null, 2));
          } catch (sessionError) {
            console.log('⚠️  Session agent error:', sessionError.message);
          }
        }
      }
    }

    // Test 3: Try the browser methods if available
    console.log('\n🌏 Test 3: Testing browser methods...');
    if (anchor.browser) {
      console.log('🔍 Browser methods:', Object.getOwnPropertyNames(anchor.browser));
      
      try {
        const browserResult = await anchor.browser.navigate({
          url: 'https://cpmaxx.cruiseplannersnet.com/main/login'
        });
        console.log('🌐 Browser navigate result:', JSON.stringify(browserResult, null, 2));
      } catch (browserError) {
        console.log('⚠️  Browser navigate error:', browserError.message);
      }
    }

    console.log('\n✅ Authentication test completed');

  } catch (error) {
    console.error('❌ Error during authentication test:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
}

// Run the test
testCpmaxAuthentication().then(() => {
  console.log('\n🏁 Authentication test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Authentication test failed:', error);
  process.exit(1);
});