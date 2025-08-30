-- Complete instruction data migration
-- Date: 2025-07-28

INSERT OR REPLACE INTO instruction_sets (name, title, content, category, active, version, created_at, updated_at) VALUES

('three-tier-pricing', 'Three-Tier Pricing Strategy', '# Three-Tier Proposal System

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
- Track expected commission for each tier internally', 'pricing', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('image-capture-optimization', 'Optimized Image Capture Strategy', '# Optimized Image Capture Strategy

## Three-Tier Approach (Fastest to Slowest)

### Tier 1: Direct URL Extraction (1-3 seconds per image)
**When to use**: ALWAYS try this first for any website

**Method**:
1. Use `chrome_get_web_content` to get HTML
2. Parse img tags and extract src URLs
3. Filter for high-quality images (width > 600px)
4. Store URLs directly without downloading

**Example for CPMaxx/Delta Vacations**:
```javascript
// Look for patterns like:
<img src="https://cdn.deltavacations.com/hotels/[id]/main.jpg" 
     data-gallery="https://cdn.deltavacations.com/hotels/[id]/gallery/"
     alt="Hotel Name">
```

### Tier 2: Gallery Navigation (5-10 seconds per hotel)
**When to use**: If direct URLs aren''t accessible or need more images

**Method**:
1. Click "View Photos" or gallery link
2. Wait for modal/gallery to load
3. Extract all image URLs from the gallery
4. Close gallery and continue

**Key selectors**:
- CPMaxx: `.hotel-gallery`, `[data-photos]`
- Generic: `[class*="gallery"]`, `[class*="photos"]`

### Tier 3: Screenshot Fallback (15-30 seconds per image)
**When to use**: Only as last resort when URLs can''t be extracted

**Method**:
1. Navigate to full-size image
2. Take screenshot with optimized settings:
   - Width: 1200px max
   - Height: 800px max  
   - Format: JPEG
   - Quality: 80%
3. Store with local_upload_image

## Best Practices

### Performance Optimization:
- Batch URL extraction before any navigation
- Process hotels in groups of 5-10
- Use Promise.all() for parallel processing
- Cache extracted URLs for session

### Quality Filters:
- Minimum width: 600px
- Preferred width: 1200-1920px
- Aspect ratio: Between 3:2 and 16:9
- File size: Under 2MB preferred

### Error Handling:
- If gallery won''t open: Skip to next hotel
- If images won''t load: Try alternative selectors
- If page times out: Move to next item
- Log all failures for pattern analysis

## Implementation Example:

```typescript
async function captureHotelImages(hotelElement) {
  // Tier 1: Try direct extraction
  const urls = await extractImageUrls(hotelElement);
  if (urls.length >= 3) return urls;
  
  // Tier 2: Try gallery
  const galleryUrls = await navigateGallery(hotelElement);
  if (galleryUrls.length > 0) return galleryUrls;
  
  // Tier 3: Screenshot fallback
  return await captureScreenshots(hotelElement);
}
```

## Expected Performance:
- **Tier 1**: 50-100 images per minute
- **Tier 2**: 6-12 hotels per minute  
- **Tier 3**: 2-4 images per minute

Always measure and prefer the fastest tier that works!', 'tools', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('daily-trip-verification', 'Daily Trip Verification Process', '# Daily Trip Verification Process

## Purpose
Proactively verify all trip components exist and are bookable BEFORE the client sees them. This prevents embarrassment and maintains professionalism.

## When to Run
- **Automatically**: After planning each trip day
- **Manually**: Before sending any proposal
- **Periodically**: Weekly for trips > 30 days out

## Verification Checklist

### 1. Accommodations
For each hotel/accommodation:
- ✓ Property still exists (not closed/renamed)
- ✓ Available for the dates
- ✓ Room types match proposal
- ✓ Rates are current (within 20% of quote)
- ✓ Contact information is valid

**How to verify**:
1. Search hotel name + city + "closed" or "permanently closed"
2. Check hotel''s official website
3. Search recent reviews (last 3 months)
4. Verify on booking sites

### 2. Restaurants
For each dining recommendation:
- ✓ Restaurant is still open
- ✓ Hours of operation current
- ✓ Menu type unchanged
- ✓ Price range accurate
- ✓ Reservation availability

**How to verify**:
1. Search restaurant name + "closed" + city
2. Check Google Maps for "Permanently closed" label
3. Look for recent reviews (last month)
4. Check their social media for recent posts

### 3. Activities & Tours
For each activity:
- ✓ Tour operator still active
- ✓ Specific tour/activity offered
- ✓ Available on proposed dates
- ✓ Age/physical requirements met
- ✓ Weather-appropriate timing

**How to verify**:
1. Check operator''s website
2. Search for recent reviews
3. Verify seasonal availability
4. Confirm pickup locations

### 4. Transportation
For each transfer/transport:
- ✓ Route is operational
- ✓ Service runs on proposed days
- ✓ Timing allows connections
- ✓ Pickup/drop-off points confirmed

## Verification Process

### Quick Verification (5-10 minutes per day):
```
For each trip day:
1. Open TripDay details
2. Run web searches for each component
3. Log any issues found
4. Update database with verified status
```

### Deep Verification (20-30 minutes per day):
```
1. Check each component''s official website
2. Read recent reviews (last 3 months)
3. Verify pricing is current
4. Confirm availability
5. Update all contact information
```

## Issue Resolution

### If a venue is closed:
1. Find similar alternative (same area, price, style)
2. Update trip itinerary
3. Note change in trip_notes
4. Re-calculate any commission impact

### If prices have changed significantly (>20%):
1. Update pricing in database
2. Recalculate tier pricing
3. Note in verification log
4. Consider alternatives if needed

### If availability is limited:
1. Note peak times/seasons
2. Add booking urgency notes
3. Consider alternatives
4. Update proposal with warnings

## Verification Logging

Create verification log entry:
```sql
INSERT INTO VerificationLog (
  entity_type,
  entity_name,
  verification_status,
  verification_method,
  verification_notes,
  trip_id
) VALUES (?, ?, ?, ?, ?, ?);
```

## Red Flags Requiring Immediate Action
- "Permanently closed" on Google
- No reviews in last 6 months
- Website domain expired
- Phone disconnected
- Multiple recent bad reviews mentioning closure
- "Temporarily closed" > 3 months

## Tools to Use
- `WebSearch`: "[venue name] [city] closed"
- `WebFetch`: Check official websites
- `chrome_navigate`: Visual verification
- `update_trip_activity`: Update verified items
- `log_verification`: Track what was checked

## Success Metrics
- 100% of components verified before proposal
- Zero client-discovered closures
- All alternatives ready if needed
- Verification completed within 24h of planning', 'workflows', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('trip-completeness-check', 'Trip Completeness & Commission Check', '# Trip Completeness & Commission Check

## When to Run
Execute this check when:
- User says "trip is complete" or "we''re done planning"
- Before generating final documents
- After client indicates they''re ready to book
- As part of trip finalization workflow

## Comprehensive Checklist

### 1. Trip Structure Completeness
- [ ] All trip days have activities planned
- [ ] Each day has accommodation assigned
- [ ] Transportation between all locations confirmed
- [ ] No gaps in the itinerary
- [ ] Special requests addressed

### 2. Data Completeness
For each component, verify:
- [ ] Accurate pricing recorded
- [ ] Contact information saved
- [ ] Operating hours noted
- [ ] Confirmation/booking references
- [ ] Cancellation policies documented

### 3. Documentation Status
- [ ] Trip proposal generated
- [ ] Detailed itinerary created
- [ ] Travel guide drafted
- [ ] All documents in Documents table
- [ ] GitHub publishing ready

### 4. Commission Analysis

#### Calculate Expected Commission:
```sql
-- Hotels/Accommodations
SELECT SUM(total_cost * 0.15) as hotel_commission
FROM Accommodations WHERE trip_id = ?;

-- Tours/Activities (Viator)
SELECT SUM(price * 0.08) as tour_commission  
FROM TourBookings WHERE trip_id = ?;

-- Estimated Insurance
SELECT (total_cost * 0.03 * 0.35) as insurance_commission
FROM Trips WHERE trip_id = ?;
```

#### Commission Targets:
- **Hotel**: $2,400 minimum
- **Tours**: $800 minimum  
- **Insurance**: $200 minimum
- **Total Target**: $3,400 per trip

#### Commission Optimization Check:
1. Calculate total expected commission
2. Compare against targets
3. If below 80% of target:
   - Identify gaps (missing tours? low hotel rates?)
   - Suggest specific additions
   - Calculate service fee needed

### 5. Revenue Optimization Opportunities

Check for missing revenue sources:
- [ ] Viator tours included for each destination?
- [ ] Travel insurance quoted?
- [ ] Airport transfers bookable?
- [ ] Dining reservations commissionable?
- [ ] Spa/wellness services included?
- [ ] Car rental options presented?

### 6. Service Fee Calculation

If commission < target:
```
Gap = $3,400 - Total Commission
Suggested Service Fee = Greater of:
  - $350 (minimum)
  - Gap rounded up to nearest $50
```

## Output Format

```markdown
## Trip Completeness Report

### Structure: ✅ Complete
- 7 days planned with activities
- All accommodations confirmed
- Transportation arranged

### Documentation: ⚠️ In Progress  
- Proposal: ✓ Generated
- Itinerary: ✓ Generated
- Travel Guide: ⚡ Pending
- GitHub: ⚡ Not published

### Commission Analysis: ⚠️ Below Target

**Expected Commission:**
- Hotels: $1,850 (77% of target)
- Tours: $425 (53% of target)  
- Insurance: $0 (0% of target)
- **Total: $2,275 (67% of target)**

**Recommendations:**
1. Add 2-3 Viator tours ($400-600 commission)
2. Quote travel insurance ($180-220 commission)
3. Consider $350 planning service fee

**Final Revenue Potential: $3,100**
```

## Action Items After Check

If commission is below target:
1. Present additional tour options
2. Suggest travel insurance benefits
3. Propose service fee professionally:
   > "For this customized itinerary, we include a $350 professional planning fee"

If documentation incomplete:
1. Generate missing documents
2. Review all content for accuracy
3. Prepare for GitHub publishing

## Database Updates

Record completion check:
```sql
UPDATE Trips SET
  verification_status = ''complete'',
  expected_commission = ?,
  service_fee = ?,
  completion_notes = ?
WHERE trip_id = ?;
```

## Success Criteria
- All checklist items marked complete
- Commission at or above 80% of target
- All documents generated and reviewed
- Client ready to book with confidence', 'workflows', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('commission-targets', 'Commission Target Guidelines', '# Commission Target Guidelines

## Commission Structure Overview

### Split Agreement
- **Cruise Planners**: 30% of gross commission
- **SomoTravel**: 20% of gross commission  
- **Kim (Agent)**: 50% of gross commission

### Target Per Trip: $3,400 Gross Commission
This translates to $1,700 net for Kim per trip

## Commission Sources & Rates

### 1. Hotels/Accommodations (Target: $2,400)
- **Average rate**: 12-15% of booking total
- **Strategy**: Book 4-star properties through CPMaxx
- **Example**: $16,000 hotel spend = $2,400 commission

### 2. Tours & Activities (Target: $800)
- **Viator**: 8% commission
- **Private tours**: 10-15% commission
- **Strategy**: Include 2-3 tours per destination
- **Example**: $10,000 in tours = $800 commission

### 3. Travel Insurance (Target: $200)
- **Commission rate**: 30-40% of premium
- **Premium**: Typically 4-6% of trip cost
- **Example**: $20,000 trip × 5% × 40% = $400 commission

### 4. Additional Revenue Sources
- **Airport transfers**: 10-20% commission
- **Car rentals**: 5-10% commission
- **Cruise add-ons**: 10-16% commission
- **Dining reservations**: Varies by partnership

## Tracking Commission in Database

### During Planning:
```sql
-- Add to trip_notes or custom field
UPDATE Trips SET 
  expected_hotel_commission = ?,
  expected_tour_commission = ?,
  expected_insurance_commission = ?,
  total_expected_commission = ?
WHERE trip_id = ?;
```

### Commission Tracking Template:
```
## Commission Tracking - [Trip Name]

### Hotels
- Hyatt Regency: $8,000 × 15% = $1,200
- Fairmont: $6,000 × 14% = $840
- Subtotal: $2,040

### Tours/Activities  
- Viator City Tour: $400 × 8% = $32
- Private Wine Tour: $800 × 12% = $96
- Cooking Class: $600 × 10% = $60
- Subtotal: $188

### Insurance
- Premium: $1,000 × 35% = $350

### Total Expected: $2,578 (76% of target)
### Recommended Service Fee: $350
```

## When Commission Falls Short

### Threshold: Below 80% of $3,400 target ($2,720)

### Action Steps:
1. **Add High-Commission Items**:
   - Travel insurance (highest %)
   - Additional tours
   - Premium transfers
   - Spa/wellness packages

2. **Upgrade Accommodations**:
   - Move to higher category
   - Add room amenities
   - Extend stays

3. **Implement Service Fees**:
   - Planning fee: $350-500
   - Rush service: $150-250
   - Complex itinerary: $500+

## Service Fee Scripts

### Standard Planning Fee:
> "This customized itinerary includes our professional planning service fee of $350, ensuring personalized attention throughout your journey."

### Complex Itinerary Fee:
> "Due to the multi-destination complexity and extensive customization of this trip, we include a $500 professional service fee."

### Rush Service Fee:
> "To accommodate your expedited timeline, this booking includes a $250 rush service fee."

## Best Practices

### DO:
- Track commission on EVERY component
- Calculate totals before finalizing
- Present service fees confidently
- Focus on value, not cost
- Document all commission rates

### DON''T:
- Mention commission to clients
- Apologize for service fees
- Compromise on revenue targets
- Book non-commissionable options
- Forget insurance quotes

## Monthly Revenue Goals

Based on $1,700 net per trip:
- **2 trips/month**: $3,400
- **4 trips/month**: $6,800
- **6 trips/month**: $10,200

## Red Flags for Commission
- Client booking hotels directly
- "Friends & family" rates (0% commission)
- DIY tour bookings
- Declining insurance
- Airbnb/VRBO stays

When these occur, service fees become essential for profitability.', 'business', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('kims-gems-daily', 'Kim''s Gems - Daily Discovery Process', '# Kim''s Gems - Daily Discovery Process

## What Are Kim''s Gems?
Unique, authentic, often free or low-cost local experiences that create lasting memories. These are the "insider tips" that make Kim''s trips special.

## Daily Gem Discovery Process

### For Each Day of the Itinerary:

1. **Morning Gems** (Before 10 AM)
   - Local coffee shops where locals gather
   - Sunrise viewpoints
   - Morning markets
   - Early bird museum hours
   - Beach/park morning activities

2. **Afternoon Gems** (2-5 PM)
   - Hidden courtyards and gardens
   - Local artisan workshops
   - Quiet museum times
   - Scenic walking routes
   - Afternoon tea spots

3. **Evening Gems** (After 6 PM)
   - Sunset viewing locations
   - Local happy hour spots
   - Evening markets
   - Free concerts/events
   - Night photography spots

## Research Method

### Step 1: Location-Based Search
```
WebSearch: "[destination] hidden gems locals"
WebSearch: "[destination] free things to do"
WebSearch: "[destination] secret spots"
WebSearch: "[neighborhood] local favorites"
```

### Step 2: Time-Specific Search
```
WebSearch: "[destination] sunrise spots"
WebSearch: "[destination] sunset viewpoints"  
WebSearch: "[destination] morning markets"
WebSearch: "[destination] evening activities"
```

### Step 3: Verify & Validate
- Check recent reviews (last 6 months)
- Confirm still accessible
- Verify free/low-cost
- Check safety considerations
- Note insider tips

## Categories of Gems

### Cultural Gems
- Local festivals/events during stay
- Neighborhood walking tours
- Street art districts
- Cultural centers with free events
- Religious sites with ceremonies

### Nature Gems  
- Hidden beaches/coves
- Secret gardens
- Hiking trails with views
- Birdwatching spots
- Stargazing locations

### Food & Drink Gems
- Local market food tours
- Happy hour secrets
- Breakfast spots locals love
- Food truck locations
- Picnic spots with views

### Shopping Gems
- Artisan workshops
- Local craft markets
- Vintage/thrift districts
- Bookshops with character
- Gallery free days

### Experience Gems
- Free museum days/hours
- Public art installations
- Architecture walks
- Photography spots
- People-watching cafes

## Documentation Format

For each gem found:
```markdown
### 🌟 Kim''s Gem: [Name]
**When**: [Best time to visit]
**Where**: [Specific location/address]
**What**: [Brief description]
**Insider Tip**: [Special knowledge]
**Cost**: Free / Under $10 / Worth the splurge
**Time Needed**: 30 mins - 2 hours
```

## Integration into Itinerary

### Placement Strategy:
- **Don''t overschedule** - 1-2 gems per day max
- **Use as buffers** - Between major activities
- **Offer as options** - "If you have energy..."
- **Group by area** - Near other activities
- **Weather alternatives** - Indoor/outdoor options

### Presentation in Documents:
```markdown
**Day 3 - Afternoon Options**
After lunch, you might enjoy:
🌟 **Kim''s Gem**: The Secret Garden at Palazzo Grimani
- A hidden Renaissance garden that most tourists miss
- Enter through the unmarked door on Calle Grimani
- Free entry, but ring the bell for access
- Best light for photos around 3 PM
```

## Quality Criteria

A true Kim''s Gem must be:
- ✓ Not in mainstream guidebooks
- ✓ Authentic local experience
- ✓ Memorable and unique
- ✓ Accessible to clients
- ✓ Safe and appropriate
- ✓ Recently verified (< 6 months)

## Examples by Destination Type

### European Cities
- Neighborhood aperitivo spots
- Artisan workshop visits
- Hidden courtyard cafes
- Local market mornings
- Church concert schedules

### Beach Destinations  
- Sunrise yoga locations
- Local fisherman wharfs
- Hidden beach access
- Sunset gathering spots
- Beach bar happy hours

### Mountain/Nature
- Secret viewpoints
- Waterfall hikes
- Local guide connections
- Picnic provisions spots
- Star-gazing locations

## Pro Tips

1. **Ask Locals**: Hotel concierges often know gems
2. **Read Local Blogs**: Not travel blogs, local ones
3. **Check Event Calendars**: For temporary gems
4. **Verify Accessibility**: Consider client mobility
5. **Have Backups**: Weather/closure alternatives

## Tracking Gems

Store in database for reuse:
```sql
INSERT INTO HiddenGems (
  trip_id,
  day_id,
  title,
  description,
  location,
  best_time,
  insider_tips,
  cost_category
) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
```

Remember: Kim''s Gems are what transform a good trip into an unforgettable journey!', 'features', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('client-interview-mode', 'Client Interview Mode - Structured Discovery', '# Client Interview Mode - Structured Discovery

## Purpose
Guide clients through a conversational interview to gather all trip planning information systematically, one question at a time.

## Activation
Triggered when:
- New client without trip details
- User requests "/interview" mode
- Incomplete trip information detected
- Client seems overwhelmed by questions

## Interview Flow

### Phase 1: Introduction & Rapport
```
"Hi! I''m Kim''s assistant, and I''m excited to help plan your perfect trip! 
Let me ask you a few questions to understand exactly what you''re looking for.

First, who will be traveling? Just names are fine for now!"
```

### Phase 2: Core Information (One Question at a Time)

1. **Travelers**
   - "Who will be traveling?"
   - → Store in Clients table
   - → Create ClientGroup if multiple

2. **Destination Dreams**
   - "Where are you dreaming of going?"
   - → If uncertain: "Beach, mountains, cities, or adventure?"
   - → If multiple: "Which place excites you most?"

3. **Travel Dates**
   - "When would you like to travel?"
   - → If flexible: "What month works best?"
   - → If uncertain: "How many days do you have?"

4. **Budget Comfort**
   - "What budget feels comfortable for this trip?"
   - → If hesitant: "Think per person, including flights"
   - → Create 3-tier mental model immediately

5. **Travel Style**
   - "What''s your travel style: Relaxation, adventure, or cultural?"
   - → Multiple choice is fine
   - → Influences accommodation/activity selection

### Phase 3: Preference Discovery

6. **Accommodation Preferences**
   - "Hotels, resorts, or vacation rentals?"
   - → If hotels: "Boutique charm or brand consistency?"

7. **Activity Level**
   - "Packed schedule or plenty of free time?"
   - → Determines gems vs structured tours

8. **Special Interests**
   - "Any special interests? Food, history, art, nature?"
   - → Shapes Kim''s Gems selection

9. **Must-Haves**
   - "Anything that would make this trip perfect?"
   - → Capture in special_requests

10. **Deal Breakers**
    - "Anything you definitely want to avoid?"
    - → Note in preferences

### Phase 4: Logistics & Close

11. **Previous Trips**
    - "Where have you traveled recently that you loved?"
    - → Understand their standards

12. **Booking Timeline**
    - "When do you need to make a decision?"
    - → Set urgency appropriately

## Response Patterns

### Keep it Conversational:
- "Great choice! Italy is beautiful in October..."
- "I love that! Beach relaxation with some adventure..."
- "Perfect, I have some amazing ideas already..."

### Handle Uncertainty:
- "No worries! Let me help narrow it down..."
- "That''s totally fine! How about we start with..."
- "Many people feel that way! Would you prefer..."

### Build Excitement:
- "Oh, you''re going to love the hidden gems in..."
- "I''m already thinking of some incredible..."
- "This is going to be such a special trip..."

## Data Storage During Interview

After each answer, immediately store:
```sql
-- After getting names
INSERT INTO Clients (first_name, last_name) VALUES (?, ?);

-- After destination
UPDATE Trips SET destination = ? WHERE trip_id = ?;

-- After each preference
UPDATE Clients SET preferences = ? WHERE client_id = ?;
```

## Interview Completion

### Summary Confirmation:
```
"Perfect! Let me make sure I have everything:
- [Names] traveling to [destination]
- [Dates] for [duration] days
- Budget around $[amount] per person
- Looking for [style] with [interests]
- Must have [requirements]

Did I get everything right?"
```

### Next Steps:
```
"Wonderful! I''ll start researching options for you. 
I''ll create three different ways to experience [destination]:
- Discover: Great value, all the essentials
- Elevate: Our recommended sweet spot
- Transcend: The ultimate luxury experience

When would you like to review these options?"
```

## Interview Mode Best Practices

### DO:
- Ask ONE question at a time
- Acknowledge each answer
- Build on their responses
- Show enthusiasm
- Store data immediately

### DON''T:
- Ask multiple questions at once
- Use travel jargon
- Assume preferences
- Rush the process
- Skip validation

## Handling Special Cases

### Indecisive Clients:
- Offer multiple choice
- Provide examples
- Start with "typical" options
- Circle back later

### Experienced Travelers:
- "Feel free to share all your ideas!"
- Let them drive more
- Ask about past favorites
- Focus on preferences

### Budget-Sensitive:
- Frame as "investment"
- Focus on value
- Mention payment plans
- Don''t apologize for pricing

## Success Metrics
- All required fields captured
- Client engaged and excited
- Preferences clearly documented
- Next meeting scheduled
- Database fully updated

Remember: The interview is about building relationship AND gathering data!', 'workflows', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('viator-integration', 'Viator Tours Integration Guide', '# Viator Tours Integration Guide

## Overview
Viator tours provide 8% commission and enhance trip value. Integrate 2-3 tours per destination for optimal revenue.

## Research Process

### Step 1: Destination Search
```
WebSearch: "Viator tours [destination] best sellers"
WebSearch: "Viator [destination] top rated activities"
WebSearch: "[destination] must do tours Viator"
```

### Step 2: Tour Selection Criteria
- ⭐ 4.5+ rating with 50+ reviews
- 📅 Available on proposed dates
- 💰 Fits within tier budgets
- ⏱️ Duration fits itinerary
- 👥 Appropriate for group size
- 🎯 Matches client interests

### Step 3: Tour Categories by Trip Type

#### Beach/Resort Destinations
- Catamaran/sailing trips
- Snorkeling/diving tours
- Sunset cruises
- Island hopping
- Water sports packages

#### City Destinations
- Walking food tours
- Skip-the-line museum entries
- Night tours/pub crawls
- Day trips to nearby attractions
- Cooking classes

#### Adventure Destinations
- Zip-lining/canopy tours
- ATV/off-road experiences
- Wildlife encounters
- Hiking with guides
- Extreme sports

#### Cultural Destinations
- Local cultural experiences
- Artisan workshops
- Historical guided tours
- Traditional performances
- Market tours with locals

## Integration by Tier

### Discover Tier (Budget)
- 1-2 group tours
- Self-guided options
- Public transport tours
- Free walking tour upgrades

### Elevate Tier (Target) 
- 2-3 premium small group tours
- Some private options
- Unique experiences
- Food/wine focused

### Transcend Tier (Luxury)
- 3-4 private tours
- VIP experiences
- Helicopter/yacht options
- Exclusive access tours

## Presentation Format

### In Proposals:
```markdown
**Day 3: Tuscany Wine Experience**
🍷 Small-Group Tuscany Wine Tour (Elevate/Transcend)
- Visit 3 boutique wineries
- Traditional lunch included
- Expert sommelier guide
- Hotel pickup included
- 9:00 AM - 5:00 PM
- *Book through our Viator partnership for best rates*
```

### Key Phrases to Use:
- "Curated through our Viator partnership"
- "Exclusive access via our preferred rates"
- "Pre-screened for quality"
- "Commission helps offset planning costs"

## Commission Optimization

### High-Commission Tours:
- Multi-day tours: $1000+ = $80+ commission
- Premium experiences: $500+ = $40+ commission
- Group bookings: Multiple travelers = multiplied commission

### Commission Calculation:
```
Per Person Rate × Number of Travelers × 0.08 = Commission

Example:
$200 tour × 4 travelers × 0.08 = $64 commission
```

## Booking Process

### During Planning:
1. Research and note tour codes
2. Calculate commission potential
3. Add to appropriate trip days
4. Include in tier pricing

### After Client Approval:
1. Book through Viator partner portal
2. Confirm availability
3. Send confirmations
4. Track commission

## Quality Assurance

### Verify Before Recommending:
- Read recent reviews (last 3 months)
- Check cancellation policy
- Confirm pickup locations
- Verify inclusions
- Note physical requirements

### Red Flags to Avoid:
- ❌ New tours with <10 reviews
- ❌ Consistent complaints about guide
- ❌ Hidden fees mentioned
- ❌ Unreliable pickup times
- ❌ Physical requirements not met

## Database Storage

```sql
INSERT INTO TourBookings (
  trip_id,
  tour_id,
  day_id,
  viator_code,
  tour_name,
  price_per_person,
  total_price,
  commission_amount,
  booking_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
```

## Alternative Booking Scenarios

### If Viator Unavailable:
1. Check GetYourGuide (5-7% commission)
2. Direct tour operator booking
3. Hotel concierge booking
4. Local operator partnerships

### For Custom/Private Tours:
- Negotiate 10-15% commission directly
- Add service fee if needed
- Ensure clear cancellation terms

## Monthly Revenue Target

To hit $800/month in tour commissions:
- Option 1: 10 tours at $1,000 each
- Option 2: 20 tours at $500 each
- Option 3: 40 tours at $250 each

## Best Practices

### DO:
- Research thoroughly before suggesting
- Match tours to client interests
- Book early for better availability
- Track all commission opportunities
- Provide tour vouchers promptly

### DON''T:
- Overwhelm with too many tours
- Book without confirming dates
- Ignore physical limitations
- Forget to track commissions
- Promise unavailable tours

Remember: Tours enhance experience AND revenue!', 'integrations', 1, 1, '2025-07-28 05:15:14', '2025-07-28 06:42:38'),

('tool-reference', 'MCP Tools Quick Reference', '# MCP Tools Quick Reference

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
- `get_recent_activity`: View recent trips (days_back, limit)

#### Error Tracking:
- `log_database_error`: Log database issues for improvement

#### Instruction Management:
- `get_instruction`: Retrieve instruction by name
- `list_instructions`: Browse available instructions
- `search_instructions`: Search instruction content
- `update_instruction`: Modify existing instruction

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

### CPMaxx Portal (mcp-cpmaxx)
- `search_cpmaxx`: Search Delta Vacations
- `get_search_results`: Check search status
- `get_cpmaxx_results`: Retrieve search results
- `get_hotel_details`: Get detailed hotel information

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
- Capture URLs instead of screenshots when possible

## Database Quick Reference
- Main database: travel_assistant
- All tables in one place now
- Use get_recent_activity for quick startup
- Log errors with log_database_error', 'tools', 1, 2, '2025-07-28 05:15:14', '2025-07-28 14:00:00');