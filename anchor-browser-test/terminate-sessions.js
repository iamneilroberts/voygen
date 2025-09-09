require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

async function terminateAllSessions() {
  console.log('🛑 Terminating all active browser sessions...');
  
  try {
    const anchor = new Anchorbrowser({
      apiKey: process.env.ANCHORBROWSER_API_KEY
    });

    // Method 1: Try to end all sessions at once
    try {
      console.log('🔄 Attempting to end all sessions...');
      
      // Based on the API docs, there should be a way to end all sessions
      const response = await fetch('https://api.anchorbrowser.io/v1/sessions/all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.ANCHORBROWSER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ All sessions terminated via bulk delete');
        const result = await response.text();
        console.log('Response:', result);
      } else {
        console.log('⚠️ Bulk delete failed, trying individual termination...');
        throw new Error('Bulk delete not available');
      }
      
    } catch (bulkError) {
      console.log('📝 Bulk delete not working, trying individual session termination...');
      
      // Method 2: Try to terminate specific session
      const sessionId = '8d75aacc-b129-4c8b-9a0f-3a5bce4a8434';
      
      try {
        console.log(`🎯 Terminating specific session: ${sessionId}`);
        
        const response = await fetch(`https://api.anchorbrowser.io/v1/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.ANCHORBROWSER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('✅ Specific session terminated');
          const result = await response.text();
          console.log('Response:', result);
        } else {
          console.log(`❌ Failed to terminate session. Status: ${response.status}`);
          const errorText = await response.text();
          console.log('Error:', errorText);
        }
        
      } catch (sessionError) {
        console.log('❌ Session termination failed:', sessionError.message);
      }
    }
    
    // Method 3: Try using the SDK if it has session management
    try {
      console.log('🔧 Checking SDK session methods...');
      
      if (anchor.sessions) {
        console.log('Available session methods:', Object.getOwnPropertyNames(anchor.sessions));
        
        // Try different possible method names
        const possibleMethods = ['delete', 'terminate', 'end', 'close', 'destroy'];
        
        for (const method of possibleMethods) {
          if (typeof anchor.sessions[method] === 'function') {
            console.log(`Found method: sessions.${method}`);
            try {
              const result = await anchor.sessions[method]('all');
              console.log(`✅ Successfully called sessions.${method}`);
              console.log('Result:', result);
              break;
            } catch (error) {
              console.log(`⚠️ sessions.${method} failed:`, error.message);
            }
          }
        }
      }
      
    } catch (sdkError) {
      console.log('⚠️ SDK session management not available');
    }

  } catch (error) {
    console.error('❌ Session termination error:', error.message);
  }
}

// Also create a session cleanup function for future use
async function cleanupSession(sessionId) {
  console.log(`🧹 Cleaning up session: ${sessionId}`);
  
  try {
    const response = await fetch(`https://api.anchorbrowser.io/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.ANCHORBROWSER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Session cleaned up successfully');
      return true;
    } else {
      console.log('❌ Session cleanup failed:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
    return false;
  }
}

// Export for use in other scripts
module.exports = { cleanupSession };

// Run termination if called directly
if (require.main === module) {
  terminateAllSessions().then(() => {
    console.log('\n🏁 Session termination completed');
    console.log('💡 Check your Anchor Browser dashboard to confirm sessions are ended');
    console.log('🔗 Dashboard: https://app.anchorbrowser.io/billing');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Termination failed:', error);
    process.exit(1);
  });
}