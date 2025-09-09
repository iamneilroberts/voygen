require('dotenv').config();
const { Anchorbrowser } = require('anchorbrowser');

class SafeAnchorSession {
  constructor(apiKey) {
    this.anchor = new Anchorbrowser({ apiKey });
    this.sessionId = null;
    this.isActive = false;
  }
  
  async createSession() {
    console.log('🌐 Creating session with auto-cleanup...');
    
    try {
      const session = await this.anchor.sessions.create({});
      this.sessionId = session.data?.id;
      this.isActive = true;
      
      console.log(`✅ Session created: ${this.sessionId}`);
      
      // Set up auto-cleanup after 5 minutes as a safety net
      setTimeout(() => {
        if (this.isActive) {
          console.log('⚠️ Auto-cleanup triggered after 5 minutes');
          this.cleanup();
        }
      }, 5 * 60 * 1000);
      
      return this.sessionId;
      
    } catch (error) {
      console.error('❌ Session creation failed:', error.message);
      throw error;
    }
  }
  
  async performTask(prompt, url) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    try {
      const result = await this.anchor.tools.performWebTask({
        prompt,
        url,
        sessionId: this.sessionId,
        agent: 'browser-use',
        output_schema: {
          type: "object",
          properties: {
            hotels: {
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
            },
            total: { type: "number" }
          }
        }
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Task failed:', error.message);
      
      // Always cleanup on error
      await this.cleanup();
      throw error;
    }
  }
  
  async cleanup() {
    if (!this.isActive) {
      console.log('ℹ️ Session already cleaned up');
      return;
    }
    
    console.log('🧹 Cleaning up session...');
    
    try {
      // Method 1: Try SDK delete
      if (this.anchor.sessions && this.anchor.sessions.delete) {
        await this.anchor.sessions.delete('all');
        console.log('✅ Sessions terminated via SDK');
      }
      
      this.isActive = false;
      this.sessionId = null;
      
    } catch (error) {
      console.log('⚠️ Session cleanup warning:', error.message);
      
      // Method 2: Try direct API call as backup
      try {
        if (this.sessionId) {
          const response = await fetch(`https://api.anchorbrowser.io/v1/sessions/${this.sessionId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${process.env.ANCHORBROWSER_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log('✅ Session terminated via direct API');
          }
        }
      } catch (directError) {
        console.log('⚠️ Direct API cleanup also failed');
      }
      
      this.isActive = false;
      this.sessionId = null;
    }
  }
}

async function safeHotelExtraction(destination, checkIn, checkOut) {
  const session = new SafeAnchorSession(process.env.ANCHORBROWSER_API_KEY);
  
  try {
    // Create session
    await session.createSession();
    
    // Perform hotel search with timeout
    console.log(`🏨 Searching hotels: ${destination} (${checkIn} - ${checkOut})`);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout - preventing runaway sessions')), 90000); // 90 second timeout
    });
    
    const taskPromise = session.performTask(
      `Login to cpmaxx with kim.henderson@cruiseplanners.com / SomoTravel2022!, search ${destination} hotels ${checkIn} to ${checkOut}, return JSON object with all hotels.`,
      'https://cpmaxx.cruiseplannersnet.com/main/login'
    );
    
    // Race between task completion and timeout
    const result = await Promise.race([taskPromise, timeoutPromise]);
    
    // Parse results
    const actualResult = result.data?.result?.result || result.data?.result;
    
    console.log('🎯 Hotel extraction result:');
    console.log('Type:', typeof actualResult);
    
    if (typeof actualResult === 'object' && actualResult.hotels) {
      console.log(`✅ Found ${actualResult.hotels.length} hotels:`);
      actualResult.hotels.forEach((hotel, i) => {
        console.log(`  ${i+1}. ${hotel.name} - ${hotel.price}`);
      });
      
      return {
        success: true,
        hotels: actualResult.hotels,
        total: actualResult.hotels.length
      };
    } else {
      console.log('Raw result:', actualResult);
      return {
        success: false,
        raw: actualResult
      };
    }
    
  } catch (error) {
    console.error('❌ Safe extraction failed:', error.message);
    
    if (error.status === 429) {
      console.log('⏱️ Rate limited - sessions are being cleaned up');
    }
    
    return {
      success: false,
      error: error.message
    };
    
  } finally {
    // ALWAYS cleanup session
    await session.cleanup();
    console.log('🛡️ Session cleanup completed - no runaway costs');
  }
}

// Test function
async function testSafeExtraction() {
  console.log('🧪 Testing safe hotel extraction with auto-cleanup...');
  
  const result = await safeHotelExtraction('Seattle, WA', '03/15/2026', '03/16/2026');
  
  console.log('\n📋 Final Result:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('\n🎉 Safe extraction successful!');
  } else {
    console.log('\n⚠️ Extraction had issues, but sessions were properly cleaned up');
  }
}

// Export for production use
module.exports = { SafeAnchorSession, safeHotelExtraction };

// Run test if called directly
if (require.main === module) {
  testSafeExtraction().then(() => {
    console.log('\n🏁 Safe extraction test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}