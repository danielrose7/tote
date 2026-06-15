/**
 * Block type helpers
 *
 * Provides TypeScript interfaces and helper functions for working with
 * the block-based data model.
 */

import type { co } from "jazz-tools";
import { type Account, createInviteLink, Group } from "jazz-tools";
import { Block, BlockList } from "../schema";
import { slugify } from "./slugify";

// =============================================================================
// Types
// =============================================================================

export type LoadedBlock = co.loaded<typeof Block>;

function publicCollectionData(
	data: LoadedBlock["collectionData"],
	overrides: Partial<NonNullable<LoadedBlock["collectionData"]>> = {},
): LoadedBlock["collectionData"] {
	return {
		color: data?.color,
		description: data?.description,
		viewMode: data?.viewMode,
		publicLayout: data?.publicLayout,
		budget: data?.budget,
		allowCloning: data?.allowCloning,
		childBlockIds: data?.childBlockIds,
		slug: data?.slug,
		...overrides,
	};
}

export type ProductStatus = "considering" | "selected" | "ruled-out";
export type ViewMode = "grid" | "table";
export type BlockType = "project" | "collection" | "slot" | "product";

// =============================================================================
// Type Guards
// =============================================================================

export function isProductBlock(block: LoadedBlock): boolean {
	return block.type === "product";
}

export function isSlotBlock(block: LoadedBlock): boolean {
	return block.type === "slot";
}

export function isCollectionBlock(block: LoadedBlock): boolean {
	return block.type === "collection";
}

export function isProjectBlock(block: LoadedBlock): boolean {
	return block.type === "project";
}

// =============================================================================
// Data Accessors
// =============================================================================

/** Get product data from a product block (returns undefined if not a product block) */
export function getProductData(block: LoadedBlock) {
	if (block.type !== "product") return undefined;
	return block.productData;
}

/** Get collection data from a collection block */
export function getCollectionData(block: LoadedBlock) {
	if (block.type !== "collection") return undefined;
	return block.collectionData;
}

/** Get slot data from a slot block */
export function getSlotData(block: LoadedBlock) {
	if (block.type !== "slot") return undefined;
	return block.slotData;
}

/** Get project data from a project block */
export function getProjectData(block: LoadedBlock) {
	if (block.type !== "project") return undefined;
	return block.projectData;
}

// =============================================================================
// Publishing (Draft/Publish Workflow)
// =============================================================================

/**
 * Check if a collection has been published.
 */
export function isPublished(collection: LoadedBlock): boolean {
	if (collection.type !== "collection") return false;
	return !!collection.collectionData?.publishedId;
}

/**
 * Check if a collection is a published clone (not the source draft).
 */
export function isPublishedClone(collection: LoadedBlock): boolean {
	if (collection.type !== "collection") return false;
	return !!collection.collectionData?.sourceId;
}

/**
 * Publish a collection by creating a Group-owned clone.
 * The clone is readable by "everyone" for public access.
 *
 * Returns all created blocks (collection + children) so caller can add them
 * to their blocks list for persistence.
 */
