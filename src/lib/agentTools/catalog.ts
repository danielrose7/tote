import { z } from 'zod';

/**
 * The agent tool catalog: names, descriptions, input schemas and behaviour
 * hints, shared by the WebMCP tools (`src/lib/webmcp/tools.ts`, run in the
 * user's browser) and the remote MCP server (`src/lib/mcp/tools.ts`, run on
 * our server). Each side supplies only how a tool runs, so agents see the same
 * tools wherever they connect from.
 *
 * Keep descriptions short: some agents put the whole catalog into the model's
 * context on every page.
 */

export type AgentToolHints = {
  /** Only reads. */
  readOnly: boolean;
  /** Output includes text scraped from shop pages or written by others. */
  untrustedContent: boolean;
  /** Hard to undo; agents should confirm with the user first. */
  consequential: boolean;
};

export type AgentToolSpec<Schema extends z.ZodObject = z.ZodObject> = {
  name: string;
  description: string;
  input: Schema;
  hints: AgentToolHints;
};

function spec<Schema extends z.ZodObject>(
  definition: AgentToolSpec<Schema>,
): AgentToolSpec<Schema> {
  return definition;
}

const READ = { readOnly: true, untrustedContent: true, consequential: false };
const WRITE = {
  readOnly: false,
  untrustedContent: false,
  consequential: false,
};

const collectionRef = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe('Collection id, Tote link, or exact name');

const itemRef = z
  .string()
  .trim()
  .min(1)
  .describe('Item id from get_collection');

export const getCurrentViewTool = spec({
  name: 'get_current_view',
  description:
    'What the user is looking at in Tote right now: the collection list or one collection.',
  input: z.strictObject({}),
  hints: READ,
});

export const listCollectionsTool = spec({
  name: 'list_collections',
  description:
    "List the user's collections with ids, names, item counts and the user's role.",
  input: z.strictObject({}),
  hints: READ,
});

export const getCollectionTool = spec({
  name: 'get_collection',
  description:
    'Read one collection: its sections and items with ids, titles, links, prices and notes.',
  input: z.strictObject({ collection: collectionRef }),
  hints: READ,
});

export const openCollectionTool = spec({
  name: 'open_collection',
  description: 'Show a collection on the page so the user can see it.',
  input: z.strictObject({ collection: collectionRef }),
  hints: { ...READ, untrustedContent: false },
});

export const addCollectionTool = spec({
  name: 'add_collection',
  description: 'Add a new private collection for the user.',
  input: z.strictObject({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
  }),
  hints: WRITE,
});

export const addSectionTool = spec({
  name: 'add_section',
  description: 'Add a section (a group of items) to a collection.',
  input: z.strictObject({
    collection: collectionRef,
    title: z.string().trim().min(1).max(500),
  }),
  hints: WRITE,
});

export const addItemTool = spec({
  name: 'add_item',
  description:
    'Add a product link (with url) or a note (title only) to a collection. Title, image and price are read from the url when available.',
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
  hints: { ...WRITE, untrustedContent: true },
});

export const updateItemTool = spec({
  name: 'update_item',
  description:
    "Change an item's title, link, price or note, or move it to a section (section: null removes it from its section). Fields left out stay as they are.",
  input: z.strictObject({
    collection: collectionRef,
    item: itemRef,
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
  hints: { ...WRITE, untrustedContent: true },
});

export const deleteItemTool = spec({
  name: 'delete_item',
  description:
    'Delete one item from a collection. Sections and collections cannot be deleted with this tool.',
  input: z.strictObject({ collection: collectionRef, item: itemRef }),
  hints: { ...WRITE, consequential: true },
});

/** Formats a schema failure for an agent. */
export function describeInputError(error: z.ZodError): string {
  return `Invalid input: ${error.issues
    .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
    .join('; ')}`;
}
