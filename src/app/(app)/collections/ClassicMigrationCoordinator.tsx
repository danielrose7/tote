'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { exportClassicCollectionsWithMembers } from '../../../lib/collections/classicMigrationExport';
import { fingerprintClassicMigrationCollectionsInBrowser } from '../../../lib/collections/migrationPayload';
import { JazzAccount } from '../../../schema';
import styles from './ClassicMigrationCoordinator.module.css';

type ReadySummary = {
  collectionCount: number;
  itemCount: number;
};

export function ClassicMigrationCoordinator({
  rootBlocks,
  initialReady,
}: {
  rootBlocks?: unknown;
  initialReady?: ReadySummary;
}) {
  const { user } = useUser();
  const router = useRouter();
  const started = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<
    'prompt' | 'importing' | 'ready' | 'confirming' | 'error'
  >(initialReady ? 'ready' : 'prompt');
  const [summary, setSummary] = useState<ReadySummary | null>(
    initialReady ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const startMigration = async () => {
    if (started.current || !rootBlocks || !user?.id) return;
    started.current = true;
    setPhase('importing');
    setError(null);

    try {
      const statusResponse = await fetch('/api/v2/migration/status');
      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as {
          dataSource: string;
          cutoverAt: string | null;
          error: { code?: string } | null;
        };
        if (status.dataSource === 'classic_jazz' && status.cutoverAt) {
          setPhase('prompt');
          started.current = false;
          return;
        }
        if (status.dataSource === 'migration_failed' && attempt === 0) {
          setError(
            status.error?.code === 'verification_failed'
              ? 'The imported collections could not be verified.'
              : 'The collection migration could not be completed.',
          );
          setPhase('error');
          return;
        }
      }

      const collections = await exportClassicCollectionsWithMembers(
        rootBlocks,
        user.id,
        async (jazzAccountId) => {
          const account = await JazzAccount.load(
            jazzAccountId as `co_z${string}`,
            { resolve: { root: true } },
          );
          if (!account.$isLoaded || !account.root?.$isLoaded) return null;
          return account.root.clerkUserId ?? null;
        },
      );
      const sourceFingerprint =
        await fingerprintClassicMigrationCollectionsInBrowser(collections);
      const response = await fetch('/api/v2/migration/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          migrationVersion: 1,
          sourceFingerprint,
          collections,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        collectionCount?: number;
        itemCount?: number;
        collectionIdsByLegacyJazzId?: Record<string, string>;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || 'Collection migration failed.');
      }
      const nextSummary = {
        collectionCount: body?.collectionCount ?? 0,
        itemCount: body?.itemCount ?? 0,
      };
      setSummary(nextSummary);
      setPhase('ready');
    } catch (migrationError) {
      started.current = false;
      setError(
        migrationError instanceof Error
          ? migrationError.message
          : 'Collection migration failed.',
      );
      setPhase('error');
    }
  };

  const confirm = async () => {
    setPhase('confirming');
    setError(null);
    const response = await fetch('/api/v2/migration/confirm', {
      method: 'POST',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error || 'Could not switch collection storage.');
      setPhase('ready');
      return;
    }
    router.refresh();
  };

  return (
    <section className={styles.card} aria-live="polite">
      {phase === 'prompt' && (
        <>
          <h2>Migrate your data before July 1</h2>
          <p>
            We&rsquo;re moving to a new storage system ahead of our iOS app
            launch. Migrate before July 1, 2026 to avoid data loss — it only
            takes a moment.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={startMigration}
            >
              Migrate my data
            </button>
          </div>
        </>
      )}
      {phase === 'importing' && (
        <>
          <h2>Migrating your collections…</h2>
          <p>
            Your current data remains available while we prepare the new
            storage.
          </p>
        </>
      )}
      {(phase === 'ready' || phase === 'confirming') && (
        <>
          <h2>Your collections are ready to switch</h2>
          <p>
            Verified {summary?.collectionCount ?? 0} collections and{' '}
            {summary?.itemCount ?? 0} items. Classic Jazz stays available
            read-only for 14 days after you switch.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={phase === 'confirming'}
              onClick={confirm}
            >
              {phase === 'confirming'
                ? 'Switching...'
                : 'Switch to new collections'}
            </button>
          </div>
        </>
      )}
      {phase === 'error' && (
        <>
          <h2>Migration needs another try</h2>
          <p className={styles.error}>{error}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                started.current = false;
                setError(null);
                setAttempt((current) => current + 1);
                void startMigration();
              }}
            >
              Retry migration
            </button>
          </div>
        </>
      )}
    </section>
  );
}
