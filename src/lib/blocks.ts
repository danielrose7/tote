/**
 * Block type helpers
 *
 * Provides TypeScript interfaces and helper functions for working with
 * the block-based data model.
 */

import { Group, createInviteLink, type Account } from "jazz-tools";
import type { co } from "jazz-tools";
import { Block } from "../schema";

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

// =============================================================================
// Publishing (Draft/Publish Workflow)
// =============================================================================

/**
 * Check if a collection has been published.
 */
export function isPublished(collection: LoadedBlock): boolean {
  if (collection.type !== "collection") return false;
  return !!collection.collectionData?.publishedId;
}

/**
 * Check if a collection is a published clone (not the source draft).
 */
export function isPublishedClone(collection: LoadedBlock): boolean {
  if (collection.type !== "collection") return false;
  return !!collection.collectionData?.sourceId;
}

/**
 * Publish a collection by creating a Group-owned clone.
 * The clone is readable by "everyone" for public access.
 *
 * Returns all created blocks (collection + children) so caller can add them
 * to their blocks list for persistence.
 */
export function publishCollection(
  sourceCollection: LoadedBlock,
  allBlocks: LoadedBlock[],
  owner: Account
): LoadedBlock[] {
  if (sourceCollection.type !== "collection") {
    throw new Error("Can only publish collection blocks");
  }

  if (isPublished(sourceCollection)) {
    throw new Error("Collection is already published");
  }

  const createdBlocks: LoadedBlock[] = [];

  // Create a Group for the published version - everyone can read
  const group = Group.create({ owner });
  group.addMember("everyone", "reader");

  // Map from old block ID to new block ID (for parent references)
  const idMap = new Map<string, string>();

  // Clone the collection
  const publishedCollection = Block.create(
    {
      type: "collection",
      name: sourceCollection.name,
      collectionData: {
        ...sourceCollection.collectionData,
        sourceId: sourceCollection.$jazz.id, // Points back to draft
        publishedId: undefined, // Published clone doesn't have its own published version
        publishedAt: new Date(),
      },
      createdAt: sourceCollection.createdAt,
    },
    { owner: group }
  ) as LoadedBlock;

  createdBlocks.push(publishedCollection);
  idMap.set(sourceCollection.$jazz.id, publishedCollection.$jazz.id);

  // Find and clone all child blocks (slots and products)
  const childBlocks = allBlocks.filter(
    (b) => b.parentId === sourceCollection.$jazz.id
  );

  for (const child of childBlocks) {
    if (child.type === "slot") {
      // Clone slot
      const clonedSlot = Block.create(
        {
          type: "slot",
          name: child.name,
          slotData: child.slotData,
          parentId: publishedCollection.$jazz.id,
          sortOrder: child.sortOrder,
          createdAt: child.createdAt,
        },
        { owner: group }
      ) as LoadedBlock;

      createdBlocks.push(clonedSlot);
      idMap.set(child.$jazz.id, clonedSlot.$jazz.id);

      // Find and clone products in this slot
      const slotProducts = allBlocks.filter(
        (b) => b.parentId === child.$jazz.id && b.type === "product"
      );

      for (const product of slotProducts) {
        const clonedProduct = Block.create(
          {
            type: "product",
            name: product.name,
            productData: product.productData,
            parentId: clonedSlot.$jazz.id,
            sortOrder: product.sortOrder,
            createdAt: product.createdAt,
          },
          { owner: group }
        ) as LoadedBlock;

        createdBlocks.push(clonedProduct);
        idMap.set(product.$jazz.id, clonedProduct.$jazz.id);
      }
    } else if (child.type === "product") {
      // Clone product directly in collection
      const clonedProduct = Block.create(
        {
          type: "product",
          name: child.name,
          productData: child.productData,
          parentId: publishedCollection.$jazz.id,
          sortOrder: child.sortOrder,
          createdAt: child.createdAt,
        },
        { owner: group }
      ) as LoadedBlock;

      createdBlocks.push(clonedProduct);
      idMap.set(child.$jazz.id, clonedProduct.$jazz.id);
    }
  }

  // Collect all child block IDs (excluding the collection itself)
  const childBlockIds = createdBlocks
    .filter((b) => b.$jazz.id !== publishedCollection.$jazz.id)
    .map((b) => b.$jazz.id);

  // Update published collection with child IDs for public view discovery
  publishedCollection.$jazz.set("collectionData", {
    ...publishedCollection.collectionData,
    childBlockIds,
  });

  // Update source collection with published ID
  sourceCollection.$jazz.set("collectionData", {
    ...sourceCollection.collectionData,
    publishedId: publishedCollection.$jazz.id,
    publishedAt: new Date(),
  });

  return createdBlocks;
}

/**
 * Unpublish a collection by clearing the publishedId reference.
 * Note: The published clone blocks will still exist but won't be linked.
 * They can be cleaned up separately if needed.
 */
export function unpublishCollection(sourceCollection: LoadedBlock): void {
  if (sourceCollection.type !== "collection") {
    throw new Error("Can only unpublish collection blocks");
  }

  sourceCollection.$jazz.set("collectionData", {
    ...sourceCollection.collectionData,
    publishedId: undefined,
    publishedAt: undefined,
  });
}

// =============================================================================
// Collaborator Sharing (Invite-based)
// =============================================================================

export type SharingRole = "reader" | "writer" | "admin";

/**
 * Check if a collection has sharing enabled (has a sharing group).
 */
export function hasSharingGroup(collection: LoadedBlock): boolean {
  if (collection.type !== "collection") return false;
  return !!collection.collectionData?.sharingGroupId;
}

/**
 * Enable sharing on a collection by creating a sharing Group.
 * Returns the Group so the caller can create invite links.
 */
export function enableSharing(
  collection: LoadedBlock,
  owner: Account
): Group {
  if (collection.type !== "collection") {
    throw new Error("Can only enable sharing on collection blocks");
  }

  // Create a new Group for sharing
  const group = Group.create({ owner });
  group.addMember(owner, "admin");

  // Store the group ID on the collection
  collection.$jazz.set("collectionData", {
    ...collection.collectionData,
    sharingGroupId: group.$jazz.id,
  });

  return group;
}

/**
 * Get or create the sharing group for a collection.
 * Returns the group ID and whether it was newly created.
 */
export async function getOrCreateSharingGroup(
  collection: LoadedBlock,
  owner: Account
): Promise<{ group: Group; created: boolean }> {
  if (collection.type !== "collection") {
    throw new Error("Can only get sharing group for collection blocks");
  }

  const existingGroupId = collection.collectionData?.sharingGroupId;

  if (existingGroupId) {
    const group = await Group.load(existingGroupId as `co_z${string}`, {});
    if (group) {
      return { group, created: false };
    }
  }

  // Create new group
  const group = enableSharing(collection, owner);
  return { group, created: true };
}

/**
 * Generate an invite link for a collection.
 * Uses Jazz's createInviteLink for proper formatting.
 */
export function generateCollectionInviteLink(
  collection: LoadedBlock,
  role: SharingRole,
  baseUrl: string
): string {
  // Use Jazz's createInviteLink function
  // This creates a properly formatted invite URL
  return createInviteLink(collection, role, baseUrl);
}