export function publishCollection(
	sourceCollection: LoadedBlock,
	_allBlocks: LoadedBlock[], // kept for API compatibility, not used
	owner: Account,
): LoadedBlock[] {
	if (sourceCollection.type !== "collection") {
		throw new Error("Can only publish collection blocks");
	}

	if (isPublished(sourceCollection)) {
		throw new Error("Collection is already published");
	}

	const createdBlocks: LoadedBlock[] = [];
	const allowCloning = sourceCollection.collectionData?.allowCloning ?? true;

	// Create a Group for the published version - everyone can read
	const group = Group.create({ owner });
	group.addMember("everyone", "reader");

	// Create the children list for the published collection
	const publishedChildrenList = BlockList.create([], { owner: group });

	// Clone the collection with the children list
	const publishedCollection = Block.create(
		{
			type: "collection",
			name: sourceCollection.name,
			collectionData: publicCollectionData(sourceCollection.collectionData, {
				publicLayout:
					sourceCollection.collectionData?.publicLayout ?? "minimal",
				allowCloning,
				sourceId: sourceCollection.$jazz.id, // Points back to draft
				publishedId: undefined, // Published clone doesn't have its own published version
				publishedAt: new Date(),
			}),
			children: publishedChildrenList,
			createdAt: sourceCollection.createdAt,
		},
		{ owner: group },
	) as LoadedBlock;

	createdBlocks.push(publishedCollection);

	// Clone children from the source collection's children list (new pattern)
	if (sourceCollection.children?.$isLoaded) {
		for (const child of sourceCollection.children) {
			if (!child || !child.$isLoaded) continue;

			if (child.type === "slot") {
				// Create children list for the slot
				const slotChildrenList = BlockList.create([], { owner: group });

				// Clone slot with its own children list
				const clonedSlot = Block.create(
					{
						type: "slot",
						name: child.name,
						slotData: child.slotData,
						children: slotChildrenList,
						sortOrder: child.sortOrder,
						createdAt: child.createdAt,
					},
					{ owner: group },
				) as LoadedBlock;

				createdBlocks.push(clonedSlot);
				publishedChildrenList.$jazz.push(clonedSlot);

				// Clone products from the slot's children list
				if (child.children?.$isLoaded) {
					for (const slotChild of child.children) {
						if (
							slotChild &&
							slotChild.$isLoaded &&
							slotChild.type === "product"
						) {
							const clonedProduct = Block.create(
								{
									type: "product",
									name: slotChild.name,
									productData: slotChild.productData,
									sortOrder: slotChild.sortOrder,
									createdAt: slotChild.createdAt,
								},
								{ owner: group },
							) as LoadedBlock;

							createdBlocks.push(clonedProduct);
							slotChildrenList.$jazz.push(clonedProduct);
						}
					}
				}
			} else if (child.type === "product") {
				// Clone product directly into the collection's children
				const clonedProduct = Block.create(
					{
						type: "product",
						name: child.name,
						productData: child.productData,
						sortOrder: child.sortOrder,
						createdAt: child.createdAt,
					},
					{ owner: group },
				) as LoadedBlock;

				createdBlocks.push(clonedProduct);
				publishedChildrenList.$jazz.push(clonedProduct);
			}
		}
	}

	// Auto-generate slug from collection name if not already set
	const slug =
		sourceCollection.collectionData?.slug || slugify(sourceCollection.name);

	// Update source collection with published ID and slug
	sourceCollection.$jazz.set("collectionData", {
		...sourceCollection.collectionData,
		allowCloning,
		publishedId: publishedCollection.$jazz.id,
		publishedAt: new Date(),
		slug,
	});

	return createdBlocks;
}

type NeonProduct = {
	title: string;
	url?: string;
	description?: string;
	price?: string;
	imageUrl?: string;
	brand?: string;
	merchant?: string;
	sortOrder: number;
};

type NeonSlot = {
	slotName: string;
	slotDescription?: string;
	sortOrder: number;
	products: NeonProduct[];
};

function serializeCollectionForNeon(collection: LoadedBlock): {
	topLevelProducts: NeonProduct[];
	slots: NeonSlot[];
} {
	const topLevelProducts: NeonProduct[] = [];
	const slots: NeonSlot[] = [];

	if (!collection.children?.$isLoaded) return { topLevelProducts, slots };

	for (const child of collection.children) {
		if (!child || !child.$isLoaded) continue;

		if (child.type === "product") {
			topLevelProducts.push({
				title: child.name,
				url: child.productData?.url,
				description: child.productData?.description,
				price: child.productData?.price,
				imageUrl: child.productData?.imageUrl,
				sortOrder: child.sortOrder ?? 0,
			});
		} else if (child.type === "slot") {
			const products: NeonProduct[] = [];
			if (child.children?.$isLoaded) {
				for (const slotChild of child.children) {
					if (
						slotChild &&
						slotChild.$isLoaded &&
						slotChild.type === "product"
					) {
						products.push({
							title: slotChild.name,
							url: slotChild.productData?.url,
							description: slotChild.productData?.description,
							price: slotChild.productData?.price,
							imageUrl: slotChild.productData?.imageUrl,
							sortOrder: slotChild.sortOrder ?? 0,
						});
					}
				}
			}
			slots.push({
				slotName: child.name,
				sortOrder: child.sortOrder ?? 0,
				products,
			});
		}
	}

	return { topLevelProducts, slots };
}

