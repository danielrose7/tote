import type { CollectionNode } from '@/db/schema';
import type {
  CreateCollectionNodeMutation,
  DeleteCollectionNodeMutation,
  ReorderCollectionNodesMutation,
  UpdateCollectionNodeMutation,
} from '@/lib/collections/client';
import type { CollectionSummary } from '@/lib/collections/repository';
import type { CollectionCacheUpdate } from '../optimistic';

/** Item commands always change the collection's detail. */
type ItemCacheUpdate = CollectionCacheUpdate &
  Required<Pick<CollectionCacheUpdate, 'detail'>>;

/**
 * Optimistic cache effects for item commands, written once.
 *
 * Every surface that changes a collection's nodes (the add and edit dialogs,
 * section controls, refresh, reorder, and later WebMCP tools) applies the same
 * change to the TanStack cache. These functions are pure so they can be tested
 * and shared; `hooks.ts` wires them into mutations.
 *
 * Each mirrors what the server does: `properties` is replaced, not merged, and
 * deleting a node removes its descendants.
 */

/** Node types that count toward a collection's `itemCount`. */
export const ITEM_NODE_TYPES: ReadonlySet<CollectionNode['type']> = new Set([
  'product',
  'link',
  'photo',
]);

export function descendantIds(
  nodes: readonly CollectionNode[],
  rootId: string,
): Set<string> {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  return ids;
}

function adjustSummary(
  collectionId: string,
  itemDelta: number,
  now: Date,
): (current: CollectionSummary[]) => CollectionSummary[] {
  return (current) =>
    current.map((summary) =>
      summary.id === collectionId
        ? {
            ...summary,
            itemCount: Math.max(0, summary.itemCount + itemDelta),
            updatedAt: now,
          }
        : summary,
    );
}

export function createNodeUpdate(
  { collectionId, input }: CreateCollectionNodeMutation,
  { createdByUserId, now }: { createdByUserId: string; now: Date },
): ItemCacheUpdate {
  const itemDelta = ITEM_NODE_TYPES.has(input.type) ? 1 : 0;
  const node: CollectionNode = {
    id: input.id,
    collectionId,
    parentId: input.parentId ?? null,
    type: input.type,
    title: input.title ?? null,
    properties: input.properties ?? {},
    positionKey: input.positionKey,
    version: 1,
    createdByUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    addedVia: input.addedVia ?? 'app',
  };
  return {
    detail: (current) => {
      // A retried or resumed create must not add the node twice.
      if (current.nodes.some((candidate) => candidate.id === node.id)) {
        return current;
      }
      return {
        ...current,
        collection: {
          ...current.collection,
          itemCount: current.collection.itemCount + itemDelta,
          version: current.collection.version + 1,
          updatedAt: now,
        },
        nodes: [...current.nodes, node],
      };
    },
    summaries: itemDelta
      ? adjustSummary(collectionId, itemDelta, now)
      : undefined,
  };
}

export function updateNodeUpdate(
  { nodeId, input }: UpdateCollectionNodeMutation,
  { now }: { now: Date },
): ItemCacheUpdate {
  return {
    detail: (current) => ({
      ...current,
      collection: {
        ...current.collection,
        version: current.collection.version + 1,
        updatedAt: now,
      },
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              parentId:
                input.parentId === undefined ? node.parentId : input.parentId,
              title: input.title === undefined ? node.title : input.title,
              properties: input.properties ?? node.properties,
              positionKey: input.positionKey ?? node.positionKey,
              version: node.version + 1,
              updatedAt: now,
            }
          : node,
      ),
    }),
  };
}

export function deleteNodeUpdate(
  { collectionId, nodeId }: DeleteCollectionNodeMutation,
  { now, nodes }: { now: Date; nodes: readonly CollectionNode[] },
): ItemCacheUpdate {
  const removedIds = descendantIds(nodes, nodeId);
  const removedItemCount = nodes.filter(
    (node) => removedIds.has(node.id) && ITEM_NODE_TYPES.has(node.type),
  ).length;
  return {
    detail: (current) => ({
      ...current,
      collection: {
        ...current.collection,
        itemCount: Math.max(0, current.collection.itemCount - removedItemCount),
        version: current.collection.version + removedIds.size,
        updatedAt: now,
      },
      nodes: current.nodes.filter((node) => !removedIds.has(node.id)),
    }),
    summaries: removedItemCount
      ? adjustSummary(collectionId, -removedItemCount, now)
      : undefined,
  };
}

export function reorderNodesUpdate(
  { input }: ReorderCollectionNodesMutation,
  { now }: { now: Date },
): ItemCacheUpdate {
  const nextPositions = new Map(
    input.nodes.map((node) => [node.id, node.positionKey]),
  );
  return {
    detail: (current) => ({
      ...current,
      collection: {
        ...current.collection,
        version: current.collection.version + nextPositions.size,
        updatedAt: now,
      },
      nodes: current.nodes.map((node) => {
        const positionKey = nextPositions.get(node.id);
        return positionKey
          ? { ...node, positionKey, version: node.version + 1, updatedAt: now }
          : node;
      }),
    }),
  };
}
