/**
 * Prompt Instructions D1 MCP Server - Enhanced with Versioning
 * Dynamic instruction management using Cloudflare D1 database with full version tracking
 * Using direct JSON-RPC implementation for Cloudflare Workers compatibility
 */

// Environment interface
interface Env {
  DB: D1Database;
  INSTRUCTIONS_CACHE: KVNamespace;
  MCP_AUTH_KEY: string;
}

// Database helper functions with enhanced versioning support
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
    let query = 'SELECT id, name, title, category, version, version_tag, change_summary, updated_at FROM instruction_sets WHERE active = 1';
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
    version_tag?: string;
    change_summary?: string;
    changed_by?: string;
  }) {
    const result = await this.db
      .prepare(`
        INSERT INTO instruction_sets (
          name, title, content, category, 
          version_tag, change_summary, last_changed_by,
          version, version_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
      `)
      .bind(
        data.name, 
        data.title, 
        data.content, 
        data.category || 'general',
        data.version_tag || 'stable',
        data.change_summary || 'Initial creation',
        data.changed_by || 'admin'
      )
      .run();

    // Log to changelog
    await this.logChange({
      instruction_id: result.meta?.last_row_id as number,
      action: 'created',
      change_description: data.change_summary || 'Initial creation',
      changed_by: data.changed_by || 'admin'
    });

    // Clear cache
    if (this.cache) {
      await this.cache.delete(`instruction:${data.name}`);
    }

    return result;
  }

  async updateInstructionVersioned(name: string, data: {
    title?: string;
    content?: string;
    category?: string;
    change_summary: string;
    changed_by: string;
    is_major_change?: boolean;
  }) {
    // Get current instruction
    const current = await this.getInstruction(name);
    if (!current) {
      throw new Error(`Instruction '${name}' not found`);
    }

    // Archive current version
    await this.archiveVersion(current, data.change_summary, data.changed_by, data.is_major_change);

    // Update the instruction
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

    // Add version-related updates
    updates.push('version = version + 1');
    updates.push('version_count = version_count + 1');
    updates.push('change_summary = ?');
    params.push(data.change_summary);
    updates.push('last_changed_by = ?');
    params.push(data.changed_by);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    if (data.is_major_change) {
      updates.push('last_major_version = version + 1');
    }

    params.push(name);

    const result = await this.db
      .prepare(`UPDATE instruction_sets SET ${updates.join(', ')} WHERE name = ?`)
      .bind(...params)
      .run();

    // Log changes
    await this.logChange({
      instruction_id: current.id,
      action: 'updated',
      change_description: data.change_summary,
      changed_by: data.changed_by
    });

    // Clear cache
    if (this.cache) {
      await this.cache.delete(`instruction:${name}`);
    }

    // Prune old versions if needed
    await this.pruneOldVersions(current.id, current.max_versions || 10);

    return result;
  }

  async archiveVersion(instruction: any, change_summary: string, changed_by: string, is_major_version?: boolean) {
    await this.db
      .prepare(`
        INSERT INTO instruction_versions (
          instruction_id, name, title, content, category, 
          version, version_tag, change_summary, changed_by, 
          is_major_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        instruction.id,
        instruction.name,
        instruction.title,
        instruction.content,
        instruction.category,
        instruction.version,
        instruction.version_tag,
        change_summary,
        changed_by,
        is_major_version ? 1 : 0,
        instruction.updated_at || instruction.created_at
      )
      .run();
  }

  async listInstructionVersions(name: string, limit: number = 10) {
    const instruction = await this.getInstruction(name);
    if (!instruction) {
      throw new Error(`Instruction '${name}' not found`);
    }

    const result = await this.db
      .prepare(`
        SELECT version_id, version, version_tag, change_summary, 
               changed_by, created_at, is_major_version
        FROM instruction_versions 
        WHERE instruction_id = ? 
        ORDER BY version DESC 
        LIMIT ?
      `)
      .bind(instruction.id, limit)
      .all();

    return result.results;
  }

  async getInstructionVersion(name: string, version: number) {
    const instruction = await this.getInstruction(name);
    if (!instruction) {
      throw new Error(`Instruction '${name}' not found`);
    }

    const result = await this.db
      .prepare(`
        SELECT * FROM instruction_versions 
        WHERE instruction_id = ? AND version = ?
      `)
      .bind(instruction.id, version)
      .first();

    return result;
  }

  async restoreInstructionVersion(name: string, version: number, changed_by: string) {
    const instruction = await this.getInstruction(name);
    if (!instruction) {
      throw new Error(`Instruction '${name}' not found`);
    }

    const versionData = await this.getInstructionVersion(name, version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for instruction '${name}'`);
    }

    // Archive current version before restore
    await this.archiveVersion(
      instruction, 
      `Before restore to version ${version}`, 
      changed_by
    );

    // Restore the version
    await this.db
      .prepare(`
        UPDATE instruction_sets 
        SET title = ?, content = ?, category = ?, 
            version = version + 1, version_count = version_count + 1,
            change_summary = ?, last_changed_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        versionData.title,
        versionData.content,
        versionData.category,
        `Restored from version ${version}`,
        changed_by,
        instruction.id
      )
      .run();

    // Log the restore
    await this.logChange({
      instruction_id: instruction.id,
      version_id: versionData.version_id,
      action: 'restored',
      change_description: `Restored from version ${version}`,
      changed_by
    });

    // Clear cache
    if (this.cache) {
      await this.cache.delete(`instruction:${name}`);
    }

    return { success: true, message: `Restored to version ${version}` };
  }

  async diffInstructionVersions(name: string, version1: number, version2: number) {
    const v1 = await this.getInstructionVersion(name, version1);
    const v2 = await this.getInstructionVersion(name, version2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    // Simple diff - in a real implementation, you'd use a proper diff algorithm
    const changes = {
      title: v1.title !== v2.title ? { old: v1.title, new: v2.title } : null,
      content: v1.content !== v2.content ? { 
        old_length: v1.content.length, 
        new_length: v2.content.length,
        changed: true 
      } : null,
      category: v1.category !== v2.category ? { old: v1.category, new: v2.category } : null,
      metadata: {
        version1: { version: v1.version, changed_by: v1.changed_by, created_at: v1.created_at },
        version2: { version: v2.version, changed_by: v2.changed_by, created_at: v2.created_at }
      }
    };

    return changes;
  }

  async bulkUpdateInstructions(updates: Array<{
    name: string;
    field: string;
    old_value: string;
    new_value: string;
  }>, changed_by: string) {
    const results = [];

    for (const update of updates) {
      try {
        const instruction = await this.getInstruction(update.name);
        if (!instruction) {
          results.push({ name: update.name, success: false, error: 'Not found' });
          continue;
        }

        // Check if the field contains the old value
        const currentValue = instruction[update.field];
        if (typeof currentValue !== 'string' || !currentValue.includes(update.old_value)) {
          results.push({ name: update.name, success: false, error: 'Old value not found in field' });
          continue;
        }

        // Replace the value
        const newValue = currentValue.replace(new RegExp(update.old_value, 'g'), update.new_value);
        
        // Update the instruction
        await this.updateInstructionVersioned(update.name, {
          [update.field]: newValue,
          change_summary: `Bulk update: replaced '${update.old_value}' with '${update.new_value}' in ${update.field}`,
          changed_by
        });

        results.push({ name: update.name, success: true });
      } catch (error: any) {
        results.push({ name: update.name, success: false, error: error.message });
      }
    }

    return results;
  }

  async exportInstructions(category?: string) {
    const instructions = await this.listInstructions(category);
    const fullInstructions = [];

    for (const inst of instructions) {
      const full = await this.getInstruction(inst.name);
      if (full) {
        fullInstructions.push({
          name: full.name,
          title: full.title,
          content: full.content,
          category: full.category,
          version: full.version,
          version_tag: full.version_tag,
          metadata: {
            created_at: full.created_at,
            updated_at: full.updated_at,
            version_count: full.version_count,
            last_changed_by: full.last_changed_by
          }
        });
      }
    }

    return {
      export_date: new Date().toISOString(),
      instruction_count: fullInstructions.length,
      instructions: fullInstructions
    };
  }

  async importInstructions(data: {
    instructions: Array<{
      name: string;
      title: string;
      content: string;
      category?: string;
    }>;
    changed_by: string;
    overwrite?: boolean;
  }) {
    const results = [];

    for (const inst of data.instructions) {
      try {
        const existing = await this.getInstruction(inst.name);
        
        if (existing && !data.overwrite) {
          results.push({ name: inst.name, success: false, error: 'Already exists' });
          continue;
        }

        if (existing) {
          // Update existing
          await this.updateInstructionVersioned(inst.name, {
            title: inst.title,
            content: inst.content,
            category: inst.category,
            change_summary: 'Imported from external source',
            changed_by: data.changed_by
          });
          results.push({ name: inst.name, success: true, action: 'updated' });
        } else {
          // Create new
          await this.createInstruction({
            ...inst,
            change_summary: 'Imported from external source',
            changed_by: data.changed_by
          });
          results.push({ name: inst.name, success: true, action: 'created' });
        }
      } catch (error: any) {
        results.push({ name: inst.name, success: false, error: error.message });
      }
    }

    return results;
  }

  async pruneOldVersions(instructionId: number, keepCount: number = 10) {
    // Get all versions except major ones
    const versions = await this.db
      .prepare(`
        SELECT version_id, version 
        FROM instruction_versions 
        WHERE instruction_id = ? AND is_major_version = 0
        ORDER BY version DESC
      `)
      .bind(instructionId)
      .all();

    if (versions.results.length <= keepCount) {
      return; // Nothing to prune
    }

    // Delete old versions
    const toDelete = versions.results.slice(keepCount);
    for (const version of toDelete) {
      await this.db
        .prepare('DELETE FROM instruction_versions WHERE version_id = ?')
        .bind(version.version_id)
        .run();
    }
  }

  async logChange(data: {
    instruction_id: number;
    version_id?: number;
    action: string;
    field_changed?: string;
    old_value?: string;
    new_value?: string;
    change_description?: string;
    changed_by: string;
    session_id?: string;
  }) {
    await this.db
      .prepare(`
        INSERT INTO instruction_changelog (
          instruction_id, version_id, action, field_changed,
          old_value, new_value, change_description, changed_by, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.instruction_id,
        data.version_id || null,
        data.action,
        data.field_changed || null,
        data.old_value || null,
        data.new_value || null,
        data.change_description || null,
        data.changed_by,
        data.session_id || null
      )
      .run();
  }

  // Existing methods remain unchanged
  async getInstructionsByConfidence(confidenceLevel: string) {
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
    if (instructionName) {
      const specific = await this.db
        .prepare('SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_type = ?')
        .bind('default', `instruction_verbosity_${instructionName}`)
        .first();
      if (specific) return specific.preference_value as string;
    }
    
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
    
    const updateResult = await this.db
      .prepare(`
        UPDATE user_preferences 
        SET preference_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND preference_type = ?
      `)
      .bind(verbosity, 'default', prefType)
      .run();
    
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
            version: '2.0.0'
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            // Existing tools
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
                  version_tag: {
                    type: 'string',
                    enum: ['draft', 'stable', 'deprecated'],
                    description: 'Version tag for the instruction',
                  },
                  change_summary: {
                    type: 'string',
                    description: 'Summary of what this instruction contains',
                  },
                  changed_by: {
                    type: 'string',
                    description: 'Identifier of who is creating this instruction',
                  },
                },
                required: ['name', 'title', 'content'],
              },
            },
            // New versioned update tool
            {
              name: 'update_instruction_versioned',
              description: 'Update an instruction with automatic version tracking and archival',
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
                  change_summary: {
                    type: 'string',
                    description: 'Summary of changes made (required)',
                  },
                  changed_by: {
                    type: 'string',
                    description: 'Identifier of who is making changes (required)',
                  },
                  is_major_change: {
                    type: 'boolean',
                    description: 'Mark this as a major version change',
                  },
                },
                required: ['name', 'change_summary', 'changed_by'],
              },
            },
            // Version management tools
            {
              name: 'list_instruction_versions',
              description: 'List version history for an instruction',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the instruction',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of versions to return (default: 10)',
                  },
                },
                required: ['name'],
              },
            },
            {
              name: 'restore_instruction_version',
              description: 'Restore an instruction to a previous version',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the instruction',
                  },
                  version: {
                    type: 'number',
                    description: 'Version number to restore',
                  },
                  changed_by: {
                    type: 'string',
                    description: 'Who is performing the restore',
                  },
                },
                required: ['name', 'version', 'changed_by'],
              },
            },
            {
              name: 'diff_instruction_versions',
              description: 'Compare two versions of an instruction',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the instruction',
                  },
                  version1: {
                    type: 'number',
                    description: 'First version number',
                  },
                  version2: {
                    type: 'number',
                    description: 'Second version number',
                  },
                },
                required: ['name', 'version1', 'version2'],
              },
            },
            // Bulk operations
            {
              name: 'bulk_update_instructions',
              description: 'Update multiple instructions using find/replace',
              inputSchema: {
                type: 'object',
                properties: {
                  updates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        field: { type: 'string', enum: ['title', 'content', 'category'] },
                        old_value: { type: 'string' },
                        new_value: { type: 'string' },
                      },
                      required: ['name', 'field', 'old_value', 'new_value'],
                    },
                    description: 'Array of updates to perform',
                  },
                  changed_by: {
                    type: 'string',
                    description: 'Who is performing the bulk update',
                  },
                },
                required: ['updates', 'changed_by'],
              },
            },
            {
              name: 'export_instructions',
              description: 'Export instructions to JSON format',
              inputSchema: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Optional category filter',
                  },
                },
              },
            },
            {
              name: 'import_instructions',
              description: 'Import instructions from JSON format',
              inputSchema: {
                type: 'object',
                properties: {
                  instructions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        title: { type: 'string' },
                        content: { type: 'string' },
                        category: { type: 'string' },
                      },
                      required: ['name', 'title', 'content'],
                    },
                    description: 'Array of instructions to import',
                  },
                  changed_by: {
                    type: 'string',
                    description: 'Who is performing the import',
                  },
                  overwrite: {
                    type: 'boolean',
                    description: 'Overwrite existing instructions',
                  },
                },
                required: ['instructions', 'changed_by'],
              },
            },
            // Existing tools continue...
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
          ],
        },
      };

    case 'tools/call':
      try {
        const { name, arguments: args } = json.params;
        const manager = new InstructionManager(env.DB, env.INSTRUCTIONS_CACHE);

        switch (name) {
          // Existing tool handlers remain mostly unchanged
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

            const verbosity = args.verbosity || await manager.getVerbosityPreference(args.name);
            let responseText: string;
            
            switch (verbosity) {
              case 'minimal':
                responseText = instruction.content;
                break;
                
              case 'verbose':
                responseText = `# ${instruction.title}\n\n${instruction.content}\n\n` +
                  `---\n\n` +
                  `**Metadata:**\n` +
                  `- **Name**: ${instruction.name}\n` +
                  `- **Category**: ${instruction.category}\n` +
                  `- **Version**: ${instruction.version}\n` +
                  `- **Version Tag**: ${instruction.version_tag || 'stable'}\n` +
                  `- **Active**: ${instruction.active ? 'Yes' : 'No'}\n` +
                  `- **Created**: ${instruction.created_at}\n` +
                  `- **Last Updated**: ${instruction.updated_at}\n` +
                  `- **Last Change**: ${instruction.change_summary || 'N/A'}\n` +
                  `- **Changed By**: ${instruction.last_changed_by || 'N/A'}\n` +
                  `- **Verbosity**: ${verbosity}`;
                break;
                
              case 'normal':
              default:
                responseText = `# ${instruction.title}\n\n${instruction.content}\n\n` +
                  `**Category**: ${instruction.category}\n` +
                  `**Version**: ${instruction.version}\n` +
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
              const categories: Record<string, any[]> = {};
              for (const inst of instructions) {
                const cat = inst.category || 'general';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(inst);
              }

              Object.entries(categories).forEach(([category, items]) => {
                output += `## ${category.toUpperCase()}\n`;
                items.forEach((inst) => {
                  output += `- **${inst.name}**: ${inst.title} (v${inst.version}`;
                  if (inst.version_tag && inst.version_tag !== 'stable') {
                    output += `, ${inst.version_tag}`;
                  }
                  output += ')\n';
                  if (inst.change_summary) {
                    output += `  *Last change: ${inst.change_summary}*\n`;
                  }
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

          // New versioned update handler
          case 'update_instruction_versioned': {
            const result = await manager.updateInstructionVersioned(args.name, args);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `✅ Updated instruction '${args.name}' (${result.meta?.changes} changes)\n` +
                          `Version incremented and previous version archived.\n` +
                          `Change summary: ${args.change_summary}`,
                  },
                ],
              },
            };
          }

          // New version management handlers
          case 'list_instruction_versions': {
            const versions = await manager.listInstructionVersions(args.name, args.limit || 10);
            let output = `# Version History for '${args.name}'\n\n`;

            if (versions.length === 0) {
              output += 'No version history found.\n';
            } else {
              versions.forEach((v: any) => {
                output += `## Version ${v.version}${v.is_major_version ? ' (Major)' : ''}\n`;
                output += `- **Tag**: ${v.version_tag || 'none'}\n`;
                output += `- **Changed by**: ${v.changed_by}\n`;
                output += `- **Date**: ${v.created_at}\n`;
                output += `- **Summary**: ${v.change_summary}\n\n`;
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

          case 'restore_instruction_version': {
            const result = await manager.restoreInstructionVersion(
              args.name, 
              args.version, 
              args.changed_by
            );
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `✅ ${result.message}`,
                  },
                ],
              },
            };
          }

          case 'diff_instruction_versions': {
            const diff = await manager.diffInstructionVersions(
              args.name, 
              args.version1, 
              args.version2
            );
            let output = `# Diff: Version ${args.version1} → Version ${args.version2}\n\n`;
            
            if (diff.title) {
              output += `## Title Changed\n- Old: ${diff.title.old}\n- New: ${diff.title.new}\n\n`;
            }
            
            if (diff.content) {
              output += `## Content Changed\n- Old length: ${diff.content.old_length} chars\n` +
                       `- New length: ${diff.content.new_length} chars\n` +
                       `- Change: ${diff.content.new_length - diff.content.old_length} chars\n\n`;
            }
            
            if (diff.category) {
              output += `## Category Changed\n- Old: ${diff.category.old}\n- New: ${diff.category.new}\n\n`;
            }

            output += `## Version Metadata\n`;
            output += `### Version ${args.version1}\n`;
            output += `- Changed by: ${diff.metadata.version1.changed_by}\n`;
            output += `- Date: ${diff.metadata.version1.created_at}\n\n`;
            output += `### Version ${args.version2}\n`;
            output += `- Changed by: ${diff.metadata.version2.changed_by}\n`;
            output += `- Date: ${diff.metadata.version2.created_at}\n`;

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

          case 'bulk_update_instructions': {
            const results = await manager.bulkUpdateInstructions(args.updates, args.changed_by);
            let output = `# Bulk Update Results\n\n`;
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            output += `✅ Successful: ${successful.length}\n`;
            output += `❌ Failed: ${failed.length}\n\n`;
            
            if (failed.length > 0) {
              output += `## Failed Updates\n`;
              failed.forEach(f => {
                output += `- **${f.name}**: ${f.error}\n`;
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

          case 'export_instructions': {
            const exportData = await manager.exportInstructions(args.category);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(exportData, null, 2),
                  },
                ],
              },
            };
          }

          case 'import_instructions': {
            const results = await manager.importInstructions(args);
            let output = `# Import Results\n\n`;
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            output += `✅ Successful: ${successful.length}\n`;
            output += `❌ Failed: ${failed.length}\n\n`;
            
            if (successful.length > 0) {
              output += `## Imported Instructions\n`;
              successful.forEach(s => {
                output += `- **${s.name}**: ${s.action}\n`;
              });
              output += '\n';
            }
            
            if (failed.length > 0) {
              output += `## Failed Imports\n`;
              failed.forEach(f => {
                output += `- **${f.name}**: ${f.error}\n`;
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

          // Existing confidence and verbosity handlers remain unchanged
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

// Cloudflare Worker export - remains unchanged
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
            version: '2.0.0',
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