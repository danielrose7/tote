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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CollectionNode } from '../../db/schema';
import productCardStyles from '../ProductCard/ProductCard.module.css';
import { useToast } from '../ToastNotification';
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

function NeonProductItem({
  node,
  onEdit,
  dragHandle,
  isSelected = false,
  onToggleSelection,
}: {
  node: CollectionNode;
  onEdit?: (node: CollectionNode) => void;
  dragHandle?: React.ReactNode;
  isSelected?: boolean;
  onToggleSelection?: () => void;
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

      {showActions && (onEdit || onToggleSelection) && (
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
    const itemWord = items.length === 1 ? 'item' : 'items';
    const msg =
      items.length > 0
        ? `Delete "${section.title}"? All ${items.length} ${itemWord} in this section will also be deleted.`
        : `Delete "${section.title}"?`;
    if (!window.confirm(msg)) return;
    deleteSection.mutate({
      collectionId,
      nodeId: section.id,
      input: {
        expectedVersion: section.version,
        mutationId: crypto.randomUUID(),
      },
    });
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
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
