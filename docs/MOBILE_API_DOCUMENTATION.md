# Voygen Mobile API Documentation

## Base URL
```
https://voygen-mobile-api.somotravel.workers.dev
```

## Authentication
All API endpoints require Bearer token authentication:
```http
Authorization: Bearer dev-secret
```

## Interfaces

### Web Interfaces

#### Enhanced Chat Interface
```http
GET /chat
```
**Response**: HTML page with conversational AI chat interface
- Full MCP server integration
- Claude-powered responses
- Mobile-optimized chat UI
- Natural language trip management

#### Classic Mobile Interface  
```http
GET /
GET /mobile
```
**Response**: HTML page with traditional CRUD interface
- Form-based trip management
- Basic trip listing and creation
- Limited AI functionality

### API Endpoints

#### Health Check
```http
GET /health
```
**Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0-modular",
  "endpoints": {
    "GET /": "Mobile interface",
    "GET /mobile": "Mobile interface", 
    "GET /chat": "Enhanced chat interface",
    "GET /trips": "List trips",
    "POST /trips": "Create trip",
    "GET /trips/:id": "Get trip",
    "PATCH /trips/:id": "Update trip",
    "POST /proposals/:id/render": "Render proposal",
    "POST /publish/:id": "Publish trip",
    "POST /chat/:id": "Chat with AI about trip",
    "POST /chat/enhanced": "Enhanced AI chat with full MCP integration"
  }
}
```

## Trip Management

### List Trips
```http
GET /trips
```
**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "trips": [
    {
      "trip_id": 123,
      "trip_name": "Paris Getaway",
      "status": "planning",
      "start_date": "2024-06-01",
      "end_date": "2024-06-10",
      "destinations": "Paris, France",
      "total_cost": 5000,
      "primary_client_email": "client@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### Get Trip
```http
GET /trips/:id
```
**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "trip": {
    "trip_id": 123,
    "trip_name": "Paris Getaway",
    "status": "planning",
    "start_date": "2024-06-01",
    "end_date": "2024-06-10",
    "destinations": "Paris, France",
    "total_cost": 5000,
    "paid_amount": 1000,
    "primary_client_email": "client@example.com",
    "group_name": "Smith Family",
    "clients": "[{\"name\":\"John Smith\",\"email\":\"john@example.com\"}]",
    "schedule": "[{\"date\":\"2024-06-01\",\"activity\":\"Arrival\"}]",
    "accommodations": "[{\"hotel\":\"Hotel Paris\",\"nights\":9}]",
    "transportation": "[{\"type\":\"flight\",\"details\":\"NYC-CDG\"}]",
    "financials": "{\"breakdown\":{\"flights\":2000,\"hotels\":2500,\"activities\":500}}",
    "documents": "[{\"type\":\"proposal\",\"url\":\"https://...\"}]",
    "notes": "Client prefers morning flights",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Create Trip
```http
POST /trips
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "trip_name": "London Adventure",
  "start_date": "2024-07-01",
  "end_date": "2024-07-10",
  "destinations": "London, UK",
  "status": "planning",
  "owner": "travel-agent"
}
```

**Response**:
```json
{
  "success": true,
  "trip": {
    "trip_id": 124,
    "trip_name": "London Adventure",
    "status": "planning",
    "start_date": "2024-07-01",
    "end_date": "2024-07-10",
    "destinations": "London, UK",
    "total_cost": 0,
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### Update Trip
```http
PATCH /trips/:id
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body** (partial update):
```json
{
  "status": "confirmed",
  "total_cost": 4500,
  "destinations": "London, Edinburgh"
}
```

**Response**:
```json
{
  "success": true,
  "trip": {
    "trip_id": 124,
    "trip_name": "London Adventure",
    "status": "confirmed",
    "total_cost": 4500,
    "destinations": "London, Edinburgh",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

## Chat & AI

### Enhanced Chat (Recommended)
```http
POST /chat/enhanced
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "message": "Show me all trips for John Smith",
  "session_id": "session_123",
  "context": {
    "active_trip_id": "123",
    "active_client_email": "john@example.com"
  }
}
```

**Response**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Show me all trips for John Smith",
      "timestamp": "2024-01-15T12:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "🎫 **Found 2 trip(s):**\n\n**1. Paris Getaway**\n📍 Paris, France\n📅 2024-06-01 to 2024-06-10\n🏷️ Status: planning\n💰 Cost: $5000\n🆔 ID: 123\n\n**2. London Adventure**\n📍 London, Edinburgh\n📅 2024-07-01 to 2024-07-10\n🏷️ Status: confirmed\n💰 Cost: $4500\n🆔 ID: 124",
      "timestamp": "2024-01-15T12:00:01Z",
      "metadata": {
        "mcp_enabled": true,
        "version": "2.0"
      }
    }
  ],
  "session_id": "session_123",
  "context": {
    "active_client_email": "john@example.com"
  }
}
```

### Simple Chat (Legacy)
```http
POST /chat/:trip_id
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "message": "What's the cost of this trip?"
}
```

**Response**:
```json
{
  "response": "The current estimated cost for \"Paris Getaway\" is $5000. Would you like me to help you adjust the budget or find cost-saving options?",
  "trip_context": {
    "trip_id": 123,
    "trip_name": "Paris Getaway",
    "status": "planning"
  }
}
```

## Proposals & Publishing

### Render Proposal
```http
POST /proposals/:trip_id/render
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "template": "standard",
  "options": {
    "include_images": true,
    "image_quality": 85
  }
}
```

**Response**:
```json
{
  "success": true,
  "html_content": "<html>...</html>",
  "preview_url": "https://...",
  "generated_at": "2024-01-15T12:30:00Z"
}
```

### Publish Trip
```http
POST /publish/:trip_id
```
**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body** (optional):
```json
{
  "template": "luxury",
  "force_update": false
}
```

**Response**:
```json
{
  "success": true,
  "html_url": "https://somotravel.us/trips/paris-getaway-2024.html",
  "dashboard_updated": true,
  "published_at": "2024-01-15T13:00:00Z",
  "trip_metadata": {
    "title": "Paris Getaway 2024",
    "dates": "June 1-10, 2024",
    "status": "planning",
    "category": "proposal"
  }
}
```

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "details": "Missing required field: trip_name"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication failed",
  "details": "Invalid or missing Bearer token"
}
```

