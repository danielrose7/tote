import {
  MutationObserver,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import {
  type AgentToolSpec,
  addCollectionTool,
  addItemTool,
  addSectionTool,
  deleteItemTool,
  describeInputError,
  getCollectionTool,
  getCurrentViewTool,
  listCollectionsTool,
  openCollectionTool,
  updateItemTool,
} from '@/lib/agentTools/catalog';
import {
  itemUpdateFields,
  newItemFields,
  positionKeyFor,
} from '@/lib/agentTools/itemChanges';
import {
  collectionIdFrom,
  resolveCollection,
  resolveItem,
  summarizeCollection,
  summarizeItem,
  ToolInputError,
} from '@/lib/agentTools/resolve';
import {
  CollectionRequestError,
  fetchCollectionDetail,
  fetchCollectionSummaries,
} from '@/lib/collections/client';
import { roleCan } from '@/lib/collections/permissions';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import type { CollectionDetail } from '@/lib/collections/repository';
import { createCollectionOptions } from '@/lib/commands/collections/mutations';
import {
  createItemOptions,
  deleteItemOptions,
  updateItemOptions,
} from '@/lib/commands/items/mutations';
import { checkExtensionAvailable } from '@/lib/extension';
import { extractItemMetadata } from '@/lib/extractItem';
import type { ModelContextTool } from './modelContext';

/**
 * Tote's WebMCP tools: what an agent in the user's browser (ChatGPT's
 * built-in browser, agent-browser, Brave Leo, ...) can do on this page.
 * Names, descriptions and schemas come from the shared agent tool catalog.
 *
 * Every write goes through the same command options as the UI, so the user
 * sees the agent's change appear instantly, failures roll back, and writes to
 * one collection stay in order. The server still enforces permissions and
 * versions; the checks here only give the agent clearer errors.
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

function toTool<Schema extends z.ZodObject>(
  spec: AgentToolSpec<Schema>,
  run: (input: z.infer<Schema>) => Promise<unknown>,
): ModelContextTool {
  const { $schema: _dialect, ...inputSchema } = z.toJSONSchema(spec.input, {
    io: 'input',
  });
  return {
    name: spec.name,
    description: spec.description,
    inputSchema,
    annotations: {
      readOnlyHint: spec.hints.readOnly,
      untrustedContentHint: spec.hints.untrustedContent,
      consequentialHint: spec.hints.consequential,
    },
    execute: async (rawInput) => {
      const parsed = spec.input.safeParse(rawInput ?? {});
      if (!parsed.success) throw new Error(describeInputError(parsed.error));
      try {
        return await run(parsed.data);
      } catch (error) {
        throw new Error(agentMessage(error));
      }
    },
  };
}

export function createTools(env: ToolEnvironment): ModelContextTool[] {
  const { queryClient } = env;
  const origin = window.location.origin;

  const findItem = async (collectionId: string, itemId: string) =>
    (await loadDetail(queryClient, collectionId)).nodes.find(
      (node) => node.id === itemId,
    );

  return [
    toTool(getCurrentViewTool, async () => {
      const collectionId = collectionIdFrom(window.location.pathname);
      if (!collectionId) {
        return { view: 'other', path: window.location.pathname };
      }
      const detail = await loadDetail(queryClient, collectionId);
      return { view: 'collection', ...summarizeCollection(detail, origin) };
    }),

    toTool(listCollectionsTool, async () => ({
      collections: (await loadSummaries(queryClient)).map((summary) => ({
        id: summary.id,
        name: summary.name,
        description: summary.description,
        itemCount: summary.itemCount,
        role: summary.role,
        url: `${origin}/collections/${summary.id}`,
      })),
    })),

    toTool(getCollectionTool, async ({ collection }) =>
      summarizeCollection(
        await loadCollection(queryClient, collection),
        origin,
      ),
    ),

    toTool(openCollectionTool, async ({ collection }) => {
      const detail = await loadCollection(queryClient, collection);
      env.navigate(`/collections/${detail.collection.id}`);
      return { opened: `${origin}/collections/${detail.collection.id}` };
    }),

    toTool(addCollectionTool, async ({ name, description }) => {
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
    }),

    toTool(addSectionTool, async ({ collection, title }) => {
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
    }),

    toTool(addItemTool, async (input) => {
      if (!input.url && !input.title) {
        throw new ToolInputError('Provide a url, a title, or both.');
      }
      const detail = await loadCollection(queryClient, input.collection);
      requireEdit(detail);
      const metadata = input.url
        ? (
            await extractItemMetadata(
              input.url,
              await checkExtensionAvailable(),
            )
          ).metadata
        : null;
      const fields = newItemFields(input, detail.nodes, metadata);
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
            ...fields,
            positionKey: positionKeyFor(id),
            addedVia: 'agent',
          },
        },
      );
      const created = await findItem(detail.collection.id, id);
      return created ? summarizeItem(created) : { id, title: fields.title };
    }),

    toTool(updateItemTool, async (input) => {
      const detail = await loadCollection(queryClient, input.collection);
      requireEdit(detail);
      const node = resolveItem(input.item, detail.nodes);
      await runMutation(
        queryClient,
        updateItemOptions(queryClient, detail.collection.id),
        {
          collectionId: detail.collection.id,
          nodeId: node.id,
          input: {
            expectedVersion: node.version,
            mutationId: crypto.randomUUID(),
            ...itemUpdateFields(node, input, detail.nodes),
          },
        },
      );
      const updated = await findItem(detail.collection.id, node.id);
      return updated ? summarizeItem(updated) : { id: node.id };
    }),

    toTool(deleteItemTool, async ({ collection, item }) => {
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
    }),
  ];
}
