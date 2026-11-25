import { z } from 'zod';
import type { NodeAddedVia } from '@/db/schema/addedVia';
import { collectionIdSchema } from '@/lib/collections/api';
import type {
  MutationFailure,
  MutationSuccess,
} from '@/lib/collections/repository';

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
  /** The user's Tote username, looked up only by commands that need it. */
  username: () => Promise<string | undefined>;
};

export type CommandAnnotations = {
  /** Reads only. */
  readOnly?: boolean;
  /** Removes data or access. Agent adapters should confirm before running it. */
  destructive?: boolean;
  /**
   * Safe to retry with the same `mutationId`: a repeat returns the first
   * result with `replayed: true`, which the HTTP adapter passes on.
   */
  idempotent?: boolean;
};

/** How a failure is reported over HTTP. */
export type FailureResponse = {
  status: number;
  body: { error: string; code?: string };
};

/**
 * A command's result: the shared `MutationResult` statuses, plus any extra
 * failure statuses the command declares (e.g. `slug_conflict`).
 */
export type CommandResult<Output, Extra extends string = never> =
  | MutationSuccess<Output>
  | MutationFailure
  | { status: Extra };

export type Command<Target, Input, Output, Extra extends string = never> = {
  name: string;
  description: string;
  annotations: CommandAnnotations;
  /**
   * HTTP mapping for this command's extra failure statuses, and overrides
   * for the shared ones (e.g. a 404 with a code the client recognises).
   */
  failures?: Partial<
    Record<MutationFailure['status'] | Extra, FailureResponse>
  >;
  target: z.ZodType<Target>;
  /** Omit for commands that take no body. */
  input?: z.ZodType<Input>;
  run: (
    context: CommandContext,
    target: Target,
    input: Input,
  ) => Promise<CommandResult<Output, Extra>>;
};

export function defineCommand<
  Target,
  Input = undefined,
  Output = unknown,
  Extra extends string = never,
>(
  command: Command<Target, Input, Output, Extra>,
): Command<Target, Input, Output, Extra> {
  return command;
}

export const noTarget = z.object({});
export const collectionTarget = z.object({ collectionId: collectionIdSchema });
export const nodeTarget = z.object({
  collectionId: collectionIdSchema,
  nodeId: collectionIdSchema,
});
