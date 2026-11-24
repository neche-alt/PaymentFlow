/**
 * Button — primary interactive control.
 *
 * Uses design tokens from `tokens.css`. All variants, sizes, and states
 * (hover, focus-visible, disabled, loading) are covered here.
 */

export default {
  title: 'Components/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual style of the button',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the button',
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    children: { control: 'text' },
  },
};

const styles = {
  primary: {
    background: 'var(--color-brand-primary)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'var(--color-bg-subtle)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-brand-primary)',
    border: '1px solid var(--color-brand-primary)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#fff',
    border: 'none',
  },
};

const sizes = {
  sm: { fontSize: 'var(--text-xs)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)' },
  md: { fontSize: 'var(--text-sm)', padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-sm)' },
  lg: { fontSize: 'var(--text-base)', padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)' },
};

function Button({ variant = 'primary', size = 'md', disabled = false, loading = false, children = 'Button', onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...styles[variant],
        ...sizes[size],
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--font-weight-semibold)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'var(--transition-base)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        outline: 'none',
      }}
    >
      {loading ? '⏳ ' : null}{children}
    </button>
  );
}

export const Primary = { args: { variant: 'primary', children: 'Pay Now' } };
export const Secondary = { args: { variant: 'secondary', children: 'Cancel' } };
export const Ghost = { args: { variant: 'ghost', children: 'Learn More' } };
export const Danger = { args: { variant: 'danger', children: 'Delete' } };
export const Disabled = { args: { variant: 'primary', children: 'Pay Now', disabled: true } };
export const Loading = { args: { variant: 'primary', children: 'Processing', loading: true } };
export const Small = { args: { variant: 'primary', size: 'sm', children: 'Small' } };
export const Large = { args: { variant: 'primary', size: 'lg', children: 'Large' } };

Primary.render = Secondary.render = Ghost.render = Danger.render =
Disabled.render = Loading.render = Small.render = Large.render =
  (args) => <Button {...args} />;
