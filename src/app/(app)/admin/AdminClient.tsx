'use client';

import { useState } from 'react';
import styles from './admin.module.css';
import { grantCreditsAction } from './actions';

interface Balance {
  clerk_user_id: string;
  email: string;
  curator: boolean;
  balance_cents: number;
  updated_at: string;
  run_count: number;
  total_granted_cents: number | null;
}

interface Grant {
  clerk_user_id: string;
  amount_cents: number;
  created_at: string;
}

interface AdminClientProps {
  balances: Balance[];
  recentGrants: Grant[];
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminClient({ balances, recentGrants }: AdminClientProps) {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [curatorToggles, setCuratorToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(balances.map((b) => [b.clerk_user_id, b.curator])),
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleCuratorToggle(userId: string) {
    const current = curatorToggles[userId];
    setTogglingId(userId);
    try {
      const res = await fetch('/api/admin/curator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, curator: !current }),
      });
      if (res.ok) {
        setCuratorToggles((prev) => ({ ...prev, [userId]: !current }));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const result = await grantCreditsAction(email, parseFloat(amount));
      if (result.ok) {
        setStatus({
          ok: true,
          message: `Granted ${formatDollars(result.granted)} to ${email}. New balance: ${formatDollars(result.newBalance)}`,
        });
        setEmail('');
        setAmount('');
      } else {
        setStatus({ ok: false, message: result.error });
      }
    } catch {
      setStatus({ ok: false, message: 'Request failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.heading}>Admin — Credits</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Grant credits</h2>
          <form onSubmit={handleGrant} className={styles.form}>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={styles.input}
              min="0.01"
              step="0.01"
              required
            />
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Granting...' : 'Grant'}
            </button>
          </form>
          {status && (
            <p className={status.ok ? styles.success : styles.error}>
              {status.message}
            </p>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>User balances</h2>
          {balances.length === 0 ? (
            <p className={styles.empty}>No users yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Balance</th>
                  <th>Total granted</th>
                  <th>Total spent</th>
                  <th>Runs</th>
                  <th>Curator</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const granted = b.total_granted_cents
                    ? Number(b.total_granted_cents)
                    : 0;
                  const spent = granted - b.balance_cents;
                  return (
                    <tr key={b.clerk_user_id}>
                      <td>
                        <div>{b.email}</div>
                        <code>{b.clerk_user_id}</code>
                      </td>
                      <td>{formatDollars(b.balance_cents)}</td>
                      <td>{granted ? formatDollars(granted) : '—'}</td>
                      <td>{spent > 0 ? formatDollars(spent) : '—'}</td>
                      <td>{String(b.run_count)}</td>
                      <td>
                        <button
                          className={styles.button}
                          style={{
                            padding: '0.25rem 0.625rem',
                            fontSize: '0.8rem',
                            background: curatorToggles[b.clerk_user_id]
                              ? '#065f46'
                              : undefined,
                          }}
                          disabled={togglingId === b.clerk_user_id}
                          onClick={() => handleCuratorToggle(b.clerk_user_id)}
                        >
                          {curatorToggles[b.clerk_user_id] ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Recent grants</h2>
          {recentGrants.length === 0 ? (
            <p className={styles.empty}>No grants yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentGrants.map((g, i) => (
                  <tr key={i}>
                    <td>
                      <code>{g.clerk_user_id}</code>
                    </td>
                    <td>{formatDollars(g.amount_cents)}</td>
                    <td>{new Date(g.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
