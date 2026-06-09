export const collectionQueryKeys = {
	all: ["collections"] as const,
	detail: (collectionId: string) => ["collections", collectionId] as const,
	team: (collectionId: string) =>
		["collections", collectionId, "team"] as const,
};

export const collectionMutationKeys = {
	create: ["collections", "create"] as const,
	update: ["collections", "update"] as const,
	delete: ["collections", "delete"] as const,
	createNode: ["collections", "nodes", "create"] as const,
	updateNode: ["collections", "nodes", "update"] as const,
	deleteNode: ["collections", "nodes", "delete"] as const,
};
