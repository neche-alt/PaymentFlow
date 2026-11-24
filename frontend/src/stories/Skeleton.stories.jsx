/**
 * Skeleton — animated loading placeholder that mirrors content shape.
 */

export default {
  title: 'Components/Skeleton',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['text', 'circle', 'rect'] },
    width: { control: 'text' },
    height: { control: 'text' },
  },
};

const shimmer = `
  @keyframes shimmer {
    0%   { background-position: -800px 0; }
    100% { background-position:  800px 0; }
  }
`;

function Skeleton({ variant = 'rect', width = '100%', height = '1rem' }) {
  const radius = variant === 'circle' ? '50%' : variant === 'text' ? 'var(--radius-sm)' : 'var(--radius-md)';
  const w = variant === 'circle' ? height : width;
  return (
    <>
      <style>{shimmer}</style>
      <div
        aria-hidden="true"
        style={{
          width: w,
          height,
          borderRadius: radius,
          background: 'linear-gradient(90deg, var(--color-border) 25%, var(--color-bg-subtle) 50%, var(--color-border) 75%)',
          backgroundSize: '800px 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
          display: 'inline-block',
        }}
      />
    </>
  );
}

function CardSkeleton() {
  return (
    <div style={{ padding: 'var(--space-5)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', maxWidth: 360, fontFamily: 'var(--font-sans)' }}>
      <Skeleton variant="text" width="60%" height="1rem" />
      <div style={{ marginTop: 'var(--space-2)' }} />
      <Skeleton variant="text" width="40%" height="0.75rem" />
      <div style={{ marginTop: 'var(--space-4)' }} />
      <Skeleton variant="rect" width="100%" height="80px" />
    </div>
  );
}

export const Text   = { render: () => <Skeleton variant="text"   width="200px" height="1rem" /> };
export const Circle = { render: () => <Skeleton variant="circle" height="40px" /> };
export const Rect   = { render: () => <Skeleton variant="rect"   width="320px" height="120px" /> };
export const CardPlaceholder = { render: () => <CardSkeleton /> };
export const ListPlaceholder = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 400 }}>
      {[80, 60, 70, 50, 65].map((pct, i) => (
        <Skeleton key={i} variant="text" width={`${pct}%`} height="0.9rem" />
      ))}
    </div>
  ),
};
