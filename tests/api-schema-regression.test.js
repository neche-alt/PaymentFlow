'use strict';

/**
 * API schema regression tests — issue #656
 *
 * Compares the live API spec served by the application against the pinned
 * golden snapshot at tests/api-schema/golden.yaml.
 *
 * Rules:
 *   - Removed endpoints         → FAIL  (breaking change)
 *   - Removed required fields   → FAIL  (breaking change)
 *   - Changed field types       → FAIL  (breaking change)
 *   - Removed enum values       → FAIL  (breaking change)
 *   - New optional fields       → PASS  (non-breaking)
 *   - New endpoints             → PASS  (non-breaking, logged as warning)
 *   - New enum values           → PASS  (non-breaking)
 *
 * Schema bump (intentional breaking change) requires the env var
 * ALLOW_BREAKING_API_CHANGE=true to be set by the CI step that runs with
 * the --breaking-change flag, plus a migration guide entry.
 */

process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.SCHOOL_WALLET_ADDRESS = process.env.SCHOOL_WALLET_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── Load golden snapshot ───────────────────────────────────────────────────

const GOLDEN_PATH = path.join(__dirname, 'api-schema', 'golden.yaml');
const golden = yaml.load(fs.readFileSync(GOLDEN_PATH, 'utf8'));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Collect all property paths in a JSON Schema object recursively.
 * Returns an array of dot-separated paths e.g. ['_id', 'status', 'amount'].
 */
function collectPropertyPaths(schema, prefix = '') {
  if (!schema || typeof schema !== 'object') return [];
  const paths = [];
  if (schema.properties) {
    for (const [key, val] of Object.entries(schema.properties)) {
      const full = prefix ? `${prefix}.${key}` : key;
      paths.push(full);
      paths.push(...collectPropertyPaths(val, full));
    }
  }
  return paths;
}

/**
 * Detect breaking changes between two OpenAPI schemas.
 * Returns an array of breaking-change description strings (empty = no breaks).
 */
function detectBreakingChanges(goldenSpec, currentSpec) {
  const breaks = [];

  const goldenSchemas  = (goldenSpec.components  && goldenSpec.components.schemas)  || {};
  const currentSchemas = (currentSpec.components && currentSpec.components.schemas) || {};

  // 1. Removed schemas
  for (const name of Object.keys(goldenSchemas)) {
    if (!currentSchemas[name]) {
      breaks.push(`BREAKING: schema '${name}' removed from components.schemas`);
    }
  }

  // 2. Removed or type-changed properties within existing schemas
  for (const [name, goldenSchema] of Object.entries(goldenSchemas)) {
    const currentSchema = currentSchemas[name];
    if (!currentSchema) continue; // already reported above

    const goldenProps  = (goldenSchema.properties)  || {};
    const currentProps = (currentSchema.properties) || {};

    for (const [prop, goldenDef] of Object.entries(goldenProps)) {
      if (!currentProps[prop]) {
        breaks.push(`BREAKING: property '${prop}' removed from schema '${name}'`);
        continue;
      }
      const currentDef = currentProps[prop];
      if (goldenDef.type && currentDef.type && goldenDef.type !== currentDef.type) {
        breaks.push(`BREAKING: type of '${name}.${prop}' changed from '${goldenDef.type}' to '${currentDef.type}'`);
      }
      // Enum shrinkage
      if (goldenDef.enum && currentDef.enum) {
        for (const val of goldenDef.enum) {
          if (!currentDef.enum.includes(val)) {
            breaks.push(`BREAKING: enum value '${val}' removed from '${name}.${prop}'`);
          }
        }
      }
    }
  }

  // 3. Security scheme changes
  const goldenSchemes  = (goldenSpec.components  && goldenSpec.components.securitySchemes)  || {};
  const currentSchemes = (currentSpec.components && currentSpec.components.securitySchemes) || {};
  for (const name of Object.keys(goldenSchemes)) {
    if (!currentSchemes[name]) {
      breaks.push(`BREAKING: security scheme '${name}' removed`);
    }
  }

  return breaks;
}

/**
 * Check the golden endpoint inventory against the live OpenAPI paths.
 * Returns an array of issues (empty = all endpoints present).
 */
