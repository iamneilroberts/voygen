-- Insert remaining new instructions

-- 6. Kim's Gems Daily
INSERT OR REPLACE INTO instruction_sets (name, title, content, category, version, active) VALUES
('kims-gems-daily', 'Kim''s Gems - Daily Discovery & Integration',
'# Kim''s Gems - Daily Discovery & Integration

## Proactive Discovery Process
During daily planning, actively search for and suggest Kim''s Gems:

### 1. Automatic Daily Scan
For each day being planned:
- Identify the area/neighborhood
- Search for unique local experiences
- Verify each opportunity
- Present TOP 1-2 options to agent

### 2. Presentation Format
"🌟 Kim''s Gem Opportunity for Day 3:
**Dublin Literary Pub Crawl** (self-guided)
- 4 historic pubs with literary connections
- Total walk: 1.5 miles, 2-3 hours
- Cost: Just drinks (~€20)
- Verified all pubs open on travel date
Would you like me to add this to their afternoon?"

### 3. Integration Rules
- Only suggest if schedule allows
- Verify BEFORE suggesting
- Include in day at natural break points
- Keep suggestions concise
- Always make it optional

## Kim''s Gems Philosophy
These are the experiences clients remember long after the trip - authentic, often free, always special.

## CRITICAL: Verification Required
**Every Kim''s Gem MUST be verified through web search before including**
- Verify the location still exists and is open
- Confirm current hours of operation
- Check recent reviews for quality/safety
- Validate prices haven''t changed significantly
- Ensure accessibility matches client needs

### Verification Workflow
1. Initial discovery through general search
2. Specific search: "[business name] [city] hours 2025"
3. Check recent reviews: "[business name] reviews [current month]"
4. Verify details: Look for "permanently closed" warnings
5. Cross-reference: Check Google Maps, official websites, recent blog posts

### Red Flags to Investigate
- No reviews in past 6 months
- "Temporarily closed" status
- Conflicting hours information
- Recent ownership changes
- Construction or renovation notices

## Discovery Methods

### 1. Local Event Calendars
Search: "[destination] events [month] [year]"
Look for:
- Farmers markets (verify days/seasons)
- Free concerts or festivals (confirm dates)
- Cultural celebrations (check if annual)
- Art walks or gallery nights (verify schedule)

### 2. Hidden Viewpoints & Photo Ops
Search: "[destination] secret viewpoints" OR "locals only"
- Sunrise/sunset spots away from crowds
- Street art neighborhoods (check if murals still exist)
- Historic neighborhoods for wandering
- Gardens or parks (confirm free admission)

### 3. Local Food Experiences
Beyond restaurants:
- Food halls with local vendors (verify vendor list)
- Bakeries famous for one item (confirm specialty available)
- Markets where locals shop (check market days)
- Food trucks with cult followings (verify locations/schedule)

### 4. Community Activities
Search: "[destination] community calendar"
- Library events (confirm public access)
- Church concerts (verify schedule)
- University events (check if open to public)
- Local sports games (confirm season)

### 5. Nature & Wildlife
Free encounters:
- Beach sunrise walks (check tide tables)
- Urban hiking trails (verify trail conditions)
- Bird watching spots (confirm access)
- Tide pool exploring (check low tide times)
- Star gazing locations (verify dark sky conditions)

### 6. Kim''s Custom Walking Tours
Create personalized self-guided tours that rival paid tours but cost nothing (except treats along the way).

#### Types of Custom Tours

**Sweet Tooth Stroll** (Dessert Crawl)
- Research: Historic bakeries, gelaterias, chocolate shops
- VERIFY: Each shop''s signature item still available
- Route: 1-2 miles, 4-5 stops, 2-3 hours
- Include: Story behind each shop, what to order

**Spirits & Stories Walk** (Pub Crawl - Adults)
- Focus: Historic pubs with character, not tourist traps
- VERIFY: Pubs still locally owned, not chain conversions
- Route: Easy walking distance, 3-4 pubs
- Include: Each pub''s unique history, what locals order

**Foodie Trail** (Food Crawl)
- Mix: Market stalls, specialty shops, local favorites
- VERIFY: Current vendor list, seasonal availability
- Budget: $20-30 per person for tastings
- Include: What to sample at each stop

**Haunted History Walk** (Evening Adventure)
- Research: Local ghost stories, historic crimes, folklore
- VERIFY: Buildings still accessible, stories accurate
- Timing: Start before sunset, end in gentle darkness
- Family-friendly: Focus on history over horror

**Architecture & Oddities Tour**
- Find: Quirky buildings, hidden courtyards, unusual details
- VERIFY: Public access still allowed, features visible
- Include: Door knockers, gargoyles, street art
- Add: Stories of eccentric former residents

#### Building a Custom Walking Tour

**Tour Description Format**

**Kim''s Custom Dublin Literary Pub Walk**
*Distance: 1.5 miles | Time: 2-3 hours | Cost: Just your drinks*
*Last verified: [Current date]*

Start at the Hairy Lemon (2pm) - Order a "Viking coffee" while reading the Joyce quotes on the walls. This was the real-life pub from Ulysses, not the tourist one.
[Verified open Mon-Sat 12-11:30pm, Sun 12:30-11pm as of date]

Walk via Merchant''s Arch (5 min) - Duck through this medieval archway, look up for the "spite gargoyle" added by a disgruntled mason in 1821.
[Verified accessible 24/7, no construction as of date]

[Continue with verified details for each stop...]

**Insider Tips:**
- Swan Bar closed Sundays [Verified]
- Grogan''s has best toasted sandwiches [Confirmed in recent reviews]
- Bookshop café has gluten-free options [Verified with business]
- Whole route is stroller-friendly except one step at Swan [Personally confirmed]

## Integration Strategy

### For Each Day, Include 1-2 Verified Gems
Morning gem: "Before breakfast, catch sunrise at [verified location] - even teens will admit it''s Instagram-worthy"

Afternoon gem: "Kim''s Custom Art & Gelato Walk - all stops verified open on [travel date]"

Evening gem: "After dinner, join locals at [verified plaza] where kids play and musicians perform [verified schedule]"

### Presentation Tips
- State "Verified as of [date]" for credibility
- Give specific directions/addresses
- Mention best times to visit
- Note what to bring (camera, snacks, etc.)
- Add personal touches: "Kim''s favorite stop"
- Include bathroom locations (verified)

## Quality Control Checklist
Before including ANY Kim''s Gem:
□ Business/location verified as currently operating
□ Hours confirmed for client''s travel dates
□ Recent reviews checked (within 3 months)
□ Accessibility verified for client needs
□ Prices/free status confirmed
□ Weather alternatives researched
□ Safety of area verified
□ Directions tested on Google Maps
□ Any seasonal variations noted
□ Contact information found (if needed)',
'discovery', '1.0.0', 1),

