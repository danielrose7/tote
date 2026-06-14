'use client';

import {
  closestCenter,
  DndContext,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { CollectionNode } from '../../db/schema';
import productCardStyles from '../ProductCard/ProductCard.module.css';
import { NeonSlotSection } from '../NeonSlotSection/NeonSlotSection';
import { useToast } from '../ToastNotification';
import {
  checkExtensionAvailable,
  refreshViaExtension,
} from '../../lib/extension';
import {
  reorderCollectionNodesMutation,
  type ReorderCollectionNodesMutation,
  updateCollectionNodeMutation,
} from '../../lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '../../lib/collections/queryKeys';
import type { CollectionDetail } from '../../lib/collections/repository';
import { roleCan } from '../../lib/collections/permissions';
import {
  ViewModeToggle,
  type ViewMode,
} from '../CollectionView/ViewModeToggle';
import { NeonTableView } from './NeonTableView';
import pageStyles from '../../app/(app)/collections/[id]/NeonCollectionDetailPage.module.css';

const VIEW_MODE_STORAGE_KEY = 'tote:neon:viewMode';

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

// ---- Sortable wrapper for root nodes ----

function SortableItemNode({
  id,
  node,
  isReorderMode,
  canEdit,
  onEdit,
  onRefresh,
  isRefreshing,
  isEnqueued,
}: {
  id: string;
  node: CollectionNode;
  isReorderMode: boolean;
  canEdit: boolean;
  onEdit?: (node: CollectionNode) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isEnqueued?: boolean;
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
      className={isDragging ? pageStyles.dragging : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <ItemNode
        node={node}
        dragHandle={
          isReorderMode && canEdit ? (
            <button
              type="button"
              className={pageStyles.dragHandle}
              aria-label={`Reorder ${node.title || node.type}`}
              {...attributes}
              {...listeners}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="9" cy="5" r="2" />
                <circle cx="9" cy="12" r="2" />
                <circle cx="9" cy="19" r="2" />
                <circle cx="15" cy="5" r="2" />
                <circle cx="15" cy="12" r="2" />
                <circle cx="15" cy="19" r="2" />
              </svg>
            </button>
          ) : undefined
        }
        onEdit={canEdit ? onEdit : undefined}
        onRefresh={!isReorderMode ? onRefresh : undefined}
        isRefreshing={isRefreshing}
        isEnqueued={isEnqueued}
      />
    </div>
  );
}

// ---- Sortable wrapper for sections ----

function SortableSectionWrapper({
  id,
  section,
  items,
  collectionId,
  canEdit,
  isSectionReorderMode,
  onEditItem,
}: {
  id: string;
  section: CollectionNode;
  items: CollectionNode[];
  collectionId: string;
  canEdit: boolean;
  isSectionReorderMode: boolean;
  onEditItem?: (node: CollectionNode) => void;
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
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <NeonSlotSection
        section={section}
        items={items}
        collectionId={collectionId}
        canEdit={canEdit}
        onEditItem={onEditItem}
        dragHandle={
          isSectionReorderMode ? (
            <button
              type="button"
              className={pageStyles.dragHandle}
              aria-label={`Reorder ${section.title || 'section'}`}
              {...attributes}
              {...listeners}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="9" cy="5" r="2" />
                <circle cx="9" cy="12" r="2" />
                <circle cx="9" cy="19" r="2" />
                <circle cx="15" cy="5" r="2" />
                <circle cx="15" cy="12" r="2" />
                <circle cx="15" cy="19" r="2" />
              </svg>
            </button>
          ) : undefined
        }
        isDragging={isDragging}
        forceCollapsed={isSectionReorderMode}
      />
    </div>
  );
}

// ---- Item card / list-row ----

function ItemNode({
  node,
  onEdit,
  dragHandle,
  onRefresh,
  isRefreshing = false,
  isEnqueued = false,
}: {
  node: CollectionNode;
  onEdit?: (node: CollectionNode) => void;
  dragHandle?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isEnqueued?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const properties = propertiesFor(node);
  const title = node.title || (node.type === 'photo' ? 'Photo' : 'Untitled');
  const isListMode = dragHandle !== undefined;
  const hasImage = !!(properties.imageUrl && !imageError);

  if (isListMode) {
    return (
      <div className={pageStyles.nodeListItem}>
        {dragHandle}
        {hasImage && (
          <img
            src={properties.imageUrl!}
            alt=""
            className={pageStyles.nodeListItemImage}
            onError={() => setImageError(true)}
          />
        )}
        <span className={pageStyles.nodeListItemTitle}>{title}</span>
        {properties.price !== undefined && properties.price !== null && (
          <span className={pageStyles.nodeListItemPrice}>
            {String(properties.price)}
          </span>
        )}
      </div>
    );
  }

  return (
    <article
      className={productCardStyles.card}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={isEnqueued ? { opacity: 0.5 } : undefined}
    >
      {hasImage ? (
        <div className={productCardStyles.imageContainer}>
          {!imageLoaded && <div className={productCardStyles.imageSkeleton} />}
          <img
            src={properties.imageUrl!}
            alt={title}
            className={`${productCardStyles.image} ${imageLoaded ? productCardStyles.imageLoaded : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {properties.price !== undefined && properties.price !== null && (
            <div className={productCardStyles.priceOverlay}>
              <span className={productCardStyles.priceTag}>
                {String(properties.price)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={productCardStyles.imagePlaceholder}>
          <svg
            className={productCardStyles.placeholderIcon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {properties.price !== undefined && properties.price !== null && (
            <div className={productCardStyles.priceOverlay}>
              <span className={productCardStyles.priceTag}>
                {String(properties.price)}
              </span>
            </div>
          )}
        </div>
      )}

      {showActions && (onEdit || onRefresh) && (
        <div className={productCardStyles.actionsMenu}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={productCardStyles.actionButton}
              aria-label="Refresh metadata"
              data-tooltip={isRefreshing ? 'Refreshing…' : 'Refresh'}
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
                style={
                  isRefreshing
                    ? { animation: 'spin 0.8s linear infinite' }
                    : undefined
                }
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(node)}
              className={productCardStyles.actionButton}
              aria-label="Edit"
              data-tooltip="Edit"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className={productCardStyles.content}>
        <div className={productCardStyles.header}>
          <h3 className={productCardStyles.title}>{title}</h3>
        </div>
        {(properties.description || properties.body) && (
          <p className={productCardStyles.description}>
            {properties.description || properties.body}
          </p>
        )}
        <div className={productCardStyles.footer}>
          {properties.url ? (
            <a
              href={properties.url}
              target="_blank"
              rel="noopener noreferrer"
              className={productCardStyles.link}
              onClick={(e) => e.stopPropagation()}
            >
              Visit →
            </a>
          ) : (
            <span className={pageStyles.itemTypeBadge}>{node.type}</span>
          )}
        </div>
      </div>
    </article>
  );
}

// ---- NeonCollectionView ----

export interface NeonCollectionViewProps {
  detail: CollectionDetail;
  onEditNode: (node: CollectionNode) => void;
}

export function NeonCollectionView({
  detail,
  onEditNode,
}: NeonCollectionViewProps) {
  const { collection, nodes, role } = detail;
  const canEdit = roleCan(role, 'edit');

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  // Non-empty = reorder mode active; doubles as the local ordered list
  const [reorderSections, setReorderSections] = useState<CollectionNode[]>([]);
  const [reorderRoots, setReorderRoots] = useState<CollectionNode[]>([]);
  const isSectionReorderMode = reorderSections.length > 0;
  const isRootReorderMode = reorderRoots.length > 0;
  const [refreshingRootId, setRefreshingRootId] = useState<string | null>(null);
  const [enqueuedRootIds, setEnqueuedRootIds] = useState<string[]>([]);
  const [refreshAllRootsProgress, setRefreshAllRootsProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') setViewMode(stored);
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
    mutationFn: reorderCollectionNodesMutation,
    scope: { id: `collection:${collection.id}` },
    onError: (error) => {
      showToast({
        title: 'Reordering failed',
        description: error.message,
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collection.id),
      });
    },
  });

  const updateRootNode = useMutation({
    mutationKey: collectionMutationKeys.updateNode,
    mutationFn: updateCollectionNodeMutation,
    onMutate: ({ nodeId, input }) => {
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collection.id),
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === nodeId
                    ? {
                        ...n,
                        title: input.title ?? n.title,
                        properties: input.properties
                          ? { ...n.properties, ...input.properties }
                          : n.properties,
                        version: n.version + 1,
                        updatedAt: new Date(),
                      }
                    : n,
                ),
              }
            : current,
      );
    },
    onError: (error) => {
      showToast({
        title: 'Refresh failed',
        description: error.message,
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collection.id),
      });
    },
  });

  const handleRefreshRootItem = async (node: CollectionNode) => {
    const url = propertiesFor(node).url;
    if (!url) return;
    setRefreshingRootId(node.id);
    const extensionAvailable = await checkExtensionAvailable();
    let metadata: {
      title?: string;
      imageUrl?: string;
      description?: string;
      price?: string;
    } | null = null;
    try {
      if (extensionAvailable) {
        metadata = await refreshViaExtension(url, { capture: true });
      }
      if (!metadata) {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (res.ok) metadata = await res.json();
      }
    } catch {
      /* ignore */
    }
    if (metadata) {
      const existingProps = propertiesFor(node);
      updateRootNode.mutate({
        collectionId: collection.id,
        nodeId: node.id,
        input: {
          expectedVersion: node.version,
          mutationId: crypto.randomUUID(),
          title: metadata.title ?? node.title ?? undefined,
          properties: {
            ...existingProps,
            ...(metadata.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
            ...(metadata.description
              ? { description: metadata.description }
              : {}),
            ...(metadata.price ? { price: metadata.price } : {}),
          },
        },
      });
    }
    setRefreshingRootId(null);
  };

  const handleRefreshAllRoots = async (refreshableNodes: CollectionNode[]) => {
    if (refreshableNodes.length === 0) return;
    const extensionAvailable = await checkExtensionAvailable();
    setEnqueuedRootIds(refreshableNodes.map((n) => n.id));
    setRefreshAllRootsProgress({ current: 0, total: refreshableNodes.length });
    for (let i = 0; i < refreshableNodes.length; i++) {
      const node = refreshableNodes[i];
      setEnqueuedRootIds((prev) => prev.filter((id) => id !== node.id));
      setRefreshingRootId(node.id);
      const url = propertiesFor(node).url!;
      let metadata: {
        title?: string;
        imageUrl?: string;
        description?: string;
        price?: string;
      } | null = null;
      try {
        if (extensionAvailable) {
          metadata = await refreshViaExtension(url, { capture: true });
        }
        if (!metadata) {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          if (res.ok) metadata = await res.json();
        }
      } catch {
        /* ignore */
      }
      if (metadata) {
        const existingProps = propertiesFor(node);
        updateRootNode.mutate({
          collectionId: collection.id,
          nodeId: node.id,
          input: {
            expectedVersion: node.version,
            mutationId: crypto.randomUUID(),
            title: metadata.title ?? node.title ?? undefined,
            properties: {
              ...existingProps,
              ...(metadata.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
              ...(metadata.description
                ? { description: metadata.description }
                : {}),
              ...(metadata.price ? { price: metadata.price } : {}),
            },
          },
        });
      }
      setRefreshAllRootsProgress({
        current: i + 1,
        total: refreshableNodes.length,
      });
    }
    setRefreshingRootId(null);
    setEnqueuedRootIds([]);
    setRefreshAllRootsProgress(null);
  };

  const sections = nodes.filter((n) => n.type === 'section');
  const rootNodes = nodes.filter(
    (n) => n.type !== 'section' && n.parentId === null,
  );
  const allItems = nodes.filter((n) => n.type !== 'section');

  const childrenByParent = new Map<string, CollectionNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const localReorder = (
    setOrder: React.Dispatch<React.SetStateAction<CollectionNode[]>>,
    activeId: string,
    overId: string,
  ) => {
    setOrder((prev) => {
      const oldIndex = prev.findIndex((n) => n.id === activeId);
      const newIndex = prev.findIndex((n) => n.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const saveReorder = (orderedNodes: CollectionNode[]) => {
    const updates = orderedNodes.map((node, i) => ({
      node,
      positionKey: `r:${String(i).padStart(8, '0')}:${node.id}`,
    }));
    const hasChanged = updates.some(
      ({ node, positionKey }) => node.positionKey !== positionKey,
    );
    if (!hasChanged) return;

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
              nodes: current.nodes.map((n) => {
                const positionKey = nextPositions.get(n.id);
                return positionKey
                  ? {
                      ...n,
                      positionKey,
                      version: n.version + 1,
                      updatedAt: new Date(),
                    }
                  : n;
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

  const handleRootReorderDone = () => {
    saveReorder(reorderRoots);
    setReorderRoots([]);
  };

  const handleSectionReorderDone = () => {
    saveReorder(reorderSections);
    setReorderSections([]);
  };

  if (nodes.length === 0) {
    return (
      <div className={pageStyles.emptyCollection}>
        <h2>This collection is empty</h2>
        <p>Items added to this collection will appear here.</p>
      </div>
    );
  }

  // ---- Actions bar ----
  const showActionsBar =
    allItems.length > 0 && (sections.length > 1 || allItems.length > 0);

  return (
    <>
      {showActionsBar && (
        <div className={pageStyles.actions}>
          <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
          {viewMode === 'grid' && sections.length > 1 && canEdit && (
            <button
              type="button"
              onClick={() => {
                if (!isSectionReorderMode) {
                  setReorderSections([...sections]);
                } else {
                  handleSectionReorderDone();
                }
              }}
              className={
                isSectionReorderMode
                  ? pageStyles.doneButton
                  : pageStyles.reorderButton
              }
            >
              {isSectionReorderMode ? 'Done' : 'Reorder Sections'}
            </button>
          )}
        </div>
      )}

      {viewMode === 'table' ? (
        <NeonTableView
          nodes={allItems}
          allNodes={nodes}
          onEdit={canEdit ? onEditNode : undefined}
        />
      ) : (
        <>
          {/* Sections */}
          {sections.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over) return;
                localReorder(
                  setReorderSections,
                  String(active.id),
                  String(over.id),
                );
              }}
            >
              {(() => {
                const displaySections = isSectionReorderMode
                  ? reorderSections
                  : sections;
                return (
                  <SortableContext
                    items={displaySections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {displaySections.map((section) => (
                      <SortableSectionWrapper
                        key={section.id}
                        id={section.id}
                        section={section}
                        items={childrenByParent.get(section.id) ?? []}
                        collectionId={collection.id}
                        canEdit={canEdit}
                        isSectionReorderMode={isSectionReorderMode}
                        onEditItem={canEdit ? onEditNode : undefined}
                      />
                    ))}
                  </SortableContext>
                );
              })()}
            </DndContext>
          )}

          {/* Ungrouped root nodes */}
          {rootNodes.length > 0 && (
            <section className={pageStyles.section}>
              {(sections.length > 0 || rootNodes.length > 1) && (
                <div className={pageStyles.sectionHeader}>
                  {sections.length > 0 && (
                    <div>
                      <h2>Ungrouped</h2>
                      <span>
                        {rootNodes.length}{' '}
                        {rootNodes.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  )}
                  {rootNodes.length > 1 && canEdit && (
                    <div className={pageStyles.sectionActions}>
                      {!isRootReorderMode &&
                        rootNodes.some(
                          (n) =>
                            (n.type === 'product' || n.type === 'link') &&
                            propertiesFor(n).url,
                        ) && (
                          <button
                            type="button"
                            className={pageStyles.sectionEditButton}
                            disabled={refreshAllRootsProgress !== null}
                            onClick={() => {
                              const refreshable = rootNodes.filter(
                                (n) =>
                                  (n.type === 'product' || n.type === 'link') &&
                                  propertiesFor(n).url,
                              );
                              void handleRefreshAllRoots(refreshable);
                            }}
                            aria-label={
                              refreshAllRootsProgress
                                ? `${refreshAllRootsProgress.current}/${refreshAllRootsProgress.total}`
                                : 'Refresh all'
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={
                                refreshAllRootsProgress !== null
                                  ? { animation: 'spin 0.8s linear infinite' }
                                  : undefined
                              }
                            >
                              <path d="M23 4v6h-6" />
                              <path d="M1 20v-6h6" />
                              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                          </button>
                        )}
                      <button
                        type="button"
                        className={
                          isRootReorderMode
                            ? pageStyles.doneButton
                            : pageStyles.sectionEditButton
                        }
                        onClick={() => {
                          if (!isRootReorderMode) {
                            setReorderRoots([...rootNodes]);
                          } else {
                            handleRootReorderDone();
                          }
                        }}
                      >
                        {isRootReorderMode ? 'Done' : 'Reorder'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={({ active, over }) => {
                  if (!over) return;
                  localReorder(
                    setReorderRoots,
                    String(active.id),
                    String(over.id),
                  );
                }}
              >
                {(() => {
                  const displayNodes = isRootReorderMode
                    ? reorderRoots
                    : rootNodes;
                  return (
                    <SortableContext
                      items={displayNodes.map((n) => n.id)}
                      strategy={
                        isRootReorderMode
                          ? verticalListSortingStrategy
                          : rectSortingStrategy
                      }
                    >
                      <div
                        className={
                          isRootReorderMode
                            ? pageStyles.nodeList
                            : pageStyles.grid
                        }
                      >
                        {displayNodes.map((node) => (
                          <SortableItemNode
                            key={node.id}
                            id={node.id}
                            node={node}
                            isReorderMode={isRootReorderMode}
                            canEdit={canEdit}
                            onEdit={onEditNode}
                            onRefresh={
                              canEdit && propertiesFor(node).url
                                ? () => void handleRefreshRootItem(node)
                                : undefined
                            }
                            isRefreshing={refreshingRootId === node.id}
                            isEnqueued={enqueuedRootIds.includes(node.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  );
                })()}
              </DndContext>
            </section>
          )}
        </>
      )}
    </>
  );
}