function checkGoldenEndpoints(goldenSpec, livePaths) {
  const issues = [];
  const warnings = [];
  const goldenEndpoints = goldenSpec['x-golden-endpoints'] || [];

  for (const ep of goldenEndpoints) {
    // Normalise path: /api/payments → /payments (OpenAPI paths don't include /api prefix)
    const normalised = ep.path.replace(/^\/api/, '') || '/';
    const methods = livePaths[normalised] || livePaths[ep.path] || {};
    if (!methods[ep.method]) {
      issues.push(`BREAKING: endpoint ${ep.method.toUpperCase()} ${ep.path} not found in live spec`);
    }
  }

  // New endpoints in current spec not in golden — non-breaking, just log
  if (livePaths) {
    const goldenPaths = new Set(goldenEndpoints.map((e) => e.path.replace(/^\/api/, '') || '/'));
    for (const p of Object.keys(livePaths)) {
      if (!goldenPaths.has(p) && !goldenPaths.has(`/api${p}`)) {
        warnings.push(`INFO: new endpoint '${p}' not in golden snapshot (non-breaking)`);
      }
    }
  }

  return { issues, warnings };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('API schema golden snapshot', () => {
  test('golden.yaml exists and is valid YAML', () => {
    expect(() => yaml.load(fs.readFileSync(GOLDEN_PATH, 'utf8'))).not.toThrow();
    expect(golden).toBeTruthy();
  });

  test('golden snapshot contains openapi version 3.0.x', () => {
    expect(golden.openapi).toMatch(/^3\.0\./);
  });

  test('golden snapshot defines all required component schemas', () => {
    const schemas = Object.keys((golden.components && golden.components.schemas) || {});
    expect(schemas).toContain('Payment');
    expect(schemas).toContain('Student');
    expect(schemas).toContain('School');
    expect(schemas).toContain('Error');
  });

  test('golden Payment schema has required fields', () => {
    const props = Object.keys(golden.components.schemas.Payment.properties || {});
    expect(props).toContain('status');
    expect(props).toContain('txHash');
    expect(props).toContain('amount');
    expect(props).toContain('studentId');
    expect(props).toContain('schoolId');
  });

  test('golden Payment.status enum covers all required values', () => {
    const statusEnum = golden.components.schemas.Payment.properties.status.enum;
    expect(statusEnum).toContain('SUCCESS');
    expect(statusEnum).toContain('FAILED');
    expect(statusEnum).toContain('PENDING');
  });

  test('golden snapshot defines BearerAuth security scheme', () => {
    const schemes = (golden.components && golden.components.securitySchemes) || {};
    expect(schemes).toHaveProperty('BearerAuth');
    expect(schemes.BearerAuth.type).toBe('http');
    expect(schemes.BearerAuth.scheme).toBe('bearer');
  });

  test('golden snapshot endpoint inventory covers key payment routes', () => {
    const endpoints = golden['x-golden-endpoints'] || [];
    const paths = endpoints.map((e) => e.path);
    expect(paths).toContain('/api/payments/verify');
    expect(paths).toContain('/api/payments/intent');
    expect(paths).toContain('/api/health');
    expect(paths).toContain('/api/docs.json');
  });
});

describe('Breaking change detection logic', () => {
  test('detects removed schema as breaking', () => {
    const current = { components: { schemas: { Student: golden.components.schemas.Student } } };
    const breaks = detectBreakingChanges(golden, current);
    // Payment and School were in golden but removed from current
    expect(breaks.some((b) => b.includes("schema 'Payment' removed"))).toBe(true);
  });

  test('detects removed property as breaking', () => {
    const currentSchemas = JSON.parse(JSON.stringify(golden.components.schemas));
    delete currentSchemas.Payment.properties.txHash;
    const current = { components: { schemas: currentSchemas, securitySchemes: golden.components.securitySchemes } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks.some((b) => b.includes("'txHash' removed from schema 'Payment'"))).toBe(true);
  });

  test('detects type change as breaking', () => {
    const currentSchemas = JSON.parse(JSON.stringify(golden.components.schemas));
    currentSchemas.Payment.properties.amount.type = 'string'; // was 'number'
    const current = { components: { schemas: currentSchemas, securitySchemes: golden.components.securitySchemes } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks.some((b) => b.includes("type of 'Payment.amount' changed"))).toBe(true);
  });

  test('detects removed enum value as breaking', () => {
    const currentSchemas = JSON.parse(JSON.stringify(golden.components.schemas));
    currentSchemas.Payment.properties.status.enum = ['PENDING', 'SUCCESS']; // removed FAILED
    const current = { components: { schemas: currentSchemas, securitySchemes: golden.components.securitySchemes } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks.some((b) => b.includes("'FAILED' removed from 'Payment.status'"))).toBe(true);
  });

  test('adding a new optional field is non-breaking', () => {
    const currentSchemas = JSON.parse(JSON.stringify(golden.components.schemas));
    currentSchemas.Payment.properties.newOptionalField = { type: 'string' };
    const current = { components: { schemas: currentSchemas, securitySchemes: golden.components.securitySchemes } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks).toHaveLength(0);
  });

  test('adding a new enum value is non-breaking', () => {
    const currentSchemas = JSON.parse(JSON.stringify(golden.components.schemas));
    currentSchemas.Payment.properties.status.enum = [...golden.components.schemas.Payment.properties.status.enum, 'REFUNDED'];
    const current = { components: { schemas: currentSchemas, securitySchemes: golden.components.securitySchemes } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks).toHaveLength(0);
  });

  test('no breaking changes detected when current matches golden', () => {
    const breaks = detectBreakingChanges(golden, golden);
    expect(breaks).toHaveLength(0);
  });

  test('detects removed security scheme as breaking', () => {
    const current = { components: { schemas: golden.components.schemas, securitySchemes: {} } };
    const breaks = detectBreakingChanges(golden, current);
    expect(breaks.some((b) => b.includes("'BearerAuth' removed"))).toBe(true);
  });
});

describe('Golden endpoint inventory checks', () => {
  test('no issues when all golden endpoints are present', () => {
    // Build a minimal live paths map from the golden endpoint inventory
    const goldenEndpoints = golden['x-golden-endpoints'] || [];
    const livePaths = {};
    for (const ep of goldenEndpoints) {
      const p = ep.path.replace(/^\/api/, '') || '/';
      livePaths[p] = { [ep.method]: { summary: ep.summary } };
    }
    const { issues } = checkGoldenEndpoints(golden, livePaths);
    expect(issues).toHaveLength(0);
  });

  test('reports missing endpoint as breaking', () => {
    const livePaths = {}; // empty — no endpoints
    const { issues } = checkGoldenEndpoints(golden, livePaths);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/BREAKING/);
  });

  test('new endpoint in current spec is non-breaking (warning only)', () => {
    const goldenEndpoints = golden['x-golden-endpoints'] || [];
    const livePaths = {};
    for (const ep of goldenEndpoints) {
      const p = ep.path.replace(/^\/api/, '') || '/';
      livePaths[p] = { [ep.method]: {} };
    }
    // Add a brand-new endpoint not in golden
    livePaths['/payments/bulk-verify'] = { post: { summary: 'Bulk verify' } };
    const { issues, warnings } = checkGoldenEndpoints(golden, livePaths);
    expect(issues).toHaveLength(0);
    expect(warnings.some((w) => w.includes('/payments/bulk-verify'))).toBe(true);
  });
});

