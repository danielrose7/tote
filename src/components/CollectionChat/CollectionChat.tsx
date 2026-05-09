'use client';

import { useChat } from '@ai-sdk/react';
import type { co } from 'jazz-tools';
import { Group } from 'jazz-tools';
import { useEffect, useRef, useState } from 'react';
import { fetchMetadata } from '../../app/utils/metadata';
import { Block as BlockSchema, BlockList } from '../../schema';
import type { Block } from '../../schema';
import { useToast } from '../ToastNotification';
import styles from './CollectionChat.module.css';
import {
  ProductSuggestionCard,
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
  return { title: collection.name ?? 'Collection', items };
}

async function addProductToCollection(
  product: SuggestedProduct,
  collection: LoadedBlock,
): Promise<void> {
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
        url: product.url,
        imageUrl: product.imageUrl ?? undefined,
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

const URL_RE = /https?:\/\/[^\s"')>]+/g;

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const collectionContext = serializeCollection(collection);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    sendMessage,
    status,
  } = useChat({
    api: '/api/chat',
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
  useEffect(() => {
    if (!seedContext) return;
    setOpen(true);
    // Submit the seed as the first user message, but only once per seed value
    if (autoSubmittedRef.current !== seedContext) {
      autoSubmittedRef.current = seedContext;
      sendMessage({ text: seedContext });
    }
  }, [seedContext, sendMessage]);

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
      if (input?.trim() && status !== 'submitted' && status !== 'streaming') {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
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

        {messages.map((message) => (
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

              // AI SDK v6: untyped tools come through as 'dynamic-tool' parts
              if (part.type !== 'dynamic-tool') return null;

              if (
                part.toolName === 'search_products' &&
                (part.state === 'input-streaming' ||
                  part.state === 'input-available')
              ) {
                const query = (part.input as { query?: string })?.query;
                return (
                  <div key={idx} className={styles.toolStatus}>
                    <span className={styles.spinner} />
                    {query ? `Searching for "${query}"…` : 'Searching…'}
                  </div>
                );
              }

              if (
                part.toolName === 'extract_product' &&
                (part.state === 'input-streaming' ||
                  part.state === 'input-available')
              ) {
                const url = (part.input as { url?: string })?.url;
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

              if (
                part.toolName === 'extract_product' &&
                part.state === 'output-available'
              ) {
                const product = part.output as SuggestedProduct | null;
                if (!product?.url) return null;
                return (
                  <ProductSuggestionCard
                    key={idx}
                    product={product}
                    onAdd={
                      collection ? () => handleAddProduct(product) : undefined
                    }
                  />
                );
              }

              return null;
            })}
          </div>
        ))}

        {(status === 'submitted' || status === 'streaming') && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.toolStatus}>
              <span className={styles.spinner} />
              {status === 'submitted' ? 'Thinking…' : 'Working…'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Find me a waterproof jacket under $150…"
          rows={1}
          disabled={status === 'submitted' || status === 'streaming'}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={
            !input?.trim() || status === 'submitted' || status === 'streaming'
          }
        >
          Send
        </button>
      </form>
    </div>
  );
}
