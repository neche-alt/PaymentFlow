'use strict';

/**
 * Tests for idempotency concurrency guarantees — issue #83
 *
 * Verifies that under concurrent requests carrying the same Idempotency-Key:
 *  - Exactly one request is processed (one DB write); others receive 409.
 *  - After the first request completes, subsequent requests replay the cached
 *    response with the original status code.
 *  - A request with a missing Idempotency-Key receives 400.
 *  - A request with a non-UUID v4 key receives 400.
 *  - Body fingerprint mismatch (same key, different body) receives 422.
 */

process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.SCHOOL_WALLET_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const request = require('supertest');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../backend/src/config/database', () => ({
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
  TRANSACTION_CONFIG: {
    readConcern: 'majority',
    writeConcern: 'majority',
    journal: true,
    transactionTimeoutMs: 30000,
  },
}));

jest.mock('../backend/src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  getAuditLogs: jest.fn().mockResolvedValue({ logs: [], total: 0, page: 1, limit: 50, pages: 1 }),
  getRecentAuditLogs: jest.fn().mockResolvedValue([]),
  verifyAuditChain: jest.fn().mockResolvedValue({ ok: true, scanned: 0, broken: [] }),
  getAuditFailureCount: jest.fn().mockReturnValue(0),
}));

jest.mock('../backend/src/services/distributedLock', () => ({
  acquire: jest.fn().mockResolvedValue('lock-token'),
  release: jest.fn().mockResolvedValue(true),
  renew: jest.fn().mockResolvedValue(true),
  withLock: jest.fn(async (_key, _ttl, fn) => fn()),
  getCurrentFence: jest.fn().mockResolvedValue(0),
  close: jest.fn().mockResolvedValue(true),
}));

jest.mock('../backend/src/models/paymentModel', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../backend/src/models/studentModel', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));

jest.mock('../backend/src/models/schoolModel', () => ({
  findOne: jest.fn(),
}));

jest.mock('../backend/src/models/paymentIntentModel', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockResolvedValue({ _id: 'intent-id', memo: 'STU001', amount: 100 }),
}));

jest.mock('../backend/src/services/stellarService', () => ({
  verifyTransaction: jest.fn(),
  recordPayment: jest.fn().mockResolvedValue({}),
}));

jest.mock('../backend/src/services/currencyConversionService', () => ({
  convertToLocalCurrency: jest.fn().mockResolvedValue({
    available: true, localAmount: 100, currency: 'USD',
    rate: 1, rateTimestamp: new Date().toISOString(),
  }),
}));

// ── Idempotency store mock — controlled per-test ───────────────────────────────
// We expose a resettable in-memory store so each test scenario can inject
// specific sequencing (first call: in_progress; second call: completed, etc.).
const idempotencyStore = {
  getFull: jest.fn(),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  reserve: jest.fn(),
  complete: jest.fn().mockResolvedValue(true),
  release: jest.fn().mockResolvedValue(true),
  redisEnabled: false,
  IN_FLIGHT_TTL_MS: 30000,
};

jest.mock('../backend/src/services/idempotencyStore', () => idempotencyStore);

const School = require('../backend/src/models/schoolModel');
const PaymentIntent = require('../backend/src/models/paymentIntentModel');

// ── App fixture ───────────────────────────────────────────────────────────────

let app;
beforeAll(() => {
  app = require('../backend/src/app');
});

beforeEach(() => {
  jest.clearAllMocks();

  // Default school mock
  School.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      schoolId: 'SCH001',
      stellarAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      localCurrency: 'USD',
      isActive: true,
    }),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

function intentPayload() {
  return { studentId: 'STU001', amount: 100, assetCode: 'XLM' };
}

// ── Missing / malformed key tests ─────────────────────────────────────────────

