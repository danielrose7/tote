import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { MutationResult } from '@/lib/collections/repository';
import { collectionTarget, defineCommand } from './command';
import { commandRoute } from './http';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));

const collectionId = '00000000-0000-4000-8000-000000000001';

function testCommand(
  result: MutationResult<{ id: string }>,
  annotations: { readOnly?: boolean } = {},
) {
  const run = vi.fn(async () => result);
  const command = defineCommand({
    name: 'test.run',
    description: 'Test command',
    annotations,
    target: collectionTarget,
    input: z.object({ name: z.string() }),
    run,
  });
  return { command, run };
}

function call(
  handler: ReturnType<
    typeof commandRoute<{ id: string }, unknown, unknown, unknown>
  >,
  { id = collectionId, body = { name: 'x' } as unknown } = {},
) {
  return handler(
    new Request('https://tote.tools/api/v2/test', {
      method: 'POST',
      headers: { origin: 'https://tote.tools' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const target = ({ id }: { id: string }) => ({ collectionId: id });

beforeEach(() => {
  authMock.mockResolvedValue({ userId: 'user_1' });
});

describe('commandRoute', () => {
  it('rejects signed-out requests before running the command', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { command, run } = testCommand({ status: 'ok', value: { id: 'a' } });
    const response = await call(commandRoute(command, { target }));
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects an invalid target, bad JSON and invalid input with 400', async () => {
    const { command, run } = testCommand({ status: 'ok', value: { id: 'a' } });
    const handler = commandRoute(command, { target });
    expect((await call(handler, { id: 'not-a-uuid' })).status).toBe(400);
    expect((await call(handler, { body: '{' })).status).toBe(400);
    const invalid = await call(handler, { body: { name: 42 } });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: 'Invalid request' });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the command with the user, parsed target and input', async () => {
    const { command, run } = testCommand({ status: 'ok', value: { id: 'a' } });
    await call(commandRoute(command, { target }));
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1' }),
      { collectionId },
      { name: 'x' },
    );
    const [context] = run.mock.calls[0] as unknown as [
      { addedVia: (explicit?: string) => string },
    ];
    expect(context.addedVia()).toBe('app');
  });

  it.each([
    ['not_found', 404, undefined],
    ['forbidden', 403, undefined],
    ['version_conflict', 409, 'version_conflict'],
    ['idempotency_conflict', 409, undefined],
  ] as const)('maps %s to %i', async (status, httpStatus, code) => {
    const { command } = testCommand({ status });
    const response = await call(commandRoute(command, { target }));
    expect(response.status).toBe(httpStatus);
    expect((await response.json()).code).toBe(code);
  });

  it('answers 201 for a new create and 200 when it was replayed', async () => {
    const created = testCommand({ status: 'ok', value: { id: 'a' } });
    const first = await call(
      commandRoute(created.command, { target, created: true }),
    );
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ id: 'a', replayed: false });

    const replayed = testCommand({
      status: 'ok',
      value: { id: 'a' },
      replayed: true,
    });
    const again = await call(
      commandRoute(replayed.command, { target, created: true }),
    );
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ id: 'a', replayed: true });
  });

  it('returns read results unchanged', async () => {
    const { command } = testCommand(
      { status: 'ok', value: { id: 'a' } },
      { readOnly: true },
    );
    const response = await call(commandRoute(command, { target }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'a' });
  });
});
