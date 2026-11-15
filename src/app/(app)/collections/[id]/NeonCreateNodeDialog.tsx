'use client';

import { useUser } from '@clerk/nextjs';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import dialogStyles from '@/components/CreateCollectionDialog/CreateCollectionDialog.module.css';
import { ExtractionTip } from '@/components/ExtractionTip/ExtractionTip';
import { NeonSectionSelector } from '@/components/NeonSectionSelector/NeonSectionSelector';
import { useToast } from '@/components/ToastNotification';
import type { CollectionNode } from '@/db/schema';
import { errorMessage } from '@/i18n/apiError';
import { useTranslation } from '@/i18n/client';
import {
  type CreateCollectionNodeMutation,
  createCollectionNodeMutation,
} from '@/lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import {
  checkExtensionAvailable,
  type ExtractedMetadata,
  refreshViaExtension,
} from '@/lib/extension';
import {
  isExtractionHintSnoozed,
  needsEnhancedExtraction,
} from '@/lib/extractionHint';

const nodeTypes = [
  'product',
  'link',
  'photo',
  'note',
  'text',
  'section',
] as const;
type NodeType = (typeof nodeTypes)[number];

const NODE_TYPE_LABEL = {
  product: 'dialogs.createNode.types.product',
  link: 'dialogs.createNode.types.link',
  photo: 'dialogs.createNode.types.photo',
  note: 'dialogs.createNode.types.note',
  text: 'dialogs.createNode.types.text',
  section: 'dialogs.createNode.types.section',
} as const satisfies Record<NodeType, string>;

const itemNodeTypes = new Set<NodeType>(['product', 'link', 'photo']);

type CreateNodeContext = {
  previousDetail: CollectionDetail | undefined;
  previousSummaries: CollectionSummary[] | undefined;
};

