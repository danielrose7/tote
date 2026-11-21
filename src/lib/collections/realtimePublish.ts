import { Rest } from 'ably';

/**
 * A change notification for one realtime channel. Clients treat any message on
 * a channel as "refetch" (see realtimeInvalidationKeys), so `name` and `data`
 * are informational; the channel name is what matters.
 */
export type RealtimeEvent = {
  channel: string;
  name: string;
  data: Record<string, unknown>;
};

const PUBLISH_TIMEOUT_MS = 2_000;

let client: Rest | null = null;

function getClient(): Rest | null {
  const key = process.env.ABLY_ROOT_KEY;
  if (!key) return null;
  client ??= new Rest({ key });
  return client;
}

/**
 * Publishes change notifications after a mutation has committed.
 *
 * Call this only after the write is durable: a notification for a rolled-back
 * write would make clients refetch for nothing, and one that fires before
 * commit can race the refetch and return stale data.
 *
 * Publishing is best-effort. The mutation already succeeded, so a failure here
 * is logged rather than thrown; clients still converge on their next refetch
 * (TanStack Query staleTime, window focus, or reconnect catch-up).
 */
export async function publishRealtimeEvents(
  events: readonly RealtimeEvent[] | null | undefined,
): Promise<void> {
  if (!events || events.length === 0) return;
  const rest = getClient();
  if (!rest) return;

  const specs = events.map((event) => ({
    channels: [event.channel],
    messages: [{ name: event.name, data: event.data }],
  }));

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const results = await Promise.race([
      rest.batchPublish(specs),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${PUBLISH_TIMEOUT_MS}ms`)),
          PUBLISH_TIMEOUT_MS,
        );
      }),
    ]);
    for (const result of results) {
      for (const channelResult of result.results) {
        if ('error' in channelResult) {
          console.error(
            `[realtime] publish to ${channelResult.channel} failed:`,
            channelResult.error.message,
          );
        }
      }
    }
  } catch (error) {
    console.error(
      `[realtime] publish of ${events.length} event(s) failed:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    clearTimeout(timer);
  }
}