/**
 * Sync a published collection to Neon. Call after publishing, republishing, or
 * updating the slug.
 */
export async function syncPublishedCollectionToNeon(
	sourceJazzId: string,
	slug: string,
	collection: LoadedBlock,
	jazzPublishedId?: string,
	username?: string,
): Promise<void> {
	const { topLevelProducts, slots } = serializeCollectionForNeon(collection);
	await fetch("/api/collections/publish", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sourceJazzId,
			jazzPublishedId,
			slug,
			name: collection.name,
			description: collection.collectionData?.description,
			color: collection.collectionData?.color,
			layout: collection.collectionData?.publicLayout ?? "minimal",
			allowCloning: collection.collectionData?.allowCloning ?? true,
			username,
			topLevelProducts,
			slots,
		}),
	});
}

/**
 * Remove a published collection from Neon. Call when unpublishing.
 */
export async function removePublishedCollectionFromNeon(
	sourceJazzId: string,
): Promise<void> {
	await fetch("/api/collections/publish", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sourceJazzId }),
	});
}

/**
 * Unpublish a collection by clearing the publishedId reference.
 * Note: The published clone blocks will still exist but won't be linked.
 * They can be cleaned up separately if needed.
 */
export function unpublishCollection(sourceCollection: LoadedBlock): void {
	if (sourceCollection.type !== "collection") {
		throw new Error("Can only unpublish collection blocks");
	}

	const slug = sourceCollection.collectionData?.slug;

	sourceCollection.$jazz.set("collectionData", {
		...sourceCollection.collectionData,
		publishedId: undefined,
		publishedAt: undefined,
		slug: undefined,
	});

	if (sourceCollection.$jazz.id) {
		removePublishedCollectionFromNeon(sourceCollection.$jazz.id).catch(
			console.error,
		);
	}
}

/**
 * Republish a collection by updating the existing published clone in place.
 * This preserves the public URL by keeping the same published collection ID.
 * Child blocks are recreated fresh.
 *
 * Returns the newly created child blocks so caller can add them to their blocks list.
 */
