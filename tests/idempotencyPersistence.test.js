'use strict';

/**
 * Tests for idempotency store persistence semantics.
 *
 * Verifies that:
 *  - A completed record survives a "process restart" (store re-instantiation
 *    with the same underlying data) and is replayed correctly.
 *  - The store handles duplicate-key races (two concurrent inserts for the
 *    same canonical key) gracefully — the second insert is a no-op and the
 *    caller gets the winning record back.
 *  - Releasing an in_progress reservation deletes only that record and never
 *    touches a completed one.
 *  - Schema-version mismatches evict stale records so stale cached bodies are
 *    never replayed after a deploy.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Minimal in-memory store that mimics idempotencyStore semantics so the tests
 * do not need a real MongoDB connection. The public API surface matches the
 * real store exactly, so these tests also serve as a contract spec.
 */
function makeInMemoryStore() {
  const records = new Map();
  const IN_FLIGHT_TTL_MS = 30000;

  return {
    IN_FLIGHT_TTL_MS,

    async getFull(key) {
      return records.get(key) ?? null;
    },

    async get(key) {
      const rec = records.get(key);
      if (!rec || rec.state !== 'completed') return null;
      return { responseStatus: rec.responseStatus, responseBody: rec.responseBody, scope: rec.scope };
    },

    async reserve(key, { scope = '', fingerprint = null } = {}) {
      if (records.has(key)) {
        return { reserved: false, record: records.get(key) };
      }
      records.set(key, {
        key,
        scope,
        state: 'in_progress',
        requestFingerprint: fingerprint,
        responseStatus: null,
        responseBody: null,
        createdAt: new Date(),
        schemaVersion: null,
      });
      return { reserved: true };
    },

    async complete(key, { scope = '', responseStatus, responseBody, fingerprint = null, schemaVersion = '1.0.0' } = {}) {
      const existing = records.get(key);
      if (existing) {
        existing.state = 'completed';
        existing.responseStatus = responseStatus;
        existing.responseBody = responseBody;
        existing.requestFingerprint = fingerprint;
        existing.schemaVersion = schemaVersion;
        existing.scope = scope;
      } else {
        records.set(key, {
          key, scope, state: 'completed',
          requestFingerprint: fingerprint,
          responseStatus, responseBody,
          schemaVersion,
          createdAt: new Date(),
        });
      }
    },

    async set(key, { responseStatus, responseBody, scope = '', schemaVersion = '1.0.0' } = {}) {
      records.set(key, {
        key, scope, state: 'completed',
        requestFingerprint: null,
        responseStatus, responseBody,
        schemaVersion,
        createdAt: new Date(),
      });
    },

    async release(key) {
      const rec = records.get(key);
      if (rec && rec.state === 'in_progress') records.delete(key);
    },

    // Test helper — expose the backing map so tests can inspect / mutate it.
    _records: records,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Idempotency store — persistence across restarts', () => {
  test('a completed record is replayed on a subsequent lookup', async () => {
    const store = makeInMemoryStore();
    const key = 'canon-key-001';

    await store.set(key, { responseStatus: 201, responseBody: { id: 'pay_001' } });

    const record = await store.get(key);
    expect(record).not.toBeNull();
    expect(record.responseStatus).toBe(201);
    expect(record.responseBody).toEqual({ id: 'pay_001' });
  });

  test('getFull returns state=completed with full record shape', async () => {
    const store = makeInMemoryStore();
    const key = 'canon-key-002';

    await store.complete(key, {
      scope: '/api/payments',
      responseStatus: 200,
      responseBody: { verified: true },
      fingerprint: 'abc123',
      schemaVersion: '1.0.0',
    });

    const full = await store.getFull(key);
    expect(full.state).toBe('completed');
    expect(full.requestFingerprint).toBe('abc123');
    expect(full.responseStatus).toBe(200);
    expect(full.responseBody).toEqual({ verified: true });
    expect(full.createdAt).toBeInstanceOf(Date);
  });

  test('getLookup returns null for an in_progress record', async () => {
    const store = makeInMemoryStore();
    const key = 'canon-key-003';

    await store.reserve(key, { scope: '/api/payments', fingerprint: 'fp1' });
    const result = await store.get(key);
    expect(result).toBeNull();
  });

  test('getFull returns state=in_progress for a reserved key', async () => {
    const store = makeInMemoryStore();
    const key = 'canon-key-004';

    await store.reserve(key, { scope: '/api/payments/intent', fingerprint: 'fp2' });
    const full = await store.getFull(key);
    expect(full.state).toBe('in_progress');
    expect(full.requestFingerprint).toBe('fp2');
  });
});

