/**
 * DateRangeControl — comprehensive date-range picker with timezone support.
 *
 * Props:
 *  - startDate          : string (YYYY-MM-DD)
 *  - endDate            : string (YYYY-MM-DD)
 *  - timezone           : IANA timezone string
 *  - onRangeChange(start, end, tz) : called whenever range changes
 *  - onTimezoneChange(tz)          : called when the timezone selector changes
 *
 * Exports:
 *  - default DateRangeControl
 *  - useTimezone (re-exported for convenience)
 */

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { IconCalendar, IconX, IconCheck } from "./Icons";
import { useTimezone as _useTimezone, getTimezoneOffset } from "../hooks/useTimezone";

// Re-export so callers can `import DateRangeControl, { useTimezone } from '…/DateRangeControl'`
export { _useTimezone as useTimezone };

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the current local date string (YYYY-MM-DD) in a given IANA timezone.
 */
function todayInTimezone(tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Subtract N days from a YYYY-MM-DD date string.
 */
function subtractDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Get YYYY-MM-DD for the first/last day of a month offset from today.
 * monthOffset=0 → this month, monthOffset=-1 → last month.
 */
function monthRange(tz, monthOffset) {
  const todayStr = todayInTimezone(tz);
  const d = new Date(todayStr + "T00:00:00");
  d.setMonth(d.getMonth() + monthOffset, 1);
  const start = d.toISOString().slice(0, 10);
  d.setMonth(d.getMonth() + 1, 0); // last day of target month
  const end = d.toISOString().slice(0, 10);
  return { start, end };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   startDate: string,
 *   endDate: string,
 *   timezone: string,
 *   onRangeChange: (start: string, end: string, tz: string) => void,
 *   onTimezoneChange: (tz: string) => void,
 * }} props
 */
