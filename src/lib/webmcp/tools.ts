import {
  MutationObserver,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import {
  CollectionRequestError,
  fetchCollectionDetail,
  fetchCollectionSummaries,
} from '@/lib/collections/client';
import { roleCan } from '@/lib/collections/permissions';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import { createCollectionOptions } from '@/lib/commands/collections/mutations';
import {
  createItemOptions,
  deleteItemOptions,
  updateItemOptions,
} from '@/lib/commands/items/mutations';
import { checkExtensionAvailable } from '@/lib/extension';
import { extractItemMetadata } from '@/lib/extractItem';
import type { ModelContextTool } from './modelContext';
import {
  collectionIdFrom,
  resolveCollection,
  resolveItem,
  resolveSection,
  summarizeCollection,
  summarizeItem,
  ToolInputError,
} from './resolve';

/**
 * Tote's WebMCP tools: what an agent in the user's browser (ChatGPT's
 * built-in browser, agent-browser, Brave Leo, ...) can do on this page.
 *
 * Every write goes through the same command options as the UI, so the user
 * sees the agent's change appear instantly, failures roll back, and writes to
 * one collection stay in order. The server still enforces permissions and
 * versions; the checks here only give the agent clearer errors.
 *
 * Keep the list short and the descriptions tight: some agents put the whole
 * catalog into the model's context on every page.
 */

export type ToolEnvironment = {
  queryClient: QueryClient;
  /** The signed-in user's id, for optimistic records. */
  userId: () => string;
  /** Client-side navigation within the app. */
  navigate: (path: string) => void;
};

const DETAIL_STALE_MS = 10_000;

function loadSummaries(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: fetchCollectionSummaries,
    staleTime: DETAIL_STALE_MS,
  });
}

function loadDetail(queryClient: QueryClient, collectionId: string) {
  return queryClient.fetchQuery({
    queryKey: collectionQueryKeys.detail(collectionId),
    queryFn: () => fetchCollectionDetail(collectionId),
    staleTime: DETAIL_STALE_MS,
  });
}

async function loadCollection(
  queryClient: QueryClient,
  reference: string,
): Promise<CollectionDetail> {
  // Ids and links skip the list lookup; names need it.
  const id =
    collectionIdFrom(reference) ??
    resolveCollection(reference, await loadSummaries(queryClient)).id;
  return loadDetail(queryClient, id);
}

function requireEdit(detail: CollectionDetail) {
  if (!roleCan(detail.role, 'edit')) {
    throw new ToolInputError(
      'The user can view this collection but not change it.',
    );
  }
}

function runMutation<Data, Variables, Context>(
  queryClient: QueryClient,
  options: MutationOptions<Data, Error, Variables, Context>,
  variables: Variables,
): Promise<Data> {
  return new MutationObserver(queryClient, options).mutate(variables);
}

function positionKeyFor(id: string) {
  return `${new Date().toISOString()}:${id}`;
}

function agentMessage(error: unknown): string {
  if (error instanceof ToolInputError) return error.message;
  if (error instanceof CollectionRequestError) {
    if (error.code === 'version_conflict') {
      return 'This changed since it was read. Call get_collection and try again.';
    }
    switch (error.status) {
      case 401:
        return 'The user is signed out. Ask them to sign in to Tote.';
      case 403:
        return 'The user is not allowed to do this in this collection.';
      case 404:
        return 'Not found. It may have been deleted.';
    }
  }
  return 'Tote could not complete this. Try again, or ask the user to check the page.';
}

type ToolSpec<Schema extends z.ZodObject> = {
  name: string;
  description: string;
  readOnly: boolean;
  /** Output includes scraped or other-member content. */
  untrustedContent?: boolean;
  /** Hard to undo; agents should confirm first. */
  consequential?: boolean;
  input: Schema;
  run: (input: z.infer<Schema>) => Promise<unknown>;
};

function toTool<Schema extends z.ZodObject>(
  spec: ToolSpec<Schema>,
): ModelContextTool {
  const { $schema: _dialect, ...inputSchema } = z.toJSONSchema(spec.input, {
    io: 'input',
  });
  return {
    name: spec.name,
    description: spec.description,
    inputSchema,
    annotations: {
      readOnlyHint: spec.readOnly,
      untrustedContentHint: spec.untrustedContent ?? false,
      consequentialHint: spec.consequential ?? false,
    },
    execute: async (rawInput) => {
      const parsed = spec.input.safeParse(rawInput ?? {});
      if (!parsed.success) {
        throw new Error(
          `Invalid input: ${parsed.error.issues
            .map(
              (issue) => `${issue.path.join('.') || 'input'} ${issue.message}`,
            )
            .join('; ')}`,
        );
      }
      try {
        return await spec.run(parsed.data);
      } catch (error) {
        throw new Error(agentMessage(error));
      }
    },
  };
}

