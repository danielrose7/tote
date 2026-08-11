import { randomUUID } from 'node:crypto';
import { collectionMembers, collectionNodes, collections } from '@/db/schema';
import type { ImportPayload } from '../importPayload';
import { normalizeUrl } from '../normalizeUrl';
import { withTransactionalDb } from '../transactionalDb';
import type { CollectionDatabase } from './repository';

export type CreateCollectionFromPayloadOptions = {
  /** Distinguishes a hand-pasted `/import` payload from a curator run. */
  originType?: 'import' | 'curator';
};

/**
 * Position keys sort lexically, so pad the index to keep numeric order stable
 * past the tenth section/item.
 */
function positionKeyFor(index: number): string {
  return `a${String(index).padStart(6, '0')}`;
}

async function createCollectionFromPayloadWithDatabase(
  actorUserId: string,
  payload: ImportPayload,
  options: CreateCollectionFromPayloadOptions,
  database: CollectionDatabase,
): Promise<{ id: string }> {
  const collectionId = randomUUID();

  await database.insert(collections).values({
    id: collectionId,
    ownerUserId: actorUserId,
    name: payload.title,
    description: payload.intro ?? null,
    color: '#6366f1',
    defaultViewMode: 'grid',
    positionKey: `z:${collectionId}`,
    originType: options.originType ?? 'import',
  });
  await database.insert(collectionMembers).values({
    collectionId,
    userId: actorUserId,
    role: 'owner',
  });

  const sectionValues: (typeof collectionNodes.$inferInsert)[] = [];
  const itemValues: (typeof collectionNodes.$inferInsert)[] = [];

  payload.sections.forEach((section, sectionIndex) => {
    const sectionId = randomUUID();
    sectionValues.push({
      id: sectionId,
      collectionId,
      parentId: null,
      type: 'section',
      title: section.title,
      properties: section.description
        ? { description: section.description }
        : {},
      positionKey: positionKeyFor(sectionIndex),
      createdByUserId: actorUserId,
    });

    section.items.forEach((item, itemIndex) => {
      itemValues.push({
        id: randomUUID(),
        collectionId,
        parentId: sectionId,
        type: 'product',
        title: item.title || item.sourceUrl || 'Untitled',
        properties: {
          url: normalizeUrl(item.sourceUrl || ''),
          ...(item.merchant ? { merchant: item.merchant } : {}),
          ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
          ...(item.images?.length ? { images: item.images } : {}),
          ...(item.price ? { price: item.price } : {}),
          ...(item.currency ? { currency: item.currency } : {}),
          ...(item.description ? { description: item.description } : {}),
          ...(item.note ? { notes: item.note } : {}),
        },
        positionKey: positionKeyFor(itemIndex),
        createdByUserId: actorUserId,
      });
    });
  });

  // Sections must land before their children so the parent-validation trigger
  // sees a top-level row to attach to.
  if (sectionValues.length > 0) {
    await database.insert(collectionNodes).values(sectionValues);
  }
  if (itemValues.length > 0) {
    await database.insert(collectionNodes).values(itemValues);
  }

  return { id: collectionId };
}

export async function createCollectionFromPayload(
  actorUserId: string,
  payload: ImportPayload,
  options: CreateCollectionFromPayloadOptions = {},
  database?: CollectionDatabase,
): Promise<{ id: string }> {
  if (database) {
    return createCollectionFromPayloadWithDatabase(
      actorUserId,
      payload,
      options,
      database,
    );
  }
  return withTransactionalDb((transactionalDatabase) =>
    transactionalDatabase.transaction((transaction) =>
      createCollectionFromPayloadWithDatabase(
        actorUserId,
        payload,
        options,
        transaction,
      ),
    ),
  );
}
