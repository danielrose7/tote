import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { MutationResult } from '@/lib/collections/repository';
import {
  type CommandAnnotations,
  collectionTarget,
  defineCommand,
} from './command';
import { commandRoute } from './http';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: async () => ({ username: 'dana' }),
}));

const collectionId = '00000000-0000-4000-8000-000000000001';

function testCommand(
  result: MutationResult<{ id: string }>,
  annotations: CommandAnnotations = {},
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
    const created = testCommand(
      { status: 'ok', value: { id: 'a' } },
      { idempotent: true },
    );
    const first = await call(
      commandRoute(created.command, { target, created: true }),
    );
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ id: 'a', replayed: false });

    const replayed = testCommand(
      { status: 'ok', value: { id: 'a' }, replayed: true },
      { idempotent: true },
    );
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

  it('returns non-idempotent results as-is, 201 when created', async () => {
    const { command } = testCommand({ status: 'ok', value: { id: 'a' } });
    const response = await call(
      commandRoute(command, { target, created: true }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'a' });
  });

  it('gives commands a lazy username lookup', async () => {
    const { command, run } = testCommand({ status: 'ok', value: { id: 'a' } });
    await call(commandRoute(command, { target }));
    const [context] = run.mock.calls[0] as unknown as [
      { username: () => Promise<string | undefined> },
    ];
    await expect(context.username()).resolves.toBe('dana');
  });

  it('uses command-declared failure responses and extra statuses', async () => {
    const command = defineCommand({
      name: 'test.custom',
      description: 'Custom failures',
      annotations: {},
      target: collectionTarget,
      failures: {
        not_found: {
          status: 404,
          body: { error: 'Gone', code: 'invite_unavailable' },
        },
        slug_conflict: { status: 409, body: { error: 'Taken' } },
      },
      run: vi
        .fn<
          () => Promise<{ status: 'not_found' } | { status: 'slug_conflict' }>
        >()
        .mockResolvedValueOnce({ status: 'not_found' })
        .mockResolvedValueOnce({ status: 'slug_conflict' }),
    });
    const handler = commandRoute(command, { target });
    const missing = await call(handler);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: 'Gone',
      code: 'invite_unavailable',
    });
    const taken = await call(handler);
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'Taken' });
  });

  it('answers 500 for a status nobody mapped', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const command = defineCommand({
      name: 'test.unmapped',
      description: 'Unmapped',
      annotations: {},
      target: collectionTarget,
      run: async () => ({ status: 'mystery' as never }),
    });
    const response = await call(commandRoute(command, { target }));
    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
