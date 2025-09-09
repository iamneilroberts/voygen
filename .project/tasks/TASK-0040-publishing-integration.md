# Task: SoMoTravel Publishing Integration

**ID**: TASK-0040  
**Type**: integration  
**Status**: planned  
**Priority**: high  
**Assignee**: Full-Stack Developer  
**Estimated Time**: 3 weeks  
**Dependencies**: TASK-0032 (MCP Server Tools), TASK-0035 (Template Rendering)

## Objective

Integrate Voygen's travel document publishing workflow with the somotravel.us GitHub Pages dashboard, enabling seamless document publication and automatic dashboard updates through a single `/publish` command.

## User Story

As a **travel agent using Voygen**  
I want to **publish travel documents with a single command and see them immediately available on the dashboard**  
So that **I can share professional proposals with clients quickly and track all published documents in one place**

## Context

The somotravel.us repository currently has:
- Modern responsive dashboard (index.html) displaying trip cards
- trips.json as source of truth with versioning and GitHub API integration
- Status-based categorization (proposal, confirmed, deposit_paid, paid_in_full, active, past, no_sale)
- Automatic sorting and real-time updates

Voygen currently publishes documents via github-mcp server but lacks dashboard integration, requiring manual trip registry updates.

## Requirements

### Functional Requirements

1. **Single Command Publishing**
   - `/publish [trip-identifier]` publishes document and updates dashboard
   - Auto-detection of active trip context when identifier omitted
   - Clear success/failure feedback with live URLs

2. **Automatic Dashboard Integration**
   - Update trips.json with new/modified trip entries
   - Proper status categorization mapping
   - Preserve existing dashboard functionality and styling

3. **Status Synchronization**
   - Map Voygen workflow states to dashboard categories
   - Bidirectional sync between database and dashboard
   - Handle status transitions automatically

4. **Data Integrity**
   - Validate trips.json schema compliance
   - Backup before modifications
   - Atomic operations with rollback capability

### Non-Functional Requirements

1. **Performance**: Complete publication workflow in <30 seconds
2. **Reliability**: >95% success rate for publications
3. **Usability**: Zero manual intervention required for standard workflows
4. **Maintainability**: Clear error messages and recovery procedures

## Technical Approach

### Enhanced GitHub-MCP Server

#### New Tool: `publish_travel_document_with_dashboard_update`
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

**Implementation Steps:**
1. Validate input parameters and HTML content
2. Publish HTML document to GitHub Pages repository
3. Fetch current trips.json from repository
4. Update/insert trip entry with proper categorization
5. Commit updated trips.json with descriptive message
6. Return publication confirmation with URLs

#### Status Mapping Logic
```typescript
const STATUS_MAP: Record<string, string> = {
  'planning': 'proposal',
  'confirmed': 'confirmed', 
  'deposit_paid': 'deposit_paid',
  'paid_in_full': 'paid_in_full',
  'in_progress': 'active',
  'completed': 'past',
  'cancelled': 'no_sale'
};

function mapVoygenToDashboardStatus(voygenStatus: string): string {
  return STATUS_MAP[voygenStatus] || 'proposal';
}
```

### Database Schema Updates

#### Trip Publication Tracking
```sql
ALTER TABLE trips_v2 ADD COLUMN dashboard_status TEXT;
ALTER TABLE trips_v2 ADD COLUMN published_url TEXT;  
ALTER TABLE trips_v2 ADD COLUMN last_published TIMESTAMP;
ALTER TABLE trips_v2 ADD COLUMN publication_filename TEXT;
```

#### Publication Log Table
```sql
CREATE TABLE publication_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER REFERENCES trips_v2(id),
  filename TEXT NOT NULL,
  published_url TEXT NOT NULL,
  dashboard_updated BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  commit_hash TEXT,
  status TEXT DEFAULT 'success'
);
```

### Workflow Integration

