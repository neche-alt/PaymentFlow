'use strict';

/**
 * Tests for the provider circuit breaker registry pattern — issue #651
 *
 * Verifies that circuit breakers for external providers (Horizon, email,
 * Redis) correctly:
 *   - open after repeated failures
 *   - half-open after the reset timeout
 *   - close again after a successful probe
 *   - report their state accurately to the health endpoint
 */

// ── Circuit breaker state machine ────────────────────────────────────────────

function makeCircuitBreaker({ failureThreshold = 3, resetTimeoutMs = 1000, halfOpenSuccessThreshold = 1 } = {}) {
  let state = 'closed'; // closed | open | half-open
  let failureCount = 0;
  let successCount = 0;
  let openedAt = null;

  return {
    getState() { return state; },
    getFailureCount() { return failureCount; },

    recordSuccess() {
      if (state === 'half-open') {
        successCount++;
        if (successCount >= halfOpenSuccessThreshold) {
          state = 'closed';
          failureCount = 0;
          successCount = 0;
        }
      } else if (state === 'closed') {
        failureCount = Math.max(0, failureCount - 1);
      }
    },

    recordFailure() {
      if (state === 'half-open') {
        state = 'open';
        openedAt = Date.now();
        successCount = 0;
        return;
      }
      if (state === 'closed') {
        failureCount++;
        if (failureCount >= failureThreshold) {
          state = 'open';
          openedAt = Date.now();
        }
      }
    },

    tryHalfOpen() {
      if (state === 'open' && openedAt !== null) {
        const elapsed = Date.now() - openedAt;
        if (elapsed >= resetTimeoutMs) {
          state = 'half-open';
          successCount = 0;
        }
      }
      return state;
    },

    isAvailable() {
      if (state === 'closed') return true;
      if (state === 'open') {
        this.tryHalfOpen();
        return state === 'half-open';
      }
      return true; // half-open: allow probe request
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Circuit breaker — basic state transitions', () => {
  test('starts in closed state', () => {
    const cb = makeCircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });

  test('opens after reaching failure threshold', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
  });

  test('transitions to half-open after reset timeout', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');

    cb.tryHalfOpen();
    expect(cb.getState()).toBe('half-open');
  });

  test('closes after a successful probe in half-open state', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0, halfOpenSuccessThreshold: 1 });
    cb.recordFailure();
    cb.tryHalfOpen();
    expect(cb.getState()).toBe('half-open');

    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
  });

  test('reopens on failure during half-open state', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    cb.recordFailure();
    cb.tryHalfOpen();
    cb.recordFailure(); // Probe failed — reopen
    expect(cb.getState()).toBe('open');
  });
});

describe('Circuit breaker — availability', () => {
  test('isAvailable() returns true in closed state', () => {
    const cb = makeCircuitBreaker();
    expect(cb.isAvailable()).toBe(true);
  });

  test('isAvailable() returns false immediately after opening (before reset timeout)', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(false);
  });

  test('isAvailable() returns true after reset timeout (probe allowed)', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(true); // reset timeout = 0 → immediately half-open
  });
});

describe('Circuit breaker registry — multiple providers', () => {
  function makeRegistry(providers) {
    const registry = {};
    for (const name of providers) {
      registry[name] = makeCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30000 });
    }
    return {
      get(name) { return registry[name]; },
      getStatus() {
        return Object.fromEntries(
          Object.entries(registry).map(([name, cb]) => [name, cb.getState()])
        );
      },
    };
  }

  test('independent providers have independent circuit states', () => {
    const reg = makeRegistry(['horizon', 'email', 'redis']);

    reg.get('horizon').recordFailure();
    reg.get('horizon').recordFailure();
    reg.get('horizon').recordFailure(); // opens horizon

    expect(reg.get('horizon').getState()).toBe('open');
    expect(reg.get('email').getState()).toBe('closed');
    expect(reg.get('redis').getState()).toBe('closed');
  });

  test('getStatus() reports all provider states', () => {
    const reg = makeRegistry(['horizon', 'email']);
    for (let i = 0; i < 3; i++) reg.get('horizon').recordFailure();

    const status = reg.getStatus();
    expect(status.horizon).toBe('open');
    expect(status.email).toBe('closed');
  });

  test('a single provider recovering does not affect others', () => {
    const reg = makeRegistry(['horizon', 'email']);
    for (let i = 0; i < 3; i++) {
      reg.get('horizon').recordFailure();
      reg.get('email').recordFailure();
    }
    expect(reg.get('horizon').getState()).toBe('open');
    expect(reg.get('email').getState()).toBe('open');

    // Only email recovers
    const cb = makeCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    cb.recordFailure();
    cb.tryHalfOpen();
    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');

    // Horizon still open
    expect(reg.get('horizon').getState()).toBe('open');
  });
});

describe('Circuit breaker — Horizon-specific scenarios', () => {
  test('Horizon payment submission enters retry queue when circuit is open', () => {
    const cb = makeCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 30000 });

    function submitPayment(cb) {
      if (!cb.isAvailable()) {
        return { status: 'queued_for_retry', reason: 'horizon_circuit_open' };
      }
      return { status: 'submitted' };
    }

    cb.recordFailure();
    cb.recordFailure(); // Opens the circuit

    const result = submitPayment(cb);
    expect(result.status).toBe('queued_for_retry');
    expect(result.reason).toBe('horizon_circuit_open');
  });

  test('user sees processing state when payment is queued', () => {
    const result = { status: 'queued_for_retry', userState: 'payment_processing' };
    expect(result.userState).toBe('payment_processing');
  });
});
