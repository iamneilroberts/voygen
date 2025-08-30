-- Update existing instructions with new references and enhancements

-- 1. Update mobile-mode to reference image optimization and commission tracking
UPDATE instruction_sets 
SET content = '# Mobile Mode - Autonomous Lead Processing

## When Triggered:
- Messages with `[MOBILE]` prefix
- Agent relay phrases: "Just got off the phone with...", "New lead:"
- Casual travel lead descriptions

## Core Workflow:
1. **Parse Lead Information**
   - Extract: client names, budget, destinations, dates, group size, departure location
   - Assume reasonable defaults for missing info

2. **Create Basic Trip Structure**
   - Create client records using `create_client`
   - Set up trip using `create_trip`
   - Link clients via TripParticipants

3. **Three-Tier Pricing Outline**
   - **Discover** (75% budget): Economy flights, 3-star hotels, public transport
   - **Elevate** (110% budget): Premium economy/business, 4-star hotels, private transfers
   - **Transcend** (175% budget): Business/first class, 5-star luxury, VIP experiences

## Key Principles:
- NO confirmations - work autonomously
- Store data in database immediately
- Focus on speed and structure
- Target Elevate tier (highest profit margin)
- Track all commission opportunities in trip_notes

## Image Capture:
When gathering hotel images from CPMaxx or other sites, use the 3-tier image capture strategy (see image-capture-optimization instruction) for best performance.

## Response Format:
- End each response with: `[🤖 AUTONOMOUS]`',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'mobile-mode';

-- 2. Update interactive-mode to include essential commands and proactive features
UPDATE instruction_sets 
SET content = '# Interactive Mode - Collaborative Planning

## When Triggered:
- Messages starting with `/` commands
- Direct questions from agent
- Technical operations
- Explicit agent instructions

## Core Approach:
1. **Ask for confirmations** before major actions
2. **Provide options** and wait for selections  
3. **Step-by-step planning** with agent input
4. **Manual document generation** approval required
5. **Collaborative decision making**

## Common Workflows:
- **`/new`**: Interactive trip planning with options
- **`/tools`**: Show available MCP tools by category
- **`/help`**: Context-sensitive help system
- **`/list`**: Display clients, trips, or current trip details
- **`/publish`**: Publish documents to GitHub
- **`/save`**: Commit database changes

## Proactive Features:
- During planning, automatically search for Kim''s Gems opportunities
- Present Viator tour options for each destination
- Run daily verification after completing each day
- Analyze commission at trip completion

## Response Style:
- Present options clearly
- Ask "What would you like to do?" 
- Confirm before database changes
- Explain what each tool does

## Response Format:
- End each response with: `[💬 INTERACTIVE]`',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'interactive-mode';

-- 3. Update tool-reference to remove deprecated servers and add new features
UPDATE instruction_sets 
SET content = '# MCP Tools Quick Reference

## Core MCP Servers (Current & Active)

### Database (d1-database-improved)
#### Client Management:
- `create_client`: Create new client (first_name, last_name, email)
- `search_clients`: Find clients (name, email)
- `get_client`: Retrieve client (client_id)

#### Trip Management:
- `create_trip`: Create trip (trip_name, start_date, end_date)
- `link_trip_participants`: Connect clients to trips (trip_id, client_id)
- `get_comprehensive_trip_details`: Complete trip details (trip_id)
- `search_trips`: Find trips (client_name, destination)

### Browser Automation (mcp-chrome)
- `chrome_navigate`: Navigate to URL
- `chrome_screenshot`: Capture page screenshots (use optimized sizes)
- `chrome_get_web_content`: Extract page content (preferred for images)
- `chrome_click_element`: Click on page elements
- `chrome_fill_or_select`: Fill forms
- `chrome_get_interactive_elements`: Find clickable elements

### Image Storage (local-image-storage)
- `local_upload_image`: Store images with metadata and trip organization
- `local_create_gallery`: Generate interactive image selection galleries
- `local_get_selections`: Retrieve user gallery selections

### Prompt Instructions (prompt-instructions-d1)
- `get_instruction`: Retrieve specific instruction by name
- `list_instructions`: Browse available instructions
- `create_instruction`: Add new instruction
- `update_instruction`: Modify existing instruction

## Built-in Claude Tools

### File Management
- `Read`: Read files and templates
- `Write`: Create documents and outputs
- `Edit`: Modify existing files
- `MultiEdit`: Make multiple edits to same file

### System Operations
- `Bash`: Execute git commands and system operations
- `WebSearch`: Research without API limits
- `WebFetch`: Get specific web page content

## Image Capture Best Practices
See "image-capture-optimization" instruction for the 3-tier strategy:
1. Direct URL extraction (fastest)
2. Gallery navigation
3. Screenshot fallback (last resort)

## Chrome Automation Tips
- Always verify elements exist before clicking
- Use specific selectors over generic ones
- Add waits for dynamic content
- Capture URLs instead of screenshots when possible',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'tool-reference';

-- 4. Update trip_discovery to reference interview mode and next steps
UPDATE instruction_sets 
SET content = '# Comprehensive Trip Discovery

## Quick Start Option
For a guided interview experience, load the "client-interview-mode" instruction for a conversational, one-question-at-a-time approach.

