/**
 * Hook to get all collections a user can access (owned + shared)
 *
 * Since React hooks can't be called dynamically for each shared collection,
 * this hook accepts pre-loaded shared collections as a parameter.
 * The caller is responsible for loading shared collections via useCoState.
 */

import { useMemo } from "react";
import type { co } from "jazz-tools";
import type { JazzAccount, Block } from "../schema";

type LoadedAccount = co.loaded<typeof JazzAccount>;
type LoadedBlock = co.loaded<typeof Block>;

interface UseAllCollectionsOptions {
  /** Pre-loaded shared collections to include */
  sharedCollections?: LoadedBlock[];
  /** Filter to only include collections where user can write (admin/writer role) */
  writableOnly?: boolean;
}

interface UseAllCollectionsResult {
  /** All collections (owned + shared) */
  collections: LoadedBlock[];
  /** Just the owned collections */
  ownedCollections: LoadedBlock[];
  /** Just the shared collections */
  sharedCollections: LoadedBlock[];
  /** Find a collection by ID (searches both owned and shared) */
  findCollection: (id: string) => LoadedBlock | undefined;
}

/**
 * Get all collections a user can access.
 *
 * @example
 * ```tsx
 * // In a component that has a specific shared collection loaded:
 * const sharedCollection = useCoState(BlockSchema, collectionId);
 *
 * const { collections, findCollection } = useAllCollections(account, {
 *   sharedCollections: sharedCollection ? [sharedCollection] : [],
 * });
 *
 * // Use collections for dropdown
 * // Use findCollection(id) to get a collection by ID
 * ```
 */
export function useAllCollections(
  account: LoadedAccount,
  options: UseAllCollectionsOptions = {}
): UseAllCollectionsResult {
  const { sharedCollections: passedSharedCollections = [] } = options;

  // Get owned collections from account.root.blocks
  const ownedCollections = useMemo(() => {
    if (!account.root?.blocks?.$isLoaded) return [];

    const collections: LoadedBlock[] = [];
    for (const block of account.root.blocks) {
      if (
        block &&
        block.$isLoaded &&
        block.type === "collection" &&
        !block.parentId &&
        !block.collectionData?.sourceId // Exclude published clones
      ) {
        collections.push(block);
      }
    }
    return collections;
  }, [account.root?.blocks]);

  // Build a map of collection ID -> role from sharedWithMe
  const sharedRolesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (account.root?.sharedWithMe?.$isLoaded) {
      for (const ref of account.root.sharedWithMe) {
        if (ref && ref.$isLoaded) {
          map.set(ref.collectionId, ref.role);
        }
      }
    }
    return map;
  }, [account.root?.sharedWithMe]);

  // Get owned collection IDs for quick lookup
  const ownedIds = useMemo(() => {
    return new Set(ownedCollections.map((c) => c.$jazz.id));
  }, [ownedCollections]);

  // Filter shared collections to only valid collection blocks with write access
  // Note: If a collection is in ownedCollections, it's already included there
  const sharedCollections = useMemo(() => {
    return passedSharedCollections.filter((block): block is LoadedBlock => {
      if (!block || !block.$isLoaded || block.type !== "collection") {
        return false;
      }
      // Skip if this is an owned collection (already included in ownedCollections)
      if (ownedIds.has(block.$jazz.id)) {
        return false;
      }
      // Check if user has write access (writer or admin role)
      const role = sharedRolesMap.get(block.$jazz.id);
      return role === "writer" || role === "admin";
    });
  }, [passedSharedCollections, sharedRolesMap, ownedIds]);

  // Combine owned and shared (sharedCollections already excludes owned)
  const collections = useMemo(() => {
    return [...ownedCollections, ...sharedCollections];
  }, [ownedCollections, sharedCollections]);

  // Helper to find a collection by ID
  const findCollection = useMemo(() => {
    const collectionMap = new Map<string, LoadedBlock>();
    for (const collection of collections) {
      collectionMap.set(collection.$jazz.id, collection);
    }
    return (id: string) => collectionMap.get(id);
  }, [collections]);

  return {
    collections,
    ownedCollections,
    sharedCollections,
    findCollection,
  };
}
