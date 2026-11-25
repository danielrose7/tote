import { createMcpHandler } from 'mcp-handler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionNode } from '@/db/schema';
import type { CollectionDetail } from '@/lib/collections/repository';
import { registerMcpTools } from './tools';

// Clerk brands verified tokens in a private WeakSet; stand in for it here.
vi.mock('@clerk/mcp-tools/next', () => ({
  isClerkAuthInfo: (authInfo?: { extra?: { userId?: unknown } }) =>
    typeof authInfo?.extra?.userId === 'string',
  requireAdditionalScopes: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn() }));
vi.mock('@/app/lib/extractors', () => ({
  extractMetadata: vi.fn(async () => ({
    title: 'Dutch oven',
    imageUrl: 'https://shop.test/oven.jpg',
    price: '99',
  })),
}));

const commands = vi.hoisted(() => ({
  listCollections: vi.fn(),
  getCollection: vi.fn(),
  createCollection: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock('@/lib/commands/collections/server', () => ({
  listCollectionsCommand: { run: commands.listCollections },
  getCollectionCommand: { run: commands.getCollection },
  createCollectionCommand: { run: commands.createCollection },
}));
vi.mock('@/lib/commands/items/server', () => ({
  createItemCommand: { run: commands.createItem },
  updateItemCommand: { run: commands.updateItem },
  deleteItemCommand: { run: commands.deleteItem },
}));

const collectionId = '0b6c7e4e-1c0a-4c8f-9a51-6f2f1d0e9a11';
const section = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  collectionId,
  parentId: null,
  type: 'section',
  title: 'Pans',
  properties: {},
  positionKey: '0',
  version: 1,
} as unknown as CollectionNode;
const pan = {
  ...section,
  id: 'a1b2c3d4-0000-4000-8000-000000000002',
  parentId: section.id,
  type: 'product',
  title: 'Skillet',
  properties: { url: 'https://shop.test/skillet' },
  positionKey: '1',
  version: 3,
} as unknown as CollectionNode;

function detail(role = 'owner', nodes = [section, pan]): CollectionDetail {
  return {
    collection: { id: collectionId, name: 'Kitchen', itemCount: 1 },
    role,
    nodes,
    lineage: [],
  } as unknown as CollectionDetail;
}

const handler = createMcpHandler(registerMcpTools, {
  serverInfo: { name: 'tote', version: 'test' },
});

const signedIn = {
  token: 't',
  clientId: 'c',
  scopes: [],
  extra: { userId: 'user_1' },
};

async function rpc(
  method: string,
  params: Record<string, unknown>,
  auth: unknown = signedIn,
) {
  const request = new Request('https://tote.tools/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  (request as Request & { auth?: unknown }).auth = auth;
  const body = await (await handler(request)).text();
  const data = body
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length);
  return JSON.parse(data ?? body).result;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  auth?: unknown,
) {
  const result = await rpc('tools/call', { name, arguments: args }, auth);
  const text = result.content[0].text as string;
  return {
    isError: result.isError === true,
    text,
    json: () => JSON.parse(text),
  };
}

beforeEach(() => {
  for (const command of Object.values(commands)) command.mockReset();
  commands.listCollections.mockResolvedValue({
    status: 'ok',
    value: {
      collections: [
        { id: collectionId, name: 'Kitchen', itemCount: 1, role: 'owner' },
      ],
    },
  });
  commands.getCollection.mockResolvedValue({ status: 'ok', value: detail() });
});

describe('remote MCP tools', () => {
  it('lists the server-side tools from the shared catalog', async () => {
    const { tools } = await rpc('tools/list', {});
    expect(tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      'add_collection',
      'add_item',
      'add_section',
      'delete_item',
      'get_collection',
      'list_collections',
      'update_item',
    ]);
    const deleteTool = tools.find(
      (tool: { name: string }) => tool.name === 'delete_item',
    );
    expect(deleteTool.annotations).toMatchObject({ destructiveHint: true });
    expect(deleteTool.inputSchema).toMatchObject({
      additionalProperties: false,
    });
  });

  it('reads a collection by name as the authorized user', async () => {
    const result = await callTool('get_collection', { collection: 'kitchen' });
    expect(result.isError).toBe(false);
    expect(result.json()).toMatchObject({
      name: 'Kitchen',
      url: `https://tote.tools/collections/${collectionId}`,
      sections: [{ title: 'Pans', items: [{ title: 'Skillet' }] }],
    });
    expect(commands.getCollection.mock.calls[0][0]).toMatchObject({
      userId: 'user_1',
    });
  });

  it('adds an item with page details, recorded as added by an agent', async () => {
    commands.createItem.mockImplementation(async (_context, _target, input) => {
      commands.getCollection.mockResolvedValue({
        status: 'ok',
        value: detail('owner', [
          section,
          pan,
          {
            ...pan,
            id: input.id,
            title: input.title,
            properties: input.properties,
          },
        ]),
      });
      return { status: 'ok', value: { id: input.id } };
    });
    const result = await callTool('add_item', {
      collection: collectionId,
      url: 'https://shop.test/oven',
      section: 'Pans',
    });
    expect(result.isError).toBe(false);
    const [context, target, input] = commands.createItem.mock.calls[0];
    expect(target).toEqual({ collectionId });
    expect(input).toMatchObject({
      type: 'product',
      title: 'Dutch oven',
      parentId: section.id,
      addedVia: 'agent',
      properties: { url: 'https://shop.test/oven', price: '99' },
    });
    expect(context.addedVia()).toBe('agent');
    expect(result.json()).toMatchObject({ title: 'Dutch oven', price: '99' });
  });

  it('updates with the current version and keeps other properties', async () => {
    commands.updateItem.mockResolvedValue({ status: 'ok', value: {} });
    await callTool('update_item', {
      collection: collectionId,
      item: pan.id,
      price: '45',
    });
    expect(commands.updateItem.mock.calls[0][2]).toMatchObject({
      expectedVersion: 3,
      properties: { url: 'https://shop.test/skillet', price: '45' },
    });
  });

  it('turns command failures into agent-readable errors', async () => {
    commands.updateItem.mockResolvedValue({ status: 'version_conflict' });
    const result = await callTool('update_item', {
      collection: collectionId,
      item: pan.id,
      title: 'x',
    });
    expect(result).toMatchObject({ isError: true });
    expect(result.text).toMatch(/get_collection/);
  });

  it('refuses writes for viewers without calling the command', async () => {
    commands.getCollection.mockResolvedValue({
      status: 'ok',
      value: detail('viewer'),
    });
    const result = await callTool('delete_item', {
      collection: collectionId,
      item: pan.id,
    });
    expect(result.text).toMatch(/view this collection but not change it/);
    expect(commands.deleteItem).not.toHaveBeenCalled();
  });

  it('does nothing without a verified user', async () => {
    const result = await callTool('list_collections', {}, null);
    expect(result).toMatchObject({ isError: true });
    expect(commands.listCollections).not.toHaveBeenCalled();
  });
});