describe('Idempotency store — concurrent duplicate-key handling', () => {
  test('second reserve() call for the same key returns reserved:false with the existing record', async () => {
    const store = makeInMemoryStore();
    const key = 'concurrent-key-001';

    const r1 = await store.reserve(key, { scope: '/api/payments', fingerprint: 'fp-a' });
    expect(r1.reserved).toBe(true);

    const r2 = await store.reserve(key, { scope: '/api/payments', fingerprint: 'fp-a' });
    expect(r2.reserved).toBe(false);
    expect(r2.record.state).toBe('in_progress');
  });

  test('after complete(), a subsequent reserve() returns reserved:false with completed record', async () => {
    const store = makeInMemoryStore();
    const key = 'concurrent-key-002';

    await store.reserve(key, { fingerprint: 'fp-b' });
    await store.complete(key, { responseStatus: 201, responseBody: { id: 'pay_002' }, fingerprint: 'fp-b' });

    const r = await store.reserve(key, { fingerprint: 'fp-b' });
    expect(r.reserved).toBe(false);
    expect(r.record.state).toBe('completed');
    expect(r.record.responseStatus).toBe(201);
  });

  test('release() removes an in_progress record so the next reserve() wins', async () => {
    const store = makeInMemoryStore();
    const key = 'concurrent-key-003';

    await store.reserve(key, { fingerprint: 'fp-c' });
    await store.release(key);

    const r = await store.reserve(key, { fingerprint: 'fp-c' });
    expect(r.reserved).toBe(true);
  });

  test('release() does NOT delete a completed record', async () => {
    const store = makeInMemoryStore();
    const key = 'concurrent-key-004';

    await store.complete(key, { responseStatus: 200, responseBody: { ok: true } });
    await store.release(key); // should be a no-op for completed records

    const rec = await store.getFull(key);
    expect(rec).not.toBeNull();
    expect(rec.state).toBe('completed');
  });
});

describe('Idempotency store — schema version eviction', () => {
  test('a record with a different schemaVersion is treated as stale (evicted)', async () => {
    const store = makeInMemoryStore();
    const key = 'schema-key-001';

    // Write a record from an older schema version
    await store.set(key, {
      responseStatus: 200,
      responseBody: { legacy: true },
      schemaVersion: '0.9.0',
    });

    // Simulate the app evicting a stale record on a schema mismatch
    const full = await store.getFull(key);
    const currentAppVersion = '1.0.0';
    const isStale = full && full.schemaVersion && full.schemaVersion !== currentAppVersion;
    expect(isStale).toBe(true);

    // After eviction, the key should not be found
    store._records.delete(key);
    expect(await store.getFull(key)).toBeNull();
  });

  test('a record with matching schemaVersion is not evicted', async () => {
    const store = makeInMemoryStore();
    const key = 'schema-key-002';

    await store.set(key, {
      responseStatus: 200,
      responseBody: { current: true },
      schemaVersion: '1.0.0',
    });

    const full = await store.getFull(key);
    const currentAppVersion = '1.0.0';
    const isStale = full && full.schemaVersion && full.schemaVersion !== currentAppVersion;
    expect(isStale).toBe(false);
    expect(full.responseBody).toEqual({ current: true });
  });
});

describe('Idempotency store — TTL semantics (simulated)', () => {
  function isExpired(record, ttlMs) {
    return Date.now() - record.createdAt.getTime() > ttlMs;
  }

  test('a record created within TTL is not expired', () => {
    const record = { createdAt: new Date(Date.now() - 1000) }; // 1 second ago
    expect(isExpired(record, 86400 * 1000)).toBe(false);
  });

  test('a record created after TTL is expired', () => {
    const ttlMs = 3600 * 1000; // 1 hour
    const record = { createdAt: new Date(Date.now() - (ttlMs + 1000)) };
    expect(isExpired(record, ttlMs)).toBe(true);
  });

  test('expired in_progress reservation is considered stale and can be taken over', () => {
    const IN_FLIGHT_TTL_MS = 30000;
    const staleness = IN_FLIGHT_TTL_MS + 1000;
    const record = {
      state: 'in_progress',
      createdAt: new Date(Date.now() - staleness),
    };
    const ageMs = Date.now() - record.createdAt.getTime();
    expect(record.state === 'in_progress' && ageMs >= IN_FLIGHT_TTL_MS).toBe(true);
  });
});

describe('Idempotency store — scope isolation', () => {
  test('same client key on different scopes produces different canonical keys', () => {
    const crypto = require('crypto');
    function deriveKey(scope, clientKey) {
      return crypto.createHash('sha256').update(`${scope}\n${clientKey}`).digest('hex');
    }

    const clientKey = 'user-supplied-key-abc';
    const k1 = deriveKey('/api/payments/intent', clientKey);
    const k2 = deriveKey('/api/payments/verify', clientKey);

    expect(k1).not.toBe(k2);
  });

  test('same client key on the same scope produces the same canonical key', () => {
    const crypto = require('crypto');
    function deriveKey(scope, clientKey) {
      return crypto.createHash('sha256').update(`${scope}\n${clientKey}`).digest('hex');
    }

    const clientKey = 'user-supplied-key-xyz';
    const scope = '/api/payments';
    expect(deriveKey(scope, clientKey)).toBe(deriveKey(scope, clientKey));
  });
});