### 404 Not Found
```json
{
  "error": "Trip not found",
  "details": "No trip found with ID: 999"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "details": "MCP server unavailable"
}
```

## MCP Integration

The enhanced chat endpoint (`/chat/enhanced`) integrates with three MCP servers:

### Database MCP Server
**Endpoint**: `https://d1-database-improved.somotravel.workers.dev/sse`

**Available Methods**:
- `get_anything`: Search trips, clients, bookings
- `create_trip_with_client`: Create trip and assign client
- `bulk_trip_operations`: Multiple trip operations
- `generate_proposal`: Create HTML proposals

### Workflow MCP Server  
**Endpoint**: `https://prompt-instructions-d1-mcp.somotravel.workers.dev/sse`

**Available Methods**:
- `continue_trip`: Resume work on existing trips
- `travel_agent_start`: Initialize travel agent workflow
- `get_workflow_status`: Check current workflow state

### Publishing MCP Server
**Endpoint**: `https://github-mcp-cta.somotravel.workers.dev/sse`

**Available Methods**:
- `publish_travel_document_with_dashboard_update`: Publish to GitHub Pages
- `update_dashboard_only`: Update trip dashboard
- `sync_trip_status`: Sync status between systems

## Rate Limits

- **Chat endpoints**: 100 requests per minute per IP
- **Trip CRUD**: 1000 requests per minute per IP  
- **Publishing**: 10 requests per minute per IP

## Usage Examples

### Natural Language Trip Creation
```bash
curl -X POST https://voygen-mobile-api.somotravel.workers.dev/chat/enhanced \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a trip for John Smith (john@email.com) to Paris from June 1-10 called Paris Getaway",
    "session_id": "session_123"
  }'
```

### Trip Search
```bash
curl -X POST https://voygen-mobile-api.somotravel.workers.dev/chat/enhanced \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me all trips for Paris",
    "session_id": "session_123"
  }'
```

### One-Command Publishing
```bash
curl -X POST https://voygen-mobile-api.somotravel.workers.dev/chat/enhanced \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Publish trip 123",
    "session_id": "session_123"
  }'
```

## SDKs & Libraries

### JavaScript/TypeScript
```typescript
class VoygenMobileClient {
  constructor(private baseUrl: string, private token: string) {}
  
  async chat(message: string, sessionId?: string, context?: any) {
    const response = await fetch(`${this.baseUrl}/chat/enhanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, session_id: sessionId, context })
    });
    return response.json();
  }
  
  async getTrips() {
    const response = await fetch(`${this.baseUrl}/trips`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
}

// Usage
const client = new VoygenMobileClient(
  'https://voygen-mobile-api.somotravel.workers.dev',
  'dev-secret'
);

const response = await client.chat('Show me all my trips');
```

### Python
```python
import requests

class VoygenMobileClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def chat(self, message: str, session_id: str = None, context: dict = None):
        response = requests.post(
            f'{self.base_url}/chat/enhanced',
            json={'message': message, 'session_id': session_id, 'context': context},
            headers={**self.headers, 'Content-Type': 'application/json'}
        )
        return response.json()
    
    def get_trips(self):
        response = requests.get(f'{self.base_url}/trips', headers=self.headers)
        return response.json()

# Usage
client = VoygenMobileClient(
    'https://voygen-mobile-api.somotravel.workers.dev',
    'dev-secret'
)

response = client.chat('Show me all my trips')
```

---

*Last updated: January 2025*