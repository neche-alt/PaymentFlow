/**
 * Toast — transient notification that auto-dismisses after a timeout.
 */
import { useState, useEffect } from 'react';

export default {
  title: 'Components/Toast',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'danger', 'info'] },
    message: { control: 'text' },
    duration: { control: 'number', description: 'Auto-dismiss after ms (0 = no auto-dismiss)' },
  },
};

const configs = {
  success: { icon: '✅', bg: 'var(--color-success-bg)',  text: 'var(--color-success-text)',  border: 'var(--color-success-border)' },
  warning: { icon: '⚠️', bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)',  border: 'var(--color-warning-border)' },
  danger:  { icon: '❌', bg: 'var(--color-danger-bg)',   text: 'var(--color-danger-text)',   border: 'var(--color-danger-border)' },
  info:    { icon: 'ℹ️', bg: 'var(--color-info-bg)',     text: 'var(--color-info-text)',     border: 'var(--color-info-border)' },
};

function Toast({ variant = 'info', message = 'Notification', duration = 0, onDismiss }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const t = setTimeout(() => { setVisible(false); onDismiss?.(); }, duration);
      return () => clearTimeout(t);
    }
  }, [duration, onDismiss]);

  if (!visible) return null;
  const cfg = configs[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2) var(--space-4)',
        boxShadow: 'var(--shadow-md)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-weight-medium)',
        maxWidth: 360,
      }}
    >
      <span>{cfg.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        aria-label="Dismiss"
        onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.text, fontSize: 'var(--text-sm)', padding: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

function ToastWithTrigger(args) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
      <button
        onClick={() => setShow(true)}
        style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-brand-primary)', color: '#fff', border: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
      >
        Show Toast
      </button>
      {show && <Toast {...args} onDismiss={() => setShow(false)} />}
    </div>
  );
}

export const Success = { render: (a) => <Toast {...a} />, args: { variant: 'success', message: 'Payment of 100 XLM confirmed.' } };
export const Warning = { render: (a) => <Toast {...a} />, args: { variant: 'warning', message: 'Overpayment of 5 XLM detected.' } };
export const Danger  = { render: (a) => <Toast {...a} />, args: { variant: 'danger',  message: 'Verification failed. Please retry.' } };
export const Info    = { render: (a) => <Toast {...a} />, args: { variant: 'info',    message: 'Syncing payments from Stellar…' } };
export const AutoDismiss = { render: (a) => <ToastWithTrigger {...a} />, args: { variant: 'success', message: 'Saved! Dismisses in 3 s.', duration: 3000 } };