export function republishCollection(
	sourceCollection: LoadedBlock,
	allBlocks: LoadedBlock[],
	owner: Account,
	_blockList: {
		$jazz: { splice: (index: number, deleteCount: number) => void };
		length: number;
		[index: number]: LoadedBlock | null;
	},
): LoadedBlock[] {
	if (sourceCollection.type !== "collection") {
		throw new Error("Can only republish collection blocks");
	}

	if (!isPublished(sourceCollection)) {
		throw new Error("Collection is not published");
	}

	const publishedId = sourceCollection.collectionData?.publishedId;
	if (!publishedId) {
		throw new Error("No published ID found");
	}

	// Find the published collection
	const publishedCollection = allBlocks.find((b) => b.$jazz.id === publishedId);

	if (!publishedCollection) {
		throw new Error("Published collection not found");
	}

	// Update the published collection's properties (preserve sourceId!)
	publishedCollection.$jazz.set("name", sourceCollection.name);

	// Create a new Group for child blocks with "everyone" as reader
	const group = Group.create({ owner });
	group.addMember("everyone", "reader");

	// Clear existing children and create a new children list
	const newChildrenList = BlockList.create([], { owner: group });
	publishedCollection.$jazz.set("children", newChildrenList);

	// Create new child blocks from source collection's children
	const createdBlocks: LoadedBlock[] = [];

	if (sourceCollection.children?.$isLoaded) {
		for (const child of sourceCollection.children) {
			if (!child || !child.$isLoaded) continue;

			if (child.type === "slot") {
				// Create children list for the slot
				const slotChildrenList = BlockList.create([], { owner: group });

				const clonedSlot = Block.create(
					{
						type: "slot",
						name: child.name,
						slotData: child.slotData,
						children: slotChildrenList,
						sortOrder: child.sortOrder,
						createdAt: child.createdAt,
					},
					{ owner: group },
				) as LoadedBlock;

				createdBlocks.push(clonedSlot);
				newChildrenList.$jazz.push(clonedSlot);

				// Clone products from the slot's children
				if (child.children?.$isLoaded) {
					for (const slotChild of child.children) {
						if (
							slotChild &&
							slotChild.$isLoaded &&
							slotChild.type === "product"
						) {
							const clonedProduct = Block.create(
								{
									type: "product",
									name: slotChild.name,
									productData: slotChild.productData,
									sortOrder: slotChild.sortOrder,
									createdAt: slotChild.createdAt,
								},
								{ owner: group },
							) as LoadedBlock;

							createdBlocks.push(clonedProduct);
							slotChildrenList.$jazz.push(clonedProduct);
						}
					}
				}
			} else if (child.type === "product") {
				const clonedProduct = Block.create(
					{
						type: "product",
						name: child.name,
						productData: child.productData,
						sortOrder: child.sortOrder,
						createdAt: child.createdAt,
					},
					{ owner: group },
				) as LoadedBlock;

				createdBlocks.push(clonedProduct);
				newChildrenList.$jazz.push(clonedProduct);
			}
		}
	}

	// Update published collection's collectionData with synced properties
	publishedCollection.$jazz.set("collectionData", {
		// Preserve critical fields
		sourceId: publishedCollection.collectionData?.sourceId,
		// Sync display properties from source
		color: sourceCollection.collectionData?.color,
		description: sourceCollection.collectionData?.description,
		viewMode: sourceCollection.collectionData?.viewMode,
		publicLayout: sourceCollection.collectionData?.publicLayout ?? "minimal",
		budget: sourceCollection.collectionData?.budget,
		allowCloning: sourceCollection.collectionData?.allowCloning ?? true,
		// Update timestamp
		publishedAt: new Date(),
	});

	// Update publishedAt on source
	sourceCollection.$jazz.set("collectionData", {
		...sourceCollection.collectionData,
		allowCloning: sourceCollection.collectionData?.allowCloning ?? true,
		publishedAt: new Date(),
	});

	return createdBlocks;
}

export type CollectionForCloning = {
	name: string;
	description: string | null;
	color: string | null;
	layout: "minimal" | "feature";
	allowCloning: boolean;
	topLevelProducts: Array<{
		title: string | null;
		url: string | null;
		description: string | null;
		price: string | null;
		imageUrl: string | null;
		sortOrder: number;
	}>;
	slots: Array<{
		slotName: string | null;
		sortOrder: number;
		products: Array<{
			title: string | null;
			url: string | null;
			description: string | null;
			price: string | null;
			imageUrl: string | null;
			sortOrder: number;
		}>;
	}>;
};

/**
 * Duplicate a published Neon collection into the current user's Jazz account.
 * Used by the /clone route when the source data comes from Neon instead of Jazz.
 */
