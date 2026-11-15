'use client';

import { Show, SignOutButton, UserProfile, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AiCreditsPanel } from '@/components/Billing/AiCreditsPanel';
import { Header } from '@/components/Header/Header';
import { Main } from '@/components/Main/Main';
import { Trans, useTranslation } from '@/i18n/client';
import type { RenderLocale } from '@/i18n/config';
import { LanguagePicker } from '@/i18n/LanguagePicker';
import styles from './settings.module.css';

type SettingsTab = 'account' | 'billing';

export function SettingsClient({
  publicProfileCard,
}: {
  publicProfileCard: ReactNode;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();
  const confirmPhrase = t('settings.delete.confirmPhrase');

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? t('settings.delete.failed'));
        return;
      }
      await signOut({ redirectUrl: '/' });
    } catch {
      setDeleteError(t('settings.delete.error'));
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
      <Show when="signed-out">
        <div className={styles.center}>
          <p>{t('settings.signIn')}</p>
          <Link href="/">{t('settings.backToHome')}</Link>
        </div>
      </Show>

      <Show when="signed-in">
        <Header />

        <Main className={styles.main}>
          <div className={styles.settingsRow}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label={t('settings.title')}
            >
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
                {t('settings.tabs.account')}
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
                {t('settings.tabs.billing')}
              </button>
            </div>
            <SignOutButton>
              <button type="button" className="btn btn-secondary">
                {t('settings.logOut')}
              </button>
            </SignOutButton>
          </div>

          {activeTab === 'account' && (
            <>
              {publicProfileCard}

              <LanguagePicker current={i18n.language as RenderLocale} />

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
                <h2 className={styles.dangerTitle}>
                  {t('settings.delete.title')}
                </h2>
                <p className={styles.dangerDescription}>
                  {t('settings.delete.description')}
                </p>
                <label className={styles.dangerLabel} htmlFor="delete-confirm">
                  <Trans
                    i18nKey="settings.delete.label"
                    values={{ phrase: confirmPhrase }}
                    components={{ strong: <strong /> }}
                  />
                </label>
                <div className={styles.dangerRow}>
                  <input
                    id="delete-confirm"
                    type="text"
                    className={styles.dangerInput}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={confirmPhrase}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deleteConfirm !== confirmPhrase || deleting}
                    onClick={handleDeleteAccount}
                  >
                    {deleting
                      ? t('settings.delete.deleting')
                      : t('settings.delete.button')}
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
        </Main>
      </Show>
    </div>
  );
}
