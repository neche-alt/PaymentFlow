/**
 * Input — single-line text input with label, hint, and error states.
 */

export default {
  title: 'Components/Input',
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
    type: { control: 'select', options: ['text', 'email', 'password', 'number'] },
    value: { control: 'text' },
  },
};

function Input({ label, placeholder, hint, error, disabled = false, type = 'text', value = '' }) {
  const borderColor = error ? 'var(--color-danger)' : 'var(--color-border-strong)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxWidth: 320 }}>
      {label && (
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'input-error' : hint ? 'input-hint' : undefined}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-2) var(--space-3)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-sm)',
          background: disabled ? 'var(--color-bg-subtle)' : 'var(--color-surface)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          cursor: disabled ? 'not-allowed' : 'text',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <span id="input-error" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span id="input-hint" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

const render = (args) => <Input {...args} />;

export const Default = { render, args: { label: 'Student ID', placeholder: 'e.g. STU001' } };
export const WithHint = { render, args: { label: 'Email', placeholder: 'parent@school.edu', hint: 'Used for payment receipts', type: 'email' } };
export const WithError = { render, args: { label: 'Amount', placeholder: '100', error: 'Amount must be greater than 0', type: 'number' } };
export const Disabled = { render, args: { label: 'School ID', value: 'SCH001', disabled: true } };
export const Password = { render, args: { label: 'Password', placeholder: '••••••••', type: 'password' } };
