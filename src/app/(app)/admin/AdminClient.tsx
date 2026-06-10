'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { grantCreditsAction } from './actions';
import styles from './admin.module.css';

export interface Balance {
  clerk_user_id: string;
  email: string;
  curator: boolean;
  chatEnabled: boolean;
  balance_cents: number;
  updated_at: string;
  run_count: number;
  total_granted_cents: number | null;
}

export interface Grant {
  clerk_user_id: string;
  email: string;
  amount_cents: number;
  type: string;
  created_at: string;
}

export interface MigrationHealth {
  userId: string;
  email: string;
  dataSource:
    | 'classic_jazz'
    | 'migrating'
    | 'neon_verifying'
    | 'neon'
    | 'migration_failed';
  migrationVersion: number | null;
  status:
    | 'pending'
    | 'exporting'
    | 'importing'
    | 'verifying'
    | 'completed'
    | 'failed'
    | null;
  collectionCount: number | null;
  itemCount: number | null;
  cutoverAt: string | null;
  rollbackExpiresAt: string | null;
  errorCode: string | null;
  updatedAt: string;
}

interface AdminClientProps {
  balances: Balance[];
  recentGrants: Grant[];
  migrationHealth: MigrationHealth[];
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminClient({
  balances,
  recentGrants,
  migrationHealth,
}: AdminClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [curatorToggles, setCuratorToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(balances.map((b) => [b.clerk_user_id, b.curator])),
  );
  const [chatEnabledToggles, setChatEnabledToggles] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(
      balances.map((b) => [b.clerk_user_id, b.chatEnabled]),
    ),
  );
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  async function handleCuratorToggle(userId: string) {
    const current = curatorToggles[userId];
    setTogglingFeature(`curator:${userId}`);
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
      setTogglingFeature(null);
    }
  }

  async function handleChatToggle(userId: string) {
    const current = chatEnabledToggles[userId];
    setTogglingFeature(`chat:${userId}`);
    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, chatEnabled: !current }),
      });
      if (res.ok) {
        setChatEnabledToggles((prev) => ({ ...prev, [userId]: !current }));
      }
    } finally {
      setTogglingFeature(null);
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const result = await grantCreditsAction(email.trim(), parseFloat(amount));
      if (result.ok) {
        setStatus({
          ok: true,
          message: `Granted ${formatDollars(result.granted)} to ${email}. New balance: ${formatDollars(result.newBalance)}`,
        });
        setEmail('');
        setAmount('');
        router.refresh();
      } else {
        setStatus({ ok: false, message: result.error });
      }
    } catch {
      setStatus({ ok: false, message: 'Request failed' });
    } finally {
      setLoading(false);
    }
  }

  function prepareGrant(targetEmail: string) {
    setEmail(targetEmail);
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.heading}>Admin dashboard</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Collection migration health</h2>
          {migrationHealth.length === 0 ? (
            <p className={styles.empty}>No collection migrations yet.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Collections</th>
                    <th>Items</th>
                    <th>Failure</th>
                    <th>Rollback until</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {migrationHealth.map((migration) => (
                    <tr key={migration.userId}>
                      <td>
                        <div>{migration.email}</div>
                        <code>{migration.userId}</code>
                      </td>
                      <td>{migration.dataSource}</td>
                      <td>{migration.status ?? '—'}</td>
                      <td>{migration.collectionCount ?? '—'}</td>
                      <td>{migration.itemCount ?? '—'}</td>
                      <td>{migration.errorCode ?? '—'}</td>
                      <td>
                        {migration.rollbackExpiresAt
                          ? new Date(
                              migration.rollbackExpiresAt,
                            ).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>{new Date(migration.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
                  <th>Chat</th>
                  <th>Credit</th>
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
                          type="button"
                          className={styles.button}
                          style={{
                            padding: '0.25rem 0.625rem',
                            fontSize: '0.8rem',
                            background: curatorToggles[b.clerk_user_id]
                              ? '#065f46'
                              : undefined,
                          }}
                          disabled={
                            togglingFeature === `curator:${b.clerk_user_id}`
                          }
                          onClick={() => handleCuratorToggle(b.clerk_user_id)}
                        >
                          {curatorToggles[b.clerk_user_id] ? 'On' : 'Off'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.button}
                          style={{
                            padding: '0.25rem 0.625rem',
                            fontSize: '0.8rem',
                            background: chatEnabledToggles[b.clerk_user_id]
                              ? '#065f46'
                              : undefined,
                          }}
                          disabled={
                            togglingFeature === `chat:${b.clerk_user_id}`
                          }
                          onClick={() => handleChatToggle(b.clerk_user_id)}
                        >
                          {chatEnabledToggles[b.clerk_user_id] ? 'On' : 'Off'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => prepareGrant(b.email)}
                        >
                          Top up
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
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentGrants.map((g, i) => (
                  <tr key={i}>
                    <td>
                      <div>{g.email}</div>
                      <code>{g.clerk_user_id}</code>
                    </td>
                    <td>{formatDollars(g.amount_cents)}</td>
                    <td>{g.type}</td>
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
