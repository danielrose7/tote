import type {
  CreateCollectionMutation,
  DeleteCollectionMutation,
  UpdateCollectionMutation,
} from '@/lib/collections/client';
import type { CollectionSummary } from '@/lib/collections/repository';
import type { CollectionCacheUpdate } from '../optimistic';

/**
 * Optimistic cache effects for collection commands, written once. Pure, so
 * the dialogs and future agent tools apply exactly the same change.
 */

export function createCollectionUpdate(
  input: CreateCollectionMutation,
  { ownerUserId, now }: { ownerUserId: string; now: Date },
): CollectionCacheUpdate {
  const summary: CollectionSummary = {
    id: input.id,
    ownerUserId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    itemCount: 0,
    legacyJazzId: null,
    positionKey: input.positionKey ?? `${now.toISOString()}:${input.id}`,
    updatedAt: now,
    role: 'owner',
    joinedAt: now,
    previewImages: [],
  };
  return {
    summaries: (current) =>
      // A retried or resumed create must not add the collection twice.
      current.some((candidate) => candidate.id === summary.id)
        ? current
        : [...current, summary],
  };
}

const SUMMARY_FIELDS = [
  'name',
  'description',
  'color',
  'positionKey',
] as const satisfies readonly (keyof CollectionSummary)[];

export function updateCollectionUpdate(
  { collectionId, input }: UpdateCollectionMutation,
  { now }: { now: Date },
): CollectionCacheUpdate {
  const {
    expectedVersion: _version,
    mutationId: _mutationId,
    ...fields
  } = input;
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  const summaryChanges = Object.fromEntries(
    SUMMARY_FIELDS.filter((field) => field in changes).map((field) => [
      field,
      changes[field],
    ]),
  );
  return {
    detail: (current) => ({
      ...current,
      collection: {
        ...current.collection,
        ...changes,
        version: current.collection.version + 1,
        updatedAt: now,
      },
    }),
    summaries: (current) =>
      current.map((summary) =>
        summary.id === collectionId
          ? { ...summary, ...summaryChanges, updatedAt: now }
          : summary,
      ),
  };
}

export function deleteCollectionUpdate({
  collectionId,
}: DeleteCollectionMutation): CollectionCacheUpdate {
  return {
    summaries: (current) =>
      current.filter((summary) => summary.id !== collectionId),
  };
}
