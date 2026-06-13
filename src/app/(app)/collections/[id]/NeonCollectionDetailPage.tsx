'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Header } from '../../../../components/Header';
import { useToast } from '../../../../components/ToastNotification';
import type { CollectionNode } from '../../../../db/schema';
import { useCollectionRealtime } from '../../../../hooks/useCollectionRealtime';
import {
  fetchCollectionDetail,
  type ReorderCollectionNodesMutation,
} from '../../../../lib/collections/client';
import { roleCan } from '../../../../lib/collections/permissions';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '../../../../lib/collections/queryKeys';
import type { CollectionDetail } from '../../../../lib/collections/repository';
import styles from './NeonCollectionDetailPage.module.css';
import { NeonCopyCollectionDialog } from './NeonCopyCollectionDialog';
import { NeonCreateNodeDialog } from './NeonCreateNodeDialog';
import { NeonEditCollectionDialog } from './NeonEditCollectionDialog';
import { NeonEditNodeDialog } from './NeonEditNodeDialog';
import { NeonPublicationDialog } from './NeonPublicationDialog';
import { NeonTeamDialog } from './NeonTeamDialog';

type NodeProperties = {
  url?: string;
  imageUrl?: string;
  description?: string;
  price?: string | number;
  body?: string;
};

function propertiesFor(node: CollectionNode): NodeProperties {
  return node.properties as NodeProperties;
}

function SortableNode({
  id,
  className,
  handleLabel,
  children,
}: {
  id: string;
  className?: string;
  handleLabel: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isDragging ? styles.dragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children(
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={handleLabel}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>,
      )}
    </div>
  );
}

