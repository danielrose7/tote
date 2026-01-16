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
 * Returns max as undefined when no target is set (subcategory mode)
 */
export function getSelectionCount(slot: LoadedBlock): {
  current: number;
  max: number | undefined;
} {
  if (slot.type !== "slot") {
    return { current: 0, max: undefined };
  }
  const selectedIds = slot.slotData?.selectedProductIds || [];
  const max = slot.slotData?.maxSelections;
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
 * When maxSelections is undefined (no target) or 0 (unlimited), no limit is enforced
 */
export function toggleProductSelection(
  product: LoadedBlock,
  slot: LoadedBlock
): { success: boolean; reason?: string } {
  if (slot.type !== "slot" || product.type !== "product") {
    return { success: false, reason: "Invalid block types" };
  }

  const selectedIds = slot.slotData?.selectedProductIds || [];
  const max = slot.slotData?.maxSelections;
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
    // Select (check limit if max is defined and > 0)
    if (max !== undefined && max > 0 && selectedIds.length >= max) {
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

/**
 * Parse a price string to cents (e.g., "$29.99" -> 2999, "29.99" -> 2999)
 * Returns undefined if unable to parse
 */
export function parsePriceToCents(priceString: string | undefined): number | undefined {
  if (!priceString) return undefined;
  // Remove currency symbols and whitespace, extract numeric value
  const cleaned = priceString.replace(/[^0-9.,]/g, "");
  // Handle comma as decimal separator (e.g., "29,99" -> "29.99")
  const normalized = cleaned.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return undefined;
  return Math.round(value * 100);
}

/**
 * Calculate total price of selected products in a slot (in cents)
 */
export function getSelectedTotal(
  slot: LoadedBlock,
  products: LoadedBlock[]
): number {
  if (slot.type !== "slot") return 0;
  const selectedIds = slot.slotData?.selectedProductIds || [];

  return products.reduce((total, product) => {
    if (!selectedIds.includes(product.$jazz.id)) return total;
    const priceCents = parsePriceToCents(product.productData?.price);
    return total + (priceCents || 0);
  }, 0);
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
