'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import editStyles from '@/components/EditCollectionDialog/EditCollectionDialog.module.css';
import { useToast } from '@/components/ToastNotification';
import { errorMessage } from '@/i18n/apiError';
import { Trans, useTranslation } from '@/i18n/client';
import type {
  DeleteCollectionMutation,
  UpdateCollectionMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';

const presetColors = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
];
type UpdateContext = {
  previousDetail: CollectionDetail | undefined;
  previousSummaries: CollectionSummary[] | undefined;
};

export function NeonEditCollectionDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: CollectionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { collection } = detail;
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? '');
  const [color, setColor] = useState(collection.color ?? presetColors[0]);
  const deletePhrase = t('dialogs.editCollection.deletePhrase');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(collection.name);
    setDescription(collection.description ?? '');
    setColor(collection.color ?? presetColors[0]);
    setDeleteOpen(false);
    setDeleteConfirmation('');
    setError(null);
  }, [open, collection.name, collection.description, collection.color]);

  const updateCollection = useMutation<
    { version: number; replayed: boolean },
    Error,
    UpdateCollectionMutation,
    UpdateContext
  >({
    mutationKey: collectionMutationKeys.update,
    scope: { id: `collection:${collection.id}` },
    onMutate: async ({ input }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: collectionQueryKeys.detail(collection.id),
        }),
        queryClient.cancelQueries({ queryKey: collectionQueryKeys.all }),
      ]);
      const previousDetail = queryClient.getQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collection.id),
      );
      const previousSummaries = queryClient.getQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
      );
      const nextVersion = input.expectedVersion + 1;
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(collection.id),
        (current) =>
          current
            ? {
                ...current,
                collection: {
                  ...current.collection,
                  name: input.name ?? current.collection.name,
                  description:
                    input.description === undefined
                      ? current.collection.description
                      : input.description,
                  color:
                    input.color === undefined
                      ? current.collection.color
                      : input.color,
                  version: nextVersion,
                  updatedAt: new Date(),
                },
              }
            : current,
      );
      queryClient.setQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
        (current) =>
          current?.map((summary) =>
            summary.id === collection.id
              ? {
                  ...summary,
                  name: input.name ?? summary.name,
                  description:
                    input.description === undefined
                      ? summary.description
                      : input.description,
                  color:
                    input.color === undefined ? summary.color : input.color,
                  updatedAt: new Date(),
                }
              : summary,
          ),
      );
      return { previousDetail, previousSummaries };
    },
    onError: (mutationError, _variables, context) => {
      queryClient.setQueryData(
        collectionQueryKeys.detail(collection.id),
        context?.previousDetail,
      );
      queryClient.setQueryData(
        collectionQueryKeys.all,
        context?.previousSummaries,
      );
      setError(errorMessage(t, mutationError));
      showToast({
        title: t('dialogs.editCollection.updateFailed'),
        description: errorMessage(t, mutationError),
        variant: 'error',
      });
    },
  });

  const deleteCollection = useMutation<
    { version: number; replayed: boolean },
    Error,
    DeleteCollectionMutation,
    { previousSummaries: CollectionSummary[] | undefined }
  >({
    mutationKey: collectionMutationKeys.delete,
    scope: { id: `collection:${collection.id}` },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: collectionQueryKeys.all });
      const previousSummaries = queryClient.getQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
      );
      queryClient.setQueryData<CollectionSummary[]>(
        collectionQueryKeys.all,
        (current) => current?.filter((summary) => summary.id !== collection.id),
      );
      return { previousSummaries };
    },
    onError: (mutationError, _variables, context) => {
      queryClient.setQueryData(
        collectionQueryKeys.all,
        context?.previousSummaries,
      );
      showToast({
        title: t('dialogs.editCollection.deleteFailed'),
        description: errorMessage(t, mutationError),
        variant: 'error',
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('dialogs.editCollection.nameRequired'));
      return;
    }
    updateCollection.mutate({
      collectionId: collection.id,
      input: {
        expectedVersion: collection.version,
        mutationId: crypto.randomUUID(),
        name: trimmedName,
        description: description.trim() || null,
        color,
      },
    });
    showToast({
      title: t('dialogs.editCollection.updateQueued'),
      description: navigator.onLine
        ? t('dialogs.editCollection.syncingNow')
        : t('dialogs.editCollection.syncLater'),
      variant: 'success',
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteCollection.mutate({
      collectionId: collection.id,
      input: {
        expectedVersion: collection.version,
        mutationId: crypto.randomUUID(),
      },
    });
    showToast({
      title: t('dialogs.editCollection.deleteQueued'),
      description: navigator.onLine
        ? t('dialogs.editCollection.deletingNow')
        : t('dialogs.editCollection.deleteLater'),
      variant: 'success',
    });
    onOpenChange(false);
    router.push('/collections');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={editStyles.overlay} />
        <Dialog.Content className={editStyles.content}>
          <Dialog.Title className={editStyles.title}>
            {t('dialogs.editCollection.title')}
          </Dialog.Title>
          <Dialog.Description className={editStyles.description}>
            {t('dialogs.editCollection.description')}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className={editStyles.form}>
            <div className={editStyles.inputGroup}>
              <label htmlFor="neon-edit-name" className={editStyles.label}>
                {t('dialogs.editCollection.nameLabel')}
              </label>
              <input
                id="neon-edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={editStyles.input}
                maxLength={200}
              />
            </div>

            <div className={editStyles.inputGroup}>
              <label
                htmlFor="neon-edit-description"
                className={editStyles.label}
              >
                {t('dialogs.editCollection.descriptionLabel')}
              </label>
              <textarea
                id="neon-edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={editStyles.textarea}
                maxLength={2_000}
                rows={3}
              />
            </div>

            <div className={editStyles.inputGroup}>
              <span className={editStyles.label}>
                {t('dialogs.editCollection.color')}
              </span>
              <div className={editStyles.colorPicker}>
                {presetColors.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${editStyles.colorOption} ${
                      color === preset ? editStyles.colorOptionSelected : ''
                    }`}
                    style={{ backgroundColor: preset }}
                    onClick={() => setColor(preset)}
                    aria-label={t('dialogs.editCollection.selectColor', {
                      color: preset,
                    })}
                  />
                ))}
              </div>
            </div>

            {error && <div className={editStyles.error}>{error}</div>}

            {detail.role === 'owner' && (
              <div className={editStyles.deleteSection}>
                {deleteOpen ? (
                  <div className={editStyles.deleteConfirm}>
                    <p className={editStyles.deleteConfirmText}>
                      {t('dialogs.editCollection.deleteWarning')}
                    </p>
                    <div className={editStyles.inputGroup}>
                      <label
                        htmlFor="neon-delete-confirm"
                        className={editStyles.deleteConfirmLabel}
                      >
                        <Trans
                          i18nKey="dialogs.editCollection.typeToConfirm"
                          values={{ phrase: deletePhrase }}
                          components={{ em: <em /> }}
                        />
                      </label>
                      <input
                        id="neon-delete-confirm"
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className={editStyles.input}
                        autoComplete="off"
                      />
                    </div>
                    <div className={editStyles.deleteConfirmActions}>
                      <button
                        type="button"
                        className={editStyles.deleteConfirmCancel}
                        onClick={() => {
                          setDeleteOpen(false);
                          setDeleteConfirmation('');
                        }}
                      >
                        {t('dialogs.common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="btn btn-danger"
                        disabled={
                          deleteConfirmation.toLowerCase() !== deletePhrase
                        }
                      >
                        {t('dialogs.editCollection.sure')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={editStyles.deleteTrigger}
                    onClick={() => setDeleteOpen(true)}
                  >
                    {t('dialogs.editCollection.delete')}
                  </button>
                )}
              </div>
            )}

            <div className={editStyles.actions}>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-secondary">
                  {t('dialogs.common.cancel')}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!name.trim()}
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