export function duplicateNeonCollectionToAccount(
	collection: CollectionForCloning,
	owner: Account,
): LoadedBlock {
	const ownerGroup = Group.create({ owner });
	ownerGroup.addMember(owner, "admin");

	const clonedChildrenList = BlockList.create([], { owner: ownerGroup });

	const duplicatedCollection = Block.create(
		{
			type: "collection",
			name: collection.name,
			collectionData: {
				color: collection.color ?? undefined,
				description: collection.description ?? undefined,
				publicLayout: collection.layout,
				sharingGroupId: ownerGroup.$jazz.id,
			},
			children: clonedChildrenList,
			createdAt: new Date(),
		},
		{ owner: ownerGroup },
	) as LoadedBlock;

	for (const product of collection.topLevelProducts) {
		const duplicatedProduct = Block.create(
			{
				type: "product",
				name: product.title ?? "Untitled",
				productData: {
					url: product.url ?? "",
					description: product.description ?? undefined,
					price: product.price ?? undefined,
					imageUrl: product.imageUrl ?? undefined,
				},
				sortOrder: product.sortOrder,
				createdAt: new Date(),
			},
			{ owner: ownerGroup },
		) as LoadedBlock;

		clonedChildrenList.$jazz.push(duplicatedProduct);
	}

	for (const slot of collection.slots) {
		const slotChildrenList = BlockList.create([], { owner: ownerGroup });

		const duplicatedSlot = Block.create(
			{
				type: "slot",
				name: slot.slotName ?? "Section",
				slotData: {},
				children: slotChildrenList,
				sortOrder: slot.sortOrder,
				createdAt: new Date(),
			},
			{ owner: ownerGroup },
		) as LoadedBlock;

		clonedChildrenList.$jazz.push(duplicatedSlot);

		for (const product of slot.products) {
			const duplicatedProduct = Block.create(
				{
					type: "product",
					name: product.title ?? "Untitled",
					productData: {
						url: product.url ?? "",
						description: product.description ?? undefined,
						price: product.price ?? undefined,
						imageUrl: product.imageUrl ?? undefined,
					},
					sortOrder: product.sortOrder,
					createdAt: new Date(),
				},
				{ owner: ownerGroup },
			) as LoadedBlock;

			slotChildrenList.$jazz.push(duplicatedProduct);
		}
	}

	return duplicatedCollection;
}

// =============================================================================
// Deletion
// =============================================================================

/**
 * Get all block IDs that should be deleted when deleting a collection.
 * This includes: the collection itself, all children (slots, products),
 * and any published clone with its children.
 */
export function getBlocksToDelete(
	collection: LoadedBlock,
	allBlocks: LoadedBlock[],
): string[] {
	if (collection.type !== "collection") {
		return [collection.$jazz.id];
	}

	const idsToDelete: string[] = [];
	const collectionId = collection.$jazz.id;

	// Add the collection itself
	idsToDelete.push(collectionId);

	// Find all descendants recursively
	const findDescendants = (parentId: string) => {
		for (const block of allBlocks) {
			if (block.parentId === parentId) {
				idsToDelete.push(block.$jazz.id);
				// Recursively find children of this block (e.g., products in slots)
				findDescendants(block.$jazz.id);
			}
		}
	};

	findDescendants(collectionId);

	// If this collection has a published clone, delete it and its children too
	const publishedId = collection.collectionData?.publishedId;
	if (publishedId) {
		idsToDelete.push(publishedId);

		// Find the published collection to get its children
		const publishedCollection = allBlocks.find(
			(b) => b.$jazz.id === publishedId,
		);
		if (publishedCollection) {
			findDescendants(publishedId);

			// Also check childBlockIds stored on the published collection
			const childBlockIds = publishedCollection.collectionData?.childBlockIds;
			if (childBlockIds) {
				for (const childId of childBlockIds) {
					if (!idsToDelete.includes(childId)) {
						idsToDelete.push(childId);
					}
				}
			}
		}
	}

	return idsToDelete;
}

/**
 * Delete a collection and all its related blocks from the account's block list.
 * This removes: the collection, all children (slots, products),
 * and any published clone with its children.
 */
export function deleteCollectionRecursively(
	collection: LoadedBlock,
	allBlocks: LoadedBlock[],
	blockList: {
		$jazz: { splice: (index: number, deleteCount: number) => void };
		length: number;
		[index: number]: LoadedBlock | null;
	},
): void {
	const idsToDelete = new Set(getBlocksToDelete(collection, allBlocks));

	// Remove blocks from the list by splicing (iterate backwards to avoid index issues)
	for (let i = blockList.length - 1; i >= 0; i--) {
		const block = blockList[i];
		if (block && idsToDelete.has(block.$jazz.id)) {
			blockList.$jazz.splice(i, 1);
		}
	}
}

// =============================================================================
// Collaborator Sharing (Invite-based)
// =============================================================================

export type SharingRole = "reader" | "writer" | "admin";

/**
 * Check if a collection has sharing enabled (has a sharing group).
 */
export function hasSharingGroup(collection: LoadedBlock): boolean {
	if (collection.type !== "collection") return false;
	return !!collection.collectionData?.sharingGroupId;
}

