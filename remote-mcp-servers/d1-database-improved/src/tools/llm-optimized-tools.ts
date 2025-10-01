// Import all tool categories
import { getAnythingTool, continueTripTool } from './search-tools';
import { refreshTripSearchSurfaceTool } from './search-surface';
import { rememberContextTool, regenerateContextTool } from './context-tools';
import { 
  advanceWorkflowPhaseTool, 
  setWorkflowStepTool, 
  getWorkflowStatusTool, 
  getWorkflowInstructionsTool, 
  initializeWorkflowTool 
} from './workflow-tools';
import { 
  createTripV2Tool, 
  createTripWithClientTool, 
  updateActivitylogClientsTool, 
  resetActivitylogFromTripsTool, 
  bulkTripOperationsTool 
} from './trip-tools';
import { 
  createClientV2Tool, 
  cleanupDuplicateClientsTool, 
  cleanupDuplicateTripsTool 
} from './client-tools';
import { 
  analyzeRecentErrorsTool, 
  resolveErrorPatternTool, 
  getRecentActivitiesTool 
} from './operations-tools';
import { refreshTripFactsTool } from './fact-management';
import { importTripPageTool, getTripDocumentsTool, importTripPageAndParseTool, previewTravelDocTool } from './import-tools';

/**
 * LLM-Optimized Tools - Refactored Version
 * 
 * This file has been refactored from a single 3980-line file into modular components:
 * 
 * 1. search-tools.ts - Main search functionality and trip continuation
 * 2. context-tools.ts - Context management and memory tools
 * 3. workflow-tools.ts - Trip workflow phase management
 * 4. trip-tools.ts - Trip creation and management operations
 * 5. client-tools.ts - Client management and cleanup tools
 * 6. operations-tools.ts - Analytics, error handling, and activity tracking
 * 
 * All tools maintain the same functionality and API as the original monolithic file.
 * The refactoring improves maintainability, readability, and development workflow.
 */

// Export all LLM-optimized tools in the same order as the original file
export const llmOptimizedTools = [
  // Core search functionality
  getAnythingTool,
  
  // Context management
  rememberContextTool,
  
  // Trip operations
  bulkTripOperationsTool,
  
  // Database maintenance
  updateActivitylogClientsTool,
  resetActivitylogFromTripsTool,
  
  // Context regeneration
  regenerateContextTool,
  
  // Trip and client creation
  createTripV2Tool,
  createClientV2Tool,
  createTripWithClientTool,
  
  // Workflow management tools
  advanceWorkflowPhaseTool,
  setWorkflowStepTool,
  getWorkflowStatusTool,
  getWorkflowInstructionsTool,
  initializeWorkflowTool,
  
  // Error analysis tools
  analyzeRecentErrorsTool,
  resolveErrorPatternTool,
  
  // Recent activity retrieval for CTA startup
  getRecentActivitiesTool,
  refreshTripSearchSurfaceTool,
  refreshTripFactsTool,
  importTripPageTool,
  getTripDocumentsTool,
  importTripPageAndParseTool,
  previewTravelDocTool,
  
  // Continue command tool
  continueTripTool,
  
  // Database cleanup tools
  cleanupDuplicateClientsTool,
  cleanupDuplicateTripsTool
];

// Re-export individual tools for direct access if needed
export {
  // Search tools
  getAnythingTool,
  continueTripTool,
  
  // Context tools
  rememberContextTool,
  regenerateContextTool,
  
  // Workflow tools
  advanceWorkflowPhaseTool,
  setWorkflowStepTool,
  getWorkflowStatusTool,
  getWorkflowInstructionsTool,
  initializeWorkflowTool,
  
  // Trip tools
  createTripV2Tool,
  createTripWithClientTool,
  updateActivitylogClientsTool,
  resetActivitylogFromTripsTool,
  bulkTripOperationsTool,
  
  // Client tools
  createClientV2Tool,
  cleanupDuplicateClientsTool,
  cleanupDuplicateTripsTool,
  
  // Operations tools
  analyzeRecentErrorsTool,
  resolveErrorPatternTool,
  getRecentActivitiesTool,
  refreshTripSearchSurfaceTool,
  refreshTripFactsTool
  ,importTripPageTool
  ,getTripDocumentsTool
  ,importTripPageAndParseTool
  ,previewTravelDocTool
};
