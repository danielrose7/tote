'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import editStyles from '@/components/EditCollectionDialog/EditCollectionDialog.module.css';
import { NeonSectionSelector } from '@/components/NeonSectionSelector/NeonSectionSelector';
import { useToast } from '@/components/ToastNotification';
import type { CollectionNode } from '@/db/schema';
import { errorMessage } from '@/i18n/apiError';
import { useTranslation } from '@/i18n/client';
import type { CollectionDetail } from '@/lib/collections/repository';
import {
  useCreateItem,
  useDeleteItem,
  useUpdateItem,
} from '@/lib/commands/items/hooks';

const EDIT_TITLE = {
  section: 'dialogs.editNode.title.section',
  product: 'dialogs.editNode.title.product',
  link: 'dialogs.editNode.title.link',
  photo: 'dialogs.editNode.title.photo',
  note: 'dialogs.editNode.title.note',
  text: 'dialogs.editNode.title.text',
} as const satisfies Record<CollectionNode['type'], string>;

const DELETE_LABEL = {
  section: 'dialogs.editNode.delete.section',
  product: 'dialogs.editNode.delete.product',
  link: 'dialogs.editNode.delete.link',
  photo: 'dialogs.editNode.delete.photo',
  note: 'dialogs.editNode.delete.note',
  text: 'dialogs.editNode.delete.text',
} as const satisfies Record<CollectionNode['type'], string>;

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
  const { t } = useTranslation();
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

  const updateNode = useUpdateItem(detail.collection.id, {
    onError: (mutationError) => {
      setError(errorMessage(t, mutationError));
      showToast({
        title: t('dialogs.editNode.updateFailed'),
        description: errorMessage(t, mutationError),
        variant: 'error',
      });
    },
  });

  const deleteNode = useDeleteItem(detail.collection.id, {
    onError: (mutationError) => {
      showToast({
        title: t('dialogs.editNode.deleteFailed'),
        description: errorMessage(t, mutationError),
        variant: 'error',
      });
    },
  });

  // Rejections reach the section selector, which reports them itself.
  const createSection = useCreateItem(detail.collection.id);

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
        addedVia: 'app',
      };
      setExtraSections((prev) => [...prev, optimisticSection]);
      await createSection.mutateAsync({
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
    [detail.collection.id, createSection],
  );

  if (!node) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('dialogs.editNode.titleRequired'));
      return;
    }
    if ((node.type === 'product' || node.type === 'link') && !url.trim()) {
      setError(t('dialogs.editNode.urlRequired'));
      return;
    }
    if (node.type === 'photo' && !imageUrl.trim()) {
      setError(t('dialogs.editNode.imageRequired'));
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
            {t(EDIT_TITLE[node.type])}
          </Dialog.Title>
          <Dialog.Description className={editStyles.description}>
            {t('dialogs.editNode.description')}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className={editStyles.form}>
            <div className={editStyles.inputGroup}>
              <label
                htmlFor="neon-edit-node-title"
                className={editStyles.label}
              >
                {t('dialogs.editNode.titleLabel')}
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
                <label className={editStyles.label}>
                  {t('dialogs.editNode.section')}
                </label>
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
                  {t('dialogs.editNode.url')}
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
                  {node.type === 'photo'
                    ? t('dialogs.editNode.imageUrlRequired')
                    : t('dialogs.editNode.imageUrl')}
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
                  {t('dialogs.editNode.descriptionLabel')}
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
                  {t('dialogs.editNode.body')}
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
                      ? t('dialogs.editNode.confirmSection')
                      : t('dialogs.editNode.confirmBlock')}
                  </p>
                  <div className={editStyles.deleteConfirmActions}>
                    <button
                      type="button"
                      className={editStyles.deleteConfirmCancel}
                      onClick={() => setDeleteOpen(false)}
                    >
                      {t('dialogs.common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="btn btn-danger"
                      autoFocus
                    >
                      {t(DELETE_LABEL[node.type])}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={editStyles.deleteTrigger}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t(DELETE_LABEL[node.type])}
                </button>
              )}
            </div>

            <div className={editStyles.actions}>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-secondary">
                  {t('dialogs.common.cancel')}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!title.trim()}
              >
                {t('dialogs.common.saveChanges')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
