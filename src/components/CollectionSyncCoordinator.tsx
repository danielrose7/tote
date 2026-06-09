"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { CollectionRequestError } from "../lib/collections/client";
import { collectionQueryKeys } from "../lib/collections/queryKeys";
import { recordCollectionSyncIssue } from "../lib/collections/queryPersistence";
import type { CollectionSummary } from "../lib/collections/repository";
import {
	collectionMutationLabel,
	notifyCollectionSyncIssues,
} from "../lib/collections/syncStatus";

type CollectionSyncMessage = {
	type: "mutation-accepted";
	senderId: string;
	collectionId: string | null;
};

function collectionIdFromMutation(
	variables: unknown,
	data: unknown,
): string | null {
	if (
		typeof variables === "object" &&
		variables !== null &&
		"collectionId" in variables &&
		typeof variables.collectionId === "string"
	) {
		return variables.collectionId;
	}
	if (
		typeof data === "object" &&
		data !== null &&
		"id" in data &&
		typeof data.id === "string"
	) {
		return data.id;
	}
	return null;
}

export function CollectionSyncCoordinator({ userId }: { userId: string }) {
	const queryClient = useQueryClient();
	const senderId = useRef(crypto.randomUUID());

	useEffect(() => {
		const channel =
			typeof BroadcastChannel === "undefined"
				? null
				: new BroadcastChannel(`tote-collections:${userId}`);
		const invalidateCollections = (collectionId: string | null) => {
			void queryClient.invalidateQueries({
				queryKey: collectionQueryKeys.all,
			});
			if (collectionId) {
				void queryClient.invalidateQueries({
					queryKey: collectionQueryKeys.detail(collectionId),
				});
				void queryClient.invalidateQueries({
					queryKey: collectionQueryKeys.team(collectionId),
				});
			}
		};
		const purgeCollection = (collectionId: string) => {
			queryClient.removeQueries({
				queryKey: collectionQueryKeys.detail(collectionId),
			});
			queryClient.removeQueries({
				queryKey: collectionQueryKeys.team(collectionId),
			});
			queryClient.setQueryData<CollectionSummary[]>(
				collectionQueryKeys.all,
				(current) =>
					current?.filter((collection) => collection.id !== collectionId),
			);
		};
		const handleMessage = (event: MessageEvent<CollectionSyncMessage>) => {
			if (
				event.data?.type !== "mutation-accepted" ||
				event.data.senderId === senderId.current
			) {
				return;
			}
			invalidateCollections(event.data.collectionId);
		};
		channel?.addEventListener("message", handleMessage);

		const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
			if (
				event.type !== "updated" ||
				event.mutation.options.mutationKey?.[0] !== "collections"
			) {
				return;
			}
			if (event.action.type === "success") {
				channel?.postMessage({
					type: "mutation-accepted",
					senderId: senderId.current,
					collectionId: collectionIdFromMutation(
						event.mutation.state.variables,
						event.mutation.state.data,
					),
				} satisfies CollectionSyncMessage);
			}
			if (event.action.type === "error") {
				const collectionId = collectionIdFromMutation(
					event.mutation.state.variables,
					event.mutation.state.data,
				);
				if (
					collectionId &&
					event.action.error instanceof CollectionRequestError &&
					event.action.error.status === 403
				) {
					purgeCollection(collectionId);
				}
				const issue = {
					id: `${event.mutation.state.submittedAt}:${event.mutation.mutationId}`,
					operation: collectionMutationLabel(
						event.mutation.options.mutationKey,
					),
					message:
						event.action.error instanceof Error
							? event.action.error.message
							: "The server rejected this change.",
					createdAt: new Date().toISOString(),
				};
				void recordCollectionSyncIssue(userId, issue).then(() =>
					notifyCollectionSyncIssues(userId),
				);
			}
		});
		const unsubscribeQueries = queryClient
			.getQueryCache()
			.subscribe((event) => {
				if (
					event.type !== "updated" ||
					event.action.type !== "error" ||
					!(event.action.error instanceof CollectionRequestError) ||
					event.action.error.status !== 403
				) {
					return;
				}
				const [, collectionId] = event.query.queryKey;
				if (typeof collectionId === "string") purgeCollection(collectionId);
			});

		const handleOnline = () => {
			void queryClient.resumePausedMutations().finally(() => {
				invalidateCollections(null);
			});
		};
		window.addEventListener("online", handleOnline);

		return () => {
			unsubscribe();
			unsubscribeQueries();
			window.removeEventListener("online", handleOnline);
			channel?.removeEventListener("message", handleMessage);
			channel?.close();
		};
	}, [queryClient, userId]);

	return null;
}
