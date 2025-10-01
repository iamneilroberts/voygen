/**
 * Contract Tests: Trip Progress API
 * Feature: 002-librechat-interface-modifications (Phase 7, T038)
 *
 * Tests for /api/voygent/trip-progress endpoints
 */

const request = require('supertest');
const express = require('express');
const tripProgressRouter = require('../trip-progress');

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
  app.use('/api/voygent/trip-progress', tripProgressRouter);
  return app;
}

describe('GET /api/voygent/trip-progress', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('should return 204 when no progress data exists', async () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .get('/api/voygent/trip-progress')
      .query({ tripId: 'trip-123' });

    expect(response.status).toBe(204);
  });

  test('should return 200 with progress data for trip', async () => {
    const mockData = {
      trip_id: 'trip-123',
      phase: 'Hotels',
      step: 3,
      percent: 32,
      cost: 4200,
      commission: 420,
      budget: 5000,
      last_updated: Date.now(),
    };

    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue(mockData),
    });

    const response = await request(app)
      .get('/api/voygent/trip-progress')
      .query({ tripId: 'trip-123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tripId', 'trip-123');
    expect(response.body).toHaveProperty('phase', 'Hotels');
    expect(response.body).toHaveProperty('step', 3);
    expect(response.body).toHaveProperty('percent', 32);
    expect(response.body).toHaveProperty('cost', 4200);
    expect(response.body).toHaveProperty('commission', 420);
  });

  test('should return progress by conversationId', async () => {
    const mockData = {
      trip_id: 'trip-456',
      phase: 'Activities',
      step: 2,
      percent: 44,
      cost: 3000,
    };

    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue(mockData),
    });

    const response = await request(app)
      .get('/api/voygent/trip-progress')
      .query({ conversationId: 'conv-789' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tripId', 'trip-456');
    expect(response.body).toHaveProperty('phase', 'Activities');
  });

  test('should handle database errors gracefully', async () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockRejectedValue(new Error('Database error')),
    });

    const response = await request(app)
      .get('/api/voygent/trip-progress')
      .query({ tripId: 'trip-123' });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});

describe('POST /api/voygent/trip-progress/update', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('should update trip progress successfully', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      tripId: 'trip-123',
      phase: 'Hotels',
      step: 3,
      totalSteps: 5,
      cost: 4200,
      commission: 420,
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('percent', 32); // 20 + (3/5 * 20) = 32
  });

  test('should calculate percentage correctly for Research phase', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      tripId: 'trip-123',
      phase: 'Research',
      step: 2,
      totalSteps: 4,
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.percent).toBe(10); // 0 + (2/4 * 20) = 10
  });

  test('should calculate percentage correctly for Finalization phase', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      tripId: 'trip-123',
      phase: 'Finalization',
      step: 2,
      totalSteps: 3,
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.percent).toBe(93); // 80 + (2/3 * 20) ≈ 93
  });

  test('should reject missing required fields', async () => {
    const payload = {
      tripId: 'trip-123',
      // Missing phase, step, totalSteps
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should handle invalid phase gracefully', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      tripId: 'trip-123',
      phase: 'InvalidPhase',
      step: 1,
      totalSteps: 4,
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.percent).toBe(0); // Invalid phase defaults to 0%
  });

  test('should update cost and commission', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const payload = {
      tripId: 'trip-123',
      phase: 'Booking',
      step: 2,
      totalSteps: 4,
      cost: 8500,
      commission: 850,
    };

    const response = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response.status).toBe(200);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('cost = ?'),
    );
  });
});

describe('Trip Progress API - Contract Validation', () => {
  test('GET response contract matches OpenAPI spec', async () => {
    const app = createApp();

    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        trip_id: 'trip-123',
        phase: 'Hotels',
        step: 3,
        percent: 32,
        cost: 4200,
        commission: 420,
        budget: 5000,
      }),
    });

    const response = await request(app)
      .get('/api/voygent/trip-progress')
      .query({ tripId: 'trip-123' });

    // Verify contract
    expect(response.body).toMatchObject({
      tripId: expect.any(String),
      phase: expect.any(String),
      step: expect.any(Number),
      percent: expect.any(Number),
    });

    // Optional fields
    if (response.body.cost !== undefined) {
      expect(response.body.cost).toEqual(expect.any(Number));
    }
  });

  test('POST request contract validates phase values', async () => {
    const app = createApp();
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    const validPhases = ['Research', 'Hotels', 'Activities', 'Booking', 'Finalization'];

    for (const phase of validPhases) {
      const response = await request(app)
        .post('/api/voygent/trip-progress/update')
        .send({
          tripId: 'trip-123',
          phase,
          step: 1,
          totalSteps: 4,
        });

      expect(response.status).toBe(200);
      expect(response.body.percent).toBeGreaterThanOrEqual(0);
      expect(response.body.percent).toBeLessThanOrEqual(100);
    }
  });

  test('Percentage calculation is deterministic', async () => {
    const app = createApp();
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    });

    // Test same input produces same output
    const payload = {
      tripId: 'trip-123',
      phase: 'Hotels',
      step: 3,
      totalSteps: 5,
    };

    const response1 = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    const response2 = await request(app)
      .post('/api/voygent/trip-progress/update')
      .send(payload);

    expect(response1.body.percent).toBe(response2.body.percent);
    expect(response1.body.percent).toBe(32);
  });
});
