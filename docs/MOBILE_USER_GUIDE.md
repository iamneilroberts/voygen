# Voygen Mobile User Guide

## Getting Started

### 1. Access the Mobile Interface
**URL**: https://voygen-mobile-api.somotravel.workers.dev/chat

1. Open the URL on your phone or tablet
2. Enter your API token: `dev-secret`
3. Tap **"Connect to Voygen"**

### 2. First Time Setup
- The interface loads automatically after authentication
- You'll see a welcome message with suggested prompts
- Quick action buttons are available at the bottom

### 3. Interface Overview
- **Header**: Shows connection status and Voygen branding
- **Chat Area**: Conversation history with AI responses
- **Quick Actions**: Common task buttons (Show Trips, New Trip, Continue, Publish)
- **Input Area**: Type or dictate messages to the AI
- **Send Button**: Tap to send your message

## How to Use

### Natural Language Commands

The AI understands natural language - talk to it like you would a colleague:

#### ✅ **Good Examples**
```
"Show me all my trips"
"Find trips for John Smith"  
"What's the status of the Paris booking?"
"Create a trip for Sarah Jones to London from June 1-10"
"Continue working on the Barcelona trip"
"Publish the latest proposal"
"Help me plan a family vacation to Italy"
```

#### ❌ **Less Effective**
```
"GET /trips" (too technical)
"List all" (too vague)  
"Do something" (no specific request)
```

### Trip Management

#### **View Trips**
```
"Show me all my trips"
"What trips do I have this month?"  
"Find trips for [client name]"
"Show me pending bookings"
```

**Response Format:**
- Trip name and ID
- Destinations and dates  
- Current status
- Cost information
- Quick action suggestions

#### **Trip Details**
```
"Tell me about trip 123"
"Show details for the Paris trip"
"What's the status of [trip name]?"
```

**Response Includes:**
- Complete trip information
- Client details
- Booking status
- Financial summary
- Recent activity

#### **Create New Trips**
```
"Create a trip for [Client Name] ([email]) to [Destination] from [Date] to [Date] called [Trip Name]"

Examples:
"Create a trip for John Smith (john@email.com) to Paris from June 1-10 called Paris Getaway"
"Add a new London trip for Sarah and Michael from July 15-25"
"Set up a booking for the Johnson family to Italy in August"
```

**AI Will Create:**
- New trip record
- Client profile (if new)
- Basic itinerary structure
- Confirmation with trip ID

#### **Continue Work**
```
"Continue working on [trip name]"
"Resume the Paris booking"
"What was I working on last?"
"Continue my last trip"
```

**AI Will:**
- Load trip context
- Show workflow status
- Suggest next steps
- Resume where you left off

### Publishing & Proposals

#### **Generate Proposals**
```
"Publish the [trip name] proposal"
"Create proposal for trip 123"  
"Generate and publish the Paris booking"
"Make the London trip proposal live"
```

**AI Will:**
- Generate HTML proposal
- Publish to somotravel.us
- Update dashboard
- Provide public URL

#### **Check Publication Status**
```
"Is the Paris trip published?"
"Show me published proposals"
"What's the status of trip 123?"
```

### Quick Actions

Use the buttons at the bottom for instant actions:

- **📋 Show Trips**: Lists all your current trips
- **➕ New Trip**: Starts trip creation process  
- **▶️ Continue**: Resumes work on recent trip
- **🚀 Publish**: Publishes your latest proposal

### Advanced Features

#### **Search & Filter**
```
"Show me confirmed trips"
"Find trips to Europe"
"What trips are over $5000?"
"Show me trips starting next month"
"Find all bookings for [client email]"
```

#### **Workflow Management**
```
"What's my workflow status?"
"Move the Paris trip to confirmed"
"Update trip 123 status to in progress"
"What phase is the London booking in?"
```

#### **Client Management**
```
"Show me all clients"
"Find client [email address]"
"What trips does John Smith have?"
"Add notes to client [name]"
```

## Mobile Tips

### **Typing vs Voice**
- **Type** for specific details, dates, emails
- **Voice** (if available) for quick questions
- Use **Quick Actions** for common tasks

