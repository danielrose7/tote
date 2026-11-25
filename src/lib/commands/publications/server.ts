import { z } from 'zod';
import {
  collectionIdSchema,
  copyCollectionInputSchema,
  publishCollectionInputSchema,
} from '@/lib/collections/api';
import { copyPublishedCollection } from '@/lib/collections/copyRepository';
import {
  getCollectionPublicationStatus,
  publishCollectionSnapshot,
  unpublishCollectionSnapshot,
} from '@/lib/collections/publicationRepository';
import {
  collectionTarget,
  defineCommand,
  type FailureResponse,
} from '../command';

/**
 * Publication commands: the public, read-only snapshot of a collection.
 * Publishing is opt-in and explicit (PRODUCT.md), so these are not exposed
 * as agent tools; copying a published collection is.
 */

const slugConflict: FailureResponse = {
  status: 409,
  body: { error: 'That public URL is already in use' },
};

export const getPublicationCommand = defineCommand({
  name: 'publications.get',
  description:
    'Whether a collection is published, and its public URL and settings.',
  annotations: { readOnly: true },
  target: collectionTarget,
  failures: { slug_conflict: slugConflict },
  run: ({ userId }, { collectionId }) =>
    getCollectionPublicationStatus(userId, collectionId),
});

export const publishCollectionCommand = defineCommand({
  name: 'publications.publish',
  description:
    'Publish or update the public snapshot of a collection at a chosen URL.',
  annotations: {},
  target: collectionTarget,
  input: publishCollectionInputSchema,
  failures: { slug_conflict: slugConflict },
  run: async ({ userId, username }, { collectionId }, input) =>
    publishCollectionSnapshot(userId, collectionId, {
      ...input,
      username: await username(),
    }),
});

export const unpublishCollectionCommand = defineCommand({
  name: 'publications.unpublish',
  description: 'Take down the public snapshot of a collection.',
  annotations: { destructive: true },
  target: collectionTarget,
  failures: { slug_conflict: slugConflict },
  run: ({ userId }, { collectionId }) =>
    unpublishCollectionSnapshot(userId, collectionId),
});

export const copyPublicationCommand = defineCommand({
  name: 'publications.copy',
  description:
    'Copy a published collection into a new private collection owned by the user.',
  annotations: { idempotent: true },
  target: z.object({ publicationId: collectionIdSchema }),
  input: copyCollectionInputSchema,
  run: async ({ userId }, { publicationId }, input) => {
    const result = await copyPublishedCollection(userId, publicationId, input);
    if (result.status !== 'ok') return result;
    return {
      status: 'ok',
      value: { id: result.value.id },
      ...(result.value.replayed ? { replayed: true as const } : {}),
    };
  },
});
