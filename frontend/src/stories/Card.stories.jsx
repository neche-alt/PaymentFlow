/**
 * Card — elevated surface container for dashboard metrics and content blocks.
 */

export default {
  title: 'Components/Card',
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    elevation: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

const shadows = { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' };

function Card({ title, subtitle, elevation = 'sm', children }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: shadows[elevation],
        border: '1px solid var(--color-border)',
        padding: 'var(--space-5)',
        fontFamily: 'var(--font-sans)',
        maxWidth: 360,
      }}
    >
      {title && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ margin: '0.2rem 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
        {children || <span style={{ color: 'var(--color-text-subtle)' }}>Card content</span>}
      </div>
    </div>
  );
}

const render = (args) => <Card {...args} />;

export const Default = { render, args: { title: 'Total Collected', subtitle: 'This term' } };
export const WithContent = {
  render,
  args: {
    title: 'Payment Summary',
    subtitle: 'Last 30 days',
    children: (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
          <span>Collected</span><strong>1,250 XLM</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
          <span>Pending</span><strong>80 XLM</strong>
        </div>
      </div>
    ),
  },
};
export const ElevatedMd = { render, args: { title: 'Elevated Card', elevation: 'md' } };
export const ElevatedLg = { render, args: { title: 'High Elevation', elevation: 'lg' } };
export const NoTitle    = { render, args: { children: 'A card with no title or subtitle, just content.' } };
