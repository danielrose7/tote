import type { CollectionSyncIssue } from "./queryPersistence";

export const collectionSyncIssueEvent = "tote:collection-sync-issues";

export function collectionMutationLabel(
	mutationKey: readonly unknown[] | undefined,
): string {
	if (!mutationKey) return "Collection change";
	const key = mutationKey.join(":");
	if (key.includes("transfer-ownership")) return "Ownership transfer";
	if (key.includes("invites:create")) return "Invite creation";
	if (key.includes("invites:revoke")) return "Invite revocation";
	if (key.includes("members:update")) return "Member role change";
	if (key.includes("members:remove")) return "Member removal";
	if (key.includes("nodes:reorder")) return "Content reorder";
	if (key.includes("nodes:create")) return "Content creation";
	if (key.includes("nodes:update")) return "Content update";
	if (key.includes("nodes:delete")) return "Content deletion";
	if (key.endsWith(":create")) return "Collection creation";
	if (key.endsWith(":update")) return "Collection update";
	if (key.endsWith(":delete")) return "Collection deletion";
	return "Collection change";
}

export function notifyCollectionSyncIssues(
	userId: string,
	issues?: CollectionSyncIssue[],
) {
	window.dispatchEvent(
		new CustomEvent(collectionSyncIssueEvent, {
			detail: { userId, issues },
		}),
	);
}
