'use client';

import {
  SignedIn,
  SignedOut,
  SignOutButton,
  UserProfile,
  useClerk,
} from '@clerk/nextjs';
import { useAccount } from 'jazz-tools/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AiCreditsPanel } from '@/components/Billing/AiCreditsPanel';
import { Header } from '@/components/Header/Header';
import { JazzAccount } from '@/schema';
import styles from './settings.module.css';

type SettingsTab = 'account' | 'billing';

export function SettingsClient({
  publicProfileCard,
}: {
  publicProfileCard: ReactNode;
}) {
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'error'>(
    'loading',
  );
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { signOut } = useClerk();

  const me = useAccount(JazzAccount, {
    resolve: {
      root: true,
    },
  });

  const syncMetadata = useCallback(async () => {
    setSyncStatus('loading');
    try {
      const checkResponse = await fetch('/api/user/debug-metadata');
      const data = await checkResponse.json();

      if (!data.publicMetadata?.jazzAccountId && me.$jazz?.id) {
        const syncResponse = await fetch('/api/user/sync-metadata-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jazzAccountId: me.$jazz?.id }),
        });

        if (syncResponse.ok) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
      } else if (data.publicMetadata?.jazzAccountId) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Error syncing metadata:', error);
      setSyncStatus('error');
    }
  }, [me.$jazz?.id]);

  useEffect(() => {
    if (me.$jazz?.id) {
      syncMetadata();
    }
  }, [me.$jazz?.id, syncMetadata]);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? 'Failed to delete account.');
        return;
      }
      await signOut({ redirectUrl: '/' });
    } catch {
      setDeleteError('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('credits') === 'added') {
      setActiveTab('billing');
      window.history.replaceState({}, '', '/settings?tab=billing');
    } else if (searchParams.get('tab') === 'billing') {
      setActiveTab('billing');
    } else {
      setActiveTab('account');
    }
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <SignedOut>
        <div className={styles.center}>
          <p>Please sign in to access settings.</p>
          <Link href="/">Back to home</Link>
        </div>
      </SignedOut>

      <SignedIn>
        <Header />

        <main className={styles.main}>
          <div className={styles.settingsRow}>
            <div className={styles.tabs} role="tablist" aria-label="Settings">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'account'}
                className={styles.tabButton}
                onClick={() => {
                  setActiveTab('account');
                  window.history.replaceState({}, '', '/settings');
                }}
              >
                Account
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'billing'}
                className={styles.tabButton}
                onClick={() => {
                  setActiveTab('billing');
                  window.history.replaceState({}, '', '/settings?tab=billing');
                }}
              >
                Billing
              </button>
            </div>
            <SignOutButton>
              <button type="button" className="btn btn-secondary">
                Log out
              </button>
            </SignOutButton>
          </div>

          {activeTab === 'account' && (
            <>
              <div className={styles.syncStatus}>
                <span className={styles.syncLabel}>Extension sync:</span>
                <span
                  className={
                    syncStatus === 'synced'
                      ? styles.statusSynced
                      : syncStatus === 'error'
                        ? styles.statusError
                        : styles.statusLoading
                  }
                >
                  {syncStatus === 'synced' && 'Ready'}
                  {syncStatus === 'error' && 'Error - please refresh'}
                  {syncStatus === 'loading' && 'Syncing...'}
                </span>
                {syncStatus === 'error' && (
                  <button
                    type="button"
                    onClick={syncMetadata}
                    className="btn btn-secondary btn-sm"
                  >
                    Retry
                  </button>
                )}
              </div>

              {publicProfileCard}

              <div className={styles.profileWrapper}>
                <UserProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: styles.clerkRootBox,
                      card: styles.clerkCard,
                    },
                  }}
                />
              </div>

              <div className={styles.dangerZone}>
                <h2 className={styles.dangerTitle}>Danger zone</h2>
                <p className={styles.dangerDescription}>
                  Permanently delete your account and all associated data. This
                  cannot be undone.
                </p>
                <label className={styles.dangerLabel} htmlFor="delete-confirm">
                  Type <strong>delete my account</strong> to confirm
                </label>
                <div className={styles.dangerRow}>
                  <input
                    id="delete-confirm"
                    type="text"
                    className={styles.dangerInput}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="delete my account"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deleteConfirm !== 'delete my account' || deleting}
                    onClick={handleDeleteAccount}
                  >
                    {deleting ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
                {deleteError && (
                  <p className={styles.deleteError}>{deleteError}</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'billing' && (
            <div className={styles.billingWrapper}>
              <AiCreditsPanel returnPath="/settings?tab=billing" />
            </div>
          )}
        </main>
      </SignedIn>
    </div>
  );
}
