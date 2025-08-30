-- Seed data for prompt-instructions-d1-mcp
-- Insert key travel instructions into the database

-- Core mode instructions
INSERT OR REPLACE INTO instruction_sets (name, title, content, description, category, version, is_active) VALUES
('mobile-mode', 'Mobile/Autonomous Mode Instructions', 
'# Mobile Mode - Autonomous Lead Processing

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

## Response Format:
- End each response with: `[🤖 AUTONOMOUS]`', 'Instructions for autonomous mobile operation mode', 'modes', '1.0.0', 1),

('interactive-mode', 'Interactive/Desktop Mode Instructions',
'# Interactive Mode - Collaborative Planning

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

## Response Style:
- Present options clearly
- Ask "What would you like to do?" 
- Confirm before database changes
- Explain what each tool does

## Response Format:
- End each response with: `[💬 INTERACTIVE]`', 'Instructions for interactive desktop collaboration mode', 'modes', '1.0.0', 1),

('three-tier-pricing', 'Three-Tier Pricing Strategy',
'# Three-Tier Proposal System

## Tier Structure (Discover/Elevate/Transcend):

### Discover (Budget Anchor): 75% of stated budget
- **Purpose**: Make other tiers attractive, anchor low expectations
- **Components**: Economy flights, 3-star hotels, public transport, self-guided activities
- **Revenue**: Hotel commissions (8-12%) + service markup (10-15%) = **18-27% total margin**

### Elevate (Target Tier): 110% of stated budget  
- **Purpose**: Highest profitability, most selections (target 60-70% selection rate)
- **Components**: Premium economy/business flights, 4-star boutique hotels, private transfers for key segments, guided experiences  
- **Revenue**: Hotel commissions (10-15%) + service markup (25-35%) = **35-50% total margin**

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

## Critical Notes:
- **Service markups are NEVER disclosed** in client documents
- Use "investment" not "cost" in communications
- Frame as "experience levels" not "budget options"', 'Three-tier pricing strategy and revenue optimization guide', 'pricing', '1.0.0', 1),

('tool-reference', 'MCP Tools Quick Reference',
'# MCP Tools Quick Reference

## Core MCP Servers

### Database (d1-database)
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
- `chrome_screenshot`: Capture page screenshots
- `chrome_get_web_content`: Extract page content
- `chrome_click_element`: Click on page elements
- `chrome_fill_or_select`: Fill forms

### Image Storage (local-image-storage)
- `local_upload_image`: Store images with metadata and trip organization
- `local_create_gallery`: Generate interactive image selection galleries
- `local_get_selections`: Retrieve user gallery selections

## Built-in Claude Tools

### File Management
- `Read`: Read files and templates
- `Write`: Create documents and outputs
- `Edit`: Modify existing files

### System Operations
- `Bash`: Execute git commands and system operations
- `WebSearch`: Research without API limits
- `WebFetch`: Get specific web page content', 'Quick reference for all available MCP tools', 'tools', '1.0.0', 1),

('trip_discovery', 'Trip Discovery Process',
'# Comprehensive Trip Discovery

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

## Output: Complete Client Profile
Document all findings in trip_notes JSON for proposal development.', 'Comprehensive trip discovery and information gathering process', 'planning', '1.0.0', 1),

('cpmaxx_search', 'CPMaxx Search Workflow',
'# CPMaxx Hotel Search Process

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
   - Use `chrome_screenshot` for result overview
   - `chrome_get_web_content` for detailed parsing
   - Focus on hotels matching budget tier

## Data Extraction:
- Hotel names and star ratings
- Nightly rates and total costs
- Amenities and location details
- Availability confirmation
- Cancellation policies

## Quality Control:
- Verify pricing accuracy
- Confirm availability dates
- Check for hidden fees
- Validate cancellation terms

## Storage:
Store all results in trip_notes JSON with hotel comparison matrix.', 'CPMaxx portal search workflow and data extraction guide', 'search_workflows', '1.0.0', 1);