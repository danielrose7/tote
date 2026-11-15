'use client';

import { useUser } from '@clerk/nextjs';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ToastNotification';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { errorMessage } from '@/i18n/apiError';
import { useFormat, useTranslation } from '@/i18n/client';
import {
  fetchCollectionPublication,
  type PublishCollectionMutation,
  type UnpublishCollectionMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import type { CollectionDetail } from '@/lib/collections/repository';
import { slugify } from '@/lib/slugify';
import styles from './NeonPublicationDialog.module.css';

export function NeonPublicationDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: CollectionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { user } = useUser();
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const { collection } = detail;
  const canUseFriendlyUrl =
    user?.id === collection.ownerUserId && Boolean(user.username);
  const { data: publication, isLoading } = useQuery({
    queryKey: collectionQueryKeys.publication(collection.id),
    queryFn: () => fetchCollectionPublication(collection.id),
    enabled: open,
  });
  const [slug, setSlug] = useState(slugify(collection.name));
  const [layout, setLayout] = useState<'minimal' | 'feature'>(
    collection.publicLayout,
  );
  const [allowCloning, setAllowCloning] = useState(
    collection.copyPolicy === 'public',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlug(publication?.slug ?? slugify(collection.name));
    setLayout(publication?.layout ?? collection.publicLayout);
    setAllowCloning(publication?.allowCloning ?? true);
    setError(null);
  }, [open, publication, collection.name, collection.publicLayout]);

  const publish = useMutation<
    NonNullable<typeof publication>,
    Error,
    PublishCollectionMutation
  >({
    mutationKey: collectionMutationKeys.publish,
    onSuccess: () => {
      setError(null);
      showToast({
        title: publication
          ? t('dialogs.publication.replacedTitle')
          : t('dialogs.publication.publishedTitle'),
        description: t('dialogs.publication.publishedDescription'),
        variant: 'success',
      });
    },
    onError: (mutationError) => setError(errorMessage(t, mutationError)),
  });
  const unpublish = useMutation<
    { unpublished: true },
    Error,
    UnpublishCollectionMutation
  >({
    mutationKey: collectionMutationKeys.unpublish,
    onSuccess: () => {
      showToast({
        title: t('dialogs.publication.unpublishedTitle'),
        description: t('dialogs.publication.unpublishedDescription'),
        variant: 'success',
      });
      onOpenChange(false);
    },
    onError: (mutationError) => setError(errorMessage(t, mutationError)),
  });

  const publicUrl =
    typeof window !== 'undefined' && publication
      ? publication.username
        ? `${window.location.origin}/s/${publication.username}/${publication.slug}`
        : `${window.location.origin}/view/${publication.id}`
      : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online) return;
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) {
      setError(t('dialogs.publication.slugRequired'));
      return;
    }
    publish.mutate({
      collectionId: collection.id,
      input: {
        slug: normalizedSlug,
        layout,
        allowCloning,
      },
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.heading}>
            <div>
              <Dialog.Title className={styles.title}>
                {t('dialogs.publication.title')}
              </Dialog.Title>
              <Dialog.Description className={styles.description}>
                {t('dialogs.publication.description')}
              </Dialog.Description>
            </div>
            <Dialog.Close className={styles.closeButton}>
              {t('dialogs.common.close')}
            </Dialog.Close>
          </div>

          {isLoading ? (
            <p className={styles.muted}>{t('dialogs.publication.loading')}</p>
          ) : (
            <form className={styles.form} onSubmit={submit}>
              {publication && (
                <div
                  className={`${styles.status} ${
                    publication.hasUnpublishedChanges
                      ? styles.statusChanged
                      : styles.statusCurrent
                  }`}
                >
                  <time
                    dateTime={publication.updatedAt.toISOString()}
                    title={fmt.dateTime(publication.updatedAt)}
                  >
                    {publication.hasUnpublishedChanges
                      ? t('dialogs.publication.publishedEdited', {
                          time: fmt.relativeTime(publication.updatedAt),
                        })
                      : t('dialogs.publication.published', {
                          time: fmt.relativeTime(publication.updatedAt),
                        })}
                  </time>
                </div>
              )}

              <label>
                {t('dialogs.publication.slugLabel')}
                <div className={styles.slugRow}>
                  <span>
                    {canUseFriendlyUrl
                      ? `/s/${user.username}/`
                      : '/view/[publication-id]'}
                  </span>
                  <input
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    maxLength={120}
                  />
                </div>
              </label>

              <label>
                {t('dialogs.publication.layout')}
                <select
                  value={layout}
                  onChange={(event) =>
                    setLayout(event.target.value as 'minimal' | 'feature')
                  }
                >
                  <option value="minimal">
                    {t('dialogs.publication.layoutMinimal')}
                  </option>
                  <option value="feature">
                    {t('dialogs.publication.layoutFeature')}
                  </option>
                </select>
              </label>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={allowCloning}
                  onChange={(event) => setAllowCloning(event.target.checked)}
                />
                {t('dialogs.publication.allowCloning')}
              </label>

              {publicUrl && (
                <div className={styles.linkRow}>
                  <input
                    readOnly
                    value={publicUrl}
                    aria-label={t('dialogs.publication.urlAria')}
                  />
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    {t('dialogs.publication.open')}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(publicUrl)}
                  >
                    {t('dialogs.publication.copy')}
                  </button>
                </div>
              )}

              {!online && (
                <p className={styles.notice}>
                  {t('dialogs.publication.offline')}
                </p>
              )}
              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.actions}>
                {publication && (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={!online || unpublish.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          t('dialogs.publication.confirmUnpublish'),
                        )
                      ) {
                        unpublish.mutate({ collectionId: collection.id });
                      }
                    }}
                  >
                    {t('dialogs.publication.unpublish')}
                  </button>
                )}
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={!online || publish.isPending}
                >
                  {publish.isPending
                    ? t('dialogs.publication.publishing')
                    : publication
                      ? t('dialogs.publication.replace')
                      : t('dialogs.publication.publish')}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
