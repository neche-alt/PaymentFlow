/**
 * Alert — inline contextual message for success, warning, error, and info states.
 */

export default {
  title: 'Components/Alert',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'danger', 'info'] },
    title: { control: 'text' },
    children: { control: 'text' },
    dismissible: { control: 'boolean' },
  },
};

import { useState } from 'react';

const configs = {
  success: { icon: '✅', bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)', role: 'status' },
  warning: { icon: '⚠️', bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)', role: 'alert' },
  danger:  { icon: '❌', bg: 'var(--color-danger-bg)',  text: 'var(--color-danger-text)',  border: 'var(--color-danger-border)',  role: 'alert' },
  info:    { icon: 'ℹ️', bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)',    border: 'var(--color-info-border)',    role: 'status' },
};

function Alert({ variant = 'info', title, children, dismissible = false }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const cfg = configs[variant];
  return (
    <div
      role={cfg.role}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        maxWidth: 480,
        position: 'relative',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: '1rem' }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{title}</strong>}
        {children}
      </div>
      {dismissible && (
        <button
          aria-label="Dismiss alert"
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.text, fontSize: 'var(--text-sm)', padding: 0, alignSelf: 'flex-start' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const render = (args) => <Alert {...args} />;

export const Success = { render, args: { variant: 'success', title: 'Payment confirmed', children: 'Your payment of 100 XLM was recorded on the Stellar network.' } };
export const Warning = { render, args: { variant: 'warning', title: 'Overpayment detected', children: 'The student paid 10 XLM more than the required fee.' } };
export const Danger  = { render, args: { variant: 'danger',  title: 'Verification failed', children: 'Transaction hash not found on Horizon.' } };
export const Info    = { render, args: { variant: 'info',    title: 'Testnet mode', children: 'All transactions are on the Stellar testnet. No real funds.' } };
export const Dismissible = { render, args: { variant: 'info', title: 'New feature', children: 'Idempotency keys are now required on payment creation.', dismissible: true } };
export const NoTitle = { render, args: { variant: 'warning', children: 'Redis is unreachable; rate limiting has been disabled.' } };
