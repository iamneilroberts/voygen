require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function debugResults() {
  console.log('🔍 Debugging Anchor Browser API responses...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ API client initialized');

    // Test 1: Simple webpage fetch
    console.log('\n📄 Test 1: Simple webpage content fetch...');
    try {
      const fetchResult = await anchor.tools.fetchWebpage({
        url: 'https://httpbin.org/json',
        format: 'html'
      });
      
      console.log('📋 Fetch result type:', typeof fetchResult);
      console.log('📋 Fetch result length:', fetchResult?.length || 'N/A');
      console.log('📋 First 200 chars:', fetchResult?.substring(0, 200));
    } catch (error) {
      console.log('❌ Fetch test failed:', error.message);
    }

    // Test 2: Simple web task
    console.log('\n🤖 Test 2: Simple web task...');
    try {
      const taskResult = await anchor.tools.performWebTask({
        prompt: 'Go to this URL and tell me what you see. Just describe the page content.',
        url: 'https://httpbin.org/json',
        agent: 'browser-use'
      });
      
      console.log('📋 Task result structure:');
      console.log('Type:', typeof taskResult);
      console.log('Keys:', Object.keys(taskResult));
      
      if (taskResult.data) {
        console.log('Data keys:', Object.keys(taskResult.data));
        console.log('Data content:', JSON.stringify(taskResult.data, null, 2));
      }
      
      if (taskResult.data?.result) {
        console.log('✅ ACTUAL RESULT:');
        console.log(taskResult.data.result);
      }
      
    } catch (error) {
      console.log('❌ Task test failed:', error.message);
      console.log('Error details:', JSON.stringify(error, null, 2));
    }

    // Test 3: Check current sessions
    console.log('\n🌐 Test 3: Check existing sessions...');
    try {
      // Try to list sessions if that method exists
      if (anchor.sessions && anchor.sessions.all) {
        const sessions = await anchor.sessions.all();
        console.log('📋 Sessions:', JSON.stringify(sessions, null, 2));
      } else {
        console.log('ℹ️ No sessions.all() method available');
      }
    } catch (error) {
      console.log('⚠️ Sessions check failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    
    if (error.status === 429) {
      console.log('\n⏱️ RATE LIMIT DETECTED');
      console.log('💡 This means:');
      console.log('  - API is working correctly');
      console.log('  - You hit usage limits (not billing limits)');
      console.log('  - Need to wait or get higher quota');
    }
  }
}

debugResults().then(() => {
  console.log('\n🏁 Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug crashed:', error);
  process.exit(1);
});