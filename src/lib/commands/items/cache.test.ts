import { describe, expect, it } from 'vitest';
import type { CollectionNode } from '@/db/schema';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import {
  createNodeUpdate,
  deleteNodeUpdate,
  descendantIds,
  reorderNodesUpdate,
  updateNodeUpdate,
} from './cache';

const collectionId = '00000000-0000-4000-8000-000000000001';
const earlier = new Date('2026-01-01T00:00:00Z');
const now = new Date('2026-11-25T12:00:00Z');

function node(
  id: string,
  overrides: Partial<CollectionNode> = {},
): CollectionNode {
  return {
    id,
    collectionId,
    parentId: null,
    type: 'product',
    title: id,
    properties: {},
    positionKey: id,
    version: 1,
    createdByUserId: 'user_1',
    createdAt: earlier,
    updatedAt: earlier,
    deletedAt: null,
    addedVia: 'app',
    ...overrides,
  };
}

function detailWith(nodes: CollectionNode[], itemCount: number) {
  return {
    collection: {
      id: collectionId,
      itemCount,
      version: 10,
      updatedAt: earlier,
    },
    nodes,
  } as unknown as CollectionDetail;
}

const summaries = [
  { id: collectionId, itemCount: 2, updatedAt: earlier },
  { id: 'other', itemCount: 5, updatedAt: earlier },
] as unknown as CollectionSummary[];

describe('descendantIds', () => {
  it('collects every node under the root, at any depth', () => {
    const nodes = [
      node('section', { type: 'section' }),
      node('child', { parentId: 'section' }),
      node('grandchild', { parentId: 'child' }),
      node('unrelated'),
    ];
    expect(descendantIds(nodes, 'section')).toEqual(
      new Set(['section', 'child', 'grandchild']),
    );
  });
});

describe('createNodeUpdate', () => {
  const variables = {
    collectionId,
    input: {
      id: 'new',
      mutationId: 'm1',
      type: 'product' as const,
      title: 'New item',
      positionKey: 'z',
    },
  };

  it('appends the node and counts items in detail and summaries', () => {
    const update = createNodeUpdate(variables, {
      createdByUserId: 'user_1',
      now,
    });
    const detail = update.detail(detailWith([node('a'), node('b')], 2));
    expect(detail.nodes.map((n) => n.id)).toEqual(['a', 'b', 'new']);
    expect(detail.collection.itemCount).toBe(3);
    expect(detail.collection.version).toBe(11);
    expect(update.summaries?.(summaries).map((s) => s.itemCount)).toEqual([
      3, 5,
    ]);
  });

  it('does not add the same node twice when a create is retried', () => {
    const update = createNodeUpdate(variables, {
      createdByUserId: 'user_1',
      now,
    });
    const once = update.detail(detailWith([node('a')], 1));
    expect(update.detail(once)).toBe(once);
  });

  it('leaves item counts alone for sections', () => {
    const update = createNodeUpdate(
      { collectionId, input: { ...variables.input, type: 'section' } },
      { createdByUserId: 'user_1', now },
    );
    expect(update.detail(detailWith([], 0)).collection.itemCount).toBe(0);
    expect(update.summaries).toBeUndefined();
  });
});

describe('updateNodeUpdate', () => {
  it('replaces properties, as the server does, and bumps versions', () => {
    const update = updateNodeUpdate(
      {
        collectionId,
        nodeId: 'a',
        input: {
          expectedVersion: 1,
          mutationId: 'm1',
          title: 'Renamed',
          properties: { url: 'https://example.com' },
        },
      },
      { now },
    );
    const before = node('a', { properties: { price: '10', url: 'old' } });
    const [updated] = update.detail(detailWith([before], 1)).nodes;
    expect(updated.title).toBe('Renamed');
    expect(updated.properties).toEqual({ url: 'https://example.com' });
    expect(updated.version).toBe(2);
    expect(updated.updatedAt).toBe(now);
  });

  it('can move a node out of its section with parentId null', () => {
    const update = updateNodeUpdate(
      {
        collectionId,
        nodeId: 'a',
        input: { expectedVersion: 1, mutationId: 'm1', parentId: null },
      },
      { now },
    );
    const [moved] = update.detail(
      detailWith([node('a', { parentId: 'section' })], 1),
    ).nodes;
    expect(moved.parentId).toBeNull();
  });
});

describe('deleteNodeUpdate', () => {
  it('removes a section with its items and decrements item counts', () => {
    const nodes = [
      node('section', { type: 'section' }),
      node('a', { parentId: 'section' }),
      node('note', { parentId: 'section', type: 'note' }),
      node('b'),
    ];
    const update = deleteNodeUpdate(
      {
        collectionId,
        nodeId: 'section',
        input: { expectedVersion: 1, mutationId: 'm1' },
      },
      { now, nodes },
    );
    const detail = update.detail(detailWith(nodes, 2));
    expect(detail.nodes.map((n) => n.id)).toEqual(['b']);
    expect(detail.collection.itemCount).toBe(1);
    expect(update.summaries?.(summaries)[0].itemCount).toBe(1);
  });
});

describe('reorderNodesUpdate', () => {
  it('sets the new position keys and bumps each moved node', () => {
    const update = reorderNodesUpdate(
      {
        collectionId,
        input: {
          mutationId: 'm1',
          nodes: [
            { id: 'a', expectedVersion: 1, positionKey: 'r:2' },
            { id: 'b', expectedVersion: 1, positionKey: 'r:1' },
          ],
        },
      },
      { now },
    );
    const detail = update.detail(detailWith([node('a'), node('b')], 2));
    expect(detail.nodes.map((n) => [n.id, n.positionKey, n.version])).toEqual([
      ['a', 'r:2', 2],
      ['b', 'r:1', 2],
    ]);
    expect(detail.collection.version).toBe(12);
  });
});
