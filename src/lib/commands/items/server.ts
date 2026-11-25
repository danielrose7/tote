import {
  createCollectionNodeInputSchema,
  deleteCollectionNodeInputSchema,
  reorderCollectionNodesInputSchema,
  updateCollectionNodeInputSchema,
} from '@/lib/collections/api';
import {
  createCollectionNode,
  deleteCollectionNode,
  reorderCollectionNodes,
  updateCollectionNode,
} from '@/lib/collections/repository';
import { collectionTarget, defineCommand, nodeTarget } from '../command';

export const createItemCommand = defineCommand({
  name: 'items.create',
  description:
    'Add an item (product, link, photo, note or text) or a section to a collection.',
  annotations: { idempotent: true },
  target: collectionTarget,
  input: createCollectionNodeInputSchema,
  run: ({ userId, addedVia }, { collectionId }, input) =>
    createCollectionNode(userId, collectionId, {
      ...input,
      addedVia: addedVia(input.addedVia),
    }),
});

export const updateItemCommand = defineCommand({
  name: 'items.update',
  description:
    "Change an item's title or properties, or move it to another section. Properties are replaced, not merged. Requires the item's current version.",
  annotations: { idempotent: true },
  target: nodeTarget,
  input: updateCollectionNodeInputSchema,
  run: ({ userId }, { collectionId, nodeId }, input) =>
    updateCollectionNode(userId, collectionId, nodeId, input),
});

export const deleteItemCommand = defineCommand({
  name: 'items.delete',
  description:
    "Delete an item, or a section together with everything in it. Requires the item's current version.",
  annotations: { destructive: true, idempotent: true },
  target: nodeTarget,
  input: deleteCollectionNodeInputSchema,
  run: ({ userId }, { collectionId, nodeId }, input) =>
    deleteCollectionNode(userId, collectionId, nodeId, input),
});

export const reorderItemsCommand = defineCommand({
  name: 'items.reorder',
  description:
    'Set new positions for two or more items or sections in a collection.',
  annotations: { idempotent: true },
  target: collectionTarget,
  input: reorderCollectionNodesInputSchema,
  run: ({ userId }, { collectionId }, input) =>
    reorderCollectionNodes(userId, collectionId, input),
});
