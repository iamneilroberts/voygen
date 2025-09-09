import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test patterns
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{jsx,tsx}'
    ],
    
    // Test exclusions
    exclude: [
      'node_modules/**',
      'dist/**',
      '.output/**'
    ],
    
    // Global test timeout (30 seconds for integration tests)
    testTimeout: 30000,
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.{js,ts}',
        'src/**/*.{jsx,tsx}'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'tests/**/*',
        'node_modules/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80
        },
        // Specific thresholds for proposal system
        'src/render/**': {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // Reporter configuration
    reporters: ['verbose', 'json'],
    
    // Globals (for expect, describe, it, etc.)
    globals: true,
    
    // Pool options for parallel testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});