## Information Gathering Phase:
1. **Client Profile**
   - Travel experience level
   - Budget range (get specific number)
   - Group composition (ages, relationships)
   - Special needs/preferences

2. **Trip Logistics**
   - Destination (primary + alternatives)
   - Travel dates (flexible vs fixed)
   - Duration (minimum/maximum)
   - Departure location

3. **Experience Preferences**
   - Travel style (luxury, adventure, cultural, relaxation)
   - Accommodation preferences
   - Activity interests
   - Dining preferences

## Discovery Techniques:
- **Open-ended questions**: "Tell me about your dream trip..."
- **Specific probes**: "What''s most important - saving money or unique experiences?"
- **Trade-off scenarios**: "Would you prefer 7 days luxury or 10 days mid-range?"

## Red Flags to Address:
- Unrealistic budget expectations
- Unclear decision-making authority
- Conflicting group preferences
- Inflexible requirements

## Next Steps After Discovery:
- When ready to search hotels → retrieve "cpmaxx-search" instruction
- When planning daily activities → retrieve "daily-planning" instruction
- For activity ideas → retrieve "kims-gems-daily" instruction
- For tour options → retrieve "viator-integration" instruction

## Output: Complete Client Profile
Document all findings in trip_notes JSON for proposal development. Note commission opportunities as discovered.',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'trip_discovery';

-- 5. Update cpmaxx_search to include image capture workflow
UPDATE instruction_sets 
SET content = '# CPMaxx Hotel Search Process

## Pre-Search Setup:
1. **Verify Requirements**
   - Destination city confirmed
   - Exact travel dates
   - Number of travelers (adults/children)
   - Budget tier determined

2. **Browser Navigation**
   - Use `chrome_navigate` to CPMaxx portal
   - Ensure logged in to agent account
   - Select appropriate vacation package type

## Search Execution:
1. **Form Completion**
   - Departure airport
   - Destination
   - Travel dates
   - Passenger details
   - Room requirements

2. **Results Capture**
   - Use `chrome_get_web_content` for result parsing
   - Apply 3-tier image capture strategy:
     - Extract image URLs from HTML (fastest)
     - Navigate galleries if needed
     - Screenshot only as fallback
   - Focus on hotels matching budget tier

## Data Extraction:
- Hotel names and star ratings
- Nightly rates and total costs
- Amenities and location details
- Availability confirmation
- Cancellation policies
- Commission rates (note internally)

## Image Capture Workflow:
1. **Tier 1**: Extract URLs from hotel cards
   - Look for data-src, data-image attributes
   - Parse srcset for high-res versions
2. **Tier 2**: Click into hotel details if needed
   - Navigate photo galleries
   - Extract each image URL
3. **Tier 3**: Screenshot specific hotels only if URLs unavailable

## Quality Control:
- Verify pricing accuracy
- Confirm availability dates
- Check for hidden fees
- Validate cancellation terms
- Calculate commission potential

## Storage:
Store all results in trip_notes JSON with:
- Hotel comparison matrix
- Image gallery references
- Commission calculations
- Booking deadlines',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'cpmaxx_search';

-- 6. Update three-tier-pricing to include commission optimization notes
UPDATE instruction_sets 
SET content = '# Three-Tier Proposal System

## Tier Structure (Discover/Elevate/Transcend):

### Discover (Budget Anchor): 75% of stated budget
- **Purpose**: Make other tiers attractive, anchor low expectations
- **Components**: Economy flights, 3-star hotels, public transport, self-guided activities
- **Revenue**: Hotel commissions (8-12%) + service markup (10-15%) = **18-27% total margin**

### Elevate (Target Tier): 110% of stated budget  
- **Purpose**: Highest profitability, most selections (target 60-70% selection rate)
- **Components**: Premium economy/business flights, 4-star boutique hotels, private transfers for key segments, guided experiences  
- **Revenue**: Hotel commissions (10-15%) + service markup (25-35%) = **35-50% total margin**
- **Commission Note**: This tier typically generates the optimal net commission due to balanced pricing and higher commission rates

### Transcend (Premium): 175% of stated budget
- **Purpose**: Justify middle tier, capture high-spenders
- **Components**: Business/first class flights, 5-star luxury, private transport, VIP experiences
- **Revenue**: Hotel commissions (12-15%) + service markup (20-30%) = **32-45% total margin**

## Proposal Structure:
1. **Executive Summary**: "Three ways to experience [destination]"
2. **Side-by-Side Comparison**: Clear feature matrix
3. **Detailed Itineraries**: Day-by-day for each tier
4. **Investment Summary**: Total pricing, payment options
5. **Urgency Elements**: Booking deadlines, availability pressure

## Commission Optimization:
- Present Elevate tier most attractively (highest net commission)
- Include Viator tours in all tiers (8% commission)
- Add travel insurance to all options (30-40% commission)
- Consider service fees if commission targets not met

## Critical Notes:
- **Service markups are NEVER disclosed** in client documents
- Use "investment" not "cost" in communications
- Frame as "experience levels" not "budget options"
- Track expected commission for each tier internally',
updated_at = CURRENT_TIMESTAMP
WHERE name = 'three-tier-pricing';