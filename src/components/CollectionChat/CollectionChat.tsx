'use client';

import { useChat } from '@ai-sdk/react';
import type { co } from 'jazz-tools';
import { Group } from 'jazz-tools';
import { useEffect, useRef, useState } from 'react';
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

  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: '/api/chat',
    body: {
      collectionContext,
      collectionId: collection?.$jazz?.id,
      seedContext,
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-open and focus when seedContext is set (triggered from curator warning)
  useEffect(() => {
    if (seedContext) {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
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
      if (input?.trim() && status === 'ready') {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
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
            <span>
              {seedContext
                ? 'Searching for a better option…'
                : 'Ask me to find products for your collection.'}
            </span>
            {seedContext && (
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                {seedContext.slice(0, 120)}
                {seedContext.length > 120 ? '…' : ''}
              </span>
            )}
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
                    {part.text}
                  </div>
                );
              }

              if (
                part.type === 'tool-invocation' &&
                part.toolInvocation.toolName === 'search_products' &&
                part.toolInvocation.state === 'call'
              ) {
                return (
                  <div key={idx} className={styles.toolStatus}>
                    <span className={styles.spinner} />
                    Searching for "{part.toolInvocation.args.query}"…
                  </div>
                );
              }

              if (
                part.type === 'tool-invocation' &&
                part.toolInvocation.toolName === 'extract_product' &&
                part.toolInvocation.state === 'call'
              ) {
                const url = part.toolInvocation.args.url as string;
                return (
                  <div key={idx} className={styles.toolStatus}>
                    <span className={styles.spinner} />
                    Looking up {new URL(url).hostname}…
                  </div>
                );
              }

              if (
                part.type === 'tool-invocation' &&
                part.toolInvocation.toolName === 'extract_product' &&
                part.toolInvocation.state === 'result'
              ) {
                const product = part.toolInvocation
                  .result as SuggestedProduct | null;
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

        {status === 'submitted' && messages.at(-1)?.role === 'user' && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.toolStatus}>
              <span className={styles.spinner} />
              Thinking…
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
          disabled={!input?.trim() || status !== 'ready'}
        >
          Send
        </button>
      </form>
    </div>
  );
}