### **Context Awareness**
The AI remembers your conversation:
```
You: "Show me trips to Paris"
AI: [Shows Paris trips]
You: "Publish the first one"  
AI: [Publishes the first Paris trip from previous response]
```

### **Offline Usage**
- Interface works offline for viewing recent conversations
- New requests require internet connection
- Quick actions cache for faster loading

## Troubleshooting

### Common Issues

#### **"Authentication failed"**
- Check your token is exactly: `dev-secret`
- Clear browser cache and try again
- Make sure you're using HTTPS

#### **"Server error" in responses**
- Usually temporary - try your request again
- Check your internet connection
- Contact support if persistent

#### **Slow responses**
- Complex queries take 5-10 seconds
- Typing indicator shows the AI is working
- Use Quick Actions for faster responses

#### **"No trips found"**
- Try broader search terms
- Use client email instead of name
- Check spelling of trip names

### Getting Better Results

#### **Be Specific**
❌ "Show me stuff"
✅ "Show me trips for John Smith"

#### **Include Context**  
❌ "Update it"
✅ "Update the Paris trip status to confirmed"

#### **Use Names & IDs**
❌ "That one"
✅ "Trip 123" or "Paris Getaway"

## Best Practices

### **Daily Workflow**

1. **Morning Check-in**
   ```
   "What trips need attention today?"
   "Continue my last project"
   ```

2. **Client Communication**
   ```
   "Show me [client name] trips"  
   "Publish the proposal for [client]"
   ```

3. **Status Updates**
   ```
   "Update [trip name] to confirmed"
   "What's pending approval?"
   ```

### **Trip Creation Workflow**

1. **Start with Client Info**
   ```
   "Create trip for [Name] ([email]) to [destination]"
   ```

2. **Add Details**
   ```
   "Add accommodation preferences for [trip]"
   "Update the budget for trip 123"
   ```

3. **Finalize & Publish**
   ```
   "Review the [trip name] details"
   "Publish the proposal"
   ```

### **Client Management**

1. **Quick Client Lookup**
   ```
   "[client email]" 
   "Find [first name last name]"
   ```

2. **Trip History**
   ```
   "Show all trips for [client]"
   "What's [client]'s travel history?"
   ```

3. **Proposal Generation**
   ```
   "Create proposal for [client]'s next trip"
   "Publish [client]'s London booking"
   ```

## Shortcuts & Power Tips

### **Email Search**
Type just an email address to find all related trips:
```
"john@example.com"
```

### **Quick Status Updates**  
```
"Trip 123 confirmed" → Updates status
"Paris trip paid" → Updates payment status
```

### **Batch Operations**
```
"Show me all planning status trips"
"Publish all confirmed bookings"  
"Update trips 123, 124, 125 to in progress"
```

### **Context Jumping**
```
"Switch to the London booking"  
"Work on trip 456 instead"
"Back to the Paris trip"
```

## Interface Comparison

### Enhanced Chat Interface (`/chat`) - **Recommended**
- **Best for**: Daily travel agent work
- **Features**: Full AI conversation, MCP integration
- **Speed**: Intelligent responses (5-10 seconds)
- **Learning**: Remembers context and preferences

### Classic Mobile Interface (`/mobile`)
- **Best for**: Quick data entry and viewing
- **Features**: Form-based CRUD operations  
- **Speed**: Instant page loads
- **Learning**: No memory or context

**Recommendation**: Use `/chat` for most work, `/mobile` for quick edits.

## Support

### **Self-Help**
- Try rephrasing your question
- Use more specific terms (client email, trip ID)
- Check the suggestions after AI responses

### **Status Check**
- Health check: https://voygen-mobile-api.somotravel.workers.dev/health
- If "unhealthy", wait a few minutes and try again

### **Feature Requests**
- The AI learns from your usage patterns
- Common requests may become Quick Actions
- Complex workflows can be automated

---

**💡 Pro Tip**: The more you use the interface, the better it gets at understanding your specific needs and workflow. Start with simple requests and gradually try more complex operations as you get comfortable.

*Last updated: January 2025*