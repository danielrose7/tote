'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import cardStyles from '@/components/CollectionCard/CollectionCard.module.css';
import listStyles from '@/components/CollectionList/CollectionList.module.css';
import { Header } from '@/components/Header';
import { Main } from '@/components/Main/Main';
import { useCollectionRealtime } from '@/hooks/useCollectionRealtime';
import { fetchCollectionSummaries } from '@/lib/collections/client';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import { NeonCreateCollectionDialog } from './NeonCreateCollectionDialog';

function PreviewImageGrid({
  images,
  collectionId,
  color,
}: {
  images: { url: string; title: string | null; nodeId: string }[];
  collectionId: string;
  color?: string | null;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const visible = images.filter((img) => !failedUrls.has(img.url));

  function handleError(img: { url: string; nodeId: string }) {
    setFailedUrls((prev) => new Set([...prev, img.url]));
    fetch(
      `/api/v2/collections/${collectionId}/nodes/${img.nodeId}/clear-image`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: img.url }),
      },
    ).catch(() => {});
  }

  if (visible.length === 0) {
    return (
      <div
        className={cardStyles.coverFallback}
        style={{
          background: `radial-gradient(circle at 20% 80%, ${color ?? '#6366f1'}99 0%, transparent 55%),
                       radial-gradient(circle at 80% 15%, ${color ?? '#6366f1'}66 0%, transparent 45%),
                       radial-gradient(circle at 55% 50%, ${color ?? '#6366f1'}44 0%, transparent 60%),
                       ${color ?? '#6366f1'}22`,
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
    );
  }

  return (
    <div
      className={`${cardStyles.previewGrid} ${cardStyles[`grid-${Math.min(visible.length, 3)}`]}`}
    >
      {visible.slice(0, 3).map((img) => (
        <div key={img.nodeId} className={cardStyles.previewImage}>
          <img
            src={img.url}
            alt={img.title ?? ''}
            onError={() => handleError(img)}
          />
        </div>
      ))}
    </div>
  );
}

const SEARCH_THRESHOLD = 6;

export function NeonCollectionsPage({
  realtimeEnabled,
}: {
  realtimeEnabled: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: collections = [] } = useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: fetchCollectionSummaries,
  });
  const RECENTLY_SHARED_DAYS = 7;
  const recentlyShared = collections.filter((c) => {
    if (c.role === 'owner') return false;
    const msAgo = Date.now() - new Date(c.joinedAt).getTime();
    return msAgo < RECENTLY_SHARED_DAYS * 24 * 60 * 60 * 1000;
  });

  const hasCollections = collections.length > 0;
  const showSearch = collections.length >= SEARCH_THRESHOLD;
  const filteredCollections =
    searchQuery.trim() === ''
      ? collections
      : collections.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
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
      <Main fallbackMessage="Could not load your collections. Please refresh the page.">
        <div className={listStyles.container}>
          {showSearch && (
            <div className={listStyles.searchBar}>
              <input
                type="search"
                placeholder="Search collections…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={listStyles.searchInput}
                aria-label="Search collections"
              />
            </div>
          )}
          {recentlyShared.length > 0 && (
            <div className={listStyles.recentShareNotice}>
              <strong>New:</strong>{' '}
              {recentlyShared.length === 1 ? (
                <>
                  You were added to{' '}
                  <Link
                    href={`/collections/${recentlyShared[0].id}`}
                    className={listStyles.recentShareLink}
                  >
                    {recentlyShared[0].name}
                  </Link>
                </>
              ) : (
                <>
                  You were recently added to {recentlyShared.length} shared
                  collections
                </>
              )}
            </div>
          )}
          {!hasCollections ? (
            <div className={listStyles.empty}>
              <h2 className={listStyles.emptyTitle}>No collections yet</h2>
              <p className={listStyles.emptyDescription}>
                Your collections will appear here.
              </p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <p className={listStyles.noResults}>
              No collections match &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            <div className={listStyles.grid}>
              {filteredCollections.map((collection) => (
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
                    <PreviewImageGrid
                      images={collection.previewImages ?? []}
                      collectionId={collection.id}
                      color={collection.color}
                    />
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
        </div>
      </Main>
      <NeonCreateCollectionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  );
}
