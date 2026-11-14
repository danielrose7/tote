'use client';

import { useState } from 'react';
import type { MergePreview } from '@/lib/users/mergeAccounts';
import { mergeAccountsAction, previewMergeAction } from './actions';
import styles from './admin.module.css';

type Account = {
  id: string;
  email: string;
  name: string;
  verifiedEmails: string[];
  externalProviders: string[];
};
type Pending = { source: Account; target: Account; preview: MergePreview };

export function MergeAccounts() {
  const [sourceEmail, setSourceEmail] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [moveEmails, setMoveEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setPending(null);
    try {
      const res = await previewMergeAction(sourceEmail, targetEmail);
      if (res.ok) setPending(res);
      else setStatus({ ok: false, message: res.error });
    } catch (err) {
      setStatus({ ok: false, message: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await mergeAccountsAction(
        pending.source.id,
        pending.target.id,
        moveEmails,
      );
      if (res.ok) {
        const { source, target } = pending;
        const c = res.clerk;
        const clerkNote =
          c.status === 'done'
            ? ` Old Clerk user deleted; ${c.movedEmails.join(', ') || 'no emails'} added to ${target.email} (still primary: ${target.email}).`
            : c.status === 'failed'
              ? ` Data merged, but the Clerk step failed: ${c.error}. Finish by hand in the Clerk dashboard (delete ${source.email}, then add its emails to ${target.email}).`
              : ` Clerk untouched; ${source.email} still exists as an empty account.`;
        setStatus({
          ok: c.status !== 'failed',
          message: `Merged ${source.email} into ${target.email}.${clerkNote}`,
        });
        setPending(null);
        setSourceEmail('');
        setTargetEmail('');
      } else {
        setStatus({ ok: false, message: res.error });
      }
    } catch (err) {
      setStatus({ ok: false, message: String(err) });
    } finally {
      setBusy(false);
    }
  }

  const p = pending?.preview;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Merge accounts</h2>
      <form onSubmit={handlePreview} className={styles.form}>
        <input
          type="email"
          placeholder="Merge FROM (old account email)"
          value={sourceEmail}
          onChange={(e) => setSourceEmail(e.target.value)}
          className={styles.input}
          required
        />
        <input
          type="email"
          placeholder="Merge INTO (account to keep)"
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          className={styles.input}
          required
        />
        <button type="submit" className={styles.button} disabled={busy}>
          Preview
        </button>
      </form>

      {pending && p && (
        <div>
          <p>
            Move everything from <strong>{pending.source.email}</strong> (
            {pending.source.id}) into <strong>{pending.target.email}</strong> (
            {pending.target.id}):
          </p>
          <ul>
            <li>{p.collectionsOwned} owned collections</li>
            <li>{p.collectionMemberships} collection memberships</li>
            <li>{p.publications} published collections</li>
            <li>{p.curatorSessions} curator sessions</li>
            <li>
              {p.creditTransactions} credit transactions, $
              {(p.creditBalanceCents / 100).toFixed(2)} balance added to target
            </li>
          </ul>
          {pending.source.externalProviders.length > 0 && (
            <p className={styles.error}>
              {pending.source.email} also signs in with{' '}
              {pending.source.externalProviders.join(', ')}. Clerk can&apos;t
              move social logins between users, so deleting the old user means
              that login will create a brand-new empty account next time.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={moveEmails}
              onChange={(e) => setMoveEmails(e.target.checked)}
            />{' '}
            Delete the old Clerk user and add its verified emails (
            {pending.source.verifiedEmails.join(', ') || 'none'}) to{' '}
            {pending.target.email}. Their primary email stays{' '}
            {pending.target.email}.
          </label>
          {p.slugConflicts.length > 0 ? (
            <p className={styles.error}>
              Blocked: both accounts publish a collection with slug{' '}
              {p.slugConflicts.join(', ')}. Rename one first.
            </p>
          ) : (
            <button
              type="button"
              className={styles.button}
              disabled={busy}
              onClick={handleMerge}
            >
              {busy ? 'Merging…' : 'Confirm merge'}
            </button>
          )}
        </div>
      )}
      {status && (
        <p className={status.ok ? styles.success : styles.error}>
          {status.message}
        </p>
      )}
    </section>
  );
}
