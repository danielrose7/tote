import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublishedCollection,
  PublishedProduct,
} from '@/lib/publishedCollectionsDb';
import {
  createSharedCollectionTools,
  summarizePublishedCollection,
} from './sharedCollection';

function product(
  title: string,
  sortOrder: number,
  overrides: Partial<PublishedProduct> = {},
): PublishedProduct {
  return {
    id: title,
    title,
    url: `https://shop.test/${title}`,
    description: null,
    price: null,
    imageUrl: null,
    brand: null,
    merchant: null,
    sortOrder,
    ...overrides,
  };
}

function collection(allowCloning: boolean): PublishedCollection {
  return {
    id: 'pub_1',
    name: 'Camping gear',
    description: '  Everything for a weekend  ',
    allowCloning,
    topLevelProducts: [product('stove', 2), product('lantern', 1)],
    slots: [
      {
        id: 'slot_b',
        slotName: 'Sleeping',
        slotDescription: null,
        sortOrder: 2,
        products: [product('pad', 1, { price: '$40', merchant: 'REI' })],
      },
      {
        id: 'slot_a',
        slotName: 'Shelter',
        slotDescription: null,
        sortOrder: 1,
        products: [product('tent', 1, { description: 'x'.repeat(400) })],
      },
    ],
  } as unknown as PublishedCollection;
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: {
      origin: 'https://tote.tools',
      href: 'https://tote.tools/s/dana/camping',
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('summarizePublishedCollection', () => {
  it('orders sections and items as the page does and trims long text', () => {
    const summary = summarizePublishedCollection(collection(true), 'dana');
    expect(summary.description).toBe('Everything for a weekend');
    expect(summary.sections.map((section) => section.title)).toEqual([
      'Shelter',
      'Sleeping',
    ]);
    expect(summary.items.map((item) => item.title)).toEqual([
      'lantern',
      'stove',
    ]);
    expect(summary.sections[0].items[0].description).toHaveLength(301);
    expect(summary.sections[1].items[0]).toMatchObject({
      price: '$40',
      store: 'REI',
    });
  });
});

describe('createSharedCollectionTools', () => {
  it('offers a copy only when the owner allows it', () => {
    const names = (allow: boolean) =>
      createSharedCollectionTools(
        summarizePublishedCollection(collection(allow)),
        { navigate: vi.fn() },
      ).map((tool) => tool.name);
    expect(names(true)).toEqual(['get_shared_collection', 'save_copy']);
    expect(names(false)).toEqual(['get_shared_collection']);
  });

  it('marks shared content as untrusted and returns it with the page url', async () => {
    const [read] = createSharedCollectionTools(
      summarizePublishedCollection(collection(false), 'dana'),
      { navigate: vi.fn() },
    );
    expect(read.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
      consequentialHint: false,
    });
    const result = (await read.execute({})) as Record<string, unknown>;
    expect(result).toMatchObject({
      name: 'Camping gear',
      sharedBy: 'dana',
      url: 'https://tote.tools/s/dana/camping',
      canSaveCopy: false,
    });
    expect(result).not.toHaveProperty('publicationId');
  });

  it('save_copy opens the existing clone flow', async () => {
    const navigate = vi.fn();
    const tools = createSharedCollectionTools(
      summarizePublishedCollection(collection(true)),
      { navigate },
    );
    await tools[1].execute({});
    expect(navigate).toHaveBeenCalledWith('/clone/pub_1');
  });
});