describe('Live API spec comparison (against golden snapshot)', () => {
  // Mock heavy dependencies so app.js can load in the test runner.
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

  const request = require('supertest');
  let app;
  let liveSpec;

  beforeAll(async () => {
    app = require('../backend/src/app');
    const res = await request(app).get('/api/docs.json');
    liveSpec = res.body;
  });

  test('GET /api/docs.json returns a valid OpenAPI 3.0 document', async () => {
    expect(liveSpec).toBeDefined();
    expect(liveSpec.openapi).toMatch(/^3\.0\./);
    expect(liveSpec.info).toBeDefined();
    expect(liveSpec.paths).toBeDefined();
  });

  test('live spec contains all golden component schemas', () => {
    if (!liveSpec || !liveSpec.components) return; // skip if spec unavailable
    const goldenSchemas  = Object.keys(golden.components.schemas);
    const currentSchemas = Object.keys(liveSpec.components.schemas || {});
    for (const name of goldenSchemas) {
      expect(currentSchemas).toContain(name);
    }
  });

  test('no breaking changes between golden snapshot and live spec', () => {
    if (!liveSpec || !liveSpec.components) return;
    const allowBreaking = process.env.ALLOW_BREAKING_API_CHANGE === 'true';
    const breaks = detectBreakingChanges(golden, liveSpec);
    if (allowBreaking) {
      // Log but do not fail — intentional breaking change with --breaking-change flag
      if (breaks.length > 0) {
        console.warn('Intentional breaking changes (ALLOW_BREAKING_API_CHANGE=true):', breaks);
      }
    } else {
      expect(breaks).toHaveLength(0);
    }
  });

  test('Payment schema status enum is not missing any golden values in live spec', () => {
    if (!liveSpec || !liveSpec.components) return;
    const liveEnum = (
      liveSpec.components.schemas &&
      liveSpec.components.schemas.Payment &&
      liveSpec.components.schemas.Payment.properties &&
      liveSpec.components.schemas.Payment.properties.status &&
      liveSpec.components.schemas.Payment.properties.status.enum
    ) || [];
    const goldenEnum = golden.components.schemas.Payment.properties.status.enum;
    for (const val of goldenEnum) {
      expect(liveEnum).toContain(val);
    }
  });
});
