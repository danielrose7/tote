import { describe, expect, it } from 'vitest';
import type { CollectionNode } from '@/db/schema';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import {
  collectionIdFrom,
  resolveCollection,
  resolveItem,
  resolveSection,
  summarizeCollection,
  ToolInputError,
} from './resolve';

const kitchenId = '0b6c7e4e-1c0a-4c8f-9a51-6f2f1d0e9a11';
const gardenId = '9d3f5a2b-7e61-4b0c-8f4d-2a6e1b9c7d22';

const summaries = [
  { id: kitchenId, name: 'Kitchen' },
  { id: gardenId, name: 'Garden ' },
] as unknown as CollectionSummary[];

function node(id: string, overrides: Partial<CollectionNode> = {}) {
  return {
    id,
    collectionId: kitchenId,
    parentId: null,
    type: 'product',
    title: id,
    properties: {},
    positionKey: id,
    version: 1,
    ...overrides,
  } as CollectionNode;
}

describe('collectionIdFrom', () => {
  it('reads ids and Tote links, and ignores anything else', () => {
    expect(collectionIdFrom(kitchenId.toUpperCase())).toBe(kitchenId);
    expect(
      collectionIdFrom(`https://tote.tools/collections/${kitchenId}?view=grid`),
    ).toBe(kitchenId);
    expect(collectionIdFrom(`/collections/${kitchenId}`)).toBe(kitchenId);
    expect(collectionIdFrom('Kitchen')).toBeNull();
    expect(collectionIdFrom(`${kitchenId}-extra`)).toBeNull();
  });
});

describe('resolveCollection', () => {
  it('matches by id, link or exact name ignoring case and spaces', () => {
    expect(resolveCollection(kitchenId, summaries).id).toBe(kitchenId);
    expect(resolveCollection(' kitchen ', summaries).id).toBe(kitchenId);
    expect(resolveCollection('garden', summaries).id).toBe(gardenId);
  });

  it('explains what to do when nothing or several match', () => {
    expect(() => resolveCollection('Office', summaries)).toThrow(
      /list_collections/,
    );
    const duplicate = [
      ...summaries,
      { id: 'x', name: 'kitchen' },
    ] as CollectionSummary[];
    expect(() => resolveCollection('Kitchen', duplicate)).toThrow(
      ToolInputError,
    );
  });
});

describe('resolveSection and resolveItem', () => {
  const nodes = [
    node('s1', { type: 'section', title: 'Pans' }),
    node('i1', { parentId: 's1' }),
  ];

  it('finds sections by id or title', () => {
    expect(resolveSection('s1', nodes).id).toBe('s1');
    expect(resolveSection('pans', nodes).id).toBe('s1');
    expect(() => resolveSection('Knives', nodes)).toThrow(/get_collection/);
  });

  it('finds items by id but never treats a section as an item', () => {
    expect(resolveItem('i1', nodes).id).toBe('i1');
    expect(() => resolveItem('s1', nodes)).toThrow(ToolInputError);
  });
});

describe('summarizeCollection', () => {
  it('groups items under sections in position order and drops internals', () => {
    const detail = {
      collection: {
        id: kitchenId,
        name: 'Kitchen',
        description: null,
        itemCount: 3,
      },
      role: 'owner',
      nodes: [
        node('b', { positionKey: '2', properties: { url: 'https://b.test' } }),
        node('s', { type: 'section', title: 'Pans', positionKey: '0' }),
        node('a', {
          positionKey: '1',
          parentId: 's',
          properties: { price: 25, body: '  Ask for the blue one ' },
        }),
        node('orphan', { positionKey: '3', parentId: 'deleted-section' }),
      ],
    } as unknown as CollectionDetail;

    const summary = summarizeCollection(detail, 'https://tote.tools');
    expect(summary.url).toBe(`https://tote.tools/collections/${kitchenId}`);
    expect(summary.sections).toEqual([
      {
        id: 's',
        title: 'Pans',
        items: [
          {
            id: 'a',
            type: 'product',
            title: 'a',
            price: '25',
            note: 'Ask for the blue one',
          },
        ],
      },
    ]);
    expect(summary.ungroupedItems.map((item) => item.id)).toEqual([
      'b',
      'orphan',
    ]);
    expect(summary.ungroupedItems[0]).not.toHaveProperty('version');
  });
});
