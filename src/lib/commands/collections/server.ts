import {
  copyCollectionInputSchema,
  createCollectionInputSchema,
  deleteCollectionInputSchema,
  updateCollectionInputSchema,
} from '@/lib/collections/api';
import { copyCollection } from '@/lib/collections/copyRepository';
import {
  createCollection,
  deleteCollection,
  getCollectionDetail,
  listCollectionSummaries,
  updateCollection,
} from '@/lib/collections/repository';
import { collectionTarget, defineCommand, noTarget } from '../command';

export const listCollectionsCommand = defineCommand({
  name: 'collections.list',
  description:
    "List the signed-in user's collections with their names, item counts and roles.",
  annotations: { readOnly: true },
  target: noTarget,
  run: async ({ userId }) => ({
    status: 'ok',
    value: { collections: await listCollectionSummaries(userId) },
  }),
});

export const getCollectionCommand = defineCommand({
  name: 'collections.get',
  description:
    'Get one collection with all of its sections and items, including versions needed for edits.',
  annotations: { readOnly: true },
  target: collectionTarget,
  run: async ({ userId }, { collectionId }) => {
    const detail = await getCollectionDetail(userId, collectionId);
    return detail ? { status: 'ok', value: detail } : { status: 'not_found' };
  },
});

export const createCollectionCommand = defineCommand({
  name: 'collections.create',
  description: 'Add a new, private collection owned by the signed-in user.',
  annotations: { idempotent: true },
  target: noTarget,
  input: createCollectionInputSchema,
  run: async ({ userId }, _target, input) => {
    const result = await createCollection(userId, input);
    if (result.status === 'idempotency_conflict') return result;
    return {
      status: 'ok',
      value: { id: result.id },
      ...(result.status === 'replayed' ? { replayed: true as const } : {}),
    };
  },
});

export const updateCollectionCommand = defineCommand({
  name: 'collections.update',
  description:
    "Change a collection's name, description, color, budget or display settings. Requires the collection's current version.",
  annotations: { idempotent: true },
  target: collectionTarget,
  input: updateCollectionInputSchema,
  run: ({ userId }, { collectionId }, input) =>
    updateCollection(userId, collectionId, input),
});

export const deleteCollectionCommand = defineCommand({
  name: 'collections.delete',
  description:
    "Delete a collection and everything in it. Requires the collection's current version.",
  annotations: { destructive: true, idempotent: true },
  target: collectionTarget,
  input: deleteCollectionInputSchema,
  run: ({ userId }, { collectionId }, input) =>
    deleteCollection(userId, collectionId, input),
});

export const copyCollectionCommand = defineCommand({
  name: 'collections.copy',
  description:
    'Copy a collection the user can access into a new collection they own.',
  annotations: { idempotent: true },
  target: collectionTarget,
  input: copyCollectionInputSchema,
  run: async ({ userId }, { collectionId }, input) => {
    const result = await copyCollection(userId, collectionId, input);
    if (result.status !== 'ok') return result;
    return {
      status: 'ok',
      value: { id: result.value.id },
      ...(result.value.replayed ? { replayed: true as const } : {}),
    };
  },
});
