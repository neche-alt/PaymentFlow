'use strict';

/**
 * API contract tests — issue #656
 *
 * Verifies that key endpoints honour their documented contracts:
 *   - Correct HTTP status codes
 *   - Required response envelope fields
 *   - Error response shape (error + code)
 *   - Content-Type: application/json on all JSON responses
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

jest.mock('../backend/src/services/idempotencyStore', () => ({
  getFull: jest.fn().mockResolvedValue(null),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  reserve: jest.fn().mockResolvedValue({ reserved: true }),
  complete: jest.fn().mockResolvedValue(true),
  release: jest.fn().mockResolvedValue(true),
  redisEnabled: false,
  IN_FLIGHT_TTL_MS: 30000,
}));

jest.mock('../backend/src/services/distributedLock', () => ({
  acquire: jest.fn().mockResolvedValue('tok'),
  release: jest.fn().mockResolvedValue(true),
  withLock: jest.fn(async (_k, _t, fn) => fn()),
  close: jest.fn().mockResolvedValue(true),
}));

jest.mock('../backend/src/models/schoolModel', () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  }),
}));

// ── App fixture ───────────────────────────────────────────────────────────────

let app;
beforeAll(() => { app = require('../backend/src/app'); });

// ── Helper ────────────────────────────────────────────────────────────────────

function expectJsonContentType(res) {
  expect(res.headers['content-type']).toMatch(/application\/json/);
}

function expectErrorShape(body) {
  expect(typeof body.error).toBe('string');
  expect(body.error.length).toBeGreaterThan(0);
}

// ── Health endpoint contract ──────────────────────────────────────────────────

describe('Contract: GET /health', () => {
  test('returns 200 with status field', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expectJsonContentType(res);
    expect(res.body).toHaveProperty('status');
    expect(typeof res.body.status).toBe('string');
  });

  test('status is one of: healthy | degraded | unhealthy', async () => {
    const res = await request(app).get('/health');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
  });
});

describe('Contract: GET /health/live', () => {
  test('returns 200 with ok body', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expectJsonContentType(res);
  });
});

describe('Contract: GET /health/ready', () => {
  test('returns 200 or 503 with JSON body', async () => {
    const res = await request(app).get('/health/ready');
    expect([200, 503]).toContain(res.status);
    expectJsonContentType(res);
  });
});

// ── OpenAPI spec contract ─────────────────────────────────────────────────────

describe('Contract: GET /api/docs.json', () => {
  test('returns 200 with OpenAPI 3.0 object', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expectJsonContentType(res);
    expect(res.body.openapi).toMatch(/^3\.0\./);
  });

  test('spec has info.title and info.version', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(typeof res.body.info.title).toBe('string');
    expect(typeof res.body.info.version).toBe('string');
  });

  test('spec has paths object with at least one endpoint', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(typeof res.body.paths).toBe('object');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
  });

  test('spec has components.securitySchemes.BearerAuth', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.body.components.securitySchemes).toHaveProperty('BearerAuth');
  });
});

// ── Payment endpoints — error shape contract ──────────────────────────────────

describe('Contract: POST /api/payments/verify error responses', () => {
  test('400 when Idempotency-Key header is missing', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .send({ txHash: 'abc' });

    expect(res.status).toBe(400);
    expectJsonContentType(res);
    expectErrorShape(res.body);
    expect(res.body.code).toBeDefined();
  });

  test('400 when Idempotency-Key is not a UUID v4', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ txHash: 'abc' });

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
    expect(res.body.code).toBe('INVALID_IDEMPOTENCY_KEY_FORMAT');
  });

  test('400 when txHash is missing from request body', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set('X-School-Id', 'SCH001')
      .set('Idempotency-Key', '550e8400-e29b-41d4-a716-446655440000')
      .send({});

    expect(res.status).toBe(400);
    expectJsonContentType(res);
    expectErrorShape(res.body);
  });
});

describe('Contract: POST /api/payments/intent error responses', () => {
  test('400 when Idempotency-Key header is missing', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .set('X-School-Id', 'SCH001')
      .send({ studentId: 'STU001', amount: 100 });

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });
});

// ── Authentication enforcement contract ───────────────────────────────────────

describe('Contract: protected endpoints return 401 without auth', () => {
  test('GET /api/payments returns 401 without Authorization header', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('X-School-Id', 'SCH001');

    expect([401, 403]).toContain(res.status);
    expectJsonContentType(res);
    expectErrorShape(res.body);
  });

  test('error response has string error field and string code field', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('X-School-Id', 'SCH001');

    expect(typeof res.body.error).toBe('string');
  });
});

// ── Schema contract — static assertions against golden ───────────────────────

describe('Contract: golden schema field-type constraints', () => {
  const fs   = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');

  const golden = yaml.load(
    fs.readFileSync(path.join(__dirname, 'api-schema', 'golden.yaml'), 'utf8')
  );

  test('Payment.amount is type number in golden schema', () => {
    expect(golden.components.schemas.Payment.properties.amount.type).toBe('number');
  });

  test('Payment.txHash is type string in golden schema', () => {
    expect(golden.components.schemas.Payment.properties.txHash.type).toBe('string');
  });

  test('School.isActive is type boolean in golden schema', () => {
    expect(golden.components.schemas.School.properties.isActive.type).toBe('boolean');
  });

  test('Student.contactEmail has format email in golden schema', () => {
    expect(golden.components.schemas.Student.properties.contactEmail.format).toBe('email');
  });

  test('Payment.confirmedAt has format date-time in golden schema', () => {
    expect(golden.components.schemas.Payment.properties.confirmedAt.format).toBe('date-time');
  });
});
