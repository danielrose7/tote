import type { z } from 'zod';
import type { CollectionNode } from '@/db/schema';
import type { addItemTool, updateItemTool } from './catalog';
import { resolveSection, ToolInputError } from './resolve';

/**
 * What add_item and update_item change, worked out once for both runtimes.
 * The browser reads page metadata through the extension or /api/extract, the
 * server through its extractor; both pass the result in here.
 */

export type PageMetadata = {
  title?: string;
  imageUrl?: string;
  description?: string;
  price?: string;
} | null;

type AddItemInput = z.infer<typeof addItemTool.input>;
type UpdateItemInput = z.infer<typeof updateItemTool.input>;

export function newItemFields(
  { url, title, note, section }: AddItemInput,
  nodes: readonly CollectionNode[],
  metadata: PageMetadata,
) {
  if (!url && !title) {
    throw new ToolInputError('Provide a url, a title, or both.');
  }
  const properties: Record<string, unknown> = {};
  if (url) {
    properties.url = url;
    if (metadata?.imageUrl) properties.imageUrl = metadata.imageUrl;
    if (metadata?.description) properties.description = metadata.description;
    if (metadata?.price) properties.price = metadata.price;
  }
  if (note) properties.body = note;
  return {
    type: url ? ('product' as const) : ('note' as const),
    title: title ?? metadata?.title ?? (url ? new URL(url).hostname : ''),
    parentId: section ? resolveSection(section, nodes).id : null,
    properties,
  };
}

/** The server replaces properties, so start from what's there. */
export function itemUpdateFields(
  node: CollectionNode,
  { title, url, price, note, section }: UpdateItemInput,
  nodes: readonly CollectionNode[],
) {
  const properties = { ...(node.properties as Record<string, unknown>) };
  if (url !== undefined) properties.url = url;
  if (price !== undefined) properties.price = price || undefined;
  if (note !== undefined) properties.body = note || undefined;
  return {
    ...(title !== undefined ? { title } : {}),
    ...(section !== undefined
      ? {
          parentId: section === null ? null : resolveSection(section, nodes).id,
        }
      : {}),
    properties,
  };
}

export function positionKeyFor(id: string) {
  return `${new Date().toISOString()}:${id}`;
}