/**
 * Check if a collection is properly set up for sharing (group-owned).
 * Returns true if the collection can be shared without migration.
 */
export function isShareableCollection(collection: LoadedBlock): boolean {
	if (collection.type !== "collection") return false;
	// A collection is shareable if it has a sharingGroupId
	// (new collections are created with group ownership from the start)
	return !!collection.collectionData?.sharingGroupId;
}

/**
 * Enable sharing on a collection by creating a sharing Group.
 * NOTE: For legacy account-owned collections, this only stores the group ID
 * but doesn't actually make the collection shareable. Use migrateToGroupOwnership
 * for those cases.
 * Returns the Group so the caller can create invite links.
 */
export function enableSharing(collection: LoadedBlock, owner: Account): Group {
	if (collection.type !== "collection") {
		throw new Error("Can only enable sharing on collection blocks");
	}

	// If collection already has a sharing group, try to load it
	if (collection.collectionData?.sharingGroupId) {
		// Return a reference - caller should use getOrCreateSharingGroup instead
	}

	// Create a new Group for sharing
	const group = Group.create({ owner });
	group.addMember(owner, "admin");

	// Store the group ID on the collection
	collection.$jazz.set("collectionData", {
		...collection.collectionData,
		sharingGroupId: group.$jazz.id,
	});

	return group;
}

/**
 * Get or create the sharing group for a collection.
 * Returns the group ID and whether it was newly created.
 */
export async function getOrCreateSharingGroup(
	collection: LoadedBlock,
	owner: Account,
): Promise<{ group: Group; created: boolean }> {
	if (collection.type !== "collection") {
		throw new Error("Can only get sharing group for collection blocks");
	}

	const existingGroupId = collection.collectionData?.sharingGroupId;

	if (existingGroupId) {
		const group = await Group.load(existingGroupId as `co_z${string}`, {});
		if (group) {
			return { group, created: false };
		}
	}

	// Create new group
	const group = enableSharing(collection, owner);
	return { group, created: true };
}

/**
 * Generate an invite link for a collection.
 * Creates a path-based URL instead of Jazz's default hash-based URL.
 * Format: /invite/[collectionId]?secret=[inviteSecret]&role=[role]
 */
export function generateCollectionInviteLink(
	collection: LoadedBlock,
	role: SharingRole,
	baseUrl: string,
): string {
	// Use Jazz's createInviteLink to generate the invite secret
	const hashBasedUrl = createInviteLink(collection, role, baseUrl);

	// Parse the hash-based URL to extract the invite secret
	// Format is: baseUrl#/invite/{valueId}/{inviteSecret}
	const hashPart = hashBasedUrl.split("#")[1];
	if (!hashPart) {
		throw new Error("Failed to generate invite link");
	}

	// Parse: /invite/{valueId}/{inviteSecret}
	const parts = hashPart.split("/").filter(Boolean);
	// parts = ['invite', valueId, inviteSecret]
	if (parts.length < 3 || parts[0] !== "invite") {
		throw new Error("Invalid invite link format");
	}

	const valueId = parts[1];
	const inviteSecret = parts[2];

	// Create path-based URL
	return `${baseUrl}/invite/${valueId}?secret=${encodeURIComponent(inviteSecret)}&role=${role}`;
}

// =============================================================================
// Reordering
// =============================================================================

/**
 * Reorder an item in a BlockList from one position to another.
 * Uses Jazz's splice method for atomic updates.
 */
export function reorderBlockList(
	list: co.loaded<typeof BlockList>,
	fromIndex: number,
	toIndex: number,
): void {
	if (!list.$isLoaded) return;
	if (fromIndex === toIndex) return;
	if (fromIndex < 0 || fromIndex >= list.length) return;
	if (toIndex < 0 || toIndex >= list.length) return;

	const item = list[fromIndex];
	if (!item) return;

	// Remove from old position
	list.$jazz.splice(fromIndex, 1);

	// Insert at new position
	list.$jazz.splice(toIndex, 0, item);
}
