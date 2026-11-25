import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { parseJsonRequest } from '@/lib/collections/api';
import { inferAddedVia } from '@/lib/collections/inferAddedVia';
import type { MutationFailure } from '@/lib/collections/repository';
import type { Command } from './command';

/**
 * Exposes a command as a Next.js route handler: Clerk auth, target and body
 * validation, the command itself, and one mapping from result to HTTP status.
 *
 *   export const PATCH = commandRoute(updateCollectionCommand, {
 *     target: ({ id }: { id: string }) => ({ collectionId: id }),
 *   });
 *
 * Clients rely on the status and `code`, never on the `error` text.
 */

const FAILURE_RESPONSES: Record<
  MutationFailure['status'],
  { status: number; body: { error: string; code?: string } }
> = {
  not_found: { status: 404, body: { error: 'Not found' } },
  forbidden: { status: 403, body: { error: 'Forbidden' } },
  version_conflict: {
    status: 409,
    body: { error: 'Version conflict', code: 'version_conflict' },
  },
  idempotency_conflict: {
    status: 409,
    body: { error: 'Mutation id was already used for another request' },
  },
};

export function commandRoute<Params, Target, Input, Output>(
  command: Command<Target, Input, Output>,
  options: {
    /** Maps the route's URL params to the command's target. */
    target: (params: Params) => unknown;
    /** Answer 201 for a first-time create, 200 when it was replayed. */
    created?: boolean;
  },
) {
  return async (
    request: Request,
    context: { params: Promise<Params> },
  ): Promise<Response> => {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const target = command.target.safeParse(
      options.target(await context.params),
    );
    if (!target.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let input = undefined as Input;
    if (command.input) {
      const body = await parseJsonRequest(request);
      if (!body.success) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      const parsed = command.input.safeParse(body.data);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request', issues: parsed.error.issues },
          { status: 400 },
        );
      }
      input = parsed.data;
    }

    const result = await command.run(
      {
        userId,
        addedVia: (explicit) => inferAddedVia(request, explicit),
      },
      target.data,
      input,
    );

    if (result.status !== 'ok') {
      const failure = FAILURE_RESPONSES[result.status];
      return NextResponse.json(failure.body, { status: failure.status });
    }

    if (command.annotations.readOnly) {
      return NextResponse.json(result.value);
    }
    const replayed = result.replayed ?? false;
    return NextResponse.json(
      { ...result.value, replayed },
      { status: options.created && !replayed ? 201 : 200 },
    );
  };
}
