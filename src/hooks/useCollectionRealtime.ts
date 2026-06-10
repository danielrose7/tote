"use client";

import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { type InboundMessage, type messageCallback, Realtime } from "ably";
import { useEffect } from "react";
import { realtimeInvalidationKeys } from "../lib/collections/realtime";

export function useCollectionRealtime({
	enabled,
	collectionIds,
}: {
	enabled: boolean;
	collectionIds: string[];
}) {
	const { user } = useUser();
	const queryClient = useQueryClient();
	const collectionKey = Array.from(new Set(collectionIds)).sort().join(",");

	useEffect(() => {
		if (!enabled || !user?.id) return;
		const client = new Realtime({
			authUrl: "/api/v2/realtime/token",
			authMethod: "POST",
			echoMessages: false,
		});
		const channels = [
			`user:${user.id}:collections`,
			...collectionKey
				.split(",")
				.filter(Boolean)
				.map((collectionId) => `collection:${collectionId}`),
		];
		const listeners = new Map<string, messageCallback<InboundMessage>>();
		let cancelled = false;

		const invalidate = (channelName: string, includeIndex = true) => {
			for (const queryKey of realtimeInvalidationKeys(channelName)) {
				if (!includeIndex && queryKey.length === 1) continue;
				void queryClient.invalidateQueries({ queryKey });
			}
		};
		const subscribe = async () => {
			await Promise.all(
				channels.map(async (channelName) => {
					if (cancelled) return;
					const channel = client.channels.get(channelName);
					const listener = () => invalidate(channelName);
					listeners.set(channelName, listener);
					await channel.subscribe(listener);
				}),
			);
			if (cancelled) return;
			invalidate(`user:${user.id}:collections`);
			for (const channelName of channels) {
				if (channelName.startsWith("collection:")) {
					invalidate(channelName, false);
				}
			}
		};

		void subscribe().catch(() => {
			client.close();
		});
		return () => {
			cancelled = true;
			for (const [channelName, listener] of listeners) {
				client.channels.get(channelName).unsubscribe(listener);
			}
			client.close();
		};
	}, [collectionKey, enabled, queryClient, user?.id]);
}
