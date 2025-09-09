/**
 * Voygen GitHub MCP Server - Publishing Integration
 * Handles publishing travel documents to somotravel.us with dashboard integration
 * FIXED VERSION: Uses correct Cloudflare Workers pattern with custom JSON-RPC handling
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Env, VoygenStatus, DashboardCategory, PublicationResult } from './types.js';
import { GitHubClient } from './github-client.js';
import { TripsManager } from './trips-manager.js';

// Tool schemas
const PublishWithDashboardSchema = z.object({
  trip_id: z.string().describe('Trip ID from database'),
  html_content: z.string().describe('Complete HTML document content'),
  filename: z.string().describe('Filename without .html extension'),
  trip_metadata: z.object({
    title: z.string().describe('Trip title for dashboard'),
    dates: z.string().describe('Trip dates (e.g., "May 5-15, 2026")'),
    status: z.enum(['planning', 'confirmed', 'deposit_paid', 'paid_in_full', 'in_progress', 'completed', 'cancelled'] as const).describe('Voygen trip status'),
    tags: z.array(z.string()).optional().default([]).describe('Tags for categorization'),
    description: z.string().optional().describe('Trip description')
  }).describe('Trip metadata for dashboard integration'),
  commit_message: z.string().optional().default('Publish travel document with dashboard update').describe('Git commit message'),
  branch: z.string().optional().default('main').describe('Target branch')
});

const UpdateDashboardSchema = z.object({
  trip_metadata: z.object({
    title: z.string(),
    dates: z.string(),
    status: z.string().optional(),
    category: z.enum(['proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past', 'no_sale'] as const),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    filename: z.string(),
    lastModified: z.string()
  }).describe('Complete trip metadata'),
  force_update: z.boolean().optional().default(false).describe('Force update even if trip exists'),
  branch: z.string().optional().default('main').describe('Target branch')
});

const SyncStatusSchema = z.object({
  trip_id: z.string().describe('Trip ID'),
  voygen_status: z.enum(['planning', 'confirmed', 'deposit_paid', 'paid_in_full', 'in_progress', 'completed', 'cancelled'] as const).describe('Current Voygen status'),
  force_update: z.boolean().optional().default(false).describe('Force status update')
});

const CreateFileSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  content: z.string().describe('File content'),
  message: z.string().describe('Commit message'),
  branch: z.string().optional().default('main').describe('Target branch')
});

const UpdateFileSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  content: z.string().describe('New file content'),
  message: z.string().describe('Commit message'),
  sha: z.string().optional().describe('Current file SHA for update'),
  branch: z.string().optional().default('main').describe('Target branch')
});

const GetFileSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  branch: z.string().optional().default('main').describe('Source branch')
});

const ListFilesSchema = z.object({
  path: z.string().optional().default('').describe('Directory path'),
  branch: z.string().optional().default('main').describe('Source branch')
});

// Tool definitions for MCP
const tools = [
  {
    name: 'publish_travel_document_with_dashboard_update',
    description: 'Publish travel document to GitHub Pages and update dashboard trips.json in one operation',
    inputSchema: zodToJsonSchema(PublishWithDashboardSchema)
  },
  {
    name: 'update_dashboard_only',
    description: 'Update trips.json dashboard without publishing document',
    inputSchema: zodToJsonSchema(UpdateDashboardSchema)
  },
  {
    name: 'sync_trip_status',
    description: 'Sync trip status between Voygen and dashboard',
    inputSchema: zodToJsonSchema(SyncStatusSchema)
  },
  {
    name: 'github_create_file',
    description: 'Create a new file in the GitHub repository',
    inputSchema: zodToJsonSchema(CreateFileSchema)
  },
  {
    name: 'github_update_file',
    description: 'Update an existing file in the GitHub repository',
    inputSchema: zodToJsonSchema(UpdateFileSchema)
  },
  {
    name: 'github_get_file',
    description: 'Get file content and metadata from GitHub repository',
    inputSchema: zodToJsonSchema(GetFileSchema)
  },
  {
    name: 'github_list_files',
    description: 'List files and directories in the GitHub repository',
    inputSchema: zodToJsonSchema(ListFilesSchema)
  },
  {
    name: 'health_check',
    description: 'Check GitHub repository health and connectivity',
    inputSchema: zodToJsonSchema(z.object({}))
  }
];

// Tool handler functions
async function handlePublishWithDashboard(args: z.infer<typeof PublishWithDashboardSchema>, env: Env) {
  const client = new GitHubClient(env);
  const tripsManager = new TripsManager(client);
  
  const { trip_id, html_content, filename, trip_metadata, commit_message, branch = 'main' } = args;
  
  try {
    // Create backup of trips.json first
    const backup = await tripsManager.backupTripsJson(branch);
    
    // Step 1: Publish HTML document
    const htmlPath = `${filename}.html`;
    let documentCommit;
    
    try {
      // Try to update existing file
      const existingFile = await client.getFile(htmlPath, branch);
      documentCommit = await client.updateFile(
        htmlPath,
        html_content,
        commit_message || 'Update travel document',
        existingFile.sha,
        branch
      );
    } catch (error: any) {
      if (error.statusCode === 404) {
        // File doesn't exist, create new one
        documentCommit = await client.createFile(
          htmlPath,
          html_content,
          commit_message || 'Create travel document',
          branch
        );
      } else {
        throw error;
      }
    }

    // Step 2: Update trips.json with trip metadata
    const tripMeta = tripsManager.createTripMetadata(
      trip_metadata.title,
      trip_metadata.dates,
      filename,
      trip_metadata.status as VoygenStatus,
      trip_metadata.tags || [],
      trip_metadata.description
    );

    const tripResult = await tripsManager.addOrUpdateTrip(tripMeta, branch);

    const result: PublicationResult = {
      success: true,
      document_url: client.getFileUrl(`${filename}.html`),
      dashboard_url: client.getDashboardUrl(),
      document_commit: documentCommit.sha,
      dashboard_commit: tripResult.commit,
      filename: `${filename}.html`,
      trip_added: tripResult.trip_added
    };

    return {
      content: [{
        type: 'text',
        text: `✅ Travel document published successfully!

**Document**: ${trip_metadata.title}
**Status**: ${trip_metadata.status} → ${tripsManager.mapVoygenStatusToDashboard(trip_metadata.status as VoygenStatus)}
**Live URL**: ${result.document_url}
**Dashboard**: ${result.dashboard_url}

**Changes Made**:
• Document ${tripResult.trip_added ? 'created' : 'updated'}: ${result.filename}
• Dashboard entry ${tripResult.trip_added ? 'added' : 'updated'} in trips.json
• Backup created: ${backup.backed_up ? backup.backup_path : 'none'}

**Commits**:
• Document: ${result.document_commit}
• Dashboard: ${result.dashboard_commit}

The document is now live and visible on the dashboard!`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Publication failed: ${error.message}

**Error Details**:
• Trip ID: ${trip_id}
• Filename: ${filename}
• Error Type: ${error.constructor.name}

Please check the error and try again. If the issue persists, verify:
1. GitHub token permissions
2. Repository access
3. File content validity`
      }]
    };
  }
}

async function handleUpdateDashboardOnly(args: z.infer<typeof UpdateDashboardSchema>, env: Env) {
  const client = new GitHubClient(env);
  const tripsManager = new TripsManager(client);
  
  const { trip_metadata, branch = 'main' } = args;
  
  try {
    const backup = await tripsManager.backupTripsJson(branch);
    const result = await tripsManager.addOrUpdateTrip(trip_metadata, branch);
    
    return {
      content: [{
        type: 'text',
        text: `✅ Dashboard updated successfully!

**Trip**: ${trip_metadata.title}
**Action**: ${result.trip_added ? 'Added new trip' : 'Updated existing trip'}
**Category**: ${trip_metadata.category}
**Dashboard**: ${client.getDashboardUrl()}

**Technical Details**:
• Commit: ${result.commit}
• Backup: ${backup.backed_up ? backup.backup_path : 'none'}

The dashboard now reflects the latest trip information.`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Dashboard update failed: ${error.message}

Please verify the trip metadata format and try again.`
      }]
    };
  }
}

async function handleSyncStatus(args: z.infer<typeof SyncStatusSchema>, env: Env) {
  const tripsManager = new TripsManager(new GitHubClient(env));
  const dashboardCategory = tripsManager.mapVoygenStatusToDashboard(args.voygen_status as VoygenStatus);
  
  return {
    content: [{
      type: 'text',
      text: `📊 Status Mapping:

**Voygen Status**: ${args.voygen_status}
**Dashboard Category**: ${dashboardCategory}
**Trip ID**: ${args.trip_id}

Use the \`update_dashboard_only\` tool to apply this status to the dashboard.`
    }]
  };
}

async function handleCreateFile(args: z.infer<typeof CreateFileSchema>, env: Env) {
  const client = new GitHubClient(env);
  const { path, content, message, branch = 'main' } = args;
  
  try {
    const commit = await client.createFile(path, content, message, branch);
    const fileUrl = client.getFileUrl(path);
    
    return {
      content: [{
        type: 'text',
        text: `✅ File created successfully!

**File**: ${path}
**Branch**: ${branch}
**Live URL**: ${fileUrl}
**Commit**: ${commit.sha}

The file is now live on GitHub Pages.`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ File creation failed: ${error.message}`
      }]
    };
  }
}

async function handleUpdateFile(args: z.infer<typeof UpdateFileSchema>, env: Env) {
  const client = new GitHubClient(env);
  const { path, content, message, sha, branch = 'main' } = args;
  
  try {
    let fileSha = sha;
    if (!fileSha) {
      const existingFile = await client.getFile(path, branch);
      fileSha = existingFile.sha;
    }
    
    const commit = await client.updateFile(path, content, message, fileSha, branch);
    const fileUrl = client.getFileUrl(path);
    
    return {
      content: [{
        type: 'text',
        text: `✅ File updated successfully!

**File**: ${path}
**Branch**: ${branch}
**Live URL**: ${fileUrl}
**Commit**: ${commit.sha}

The updated file is now live on GitHub Pages.`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ File update failed: ${error.message}`
      }]
    };
  }
}

async function handleGetFile(args: z.infer<typeof GetFileSchema>, env: Env) {
  const client = new GitHubClient(env);
  const { path, branch = 'main' } = args;
  
  try {
    const file = await client.getFile(path, branch);
    
    return {
      content: [{
        type: 'text',
        text: `📄 File: ${path}

**Branch**: ${branch}
**Size**: ${file.size} bytes
**SHA**: ${file.sha}

**Content Preview** (first 500 chars):
\`\`\`
${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}
\`\`\``
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to get file: ${error.message}`
      }]
    };
  }
}

async function handleListFiles(args: z.infer<typeof ListFilesSchema>, env: Env) {
  const client = new GitHubClient(env);
  const { path = '', branch = 'main' } = args;
  
  try {
    const files = await client.listFiles(path, branch);
    
    const fileList = files.map(file => {
      const icon = file.type === 'dir' ? '📁' : '📄';
      return `${icon} ${file.name} (${file.type})`;
    }).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `📂 Repository Contents: ${path || '(root)'}

**Branch**: ${branch}
**Items**: ${files.length}

${fileList}`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to list files: ${error.message}`
      }]
    };
  }
}

async function handleHealthCheck(env: Env) {
  const client = new GitHubClient(env);
  const tripsManager = new TripsManager(client);
  
  try {
    const health = await client.healthCheck();
    let tripsStatus = 'unknown';
    
    try {
      await tripsManager.getTripsJson();
      tripsStatus = 'valid';
    } catch {
      tripsStatus = 'invalid or missing';
    }
    
    return {
      content: [{
        type: 'text',
        text: `🏥 Health Check Results

**Repository**: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}
**Access**: ${health.repository_accessible ? '✅ OK' : '❌ Failed'}
**Environment**: ${env.ENVIRONMENT || 'unknown'}
**Trips.json**: ${tripsStatus}

**Rate Limit**: ${health.rate_limit ? 
  `${health.rate_limit.rate.remaining}/${health.rate_limit.rate.limit} remaining` : 
  'Unknown'
}

Server is ${health.repository_accessible ? 'healthy' : 'degraded'} and ready for publishing.`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ Health check failed: ${error.message}`
      }]
    };
  }
}

// Cloudflare Workers export with custom JSON-RPC handling
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      try {
        const client = new GitHubClient(env);
        const health = await client.healthCheck();
        
        return Response.json({
          status: health.repository_accessible ? 'healthy' : 'degraded',
          github_token: !!env.GITHUB_TOKEN,
          github_repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          environment: env.ENVIRONMENT || 'unknown',
          timestamp: new Date().toISOString(),
          ...health
        });
      } catch (error: any) {
        return Response.json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
    
    // MCP Server endpoint - Custom JSON-RPC handling for Cloudflare Workers
    if (url.pathname === '/sse') {
      if (request.method === 'POST') {
        try {
          const body: any = await request.json();
          console.log("Received MCP message:", JSON.stringify(body));

          let response;

          // Handle different MCP methods directly
          switch (body.method) {
            case "initialize":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  protocolVersion: "2025-06-18",
                  capabilities: {
                    tools: {}
                  },
                  serverInfo: {
                    name: "Voygen GitHub MCP",
                    version: "1.0.0"
                  }
                }
              };
              break;

            case "tools/list":
              response = {
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  tools: tools
                }
              };
              break;

            case "tools/call":
              const toolName = body.params.name;
              const toolArgs = body.params.arguments || {};
              
              try {
                let result;
                switch (toolName) {
                  case 'publish_travel_document_with_dashboard_update':
                    result = await handlePublishWithDashboard(toolArgs, env);
                    break;
                  case 'update_dashboard_only':
                    result = await handleUpdateDashboardOnly(toolArgs, env);
                    break;
                  case 'sync_trip_status':
                    result = await handleSyncStatus(toolArgs, env);
                    break;
                  case 'github_create_file':
                    result = await handleCreateFile(toolArgs, env);
                    break;
                  case 'github_update_file':
                    result = await handleUpdateFile(toolArgs, env);
                    break;
                  case 'github_get_file':
                    result = await handleGetFile(toolArgs, env);
                    break;
                  case 'github_list_files':
                    result = await handleListFiles(toolArgs, env);
                    break;
                  case 'health_check':
                    result = await handleHealthCheck(env);
                    break;
                  default:
                    throw new Error(`Unknown tool: ${toolName}`);
                }

                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  result
                };
              } catch (error: any) {
                console.error(`Tool execution error:`, error);
                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  error: {
                    code: -32603,
                    message: `Tool execution failed: ${error.message}`
                  }
                };
              }
              break;

            default:
              response = {
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32601,
                  message: `Method not found: ${body.method}`
                }
              };
          }

          return new Response(JSON.stringify(response) + '\n', {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: any) {
          console.error('Error handling MCP request:', error);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `Internal error: ${error.message}`,
            },
          }) + '\n', {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }
    }
    
    // Default response
    return Response.json({
      name: 'Voygen GitHub MCP Server',
      version: '1.0.0',
      description: 'Publishing integration with somotravel.us dashboard',
      endpoints: {
        health: '/health',
        mcp: '/sse'
      }
    });
  }
};