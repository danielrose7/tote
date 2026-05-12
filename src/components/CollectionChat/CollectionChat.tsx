'use client';

import { useChat } from '@ai-sdk/react';
import type { co } from 'jazz-tools';
import { Group } from 'jazz-tools';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMetadata } from '../../app/utils/metadata';
import { Block as BlockSchema, BlockList } from '../../schema';
import type { Block } from '../../schema';
import { useToast } from '../ToastNotification';
import styles from './CollectionChat.module.css';
import {
  CollectionSuggestionCard,
  ProductSuggestionCard,
  type SuggestedCollection,
  type SuggestedProduct,
} from './ProductSuggestionCard';

type LoadedBlock = co.loaded<typeof Block>;

interface CollectionChatProps {
  collection: LoadedBlock | null;
  seedContext?: string;
  onClose?: () => void;
}

interface CollectionContext {
  title: string;
  description?: string;
  curatorSessionId?: string;
  curatorTopic?: string;
  curatorBriefJson?: string;
  items: { title: string; url: string; price?: string }[];
}

function serializeCollection(
  collection: LoadedBlock | null,
): CollectionContext | null {
  if (!collection) return null;
  const items: CollectionContext['items'] = [];
  for (const child of collection.children ?? []) {
    if (!child?.$isLoaded) continue;
    if (child.type === 'product' && child.productData?.url) {
      items.push({
        title: child.name ?? '',
        url: child.productData.url,
        price: child.productData.price ?? undefined,
      });
    } else if (child.type === 'slot') {
      for (const product of child.children ?? []) {
        if (!product?.$isLoaded || !product.productData?.url) continue;
        items.push({
          title: product.name ?? '',
          url: product.productData.url,
          price: product.productData.price ?? undefined,
        });
      }
    }
  }
  return {
    title: collection.name ?? 'Collection',
    description: collection.collectionData?.description ?? undefined,
    curatorSessionId: collection.collectionData?.curatorSessionId ?? undefined,
    curatorTopic: collection.collectionData?.curatorTopic ?? undefined,
    curatorBriefJson: collection.collectionData?.curatorBriefJson ?? undefined,
    items,
  };
}

async function addProductToCollection(
  product: SuggestedProduct,
  collection: LoadedBlock,
): Promise<void> {
  const productUrl = normalizeProductUrl(product.url);
  const imageUrl = normalizeProductUrl(product.imageUrl, productUrl);
  const sharingGroupId = collection.collectionData?.sharingGroupId;
  const ownerGroup = sharingGroupId
    ? await Group.load(sharingGroupId as `co_z${string}`, {})
    : null;

  const group = ownerGroup ?? Group.create({ owner: undefined as never });

  const newBlock = BlockSchema.create(
    {
      type: 'product',
      name: product.title ?? 'Untitled',
      productData: {
        url: productUrl,
        imageUrl: imageUrl ?? undefined,
        price: product.price ?? undefined,
        description: product.description ?? undefined,
      },
      createdAt: new Date(),
    },
    group,
  );

  if (collection.children?.$isLoaded) {
    collection.children.$jazz.push(newBlock);
  } else {
    const list = BlockList.create([newBlock], { owner: group });
    collection.$jazz.set('children', list);
  }
}

function normalizeProductUrl(
  url: string | null | undefined,
  baseUrl?: string,
): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url.startsWith('//') ? `https:${url}` : url;
  }
}

