'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import editStyles from '@/components/EditCollectionDialog/EditCollectionDialog.module.css';
import { useToast } from '@/components/ToastNotification';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { errorMessage } from '@/i18n/apiError';
import { useTranslation } from '@/i18n/client';
import type { CollectionDetail } from '@/lib/collections/repository';
import { useCopyCollection } from '@/lib/commands/collections/hooks';

export function NeonCopyCollectionDialog({
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
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const [name, setName] = useState(
    t('dialogs.copy.defaultName', { name: detail.collection.name }),
  );
  const [error, setError] = useState<string | null>(null);
  const copyCollection = useCopyCollection({
    onSuccess: ({ id }) => {
      showToast({
        title: t('dialogs.copy.copiedTitle'),
        description: t('dialogs.copy.copiedDescription'),
        variant: 'success',
      });
      onOpenChange(false);
      router.push(`/collections/${id}`);
    },
    onError: (mutationError) => setError(errorMessage(t, mutationError)),
  });

  useEffect(() => {
    if (!open) return;
    setName(
      t('dialogs.copy.defaultName', { name: detail.collection.name }).slice(
        0,
        200,
      ),
    );
    setError(null);
    copyCollection.reset();
  }, [open, detail.collection.name, copyCollection.reset, t]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online || copyCollection.isPending) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('dialogs.copy.nameRequired'));
      return;
    }
    copyCollection.mutate({
      collectionId: detail.collection.id,
      mutationId: crypto.randomUUID(),
      name: trimmedName,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={editStyles.overlay} />
        <Dialog.Content className={editStyles.content}>
          <Dialog.Title className={editStyles.title}>
            {t('dialogs.copy.title')}
          </Dialog.Title>
          <Dialog.Description className={editStyles.description}>
            {t('dialogs.copy.description')}
          </Dialog.Description>

          <form className={editStyles.form} onSubmit={submit}>
            <div className={editStyles.inputGroup}>
              <label htmlFor="neon-copy-name" className={editStyles.label}>
                {t('dialogs.copy.nameLabel')}
              </label>
              <input
                id="neon-copy-name"
                className={editStyles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
              />
              <span className={editStyles.helperText}>
                {t('dialogs.copy.helper')}
              </span>
            </div>

            {!online && (
              <div className={editStyles.error}>
                {t('dialogs.copy.offline')}
              </div>
            )}
            {error && <div className={editStyles.error}>{error}</div>}

            <div className={editStyles.actions}>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-secondary">
                  {t('dialogs.common.cancel')}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!online || !name.trim() || copyCollection.isPending}
              >
                {copyCollection.isPending
                  ? t('dialogs.copy.copying')
                  : t('dialogs.copy.submit')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
