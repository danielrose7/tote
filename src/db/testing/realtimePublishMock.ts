import type { RealtimeEvent } from '@/lib/collections/realtimePublish';

/**
 * Stand-in for `@/lib/collections/realtimePublish` in integration tests.
 * Records every event instead of calling Ably. Use with:
 *
 *   vi.mock('@/lib/collections/realtimePublish', () =>
 *     import('../testing/realtimePublishMock'),
 *   );
 *
 * and clear `publishedEvents` in a `beforeEach`.
 */
export const publishedEvents: RealtimeEvent[] = [];

export async function publishRealtimeEvents(
  events: readonly RealtimeEvent[] | null | undefined,
): Promise<void> {
  if (events) publishedEvents.push(...events);
}
