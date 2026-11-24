/**
 * Modal — accessible dialog overlay using a portal-less inline approach
 * suitable for Storybook rendering. The host application wraps this with a
 * React portal in production.
 */
import { useState } from 'react';

export default {
  title: 'Components/Modal',
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    open: { control: 'boolean' },
    children: { control: 'text' },
  },
};

function Modal({ title = 'Confirm', open = true, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-6)',
          width: '100%', maxWidth: 440,
          margin: 'var(--space-4)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 id="modal-title" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {title}
          </h2>
          <button
            aria-label="Close dialog"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--line-height-normal)' }}>
          {children || 'Modal content goes here.'}
        </div>
      </div>
    </div>
  );
}

function ModalWithTrigger(args) {
  const [open, setOpen] = useState(args.open ?? false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: 'var(--color-brand-primary)', color: '#fff', border: 'none', fontFamily: 'var(--font-sans)' }}>
        Open Modal
      </button>
      <Modal {...args} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export const Default = { render: (args) => <ModalWithTrigger {...args} />, args: { title: 'Confirm Payment', children: 'Are you sure you want to submit this payment? This action cannot be undone.' } };
export const Open    = { render: (args) => <Modal {...args} />, args: { title: 'Payment Confirmed', open: true, children: 'Your payment of 100 XLM has been submitted to the Stellar network.' } };
export const Closed  = { render: (args) => <Modal {...args} />, args: { title: 'Never Shown', open: false } };
