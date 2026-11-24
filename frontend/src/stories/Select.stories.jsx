/**
 * Select — single-choice dropdown with label and error states.
 */

export default {
  title: 'Components/Select',
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
    options: { control: 'object' },
  },
};

function Select({ label, error, disabled = false, options = [], value = '' }) {
  const borderColor = error ? 'var(--color-danger)' : 'var(--color-border-strong)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxWidth: 320 }}>
      {label && (
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <select
        defaultValue={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-2) var(--space-3)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-sm)',
          background: disabled ? 'var(--color-bg-subtle)' : 'var(--color-surface)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)' }}>{error}</span>
      )}
    </div>
  );
}

const ASSETS = [
  { value: 'XLM', label: 'XLM — Stellar Lumens' },
  { value: 'USDC', label: 'USDC — USD Coin' },
  { value: 'EURC', label: 'EURC — Euro Coin' },
];

const render = (args) => <Select {...args} />;

export const Default = { render, args: { label: 'Asset', options: ASSETS } };
export const WithError = { render, args: { label: 'Asset', options: ASSETS, error: 'Please select a payment asset' } };
export const Disabled = { render, args: { label: 'Asset', options: ASSETS, disabled: true, value: 'XLM' } };
export const Empty = { render, args: { label: 'Class', options: [] } };
