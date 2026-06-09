export const collectionQueryKeys = {
	all: ["collections"] as const,
	detail: (collectionId: string) => ["collections", collectionId] as const,
	team: (collectionId: string) =>
		["collections", collectionId, "team"] as const,
};

export const collectionMutationKeys = {
	create: ["collections", "create"] as const,
};
