import {
  isClerkAuthInfo,
  requireAdditionalScopes,
} from '@clerk/mcp-tools/next';
import { clerkClient } from '@clerk/nextjs/server';
import type { McpServer } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { extractMetadata } from '@/app/lib/extractors';
import {
  type AgentToolSpec,
  addCollectionTool,
  addItemTool,
  addSectionTool,
  deleteItemTool,
  getCollectionTool,
  listCollectionsTool,
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
import { roleCan } from '@/lib/collections/permissions';
import type {
  CollectionDetail,
  MutationFailure,
} from '@/lib/collections/repository';
import {
  createCollectionCommand,
  getCollectionCommand,
  listCollectionsCommand,
} from '@/lib/commands/collections/server';
import type { CommandContext, CommandResult } from '@/lib/commands/command';
import {
  createItemCommand,
  deleteItemCommand,
  updateItemCommand,
} from '@/lib/commands/items/server';
import { APP_ORIGIN, MCP_WRITE_SCOPE } from './config';

/**
 * Tote's remote MCP tools, for the user's own Claude, ChatGPT, Codex, Grok or
 * other MCP client. Names, descriptions and schemas come from the shared
 * agent tool catalog; each tool runs the same server commands as the
 * /api/v2 routes, as the user who authorized the connection.
 *
 * Browser-only tools (get_current_view, open_collection) are left out: there
 * is no page here.
 */

const FAILURE_MESSAGES: Record<MutationFailure['status'], string> = {
  not_found: 'Not found. It may have been deleted, or the user has no access.',
  forbidden: 'The user is not allowed to do this in this collection.',
  version_conflict:
    'This changed since it was read. Call get_collection and try again.',
  idempotency_conflict: 'This request was already made with different input.',
};

function unwrap<Output>(result: CommandResult<Output, string>): Output {
  if (result.status === 'ok' && 'value' in result) return result.value;
  throw new ToolInputError(
    FAILURE_MESSAGES[result.status as MutationFailure['status']] ??
      'Tote could not complete this.',
  );
}

function contextFor(userId: string): CommandContext {
  return {
    userId,
    // Everything added over MCP is recorded as added by an agent.
    addedVia: (explicit) =>
      explicit && explicit !== 'unknown' ? explicit : 'agent',
    username: async () =>
      (await (await clerkClient()).users.getUser(userId)).username ?? undefined,
  };
}

async function loadCollection(
  context: CommandContext,
  reference: string,
): Promise<CollectionDetail> {
  const collectionId =
    collectionIdFrom(reference) ??
    resolveCollection(
      reference,
      unwrap(await listCollectionsCommand.run(context, {}, undefined))
        .collections,
    ).id;
  return unwrap(
    await getCollectionCommand.run(context, { collectionId }, undefined),
  );
}

function requireEdit(detail: CollectionDetail) {
  if (!roleCan(detail.role, 'edit')) {
    throw new ToolInputError(
      'The user can view this collection but not change it.',
    );
  }
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function register<Schema extends z.ZodObject>(
  server: McpServer,
  spec: AgentToolSpec<Schema>,
  run: (context: CommandContext, input: z.infer<Schema>) => Promise<unknown>,
) {
  // registerTool's overloads can't resolve a generic schema, so hand it the
  // base type and narrow the parsed input back below.
  const inputSchema: z.ZodObject = spec.input;
  server.registerTool(
    spec.name,
    {
      description: spec.description,
      inputSchema,
      annotations: {
        readOnlyHint: spec.hints.readOnly,
        destructiveHint: spec.hints.consequential,
        openWorldHint: false,
      },
      ...(MCP_WRITE_SCOPE && !spec.hints.readOnly
        ? {
            scopeChallenge: requireAdditionalScopes(
              MCP_WRITE_SCOPE as 'collections:write',
            ),
          }
        : {}),
    },
    async (input, ctx) => {
      const authInfo = ctx.http?.authInfo;
      if (!isClerkAuthInfo(authInfo)) {
        return {
          content: [{ type: 'text', text: 'Sign in to Tote to use this.' }],
          isError: true,
        };
      }
      try {
        return text(
          await run(
            contextFor(authInfo.extra.userId),
            input as z.infer<Schema>,
          ),
        );
      } catch (error) {
        if (!(error instanceof ToolInputError)) {
          console.error(`[mcp] ${spec.name} failed`, error);
        }
        return {
          content: [
            {
              type: 'text',
              text:
                error instanceof ToolInputError
                  ? error.message
                  : 'Tote could not complete this. Try again later.',
            },
          ],
          isError: true,
        };
      }
    },
  );
}

export function registerMcpTools(server: McpServer) {
  register(server, listCollectionsTool, async (context) => ({
    collections: unwrap(
      await listCollectionsCommand.run(context, {}, undefined),
    ).collections.map((summary) => ({
      id: summary.id,
      name: summary.name,
      description: summary.description,
      itemCount: summary.itemCount,
      role: summary.role,
      url: `${APP_ORIGIN}/collections/${summary.id}`,
    })),
  }));

  register(server, getCollectionTool, async (context, { collection }) =>
    summarizeCollection(await loadCollection(context, collection), APP_ORIGIN),
  );

  register(server, addCollectionTool, async (context, input) => {
    const id = crypto.randomUUID();
    unwrap(
      await createCollectionCommand.run(
        context,
        {},
        {
          id,
          mutationId: crypto.randomUUID(),
          name: input.name,
          description: input.description || undefined,
          positionKey: positionKeyFor(id),
        },
      ),
    );
    return { id, name: input.name, url: `${APP_ORIGIN}/collections/${id}` };
  });

  register(server, addSectionTool, async (context, { collection, title }) => {
    const detail = await loadCollection(context, collection);
    requireEdit(detail);
    const id = crypto.randomUUID();
    unwrap(
      await createItemCommand.run(
        context,
        { collectionId: detail.collection.id },
        {
          id,
          mutationId: crypto.randomUUID(),
          type: 'section',
          title,
          parentId: null,
          properties: {},
          positionKey: positionKeyFor(id),
          addedVia: 'agent',
        },
      ),
    );
    return { id, title };
  });

  register(server, addItemTool, async (context, input) => {
    if (!input.url && !input.title) {
      throw new ToolInputError('Provide a url, a title, or both.');
    }
    const detail = await loadCollection(context, input.collection);
    requireEdit(detail);
    const metadata = input.url ? await extractMetadata(input.url) : null;
    const fields = newItemFields(input, detail.nodes, metadata);
    const id = crypto.randomUUID();
    unwrap(
      await createItemCommand.run(
        context,
        { collectionId: detail.collection.id },
        {
          id,
          mutationId: crypto.randomUUID(),
          ...fields,
          positionKey: positionKeyFor(id),
          addedVia: 'agent',
        },
      ),
    );
    const created = (
      await loadCollection(context, detail.collection.id)
    ).nodes.find((node) => node.id === id);
    return created ? summarizeItem(created) : { id, title: fields.title };
  });

  register(server, updateItemTool, async (context, input) => {
    const detail = await loadCollection(context, input.collection);
    requireEdit(detail);
    const node = resolveItem(input.item, detail.nodes);
    unwrap(
      await updateItemCommand.run(
        context,
        { collectionId: detail.collection.id, nodeId: node.id },
        {
          expectedVersion: node.version,
          mutationId: crypto.randomUUID(),
          ...itemUpdateFields(node, input, detail.nodes),
        },
      ),
    );
    const updated = (
      await loadCollection(context, detail.collection.id)
    ).nodes.find((candidate) => candidate.id === node.id);
    return updated ? summarizeItem(updated) : { id: node.id };
  });

  register(server, deleteItemTool, async (context, { collection, item }) => {
    const detail = await loadCollection(context, collection);
    requireEdit(detail);
    const node = resolveItem(item, detail.nodes);
    unwrap(
      await deleteItemCommand.run(
        context,
        { collectionId: detail.collection.id, nodeId: node.id },
        { expectedVersion: node.version, mutationId: crypto.randomUUID() },
      ),
    );
    return { deleted: node.id, title: node.title };
  });
}
