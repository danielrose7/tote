'use client';

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  useUser,
} from '@clerk/nextjs';
import { Group } from 'jazz-tools';
import { useAccount } from 'jazz-tools/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  type CollectionForCloning,
  duplicateNeonCollectionToAccount,
} from '../../../../lib/blocks';
import { BlockList, JazzAccount } from '../../../../schema';
import styles from '../../../(public)/view/[id]/page.module.css';

export default function CloneCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const collectionId = params.id as string;
  const [neonCollection, setNeonCollection] =
    useState<CollectionForCloning | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        blocks: true,
      },
    },
  });

  // Fetch collection data from Neon once signed in
  useEffect(() => {
    if (!isUserLoaded || !isSignedIn) return;

    fetch(`/api/collections/${collectionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json() as Promise<CollectionForCloning>;
      })
      .then((data) => {
        if (!data.allowCloning) {
          setErrorMessage('Copying is disabled for this collection.');
          return;
        }
        setNeonCollection(data);
      })
      .catch(() => {
        setErrorMessage('This collection is not available for copying.');
      });
  }, [isUserLoaded, isSignedIn, collectionId]);

  // Clone once collection data and Jazz account are both ready
  useEffect(() => {
    if (!neonCollection || hasStartedRef.current) return;
    if (!me.$isLoaded || !me.root?.$isLoaded) return;

    hasStartedRef.current = true;

    const run = async () => {
      try {
        const duplicatedCollection = duplicateNeonCollectionToAccount(
          neonCollection,
          me,
        );

        if (!me.root.blocks) {
          const group = Group.create({ owner: me });
          const blocksList = BlockList.create([duplicatedCollection], group);
          me.root.$jazz.set('blocks', blocksList);
        } else if (me.root.blocks.$isLoaded) {
          me.root.blocks.$jazz.push(duplicatedCollection);
        }

        await duplicatedCollection.$jazz.waitForSync({ timeout: 5000 });
        router.replace(`/collections/${duplicatedCollection.$jazz.id}`);
      } catch (error) {
        console.error('Failed to clone collection:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to copy this collection.',
        );
      }
    };

    run();
  }, [neonCollection, me, router]);

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
