/**
 * Test Setup File for Proposal Remix System Tests
 * 
 * Global test configuration and mocks for TASK-0041 test suite
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
  // Mock console for cleaner test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock performance API for Node.js environments
  if (typeof performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      clearMarks: () => {},
      clearMeasures: () => {}
    } as any;
  }
  
  // Mock fetch for image processing tests
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock image data'], { type: 'image/jpeg' })),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    } as any)
  );
  
  // Mock Buffer for Cloudflare Workers environment compatibility
  if (typeof Buffer === 'undefined') {
    global.Buffer = {
      from: (data: any) => new Uint8Array(Array.from(data)),
      isBuffer: () => false
    } as any;
  }
});

// Global test cleanup
afterAll(() => {
  vi.restoreAllMocks();
});

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.CLOUDFLARE_WORKERS = 'false'; // Disable Workers-specific features in tests