const collectionRef = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe('Collection id, Tote link, or exact name');

export function createTools(env: ToolEnvironment): ModelContextTool[] {
  const { queryClient } = env;
  const origin = window.location.origin;

  const currentCollectionId = () =>
    collectionIdFrom(window.location.pathname) ?? undefined;

  return [
    toTool({
      name: 'get_current_view',
      description:
        'What the user is looking at in Tote right now: the collection list or one collection.',
      readOnly: true,
      untrustedContent: true,
      input: z.strictObject({}),
      run: async () => {
        const collectionId = currentCollectionId();
        if (!collectionId) {
          return { view: 'other', path: window.location.pathname };
        }
        const detail = await loadDetail(queryClient, collectionId);
        return { view: 'collection', ...summarizeCollection(detail, origin) };
      },
    }),

    toTool({
      name: 'list_collections',
      description:
        "List the user's collections with ids, names, item counts and the user's role.",
      readOnly: true,
      untrustedContent: true,
      input: z.strictObject({}),
      run: async () => {
        const summaries: CollectionSummary[] = await loadSummaries(queryClient);
        return {
          collections: summaries.map((summary) => ({
            id: summary.id,
            name: summary.name,
            description: summary.description,
            itemCount: summary.itemCount,
            role: summary.role,
            url: `${origin}/collections/${summary.id}`,
          })),
        };
      },
    }),

    toTool({
      name: 'get_collection',
      description:
        'Read one collection: its sections and items with ids, titles, links, prices and notes.',
      readOnly: true,
      untrustedContent: true,
      input: z.strictObject({ collection: collectionRef }),
      run: async ({ collection }) =>
        summarizeCollection(
          await loadCollection(queryClient, collection),
          origin,
        ),
    }),

    toTool({
      name: 'open_collection',
      description: 'Show a collection on the page so the user can see it.',
      readOnly: true,
      input: z.strictObject({ collection: collectionRef }),
      run: async ({ collection }) => {
        const detail = await loadCollection(queryClient, collection);
        env.navigate(`/collections/${detail.collection.id}`);
        return { opened: `${origin}/collections/${detail.collection.id}` };
      },
    }),

    toTool({
      name: 'add_collection',
      description: 'Add a new private collection for the user.',
      readOnly: false,
      input: z.strictObject({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional(),
      }),
      run: async ({ name, description }) => {
        const id = crypto.randomUUID();
        await runMutation(
          queryClient,
          createCollectionOptions(queryClient, { ownerUserId: env.userId() }),
          {
            id,
            mutationId: crypto.randomUUID(),
            name,
            description: description || undefined,
            positionKey: positionKeyFor(id),
          },
        );
        return { id, name, url: `${origin}/collections/${id}` };
      },
    }),

    toTool({
      name: 'add_section',
      description: 'Add a section (a group of items) to a collection.',
      readOnly: false,
      input: z.strictObject({
        collection: collectionRef,
        title: z.string().trim().min(1).max(500),
      }),
      run: async ({ collection, title }) => {
        const detail = await loadCollection(queryClient, collection);
        requireEdit(detail);
        const id = crypto.randomUUID();
        await runMutation(
          queryClient,
          createItemOptions(queryClient, detail.collection.id, {
            createdByUserId: env.userId(),
          }),
          {
            collectionId: detail.collection.id,
            input: {
              id,
              mutationId: crypto.randomUUID(),
              type: 'section',
              title,
              parentId: null,
              properties: {},
              positionKey: positionKeyFor(id),
              addedVia: 'agent',
            },
          },
        );
        return { id, title };
      },
    }),

    toTool({
      name: 'add_item',
      description:
        'Add a product link (with url) or a note (title only) to a collection. Title, image and price are read from the url when available.',
      readOnly: false,
      untrustedContent: true,
      input: z.strictObject({
        collection: collectionRef,
        url: z.url().max(2000).optional(),
        title: z.string().trim().min(1).max(500).optional(),
        note: z.string().trim().max(5000).optional(),
        section: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Section id or exact title'),
      }),
      run: async ({ collection, url, title, note, section }) => {
        if (!url && !title) {
          throw new ToolInputError('Provide a url, a title, or both.');
        }
        const detail = await loadCollection(queryClient, collection);
        requireEdit(detail);
        const parentId = section
          ? resolveSection(section, detail.nodes).id
          : null;

        const properties: Record<string, unknown> = {};
        let resolvedTitle = title;
        if (url) {
          properties.url = url;
          const { metadata } = await extractItemMetadata(
            url,
            await checkExtensionAvailable(),
          );
          if (metadata?.imageUrl) properties.imageUrl = metadata.imageUrl;
          if (metadata?.description) {
            properties.description = metadata.description;
          }
          if (metadata?.price) properties.price = metadata.price;
          resolvedTitle ??= metadata?.title ?? new URL(url).hostname;
        }
        if (note) properties.body = note;

        const id = crypto.randomUUID();
        await runMutation(
          queryClient,
          createItemOptions(queryClient, detail.collection.id, {
            createdByUserId: env.userId(),
          }),
          {
            collectionId: detail.collection.id,
            input: {
              id,
              mutationId: crypto.randomUUID(),
              type: url ? 'product' : 'note',
              title: resolvedTitle,
              parentId,
              properties,
              positionKey: positionKeyFor(id),
              addedVia: 'agent',
            },
          },
        );
        const created = (
          await loadDetail(queryClient, detail.collection.id)
        ).nodes.find((node) => node.id === id);
        return created ? summarizeItem(created) : { id, title: resolvedTitle };
      },
    }),

    toTool({
      name: 'update_item',
      description:
        "Change an item's title, link, price or note, or move it to a section (section: null removes it from its section). Fields left out stay as they are.",
      readOnly: false,
      untrustedContent: true,
      input: z.strictObject({
        collection: collectionRef,
        item: z.string().trim().min(1).describe('Item id from get_collection'),
        title: z.string().trim().min(1).max(500).optional(),
        url: z.url().max(2000).optional(),
        price: z.string().trim().max(50).optional(),
        note: z.string().trim().max(5000).optional(),
        section: z
          .string()
          .trim()
          .min(1)
          .nullable()
          .optional()
          .describe('Section id or exact title, or null'),
      }),
      run: async ({ collection, item, title, url, price, note, section }) => {
        const detail = await loadCollection(queryClient, collection);
        requireEdit(detail);
        const node = resolveItem(item, detail.nodes);
        // The server replaces properties, so start from what's there.
        const properties = { ...(node.properties as Record<string, unknown>) };
        if (url !== undefined) properties.url = url;
        if (price !== undefined) properties.price = price || undefined;
        if (note !== undefined) properties.body = note || undefined;
        await runMutation(
          queryClient,
          updateItemOptions(queryClient, detail.collection.id),
          {
            collectionId: detail.collection.id,
            nodeId: node.id,
            input: {
              expectedVersion: node.version,
              mutationId: crypto.randomUUID(),
              ...(title !== undefined ? { title } : {}),
              ...(section !== undefined
                ? {
                    parentId:
                      section === null
                        ? null
                        : resolveSection(section, detail.nodes).id,
                  }
                : {}),
              properties,
            },
          },
        );
        const updated = (
          await loadDetail(queryClient, detail.collection.id)
        ).nodes.find((candidate) => candidate.id === node.id);
        return updated ? summarizeItem(updated) : { id: node.id };
      },
    }),

    toTool({
      name: 'delete_item',
      description:
        'Delete one item from a collection. Sections and collections cannot be deleted with this tool.',
      readOnly: false,
      consequential: true,
      input: z.strictObject({
        collection: collectionRef,
        item: z.string().trim().min(1).describe('Item id from get_collection'),
      }),
      run: async ({ collection, item }) => {
        const detail = await loadCollection(queryClient, collection);
        requireEdit(detail);
        const node = resolveItem(item, detail.nodes);
        await runMutation(
          queryClient,
          deleteItemOptions(queryClient, detail.collection.id),
          {
            collectionId: detail.collection.id,
            nodeId: node.id,
            input: {
              expectedVersion: node.version,
              mutationId: crypto.randomUUID(),
            },
          },
        );
        return { deleted: node.id, title: node.title };
      },
    }),
  ];
}