#### LibreChat Command Configuration
```yaml
# config/librechat-minimal.yaml
tools:
  - name: publish_travel_document_with_dashboard_update
    description: "Publish travel document to website and update dashboard"
    serverName: github-mcp-cta
    toolName: publish_travel_document_with_dashboard_update
    parameters:
      required: ["trip_id", "html_content", "filename", "trip_metadata"]
```

## Implementation Plan

### Phase 1: Core Publishing Enhancement (Week 1)
- [ ] Extend github-mcp server with dashboard update functionality
- [ ] Implement trips.json management logic
- [ ] Add status mapping between Voygen and dashboard systems
- [ ] Create atomic commit operations for HTML + JSON updates

### Phase 2: Database Integration (Week 2)  
- [ ] Update database schema with publication tracking fields
- [ ] Implement publication logging and status sync
- [ ] Add database tools for publication management
- [ ] Create recovery tools for failed publications

### Phase 3: User Experience & Testing (Week 3)
- [ ] Integrate with LibreChat command system
- [ ] Implement comprehensive error handling
- [ ] Add user feedback and notification system
- [ ] Create end-to-end tests and validation

## Testing Strategy

### Unit Tests
- Status mapping logic validation
- trips.json schema compliance checking
- Error handling for GitHub API failures
- Database publication tracking accuracy

### Integration Tests  
- Complete publish workflow with mock GitHub API
- Database synchronization validation
- Dashboard display accuracy after updates
- Recovery procedures for partial failures

### End-to-End Tests
- Full publication workflow in staging environment
- User command processing and response validation
- Dashboard visual verification after publication
- Performance benchmarking for publication times

## Error Handling

### GitHub API Failures
- Retry mechanism with exponential backoff (3 attempts)
- Graceful degradation: publish without dashboard update
- Clear user notification of partial success/failure
- Manual sync tools for post-failure recovery

### Data Validation Errors
- Schema validation before trips.json commits
- Filename collision detection and resolution
- Duplicate entry prevention and merging logic
- Transaction rollback for critical failures

### User Experience
- Progress indicators for long-running operations
- Actionable error messages with recovery guidance  
- Fallback options when primary workflow fails
- Support escalation paths for complex failures

## Success Criteria

### Technical Metrics
- Publication success rate >95%
- Average end-to-end publication time <30 seconds
- Zero data corruption incidents in trips.json
- 100% status synchronization accuracy between systems

### User Experience Metrics
- Single command achieves complete publication workflow
- Users receive immediate confirmation with live URLs
- Dashboard accurately reflects all published documents
- Error recovery requires minimal user intervention

## Risks and Mitigations

### High Risk
- **GitHub API rate limiting**: Implement intelligent retry logic and request batching
- **Concurrent modification conflicts**: Use optimistic locking and conflict resolution
- **Data schema evolution**: Version trips.json schema and maintain backward compatibility

### Medium Risk  
- **Large trips.json performance**: Implement pagination or archiving for old entries
- **Network connectivity issues**: Add offline queuing and retry mechanisms
- **User permission errors**: Clear authentication error handling and guidance

### Low Risk
- **HTML content validation**: Sanitization and format verification
- **Filename collisions**: Automatic unique naming with user notification
- **Broken links in dashboard**: Link validation and health checking

## Dependencies

### Internal Dependencies
- **TASK-0032**: MCP Server Tools (database operations, trip management)
- **TASK-0035**: Template Rendering (HTML document generation)

### External Dependencies
- GitHub API availability and rate limits
- GitHub Pages build and deployment system
- Cloudflare Workers runtime for MCP servers
- D1 database availability and performance

## Deliverables

1. **Enhanced github-mcp server** with dashboard integration tools
2. **Updated database schema** with publication tracking
3. **LibreChat command integration** for `/publish` workflow
4. **Comprehensive test suite** covering all publication scenarios
5. **Documentation** for users and developers
6. **Error recovery tools** for maintenance and support

## Future Enhancements

- Batch publication for multiple documents
- Preview mode for dashboard updates before committing
- Analytics dashboard for publication metrics
- Automated archival of old completed trips
- Integration with external calendar systems for date validation