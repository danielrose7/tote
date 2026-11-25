'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createItemOptions,
  deleteItemOptions,
  type ItemCommandOptions,
  reorderItemsOptions,
  updateItemOptions,
} from './mutations';

/**
 * Item commands for one collection as React hooks. The mutation options live
 * in `mutations.ts` so non-React callers (WebMCP tools) share them; callers
 * here only add what is specific to them, usually a toast via `onError`.
 */

export type { ItemCommandOptions };

export function useCreateItem(
  collectionId: string,
  options: ItemCommandOptions = {},
) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  return useMutation(
    createItemOptions(queryClient, collectionId, {
      ...options,
      createdByUserId: user?.id ?? '',
    }),
  );
}

export function useUpdateItem(
  collectionId: string,
  options: ItemCommandOptions = {},
) {
  return useMutation(
    updateItemOptions(useQueryClient(), collectionId, options),
  );
}

export function useDeleteItem(
  collectionId: string,
  options: ItemCommandOptions = {},
) {
  return useMutation(
    deleteItemOptions(useQueryClient(), collectionId, options),
  );
}

export function useReorderItems(
  collectionId: string,
  options: ItemCommandOptions = {},
) {
  return useMutation(
    reorderItemsOptions(useQueryClient(), collectionId, options),
  );
}
