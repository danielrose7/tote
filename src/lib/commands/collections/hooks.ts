'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type CopyCollectionMutation,
  type CreateCollectionMutation,
  copyCollectionMutation,
  createCollectionMutation,
  type DeleteCollectionMutation,
  deleteCollectionMutation,
  type UpdateCollectionMutation,
  updateCollectionMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
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
 * Collection commands: add, update, delete and copy.
 *
 * Each hook owns the optimistic lifecycle; callers add only what is specific
 * to them, usually a toast via `onError`. Writes to one collection share its
 * mutation scope so they reach the server in order. `providers.tsx` registers
 * the matching `mutationFn` and post-settle invalidation for each key, which
 * lets persisted mutations resume after a reload.
 */

export type CollectionCommandOptions = {
  onError?: (error: Error) => void;
};

function collectionScope(collectionId: string) {
  return { id: `collection:${collectionId}` };
}

/** Not scoped: the collection doesn't exist yet, so nothing can race it. */
export function useCreateCollection({
  onError,
}: CollectionCommandOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  return useMutation<
    Awaited<ReturnType<typeof createCollectionMutation>>,
    Error,
    CreateCollectionMutation,
    CacheSnapshot
  >({
    mutationKey: collectionMutationKeys.create,
    mutationFn: createCollectionMutation,
    onMutate: (variables) =>
      applyOptimistic(queryClient, variables.id, () =>
        createCollectionUpdate(variables, {
          ownerUserId: user?.id ?? '',
          now: new Date(),
        }),
      ),
    onError: (error, variables, snapshot) => {
      rollbackOptimistic(queryClient, variables.id, snapshot);
      onError?.(error);
    },
  });
}

export function useUpdateCollection(
  collectionId: string,
  { onError }: CollectionCommandOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof updateCollectionMutation>>,
    Error,
    UpdateCollectionMutation,
    CacheSnapshot
  >({
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
  });
}

export function useDeleteCollection(
  collectionId: string,
  { onError }: CollectionCommandOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof deleteCollectionMutation>>,
    Error,
    DeleteCollectionMutation,
    CacheSnapshot
  >({
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
  });
}

/**
 * Copies run online only and have no optimistic state: the new collection's
 * contents come from the server. Callers navigate in `onSuccess`.
 */
export function useCopyCollection({
  onError,
  onSuccess,
}: CollectionCommandOptions & {
  onSuccess?: (result: { id: string }) => void | Promise<void>;
} = {}) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof copyCollectionMutation>>,
    Error,
    CopyCollectionMutation
  >({
    mutationKey: collectionMutationKeys.copy,
    mutationFn: copyCollectionMutation,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.all,
        exact: true,
      });
      await onSuccess?.(result);
    },
    onError,
  });
}
