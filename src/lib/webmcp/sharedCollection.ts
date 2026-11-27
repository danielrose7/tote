import type {
  PublishedCollection,
  PublishedProduct,
} from '@/lib/publishedCollectionsDb';
import type { ModelContextTool } from './modelContext';

/**
 * WebMCP tools for a published (public, read-only) collection page, so an
 * agent can read someone's shared list and, if the owner allows it, save a
 * copy for the user. The summary is built on the server from data the page
 * already renders; the tools never call the API.
 */

const MAX_TEXT = 300;

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed;
}

type SharedItem = {
  title: string | null;
  url?: string;
  price?: string;
  currency?: string;
  brand?: string;
  store?: string;
  description?: string;
};

export type SharedCollectionSummary = {
  publicationId: string;
  name: string;
  description?: string;
  sharedBy?: string;
  allowCopying: boolean;
  sections: {
    title: string | null;
    description?: string;
    items: SharedItem[];
  }[];
  items: SharedItem[];
};

function summarizeProduct(product: PublishedProduct): SharedItem {
  return {
    title: product.title,
    url: product.url ?? undefined,
    price: product.price ?? undefined,
    currency: product.currency ?? undefined,
    brand: product.brand ?? undefined,
    store: product.merchant ?? undefined,
    description: text(product.description),
  };
}

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder;

export function summarizePublishedCollection(
  collection: PublishedCollection,
  sharedBy?: string,
): SharedCollectionSummary {
  return {
    publicationId: collection.id,
    name: collection.name,
    description: text(collection.description),
    sharedBy,
    allowCopying: collection.allowCloning,
    sections: [...collection.slots].sort(bySortOrder).map((slot) => ({
      title: slot.slotName,
      description: text(slot.slotDescription),
      items: [...slot.products].sort(bySortOrder).map(summarizeProduct),
    })),
    items: [...collection.topLevelProducts]
      .sort(bySortOrder)
      .map(summarizeProduct),
  };
}

const EMPTY_INPUT = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

export function createSharedCollectionTools(
  summary: SharedCollectionSummary,
  { navigate }: { navigate: (path: string) => void },
): ModelContextTool[] {
  const { publicationId, allowCopying, ...content } = summary;
  const tools: ModelContextTool[] = [
    {
      name: 'get_shared_collection',
      description:
        'Read the collection shared on this page: its sections and items with links, prices and descriptions.',
      inputSchema: EMPTY_INPUT,
      annotations: {
        readOnlyHint: true,
        // Written by the person who shared it, and scraped from shop pages.
        untrustedContentHint: true,
        consequentialHint: false,
      },
      execute: async () => ({
        ...content,
        url: window.location.href,
        canSaveCopy: allowCopying,
      }),
    },
  ];
  if (allowCopying) {
    tools.push({
      name: 'save_copy',
      description:
        "Save a private copy of this collection to the user's Tote. Opens the copy; the user may be asked to sign in first.",
      inputSchema: EMPTY_INPUT,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
        consequentialHint: false,
      },
      execute: async () => {
        navigate(`/clone/${publicationId}`);
        return {
          opening: `${window.location.origin}/clone/${publicationId}`,
        };
      },
    });
  }
  return tools;
}
