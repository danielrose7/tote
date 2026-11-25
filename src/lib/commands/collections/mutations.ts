import type { MutationOptions, QueryClient } from '@tanstack/react-query';
import {
  type CreateCollectionMutation,
  createCollectionMutation,
  type DeleteCollectionMutation,
  deleteCollectionMutation,
  type UpdateCollectionMutation,
  updateCollectionMutation,
} from '@/lib/collections/client';
import { collectionMutationKeys } from '@/lib/collections/queryKeys';
import {
  applyOptimistic,
  type CacheSnapshot,
  rollbackOptimistic,
} from '../optimistic';
import {
  createCollectionUpdate,
  deleteCollectionUpdate,
  updateCollectionUpdate,
} from './cache';

/**
 * Mutation options for collection commands, shared by the React hooks
 * (`hooks.ts`) and by non-React callers such as WebMCP tools. Writes to one
 * collection share its mutation scope so they reach the server in order.
 * `providers.tsx` registers the matching `mutationFn` and post-settle
 * invalidation for each key, which lets persisted mutations resume after a
 * reload.
 */

export type CollectionCommandOptions = {
  onError?: (error: Error) => void;
};

type CollectionMutationOptions<Data, Variables> = MutationOptions<
  Data,
  Error,
  Variables,
  CacheSnapshot
>;

function collectionScope(collectionId: string) {
  return { id: `collection:${collectionId}` };
}

/** Not scoped: the collection doesn't exist yet, so nothing can race it. */
export function createCollectionOptions(
  queryClient: QueryClient,
  { ownerUserId, onError }: CollectionCommandOptions & { ownerUserId: string },
): CollectionMutationOptions<
  Awaited<ReturnType<typeof createCollectionMutation>>,
  CreateCollectionMutation
> {
  return {
    mutationKey: collectionMutationKeys.create,
    mutationFn: createCollectionMutation,
    onMutate: (variables) =>
      applyOptimistic(queryClient, variables.id, () =>
        createCollectionUpdate(variables, { ownerUserId, now: new Date() }),
      ),
    onError: (error, variables, snapshot) => {
      rollbackOptimistic(queryClient, variables.id, snapshot);
      onError?.(error);
    },
  };
}

export function updateCollectionOptions(
  queryClient: QueryClient,
  collectionId: string,
  { onError }: CollectionCommandOptions = {},
): CollectionMutationOptions<
  Awaited<ReturnType<typeof updateCollectionMutation>>,
  UpdateCollectionMutation
> {
  return {
    mutationKey: collectionMutationKeys.update,
    mutationFn: updateCollectionMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        updateCollectionUpdate(variables, { now: new Date() }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  };
}

export function deleteCollectionOptions(
  queryClient: QueryClient,
  collectionId: string,
  { onError }: CollectionCommandOptions = {},
): CollectionMutationOptions<
  Awaited<ReturnType<typeof deleteCollectionMutation>>,
  DeleteCollectionMutation
> {
  return {
    mutationKey: collectionMutationKeys.delete,
    mutationFn: deleteCollectionMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        deleteCollectionUpdate(variables),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  };
}
