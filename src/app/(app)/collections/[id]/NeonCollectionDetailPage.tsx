'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Header } from '../../../../components/Header';
import { NeonCollectionView } from '../../../../components/NeonCollectionView/NeonCollectionView';
import type { CollectionNode } from '../../../../db/schema';
import { useCollectionRealtime } from '../../../../hooks/useCollectionRealtime';
import { fetchCollectionDetail } from '../../../../lib/collections/client';
import { roleCan } from '../../../../lib/collections/permissions';
import { collectionQueryKeys } from '../../../../lib/collections/queryKeys';
import styles from './NeonCollectionDetailPage.module.css';
import { NeonCopyCollectionDialog } from './NeonCopyCollectionDialog';
import { NeonCreateNodeDialog } from './NeonCreateNodeDialog';
import { NeonEditCollectionDialog } from './NeonEditCollectionDialog';
import { NeonEditNodeDialog } from './NeonEditNodeDialog';
import { NeonPublicationDialog } from './NeonPublicationDialog';
import { NeonTeamDialog } from './NeonTeamDialog';

export function NeonCollectionDetailPage({
  collectionId,
  realtimeEnabled,
}: {
  collectionId: string;
  realtimeEnabled: boolean;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateNodeOpen, setIsCreateNodeOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isPublicationOpen, setIsPublicationOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CollectionNode | null>(null);

  useCollectionRealtime({
    enabled: realtimeEnabled,
    collectionIds: [collectionId],
  });

  const { data: detail } = useQuery({
    queryKey: collectionQueryKeys.detail(collectionId),
    queryFn: () => fetchCollectionDetail(collectionId),
  });

  if (!detail) return null;

  const { collection, role } = detail;
  const primaryLineage = detail.lineage[0];
  const canCopy =
    role === 'owner' ||
    collection.copyPolicy === 'members' ||
    collection.copyPolicy === 'public';

  return (
    <>
      <Header
        showAddContent={roleCan(role, 'edit')}
        onAddContentClick={() => setIsCreateNodeOpen(true)}
        breadcrumbs={[
          { label: 'Collections', href: '/collections' },
          { label: collection.name },
        ]}
      />
      <main className={styles.page}>
        {/* Collection header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleSection}>
              <div className={styles.titleInfo}>
                <div
                  className={styles.colorIndicator}
                  style={{
                    backgroundColor: collection.color || 'var(--color-accent)',
                  }}
                />
                <h1 className={styles.title}>{collection.name}</h1>
              </div>
              {canCopy && (
                <button
                  type="button"
                  className={styles.headerActionButton}
                  onClick={() => setIsCopyOpen(true)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Make a copy</span>
                </button>
              )}
              {roleCan(role, 'publish') && (
                <button
                  type="button"
                  className={styles.settingsButton}
                  aria-label="Publish collection"
                  onClick={() => setIsPublicationOpen(true)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </button>
              )}
              {roleCan(role, 'manage_members') && (
                <button
                  type="button"
                  className={styles.settingsButton}
                  aria-label="Manage team"
                  onClick={() => setIsTeamOpen(true)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
              )}
              {roleCan(role, 'edit') && (
                <button
                  type="button"
                  className={styles.settingsButton}
                  aria-label="Edit collection"
                  onClick={() => setIsEditOpen(true)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
            {collection.description && (
              <p className={styles.description}>{collection.description}</p>
            )}
            <div className={styles.meta}>
              <span className={styles.count}>
                {collection.itemCount}{' '}
                {collection.itemCount === 1 ? 'item' : 'items'}
              </span>
              {role !== 'owner' && (
                <span className={styles.roleBadge}>{role}</span>
              )}
              <span>Version {collection.version}</span>
              {primaryLineage &&
                (primaryLineage.sourceCollectionId ? (
                  <Link
                    href={`/collections/${primaryLineage.sourceCollectionId}`}
                  >
                    Copied from {primaryLineage.sourceName}
                  </Link>
                ) : primaryLineage.sourcePublicationId ? (
                  <Link href={`/view/${primaryLineage.sourcePublicationId}`}>
                    Copied from {primaryLineage.sourceName}
                  </Link>
                ) : (
                  <span>Copied from {primaryLineage.sourceName}</span>
                ))}
            </div>
          </div>
        </div>

        {/* Collection content */}
        <NeonCollectionView
          detail={detail}
          onEditNode={(node) => setSelectedNode(node)}
        />
      </main>

      {roleCan(role, 'edit') && (
        <>
          <NeonCreateNodeDialog
            detail={detail}
            open={isCreateNodeOpen}
            onOpenChange={setIsCreateNodeOpen}
          />
          <NeonEditCollectionDialog
            detail={detail}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
          />
          <NeonEditNodeDialog
            detail={detail}
            node={selectedNode}
            open={selectedNode !== null}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setSelectedNode(null);
            }}
          />
        </>
      )}
      {roleCan(role, 'manage_members') && (
        <NeonTeamDialog
          collectionId={collection.id}
          actorRole={role}
          open={isTeamOpen}
          onOpenChange={setIsTeamOpen}
        />
      )}
      {roleCan(role, 'publish') && (
        <NeonPublicationDialog
          detail={detail}
          open={isPublicationOpen}
          onOpenChange={setIsPublicationOpen}
        />
      )}
      {canCopy && (
        <NeonCopyCollectionDialog
          detail={detail}
          open={isCopyOpen}
          onOpenChange={setIsCopyOpen}
        />
      )}
    </>
  );
}
