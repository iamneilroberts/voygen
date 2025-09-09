// ============================================================================
// Render System - Complete Travel Proposal Rendering with Remix Support
// ============================================================================

// Legacy exports for backward compatibility
export { TemplateEngine } from './engine';
export { ProposalGenerator } from './proposal-generator';
export { BatchImageProcessor } from './image-manager';
export { PDFGenerator } from './pdf-generator';

// Core types
export * from './types';

// Theme system exports
export * from './themes';

// Template system exports  
export * from './templates';

// Remix system exports (main interface)
export * from './remix-system';

// Advanced interfaces
export { RemixEngine, remixEngine } from './remix-engine';
export { PresetManager, presetManager } from './preset-manager';

// Utility functions
export { convertTripDataToProposalData } from '../tools/proposal-tools';

// ============================================================================
// Convenience Functions for Easy Integration
// ============================================================================

import { 
  remixSystem, 
  generateFromPreset as _generateFromPreset,
  generateQuickRemix as _generateQuickRemix,
  getRemixRecommendations as _getRemixRecommendations,
  getBestRecommendation as _getBestRecommendation,
  getSystemStats as _getSystemStats
} from './remix-system';

import { ProposalData, ProposalRemix, RemixGenerationOptions, QuickRemixOptions } from './remix-system';

// Main generation functions
export const generateFromPreset = _generateFromPreset;
export const generateQuickRemix = _generateQuickRemix;
export const getRemixRecommendations = _getRemixRecommendations;
export const getBestRecommendation = _getBestRecommendation;
export const getSystemStats = _getSystemStats;

// Quick access to remix system
export const remix = remixSystem;

// ============================================================================
// System Information
// ============================================================================

export const RENDER_SYSTEM_INFO = {
  version: '2.0.0',
  features: [
    'Complete template + theme remix system',
    '4 professional templates (detailed, condensed, fancy, functional)', 
    '320 theme combinations (5 colors × 4 typography × 4 decorative × 4 layout)',
    '5 curated presets (professional, luxury, modern, friendly, executive)',
    'Custom preset creation and management',
    'AI-powered recommendations',
    'Batch generation capabilities',
    'Performance optimization with caching',
    'Legacy TripData compatibility',
    'Comprehensive validation system'
  ],
  statistics: {
    templates: 4,
    theme_combinations: 320,
    built_in_presets: 5,
    total_remix_combinations: 1280,
    components: 9
  }
};

export default remixSystem;