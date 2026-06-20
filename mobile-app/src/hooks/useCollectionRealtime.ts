import { Realtime } from 'ably';
import { useEffect, useEffectEvent } from 'react';

const API_BASE = process.env.EXPO_PUBLIC_APP_URL ?? 'https://tote.tools';

export function useCollectionRealtime({
  collectionId,
  userId,
  getToken,
  onUpdate,
}: {
  collectionId: string;
  userId: string | null | undefined;
  getToken: () => Promise<string | null>;
  onUpdate: () => void;
}) {
  const handleUpdate = useEffectEvent(onUpdate);

  useEffect(() => {
    if (!userId) return;

    const client = new Realtime({
      authCallback: async (_, callback) => {
        try {
          const bearerToken = await getToken();
          if (!bearerToken) {
            callback(new Error('No auth token'), null);
            return;
          }
          const res = await fetch(`${API_BASE}/api/v2/realtime/token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${bearerToken}` },
          });
          const ablyToken = await res.json();
          callback(null, ablyToken);
        } catch (e) {
          callback(e as Error, null);
        }
      },
      echoMessages: false,
    });

    const channel = client.channels.get(`collection:${collectionId}`);
    let cancelled = false;

    const subscribe = async () => {
      await channel.subscribe(() => {
        if (!cancelled) handleUpdate();
      });
      // Catch up on any changes that happened before we connected
      if (!cancelled) handleUpdate();
    };

    void subscribe().catch(() => client.close());

    return () => {
      cancelled = true;
      channel.unsubscribe();
      client.close();
    };
  }, [collectionId, userId, getToken]);
}
