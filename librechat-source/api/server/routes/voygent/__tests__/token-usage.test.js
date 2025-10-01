/**
 * Contract Tests: Token Usage API
 * Feature: 002-librechat-interface-modifications (Phase 7, T037)
 *
 * Tests for /api/voygent/token-usage endpoints
 */

const request = require('supertest');
const express = require('express');
const tokenUsageRouter = require('../token-usage');

// Mock database
const mockDb = {
  prepare: jest.fn(),
};

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.app.locals.db = mockDb;
    next();
  });
  app.use('/api/voygent/token-usage', tokenUsageRouter);
  return app;
}

describe('GET /api/voygent/token-usage', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('should return 204 when no usage data exists', async () => {
    mockDb.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([]),
    });

    const response = await request(app)
      .get('/api/voygent/token-usage')
      .query({ conversationId: 'test-conv-123' });

    expect(response.status).toBe(204);
  });

  test('should return 200 with usage data for conversation', async () => {
    const mockData = [
      {
        id: 'token-1',
        conversation_id: 'test-conv-123',
        user_id: 'user-1',
        model: 'claude-3-5-sonnet-20241022',
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
        cost_usd: 0.01,
        approximate: 0,
        created_at: Date.now(),
      },
    ];

    mockDb.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue(mockData),
    });

    const response = await request(app)
      .get('/api/voygent/token-usage')
      .query({ conversationId: 'test-conv-123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('model', 'claude-3-5-sonnet-20241022');
    expect(response.body).toHaveProperty('inputTokens', 1000);
    expect(response.body).toHaveProperty('outputTokens', 500);
    expect(response.body).toHaveProperty('totalTokens', 1500);
    expect(response.body).toHaveProperty('price', 0.01);
  });

  test('should return cumulative usage when requested', async () => {
    const mockData = [
      {
        total_input_tokens: 5000,
        total_output_tokens: 2500,
        total_tokens: 7500,
        total_cost: 0.05,
        conversation_count: 3,
      },
    ];

    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue(mockData[0]),
    });

    const response = await request(app)
      .get('/api/voygent/token-usage')
      .query({ cumulative: 'true' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalInputTokens', 5000);
    expect(response.body).toHaveProperty('totalOutputTokens', 2500);
    expect(response.body).toHaveProperty('totalTokens', 7500);
    expect(response.body).toHaveProperty('totalCost', 0.05);
    expect(response.body).toHaveProperty('conversationCount', 3);
  });

  test('should handle database errors gracefully', async () => {
    mockDb.prepare.mockReturnValue({
      all: jest.fn().mockRejectedValue(new Error('Database error')),
    });

    const response = await request(app)
      .get('/api/voygent/token-usage')
      .query({ conversationId: 'test-conv-123' });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});

describe('POST /api/voygent/token-usage/log', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('should log token usage successfully', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      conversationId: 'test-conv-123',
      userId: 'user-1',
      model: 'claude-3-5-sonnet-20241022',
      inputTokens: 1000,
      outputTokens: 500,
      approximate: false,
    };

    const response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('cost');
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  test('should reject missing required fields', async () => {
    const payload = {
      conversationId: 'test-conv-123',
      // Missing userId, model, inputTokens, outputTokens
    };

    const response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should calculate cost correctly', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      conversationId: 'test-conv-123',
      userId: 'user-1',
      model: 'claude-3-5-sonnet-20241022',
      inputTokens: 1000000, // 1M tokens
      outputTokens: 1000000, // 1M tokens
      approximate: false,
    };

    const response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.cost).toBeCloseTo(18.0, 2); // $3 + $15 = $18
  });

  test('should handle unknown models gracefully', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      conversationId: 'test-conv-123',
      userId: 'user-1',
      model: 'unknown-model-xyz',
      inputTokens: 1000,
      outputTokens: 500,
      approximate: false,
    };

    const response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.cost).toBe(0); // Unknown model = $0 cost
  });
});

describe('Token Usage API - Contract Validation', () => {
  test('GET response contract matches OpenAPI spec', async () => {
    const app = createApp();

    mockDb.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([
        {
          id: 'token-1',
          conversation_id: 'test-conv',
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          cost_usd: 0.001,
        },
      ]),
    });

    const response = await request(app)
      .get('/api/voygent/token-usage')
      .query({ conversationId: 'test-conv' });

    // Verify contract
    expect(response.body).toMatchObject({
      conversationId: expect.any(String),
      model: expect.any(String),
      inputTokens: expect.any(Number),
      outputTokens: expect.any(Number),
      totalTokens: expect.any(Number),
      price: expect.any(Number),
    });
  });

  test('POST request contract validates required fields', async () => {
    const app = createApp();

    // Missing conversationId
    let response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send({
        userId: 'user-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 50,
      });
    expect(response.status).toBe(400);

    // Missing userId
    response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send({
        conversationId: 'test-conv',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 50,
      });
    expect(response.status).toBe(400);

    // Missing model
    response = await request(app)
      .post('/api/voygent/token-usage/log')
      .send({
        conversationId: 'test-conv',
        userId: 'user-1',
        inputTokens: 100,
        outputTokens: 50,
      });
    expect(response.status).toBe(400);
  });
});
