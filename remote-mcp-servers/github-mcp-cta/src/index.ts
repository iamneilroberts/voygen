/**
 * GitHub MCP Server for CTA Document Publishing
 * Publishes travel documents to GitHub Pages with PAT authentication
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { GitHubClient } from './github-client.js';
import { InputValidator } from './validation.js';
import { IndexManager } from './index-manager.js';
import { Env, TripData, ValidationError, PublishingError, RetryableError, NonRetryableError } from './types.js';

// Global environment reference
let globalEnv;

// Tool schemas
const CreateFileSchema = z.object({
  path: z.string().describe('File path relative to repository root (e.g., "trip.html")'),
  content: z.string().describe('File content as string'),
  message: z.string().describe('Commit message'),
  branch: z.string().default('main').describe('Target branch (default: main)')
});

const UpdateFileSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  content: z.string().describe('New file content'),
  message: z.string().describe('Commit message'),
  branch: z.string().default('main').describe('Target branch (default: main)')
});

const GetFileSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  branch: z.string().default('main').describe('Source branch (default: main)')
});

const ListFilesSchema = z.object({
  path: z.string().default('').describe('Directory path (default: root)'),
  branch: z.string().default('main').describe('Source branch (default: main)')
});

const PublishDocumentSchema = z.object({
  filename: z.string().describe('Filename without .html extension'),
  htmlContent: z.string().describe('Complete HTML document content'),
  tripData: z.object({
    clientName: z.string(),
    destination: z.string(),
    startDate: z.string().describe('YYYY-MM-DD format'),
    endDate: z.string().describe('YYYY-MM-DD format'),
    status: z.enum(['Planning', 'Confirmed', 'In Progress', 'Complete'])
  }).describe('Trip metadata for index.html card'),
  commitMessage: z.string().default('Publish travel document').describe('Commit message'),
  branch: z.string().default('main').describe('Target branch (default: main)')
});

const ReplaceIndexSchema = z.object({
  branch: z.string().default('main').describe('Target branch (default: main)')
});


// Tool handler functions
async function handleCreateFile(client, args) {
  const { path, content, message, branch = 'main' } = args;
  
  InputValidator.validateFilePath(path);
  InputValidator.validateHtmlContent(content);
  InputValidator.validateCommitMessage(message);
  InputValidator.validateBranch(branch);

  const result = await client.createFile(path, content, message, branch);
  const fileUrl = `https://${client.owner}.github.io/${client.repo}/${path}`;

  return {
    content: [{
      type: 'text',
      text: `✅ File created successfully!

**File**: ${path}
**Branch**: ${branch}
**Live URL**: ${fileUrl}
**Commit**: ${result.commit.sha}

The file is now live on GitHub Pages and ready to share.`
    }]
  };
}

async function handleUpdateFile(client, args) {
  const { path, content, message, branch = 'main' } = args;
  
  InputValidator.validateFilePath(path);
  InputValidator.validateHtmlContent(content);
  InputValidator.validateCommitMessage(message);
  InputValidator.validateBranch(branch);

  // Get current file to get SHA
  const existingFile = await client.getFile(path, branch);
  const result = await client.updateFile(path, content, message, existingFile.sha, branch);
  const fileUrl = `https://${client.owner}.github.io/${client.repo}/${path}`;

  return {
    content: [{
      type: 'text',
      text: `✅ File updated successfully!

**File**: ${path}
**Branch**: ${branch}
**Live URL**: ${fileUrl}
**Commit**: ${result.commit.sha}

The updated file is now live on GitHub Pages.`
    }]
  };
}

async function handleGetFile(client, args) {
  const { path, branch = 'main' } = args;
  
  InputValidator.validateFilePath(path);
  InputValidator.validateBranch(branch);

  const file = await client.getFile(path, branch);

  return {
    content: [{
      type: 'text',
      text: `📄 File: ${path}

**Branch**: ${branch}
**Size**: ${file.size} bytes
**SHA**: ${file.sha}
**Last Modified**: ${new Date(file.lastModified || '').toLocaleDateString()}

**Content Preview** (first 500 chars):
\`\`\`
${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}
\`\`\``
    }]
  };
}

async function handleListFiles(client, args) {
  const { path = '', branch = 'main' } = args;
  
  InputValidator.validateBranch(branch);

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
}

async function handlePublishDocument(client, args) {
  const { filename, htmlContent, tripData, commitMessage = 'Publish travel document', branch = 'main' } = args;
  
  // Validate inputs
  InputValidator.validateHtmlContent(htmlContent);
  InputValidator.validateTripData(tripData);
  InputValidator.validateCommitMessage(commitMessage);
  InputValidator.validateBranch(branch);

  // Generate filename if not provided
  const docFilename = filename || InputValidator.sanitizeFilename(tripData.clientName, tripData.destination);
  const docPath = `${docFilename}.html`;

  // Step 1: Create/update the travel document
  let docResult;
  try {
    const existingFile = await client.getFile(docPath, branch);
    docResult = await client.updateFile(docPath, htmlContent, commitMessage, existingFile.sha, branch);
  } catch (error) {
    // File doesn't exist, create new one
    docResult = await client.createFile(docPath, htmlContent, commitMessage, branch);
  }

  // Step 2: Update index.html with trip card
  let indexResult;
  try {
    const indexFile = await client.getFile('index.html', branch);
    IndexManager.validateIndexStructure(indexFile.content);
    
    const updatedIndex = IndexManager.updateTripInIndex(indexFile.content, tripData, docFilename);
    
    indexResult = await client.updateFile(
      'index.html',
      updatedIndex,
      `Update index with ${tripData.clientName} trip`,
      indexFile.sha,
      branch
    );
  } catch (error) {
    if (error instanceof NonRetryableError && error.message.includes('not found')) {
      // Create new index.html
      const newIndex = IndexManager.generateIndexTemplate();
      const updatedIndex = IndexManager.addTripToIndex(newIndex, tripData, docFilename);
      
      indexResult = await client.createFile(
        'index.html',
        updatedIndex,
        'Create index with first trip',
        branch
      );
    } else {
      throw error;
    }
  }

  const documentUrl = `https://${client.owner}.github.io/${client.repo}/${docFilename}.html`;
  const indexUrl = `https://${client.owner}.github.io/${client.repo}/`;

  return {
    content: [{
      type: 'text',
      text: `✅ Travel document published successfully!

**Document**: ${tripData.clientName} - ${tripData.destination}
**File**: ${docPath}
**Status**: ${tripData.status}
**Live URL**: ${documentUrl}
**Portfolio URL**: ${indexUrl}

**Technical Details**:
• Document commit: ${docResult.commit.sha}
• Index update commit: ${indexResult.commit.sha}
• Trip card added to portfolio index
• GitHub Pages will update within a few minutes

The document is now live and ready to share with your client.`
    }]
  };
}

async function handleReplaceIndex(client, args) {
  const { branch = 'main' } = args;
  
  InputValidator.validateBranch(branch);

  // Step 1: Try to backup existing index.html
  let backupResult = null;
  try {
    const existingIndex = await client.getFile('index.html', branch);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = `index-backup-${timestamp}.html`;
    
    backupResult = await client.createFile(
      backupPath,
      existingIndex.content,
      `Backup existing index.html before template replacement`,
      branch
    );
  } catch (error) {
    // No existing index.html to backup
    console.log('No existing index.html found, proceeding without backup');
  }

  // Step 2: Replace with new template
  const newTemplate = IndexManager.generateIndexTemplate();
  
  let templateResult;
  try {
    // Try to update existing file
    const existingIndex = await client.getFile('index.html', branch);
    templateResult = await client.updateFile(
      'index.html',
      newTemplate,
      'Replace index.html with modern template',
      existingIndex.sha,
      branch
    );
  } catch (error) {
    // Create new file if it doesn't exist
    templateResult = await client.createFile(
      'index.html',
      newTemplate,
      'Create modern index.html template',
      branch
    );
  }

  const portfolioUrl = `https://${client.owner}.github.io/${client.repo}/`;
  const backupInfo = backupResult 
    ? `\n• Backup created: index-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.html`
    : '\n• No existing index.html found (no backup needed)';

  return {
    content: [{
      type: 'text',
      text: `✅ Index template replacement completed!

**New Features**:
• Modern responsive design with CSS Grid
• Professional gradient background
• Hover effects on trip cards
• Mobile-optimized layout
• Built-in styling (no external CSS needed)

**Live Portfolio**: ${portfolioUrl}

**Technical Details**:
• Commit SHA: ${templateResult.commit.sha}${backupInfo}
• Template includes trips-grid container ready for trip cards
• GitHub Pages will update within a few minutes

Your travel document portfolio is now ready with a modern, professional design!`
    }]
  };
}

// Health check endpoint
async function handleHealthCheck(env) {
  try {
    const client = new GitHubClient(env);
    const health = await client.healthCheck();
    
    return Response.json({
      github_token: !!env.GITHUB_TOKEN,
      environment: env.ENVIRONMENT || 'unknown',
      github_repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    return Response.json({
      github_token: !!env.GITHUB_TOKEN,
      environment: env.ENVIRONMENT || 'unknown',
      github_repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}

// Export Cloudflare Workers fetch handler
export default {
  async fetch(request, env, ctx) {
    // Set global environment
    globalEnv = env;

    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return handleHealthCheck(env);
    }
    
    // SSE endpoint for MCP
    if (url.pathname === '/sse') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
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
                    name: "GitHub MCP Server",
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
                  tools: [
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
                      name: 'publish_travel_document',
                      description: 'Complete workflow to publish travel document and update index.html',
                      inputSchema: zodToJsonSchema(PublishDocumentSchema)
                    },
                    {
                      name: 'replace_index_template',
                      description: 'Backup current index.html and replace with modern template',
                      inputSchema: zodToJsonSchema(ReplaceIndexSchema)
                    }
                  ]
                }
              };
              break;

            case "tools/call":
              const toolName = body.params.name;
              const toolArgs = body.params.arguments || {};
              
              try {
                const client = new GitHubClient(globalEnv);
                
                let result;
                switch (toolName) {
                  case 'github_create_file':
                    result = await handleCreateFile(client, toolArgs);
                    break;
                  
                  case 'github_update_file':
                    result = await handleUpdateFile(client, toolArgs);
                    break;
                  
                  case 'github_get_file':
                    result = await handleGetFile(client, toolArgs);
                    break;
                  
                  case 'github_list_files':
                    result = await handleListFiles(client, toolArgs);
                    break;
                  
                  case 'publish_travel_document':
                    result = await handlePublishDocument(client, toolArgs);
                    break;
                  
                  case 'replace_index_template':
                    result = await handleReplaceIndex(client, toolArgs);
                    break;
                  
                  default:
                    throw new ValidationError(`Unknown tool: ${toolName}`);
                }

                response = {
                  jsonrpc: "2.0",
                  id: body.id,
                  result
                };
              } catch (error) {
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
        } catch (error) {
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
      message: 'GitHub MCP Server',
      endpoints: {
        health: '/health',
        mcp: '/sse'
      }
    });
  }
};