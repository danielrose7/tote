import { z } from 'zod';
import type { NodeAddedVia } from '@/db/schema/addedVia';
import { collectionIdSchema } from '@/lib/collections/api';
import type { MutationResult } from '@/lib/collections/repository';

/**
 * A command is one operation on Tote data, defined once and exposed through
 * adapters: `/api/v2` routes today (`http.ts`), and WebMCP / remote MCP tools
 * later. The definition carries what every adapter needs: a stable name, a
 * description an agent can read, behaviour hints, input schemas, and `run`.
 *
 * Input is split the way the routes and client mutations already are:
 * `target` identifies what to act on (ids from the URL), `input` is the body.
 */

export type CommandContext = {
  /** The signed-in user the command runs as. */
  userId: string;
  /** Provenance for created items; each adapter knows its own client. */
  addedVia: (explicit?: NodeAddedVia) => NodeAddedVia;
};

export type CommandAnnotations = {
  /** Reads only. Adapters return the value as-is, without `replayed`. */
  readOnly?: boolean;
  /** Removes data. Agent adapters should confirm before running it. */
  destructive?: boolean;
};

export type Command<Target, Input, Output> = {
  name: string;
  description: string;
  annotations: CommandAnnotations;
  target: z.ZodType<Target>;
  /** Omit for commands that take no body. */
  input?: z.ZodType<Input>;
  run: (
    context: CommandContext,
    target: Target,
    input: Input,
  ) => Promise<MutationResult<Output>>;
};

export function defineCommand<Target, Input = undefined, Output = unknown>(
  command: Command<Target, Input, Output>,
): Command<Target, Input, Output> {
  return command;
}

export const noTarget = z.object({});
export const collectionTarget = z.object({ collectionId: collectionIdSchema });
export const nodeTarget = z.object({
  collectionId: collectionIdSchema,
  nodeId: collectionIdSchema,
});
