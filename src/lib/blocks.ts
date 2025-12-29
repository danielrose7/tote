/**
 * Block type helpers
 *
 * Provides TypeScript interfaces and helper functions for working with
 * the block-based data model.
 */

import type { co } from "jazz-tools";
import type { Block } from "../schema";

// =============================================================================
// Types
// =============================================================================

export type LoadedBlock = co.loaded<typeof Block>;

export type ProductStatus = "considering" | "selected" | "ruled-out";
export type ViewMode = "grid" | "table";
export type BlockType = "project" | "collection" | "slot" | "product";

// =============================================================================
// Type Guards
// =============================================================================

export function isProductBlock(block: LoadedBlock): boolean {
  return block.type === "product";
}

export function isSlotBlock(block: LoadedBlock): boolean {
  return block.type === "slot";
}

export function isCollectionBlock(block: LoadedBlock): boolean {
  return block.type === "collection";
}

export function isProjectBlock(block: LoadedBlock): boolean {
  return block.type === "project";
}

// =============================================================================
// Data Accessors
// =============================================================================

/** Get product data from a product block (returns undefined if not a product block) */
export function getProductData(block: LoadedBlock) {
  if (block.type !== "product") return undefined;
  return block.productData;
}

/** Get collection data from a collection block */
export function getCollectionData(block: LoadedBlock) {
  if (block.type !== "collection") return undefined;
  return block.collectionData;
}

/** Get slot data from a slot block */
export function getSlotData(block: LoadedBlock) {
  if (block.type !== "slot") return undefined;
  return block.slotData;
}

/** Get project data from a project block */
export function getProjectData(block: LoadedBlock) {
  if (block.type !== "project") return undefined;
  return block.projectData;
}
