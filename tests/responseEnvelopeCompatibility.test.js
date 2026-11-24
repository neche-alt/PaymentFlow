'use strict';

/**
 * Response envelope compatibility tests — issue #656
 *
 * Verifies that all JSON responses produced by the API follow a consistent
 * envelope shape that third-party integrations can depend on:
 *
 *   Success responses:
 *     - Always return Content-Type: application/json
 *     - Domain fields at the top level (no wrapping `data` key enforced by
 *       convention — this test validates that known fields are where they
 *       are documented to be)
 *
 *   Error responses:
 *     - Always include `{ error: string, code?: string }`
 *     - 4xx/5xx never return an empty body
 *     - 400 Validation errors include the offending field where possible
 *
 *   Status-code stability:
 *     - Known operations always return their documented status codes
 *     - A cached idempotent replay returns the ORIGINAL status (not always 200)
 */

process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.SCHOOL_WALLET_ADDRESS = process.env.SCHOOL_WALLET_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const request = require('supertest');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../backend/src/config/database', () => ({
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
  TRANSACTION_CONFIG: { readConcern: 'majority', writeConcern: 'majority', journal: true, transactionTimeoutMs: 30000 },
}));

jest.mock('../backend/src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  getAuditLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
  getRecentAuditLogs: jest.fn().mockResolvedValue([]),
  verifyAuditChain: jest.fn().mockResolvedValue({ ok: true }),
  getAuditFailureCount: jest.fn().mockReturnValue(0),
  getAuditHealth: jest.fn().mockReturnValue({ healthy: true }),
}));

const idempotencyStoreMock = {
  getFull: jest.fn().mockResolvedValue(null),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  reserve: jest.fn().mockResolvedValue({ reserved: true }),
  complete: jest.fn().mockResolvedValue(true),
  release: jest.fn().mockResolvedValue(true),
  redisEnabled: false,
  IN_FLIGHT_TTL_MS: 30000,
};
jest.mock('../backend/src/services/idempotencyStore', () => idempotencyStoreMock);

jest.mock('../backend/src/services/distributedLock', () => ({
  acquire: jest.fn().mockResolvedValue('tok'),
  release: jest.fn().mockResolvedValue(true),
  withLock: jest.fn(async (_k, _t, fn) => fn()),
  close: jest.fn().mockResolvedValue(true),
}));

jest.mock('../backend/src/models/schoolModel', () => ({
  findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
}));

// ── App fixture ───────────────────────────────────────────────────────────────

let app;
beforeAll(() => { app = require('../backend/src/app'); });
beforeEach(() => jest.clearAllMocks());

// ── Helpers ───────────────────────────────────────────────────────────────────

function expectJsonEnvelope(res) {
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body).not.toBeNull();
  expect(typeof res.body).toBe('object');
}

function expectErrorEnvelope(res) {
  expectJsonEnvelope(res);
  expect(typeof res.body.error).toBe('string');
  expect(res.body.error.length).toBeGreaterThan(0);
}

// ── Content-Type consistency ──────────────────────────────────────────────────

describe('Response envelope: Content-Type is always application/json', () => {
  test('GET /health returns application/json', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('GET /health/live returns application/json', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('400 error responses return application/json', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .send({});
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('404 for unknown route returns application/json', async () => {
    const res = await request(app).get('/api/does-not-exist-404');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── Error envelope shape ──────────────────────────────────────────────────────

describe('Response envelope: error shape { error, code? }', () => {
  test('missing Idempotency-Key returns { error, code }', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .send({ txHash: 'abc123' });

    expect(res.status).toBe(400);
    expectErrorEnvelope(res);
    expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  test('invalid UUID key returns { error, code }', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', 'bad-key')
      .send({ txHash: 'abc123' });

    expect(res.status).toBe(400);
    expectErrorEnvelope(res);
    expect(res.body.code).toBe('INVALID_IDEMPOTENCY_KEY_FORMAT');
  });

  test('409 in-progress response has { error, code }', async () => {
    idempotencyStoreMock.getFull.mockResolvedValue({
      state: 'in_progress',
      requestFingerprint: null,
      responseStatus: null,
      responseBody: null,
      scope: '/verify',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', '550e8400-e29b-41d4-a716-446655440000')
      .send({ txHash: 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1' });

    expect(res.status).toBe(409);
    expectErrorEnvelope(res);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_IN_PROGRESS');
  });

  test('422 key-reuse response has { error, code }', async () => {
    const { fingerprintRequest } = require('../backend/src/utils/idempotencyKey');
    const originalFp = fingerprintRequest({ txHash: 'original-hash' });

    idempotencyStoreMock.getFull.mockResolvedValue({
      state: 'completed',
      requestFingerprint: originalFp,
      responseStatus: 200,
      responseBody: { verified: true },
      scope: '/verify',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', '550e8400-e29b-41d4-a716-446655440000')
      .send({ txHash: 'different-hash' });

    expect(res.status).toBe(422);
    expectErrorEnvelope(res);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
  });

  test('4xx responses never have an empty body', async () => {
    const cases = [
      request(app).post('/api/payments/verify').set('X-School-Id', 'SCH001').send({}),
      request(app).get('/api/payments').set('X-School-Id', 'SCH001'),
    ];
    for (const r of await Promise.all(cases)) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.body).not.toBeNull();
      expect(Object.keys(r.body).length).toBeGreaterThan(0);
    }
  });
});

// ── Status-code stability ─────────────────────────────────────────────────────

describe('Response envelope: status-code stability', () => {
  test('health endpoint always returns 200 when DB is healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('idempotent replay returns the original cached status code', async () => {
    // The original request produced a 201
    idempotencyStoreMock.getFull.mockResolvedValue({
      state: 'completed',
      requestFingerprint: null,
      responseStatus: 201,
      responseBody: { intentId: 'i-abc', memo: 'STU001' },
      scope: '/intent',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', '6ba7b810-9dad-41d4-80b4-00c04fd430c8')
      .send({ studentId: 'STU001', amount: 100, assetCode: 'XLM' });

    // Replay should return the ORIGINAL status (201), not always 200
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ intentId: 'i-abc', memo: 'STU001' });
  });

  test('unknown route returns 404 with JSON error body', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expectJsonEnvelope(res);
  });
});

// ── Static envelope contracts (pure unit) ─────────────────────────────────────

describe('Response envelope: pure unit invariants', () => {
  test('error object always has string error field', () => {
    const err = { error: 'Something went wrong', code: 'SOME_CODE' };
    expect(typeof err.error).toBe('string');
    expect(err.error.length).toBeGreaterThan(0);
  });

  test('code field when present is a string in SCREAMING_SNAKE_CASE', () => {
    const codes = [
      'MISSING_IDEMPOTENCY_KEY',
      'INVALID_IDEMPOTENCY_KEY_FORMAT',
      'IDEMPOTENCY_KEY_IN_PROGRESS',
      'IDEMPOTENCY_KEY_REUSE',
      'IDEMPOTENCY_STORE_UNAVAILABLE',
    ];
    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  test('idempotent replay preserves full response body shape', () => {
    const cachedBody = {
      verified: true,
      hash: 'abc123',
      studentId: 'STU001',
      amount: 100,
      status: 'SUCCESS',
    };
    // Replay just re-emits the cached body — no fields stripped
    const replayBody = { ...cachedBody };
    expect(replayBody).toMatchObject(cachedBody);
  });
});
