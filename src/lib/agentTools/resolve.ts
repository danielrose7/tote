import type { CollectionNode } from '@/db/schema';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';

/**
 * Pure helpers that turn what an agent sends (ids, links or names) into Tote
 * records, and Tote records into compact results. Kept free of React and the
 * query client so they can be unit tested.
 */

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const COLLECTION_PATH = new RegExp(`/collections/(${UUID.source})`, 'i');

/** A collection id from an id or any Tote collection link. */
export function collectionIdFrom(reference: string): string | null {
  const trimmed = reference.trim();
  const fromPath = trimmed.match(COLLECTION_PATH);
  if (fromPath) return fromPath[1].toLowerCase();
  return new RegExp(`^${UUID.source}$`, 'i').test(trimmed)
    ? trimmed.toLowerCase()
    : null;
}

/** Resolve an id, a link, or an exact (case-insensitive) collection name. */
export function resolveCollection(
  reference: string,
  summaries: readonly CollectionSummary[],
): CollectionSummary {
  const id = collectionIdFrom(reference);
  if (id) {
    const match = summaries.find((summary) => summary.id === id);
    if (match) return match;
    throw new ToolInputError(`No collection with id ${id}.`);
  }
  const name = reference.trim().toLowerCase();
  const matches = summaries.filter(
    (summary) => summary.name.trim().toLowerCase() === name,
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ToolInputError(
      `More than one collection is named "${reference}". Use its id from list_collections.`,
    );
  }
  throw new ToolInputError(
    `No collection named "${reference}". Use list_collections to see them.`,
  );
}

/** Resolve a section by id or exact (case-insensitive) title. */
export function resolveSection(
  reference: string,
  nodes: readonly CollectionNode[],
): CollectionNode {
  const sections = nodes.filter((node) => node.type === 'section');
  const byId = sections.find((section) => section.id === reference.trim());
  if (byId) return byId;
  const title = reference.trim().toLowerCase();
  const matches = sections.filter(
    (section) => (section.title ?? '').trim().toLowerCase() === title,
  );
  if (matches.length === 1) return matches[0];
  throw new ToolInputError(
    matches.length > 1
      ? `More than one section is titled "${reference}". Use its id from get_collection.`
      : `No section "${reference}" in this collection. Use get_collection to see its sections.`,
  );
}

export function resolveItem(
  itemId: string,
  nodes: readonly CollectionNode[],
): CollectionNode {
  const item = nodes.find(
    (node) => node.id === itemId.trim() && node.type !== 'section',
  );
  if (!item) {
    throw new ToolInputError(
      `No item ${itemId} in this collection. Use get_collection to see item ids.`,
    );
  }
  return item;
}

const MAX_TEXT = 300;

function text(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed;
}

export type ItemSummary = {
  id: string;
  type: CollectionNode['type'];
  title: string | null;
  url?: string;
  price?: string;
  description?: string;
  note?: string;
};

export function summarizeItem(node: CollectionNode): ItemSummary {
  const properties = node.properties as Record<string, unknown>;
  const price = properties.price;
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    url: text(properties.url),
    price:
      typeof price === 'string' || typeof price === 'number'
        ? String(price)
        : undefined,
    description: text(properties.description),
    note: text(properties.body),
  };
}

const byPosition = (a: CollectionNode, b: CollectionNode) =>
  a.positionKey < b.positionKey ? -1 : a.positionKey > b.positionKey ? 1 : 0;

/** A compact, agent-friendly view of a collection: no versions or internals. */
export function summarizeCollection(detail: CollectionDetail, origin: string) {
  const nodes = [...detail.nodes].sort(byPosition);
  const sections = nodes.filter((node) => node.type === 'section');
  const sectionIds = new Set(sections.map((section) => section.id));
  return {
    id: detail.collection.id,
    name: detail.collection.name,
    description: detail.collection.description,
    role: detail.role,
    url: `${origin}/collections/${detail.collection.id}`,
    itemCount: detail.collection.itemCount,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      items: nodes
        .filter((node) => node.parentId === section.id)
        .map(summarizeItem),
    })),
    ungroupedItems: nodes
      .filter(
        (node) =>
          node.type !== 'section' &&
          (!node.parentId || !sectionIds.has(node.parentId)),
      )
      .map(summarizeItem),
  };
}
