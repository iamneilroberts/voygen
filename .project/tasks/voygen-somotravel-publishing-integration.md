# Voygen-SoMoTravel Publishing Integration

## Project Overview

Integrate Voygen's travel document publishing workflow with the somotravel.us GitHub Pages dashboard, maintaining the existing functionality while enabling seamless document publication and trip management.

## Current State Analysis

### SoMoTravel.us Dashboard Features
- **index.html**: Modern responsive dashboard with trip cards
- **trips.json**: Source of truth for all trip metadata
- **Status-based categorization**: proposal, confirmed, deposit_paid, paid_in_full, active, past, no_sale
- **Version control**: Full GitHub API integration for tracking changes
- **Sorting**: Trips automatically sorted by status priority
- **Real-time updates**: Dashboard reflects latest trip states

### Voygen Current Publishing
- **github-mcp server**: Publishes HTML documents to GitHub Pages
- **Manual workflow**: Requires user intervention for publication
- **No dashboard integration**: Published docs don't appear in dashboard automatically

## Integration Requirements

### Core Functionality
1. **Seamless Publishing**: `/publish` command publishes documents and updates dashboard
2. **trips.json Management**: Automatically maintain trip registry with proper categorization  
3. **Status Synchronization**: Keep Voygen trip status in sync with dashboard categories
4. **Version Control**: Preserve existing GitHub API versioning system
5. **User Notifications**: Clear feedback when documents are published and available

### Technical Implementation

#### 1. Enhanced GitHub-MCP Server
- **Location**: `remote-mcp-servers/github-mcp-cta/`
- **New Features**:
  - `publish_travel_document_with_dashboard_update`: Combined publishing + trips.json update
  - `update_trips_registry`: Standalone trips.json management
  - `sync_trip_status`: Bidirectional status synchronization

#### 2. Database Integration
- **d1-database server** modifications:
  - Add `dashboard_status` field to trips table
  - Map internal status to dashboard categories
  - Track publication timestamps and URLs

#### 3. Publishing Workflow Enhancement
```
/publish [trip-name] → 
  1. Generate travel document HTML
  2. Publish to GitHub Pages  
  3. Update trips.json with new entry/status
  4. Sync trip status in database
  5. Notify user with live URL
```

## Status Mapping

| Voygen Status | Dashboard Category | Description |
|---------------|-------------------|-------------|
| planning | proposal | Initial trip planning phase |
| confirmed | confirmed | Trip booked and confirmed |
| deposit_paid | deposit_paid | Partial payment received |
| paid_in_full | paid_in_full | Full payment received |
| in_progress | active | Trip currently happening |
| completed | past | Trip finished |
| cancelled | no_sale | Trip cancelled/no sale |

## Implementation Tasks

### Phase 1: Core Integration
- [ ] Extend github-mcp server with dashboard update functionality
- [ ] Add trips.json management to publishing workflow  
- [ ] Implement status mapping between systems
- [ ] Create combined publish command

### Phase 2: Enhanced Features
- [ ] Bidirectional status sync (dashboard → database)
- [ ] Automatic trip categorization based on dates
- [ ] Enhanced user notifications with URLs
- [ ] Error handling for failed publications

### Phase 3: Quality & Testing
- [ ] Test publishing workflow end-to-end
- [ ] Validate trips.json schema compliance
- [ ] Verify dashboard display accuracy
- [ ] Performance optimization for large trip lists

## Success Criteria

1. **Seamless UX**: Single `/publish` command handles everything
2. **Data Consistency**: trips.json always reflects latest trip states
3. **Preserved Functionality**: All existing dashboard features work unchanged
4. **Clear Feedback**: Users know immediately when documents are live
5. **Version Control**: Full audit trail of all changes maintained

## Files to Modify

### Primary Changes
- `remote-mcp-servers/github-mcp-cta/src/index.ts` - Enhanced publishing tools
- `remote-mcp-servers/d1-database-improved/src/index.ts` - Status mapping
- `config/librechat-minimal.yaml` - Updated tool descriptions

### Documentation Updates  
- `CLAUDE.md` - Publishing workflow documentation
- `README.md` - User-facing publish command guide

## Deployment Strategy

1. **Development**: Test with staging GitHub repo
2. **Validation**: Verify trips.json format compliance  
3. **Production**: Deploy to live somotravel.us repository
4. **Monitoring**: Track publication success rates and user feedback

## Risk Mitigation

- **Backup Strategy**: Auto-backup trips.json before modifications
- **Rollback Plan**: Git revert capability for failed publications
- **Schema Validation**: Strict trips.json format checking
- **Error Recovery**: Graceful handling of GitHub API failures