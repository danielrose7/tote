import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionNode } from '@/db/schema';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';
import type { ModelContextTool } from './modelContext';
import { createTools } from './tools';

vi.mock('@/lib/extension', () => ({
  checkExtensionAvailable: async () => false,
  refreshViaExtension: async () => null,
}));

const collectionId = '0b6c7e4e-1c0a-4c8f-9a51-6f2f1d0e9a11';
// Tools whose output includes scraped or other-member text.
const UNTRUSTED_OUTPUT = [
  'get_current_view',
  'list_collections',
  'get_collection',
  'add_item',
  'update_item',
];
const READ_TOOLS = [
  'get_current_view',
  'list_collections',
  'get_collection',
  'open_collection',
];

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
  properties: { url: 'https://shop.test/skillet', price: '40' },
  positionKey: '1',
  version: 3,
} as unknown as CollectionNode;

function detail(role: CollectionDetail['role'] = 'owner'): CollectionDetail {
  return {
    collection: {
      id: collectionId,
      name: 'Kitchen',
      description: null,
      itemCount: 1,
      version: 7,
    },
    role,
    nodes: [section, pan],
    lineage: [],
  } as unknown as CollectionDetail;
}

let queryClient: QueryClient;
let navigate: ReturnType<typeof vi.fn<(path: string) => void>>;
let fetchMock: ReturnType<typeof vi.fn>;
let tools: Map<string, ModelContextTool>;

function seed(role: CollectionDetail['role'] = 'owner') {
  queryClient.setQueryData(collectionQueryKeys.all, [
    { id: collectionId, name: 'Kitchen', itemCount: 1, role },
  ] as unknown as CollectionSummary[]);
  queryClient.setQueryData(
    collectionQueryKeys.detail(collectionId),
    detail(role),
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function call(name: string, input: Record<string, unknown> = {}) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.execute(input);
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: {
      origin: 'https://tote.tools',
      pathname: `/collections/${collectionId}`,
    },
  });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  navigate = vi.fn();
  tools = new Map(
    createTools({ queryClient, userId: () => 'user_1', navigate }).map(
      (tool) => [tool.name, tool],
    ),
  );
  seed();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tool catalog', () => {
  it('declares annotations and closed object schemas on every tool', () => {
    for (const tool of tools.values()) {
      expect(tool.annotations).toEqual({
        readOnlyHint: READ_TOOLS.includes(tool.name),
        untrustedContentHint: UNTRUSTED_OUTPUT.includes(tool.name),
        consequentialHint: tool.name === 'delete_item',
      });
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(tool.inputSchema).not.toHaveProperty('$schema');
      expect(tool.description.length).toBeLessThan(200);
    }
    expect(tools.size).toBeLessThanOrEqual(9);
  });
});

describe('read tools', () => {
  it('describe the collection on screen without hitting the network', async () => {
    const view = (await call('get_current_view')) as {
      view: string;
      name: string;
      sections: { items: { title: string }[] }[];
    };
    expect(view.view).toBe('collection');
    expect(view.sections[0].items[0].title).toBe('Skillet');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolve collections by name and navigate on open', async () => {
    await call('open_collection', { collection: 'kitchen' });
    expect(navigate).toHaveBeenCalledWith(`/collections/${collectionId}`);
  });

  it('reject unknown input fields', async () => {
    await expect(
      call('get_collection', { collection: 'Kitchen', extra: true }),
    ).rejects.toThrow(/Invalid input/);
  });
});

describe('add_item', () => {
  it('reads the page, adds the item to the section as the agent, and shows it at once', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/extract') {
        return jsonResponse({
          title: 'Dutch oven',
          imageUrl: 'https://shop.test/oven.jpg',
          price: '99',
        });
      }
      const body = JSON.parse(String(init?.body));
      return jsonResponse(
        { id: body.id, version: 1, collectionVersion: 8, itemCount: 2 },
        201,
      );
    });

    const result = await call('add_item', {
      collection: collectionId,
      url: 'https://shop.test/oven',
      section: 'pans',
    });

    const [, request] = fetchMock.mock.calls.find(
      ([url]) => url === `/api/v2/collections/${collectionId}/nodes`,
    ) as [string, RequestInit];
    const sent = JSON.parse(String(request.body));
    expect(sent).toMatchObject({
      type: 'product',
      title: 'Dutch oven',
      parentId: section.id,
      addedVia: 'agent',
      properties: {
        url: 'https://shop.test/oven',
        imageUrl: 'https://shop.test/oven.jpg',
        price: '99',
      },
    });
    expect(result).toMatchObject({ title: 'Dutch oven', price: '99' });
    const cached = queryClient.getQueryData<CollectionDetail>(
      collectionQueryKeys.detail(collectionId),
    );
    expect(cached?.nodes.some((node) => node.id === sent.id)).toBe(true);
  });

  it('needs a url or a title', async () => {
    await expect(call('add_item', { collection: 'Kitchen' })).rejects.toThrow(
      /url, a title/,
    );
  });
});

describe('update_item', () => {
  it('keeps existing properties and sends the cached version', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ version: 4, collectionVersion: 8, itemCount: 1 }),
    );
    await call('update_item', {
      collection: 'Kitchen',
      item: pan.id,
      note: 'Get the 12 inch one',
      section: null,
    });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v2/collections/${collectionId}/nodes/${pan.id}`);
    expect(JSON.parse(String(request.body))).toMatchObject({
      expectedVersion: 3,
      parentId: null,
      properties: {
        url: 'https://shop.test/skillet',
        price: '40',
        body: 'Get the 12 inch one',
      },
    });
  });

  it('turns a version conflict into an instruction to re-read', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'Version conflict', code: 'version_conflict' },
        409,
      ),
    );
    await expect(
      call('update_item', { collection: 'Kitchen', item: pan.id, title: 'x' }),
    ).rejects.toThrow(/get_collection/);
  });
});

describe('write guards', () => {
  it('refuses writes for viewers before calling the server', async () => {
    seed('viewer');
    await expect(
      call('delete_item', { collection: 'Kitchen', item: pan.id }),
    ).rejects.toThrow(/view this collection but not change it/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('will not delete a section through delete_item', async () => {
    await expect(
      call('delete_item', { collection: 'Kitchen', item: section.id }),
    ).rejects.toThrow(/No item/);
  });
});
