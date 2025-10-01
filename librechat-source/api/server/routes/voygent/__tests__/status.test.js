/**
 * Contract Tests: Combined Status API
 * Feature: 002-librechat-interface-modifications (Phase 7, T039)
 *
 * Tests for /api/voygent/status endpoint
 */

const request = require('supertest');
const express = require('express');
const statusRouter = require('../status');

// Mock database
const mockDb = {
  prepare: jest.fn(),
};

// Mock fetch for MCP health checks
global.fetch = jest.fn();

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.app.locals.db = mockDb;
    next();
  });
  app.use('/api/voygent/status', statusRouter);
  return app;
}

describe('GET /api/voygent/status', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('should return combined status with all fields', async () => {
    // Mock token usage
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockResolvedValue([
        {
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          cost_usd: 0.01,
        },
      ]),
    });

    // Mock trip progress
    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValue({
        trip_id: 'trip-123',
        phase: 'Hotels',
        step: 3,
        percent: 32,
      }),
    });

    // Mock MCP health
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        servers: [
          { name: 'd1-database', healthy: true },
          { name: 'prompt-instructions', healthy: true },
        ],
        allHealthy: true,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        includeProgress: 'true',
        includeMCP: 'true',
        conversationId: 'conv-123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tokens');
    expect(response.body).toHaveProperty('progress');
    expect(response.body).toHaveProperty('mcp');
    expect(response.body.tokens).toHaveProperty('model');
    expect(response.body.progress).toHaveProperty('phase', 'Hotels');
    expect(response.body.mcp).toHaveProperty('allHealthy', true);
  });

  test('should return only tokens when requested', async () => {
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockResolvedValue([
        {
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          cost_usd: 0.01,
        },
      ]),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        conversationId: 'conv-123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tokens');
    expect(response.body).not.toHaveProperty('progress');
    expect(response.body).not.toHaveProperty('mcp');
  });

  test('should return only progress when requested', async () => {
    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValue({
        trip_id: 'trip-123',
        phase: 'Hotels',
        percent: 32,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeProgress: 'true',
        tripId: 'trip-123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('progress');
    expect(response.body).not.toHaveProperty('tokens');
    expect(response.body).not.toHaveProperty('mcp');
  });

  test('should return only MCP when requested', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        servers: [{ name: 'd1-database', healthy: true }],
        allHealthy: true,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({ includeMCP: 'true' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('mcp');
    expect(response.body).not.toHaveProperty('tokens');
    expect(response.body).not.toHaveProperty('progress');
  });

  test('should handle missing optional data gracefully', async () => {
    // No token data
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockResolvedValue([]),
    });

    // No progress data
    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValue(null),
    });

    // MCP healthy
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        servers: [{ name: 'd1-database', healthy: true }],
        allHealthy: true,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        includeProgress: 'true',
        includeMCP: 'true',
      });

    expect(response.status).toBe(200);
    expect(response.body.tokens).toBeNull();
    expect(response.body.progress).toBeNull();
    expect(response.body.mcp).toBeTruthy(); // MCP should still be present
  });

  test('should handle database errors gracefully', async () => {
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockRejectedValue(new Error('Database error')),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        conversationId: 'conv-123',
      });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });

  test('should handle MCP fetch errors gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('MCP fetch failed'));

    const response = await request(app)
      .get('/api/voygent/status')
      .query({ includeMCP: 'true' });

    expect(response.status).toBe(200);
    expect(response.body.mcp).toBeNull(); // Failed MCP should return null, not crash
  });

  test('should execute queries in parallel', async () => {
    const startTime = Date.now();

    // Simulate slow queries (100ms each)
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      ),
    });

    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100)),
      ),
    });

    global.fetch.mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() =>
          resolve({
            ok: true,
            json: async () => ({ servers: [], allHealthy: true }),
          }),
          100,
        ),
      ),
    );

    await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        includeProgress: 'true',
        includeMCP: 'true',
      });

    const duration = Date.now() - startTime;

    // If parallel: ~100ms. If sequential: ~300ms
    expect(duration).toBeLessThan(200); // Allow some overhead
  });
});

describe('Status API - Contract Validation', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('Response structure matches OpenAPI spec', async () => {
    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockResolvedValue([
        {
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          cost_usd: 0.001,
        },
      ]),
    });

    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValue({
        trip_id: 'trip-123',
        phase: 'Hotels',
        step: 2,
        percent: 28,
      }),
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        servers: [
          { name: 'd1-database', healthy: true, latency: 50 },
        ],
        allHealthy: true,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/status')
      .query({
        includeTokens: 'true',
        includeProgress: 'true',
        includeMCP: 'true',
      });

    expect(response.body).toMatchObject({
      tokens: {
        model: expect.any(String),
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        price: expect.any(Number),
      },
      progress: {
        tripId: expect.any(String),
        phase: expect.any(String),
        step: expect.any(Number),
        percent: expect.any(Number),
      },
      mcp: {
        servers: expect.any(Array),
        allHealthy: expect.any(Boolean),
      },
    });
  });

  test('Query parameters are optional', async () => {
    // No query params = no data fetched
    const response = await request(app).get('/api/voygent/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tokens: null,
      progress: null,
      mcp: null,
    });
  });

  test('Boolean query params accept various formats', async () => {
    const trueValues = ['true', '1', 'yes'];

    for (const value of trueValues) {
      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .get('/api/voygent/status')
        .query({ includeTokens: value });

      expect(response.status).toBe(200);
      // Should attempt to fetch tokens (even if empty)
      expect(mockDb.prepare).toHaveBeenCalled();
      jest.clearAllMocks();
    }
  });
});
