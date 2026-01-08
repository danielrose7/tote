/**
 * Slot helper functions
 *
 * Provides utilities for working with slots and product selection within slots.
 */

import type { LoadedBlock } from "./blocks";

// =============================================================================
// Selection Helpers
// =============================================================================

/**
 * Get the selection count for a slot
 */
export function getSelectionCount(slot: LoadedBlock): {
  current: number;
  max: number;
} {
  if (slot.type !== "slot") {
    return { current: 0, max: 1 };
  }
  const selectedIds = slot.slotData?.selectedProductIds || [];
  const max = slot.slotData?.maxSelections || 1;
  return { current: selectedIds.length, max };
}

/**
 * Check if a product is selected in its slot
 */
export function isProductSelected(
  product: LoadedBlock,
  slot: LoadedBlock
): boolean {
  if (slot.type !== "slot" || product.type !== "product") {
    return false;
  }
  const selectedIds = slot.slotData?.selectedProductIds || [];
  return selectedIds.includes(product.$jazz.id);
}

/**
 * Toggle product selection within a slot (respects maxSelections)
 */
export function toggleProductSelection(
  product: LoadedBlock,
  slot: LoadedBlock
): { success: boolean; reason?: string } {
  if (slot.type !== "slot" || product.type !== "product") {
    return { success: false, reason: "Invalid block types" };
  }

  const selectedIds = slot.slotData?.selectedProductIds || [];
  const max = slot.slotData?.maxSelections || 1;
  const productId = product.$jazz.id;

  if (selectedIds.includes(productId)) {
    // Deselect
    const newIds = selectedIds.filter((id) => id !== productId);
    slot.$jazz.set("slotData", {
      ...slot.slotData,
      selectedProductIds: newIds,
    });
    return { success: true };
  } else {
    // Select (check limit)
    if (selectedIds.length >= max) {
      return {
        success: false,
        reason: `Maximum ${max} selection${max === 1 ? "" : "s"} allowed`,
      };
    }
    slot.$jazz.set("slotData", {
      ...slot.slotData,
      selectedProductIds: [...selectedIds, productId],
    });
    return { success: true };
  }
}

/**
 * Remove a product from a slot's selection (used when deleting or moving products)
 */
export function removeFromSelection(
  productId: string,
  slot: LoadedBlock
): void {
  if (slot.type !== "slot") return;

  const selectedIds = slot.slotData?.selectedProductIds || [];
  if (selectedIds.includes(productId)) {
    const newIds = selectedIds.filter((id) => id !== productId);
    slot.$jazz.set("slotData", {
      ...slot.slotData,
      selectedProductIds: newIds,
    });
  }
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format budget in cents to display string (e.g., 5000 -> "$50.00")
 */
export function formatBudget(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Get all slots for a collection
 */
export function getSlotsForCollection(
  allBlocks: LoadedBlock[],
  collectionId: string
): LoadedBlock[] {
  return allBlocks.filter(
    (block) =>
      block &&
      block.$isLoaded &&
      block.type === "slot" &&
      block.parentId === collectionId
  );
}

/**
 * Get products for a slot
 */
export function getProductsForSlot(
  allBlocks: LoadedBlock[],
  slotId: string
): LoadedBlock[] {
  return allBlocks.filter(
    (block) =>
      block &&
      block.$isLoaded &&
      block.type === "product" &&
      block.parentId === slotId
  );
}

/**
 * Get ungrouped products (products directly in collection, not in a slot)
 */
export function getUngroupedProducts(
  allBlocks: LoadedBlock[],
  collectionId: string
): LoadedBlock[] {
  return allBlocks.filter(
    (block) =>
      block &&
      block.$isLoaded &&
      block.type === "product" &&
      block.parentId === collectionId
  );
}
