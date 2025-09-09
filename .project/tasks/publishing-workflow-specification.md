# Voygen Publishing Workflow Specification

## User Command Flow

### `/publish` Command
```
User: /publish [optional-trip-identifier]

System Response:
1. Identify active trip context
2. Generate professional travel document 
3. Publish to somotravel.us GitHub Pages
4. Update trips.json registry
5. Sync database status
6. Return live URL to user
```

## Technical Architecture

### Enhanced GitHub-MCP Server Tools

#### `publish_travel_document_with_dashboard_update`
```typescript
interface PublishWithDashboardParams {
  trip_id: string;
  html_content: string;
  filename: string;
  trip_metadata: {
    title: string;
    dates: string;
    status: string;
    category: string;
    tags: string[];
    description?: string;
  };
  commit_message?: string;
}
```

**Workflow**:
1. Publish HTML document to GitHub Pages
2. Fetch current trips.json
3. Update/add trip entry with proper categorization
4. Commit changes with descriptive message
5. Return publication confirmation with URLs

#### `sync_dashboard_status`
```typescript
interface StatusSyncParams {
  trip_id: string;
  voygen_status: string;
  force_update?: boolean;
}
```

**Status Mapping Logic**:
```typescript
const STATUS_MAP = {
  'planning': 'proposal',
  'confirmed': 'confirmed', 
  'deposit_paid': 'deposit_paid',
  'paid_in_full': 'paid_in_full',
  'in_progress': 'active',
  'completed': 'past',
  'cancelled': 'no_sale'
};
```

### Database Integration

#### Enhanced Trip Schema
```sql
ALTER TABLE trips_v2 ADD COLUMN dashboard_status TEXT;
ALTER TABLE trips_v2 ADD COLUMN published_url TEXT;
ALTER TABLE trips_v2 ADD COLUMN last_published TIMESTAMP;
```

#### `update_trip_publication_status`
```typescript
interface PublicationUpdate {
  trip_id: string;
  dashboard_status: string;
  published_url: string;
  published_at: string;
}
```

## Publication Process Flow

### 1. Pre-Publication Validation
- Verify trip exists in database
- Check HTML content quality
- Validate filename uniqueness
- Ensure user permissions

### 2. Document Generation & Publishing
- Generate/validate HTML document
- Create GitHub commit with travel document
- Upload to somotravel.us repository
- Verify successful deployment

### 3. Dashboard Integration
- Fetch current trips.json from GitHub
- Generate new trip entry or update existing
- Apply proper status categorization
- Commit updated trips.json

### 4. Database Synchronization  
- Update trip record with publication details
- Set dashboard_status and published_url
- Record publication timestamp
- Sync with workflow status if applicable

### 5. User Notification
- Confirm successful publication
- Provide direct URL to published document
- Show dashboard URL for trip listing
- Log activity for audit trail

## Error Handling & Recovery

### GitHub API Failures
- Retry mechanism with exponential backoff
- Graceful degradation (publish without dashboard update)
- User notification of partial failures
- Manual sync tools for recovery

### Data Consistency Issues
- Transaction-like behavior for trips.json updates
- Automatic rollback on critical failures
- Conflict resolution for concurrent updates
- Data validation before commits

### User Experience
- Clear error messages with actionable guidance
- Progress indicators for long-running operations  
- Fallback options when primary workflow fails
- Support for manual intervention when needed

## Integration Points

### LibreChat Command Processing
```yaml
# config/librechat-minimal.yaml
- name: publish
  description: "Publish travel document to website"
  serverName: github-mcp-cta
  toolName: publish_travel_document_with_dashboard_update
```

### MCP Server Communication
- **github-mcp**: Document publishing and trips.json management
- **d1-database**: Trip status and publication tracking  
- **prompt-instructions**: Workflow state management
- **mcp-chrome**: Optional screenshot capture for documents

### External Dependencies
- GitHub API for repository management
- GitHub Pages for document hosting
- Cloudflare Workers for server hosting
- D1 database for persistent storage

## Quality Assurance

### Automated Testing
- Unit tests for status mapping logic
- Integration tests for GitHub API interactions
- End-to-end tests for complete publish workflow
- Mock services for reliable testing environment

### Data Validation
- Schema validation for trips.json entries
- HTML content sanitization and validation
- File naming convention enforcement  
- Duplicate detection and handling

### Performance Monitoring
- Publication success/failure rates
- Average publication time metrics
- GitHub API rate limit monitoring
- User satisfaction feedback collection

## Success Metrics

### Technical KPIs
- Publication success rate > 95%
- Average publication time < 30 seconds  
- Zero data corruption incidents
- 100% status synchronization accuracy

### User Experience KPIs
- Single-command publishing workflow
- Immediate URL availability post-publication
- Clear error messages and recovery guidance
- Seamless integration with existing dashboard features