import { collectionQueryKeys } from "./queryKeys";

export type AblyCapability = Record<string, ["subscribe"]>;

export function collectionRealtimeCapabilities(
	userId: string,
	collectionIds: string[],
): AblyCapability {
	return Object.fromEntries(
		[
			`user:${userId}:collections`,
			...Array.from(new Set(collectionIds)).map((id) => `collection:${id}`),
		].map((channel) => [channel, ["subscribe"] as ["subscribe"]]),
	);
}

export function realtimeInvalidationKeys(channelName: string) {
	if (channelName.startsWith("user:") && channelName.endsWith(":collections")) {
		return [collectionQueryKeys.all];
	}
	if (!channelName.startsWith("collection:")) return [];
	const collectionId = channelName.slice("collection:".length);
	if (!collectionId) return [];
	return [
		collectionQueryKeys.all,
		collectionQueryKeys.detail(collectionId),
		collectionQueryKeys.team(collectionId),
		collectionQueryKeys.publication(collectionId),
	];
}