export function NeonCreateNodeDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: CollectionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useUser();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<NodeType>('product');
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [showExtractionTip, setShowExtractionTip] = useState(false);

  const handleFetchUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setError(t('dialogs.createNode.invalidUrl'));
      return;
    }
    setIsFetchingUrl(true);
    setError(null);
    setShowExtractionTip(false);
    try {
      // The extension reads the page in the user's browser, which sites that
      // block our servers can't stop, so prefer it when it's installed.
      let metadata: ExtractedMetadata | null = null;
      let usedServer = false;
      if (await checkExtensionAvailable()) {
        metadata = await refreshViaExtension(trimmed, { capture: true });
      }
      if (!metadata) {
        usedServer = true;
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!response.ok) {
          throw new Error(
            t('dialogs.createNode.readFailedStatus', {
              status: response.status,
            }),
          );
        }
        metadata = (await response.json()) as ExtractedMetadata;
      }
      if (metadata.title && !title) setTitle(metadata.title);
      if (metadata.imageUrl && !imageUrl) setImageUrl(metadata.imageUrl);
      if (metadata.description && !description)
        setDescription(metadata.description);
      // Saving stays as before; we only suggest a better route when the
      // server-side read came back thin.
      if (
        usedServer &&
        needsEnhancedExtraction(metadata) &&
        !isExtractionHintSnoozed()
      ) {
        setShowExtractionTip(true);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : t('dialogs.createNode.readFailed'),
      );
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Merge prop sections with any sections created inline during this session
  const [extraSections, setExtraSections] = useState<CollectionNode[]>([]);
  const baseSections = detail.nodes.filter((node) => node.type === 'section');
  const sections = [
    ...baseSections,
    ...extraSections.filter((s) => !baseSections.some((b) => b.id === s.id)),
  ];

  useEffect(() => {
    if (type === 'section') {
      setParentId('');
    }
  }, [type]);

  const createNode = useMutation<
    {
      id: string;
      version: number;
      collectionVersion: number;
      itemCount: number;
      replayed: boolean;
    },
    Error,
    CreateCollectionNodeMutation,
    CreateNodeContext
  >({
    mutationKey: collectionMutationKeys.createNode,
    mutationFn: createCollectionNodeMutation,
    scope: { id: `collection:${detail.collection.id}` },
    onMutate: async ({ input }) => {
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
      const itemDelta = itemNodeTypes.has(input.type) ? 1 : 0;
      const now = new Date();
      const optimisticNode: CollectionNode = {
        id: input.id,
        collectionId: detail.collection.id,
        parentId: input.parentId ?? null,
        type: input.type,
        title: input.title ?? null,
        properties: input.properties ?? {},
        positionKey: input.positionKey,
        version: 1,
        createdByUserId: user?.id ?? '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      queryClient.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(detail.collection.id),
        (current) =>
          current
            ? {
                ...current,
                collection: {
                  ...current.collection,
                  itemCount: current.collection.itemCount + itemDelta,
                  version: current.collection.version + 1,
                  updatedAt: now,
                },
                nodes: [...current.nodes, optimisticNode],
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
                  itemCount: summary.itemCount + itemDelta,
                  updatedAt: now,
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
      setError(errorMessage(t, mutationError));
      showToast({
        title: t('dialogs.createNode.addFailed'),
        description: errorMessage(t, mutationError),
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
        createdByUserId: user?.id ?? '',
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
      createNode.mutate({
        collectionId: detail.collection.id,
        input: {
          id: nodeId,
          mutationId: crypto.randomUUID(),
          type: 'section',
          title: name,
          parentId: null,
          properties: {},
          positionKey: optimisticSection.positionKey,
          addedVia: 'app',
        },
      });
      return nodeId;
    },
    [detail.collection.id, user?.id, queryClient, createNode],
  );

  const reset = () => {
    setType('product');
    setTitle('');
    setParentId('');
    setUrl('');
    setShowExtractionTip(false);
    setImageUrl('');
    setDescription('');
    setBody('');
    setError(null);
    setExtraSections([]);
    setIsFetchingUrl(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('dialogs.createNode.titleRequired'));
      return;
    }
    if ((type === 'product' || type === 'link') && !url.trim()) {
      setError(t('dialogs.createNode.urlRequired'));
      return;
    }
    if (type === 'photo' && !imageUrl.trim()) {
      setError(t('dialogs.createNode.imageRequired'));
      return;
    }

    const nodeId = crypto.randomUUID();
    const properties: Record<string, unknown> = {};
    if (url.trim()) properties.url = url.trim();
    if (imageUrl.trim()) properties.imageUrl = imageUrl.trim();
    if (description.trim()) properties.description = description.trim();
    if (body.trim()) properties.body = body.trim();

    createNode.mutate({
      collectionId: detail.collection.id,
      input: {
        id: nodeId,
        mutationId: crypto.randomUUID(),
        type,
        title: trimmedTitle,
        parentId: type === 'section' ? null : parentId || null,
        properties,
        positionKey: `${new Date().toISOString()}:${nodeId}`,
        addedVia: 'app',
      },
    });
    handleOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogStyles.overlay} />
        <Dialog.Content className={dialogStyles.content}>
          <Dialog.Title className={dialogStyles.title}>
            {t('dialogs.createNode.title')}
          </Dialog.Title>
          <Dialog.Description className={dialogStyles.description}>
            {t('dialogs.createNode.description')}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className={dialogStyles.form}>
            <div className={dialogStyles.inputGroup}>
              <label htmlFor="neon-node-type" className={dialogStyles.label}>
                {t('dialogs.createNode.type')}
              </label>
              <select
                id="neon-node-type"
                value={type}
                onChange={(event) => setType(event.target.value as NodeType)}
                className={dialogStyles.input}
              >
                {nodeTypes.map((nodeType) => (
                  <option key={nodeType} value={nodeType}>
                    {t(NODE_TYPE_LABEL[nodeType])}
                  </option>
                ))}
              </select>
            </div>

            <div className={dialogStyles.inputGroup}>
              <label htmlFor="neon-node-title" className={dialogStyles.label}>
                {t('dialogs.createNode.titleLabel')}
              </label>
              <input
                id="neon-node-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={dialogStyles.input}
                maxLength={500}
              />
            </div>

            {type !== 'section' && (
              <div className={dialogStyles.inputGroup}>
                <label className={dialogStyles.label}>
                  {t('dialogs.createNode.section')}
                </label>
                <NeonSectionSelector
                  value={parentId || null}
                  onChange={(id) => setParentId(id ?? '')}
                  sections={sections}
                  onCreateSection={handleCreateSection}
                />
              </div>
            )}

            {(type === 'product' || type === 'link') && (
              <div className={dialogStyles.inputGroup}>
                <label htmlFor="neon-node-url" className={dialogStyles.label}>
                  {t('dialogs.createNode.url')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="neon-node-url"
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleFetchUrl();
                      }
                    }}
                    className={dialogStyles.input}
                    style={{ flex: 1 }}
                    placeholder={t('dialogs.createNode.urlPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => void handleFetchUrl()}
                    disabled={!url.trim() || isFetchingUrl}
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    {isFetchingUrl
                      ? t('dialogs.createNode.fetching')
                      : t('dialogs.createNode.fetch')}
                  </button>
                </div>
                {showExtractionTip && (
                  <ExtractionTip
                    onDismiss={() => setShowExtractionTip(false)}
                  />
                )}
              </div>
            )}

            {(type === 'product' || type === 'photo') && (
              <div className={dialogStyles.inputGroup}>
                <label htmlFor="neon-node-image" className={dialogStyles.label}>
                  {type === 'photo'
                    ? t('dialogs.createNode.imageUrlRequired')
                    : t('dialogs.createNode.imageUrl')}
                </label>
                <input
                  id="neon-node-image"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  className={dialogStyles.input}
                />
              </div>
            )}

            {(type === 'product' || type === 'link' || type === 'photo') && (
              <div className={dialogStyles.inputGroup}>
                <label
                  htmlFor="neon-node-description"
                  className={dialogStyles.label}
                >
                  {t('dialogs.createNode.descriptionLabel')}
                </label>
                <textarea
                  id="neon-node-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={dialogStyles.textarea}
                  rows={3}
                />
              </div>
            )}

            {(type === 'note' || type === 'text') && (
              <div className={dialogStyles.inputGroup}>
                <label htmlFor="neon-node-body" className={dialogStyles.label}>
                  {t('dialogs.createNode.body')}
                </label>
                <textarea
                  id="neon-node-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className={dialogStyles.textarea}
                  rows={5}
                />
              </div>
            )}

            {error && <div className={dialogStyles.error}>{error}</div>}

            <div className={dialogStyles.actions}>
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
                {t('dialogs.createNode.title')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
