'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import editStyles from '@/components/EditCollectionDialog/EditCollectionDialog.module.css';
import { NeonSectionSelector } from '@/components/NeonSectionSelector/NeonSectionSelector';
import { useToast } from '@/components/ToastNotification';
import type { CollectionNode } from '@/db/schema';
import {
  createCollectionNodeMutation,
  type DeleteCollectionNodeMutation,
  deleteCollectionNodeMutation,
  type UpdateCollectionNodeMutation,
  updateCollectionNodeMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';

const itemNodeTypes = new Set<CollectionNode['type']>([
  'product',
  'link',
  'photo',
]);

type MutationContext = {
  previousDetail: CollectionDetail | undefined;
  previousSummaries: CollectionSummary[] | undefined;
};

function descendantIds(nodes: CollectionNode[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let foundChild = true;
  while (foundChild) {
    foundChild = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        foundChild = true;
      }
    }
  }
  return ids;
}

export function NeonEditNodeDialog({
  detail,
  node,
  open,
  onOpenChange,
}: {
  detail: CollectionDetail;
  node: CollectionNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraSections, setExtraSections] = useState<CollectionNode[]>([]);
  const baseSections = detail.nodes.filter(
    (candidate) => candidate.type === 'section' && candidate.id !== node?.id,
  );
  const sections = [
    ...baseSections,
    ...extraSections.filter((s) => !baseSections.some((b) => b.id === s.id)),
  ];

  useEffect(() => {
    if (!open || !node) return;
    const properties = node.properties as Record<string, unknown>;
    setTitle(node.title ?? '');
    setParentId(node.parentId ?? '');
    setUrl(typeof properties.url === 'string' ? properties.url : '');
    setImageUrl(
      typeof properties.imageUrl === 'string' ? properties.imageUrl : '',
    );
    setDescription(
      typeof properties.description === 'string' ? properties.description : '',
    );
    setBody(typeof properties.body === 'string' ? properties.body : '');
    setDeleteOpen(false);
    setError(null);
  }, [open, node]);

  const updateNode = useMutation<
    {
      version: number;
      collectionVersion: number;
      itemCount: number;
      replayed: boolean;
    },
    Error,
    UpdateCollectionNodeMutation,
    MutationContext
  >({
    mutationKey: collectionMutationKeys.updateNode,
    mutationFn: updateCollectionNodeMutation,
    scope: { id: `collection:${detail.collection.id}` },
    onMutate: async ({ nodeId, input }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: collectionQueryKeys.detail(detail.collection.id),
        }),
        queryClient.cancelQueries({ queryKey: collectionQueryKeys.all }),
      ]);
      const previousDetail = queryClient.getQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
      );
      const previousSummaries = queryClient.getQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
      );
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
        (current) =>
          current
            ? {
                ...current,
                collection: {
                  ...current.collection,
                  version: current.collection.version + 1,
                  updatedAt: new Date(),
                },
                nodes: current.nodes.map((candidate) =>
                  candidate.id === nodeId
                    ? {
                        ...candidate,
                        parentId:
                          input.parentId === undefined
                            ? candidate.parentId
                            : input.parentId,
                        title:
                          input.title === undefined
                            ? candidate.title
                            : input.title,
                        properties: input.properties ?? candidate.properties,
                        positionKey: input.positionKey ?? candidate.positionKey,
                        version: candidate.version + 1,
                        updatedAt: new Date(),
                      }
                    : candidate,
                ),
              }
            : current,
      );
      return { previousDetail, previousSummaries };
    },
    onError: (mutationError, _variables, context) => {
      queryClient.setQueryData(
        collectionQueryKeys.detail(detail.collection.id),
        context?.previousDetail,
      );
      queryClient.setQueryData(
        collectionQueryKeys.all,
        context?.previousSummaries,
      );
      setError(mutationError.message);
      showToast({
        title: 'Content update failed',
        description: mutationError.message,
        variant: 'error',
      });
    },
  });

  const deleteNode = useMutation<
    {
      deletedNodeCount: number;
      collectionVersion: number;
      itemCount: number;
      replayed: boolean;
    },
    Error,
    DeleteCollectionNodeMutation,
    MutationContext
  >({
    mutationKey: collectionMutationKeys.deleteNode,
    mutationFn: deleteCollectionNodeMutation,
    scope: { id: `collection:${detail.collection.id}` },
    onMutate: async ({ nodeId }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: collectionQueryKeys.detail(detail.collection.id),
        }),
        queryClient.cancelQueries({ queryKey: collectionQueryKeys.all }),
      ]);
      const previousDetail = queryClient.getQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
      );
      const previousSummaries = queryClient.getQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
      );
      const removedIds = descendantIds(detail.nodes, nodeId);
      const removedItemCount = detail.nodes.filter(
        (candidate) =>
          removedIds.has(candidate.id) && itemNodeTypes.has(candidate.type),
      ).length;
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
        (current) =>
          current
            ? {
                ...current,
                collection: {
                  ...current.collection,
                  itemCount: Math.max(
                    0,
                    current.collection.itemCount - removedItemCount,
                  ),
                  version: current.collection.version + removedIds.size,
                  updatedAt: new Date(),
                },
                nodes: current.nodes.filter(
                  (candidate) => !removedIds.has(candidate.id),
                ),
              }
            : current,
      );
      queryClient.setQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
        (current) =>
          current?.map((summary) =>
            summary.id === detail.collection.id
              ? {
                  ...summary,
                  itemCount: Math.max(0, summary.itemCount - removedItemCount),
                  updatedAt: new Date(),
                }
              : summary,
          ),
      );
      return { previousDetail, previousSummaries };
    },
    onError: (mutationError, _variables, context) => {
      queryClient.setQueryData(
        collectionQueryKeys.detail(detail.collection.id),
        context?.previousDetail,
      );
      queryClient.setQueryData(
        collectionQueryKeys.all,
        context?.previousSummaries,
      );
      showToast({
        title: 'Content deletion failed',
        description: mutationError.message,
        variant: 'error',
      });
    },
  });

  const handleCreateSection = useCallback(
    async (name: string): Promise<string> => {
      const nodeId = crypto.randomUUID();
      const now = new Date();
      const optimisticSection: CollectionNode = {
        id: nodeId,
        collectionId: detail.collection.id,
        parentId: null,
        type: 'section',
        title: name,
        properties: {},
        positionKey: `${now.toISOString()}:${nodeId}`,
        version: 1,
        createdByUserId: '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      setExtraSections((prev) => [...prev, optimisticSection]);
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
        (current) =>
          current
            ? { ...current, nodes: [...current.nodes, optimisticSection] }
            : current,
      );
      await createCollectionNodeMutation({
        collectionId: detail.collection.id,
        input: {
          id: nodeId,
          mutationId: crypto.randomUUID(),
          type: 'section',
          title: name,
          parentId: null,
          properties: {},
          positionKey: optimisticSection.positionKey,
        },
      });
      return nodeId;
    },
    [detail.collection.id, queryClient],
  );

  if (!node) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('A title is required');
      return;
    }
    if ((node.type === 'product' || node.type === 'link') && !url.trim()) {
      setError('A URL is required for products and links');
      return;
    }
    if (node.type === 'photo' && !imageUrl.trim()) {
      setError('An image URL is required for photos');
      return;
    }

    const properties = { ...node.properties } as Record<string, unknown>;
    for (const key of ['url', 'imageUrl', 'description', 'body']) {
      delete properties[key];
    }
    if (url.trim()) properties.url = url.trim();
    if (imageUrl.trim()) properties.imageUrl = imageUrl.trim();
    if (description.trim()) properties.description = description.trim();
    if (body.trim()) properties.body = body.trim();

    updateNode.mutate({
      collectionId: detail.collection.id,
      nodeId: node.id,
      input: {
        expectedVersion: node.version,
        mutationId: crypto.randomUUID(),
        title: trimmedTitle,
        parentId: node.type === 'section' ? null : parentId || null,
        properties,
      },
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteNode.mutate({
      collectionId: detail.collection.id,
      nodeId: node.id,
      input: {
        expectedVersion: node.version,
        mutationId: crypto.randomUUID(),
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={editStyles.overlay} />
        <Dialog.Content className={editStyles.content}>
          <Dialog.Title className={editStyles.title}>
            Edit {node.type}
          </Dialog.Title>
          <Dialog.Description className={editStyles.description}>
            Update or move this collection block.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className={editStyles.form}>
            <div className={editStyles.inputGroup}>
              <label
                htmlFor="neon-edit-node-title"
                className={editStyles.label}
              >
                Title *
              </label>
              <input
                id="neon-edit-node-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={editStyles.input}
                maxLength={500}
              />
            </div>

            {node.type !== 'section' && (
              <div className={editStyles.inputGroup}>
                <label className={editStyles.label}>Section</label>
                <NeonSectionSelector
                  value={parentId || null}
                  onChange={(id) => setParentId(id ?? '')}
                  sections={sections}
                  onCreateSection={handleCreateSection}
                />
              </div>
            )}

            {(node.type === 'product' || node.type === 'link') && (
              <div className={editStyles.inputGroup}>
                <label
                  htmlFor="neon-edit-node-url"
                  className={editStyles.label}
                >
                  URL *
                </label>
                <input
                  id="neon-edit-node-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className={editStyles.input}
                />
              </div>
            )}

            {(node.type === 'product' || node.type === 'photo') && (
              <div className={editStyles.inputGroup}>
                <label
                  htmlFor="neon-edit-node-image"
                  className={editStyles.label}
                >
                  Image URL {node.type === 'photo' ? '*' : ''}
                </label>
                <input
                  id="neon-edit-node-image"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  className={editStyles.input}
                />
              </div>
            )}

            {(node.type === 'product' ||
              node.type === 'link' ||
              node.type === 'photo') && (
              <div className={editStyles.inputGroup}>
                <label
                  htmlFor="neon-edit-node-description"
                  className={editStyles.label}
                >
                  Description
                </label>
                <textarea
                  id="neon-edit-node-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={editStyles.textarea}
                  rows={3}
                />
              </div>
            )}

            {(node.type === 'note' || node.type === 'text') && (
              <div className={editStyles.inputGroup}>
                <label
                  htmlFor="neon-edit-node-body"
                  className={editStyles.label}
                >
                  Body
                </label>
                <textarea
                  id="neon-edit-node-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className={editStyles.textarea}
                  rows={5}
                />
              </div>
            )}

            {error && <div className={editStyles.error}>{error}</div>}

            <div className={editStyles.deleteSection}>
              {deleteOpen ? (
                <div className={editStyles.deleteConfirm}>
                  <p className={editStyles.deleteConfirmText}>
                    {node.type === 'section'
                      ? 'Delete this section and every block inside it? There’s no undo.'
                      : 'Remove this block from the collection? There’s no undo.'}
                  </p>
                  <div className={editStyles.deleteConfirmActions}>
                    <button
                      type="button"
                      className={editStyles.deleteConfirmCancel}
                      onClick={() => setDeleteOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="btn btn-danger"
                      autoFocus
                    >
                      Delete {node.type}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={editStyles.deleteTrigger}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete {node.type}
                </button>
              )}
            </div>

            <div className={editStyles.actions}>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-secondary">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!title.trim()}
              >
                Save Changes
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