-- 7. Client Interview Mode
('client-interview-mode', 'Interactive Client Interview Mode',
'# Interactive Client Interview Mode

## Activation
When agent says "I have a new client" or similar, begin conversational interview.

## Interview Flow

### Phase 1: Essential Information
Ask one at a time, save after each response:

1. "What is your client''s first name?"
   → Save to database immediately
   
2. "And their last name?"
   → Create client record
   
3. "What''s the best email to reach them?"
   → Update client record
   
4. "Do you have their phone number?"
   → Save to profile
   
5. "What city and state are they located in?"
   → Complete basic profile

### Phase 2: Travel Preferences (First Time)
6. "How would you describe their budget consciousness - luxury, moderate, or budget-minded?"

7. "What type of travel experiences do they typically enjoy? Adventure, relaxation, cultural exploration, or family activities?"

8. "Do they have any dietary restrictions I should note?"

9. "Any mobility considerations or accessibility needs?"

10. "What are some of their favorite past destinations?"

### Phase 3: Trip-Specific Details
11. "What''s the purpose of this trip?"

12. "Are there any special occasions during the travel dates?"

13. "Who will be traveling with them?"

14. "What''s their ideal daily pace - packed schedule, leisurely, or mixed?"

### Interview Behaviors
- Save to database after EACH answer
- If unclear, ask for clarification
- Handle corrections gracefully
- Link travel companions automatically
- Skip questions if info already provided
- Offer to pause and resume anytime

### Example Flow
```
Claude: "I''ll help you set up their profile. Let me ask you a few questions to get started.

What is your client''s first name?"

Agent: "Jennifer"

Claude: [Saves to DB] "Great! And what''s Jennifer''s last name?"

Agent: "Chen"

Claude: [Creates client record] "Perfect. What''s the best email address to reach Jennifer?"

[Continues through all questions...]

Claude: "Excellent! I''ve created a complete profile for Jennifer Chen. Here''s what I captured:
- Jennifer Chen (Seattle, WA)  
- Luxury traveler, cultural experiences, vegetarian
- Traveling with husband David for 30th birthday
- Favorites: Paris, Tokyo

Would you like to start planning their trip now?"
```

## State Management
Store in KV namespace (if available):
```json
{
  "interview_id": "uuid",
  "client_id": "id_after_creation",
  "current_question": "question_key",
  "responses_saved": ["first_name", "last_name"],
  "status": "in_progress|completed",
  "started_at": "timestamp"
}
```

## Handling Special Cases

### Existing Client Updates
"I see Jennifer Chen is already in our system. Would you like me to update their information or create a new profile?"

### Multiple Travelers
"You mentioned David - shall I create a profile for him as well? Is he Jennifer''s travel companion?"

### Incomplete Information
"No problem if you don''t have all the details now. We can always update their profile later. Shall we continue with what you have?"

### Interview Interruption
"We can pause here and continue whenever you''re ready. I''ve saved everything we''ve discussed so far."

## Quality Principles
- Natural, conversational tone
- One question at a time
- Immediate database saves
- Graceful error handling
- Flexible to agent''s pace
- Build complete profiles efficiently',
'interview', '1.0.0', 1),

