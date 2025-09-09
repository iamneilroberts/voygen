 Prompt for New Session: Continue CPMaxx Hotel Availability Integration

  Continue implementing the CPMaxx hotel availability search feature for Voygen. The
  mcp-chrome server is now available.

  **Previous Work Completed:**
  ✅ Analyzed mcp-chrome structure and available browser automation tools
  ✅ Created comprehensive feature specification at
  `/home/neil/dev/voygen/.project/features/availability-first.md`
  ✅ Identified that ORCHESTRATOR tools were already added to mcp-chrome (EXTRACT_HOTELS, 
  EXTRACT_ROOM_RATES)

  **Current Status:**
  The other process working on mcp-chrome has completed. I can see that new ORCHESTRATOR 
  tools were already added to 
  `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome/packages/shared/src/tools.ts` 
  including:
  - EXTRACT_HOTELS (line 579-613) - Orchestrate hotel extraction and ingest into database
  - EXTRACT_ROOM_RATES (line 615-628) - Extract detailed room rates

  **Next Tasks:**
  1. **Add CPMaxx-specific tools** to mcp-chrome for the navigation workflow:
     - CPMAXX_HOTEL_SEARCH - Navigate to CPMaxx and perform automated hotel search
     - CPMAXX_PARSE_RESULTS - Extract hotel availability data from CPMaxx search results

  2. **Implement CPMaxx automation workflow:**
     - Navigate to `https://cpmaxx.cruiseplannersnet.com/HotelEngine`
     - Fill search form with location auto-complete handling
     - Handle date picker navigation (use direct MM/DD/YYYY + TAB technique)
     - Click search and wait for results (~10 seconds)
     - Parse results from `/HotelEngine/searchResults/map` URL pattern

  3. **Test with real search:**
     - Location: "Bath, UK"
     - Dates: March 15-22, 2026
     - Verify complete hotel availability extraction

  4. **Integrate with Voygen database:**
     - Connect to d1-database MCP server
     - Store availability data linked to trip planning
     - Update trip facts with bookable options

  **Key Implementation Files:**
  - `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome/packages/shared/src/tools.ts` (add
   CPMaxx tools)
  - `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome/app/chrome-extension/` (browser
  automation logic)

  **Available Browser Tools to Use:**
  - chrome_navigate, chrome_fill_or_select, chrome_click_element
  - chrome_get_web_content, chrome_screenshot, chrome_get_interactive_elements
  - chrome_keyboard (for TAB navigation), chrome_extract_hotels

  **Critical Requirements:**
  - Use browser saved credentials (no manual login)
  - Handle location dropdown auto-complete selection properly
  - Bypass date picker with direct MM/DD/YYYY entry + TAB
  - Parse all available hotels from search results
  - Return structured data for Voygen integration

  Start by examining the current mcp-chrome tools.ts file to understand the new
  ORCHESTRATOR tools, then implement the CPMaxx-specific automation workflow.
