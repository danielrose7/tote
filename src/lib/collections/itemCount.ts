import type { CollectionNode } from "@/db/schema";
import { isItemNodeType } from "@/db/schema";

export type ItemCountNodeState = Pick<
	CollectionNode,
	"type" | "deletedAt"
> | null;

export function itemCountContribution(node: ItemCountNodeState): number {
	if (!node || node.deletedAt !== null) return 0;
	return isItemNodeType(node.type) ? 1 : 0;
}

export function itemCountDelta(
	previous: ItemCountNodeState,
	next: ItemCountNodeState,
): number {
	return itemCountContribution(next) - itemCountContribution(previous);
}
