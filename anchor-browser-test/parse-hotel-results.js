// Hotel result parser for Anchor Browser API responses

function parseAnchorResult(apiResponse) {
  console.log('🔍 Parsing Anchor Browser response...');
  
  // Based on our debugging, the structure is:
  // apiResponse.data.result.result (nested result)
  
  let actualContent = null;
  
  if (apiResponse && apiResponse.data) {
    if (apiResponse.data.result) {
      // Try the nested structure we found
      actualContent = apiResponse.data.result.result || apiResponse.data.result;
    }
  }
  
  if (!actualContent) {
    console.log('⚠️ No result content found');
    return null;
  }
  
  console.log('📄 Raw content type:', typeof actualContent);
  console.log('📄 Raw content preview:', 
    typeof actualContent === 'string' ? actualContent.substring(0, 200) : actualContent);
  
  // Try to parse as JSON first
  if (typeof actualContent === 'string') {
    // Look for JSON array pattern
    const jsonMatch = actualContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const hotels = JSON.parse(jsonMatch[0]);
        if (Array.isArray(hotels)) {
          console.log('✅ Successfully parsed hotel JSON array');
          return {
            success: true,
            format: 'json',
            hotels: hotels,
            count: hotels.length
          };
        }
      } catch (error) {
        console.log('⚠️ JSON parse failed:', error.message);
      }
    }
    
    // Try to extract hotel data from text
    const hotelPattern = /(\w+.*Hotel.*?|\w+.*Inn.*?|\w+.*Resort.*?) - \$?(\d+)/gi;
    const matches = [...actualContent.matchAll(hotelPattern)];
    
    if (matches.length > 0) {
      const hotels = matches.map(match => ({
        name: match[1].trim(),
        price: `$${match[2]}`
      }));
      
      console.log('✅ Extracted hotels from text pattern');
      return {
        success: true,
        format: 'text_extracted',
        hotels: hotels,
        count: hotels.length
      };
    }
  }
  
  // If object format, try to extract directly
  if (typeof actualContent === 'object') {
    console.log('📋 Object content keys:', Object.keys(actualContent));
    
    // Check if it's already structured hotel data
    if (Array.isArray(actualContent)) {
      return {
        success: true,
        format: 'object_array',
        hotels: actualContent,
        count: actualContent.length
      };
    }
  }
  
  console.log('⚠️ Could not parse hotel data from response');
  return {
    success: false,
    format: 'unknown',
    raw: actualContent
  };
}

// Test with mock data that matches the structure we found
function testParser() {
  console.log('🧪 Testing hotel result parser...\n');
  
  // Test case 1: Successful JSON response
  const mockResponse1 = {
    data: {
      result: {
        result: '[{"name":"The Edgewater Hotel","price":"$245"},{"name":"Hotel Theodore","price":"$152"}]'
      }
    }
  };
  
  console.log('Test 1: JSON format');
  const result1 = parseAnchorResult(mockResponse1);
  if (result1.success) {
    console.log(`✅ Found ${result1.count} hotels:`);
    result1.hotels.forEach((hotel, i) => {
      console.log(`  ${i+1}. ${hotel.name} - ${hotel.price}`);
    });
  }
  
  // Test case 2: Text format response
  const mockResponse2 = {
    data: {
      result: {
        result: "I found these Seattle hotels: The Edgewater Hotel - $245 per night, Hotel Theodore - $152 per night, and Baymont by Wyndham - $84 per night."
      }
    }
  };
  
  console.log('\nTest 2: Text format');
  const result2 = parseAnchorResult(mockResponse2);
  if (result2.success) {
    console.log(`✅ Found ${result2.count} hotels:`);
    result2.hotels.forEach((hotel, i) => {
      console.log(`  ${i+1}. ${hotel.name} - ${hotel.price}`);
    });
  }
  
  console.log('\n🎯 Parser ready for real Anchor Browser responses!');
}

// Export for use in other scripts
module.exports = { parseAnchorResult };

// Run test if called directly
if (require.main === module) {
  testParser();
}