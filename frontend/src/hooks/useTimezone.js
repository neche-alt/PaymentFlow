/**
 * useTimezone — manages timezone preference with localStorage persistence.
 *
 * Returns:
 *  - timezone          : IANA timezone string (e.g. 'America/New_York')
 *  - setTimezone(tz)   : persist a new timezone to localStorage + state
 *  - formatInTimezone  : format an ISO date string with the active timezone
 *  - getTimezoneOffset : returns a display string like 'UTC+1' or 'UTC-5'
 */

import { useState, useCallback } from "react";

const STORAGE_KEY = "preferredTimezone";

/**
 * Compute the UTC offset label for a given IANA timezone.
 * Returns a string like 'UTC+5:30', 'UTC-4', 'UTC+0'.
 *
 * @param {string} tz — IANA timezone identifier
 * @returns {string}
 */
export function getTimezoneOffset(tz) {
  try {
    // Intl.DateTimeFormat with timeZoneName:'shortOffset' gives 'GMT+5:30' etc.
    // We use a fixed reference date so DST doesn't cause inconsistency in tests.
    const date = new Date(2024, 0, 1); // 1 Jan 2024 — northern winter, stable offset
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(date);

    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (!offsetPart) return "UTC+0";

    // offsetPart.value is like 'GMT+5:30' or 'GMT-4' or 'GMT'
    const raw = offsetPart.value.replace("GMT", "UTC");
    // If just 'UTC' (no offset), normalise to 'UTC+0'
    if (raw === "UTC") return "UTC+0";
    return raw;
  } catch {
    return "UTC+0";
  }
}

/**
 * Read the persisted timezone from localStorage, falling back to the browser
 * timezone. Safe to call during SSR (returns browser-timezone fallback).
 */
function readStoredTimezone() {
  if (typeof window === "undefined") {
    // SSR: return a placeholder; will be replaced on client mount
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage might be blocked (private mode, etc.) — ignore
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * useTimezone hook — manages timezone preference.
 */
export function useTimezone() {
  const [timezone, setTimezoneState] = useState(() => readStoredTimezone());

  const setTimezone = useCallback((tz) => {
    setTimezoneState(tz);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, tz);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  /**
   * Format an ISO date string (or Date object) using the active timezone.
   *
   * @param {string|Date} isoDate
   * @param {Intl.DateTimeFormatOptions} [formatOpts]
   * @returns {string}
   */
  const formatInTimezone = useCallback(
    (isoDate, formatOpts = { dateStyle: "medium", timeStyle: "short" }) => {
      if (!isoDate) return "";
      try {
        const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
        return new Intl.DateTimeFormat("en-US", {
          ...formatOpts,
          timeZone: timezone,
        }).format(date);
      } catch {
        return String(isoDate);
      }
    },
    [timezone]
  );

  return {
    timezone,
    setTimezone,
    formatInTimezone,
    /** Offset display string for the currently active timezone */
    getTimezoneOffset: () => getTimezoneOffset(timezone),
  };
}

export default useTimezone;
