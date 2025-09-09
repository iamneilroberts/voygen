require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function debugSessions() {
  console.log('🔍 Debugging session creation...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    console.log('✅ Connected to Anchor Browser API');

    // Try to create a session and see what we get
    console.log('\n🌐 Creating session...');
    const session = await anchor.sessions.create({});
    
    console.log('📋 Full session response:');
    console.log(JSON.stringify(session, null, 2));

    // Check response structure
    console.log('\n🔍 Analyzing response structure:');
    console.log('Type of response:', typeof session);
    console.log('Keys in response:', Object.keys(session));
    
    if (session.data) {
      console.log('Keys in session.data:', Object.keys(session.data));
    }

  } catch (error) {
    console.error('❌ Error during session debug:', error);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
  }
}

debugSessions().then(() => {
  console.log('\n🏁 Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});