function ItemNode({
  node,
  onEdit,
  dragHandle,
}: {
  node: CollectionNode;
  onEdit?: (node: CollectionNode) => void;
  dragHandle?: React.ReactNode;
}) {
  const properties = propertiesFor(node);
  const title = node.title || (node.type === 'photo' ? 'Photo' : 'Untitled');
  const content = (
    <>
      {properties.imageUrl && (
        <div className={styles.itemImage}>
          <img src={properties.imageUrl} alt="" />
        </div>
      )}
      <div className={styles.itemContent}>
        <div className={styles.itemHeading}>
          <span className={styles.typeBadge}>{node.type}</span>
          <h3>{title}</h3>
        </div>
        {properties.description && <p>{properties.description}</p>}
        {properties.body && <p>{properties.body}</p>}
        {properties.price !== undefined && properties.price !== null && (
          <span className={styles.price}>{String(properties.price)}</span>
        )}
      </div>
    </>
  );

  return (
    <article className={styles.itemCard}>
      {content}
      <div className={styles.itemActions}>
        {dragHandle}
        {properties.url && (
          <a
            href={properties.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.itemLink}
          >
            Open
          </a>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(node)}>
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

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
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CollectionNode | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  useCollectionRealtime({
    enabled: realtimeEnabled,
    collectionIds: [collectionId],
  });
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const { data: detail } = useQuery({
    queryKey: collectionQueryKeys.detail(collectionId),
    queryFn: () => fetchCollectionDetail(collectionId),
  });
  const reorderNodes = useMutation<
    {
      nodeCount: number;
      collectionVersion: number;
      itemCount: number;
      replayed: boolean;
    },
    Error,
    ReorderCollectionNodesMutation
  >({
    mutationKey: collectionMutationKeys.reorderNodes,
    scope: { id: `collection:${collectionId}` },
    onError: (error) => {
      showToast({
        title: 'Reordering failed',
        description: error.message,
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collectionId),
      });
    },
  });
  if (!detail) {
    return null;
  }

  const { collection, nodes, role } = detail;
  const primaryLineage = detail.lineage[0];
  const canCopy =
    role === 'owner' ||
    collection.copyPolicy === 'members' ||
    collection.copyPolicy === 'public';
  const sections = nodes.filter((node) => node.type === 'section');
  const rootNodes = nodes.filter(
    (node) => node.type !== 'section' && node.parentId === null,
  );
  const childrenByParent = new Map<string, CollectionNode[]>();

  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const reorderSiblings = (
    siblings: CollectionNode[],
    activeId: string,
    overId: string,
  ) => {
    const oldIndex = siblings.findIndex((node) => node.id === activeId);
    const newIndex = siblings.findIndex((node) => node.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const updates = reordered.map((node, index) => ({
      node,
      positionKey: `r:${String(index).padStart(8, '0')}:${node.id}`,
    }));
    const nextPositions = new Map(
      updates.map(({ node, positionKey }) => [node.id, positionKey]),
    );
    queryClient.setQueryData<CollectionDetail>(
      collectionQueryKeys.detail(collection.id),
      (current) =>
        current
          ? {
              ...current,
              collection: {
                ...current.collection,
                version: current.collection.version + updates.length,
                updatedAt: new Date(),
              },
              nodes: current.nodes.map((node) => {
                const positionKey = nextPositions.get(node.id);
                return positionKey
                  ? {
                      ...node,
                      positionKey,
                      version: node.version + 1,
                      updatedAt: new Date(),
                    }
                  : node;
              }),
            }
          : current,
    );
    reorderNodes.mutate({
      collectionId: collection.id,
      input: {
        mutationId: crypto.randomUUID(),
        nodes: updates.map(({ node, positionKey }) => ({
          id: node.id,
          expectedVersion: node.version,
          positionKey,
        })),
      },
    });
  };

  const dragEndHandler =
    (siblings: CollectionNode[]) =>
    ({ active, over }: DragEndEvent) => {
      if (!over) return;
      reorderSiblings(siblings, String(active.id), String(over.id));
    };

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

        {nodes.length > 1 && roleCan(role, 'edit') && (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={
                isReorderMode ? styles.doneButton : styles.reorderButton
              }
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </button>
          </div>
        )}

        {rootNodes.length > 0 && (
          <section className={styles.section}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={dragEndHandler(rootNodes)}
            >
              <SortableContext
                items={rootNodes.map((node) => node.id)}
                strategy={rectSortingStrategy}
              >
                <div className={styles.grid}>
                  {rootNodes.map((node) => (
                    <SortableNode
                      key={node.id}
                      id={node.id}
                      handleLabel={`Reorder ${node.title || node.type}`}
                    >
                      {(dragHandle) => (
                        <ItemNode
                          node={node}
                          dragHandle={
                            isReorderMode && roleCan(role, 'edit')
                              ? dragHandle
                              : undefined
                          }
                          onEdit={
                            roleCan(role, 'edit')
                              ? (selected) => setSelectedNode(selected)
                              : undefined
                          }
                        />
                      )}
                    </SortableNode>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={dragEndHandler(sections)}
        >
          <SortableContext
            items={sections.map((section) => section.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => {
              const children = childrenByParent.get(section.id) ?? [];
              return (
                <SortableNode
                  key={section.id}
                  id={section.id}
                  className={styles.section}
                  handleLabel={`Reorder ${section.title || 'section'}`}
                >
                  {(sectionDragHandle) => (
                    <section>
                      <div className={styles.sectionHeader}>
                        <div>
                          <h2>{section.title || 'Untitled section'}</h2>
                          <span>
                            {children.length}{' '}
                            {children.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        {roleCan(role, 'edit') && (
                          <div className={styles.sectionActions}>
                            {isReorderMode && sectionDragHandle}
                            <button
                              type="button"
                              className={styles.sectionEditButton}
                              onClick={() => setSelectedNode(section)}
                            >
                              Edit section
                            </button>
                          </div>
                        )}
                      </div>
                      {children.length > 0 ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={dragEndHandler(children)}
                        >
                          <SortableContext
                            items={children.map((node) => node.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className={styles.grid}>
                              {children.map((node) => (
                                <SortableNode
                                  key={node.id}
                                  id={node.id}
                                  handleLabel={`Reorder ${
                                    node.title || node.type
                                  }`}
                                >
                                  {(dragHandle) => (
                                    <ItemNode
                                      node={node}
                                      dragHandle={
                                        isReorderMode && roleCan(role, 'edit')
                                          ? dragHandle
                                          : undefined
                                      }
                                      onEdit={
                                        roleCan(role, 'edit')
                                          ? (selected) =>
                                              setSelectedNode(selected)
                                          : undefined
                                      }
                                    />
                                  )}
                                </SortableNode>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      ) : (
                        <p className={styles.emptySection}>
                          This section is empty.
                        </p>
                      )}
                    </section>
                  )}
                </SortableNode>
              );
            })}
          </SortableContext>
        </DndContext>

        {nodes.length === 0 && (
          <div className={styles.emptyCollection}>
            <h2>This collection is empty</h2>
            <p>Items added to the Neon collection will appear here.</p>
          </div>
        )}
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