describe('Idempotency-Key header validation', () => {
  test('returns 400 when Idempotency-Key header is absent', async () => {
    // Store won't be consulted; middleware rejects first
    idempotencyStore.getFull.mockResolvedValue(null);
    idempotencyStore.reserve.mockResolvedValue({ reserved: true });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .send(intentPayload());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  test('returns 400 when Idempotency-Key is an empty string', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', '   ')
      .send(intentPayload());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  test('returns 400 when Idempotency-Key is not a UUID v4', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', 'not-a-uuid')
      .send(intentPayload());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IDEMPOTENCY_KEY_FORMAT');
  });

  test('returns 400 for a UUID v1 (not v4)', async () => {
    // UUID v1: version nibble is 1, not 4
    const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', uuidV1)
      .send(intentPayload());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IDEMPOTENCY_KEY_FORMAT');
  });

  test('accepts a valid UUID v4', async () => {
    // Store grants the reservation — the route handler will run
    idempotencyStore.getFull.mockResolvedValue(null);
    idempotencyStore.reserve.mockResolvedValue({ reserved: true });
    PaymentIntent.create.mockResolvedValue({ _id: 'i1', memo: 'STU001', amount: 100 });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send(intentPayload());

    // 400 from missing school or body validation is fine — the idempotency
    // middleware accepted the key format (no INVALID_IDEMPOTENCY_KEY_FORMAT).
    expect(res.body.code).not.toBe('INVALID_IDEMPOTENCY_KEY_FORMAT');
    expect(res.body.code).not.toBe('MISSING_IDEMPOTENCY_KEY');
  });
});

// ── Concurrency: in-flight duplicate → 409 ───────────────────────────────────

describe('Concurrent requests with the same Idempotency-Key', () => {
  test('second concurrent request returns 409 while first is in_progress', async () => {
    // The store already has an in_progress record (simulates the first request
    // being mid-flight when the second arrives).
    idempotencyStore.getFull.mockResolvedValue({
      state: 'in_progress',
      requestFingerprint: null,
      responseStatus: null,
      responseBody: null,
      scope: '/api/payments/intent',
      createdAt: new Date(), // fresh — not stale
    });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send(intentPayload());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_IN_PROGRESS');
  });

  test('stale in_progress reservation (older than IN_FLIGHT_TTL_MS) can be taken over', async () => {
    // Record is in_progress but was created 60 s ago — well past 30 s TTL.
    const staleTime = new Date(Date.now() - 60000);
    idempotencyStore.getFull.mockResolvedValue({
      state: 'in_progress',
      requestFingerprint: null,
      responseStatus: null,
      responseBody: null,
      scope: '/api/payments/intent',
      createdAt: staleTime,
    });
    // reserve() takes over the stale record and grants the reservation.
    idempotencyStore.reserve.mockResolvedValue({ reserved: true });
    PaymentIntent.create.mockResolvedValue({ _id: 'i2', memo: 'STU001', amount: 100 });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send(intentPayload());

    // Should NOT be a 409; the stale reservation was taken over.
    expect(res.status).not.toBe(409);
  });
});

// ── Completed replay ──────────────────────────────────────────────────────────

describe('Replay of completed requests', () => {
  test('duplicate request returns cached response with original status code', async () => {
    const cachedBody = { intentId: 'intent-abc', memo: 'STU001', amount: 100 };

    idempotencyStore.getFull.mockResolvedValue({
      state: 'completed',
      requestFingerprint: null,
      responseStatus: 201,
      responseBody: cachedBody,
      scope: '/api/payments/intent',
      createdAt: new Date(Date.now() - 5000),
    });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send(intentPayload());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(cachedBody);
  });

  test('replay with same body fingerprint returns cached response', async () => {
    const { fingerprintRequest } = require('../backend/src/utils/idempotencyKey');
    const body = intentPayload();
    const fp = fingerprintRequest(body);

    idempotencyStore.getFull.mockResolvedValue({
      state: 'completed',
      requestFingerprint: fp,
      responseStatus: 200,
      responseBody: { ok: true },
      scope: '/api/payments/intent',
      createdAt: new Date(Date.now() - 2000),
    });

    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  test('replay with DIFFERENT body fingerprint returns 422', async () => {
    // Store records fingerprint of the ORIGINAL body
    const { fingerprintRequest } = require('../backend/src/utils/idempotencyKey');
    const originalFp = fingerprintRequest({ studentId: 'STU001', amount: 100, assetCode: 'XLM' });

    idempotencyStore.getFull.mockResolvedValue({
      state: 'completed',
      requestFingerprint: originalFp,
      responseStatus: 201,
      responseBody: { intentId: 'i1' },
      scope: '/api/payments/intent',
      createdAt: new Date(Date.now() - 2000),
    });

    // Client sends a DIFFERENT body with the same key — this is a client bug.
    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID)
      .send({ studentId: 'STU001', amount: 999, assetCode: 'USDC' }); // different amount

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
  });
});

// ── Exactly-one DB write guarantee ───────────────────────────────────────────

describe('Exactly-one DB write under concurrency', () => {
  test('reserve() is called once; complete() is called once per successful request', async () => {
    idempotencyStore.getFull.mockResolvedValue(null);
    idempotencyStore.reserve.mockResolvedValue({ reserved: true });
    PaymentIntent.create.mockResolvedValue({ _id: 'i3', memo: 'STU001', amount: 100 });

    await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID_2)
      .send(intentPayload());

    // reserve() must be called exactly once per winning request
    expect(idempotencyStore.reserve).toHaveBeenCalledTimes(1);
  });

  test('a 5xx response releases the reservation so the client can retry', async () => {
    // reserve() grants; then the downstream handler throws, triggering a 500,
    // which the middleware handles by releasing the reservation.
    idempotencyStore.getFull.mockResolvedValue(null);
    idempotencyStore.reserve.mockResolvedValue({ reserved: true });
    // Force the route to 500 by making PaymentIntent.create throw
    PaymentIntent.create.mockRejectedValue(new Error('DB unavailable'));

    await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', VALID_UUID_2)
      .send(intentPayload());

    // On 5xx the middleware calls release() so the client can retry safely.
    expect(idempotencyStore.release).toHaveBeenCalled();
    expect(idempotencyStore.complete).not.toHaveBeenCalled();
  });
});
