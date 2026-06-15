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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CollectionNode } from '../../db/schema';
import productCardStyles from '../ProductCard/ProductCard.module.css';
import { useToast } from '../ToastNotification';
import {
  checkExtensionAvailable,
  refreshViaExtension,
} from '../../lib/extension';
import {
  deleteCollectionNodeMutation,
  reorderCollectionNodesMutation,
  updateCollectionNodeMutation,
} from '../../lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '../../lib/collections/queryKeys';
import type { CollectionDetail } from '../../lib/collections/repository';
import styles from '../SlotSection/SlotSection.module.css';

type NodeProperties = {
  url?: string;
  imageUrl?: string;
  description?: string;
  price?: string | number;
  body?: string;
};

type SectionProperties = {
  maxSelections?: number;
  budget?: number; // stored in cents
  selectedItemIds?: string[];
};

function propertiesFor(node: CollectionNode): NodeProperties {
  return node.properties as NodeProperties;
}

function sectionPropsFor(section: CollectionNode): SectionProperties {
  return section.properties as SectionProperties;
}

function formatBudget(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function parsePriceToCents(
  price: string | number | undefined,
): number | undefined {
  if (price === undefined || price === null) return undefined;
  const cleaned = String(price)
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? undefined : Math.round(value * 100);
}

async function refreshNodeMetadata(
  url: string,
  useExtension: boolean,
): Promise<{
  title?: string;
  imageUrl?: string;
  description?: string;
  price?: string;
} | null> {
  try {
    if (useExtension) {
      const ext = await refreshViaExtension(url, { capture: true });
      if (ext) return ext;
    }
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function NeonProductItem({
  node,
  onEdit,
  dragHandle,
  isSelected = false,
  onToggleSelection,
  onRefresh,
  isRefreshing = false,
  isEnqueued = false,
}: {
  node: CollectionNode;
  onEdit?: (node: CollectionNode) => void;
  dragHandle?: React.ReactNode;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isEnqueued?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const properties = propertiesFor(node);
  const title = node.title || (node.type === 'photo' ? 'Photo' : 'Untitled');
  const hasImage = !!(properties.imageUrl && !imageError);
  const isListMode = dragHandle !== undefined;

  if (isListMode) {
    return (
      <div className={styles.productItem}>
        {dragHandle}
        {hasImage && (
          <img
            src={properties.imageUrl!}
            alt=""
            className={styles.productItemImage}
            onError={() => setImageError(true)}
          />
        )}
        <span className={styles.productItemName}>{title}</span>
        {properties.price !== undefined && properties.price !== null && (
          <span className={styles.productItemPrice}>
            {String(properties.price)}
          </span>
        )}
      </div>
    );
  }

  return (
    <article
      className={`${productCardStyles.card} ${isSelected ? productCardStyles.cardSelected : ''}`}
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

      {isSelected && (
        <div className={productCardStyles.selectionBadge}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {showActions && (onEdit || onToggleSelection || onRefresh) && (
        <div className={productCardStyles.actionsMenu}>
          {onToggleSelection && (
            <button
              type="button"
              onClick={onToggleSelection}
              className={`${productCardStyles.actionButton} ${isSelected ? productCardStyles.actionButtonSelected : ''}`}
              aria-label={isSelected ? 'Deselect' : 'Select'}
              data-tooltip={isSelected ? 'Deselect' : 'Select'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                {isSelected && (
                  <polyline
                    points="8 12 11 15 16 9"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>
          )}
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
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'capitalize',
              }}
            >
              {node.type}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function NeonSortableItem({
  id,
  node,
  onEdit,
}: {
  id: string;
  node: CollectionNode;
  onEdit?: (node: CollectionNode) => void;
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
      className={isDragging ? styles.productItemDragging : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <NeonProductItem
        node={node}
        onEdit={onEdit}
        dragHandle={
          <button
            type="button"
            className={styles.dragHandle}
            aria-label={`Reorder ${node.title || node.type}`}
            {...attributes}
            {...listeners}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="9" cy="19" r="2" />
              <circle cx="15" cy="5" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="15" cy="19" r="2" />
            </svg>
          </button>
        }
      />
    </div>
  );
}

export interface NeonSlotSectionProps {
  section: CollectionNode;
  items: CollectionNode[];
  otherSections: CollectionNode[];
  collectionId: string;
  canEdit: boolean;
  onEditItem?: (node: CollectionNode) => void;
  dragHandle?: React.ReactNode;
  isDragging?: boolean;
  forceCollapsed?: boolean;
}

export function NeonSlotSection({
  section,
  items,
  otherSections,
  collectionId,
  canEdit,
  onEditItem,
  dragHandle,
  isDragging,
  forceCollapsed,
}: NeonSlotSectionProps) {
  const sectionProps = sectionPropsFor(section);
  const selectedItemIds = sectionProps.selectedItemIds ?? [];
  const maxSelections = sectionProps.maxSelections;
  const budget = sectionProps.budget;
  const selectedCount = selectedItemIds.length;
  const selectedTotal = items.reduce((sum, item) => {
    if (!selectedItemIds.includes(item.id)) return sum;
    return sum + (parsePriceToCents(propertiesFor(item).price) ?? 0);
  }, 0);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Non-empty = reorder mode active; doubles as the local ordered list
  const [reorderItems, setReorderItems] = useState<CollectionNode[]>([]);
  const isProductReorderMode = reorderItems.length > 0;
  const [editName, setEditName] = useState(section.title ?? '');
  const [editMaxSelections, setEditMaxSelections] = useState(
    maxSelections !== undefined ? String(maxSelections) : '',
  );
  const [editBudget, setEditBudget] = useState(
    budget !== undefined ? String(budget / 100) : '',
  );
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [enqueuedIds, setEnqueuedIds] = useState<string[]>([]);
  const [refreshAllProgress, setRefreshAllProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAction, setDeleteAction] = useState<
    'delete' | 'ungrouped' | 'section'
  >('delete');
  const [moveToSectionId, setMoveToSectionId] = useState('');

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const updateSection = useMutation({
    mutationKey: collectionMutationKeys.updateNode,
    mutationFn: updateCollectionNodeMutation,
    onMutate: ({ input }) => {
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collectionId),
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === section.id
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
        title: 'Failed to update section',
        description: error.message,
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collectionId),
      });
    },
  });

  const deleteSection = useMutation({
    mutationKey: collectionMutationKeys.deleteNode,
    mutationFn: deleteCollectionNodeMutation,
    onMutate: () => {
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collectionId),
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.filter(
                  (n) => n.id !== section.id && n.parentId !== section.id,
                ),
              }
            : current,
      );
    },
    onError: (error) => {
      showToast({
        title: 'Failed to delete section',
        description: error.message,
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collectionId),
      });
    },
  });

  const reorderProducts = useMutation({
    mutationKey: collectionMutationKeys.reorderNodes,
    mutationFn: reorderCollectionNodesMutation,
    scope: { id: `collection:${collectionId}:section:${section.id}` },
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

  const updateItem = useMutation({
    mutationKey: collectionMutationKeys.updateNode,
    mutationFn: updateCollectionNodeMutation,
    onMutate: ({ nodeId, input }) => {
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collectionId),
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
        queryKey: collectionQueryKeys.detail(collectionId),
      });
    },
  });

  const handleRefreshItem = async (node: CollectionNode) => {
    const url = propertiesFor(node).url;
    if (!url) return;
    setRefreshingId(node.id);
    const extensionAvailable = await checkExtensionAvailable();
    const metadata = await refreshNodeMetadata(url, extensionAvailable);
    if (metadata) {
      const existingProps = propertiesFor(node);
      updateItem.mutate({
        collectionId,
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
    setRefreshingId(null);
  };

  const handleRefreshAll = async () => {
    const refreshable = items.filter(
      (n) =>
        (n.type === 'product' || n.type === 'link') && propertiesFor(n).url,
    );
    if (refreshable.length === 0) return;
    const extensionAvailable = await checkExtensionAvailable();
    setEnqueuedIds(refreshable.map((n) => n.id));
    setRefreshAllProgress({ current: 0, total: refreshable.length });
    for (let i = 0; i < refreshable.length; i++) {
      const node = refreshable[i];
      setEnqueuedIds((prev) => prev.filter((id) => id !== node.id));
      setRefreshingId(node.id);
      const metadata = await refreshNodeMetadata(
        propertiesFor(node).url!,
        extensionAvailable,
      );
      if (metadata) {
        const existingProps = propertiesFor(node);
        updateItem.mutate({
          collectionId,
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
      setRefreshAllProgress({ current: i + 1, total: refreshable.length });
    }
    setRefreshingId(null);
    setEnqueuedIds([]);
    setRefreshAllProgress(null);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const newMaxSelections = editMaxSelections
      ? Number(editMaxSelections)
      : undefined;
    const newBudget = editBudget
      ? Math.round(Number(editBudget) * 100)
      : undefined;
    updateSection.mutate({
      collectionId,
      nodeId: section.id,
      input: {
        expectedVersion: section.version,
        mutationId: crypto.randomUUID(),
        title: trimmed,
        properties: {
          ...sectionProps,
          maxSelections: newMaxSelections,
          budget: newBudget,
        },
      },
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(section.title ?? '');
    setEditMaxSelections(
      maxSelections !== undefined ? String(maxSelections) : '',
    );
    setEditBudget(budget !== undefined ? String(budget / 100) : '');
    setIsEditing(false);
  };

  const handleToggleSelection = (itemId: string) => {
    const isCurrentlySelected = selectedItemIds.includes(itemId);
    let newIds: string[];
    if (isCurrentlySelected) {
      newIds = selectedItemIds.filter((id) => id !== itemId);
    } else {
      if (
        maxSelections !== undefined &&
        maxSelections > 0 &&
        selectedItemIds.length >= maxSelections
      ) {
        showToast({
          title: 'Selection limit reached',
          description: `Maximum ${maxSelections} selection${maxSelections === 1 ? '' : 's'} allowed`,
          variant: 'error',
        });
        return;
      }
      newIds = [...selectedItemIds, itemId];
    }
    updateSection.mutate({
      collectionId,
      nodeId: section.id,
      input: {
        expectedVersion: section.version,
        mutationId: crypto.randomUUID(),
        properties: { ...sectionProps, selectedItemIds: newIds },
      },
    });
  };

  const handleDelete = () => {
    setDeleteAction('delete');
    setMoveToSectionId('');
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteDialog(false);

    if (deleteAction === 'delete' || items.length === 0) {
      deleteSection.mutate({
        collectionId,
        nodeId: section.id,
        input: {
          expectedVersion: section.version,
          mutationId: crypto.randomUUID(),
        },
      });
      return;
    }

    const targetParentId =
      deleteAction === 'section' ? moveToSectionId || null : null;

    // Optimistically move items and remove section from cache
    queryClient.setQueryData<CollectionDetail>(
      collectionQueryKeys.detail(collectionId),
      (current) => {
        if (!current) return current;
        const movedItemIds = new Set(items.map((n) => n.id));
        return {
          ...current,
          nodes: current.nodes
            .filter((n) => n.id !== section.id)
            .map((n) =>
              movedItemIds.has(n.id)
                ? { ...n, parentId: targetParentId, version: n.version + 1 }
                : n,
            ),
        };
      },
    );

    try {
      // Move all items first (in parallel)
      await Promise.all(
        items.map((item) =>
          updateCollectionNodeMutation({
            collectionId,
            nodeId: item.id,
            input: {
              expectedVersion: item.version,
              mutationId: crypto.randomUUID(),
              parentId: targetParentId,
            },
          }),
        ),
      );
      // Then delete the now-empty section
      await deleteCollectionNodeMutation({
        collectionId,
        nodeId: section.id,
        input: {
          expectedVersion: section.version,
          mutationId: crypto.randomUUID(),
        },
      });
    } catch (err) {
      showToast({
        title: 'Failed to delete section',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collectionId),
      });
    }
  };

  const handleProductDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setReorderItems((prev) => {
      const oldIndex = prev.findIndex((n) => n.id === String(active.id));
      const newIndex = prev.findIndex((n) => n.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleProductReorderDone = () => {
    const updates = reorderItems.map((node, i) => ({
      node,
      positionKey: `r:${String(i).padStart(8, '0')}:${node.id}`,
    }));
    const hasChanged = updates.some(
      ({ node, positionKey }) => node.positionKey !== positionKey,
    );
    if (hasChanged) {
      const nextPositions = new Map(
        updates.map(({ node, positionKey }) => [node.id, positionKey]),
      );
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collectionId),
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
      reorderProducts.mutate({
        collectionId,
        input: {
          mutationId: crypto.randomUUID(),
          nodes: updates.map(({ node, positionKey }) => ({
            id: node.id,
            expectedVersion: node.version,
            positionKey,
          })),
        },
      });
    }
    setReorderItems([]);
  };

  const effectiveCollapsed = forceCollapsed || isCollapsed;

  return (
    <section
      className={`${styles.section} ${isDragging ? styles.dragging : ''} ${forceCollapsed ? styles.reorderMode : ''}`}
    >
      <div className={styles.header}>
        {dragHandle}
        {!forceCollapsed && (
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
          >
            <svg
              className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}

        {isEditing ? (
          <div className={styles.editForm}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className={styles.editInput}
              placeholder="Section name"
              autoFocus
            />
            <div className={styles.editField}>
              <label className={styles.editLabel}>Pick</label>
              <input
                type="number"
                value={editMaxSelections}
                onChange={(e) => setEditMaxSelections(e.target.value)}
                className={styles.editInput}
                placeholder="Any"
                min="1"
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Budget</label>
              <div className={styles.budgetInputWrapper}>
                <span className={styles.currencyPrefix}>$</span>
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  className={styles.editInput}
                  placeholder="100"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className={styles.editActions}>
              <button
                type="button"
                onClick={handleSaveEdit}
                className={styles.saveButton}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.headerInfo}>
              <h3 className={styles.title}>
                {section.title || 'Untitled section'}
              </h3>
              {!forceCollapsed && (
                <>
                  {maxSelections !== undefined ? (
                    <span className={styles.selectionCount}>
                      {selectedCount}/
                      {maxSelections === 0 ? '∞' : maxSelections} selected
                    </span>
                  ) : (
                    <span className={styles.selectionCount}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  )}
                  {budget !== undefined && (
                    <span
                      className={`${styles.budget} ${selectedTotal > budget ? styles.overBudget : ''}`}
                    >
                      {formatBudget(selectedTotal)} / {formatBudget(budget)}
                    </span>
                  )}
                </>
              )}
            </div>
            {!forceCollapsed && canEdit && (
              <div className={styles.headerActions}>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isProductReorderMode) {
                        setReorderItems([...items]);
                      } else {
                        handleProductReorderDone();
                      }
                    }}
                    className={
                      isProductReorderMode
                        ? styles.doneButton
                        : styles.reorderButton
                    }
                  >
                    {isProductReorderMode ? 'Done' : 'Reorder'}
                  </button>
                )}
                {!isProductReorderMode && (
                  <>
                    {items.some(
                      (n) =>
                        (n.type === 'product' || n.type === 'link') &&
                        propertiesFor(n).url,
                    ) && (
                      <button
                        type="button"
                        onClick={() => void handleRefreshAll()}
                        disabled={refreshAllProgress !== null}
                        className={styles.actionButton}
                        aria-label="Refresh all"
                        data-tooltip={
                          refreshAllProgress
                            ? `${refreshAllProgress.current}/${refreshAllProgress.total}`
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
                            refreshAllProgress !== null
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
                      onClick={() => setIsEditing(true)}
                      className={styles.actionButton}
                      aria-label="Edit section"
                      data-tooltip="Edit"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      aria-label="Delete section"
                      data-tooltip="Delete"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!effectiveCollapsed && (
        <div className={styles.content}>
          {items.length === 0 ? (
            <div className={styles.empty}>No items in this section yet</div>
          ) : isProductReorderMode ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProductDragEnd}
            >
              <SortableContext
                items={reorderItems.map((n) => n.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.productList}>
                  {reorderItems.map((node) => (
                    <NeonSortableItem
                      key={node.id}
                      id={node.id}
                      node={node}
                      onEdit={onEditItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className={styles.grid}>
              {items.map((node) => (
                <NeonProductItem
                  key={node.id}
                  node={node}
                  onEdit={onEditItem}
                  isSelected={selectedItemIds.includes(node.id)}
                  onToggleSelection={() => handleToggleSelection(node.id)}
                  onRefresh={
                    propertiesFor(node).url
                      ? () => void handleRefreshItem(node)
                      : undefined
                  }
                  isRefreshing={refreshingId === node.id}
                  isEnqueued={enqueuedIds.includes(node.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>

    <Dialog.Root open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 50,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '360px',
            maxWidth: '90vw',
            zIndex: 51,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <Dialog.Title
            style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', margin: 0 }}
          >
            Delete &ldquo;{section.title || 'section'}&rdquo;?
          </Dialog.Title>

          {items.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              This section is empty and will be permanently removed.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                This section has {items.length} {items.length === 1 ? 'item' : 'items'}. What should happen to them?
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="deleteAction"
                  value="delete"
                  checked={deleteAction === 'delete'}
                  onChange={() => setDeleteAction('delete')}
                />
                Remove all {items.length} {items.length === 1 ? 'item' : 'items'} from the collection
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="deleteAction"
                  value="ungrouped"
                  checked={deleteAction === 'ungrouped'}
                  onChange={() => setDeleteAction('ungrouped')}
                />
                Move items to ungrouped
              </label>
              {otherSections.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="deleteAction"
                    value="section"
                    checked={deleteAction === 'section'}
                    onChange={() => {
                      setDeleteAction('section');
                      if (!moveToSectionId) setMoveToSectionId(otherSections[0].id);
                    }}
                  />
                  Move items to another section
                  {deleteAction === 'section' && (
                    <select
                      value={moveToSectionId}
                      onChange={(e) => setMoveToSectionId(e.target.value)}
                      style={{ marginLeft: '4px', fontSize: 'var(--font-size-sm)' }}
                    >
                      {otherSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || 'Untitled section'}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Dialog.Close asChild>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--color-danger, #ef4444)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
              }}
            >
              {deleteAction === 'delete' || items.length === 0
                ? 'Delete'
                : 'Move & delete section'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
