'use client';

import { useUser } from '@clerk/nextjs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import dialogStyles from '@/components/CreateCollectionDialog/CreateCollectionDialog.module.css';
import { ExtractionTip } from '@/components/ExtractionTip/ExtractionTip';
import { NeonSectionSelector } from '@/components/NeonSectionSelector/NeonSectionSelector';
import { useToast } from '@/components/ToastNotification';
import type { CollectionNode } from '@/db/schema';
import { errorMessage } from '@/i18n/apiError';
import { useTranslation } from '@/i18n/client';
import type { CollectionDetail } from '@/lib/collections/repository';
import { useCreateItem } from '@/lib/commands/items/hooks';
import {
  checkExtensionAvailable,
  type ExtractedMetadata,
  refreshViaExtension,
} from '@/lib/extension';
import {
  isExtractionHintSnoozed,
  needsEnhancedExtraction,
} from '@/lib/extractionHint';
import styles from './NeonCreateNodeDialog.module.css';

const nodeTypes = [
  'product',
  'link',
  'photo',
  'note',
  'text',
  'section',
] as const;
type NodeType = (typeof nodeTypes)[number];

/** Wait this long after the URL stops changing before reading the page. */
const AUTO_FETCH_DELAY_MS = 700;

type AutoFillable = 'title' | 'imageUrl' | 'description' | 'price';

function parseFetchableUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Skip half-typed hosts like "https://amaz" so we don't read junk pages.
    if (!parsed.hostname.includes('.')) return null;
    return parsed;
  } catch {
    return null;
  }
}

const NODE_TYPE_LABEL = {
  product: 'dialogs.createNode.types.product',
  link: 'dialogs.createNode.types.link',
  photo: 'dialogs.createNode.types.photo',
  note: 'dialogs.createNode.types.note',
  text: 'dialogs.createNode.types.text',
  section: 'dialogs.createNode.types.section',
} as const satisfies Record<NodeType, string>;

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
  const [type, setType] = useState<NodeType>('product');
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [showExtractionTip, setShowExtractionTip] = useState(false);
  // Values we filled in from a page read. A later read may replace these, but
  // never anything the user typed themselves.
  const autoFilledRef = useRef<Partial<Record<AutoFillable, string>>>({});
  // Only the newest read may write to the form; older ones are discarded.
  const fetchSeqRef = useRef(0);
  const lastFetchedUrlRef = useRef<string | null>(null);

  const fillFromPage = (
    field: AutoFillable,
    value: string | undefined,
    setter: (update: (prev: string) => string) => void,
  ) => {
    if (!value) return;
    setter((prev) => {
      if (prev && prev !== autoFilledRef.current[field]) return prev;
      autoFilledRef.current[field] = value;
      return value;
    });
  };

  const handleFetchUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!parseFetchableUrl(trimmed)) {
      setError(t('dialogs.createNode.invalidUrl'));
      return;
    }
    const seq = ++fetchSeqRef.current;
    lastFetchedUrlRef.current = trimmed;
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
      if (seq !== fetchSeqRef.current) return;
      fillFromPage('title', metadata.title, setTitle);
      fillFromPage('imageUrl', metadata.imageUrl, setImageUrl);
      fillFromPage('description', metadata.description, setDescription);
      fillFromPage('price', metadata.price, setPrice);
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
      if (seq !== fetchSeqRef.current) return;
      // Let the user retry the same URL with the Fetch button.
      lastFetchedUrlRef.current = null;
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : t('dialogs.createNode.readFailed'),
      );
    } finally {
      if (seq === fetchSeqRef.current) setIsFetchingUrl(false);
    }
  };

  // Read the page as soon as a complete URL is typed or pasted, so name,
  // picture and price fill in without pressing Fetch.
  const handleFetchUrlRef = useRef(handleFetchUrl);
  handleFetchUrlRef.current = handleFetchUrl;
  const canAutoFetch = open && (type === 'product' || type === 'link');
  // While reading, empty fields (or ones we filled earlier) are about to change.
  const pendingClass = (value: string, field: AutoFillable) =>
    isFetchingUrl && (!value || value === autoFilledRef.current[field])
      ? ` ${styles.pending}`
      : '';
  useEffect(() => {
    if (!canAutoFetch) return;
    const trimmed = url.trim();
    if (!parseFetchableUrl(trimmed)) return;
    if (trimmed === lastFetchedUrlRef.current) return;
    const timer = setTimeout(
      () => void handleFetchUrlRef.current(),
      AUTO_FETCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [url, canAutoFetch]);

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

  const createNode = useCreateItem(detail.collection.id, {
    onError: (mutationError) => {
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
        addedVia: 'app',
      };
      setExtraSections((prev) => [...prev, optimisticSection]);
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
    [detail.collection.id, user?.id, createNode],
  );

  const reset = () => {
    setType('product');
    setTitle('');
    setParentId('');
    setUrl('');
    setShowExtractionTip(false);
    setImageUrl('');
    setDescription('');
    setPrice('');
    setBody('');
    setError(null);
    setExtraSections([]);
    setIsFetchingUrl(false);
    autoFilledRef.current = {};
    fetchSeqRef.current += 1;
    lastFetchedUrlRef.current = null;
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
    if (type === 'product' && price.trim()) properties.price = price.trim();
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
                className={`${dialogStyles.input}${
                  type === 'product' || type === 'link'
                    ? pendingClass(title, 'title')
                    : ''
                }`}
                aria-busy={isFetchingUrl}
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
                {isFetchingUrl && (
                  <output className={styles.fetchStatus}>
                    <span className={styles.spinner} aria-hidden="true" />
                    {t('dialogs.createNode.readingPage')}
                  </output>
                )}
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
                  className={`${dialogStyles.input}${
                    type === 'product' ? pendingClass(imageUrl, 'imageUrl') : ''
                  }`}
                />
                {parseFetchableUrl(imageUrl) && (
                  <img
                    src={imageUrl.trim()}
                    alt=""
                    style={{
                      marginTop: '8px',
                      maxHeight: '120px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '6px',
                    }}
                  />
                )}
              </div>
            )}

            {type === 'product' && (
              <div className={dialogStyles.inputGroup}>
                <label htmlFor="neon-node-price" className={dialogStyles.label}>
                  {t('dialogs.createNode.price')}
                </label>
                <input
                  id="neon-node-price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className={`${dialogStyles.input}${pendingClass(price, 'price')}`}
                  inputMode="decimal"
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
                  className={`${dialogStyles.textarea}${
                    type === 'photo'
                      ? ''
                      : pendingClass(description, 'description')
                  }`}
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
