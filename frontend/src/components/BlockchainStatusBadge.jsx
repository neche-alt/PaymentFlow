/**
 * BlockchainStatusBadge — Issue #110
 *
 * Rich visual badge for blockchain payment states. Renders status-specific
 * colours, icons, sub-text, and (when applicable) a safe Stellar Explorer
 * link that only exposes the public transaction hash.
 *
 * SECURITY: Only the public txHash is ever included in links. Private keys,
 * wallet secrets, or seed phrases must never be passed or rendered here.
 *
 * Props:
 *   status        {string}  One of the PAYMENT_STATUS constants.
 *   txHash        {string?} Public Stellar transaction hash (safe to expose).
 *   confirmations {number?} Optional confirmations count (reserved for future use).
 *   className     {string?} Additional class names for the wrapper element.
 */

import { useTranslation } from "react-i18next";
import { PAYMENT_STATUS } from "../utils/paymentStatus";
import {
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconX,
  IconExternalLink,
} from "./Icons";

// Statuses that should render a Stellar Explorer link when txHash is present.
const EXPLORER_LINK_STATUSES = new Set([
  PAYMENT_STATUS.SUCCESS,
  PAYMENT_STATUS.SUBMITTED,
  PAYMENT_STATUS.FAILED,
]);

/**
 * Derive the Stellar Explorer base URL from the environment.
 * Uses window check for SSR safety (Next.js renders on the server too).
 *
 * Returns 'testnet' or 'public' (mainnet).
 */
function getStellarNetwork() {
  const network =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet"
      : "testnet";
  return network === "mainnet" ? "public" : "testnet";
}

/**
 * Build a safe Stellar Explorer URL. Only the public txHash is embedded —
 * never wallet secrets or sensitive data.
 *
 * @param {string} txHash  Public blockchain transaction hash.
 * @returns {string}
 */
function buildExplorerUrl(txHash) {
  const network = getStellarNetwork();
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

/**
 * Per-status visual configuration. Colours reference CSS variables so they
 * respond to dark/light mode automatically.
 */
const STATUS_CONFIG = {
  [PAYMENT_STATUS.PENDING]: {
    labelKey: "blockchain.statusPending",
    subtextKey: null,
    bg: "var(--warning-bg)",
    color: "var(--warning-text)",
    border: "var(--warning-border)",
    Icon: IconClock,
    pulse: false,
  },
  [PAYMENT_STATUS.SUBMITTED]: {
    labelKey: "blockchain.statusSubmitted",
    subtextKey: "blockchain.statusSubmittedSub",
    bg: "var(--info-bg)",
    color: "var(--info-text)",
    border: "var(--info-border)",
    Icon: null,
    pulse: true,
  },
  [PAYMENT_STATUS.SUCCESS]: {
    labelKey: "blockchain.statusSuccess",
    subtextKey: "blockchain.statusSuccessSub",
    bg: "var(--success-bg)",
    color: "var(--success-text)",
    border: "var(--success-border)",
    Icon: IconCheck,
    pulse: false,
  },
  [PAYMENT_STATUS.FAILED]: {
    labelKey: "blockchain.statusFailed",
    subtextKey: "blockchain.statusFailedSub",
    bg: "var(--danger-bg)",
    color: "var(--danger-text)",
    border: "var(--danger-border)",
    Icon: IconX,
    pulse: false,
  },
  [PAYMENT_STATUS.DISPUTED]: {
    labelKey: "blockchain.statusDisputed",
    subtextKey: null,
    bg: "var(--warning-bg)",
    color: "var(--warning-text)",
    border: "var(--warning-border)",
    Icon: IconAlertTriangle,
    pulse: false,
  },
  [PAYMENT_STATUS.REFUNDED]: {
    labelKey: "blockchain.statusRefunded",
    subtextKey: null,
    // Purple/accent treatment
    bg: "var(--accent-subtle)",
    color: "var(--accent)",
    border: "var(--accent-ring)",
    Icon: null,
    pulse: false,
  },
  [PAYMENT_STATUS.INVALID]: {
    labelKey: "blockchain.statusInvalid",
    subtextKey: null,
    bg: "var(--danger-bg)",
    color: "var(--danger-text)",
    border: "var(--danger-border)",
    Icon: IconX,
    pulse: false,
  },
};

const DEFAULT_CONFIG = {
  labelKey: null,
  subtextKey: null,
  bg: "var(--bg-subtle)",
  color: "var(--text-muted)",
  border: "var(--border)",
  Icon: null,
  pulse: false,
};

export default function BlockchainStatusBadge({
  status,
  txHash,
  // confirmations reserved for future use (e.g. show block confirmations counter)
  // eslint-disable-next-line no-unused-vars
  confirmations,
  className,
}) {
  const { t } = useTranslation();

  const config = STATUS_CONFIG[status] || DEFAULT_CONFIG;
  const { Icon, pulse, bg, color, border, labelKey, subtextKey } = config;

  const label = labelKey ? t(labelKey) : (status ?? t("status.payment.Unknown"));
  const subtext = subtextKey ? t(subtextKey) : null;

  const showExplorerLink =
    txHash && EXPLORER_LINK_STATUSES.has(status);

  const explorerUrl = showExplorerLink ? buildExplorerUrl(txHash) : null;

  // Truncated hash for display (first 8 chars … last 4)
  const shortHash = txHash
    ? `${txHash.slice(0, 8)}…${txHash.slice(-4)}`
    : null;

  return (
    <>
      {/* Keyframe injection — scoped to a single <style> tag per render.
          Next.js deduplicates identical <style> blocks automatically. */}
      <style>{`
        @keyframes bsb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.15); }
        }
        .bsb-pulse-ring {
          animation: bsb-pulse 1.6s ease-in-out infinite;
        }
      `}</style>

      <span
        className={className}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "0.25rem",
        }}
      >
        {/* ── Badge pill ─────────────────────────────────────────── */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.26rem 0.72rem",
            borderRadius: "100px",
            fontSize: "0.71rem",
            fontWeight: 700,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            border: `1px solid ${border}`,
            background: bg,
            color,
          }}
        >
          {/* Pulse ring for SUBMITTED (in-progress indicator) */}
          {pulse && (
            <span
              className="bsb-pulse-ring"
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
          )}

          {/* Static icon for all other states */}
          {!pulse && Icon && (
            <span aria-hidden="true" style={{ display: "flex", flexShrink: 0 }}>
              <Icon size={12} />
            </span>
          )}

          {label}
        </span>

        {/* ── Sub-text (e.g. 'Finalized on Stellar') ─────────────── */}
        {subtext && (
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              paddingLeft: "0.2rem",
            }}
          >
            {subtext}
          </span>
        )}

        {/* ── Stellar Explorer link ───────────────────────────────── */}
        {showExplorerLink && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("blockchain.explorerAriaLabel", { hash: shortHash })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.7rem",
              color: "var(--info-text)",
              textDecoration: "none",
              paddingLeft: "0.2rem",
              marginTop: "0.1rem",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
          >
            <IconExternalLink size={11} />
            {t("blockchain.viewOnExplorer")}
          </a>
        )}
      </span>
    </>
  );
}
