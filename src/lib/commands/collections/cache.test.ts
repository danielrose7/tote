import { describe, expect, it } from 'vitest';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import {
  createCollectionUpdate,
  deleteCollectionUpdate,
  updateCollectionUpdate,
} from './cache';

const earlier = new Date('2026-01-01T00:00:00Z');
const now = new Date('2026-11-25T12:00:00Z');

const summaries = [
  {
    id: 'a',
    name: 'Kitchen',
    description: null,
    color: null,
    updatedAt: earlier,
  },
  {
    id: 'b',
    name: 'Garden',
    description: null,
    color: null,
    updatedAt: earlier,
  },
] as unknown as CollectionSummary[];

const detail = {
  collection: {
    id: 'a',
    name: 'Kitchen',
    description: null,
    color: null,
    budgetCents: null,
    version: 4,
    updatedAt: earlier,
  },
  nodes: [],
} as unknown as CollectionDetail;

describe('createCollectionUpdate', () => {
  const input = {
    id: 'new',
    mutationId: 'm1',
    name: 'Office',
    color: '#000',
    positionKey: 'z',
  };

  it('appends an owned, empty collection to the list', () => {
    const update = createCollectionUpdate(input, {
      ownerUserId: 'user_1',
      now,
    });
    const next = update.summaries?.(summaries) ?? [];
    expect(next.map((s) => s.id)).toEqual(['a', 'b', 'new']);
    expect(next[2]).toMatchObject({
      name: 'Office',
      ownerUserId: 'user_1',
      role: 'owner',
      itemCount: 0,
      previewImages: [],
    });
  });

  it('does not add the collection twice when a create is retried', () => {
    const update = createCollectionUpdate(input, {
      ownerUserId: 'user_1',
      now,
    });
    const once = update.summaries?.(summaries) ?? [];
    expect(update.summaries?.(once)).toBe(once);
  });
});

describe('updateCollectionUpdate', () => {
  it('applies only the fields that were sent, to detail and list', () => {
    const update = updateCollectionUpdate(
      {
        collectionId: 'a',
        input: {
          expectedVersion: 4,
          mutationId: 'm1',
          name: 'Cooking',
          budgetCents: 5000,
        },
      },
      { now },
    );
    const next = update.detail?.(detail);
    expect(next?.collection).toMatchObject({
      name: 'Cooking',
      description: null,
      budgetCents: 5000,
      version: 5,
      updatedAt: now,
    });
    expect(next?.collection).not.toHaveProperty('expectedVersion');
    const [kitchen, garden] = update.summaries?.(summaries) ?? [];
    expect(kitchen).toMatchObject({ name: 'Cooking', updatedAt: now });
    expect(kitchen).not.toHaveProperty('budgetCents');
    expect(garden).toBe(summaries[1]);
  });

  it('can clear a description with null', () => {
    const update = updateCollectionUpdate(
      {
        collectionId: 'a',
        input: { expectedVersion: 4, mutationId: 'm1', description: null },
      },
      { now },
    );
    const withDescription = {
      ...detail,
      collection: { ...detail.collection, description: 'Pans' },
    };
    expect(update.detail?.(withDescription).collection.description).toBeNull();
  });
});

describe('deleteCollectionUpdate', () => {
  it('removes the collection from the list', () => {
    const update = deleteCollectionUpdate({
      collectionId: 'a',
      input: { expectedVersion: 4, mutationId: 'm1' },
    });
    expect(update.summaries?.(summaries).map((s) => s.id)).toEqual(['b']);
  });
});