const URL_RE = /https?:\/\/[^\s"')>]+/g;

function isGenericOptionsIntro(text: string): boolean {
  return /^here (are|is) (a few|some|several|the) (options|option|picks|results):?$/i.test(
    text.trim(),
  );
}

function getSuggestedProducts(output: unknown): SuggestedProduct[] {
  if (
    output &&
    typeof output === 'object' &&
    (output as { type?: unknown }).type === 'collection'
  ) {
    return [];
  }
  const products = Array.isArray(output) ? output : [output];
  return products.filter(
    (product): product is SuggestedProduct =>
      Boolean(
        product &&
          typeof product === 'object' &&
          'url' in product &&
          typeof product.url === 'string',
      ),
  );
}

function getSuggestedCollection(output: unknown): SuggestedCollection | null {
  if (
    !output ||
    typeof output !== 'object' ||
    (output as { type?: unknown }).type !== 'collection'
  ) {
    return null;
  }
  const candidate = output as {
    title?: unknown;
    url?: unknown;
    products?: unknown;
  };
  if (typeof candidate.url !== 'string' || !Array.isArray(candidate.products)) {
    return null;
  }
  const products = getSuggestedProducts(candidate.products);
  if (products.length === 0) return null;
  return {
    type: 'collection',
    title: typeof candidate.title === 'string' ? candidate.title : null,
    url: candidate.url,
    products,
  };
}

function TextWithAddButtons({
  text,
  collection,
  onAdd,
}: {
  text: string;
  collection: LoadedBlock | null;
  onAdd: (url: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState<Record<string, boolean>>({});

  const urls = Array.from(new Set(text.match(URL_RE) ?? []));
  if (!collection || urls.length === 0) {
    return <span>{text}</span>;
  }

  async function handleAdd(url: string) {
    setAdding((p) => ({ ...p, [url]: true }));
    await onAdd(url);
  }

  // Split text into segments, inserting an Add button after each URL
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={url} className={styles.inlineUrlGroup}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.inlineUrl}
        >
          {url}
        </a>
        <button
          type="button"
          className={styles.inlineAddButton}
          disabled={adding[url]}
          onClick={() => handleAdd(url)}
        >
          {adding[url] ? '✓' : '+ Add'}
        </button>
      </span>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span>{parts}</span>;
}

export function CollectionChat({
  collection,
  seedContext,
  onClose,
}: CollectionChatProps) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const collectionContext = serializeCollection(collection);

  const chatFetch = useCallback<typeof fetch>(async (input, init) => {
    const res = await fetch(input, init);
    if (res.status === 402) {
      setChatError('Add credits to keep using AI chat.');
    } else if (!res.ok) {
      setChatError('Chat request failed. Try again in a minute.');
    } else {
      setChatError(null);
    }
    return res;
  }, []);

  const {
    messages,
    sendMessage,
    stop,
    status,
  } = useChat({
    api: '/api/chat',
    fetch: chatFetch,
    body: {
      collectionContext,
      collectionId: collection?.$jazz?.id,
      seedContext,
    },
  });

  const autoSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-open and auto-submit when seedContext arrives
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    if (!seedContext || autoSubmittedRef.current === seedContext) return;
    autoSubmittedRef.current = seedContext;
    setOpen(true);
    sendMessageRef.current({ text: seedContext });
  }, [seedContext]);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitDraft();
    }
  }

  function submitDraft(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setDraft('');
    sendMessage({ text });
  }

  async function handleAddUrl(url: string) {
    if (!collection) return;
    try {
      const meta = await fetchMetadata(url);
      const product: SuggestedProduct = {
        url,
        title: meta?.title ?? null,
        imageUrl: meta?.imageUrl ?? null,
        price: meta?.price ?? null,
        description: meta?.description ?? null,
      };
      await addProductToCollection(product, collection);
      showToast({
        title: 'Added to collection',
        description: product.title ?? url,
        variant: 'success',
      });
    } catch (err) {
      console.error('[CollectionChat] add url failed', err);
      showToast({
        title: 'Could not add product',
        description: 'Try adding it manually via the + button.',
        variant: 'error',
      });
    }
  }

  async function handleAddProduct(product: SuggestedProduct) {
    if (!collection) return;
    try {
      await addProductToCollection(product, collection);
      showToast({
        title: 'Added to collection',
        description: product.title ?? 'Product added',
        variant: 'success',
      });
    } catch (err) {
      console.error('[CollectionChat] add failed', err);
      showToast({
        title: 'Could not add product',
        description: 'Try adding it manually via the + button.',
        variant: 'error',
      });
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={handleOpen}>
        <span>🔍</span>
        <span>Find products</span>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          {seedContext ? 'Find better option' : 'Find products'}
        </span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔍</span>
            <span>Ask me to find products for your collection.</span>
          </div>
        )}

        {messages.map((message) => {
          const hasProductCards = message.parts.some((part) => {
            const p = part as { type: string; state?: string; output?: unknown };
            return (
              p.type === 'tool-extract_product' &&
              p.state === 'output-available' &&
              (getSuggestedProducts(p.output).length > 0 ||
                getSuggestedCollection(p.output) !== null)
            );
          });

          return (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.role === 'user'
                  ? styles.messageUser
                  : styles.messageAssistant
              }`}
            >
              {message.parts.map((part, idx) => {
              if (part.type === 'text' && part.text) {
                if (
                  message.role === 'assistant' &&
                  hasProductCards &&
                  isGenericOptionsIntro(part.text)
                ) {
                  return null;
                }

                return (
                  <div key={idx} className={styles.messageBubble}>
                    <TextWithAddButtons
                      text={part.text}
                      collection={
                        message.role === 'assistant' ? collection : null
                      }
                      onAdd={handleAddUrl}
                    />
                  </div>
                );
              }

              // AI SDK v6: typed server tools come through as 'tool-{name}' parts
              // (not 'dynamic-tool'). Check by type string directly.
              const p = part as {
                type: string;
                state?: string;
                input?: unknown;
                output?: unknown;
              };
              const isSearch = p.type === 'tool-search_products';
              const isExtract = p.type === 'tool-extract_product';

              if (
                !isSearch &&
                !isExtract &&
                p.type !== 'dynamic-tool' &&
                p.type !== 'step-start'
              )
                return null;

              if (
                isSearch &&
                (p.state === 'input-streaming' || p.state === 'input-available')
              ) {
                const query = (p.input as { query?: string })?.query;
                return (
                  <div key={idx} className={styles.toolStatus}>
                    <span className={styles.spinner} />
                    {query ? `Searching for "${query}"…` : 'Searching…'}
                  </div>
                );
              }

              if (
                isExtract &&
                (p.state === 'input-streaming' || p.state === 'input-available')
              ) {
                const url = (p.input as { url?: string })?.url;
                let hostname = url ?? '';
                try {
                  if (url) hostname = new URL(url).hostname;
                } catch {}
                return (
                  <div key={idx} className={styles.toolStatus}>
                    <span className={styles.spinner} />
                    Looking up {hostname}…
                  </div>
                );
              }

              if (isExtract && p.state === 'output-available') {
                const suggestedCollection = getSuggestedCollection(p.output);
                if (suggestedCollection) {
                  return (
                    <CollectionSuggestionCard
                      key={idx}
                      collection={suggestedCollection}
                      onAddProduct={
                        collection ? handleAddProduct : undefined
                      }
                    />
                  );
                }

                const products = getSuggestedProducts(p.output);
                if (products.length === 0) return null;
                return (
                  <div key={idx} className={styles.productResults}>
                    {products.map((product) => (
                      <ProductSuggestionCard
                        key={product.url}
                        product={product}
                        onAdd={
                          collection
                            ? () => handleAddProduct(product)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                );
              }

              return null;
            })}
            </div>
          );
        })}

        {(status === 'submitted' || status === 'streaming') && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.toolStatus}>
              <span className={styles.spinner} />
              {status === 'submitted' ? 'Thinking…' : 'Working…'}
            </div>
          </div>
        )}

        {chatError && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.errorBubble}>{chatError}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={submitDraft} className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find me a waterproof jacket under $150…"
          rows={1}
        />
        {status === 'submitted' || status === 'streaming' ? (
          <button
            type="button"
            className={styles.stopButton}
            onClick={() => stop()}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!draft.trim()}
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
