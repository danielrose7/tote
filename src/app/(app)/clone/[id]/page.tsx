'use client';

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  useUser,
} from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from '@/app/(public)/view/[id]/page.module.css';

export default function CloneCollectionPage() {
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
          throw new Error('This collection is not available for copying.');
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || 'Failed to copy this collection.');
        }
        return response.json() as Promise<{ id: string }>;
      })
      .then((result) => {
        router.replace(`/collections/${result.id}`);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to copy this collection.',
        );
      });
  }, [isUserLoaded, isSignedIn, collectionId, router]);

  if (!isUserLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Preparing your copy...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Use this list</h1>
          <p className={styles.description}>
            Sign in or create an account to copy this collection into your own
            Tote.
          </p>
          <div
            className={styles.templateActions}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            <SignUpButton
              mode="modal"
              fallbackRedirectUrl={`/clone/${collectionId}`}
            >
              <button type="button" className={styles.useListButton}>
                Sign up to copy
              </button>
            </SignUpButton>
          </div>
          <p className={styles.templateHint} style={{ marginTop: '0.75rem' }}>
            Already have an account?{' '}
            <SignInButton
              mode="modal"
              fallbackRedirectUrl={`/clone/${collectionId}`}
            >
              <button type="button" className={styles.inlineAuthButton}>
                Log in
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
          <h1 className={styles.title}>Unable to copy</h1>
          <p className={styles.description}>{errorMessage}</p>
          <div style={{ marginTop: '1rem' }}>
            <SignedIn>
              <Link href="/collections" className={styles.footerLink}>
                Back to collections
              </Link>
            </SignedIn>
            <SignedOut>
              <Link href="/" className={styles.footerLink}>
                Back to home
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>
          Copying this list into your account...
        </p>
      </div>
    </div>
  );
}
