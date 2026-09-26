/**
 * Tests for useTimezone utility functions — Issue #112
 *
 * These tests follow the pattern of existing utility tests (e.g.
 * src/utils/__tests__/paymentStatus.test.js). Jest 29 with babel-jest,
 * NO React Testing Library.
 *
 * We test the pure exported helper functions from useTimezone.js directly:
 *   - getTimezoneOffset
 *   - Module export shape
 *
 * The hook itself (useTimezone) uses useState and localStorage; we verify
 * the module exports the hook and that related pure functions behave correctly.
 */

import { getTimezoneOffset } from "../useTimezone";

// ── getTimezoneOffset ─────────────────────────────────────────────────────────

describe("getTimezoneOffset", () => {
  it("returns a string starting with 'UTC'", () => {
    const result = getTimezoneOffset("UTC");
    expect(typeof result).toBe("string");
    expect(result.startsWith("UTC")).toBe(true);
  });

  it("returns 'UTC+0' for UTC timezone", () => {
    const result = getTimezoneOffset("UTC");
    expect(result).toBe("UTC+0");
  });

  it("returns a UTC offset string for America/New_York", () => {
    const result = getTimezoneOffset("America/New_York");
    expect(typeof result).toBe("string");
    expect(result.startsWith("UTC")).toBe(true);
    // In January (reference date used), New York is UTC-5
    expect(result).toBe("UTC-5");
  });

  it("returns a UTC offset string for Asia/Kolkata (UTC+5:30)", () => {
    const result = getTimezoneOffset("Asia/Kolkata");
    expect(typeof result).toBe("string");
    expect(result.startsWith("UTC")).toBe(true);
    expect(result).toBe("UTC+5:30");
  });

  it("returns a UTC offset string for Europe/London", () => {
    const result = getTimezoneOffset("Europe/London");
    expect(typeof result).toBe("string");
    expect(result.startsWith("UTC")).toBe(true);
    // January → London is UTC+0
    expect(result).toBe("UTC+0");
  });

  it("returns a UTC offset string for Australia/Sydney (UTC+11 in January)", () => {
    const result = getTimezoneOffset("Australia/Sydney");
    expect(typeof result).toBe("string");
    expect(result.startsWith("UTC")).toBe(true);
  });

  it("returns 'UTC+0' as fallback for an invalid timezone", () => {
    const result = getTimezoneOffset("Not/ATimezone");
    expect(result).toBe("UTC+0");
  });

  it("returns a non-empty string for all IANA timezones in COMMON_TIMEZONES", () => {
    const COMMON_TIMEZONES = [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Africa/Lagos",
      "Asia/Tokyo",
      "Asia/Singapore",
      "Australia/Sydney",
    ];
    for (const tz of COMMON_TIMEZONES) {
      const result = getTimezoneOffset(tz);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.startsWith("UTC")).toBe(true);
    }
  });
});

// ── Module exports ────────────────────────────────────────────────────────────

describe("useTimezone module exports", () => {
  it("exports getTimezoneOffset as a named function", async () => {
    const mod = await import("../useTimezone");
    expect(typeof mod.getTimezoneOffset).toBe("function");
  });

  it("exports useTimezone as a named function", async () => {
    const mod = await import("../useTimezone");
    expect(typeof mod.useTimezone).toBe("function");
  });

  it("exports useTimezone as the default export", async () => {
    const mod = await import("../useTimezone");
    expect(typeof mod.default).toBe("function");
  });

  it("named and default useTimezone exports are the same function", async () => {
    const mod = await import("../useTimezone");
    expect(mod.default).toBe(mod.useTimezone);
  });
});

// ── Timezone offset format contract ──────────────────────────────────────────

describe("getTimezoneOffset format contract", () => {
  it("always produces a result matching /^UTC([+-]\\d{1,2}(:\\d{2})?)?$/", () => {
    const validTimezones = ["UTC", "America/New_York", "Asia/Tokyo", "Europe/Paris"];
    const pattern = /^UTC([+-]\d{1,2}(:\d{2})?)?$/;

    for (const tz of validTimezones) {
      const result = getTimezoneOffset(tz);
      // Normalize 'UTC+0' matches the pattern too
      const normalized = result === "UTC+0" ? "UTC+0" : result;
      expect(normalized).toMatch(pattern);
    }
  });
});
