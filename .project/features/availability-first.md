# Hotel Availability First - CPMaxx Integration

## Feature Overview
Implement automated hotel availability checking using mcp-chrome to search CPMaxx during early trip planning phases. This ensures Voygen only recommends hotels that are actually bookable for the travel agent's clients.

## Current Progress
- ✅ Analyzed mcp-chrome implementation structure
- ✅ Identified available browser automation tools
- ⏸️ **PAUSED** - Another process is working on mcp-chrome server

## Implementation Plan

### Phase 1: CPMaxx Search Automation
**File Location:** `/home/neil/dev/voygen/mcp-local-servers/mcp-chrome/packages/shared/src/tools.ts`

Add new tool functions:
- `CPMAXX_HOTEL_SEARCH` - Navigate to CPMaxx and perform hotel search
- `CPMAXX_PARSE_RESULTS` - Extract hotel availability data from search results

### Phase 2: Navigation Workflow
**Target URL:** `https://cpmaxx.cruiseplannersnet.com/HotelEngine`

**Search Steps:**
1. Navigate to CPMaxx hotel search page (bypass login using saved browser credentials)
2. Fill location field with partial text (e.g., "Bath")  
3. Wait for dropdown and select correct location from popup
4. Enter check-in date (format: MM/DD/YYYY) with TAB navigation to skip calendar
5. Enter check-out date with same technique
6. Set room configuration (adults/children per room)
7. Click "Start Search" button
8. Wait for results to load (~10 seconds)
9. Parse results page at URL pattern: `/HotelEngine/searchResults/map`

### Phase 3: Data Extraction
**Expected Output:**
```typescript
interface HotelAvailability {
  hotels: Array<{
    name: string;
    location: string;
    checkIn: string;
    checkOut: string;
    availability: boolean;
    priceRange?: string;
    bookingDetails?: any;
  }>;
  searchParams: {
    location: string;
    dates: string;
    rooms: number;
    guests: number;
  };
}
```

### Phase 4: Voygen Integration
Connect to d1-database MCP server to:
- Store hotel availability data
- Link to trip planning workflows
- Update trip facts with bookable options

## Technical Requirements

### Browser Automation Tools Available
From mcp-chrome analysis:
- `chrome_navigate` - Navigate to CPMaxx URLs
- `chrome_fill_or_select` - Fill search form fields
- `chrome_click_element` - Click buttons and select dropdowns
- `chrome_get_web_content` - Extract page content
- `chrome_screenshot` - Visual verification of steps
- `chrome_get_interactive_elements` - Find form elements
- `chrome_keyboard` - Handle TAB navigation and date entry

### Form Field Mapping
Based on provided screenshots:
- Location field: Auto-complete with dropdown selection required
- Check-in date: Date picker (bypass with direct MM/DD/YYYY entry + TAB)
- Check-out date: Same technique as check-in
- Room configuration: Dropdown selectors for adults/children
- Search trigger: Blue "Start Search" button

### Error Handling
- Handle authentication redirects (should use browser saved credentials)
- Manage form validation errors
- Timeout handling for search loading (~10 seconds)
- Location dropdown selection validation

## Next Steps (Resume Instructions)

**Prompt for new session:**
```
Continue implementing the CPMaxx hotel availability search feature for Voygen. 

Previous work completed:
- Analyzed mcp-chrome structure and available tools
- Created feature specification at .project/features/availability-first.md

Next tasks:
1. Add new CPMAXX_HOTEL_SEARCH and CPMAXX_PARSE_RESULTS tools to mcp-chrome/packages/shared/src/tools.ts
2. Implement the CPMaxx navigation workflow with form filling automation
3. Add hotel search result parsing using the chrome_get_web_content tool
4. Test the complete flow with actual CPMaxx search (location: "Bath, UK", dates: March 15-22, 2026)
5. Integrate with Voygen's d1-database for storing availability data

Key implementation files:
- /home/neil/dev/voygen/mcp-local-servers/mcp-chrome/packages/shared/src/tools.ts (add new tools)
- /home/neil/dev/voygen/mcp-local-servers/mcp-chrome/app/chrome-extension/ (browser automation logic)

Target CPMaxx URL: https://cpmaxx.cruiseplannersnet.com/HotelEngine

Use the existing browser automation tools: chrome_navigate, chrome_fill_or_select, chrome_click_element, chrome_get_web_content, chrome_screenshot for implementation.
```

## Dependencies
- mcp-chrome server (currently in use by another process)
- d1-database MCP server for data persistence
- CPMaxx user authentication (browser saved credentials)
- Chrome browser with debugging enabled for automation

## Testing Criteria
- Successfully navigate to CPMaxx hotel search
- Complete search form automation without manual intervention
- Extract complete hotel availability list
- Return structured data for Voygen trip planning integration
- Handle edge cases (no results, form errors, timeouts)