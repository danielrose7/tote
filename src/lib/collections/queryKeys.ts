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
	reorderNodes: ["collections", "nodes", "reorder"] as const,
	createInvite: ["collections", "team", "invites", "create"] as const,
	revokeInvite: ["collections", "team", "invites", "revoke"] as const,
	updateMember: ["collections", "team", "members", "update"] as const,
	removeMember: ["collections", "team", "members", "remove"] as const,
	transferOwnership: ["collections", "team", "transfer-ownership"] as const,
};
