/**
 * Badge — inline status chip used on payment rows, student cards, and dispute panels.
 */

export default {
  title: 'Components/Badge',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'danger', 'info', 'neutral'],
    },
    children: { control: 'text' },
  },
};

const variantStyles = {
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)' },
  warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', border: '1px solid var(--color-warning-border)' },
  danger:  { background: 'var(--color-danger-bg)',  color: 'var(--color-danger-text)',  border: '1px solid var(--color-danger-border)' },
  info:    { background: 'var(--color-info-bg)',    color: 'var(--color-info-text)',    border: '1px solid var(--color-info-border)' },
  neutral: { background: 'var(--color-neutral-bg)', color: 'var(--color-neutral-text)', border: '1px solid var(--color-neutral-border)' },
};

function Badge({ variant = 'neutral', children = 'Status' }) {
  return (
    <span
      style={{
        ...variantStyles[variant],
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-sans)',
        padding: '0.2rem 0.6rem',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const render = (args) => <Badge {...args} />;

export const Success = { render, args: { variant: 'success', children: 'SUCCESS' } };
export const Warning = { render, args: { variant: 'warning', children: 'OVERPAID' } };
export const Danger  = { render, args: { variant: 'danger',  children: 'FAILED' } };
export const Info    = { render, args: { variant: 'info',    children: 'PENDING' } };
export const Neutral = { render, args: { variant: 'neutral', children: 'UNKNOWN' } };
export const AllVariants = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge variant="success">SUCCESS</Badge>
      <Badge variant="warning">OVERPAID</Badge>
      <Badge variant="danger">FAILED</Badge>
      <Badge variant="info">PENDING</Badge>
      <Badge variant="neutral">UNKNOWN</Badge>
    </div>
  ),
};
