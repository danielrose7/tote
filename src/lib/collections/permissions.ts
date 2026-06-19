import type { CollectionMember } from "@/db/schema";

export type CollectionRole = CollectionMember["role"];
export type CollectionCapability =
	| "read"
	| "edit"
	| "publish"
	| "manage_members"
	| "delete";

const capabilitiesByRole: Record<
	CollectionRole,
	ReadonlySet<CollectionCapability>
> = {
	owner: new Set(["read", "edit", "publish", "manage_members", "delete"]),
	admin: new Set(["read", "edit", "publish", "manage_members"]),
	editor: new Set(["read", "edit"]),
	viewer: new Set(["read"]),
};

export function roleCan(
	role: CollectionRole,
	capability: CollectionCapability,
): boolean {
	return capabilitiesByRole[role].has(capability);
}
