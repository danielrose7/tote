'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount, useCoState } from 'jazz-tools/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import cardStyles from '../../../components/CollectionCard/CollectionCard.module.css';
import listStyles from '../../../components/CollectionList/CollectionList.module.css';
import { Header } from '../../../components/Header';
import { useCollectionRealtime } from '../../../hooks/useCollectionRealtime';
import { exportClassicCollection } from '../../../lib/collections/classicMigrationExport';
import { getWaitingClassicSharedCollections } from '../../../lib/collections/classicSharedMigration';
import { fetchCollectionSummaries } from '../../../lib/collections/client';
import { fingerprintClassicMigrationCollectionsInBrowser } from '../../../lib/collections/migrationPayload';
import { collectionQueryKeys } from '../../../lib/collections/queryKeys';
import { Block, JazzAccount } from '../../../schema';
import { NeonCreateCollectionDialog } from './NeonCreateCollectionDialog';

export function NeonCollectionsPage({
  realtimeEnabled,
}: {
  realtimeEnabled: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const classicAccount = useAccount(JazzAccount, {
    resolve: { root: { sharedWithMe: { $each: {} } } },
  });
  const { data: collections = [] } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: fetchCollectionSummaries,
  });
  const waitingSharedCollections = getWaitingClassicSharedCollections(
    classicAccount.$isLoaded && classicAccount.root?.$isLoaded
      ? classicAccount.root.sharedWithMe
      : null,
    collections,
  );
  const hasCollections =
    collections.length > 0 || waitingSharedCollections.length > 0;
  useCollectionRealtime({
    enabled: realtimeEnabled,
    collectionIds: collections.map((collection) => collection.id),
  });

  return (
    <>
      <Header
        showAddCollection
        onAddCollectionClick={() => setIsCreateOpen(true)}
      />
      <main>
        <div className={listStyles.container}>
          {!hasCollections ? (
            <div className={listStyles.empty}>
              <h2 className={listStyles.emptyTitle}>No collections yet</h2>
              <p className={listStyles.emptyDescription}>
                Your Neon collections will appear here.
              </p>
            </div>
          ) : (
            <>
              {collections.length > 0 && (
                <div className={listStyles.grid}>
                  {collections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      className={cardStyles.card}
                      style={
                        {
                          '--collection-color':
                            collection.color || 'var(--color-accent)',
                          textDecoration: 'none',
                        } as React.CSSProperties
                      }
                    >
                      <div className={cardStyles.cover}>
                        {(collection.previewImages ?? []).length > 0 ? (
                          <div
                            className={`${cardStyles.previewGrid} ${cardStyles[`grid-${Math.min(collection.previewImages.length, 3)}`]}`}
                          >
                            {collection.previewImages
                              .slice(0, 3)
                              .map((img, idx) => (
                                <div
                                  key={idx}
                                  className={cardStyles.previewImage}
                                >
                                  <img src={img.url} alt={img.title ?? ''} />
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div
                            className={cardStyles.coverFallback}
                            style={{
                              background: `radial-gradient(circle at 20% 80%, ${collection.color ?? '#6366f1'}99 0%, transparent 55%),
                                           radial-gradient(circle at 80% 15%, ${collection.color ?? '#6366f1'}66 0%, transparent 45%),
                                           radial-gradient(circle at 55% 50%, ${collection.color ?? '#6366f1'}44 0%, transparent 60%),
                                           ${collection.color ?? '#6366f1'}22`,
                            }}
                          >
                            <svg
                              className={cardStyles.placeholderIcon}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className={cardStyles.cardBody}>
                        <h3 className={cardStyles.title}>{collection.name}</h3>
                        <span className={cardStyles.meta}>
                          {collection.itemCount}{' '}
                          {collection.itemCount === 1 ? 'item' : 'items'}
                          {collection.role !== 'owner' && ' · Shared'}
                        </span>
                        {collection.description && (
                          <p className={cardStyles.description}>
                            {collection.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {waitingSharedCollections.length > 0 && (
                <section className={listStyles.sharedSection}>
                  <h2 className={listStyles.sectionTitle}>
                    Waiting for owner migration
                  </h2>
                  <p className={listStyles.waitingDescription}>
                    These shared collections remain in Classic Jazz until their
                    owners migrate them.
                  </p>
                  <div className={listStyles.grid}>
                    {waitingSharedCollections.map((collection) => (
                      <ClassicSharedCopyCard
                        key={collection.collectionId}
                        collection={collection}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <NeonCreateCollectionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  );
}

function ClassicSharedCopyCard({
  collection,
}: {
  collection: ReturnType<typeof getWaitingClassicSharedCollections>[number];
}) {
  const router = useRouter();
  const source = useCoState(Block, collection.collectionId as `co_z${string}`, {
    resolve: {
      children: { $each: { children: { $each: {} } } },
      notes: { $each: {} },
    },
  });
  const [phase, setPhase] = useState<'idle' | 'copying' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const copyToMyCollections = async () => {
    setPhase('copying');
    setError(null);
    try {
      const exported = exportClassicCollection(source);
      if (!exported) {
        throw new Error(
          'The Classic Jazz collection is not fully available yet.',
        );
      }
      const sourceFingerprint =
        await fingerprintClassicMigrationCollectionsInBrowser([exported]);
      const response = await fetch('/api/v2/migration/shared-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mutationId: crypto.randomUUID(),
          sourceFingerprint,
          collection: exported,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.id) {
        throw new Error(body?.error || 'Could not copy this collection.');
      }
      router.push(`/collections/${body.id}`);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : 'Could not copy this collection.',
      );
      setPhase('error');
    }
  };

  return (
    <div className={listStyles.waitingCard}>
      <h3>{collection.name || 'Shared collection'}</h3>
      <span className={listStyles.sharedBadge}>Shared · {collection.role}</span>
      <p>Waiting for the owner to migrate this collection.</p>
      <button
        type="button"
        className={listStyles.waitingCopyButton}
        disabled={!source?.$isLoaded || phase === 'copying'}
        onClick={copyToMyCollections}
      >
        {phase === 'copying' ? 'Copying...' : 'Copy to my collections'}
      </button>
      {error && <p className={listStyles.waitingError}>{error}</p>}
    </div>
  );
}
