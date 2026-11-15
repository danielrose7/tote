'use client';

import { Show, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from '@/app/(public)/view/[id]/page.module.css';
import { useTranslation } from '@/i18n/client';

export default function CloneCollectionPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const collectionId = params.id as string;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const copyStartedRef = useRef(false);

  // Copy the public snapshot directly into Postgres.
  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || copyStartedRef.current) return;

    copyStartedRef.current = true;
    fetch(`/api/v2/publications/${collectionId}/copy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mutationId: crypto.randomUUID() }),
    })
      .then(async (response) => {
        if (response.status === 404) {
          throw new Error(t('clone.notAvailable'));
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || t('clone.copyFailed'));
        }
        return response.json() as Promise<{ id: string }>;
      })
      .then((result) => {
        router.replace(`/collections/${result.id}`);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : t('clone.copyFailed'),
        );
      });
  }, [isUserLoaded, isSignedIn, collectionId, router, t]);

  if (!isUserLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t('clone.preparing')}</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('clone.useThisList')}</h1>
          <p className={styles.description}>{t('clone.signInPrompt')}</p>
          <div
            className={styles.templateActions}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            <SignUpButton
              mode="modal"
              fallbackRedirectUrl={`/clone/${collectionId}`}
            >
              <button type="button" className={styles.useListButton}>
                {t('clone.signUp')}
              </button>
            </SignUpButton>
          </div>
          <p className={styles.templateHint} style={{ marginTop: '0.75rem' }}>
            {t('clone.haveAccount')}{' '}
            <SignInButton
              mode="modal"
              fallbackRedirectUrl={`/clone/${collectionId}`}
            >
              <button type="button" className={styles.inlineAuthButton}>
                {t('clone.logIn')}
              </button>
            </SignInButton>
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>{t('clone.unableToCopy')}</h1>
          <p className={styles.description}>{errorMessage}</p>
          <div style={{ marginTop: '1rem' }}>
            <Show when="signed-in">
              <Link href="/collections" className={styles.footerLink}>
                {t('clone.backToCollections')}
              </Link>
            </Show>
            <Show when="signed-out">
              <Link href="/" className={styles.footerLink}>
                {t('clone.backToHome')}
              </Link>
            </Show>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>{t('clone.copying')}</p>
      </div>
    </div>
  );
}
