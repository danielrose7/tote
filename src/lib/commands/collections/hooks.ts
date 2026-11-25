'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type CopyCollectionMutation,
  copyCollectionMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import {
  type CollectionCommandOptions,
  createCollectionOptions,
  deleteCollectionOptions,
  updateCollectionOptions,
} from './mutations';

/**
 * Collection commands as React hooks: add, update, delete and copy. The
 * mutation options live in `mutations.ts` so non-React callers share them;
 * callers here only add what is specific to them, usually a toast.
 */

export type { CollectionCommandOptions };

export function useCreateCollection(options: CollectionCommandOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  return useMutation(
    createCollectionOptions(queryClient, {
      ...options,
      ownerUserId: user?.id ?? '',
    }),
  );
}

export function useUpdateCollection(
  collectionId: string,
  options: CollectionCommandOptions = {},
) {
  return useMutation(
    updateCollectionOptions(useQueryClient(), collectionId, options),
  );
}

export function useDeleteCollection(
  collectionId: string,
  options: CollectionCommandOptions = {},
) {
  return useMutation(
    deleteCollectionOptions(useQueryClient(), collectionId, options),
  );
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
