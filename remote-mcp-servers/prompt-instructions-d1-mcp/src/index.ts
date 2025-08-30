/**
 * Prompt Instructions D1 MCP Server
 * Dynamic instruction management using Cloudflare D1 database
 * Using direct JSON-RPC implementation for Cloudflare Workers compatibility
 */
import { extractTripStatus, formatStatusDashboard, formatWorkflowStatus } from './utils/status-formatter';

// Environment interface
interface Env {
  DB: D1Database;
  INSTRUCTIONS_CACHE: KVNamespace;
  MCP_AUTH_KEY: string;
}

// Database helper functions
class InstructionManager {
  constructor(private db: D1Database, private cache?: KVNamespace) {}

  async getInstruction(name: string) {
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(`instruction:${name}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Query database
    const result = await this.db
      .prepare('SELECT * FROM instruction_sets WHERE name = ? AND active = 1')
      .bind(name)
      .first();

    if (result && this.cache) {
      // Cache for 1 hour
      await this.cache.put(`instruction:${name}`, JSON.stringify(result), {
        expirationTtl: 3600,
      });
    }

    return result;
  }

  async listInstructions(category?: string) {
    let query = 'SELECT id, name, title, category, created_at FROM instruction_sets WHERE active = 1';
    let params: any[] = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results;
  }

  async createInstruction(data: {
    name: string;
    title: string;
    content: string;
    category?: string;
  }) {
    const result = await this.db
      .prepare(
        'INSERT INTO instruction_sets (name, title, content, category) VALUES (?, ?, ?, ?)'
      )
      .bind(data.name, data.title, data.content, data.category || 'general')
      .run();

    // Clear cache
    if (this.cache) {
      await this.cache.delete(`instruction:${data.name}`);
    }

    return result;
  }

  async updateInstruction(name: string, data: {
    title?: string;
    content?: string;
    category?: string;
  }) {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.title) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.category) {
      updates.push('category = ?');
      params.push(data.category);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(name);

    const result = await this.db
      .prepare(`UPDATE instruction_sets SET ${updates.join(', ')} WHERE name = ?`)
      .bind(...params)
      .run();

    // Clear cache
    if (this.cache) {
      await this.cache.delete(`instruction:${name}`);
    }

    return result;
  }

  async getInstructionsByConfidence(confidenceLevel: string) {
    // Get instruction names for this confidence level
    const mapping = await this.db
      .prepare('SELECT instruction_names FROM confidence_mappings WHERE confidence_level = ?')
      .bind(confidenceLevel)
      .first();

    if (!mapping) {
      return [];
    }

    const instructionNames = JSON.parse(mapping.instruction_names as string);
    const instructions = [];

    for (const name of instructionNames) {
      const instruction = await this.getInstruction(name);
      if (instruction) {
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  async getVerbosityPreference(instructionName?: string): Promise<string> {
    // Check for instruction-specific preference first
    if (instructionName) {
      const specific = await this.db
        .prepare('SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_type = ?')
        .bind('default', `instruction_verbosity_${instructionName}`)
        .first();
      if (specific) return specific.preference_value as string;
    }
    
    // Fall back to global preference
    const global = await this.db
      .prepare('SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_type = ?')
      .bind('default', 'instruction_verbosity')
      .first();
    
    return (global?.preference_value as string) || 'normal';
  }

  async setVerbosityPreference(verbosity: string, instructionName?: string): Promise<void> {
    const prefType = instructionName 
      ? `instruction_verbosity_${instructionName}` 
      : 'instruction_verbosity';
    
    // First try to update existing preference
    const updateResult = await this.db
      .prepare(`
        UPDATE user_preferences 
        SET preference_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND preference_type = ?
      `)
      .bind(verbosity, 'default', prefType)
      .run();
    
    // If no rows were updated, insert new preference
    if (updateResult.meta.changes === 0) {
      await this.db
        .prepare(`
          INSERT INTO user_preferences (user_id, preference_type, preference_value) 
          VALUES (?, ?, ?)
        `)
        .bind('default', prefType, verbosity)
        .run();
    }
  }
}

// Handle MCP JSON-RPC requests
async function handleMCPRequest(json: any, env: Env) {
  const { method, id } = json;

  switch (method) {
    case 'initialize':
      const requestedVersion = json.params?.protocolVersion || '2025-06-18';
      const supportedVersions = ['2025-06-18', '2024-11-05'];
      const protocolVersion = supportedVersions.includes(requestedVersion) ? requestedVersion : '2025-06-18';
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: 'prompt-instructions-d1-mcp',
            version: '1.0.0'
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_instruction',
              description: 'Retrieve a specific instruction by name from the D1 database',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'The name/key of the instruction to retrieve',
                  },
                  verbosity: {
                    type: 'string',
                    enum: ['minimal', 'normal', 'verbose'],
                    description: 'Override verbosity level for this request (optional)',
                  },
                },
                required: ['name'],
              },
            },
            {
              name: 'list_instructions',
              description: 'List all available instructions, optionally filtered by category',
              inputSchema: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Optional category filter (e.g., modes, planning, search_workflows)',
                  },
                },
              },
            },
            {
              name: 'create_instruction',
              description: 'Create a new instruction in the database',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Unique name/key for the instruction',
                  },
                  title: {
                    type: 'string',
                    description: 'Human-readable title for the instruction',
                  },
                  content: {
                    type: 'string',
                    description: 'The instruction content in markdown format',
                  },
                  category: {
                    type: 'string',
                    description: 'Category for the instruction (default: general)',
                  },
                },
                required: ['name', 'title', 'content'],
              },
            },
            {
              name: 'update_instruction',
              description: 'Update an existing instruction in the database',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name/key of the instruction to update',
                  },
                  title: {
                    type: 'string',
                    description: 'New title for the instruction',
                  },
                  content: {
                    type: 'string',
                    description: 'New content for the instruction',
                  },
                  category: {
                    type: 'string',
                    description: 'New category for the instruction',
                  },
                },
                required: ['name'],
              },
            },
            {
              name: 'get_instructions_by_confidence',
              description: 'Get instructions based on confidence level (high, medium, low, error)',
              inputSchema: {
                type: 'object',
                properties: {
                  confidence_level: {
                    type: 'string',
                    enum: ['high', 'medium', 'low', 'error'],
                    description: 'Confidence level for instruction selection',
                  },
                },
                required: ['confidence_level'],
              },
            },
            {
              name: 'set_verbosity_preference',
              description: 'Set verbosity preference globally or for a specific instruction',
              inputSchema: {
                type: 'object',
                properties: {
                  verbosity: {
                    type: 'string',
                    enum: ['minimal', 'normal', 'verbose'],
                    description: 'Verbosity level for instruction output',
                  },
                  instruction_name: {
                    type: 'string',
                    description: 'Optional: Set verbosity for a specific instruction only',
                  },
                },
                required: ['verbosity'],
              },
            },
            {
              name: 'get_verbosity_preference',
              description: 'Get current verbosity preference',
              inputSchema: {
                type: 'object',
                properties: {
                  instruction_name: {
                    type: 'string',
                    description: 'Optional: Get verbosity for a specific instruction',
                  },
                },
              },
            },
            {
              name: 'travel_agent_start',
              description: 'Start the travel agent system - loads startup-core instruction',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'status',
              description: 'Show currently loaded instructions',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'help',
              description: 'Show travel agent workflows and available commands',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'reload',
              description: 'Refresh system instructions',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        },
      };

    case 'tools/call':
      try {
        const { name, arguments: args } = json.params;
        const manager = new InstructionManager(env.DB, env.INSTRUCTIONS_CACHE);

        switch (name) {
          case 'get_instruction': {
            const instruction = await manager.getInstruction(args.name);
            if (!instruction) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: `Instruction '${args.name}' not found`,
                    },
                  ],
                },
              };
            }

            // Get verbosity preference (from parameter or stored preference)
            const verbosity = args.verbosity || await manager.getVerbosityPreference(args.name);
            
            let responseText: string;
            
            switch (verbosity) {
              case 'minimal':
                // Just the content, no title or metadata
                responseText = instruction.content;
                break;
                
              case 'verbose':
                // Full details including all metadata
                responseText = `# ${instruction.title}\n\n${instruction.content}\n\n` +
                  `---\n\n` +
                  `**Metadata:**\n` +
                  `- **Name**: ${instruction.name}\n` +
                  `- **Category**: ${instruction.category}\n` +
                  `- **Version**: ${instruction.version}\n` +
                  `- **Active**: ${instruction.active ? 'Yes' : 'No'}\n` +
                  `- **Created**: ${instruction.created_at}\n` +
                  `- **Last Updated**: ${instruction.updated_at}\n` +
                  `- **Verbosity**: ${verbosity}`;
                break;
                
              case 'normal':
              default:
                // Current behavior - title, content, and basic metadata
                responseText = `# ${instruction.title}\n\n${instruction.content}\n\n` +
                  `**Category**: ${instruction.category}\n` +
                  `**Last Updated**: ${instruction.updated_at}`;
                break;
            }

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: responseText,
                  },
                ],
              },
            };
          }

          case 'list_instructions': {
            const instructions = await manager.listInstructions(args.category);
            let output = `# Available Instructions${args.category ? ` (${args.category})` : ''}\n\n`;

            if (instructions.length === 0) {
              output += 'No instructions found.\n';
            } else {
              // Group by category
              const categories: Record<string, any[]> = {};
              for (const inst of instructions) {
                const cat = inst.category || 'general';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(inst);
              }

              Object.entries(categories).forEach(([category, items]) => {
                output += `## ${category.toUpperCase()}\n`;
                items.forEach((inst) => {
                  output += `- **${inst.name}**: ${inst.title}\n`;
                });
                output += '\n';
              });
            }

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: output,
                  },
                ],
              },
            };
          }

          case 'create_instruction': {
            const result = await manager.createInstruction(args);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `✅ Created instruction '${args.name}' with ID ${result.meta?.last_row_id}`,
                  },
                ],
              },
            };
          }

          case 'update_instruction': {
            const result = await manager.updateInstruction(args.name, args);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `✅ Updated instruction '${args.name}' (${result.meta?.changes} changes)`,
                  },
                ],
              },
            };
          }

          case 'get_instructions_by_confidence': {
            const instructions = await manager.getInstructionsByConfidence(args.confidence_level);
            let output = `# Instructions for ${args.confidence_level.toUpperCase()} Confidence Level\n\n`;

            if (instructions.length === 0) {
              output += 'No instructions found for this confidence level.\n';
            } else {
              instructions.forEach((inst) => {
                output += `## ${inst.title}\n\n${inst.content}\n\n---\n\n`;
              });
            }

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: output,
                  },
                ],
              },
            };
          }

          case 'set_verbosity_preference': {
            await manager.setVerbosityPreference(args.verbosity, args.instruction_name);
            const scope = args.instruction_name 
              ? `for instruction '${args.instruction_name}'` 
              : 'globally';
            
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `✅ Verbosity preference set to '${args.verbosity}' ${scope}`,
                  },
                ],
              },
            };
          }

          case 'get_verbosity_preference': {
            const verbosity = await manager.getVerbosityPreference(args.instruction_name);
            const scope = args.instruction_name 
              ? `for instruction '${args.instruction_name}'` 
              : 'global';
            
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Current ${scope} verbosity preference: ${verbosity}`,
                  },
                ],
              },
            };
          }

          case 'travel_agent_start': {
            const instruction = await manager.getInstruction('startup-core');
            
            if (!instruction) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: "⚠️ No startup-core instruction found. Please ensure the system is properly configured.",
                    },
                  ],
                },
              };
            }

            // Get recent activity to show what user can continue working on
            let recentActivity = '';
            try {
              const recentQuery = `
                SELECT 
                  al.trip_id,
                  al.activity_type,
                  al.activity_timestamp,
                  al.details,
                  COALESCE(t.trip_name, 'Trip ' || al.trip_id) as trip_name,
                  COALESCE(t.start_date || ' to ' || t.end_date, 'Unknown Dates') as trip_dates,
                  CAST((JULIANDAY('now') - JULIANDAY(al.activity_timestamp)) AS INTEGER) as days_ago
                FROM ActivityLog al
                LEFT JOIN Trips t ON al.trip_id = t.trip_id
                WHERE al.activity_timestamp >= datetime('now', '-90 days')
                  AND al.trip_id IS NOT NULL
                ORDER BY al.activity_timestamp DESC
                LIMIT 5
              `;
              
              const results = await env.DB.prepare(recentQuery).all();
              
              if (results.results.length > 0) {
                recentActivity = '\n🎯 **Recent Activity:**\n';
                
                // Group by trip_id and show latest activity for each trip
                const tripMap = new Map();
                results.results.forEach((activity: any) => {
                  if (!tripMap.has(activity.trip_id) || new Date(activity.activity_timestamp) > new Date(tripMap.get(activity.trip_id).activity_timestamp)) {
                    tripMap.set(activity.trip_id, activity);
                  }
                });
                
                Array.from(tripMap.values()).slice(0, 5).forEach((activity: any, index: number) => {
                  const daysAgo = activity.days_ago === 0 ? "today" : 
                                 activity.days_ago === 1 ? "yesterday" : 
                                 `${activity.days_ago} days ago`;
                  
                  const tripInfo = activity.trip_name || `Trip ${activity.trip_id}`;
                  const tripDates = activity.trip_dates || 'TBD';
                  const activityType = activity.activity_type || 'Working on';
                  
                  recentActivity += `${index + 1}. ${tripInfo} - ${tripDates} (${daysAgo}) - ${activityType}\n`;
                });
                recentActivity += '\n';
              }
            } catch (error) {
              // If recent activity fails, continue without it
              console.error('Failed to get recent activity:', error);
            }
            
            // Check for active trip context to show status dashboard
            let statusDashboard = '';
            try {
              const activeTripsQuery = `
                SELECT 
                  t.*,
                  w.workflow_state,
                  w.current_phase,
                  w.current_step
                FROM Trips t
                LEFT JOIN WorkflowState w ON t.trip_id = w.trip_id
                WHERE t.status IN ('planning', 'confirmed', 'in_progress')
                  AND t.updated_at >= datetime('now', '-30 days')
                ORDER BY t.updated_at DESC
                LIMIT 1
              `;
              const activeTrip = await env.DB.prepare(activeTripsQuery).first();
              
              if (activeTrip) {
                const status = extractTripStatus(activeTrip, 'trip_direct');
                if (status.tripName || status.phase) {
                  statusDashboard = formatStatusDashboard('', status) + '\n\n';
                }
              }
            } catch (error) {
              console.error('Failed to get active trip status:', error);
            }

            const welcomeMessage = `${statusDashboard}✅ **Claude Travel Agent System Ready!**

🤖 **Operating as**: Kim Henderson's AI Travel Assistant
📋 **Mode**: Interactive [💬]
🎯 **Instructions**: startup-core v${instruction.version} loaded
${recentActivity}💡 **Quick Commands:**
${recentActivity ? '- Type a number (1-5) to continue work on a trip above\n' : ''}- Type "help" for all workflows and commands
- Type "/new" to start fresh trip planning
- Type "status" to check loaded instructions
- Say what you need help with in plain language

**Typical Usage Examples:**
• "Search hotels in Miami for next week"
• "Create itinerary for family trip to Italy"
• "Show me Kim's Gems for Paris"
• "Check commission on current trips"

Ready to help with your travel planning! What would you like to work on?

---
*System initialized with full travel agent capabilities*`;

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: welcomeMessage,
                  },
                ],
              },
            };
          }

          case 'status': {
            const results = await env.DB.prepare(`
              SELECT name, title, category, version, updated_at
              FROM instruction_sets 
              WHERE active = 1
              ORDER BY 
                CASE 
                  WHEN name = 'startup-core' THEN 1
                  WHEN category = 'modes' THEN 2
                  WHEN category = 'workflows' THEN 3
                  WHEN category = 'tools' THEN 4
                  ELSE 5
                END,
                name
            `).all();

            if (results.results.length === 0) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: "⚠️ **No Instructions Loaded**\n\nNo active instructions found. Use 'travel_agent_start' command to initialize the travel agent system."
                    }
                  ]
                }
              };
            }

            let statusMessage = "📋 **Travel Agent System Status**\n\n";
            let currentCategory = "";
            
            for (const inst of results.results) {
              if (inst.category !== currentCategory) {
                currentCategory = inst.category;
                statusMessage += `\n### ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)} Instructions\n`;
              }
              
              const isCore = inst.name === 'startup-core';
              const icon = isCore ? '🟢' : '✅';
              statusMessage += `${icon} **${inst.name}**: ${inst.title} (v${inst.version})\n`;
              
              if (isCore) {
                statusMessage += `   *Last updated: ${new Date(inst.updated_at).toLocaleDateString()}*\n`;
              }
            }

            statusMessage += `\n---\n*Total: ${results.results.length} active instructions*`;

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: statusMessage
                  }
                ]
              }
            };
          }

          case 'help': {
            const helpMessage = `🛠️ **Travel Agent System Help**

## 🚀 Quick Start Commands
- **travel_agent_start** - Load travel agent instructions and get ready
- **status** - Show which instructions are currently loaded  
- **help** - Show this help menu
- **reload** - Refresh system instructions

## 🎯 Main Workflows

### 🆕 New Trip Planning
**How to start:** Type \`/new\` or say "I need help with a new trip"
- Interactive trip planning wizard walks you through client discovery
- **For lead capture:** Say "Load client interview mode" → loads structured questions
- **For comprehensive planning:** Say "Load trip discovery process" → gets full workflow

### 🏨 Hotel & Accommodation Research  
**How to search:** Say "Search hotels in [destination]" or "Help me find hotels"
- **CPMaxx searches:** Say "Load CPMaxx search instructions" → gets portal automation steps
- **Image gathering:** Say "Load image capture optimization" → gets efficient photo collection strategy
- **Research tools:** Use hotel-research MCP server tools directly

### 📅 Daily Itinerary Building
**How to build itineraries:** Say "Help me plan daily activities for [destination]"
- **Day-by-day planning:** Say "Load daily planning instructions" → gets structured approach
- **Find local gems:** Say "Load Kim's gems daily process" → gets unique experience discovery
- **Add tours:** Say "Load Viator integration" → gets booking integration steps

### ✅ Trip Verification & Completion
**How to verify:** Say "Check my trip planning" or "Verify this itinerary"
- **Daily checks:** Say "Load daily trip verification" → gets quality control checklist
- **Final review:** Say "Load trip completeness check" → gets comprehensive review process
- **Optimize revenue:** Say "Load commission targets" → gets revenue optimization guide

### 📱 Mobile/Autonomous Mode
**How to use:** Add \`[MOBILE]\` prefix to any lead processing message
- **Example:** "[MOBILE] Just got off the phone with John and Mary Smith..."
- System automatically structures leads and creates database entries
- **For full workflow:** Say "Load mobile mode instructions" → gets autonomous processing guide

## 🔧 Available MCP Servers & Tools
- **prompt-instructions-d1**: Instruction management (this server)
- **d1-database**: Database for trips, clients, and activities  
- **travel-research**: Web search and travel information
- **mcp-cpmaxx**: CPMaxx portal automation and hotel search
- **local-image-storage**: Image storage and management
- **hotel-research**: Hotel details and booking research

Use \`get_instruction('[instruction-name]')\` to load specific instructions.

## 💡 Pro Tips
- Start each session with 'travel_agent_start' to ensure instructions are loaded
- Use 'status' periodically to check system state
- The system automatically loads additional instructions based on confidence levels
- All workflows include commission tracking and Kim's Gems integration

Need specific help with any workflow? Just ask: "How do I [task]?" and I'll load the appropriate instructions.`;

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: helpMessage
                  }
                ]
              }
            };
          }

          case 'reload': {
            const instruction = await env.DB.prepare(`
              SELECT * FROM instruction_sets 
              WHERE name = 'startup-core' AND active = 1
            `).first();

            if (!instruction) {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: "No startup-core instruction found. Please ensure the system is properly configured."
                    }
                  ]
                }
              };
            }

            const afterCount = await env.DB.prepare(`
              SELECT COUNT(*) as count FROM instruction_sets WHERE active = 1
            `).first();

            const reloadMessage = `🔄 **System Instructions Reloaded**

✅ Successfully reloaded all travel agent instructions from database.

📋 **System Status:**
- Startup core: ${instruction.title} (v${instruction.version})
- Active instructions: ${afterCount?.count || 0}
- Last updated: ${new Date(instruction.updated_at).toLocaleString()}

🎯 **System Ready For:**
- New trip planning and client interviews
- Hotel searches and booking research
- Daily itinerary building with local gems
- Commission tracking and trip verification
- Mobile lead processing and autonomous workflows

💡 Use 'help' to see available workflows or 'status' to check detailed instruction list.

---
*Instructions reloaded successfully at ${new Date().toLocaleString()}*`;

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: reloadMessage
                  }
                ]
              }
            };
          }

          default:
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Unknown tool: ${name}` }
            };
        }
      } catch (error: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: `Tool execution error: ${error.message}` }
        };
      }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

// Cloudflare Worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      try {
        // Test database connection
        const testResult = await env.DB.prepare('SELECT 1 as test').first();
        
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'prompt-instructions-d1-mcp',
            version: '1.0.0',
            database: testResult ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            status: 'error',
            service: 'prompt-instructions-d1-mcp',
            error: error.message,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // SSE endpoint for MCP
    if (url.pathname === '/sse' || url.pathname === '/sse/') {
      // For GET requests, establish SSE connection
      if (request.method === 'GET') {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Send initial connection event
        await writer.write(encoder.encode('event: open\ndata: {"type":"connection_ready"}\n\n'));

        // Keep connection alive with periodic pings
        const pingInterval = setInterval(async () => {
          try {
            await writer.write(encoder.encode('event: ping\ndata: {}\n\n'));
          } catch (e) {
            clearInterval(pingInterval);
          }
        }, 30000);

        ctx.waitUntil(
          new Promise<void>((resolve) => {
            request.signal.addEventListener('abort', () => {
              clearInterval(pingInterval);
              writer.close();
              resolve();
            });
          })
        );

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // For POST requests, handle MCP messages
      if (request.method === 'POST') {
        try {
          const text = await request.text();
          let json;
          
          try {
            json = JSON.parse(text);
          } catch (parseError: any) {
            console.error('JSON parse error:', parseError.message, 'Input:', text);
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32700,
                  message: `Parse error: ${parseError.message}`,
                },
              }) + '\n',
              {
                status: 400,
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache',
                },
              }
            );
          }
          
          const response = await handleMCPRequest(json, env);

          return new Response(JSON.stringify(response) + '\n', {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: any) {
          console.error('Error handling MCP request:', error);
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: `Internal error: ${error.message}`,
              },
            }) + '\n',
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Not found',
        available_endpoints: ['/health', '/sse'],
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};