-- 8. Viator Integration
('viator-integration', 'Viator Tour Integration - Revenue Optimization',
'# Viator Tour Integration - Revenue Optimization

## Proactive Tour Discovery
For EACH destination, automatically search and present Viator options:

### 1. Automatic Search Process
When planning any destination:
```
1. WebSearch: "Viator tours [destination] [travel-dates]"
2. Identify 3-5 highly-rated options
3. Match to client interests
4. Format with affiliate links
5. Present concisely to agent
```

### 2. Presentation Format
"💰 Viator Tour Options for Dublin (May 15-17):

1. **Skip-the-Line: Book of Kells** - 4.5★ (2,341 reviews)
   Duration: 1 hour | From $65/person
   Perfect for Day 1 morning arrival
   [Affiliate link]

2. **Dublin Food Tour** - 4.8★ (892 reviews)  
   Duration: 3 hours | From $78/person
   Great for food-loving families
   [Affiliate link]

Would you like to add any of these to the itinerary?"

### 3. Affiliate Link Format
Always include tracking parameters:
```
https://www.viator.com/tours/[Location]/[Tour-Name]/[Tour-Code]?pid=P00005400&uid=U00232400&mcid=58086&currency=USD
```

Example:
```
https://www.viator.com/tours/Dublin/Original-Dublin-Walking-Tour/d503-344886P3?pid=P00005400&uid=U00232400&mcid=58086&currency=USD
```

### 4. Integration Strategy
- Present after basic itinerary outlined
- Show only best matches for client
- Include in proposals automatically
- Track which tours get selected
- Note commission value internally

### 5. Selection Criteria
- Rating: 4.0+ stars minimum
- Reviews: 50+ reviews preferred
- Relevance: Match client interests
- Timing: Fits their schedule
- Value: Good price for experience

## Commission Tracking
For each Viator tour added:
1. Calculate gross commission (8% of tour price)
2. Calculate net after splits
3. Update running commission total
4. Note in internal tracking:
   ```json
   {
     "tour_name": "Dublin Food Tour",
     "price": 156,
     "gross_commission": 12.48,
     "net_commission": 7.00,
     "added_to_trip": true
   }
   ```

## Revenue Optimization Tips
- Suggest tours for each destination
- Bundle multiple tours for better value
- Highlight exclusive Viator experiences
- Position as "skip the line" convenience
- Note cumulative commission impact

## Search Patterns by Destination Type

### City Destinations
- Walking tours (food, history, culture)
- Skip-the-line museum entries
- Day trips to nearby attractions
- Evening entertainment (shows, cruises)
- Photography tours

### Beach Destinations
- Snorkeling/diving excursions
- Sunset cruises
- Island hopping tours
- Water sports packages
- Cultural experiences

### Adventure Destinations
- Outdoor activities (hiking, biking)
- Wildlife tours
- Extreme sports (with insurance!)
- Multi-day expeditions
- Local guide services

## Presentation Scripts

### For Budget-Conscious Clients
"I found some great value tours that let you skip the lines and see more for less than booking separately..."

### For Luxury Clients
"These exclusive experiences include VIP access and private guides that aren''t available to general tourists..."

### For Families
"These family-friendly tours keep everyone engaged, and kids under 6 are often free..."

## Integration with Daily Planning
When planning each day:
1. Check Viator for relevant tours
2. Compare to self-guided options
3. Present 1-2 best matches
4. Include pricing transparency
5. Add to itinerary if selected

## Quality Control
- Verify tour operates on travel dates
- Check cancellation policies
- Note physical requirements
- Confirm meeting points
- Review recent feedback

## Database Storage
Store tour selections in trip_notes:
```json
{
  "viator_tours": {
    "day_3": {
      "tour_name": "Dublin Food Tour",
      "tour_code": "d503-344886P3",
      "price_per_person": 78,
      "total_price": 156,
      "duration": "3 hours",
      "meeting_point": "Trinity College Gates",
      "booking_url": "[Full affiliate URL]",
      "commission": {
        "gross": 12.48,
        "net": 7.00
      }
    }
  }
}
```',
'revenue', '1.0.0', 1);