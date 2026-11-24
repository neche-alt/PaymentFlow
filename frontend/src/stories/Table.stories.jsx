/**
 * Table — data table for payment lists, student rosters, and audit logs.
 */

export default {
  title: 'Components/Table',
  tags: ['autodocs'],
  argTypes: {
    striped: { control: 'boolean' },
    loading: { control: 'boolean' },
    empty: { control: 'boolean' },
  },
};

const COLUMNS = ['Tx Hash', 'Student', 'Amount', 'Asset', 'Status', 'Date'];
const ROWS = [
  { hash: 'a1b2c3d4…', student: 'STU001', amount: '100.00', asset: 'XLM', status: 'SUCCESS', date: '2024-11-01' },
  { hash: 'e5f6a7b8…', student: 'STU002', amount: '75.50',  asset: 'USDC', status: 'PENDING', date: '2024-11-02' },
  { hash: 'c9d0e1f2…', student: 'STU003', amount: '200.00', asset: 'XLM', status: 'FAILED',  date: '2024-11-03' },
];

const statusColor = { SUCCESS: 'var(--color-success-text)', PENDING: 'var(--color-warning-text)', FAILED: 'var(--color-danger-text)' };

function Table({ striped = false, loading = false, empty = false }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-sans)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
            {COLUMNS.map((col) => (
              <th key={col} style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={COLUMNS.length} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
          ) : empty ? (
            <tr><td colSpan={COLUMNS.length} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-subtle)' }}>No payments found.</td></tr>
          ) : (
            ROWS.map((row, i) => (
              <tr key={row.hash} style={{ background: striped && i % 2 === 1 ? 'var(--color-bg-subtle)' : 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{row.hash}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{row.student}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'var(--font-weight-semibold)' }}>{row.amount}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{row.asset}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'var(--font-weight-semibold)', color: statusColor[row.status] }}>{row.status}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-muted)' }}>{row.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const render = (args) => <Table {...args} />;

export const Default  = { render, args: {} };
export const Striped  = { render, args: { striped: true } };
export const Loading  = { render, args: { loading: true } };
export const Empty    = { render, args: { empty: true } };
