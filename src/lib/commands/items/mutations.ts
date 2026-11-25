import type { MutationOptions, QueryClient } from '@tanstack/react-query';
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
 * Mutation options for item commands, shared by the React hooks (`hooks.ts`)
 * and by callers outside React such as WebMCP tools, which run them through a
 * `MutationObserver`. Either way the change gets the same optimistic update,
 * rollback and per-collection ordering.
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

type ItemMutationOptions<Data, Variables> = MutationOptions<
  Data,
  Error,
  Variables,
  CacheSnapshot
>;

function collectionScope(collectionId: string) {
  return { id: `collection:${collectionId}` };
}

export function createItemOptions(
  queryClient: QueryClient,
  collectionId: string,
  {
    createdByUserId,
    onError,
  }: ItemCommandOptions & { createdByUserId: string },
): ItemMutationOptions<
  Awaited<ReturnType<typeof createCollectionNodeMutation>>,
  CreateCollectionNodeMutation
> {
  return {
    mutationKey: collectionMutationKeys.createNode,
    mutationFn: createCollectionNodeMutation,
    scope: collectionScope(collectionId),
    onMutate: (variables) =>
      applyOptimistic(queryClient, collectionId, () =>
        createNodeUpdate(variables, { createdByUserId, now: new Date() }),
      ),
    onError: (error, _variables, snapshot) => {
      rollbackOptimistic(queryClient, collectionId, snapshot);
      onError?.(error);
    },
  };
}

export function updateItemOptions(
  queryClient: QueryClient,
  collectionId: string,
  { onError }: ItemCommandOptions = {},
): ItemMutationOptions<
  Awaited<ReturnType<typeof updateCollectionNodeMutation>>,
  UpdateCollectionNodeMutation
> {
  return {
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
  };
}

export function deleteItemOptions(
  queryClient: QueryClient,
  collectionId: string,
  { onError }: ItemCommandOptions = {},
): ItemMutationOptions<
  Awaited<ReturnType<typeof deleteCollectionNodeMutation>>,
  DeleteCollectionNodeMutation
> {
  return {
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
  };
}

export function reorderItemsOptions(
  queryClient: QueryClient,
  collectionId: string,
  { onError }: ItemCommandOptions = {},
): ItemMutationOptions<
  Awaited<ReturnType<typeof reorderCollectionNodesMutation>>,
  ReorderCollectionNodesMutation
> {
  return {
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
  };
}