export default function DateRangeControl({
  startDate,
  endDate,
  timezone,
  onRangeChange,
  onTimezoneChange,
}) {
  const { t } = useTranslation();

  // Local draft values — let the user edit without firing onRangeChange each keystroke
  const [draftStart, setDraftStart] = useState(startDate ?? "");
  const [draftEnd, setDraftEnd]     = useState(endDate   ?? "");
  const [validationError, setValidationError]   = useState("");
  const [validationWarning, setValidationWarning] = useState("");

  // Keep draft in sync when parent resets values
  useEffect(() => { setDraftStart(startDate ?? ""); }, [startDate]);
  useEffect(() => { setDraftEnd(endDate     ?? ""); }, [endDate]);

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = useCallback((start, end) => {
    setValidationError("");
    setValidationWarning("");
    if (start && end && end < start) {
      setValidationError(t("dateRange.invalidRange"));
      return false;
    }
    const today = todayInTimezone(timezone);
    if ((start && start > today) || (end && end > today)) {
      setValidationWarning(t("dateRange.futureDatesWarning"));
    }
    return true;
  }, [t, timezone]);

  // ── Apply / Clear ────────────────────────────────────────────────────────────

  const applyRange = useCallback((start, end) => {
    if (!validate(start, end)) return;
    onRangeChange?.(start, end, timezone);
  }, [validate, onRangeChange, timezone]);

  const clearRange = useCallback(() => {
    setDraftStart("");
    setDraftEnd("");
    setValidationError("");
    setValidationWarning("");
    onRangeChange?.("", "", timezone);
  }, [onRangeChange, timezone]);

  // ── Keyboard support on inputs ───────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      applyRange(draftStart, draftEnd);
    }
  }, [applyRange, draftStart, draftEnd]);

  // ── Preset handlers ──────────────────────────────────────────────────────────

  const applyPreset = useCallback((start, end) => {
    setDraftStart(start);
    setDraftEnd(end);
    setValidationError("");
    setValidationWarning("");
    onRangeChange?.(start, end, timezone);
  }, [onRangeChange, timezone]);

  const presets = [
    {
      label: t("dateRange.presetToday"),
      action() {
        const today = todayInTimezone(timezone);
        applyPreset(today, today);
      },
    },
    {
      label: t("dateRange.presetYesterday"),
      action() {
        const yesterday = subtractDays(todayInTimezone(timezone), 1);
        applyPreset(yesterday, yesterday);
      },
    },
    {
      label: t("dateRange.presetLast7"),
      action() {
        const today = todayInTimezone(timezone);
        applyPreset(subtractDays(today, 6), today);
      },
    },
    {
      label: t("dateRange.presetLast30"),
      action() {
        const today = todayInTimezone(timezone);
        applyPreset(subtractDays(today, 29), today);
      },
    },
    {
      label: t("dateRange.presetThisMonth"),
      action() {
        const { start, end } = monthRange(timezone, 0);
        applyPreset(start, end);
      },
    },
    {
      label: t("dateRange.presetLastMonth"),
      action() {
        const { start, end } = monthRange(timezone, -1);
        applyPreset(start, end);
      },
    },
  ];

  // ── Timezone change ──────────────────────────────────────────────────────────

  const handleTimezoneChange = useCallback((e) => {
    const tz = e.target.value;
    onTimezoneChange?.(tz);
    // Re-apply current range with new tz so parent can re-query if desired
    if (draftStart || draftEnd) {
      onRangeChange?.(draftStart, draftEnd, tz);
    }
  }, [onTimezoneChange, onRangeChange, draftStart, draftEnd]);

  // ── Offset badge ─────────────────────────────────────────────────────────────

  const offsetLabel = getTimezoneOffset(timezone);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .drc-root {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Timezone row */
        .drc-tz-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .drc-tz-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .drc-tz-select {
          padding: 0.3rem 0.55rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-family: inherit;
          color: var(--text);
          background: var(--card-bg);
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .drc-tz-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-subtle);
        }
        /* Timezone offset pill */
        .drc-tz-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          background: var(--accent-subtle);
          color: var(--accent);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Preset buttons row */
        .drc-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .drc-preset-btn {
          padding: 0.28rem 0.65rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--card-bg);
          color: var(--text);
          font-size: 0.78rem;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
          white-space: nowrap;
        }
        .drc-preset-btn:hover,
        .drc-preset-btn:focus-visible {
          background: var(--accent-subtle);
          border-color: var(--accent);
          color: var(--accent);
          outline: none;
        }

        /* Custom range row */
        .drc-range-row {
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .drc-range-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .drc-range-field-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .drc-date-input {
          padding: 0.425rem 0.65rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.825rem;
          font-family: inherit;
          color: var(--text);
          background: var(--card-bg);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .drc-date-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-subtle);
        }
        .drc-date-input.drc-date-input--error {
          border-color: var(--danger);
        }

        /* Apply / Clear buttons */
        .drc-apply-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.425rem 0.85rem;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--accent);
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .drc-apply-btn:hover { background: var(--accent-hover); }
        .drc-apply-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .drc-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.425rem 0.7rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          white-space: nowrap;
        }
        .drc-clear-btn:hover {
          background: var(--danger-bg);
          color: var(--danger-text);
          border-color: var(--danger-border);
        }
        .drc-clear-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        /* Validation messages */
        .drc-error {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: var(--danger-text);
          padding: 0.3rem 0.6rem;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          border-radius: var(--radius-sm);
        }
        .drc-warning {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: var(--warning-text);
          padding: 0.3rem 0.6rem;
          background: var(--warning-bg);
          border: 1px solid var(--warning-border);
          border-radius: var(--radius-sm);
        }
      `}</style>

      <div className="drc-root" role="group" aria-label={t("dateRange.customRange")}>

        {/* Timezone selector row */}
        <div className="drc-tz-row">
          <span className="drc-tz-label">{t("dateRange.timezone")}:</span>
          <select
            className="drc-tz-select"
            value={timezone}
            onChange={handleTimezoneChange}
            aria-label={t("dateRange.timezone")}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          {/* Always-visible timezone offset pill */}
          <span className="drc-tz-pill" aria-label={t("dateRange.timezoneIndicator", { tz: offsetLabel })}>
            {offsetLabel}
          </span>
        </div>

        {/* Preset buttons */}
        <div className="drc-presets" role="group" aria-label="Date presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="drc-preset-btn"
              onClick={preset.action}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        <div className="drc-range-row">
          <div className="drc-range-group">
            <label className="drc-range-field-label" htmlFor="drc-start-date">
              {t("dateRange.startDate")}
            </label>
            <input
              id="drc-start-date"
              type="date"
              className={`drc-date-input${validationError ? " drc-date-input--error" : ""}`}
              value={draftStart}
              onChange={(e) => {
                setDraftStart(e.target.value);
                validate(e.target.value, draftEnd);
              }}
              onKeyDown={handleKeyDown}
              aria-describedby={validationError ? "drc-validation-msg" : undefined}
              tabIndex={0}
            />
          </div>

          <div className="drc-range-group">
            <label className="drc-range-field-label" htmlFor="drc-end-date">
              {t("dateRange.endDate")}
            </label>
            <input
              id="drc-end-date"
              type="date"
              className={`drc-date-input${validationError ? " drc-date-input--error" : ""}`}
              value={draftEnd}
              onChange={(e) => {
                setDraftEnd(e.target.value);
                validate(draftStart, e.target.value);
              }}
              onKeyDown={handleKeyDown}
              aria-describedby={validationError ? "drc-validation-msg" : undefined}
              tabIndex={0}
            />
          </div>

          <button
            type="button"
            className="drc-apply-btn"
            onClick={() => applyRange(draftStart, draftEnd)}
            aria-label={t("dateRange.applyRange")}
            tabIndex={0}
          >
            <IconCheck size={13} />
            {t("dateRange.applyRange")}
          </button>

          {(draftStart || draftEnd) && (
            <button
              type="button"
              className="drc-clear-btn"
              onClick={clearRange}
              aria-label={t("dateRange.clearDates")}
              tabIndex={0}
            >
              <IconX size={13} />
              {t("dateRange.clearDates")}
            </button>
          )}
        </div>

        {/* Validation messages */}
        {validationError && (
          <p id="drc-validation-msg" className="drc-error" role="alert">
            {validationError}
          </p>
        )}
        {!validationError && validationWarning && (
          <p className="drc-warning" role="status">
            {validationWarning}
          </p>
        )}
      </div>
    </>
  );
}
