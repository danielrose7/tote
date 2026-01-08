import { useState } from "react";
import type { LoadedBlock } from "../../lib/blocks";
import {
  getSelectionCount,
  isProductSelected,
  toggleProductSelection,
  formatBudget,
} from "../../lib/slotHelpers";
import { ProductCard } from "../ProductCard/ProductCard";
import styles from "./SlotSection.module.css";

interface SlotSectionProps {
  slotBlock: LoadedBlock;
  products: LoadedBlock[];
  onEditProduct?: (block: LoadedBlock) => void;
  onDeleteProduct?: (block: LoadedBlock) => void;
  onRefreshProduct?: (block: LoadedBlock) => void;
  onDeleteSlot?: (block: LoadedBlock) => void;
  refreshingBlockId?: string | null;
  enqueuedBlockIds?: string[];
}

export function SlotSection({
  slotBlock,
  products,
  onEditProduct,
  onDeleteProduct,
  onRefreshProduct,
  onDeleteSlot,
  refreshingBlockId,
  enqueuedBlockIds = [],
}: SlotSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(slotBlock.name);
  const [editMaxSelections, setEditMaxSelections] = useState(
    slotBlock.slotData?.maxSelections || 1
  );
  const [editBudget, setEditBudget] = useState(
    slotBlock.slotData?.budget?.toString() || ""
  );

  const { current: selectedCount, max: maxSelections } =
    getSelectionCount(slotBlock);
  const budget = slotBlock.slotData?.budget;

  const handleToggleSelection = (product: LoadedBlock) => {
    const result = toggleProductSelection(product, slotBlock);
    if (!result.success && result.reason) {
      // Could show a toast here
      console.warn(result.reason);
    }
  };

  const handleSaveEdit = () => {
    // Update the slot block
    slotBlock.$jazz.set("name", editName);
    slotBlock.$jazz.set("slotData", {
      ...slotBlock.slotData,
      maxSelections: editMaxSelections,
      budget: editBudget ? Number(editBudget) : undefined,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(slotBlock.name);
    setEditMaxSelections(slotBlock.slotData?.maxSelections || 1);
    setEditBudget(slotBlock.slotData?.budget?.toString() || "");
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete "${slotBlock.name}"? Products will be moved back to the collection.`
      )
    ) {
      onDeleteSlot?.(slotBlock);
    }
  };

  return (
    <section className={styles.section}>
      {/* Header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
        >
          <svg
            className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ""}`}
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

        {isEditing ? (
          <div className={styles.editForm}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={styles.editInput}
              placeholder="Slot name"
              autoFocus
            />
            <div className={styles.editField}>
              <label className={styles.editLabel}>Pick</label>
              <select
                value={editMaxSelections}
                onChange={(e) => setEditMaxSelections(Number(e.target.value))}
                className={styles.editSelect}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={0}>Unlimited</option>
              </select>
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Budget (cents)</label>
              <input
                type="number"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                className={styles.editInput}
                placeholder="5000"
              />
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
              <h3 className={styles.title}>{slotBlock.name}</h3>
              <span className={styles.selectionCount}>
                {selectedCount}/{maxSelections === 0 ? "∞" : maxSelections} selected
              </span>
              {budget && (
                <span className={styles.budget}>{formatBudget(budget)}</span>
              )}
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={styles.actionButton}
                aria-label="Edit slot"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              {onDeleteSlot && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`${styles.actionButton} ${styles.deleteButton}`}
                  aria-label="Delete slot"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Products Grid */}
      {!isCollapsed && (
        <div className={styles.content}>
          {products.length === 0 ? (
            <div className={styles.empty}>
              No products in this slot yet
            </div>
          ) : (
            <div className={styles.grid}>
              {products.map((product) => {
                const productId = product.$jazz.id;
                const isSelected = isProductSelected(product, slotBlock);
                return (
                  <ProductCard
                    key={productId}
                    block={product}
                    onEdit={onEditProduct}
                    onDelete={onDeleteProduct}
                    onRefresh={onRefreshProduct}
                    isRefreshing={refreshingBlockId === productId}
                    isEnqueued={enqueuedBlockIds.includes(productId)}
                    isSelected={isSelected}
                    onToggleSelection={() => handleToggleSelection(product)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
