'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type CreateCollectionNodeMutation,
  createCollectionNodeMutation,
  type DeleteCollectionNodeMutation,
  deleteCollectionNodeMutation,
  type ReorderCollectionNodesMutation,
  reorderCollectionNodesMutation,
  type UpdateCollectionNodeMutation,
  updateCollectionNodeMutation,
} from '@/lib/collections/client';
import { collectionMutationKeys } from '@/lib/collections/queryKeys';
import {
  applyOptimistic,
  type CacheSnapshot,
  rollbackOptimistic,
} from '../optimistic';
import {
  createNodeUpdate,
  deleteNodeUpdate,
  reorderNodesUpdate,
  updateNodeUpdate,
} from './cache';

/**
 * Item commands for one collection: add, update, delete and reorder nodes.
 *
 * Each hook owns the whole optimistic lifecycle (cancel in-flight reads,
 * snapshot, apply the shared cache update, roll back and refetch on error).
 * Callers only add what is specific to them, usually a toast via `onError`.
 *
 * All item commands for a collection share one mutation scope, so they reach
 * the server in the order they were issued, including after a paused
 * (offline) mutation resumes. `providers.tsx` registers the matching
 * `mutationFn` and post-settle invalidation for each key, which is what lets
 * persisted mutations resume after a reload.
 */

export type ItemCommandOptions = {
  onError?: (error: Error) => void;
};

function collectionScope(collectionId: string) {
  return { id: `collection:${collectionId}` };
}

export function useCreateItem(
  collectionId: string,
  { onError }: ItemCommandOptions = {},
) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  return useMutation<
    Awaited<ReturnType<typeof createCollectionNodeMutation>>,
    Error,
    CreateCollectionNodeMutation,
    CacheSnapshot
  >({
    mutationKey: collectionMutationKeys.createNode,
    mutationFn: createCollectionNodeMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        createNodeUpdate(variables, {
          createdByUserId: user?.id ?? '',
          now: new Date(),
        }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  });
}

export function useUpdateItem(
  collectionId: string,
  { onError }: ItemCommandOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof updateCollectionNodeMutation>>,
    Error,
    UpdateCollectionNodeMutation,
    CacheSnapshot
  >({
    mutationKey: collectionMutationKeys.updateNode,
    mutationFn: updateCollectionNodeMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        updateNodeUpdate(variables, { now: new Date() }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  });
}

export function useDeleteItem(
  collectionId: string,
  { onError }: ItemCommandOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof deleteCollectionNodeMutation>>,
    Error,
    DeleteCollectionNodeMutation,
    CacheSnapshot
  >({
    mutationKey: collectionMutationKeys.deleteNode,
    mutationFn: deleteCollectionNodeMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, (detail) =>
        deleteNodeUpdate(variables, {
          now: new Date(),
          nodes: detail?.nodes ?? [],
        }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  });
}

export function useReorderItems(
  collectionId: string,
  { onError }: ItemCommandOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof reorderCollectionNodesMutation>>,
    Error,
    ReorderCollectionNodesMutation,
    CacheSnapshot
  >({
    mutationKey: collectionMutationKeys.reorderNodes,
    mutationFn: reorderCollectionNodesMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        reorderNodesUpdate(variables, { now: new Date() }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  });
}
