import { describe, expect, it } from "vitest";
import {
	exportClassicCollections,
	exportClassicCollectionsWithMembers,
} from "./classicMigrationExport";
import { fingerprintMutationRequest } from "./idempotency";
import {
	fingerprintClassicMigrationCollectionsInBrowser,
	normalizeClassicMigrationCollections,
} from "./migrationPayload";

function jazzValue(id: string, values: Record<string, unknown>) {
	return {
		$isLoaded: true,
		$jazz: { id },
		...values,
	};
}

describe("exportClassicCollections", () => {
	it("converts owned Jazz collections, slots, products, and notes", () => {
		const product = jazzValue("co_zProduct", {
			type: "product",
			name: "Brass lamp",
			productData: {
				url: "https://example.com/lamp",
				imageUrl: "https://example.com/lamp.jpg",
				price: "$129",
				notes: "Check the cord color",
			},
		});
		const slot = jazzValue("co_zSlot", {
			type: "slot",
			name: "Desk lamps",
			slotData: { budget: 25000, maxSelections: 2 },
			children: [product],
		});
		const collection = jazzValue("co_zCollection", {
			type: "collection",
			name: "Lighting ideas",
			collectionData: {
				color: "#6366f1",
				description: "A room-by-room list",
				viewMode: "grid",
				publicLayout: "feature",
				budget: 50000,
				allowCloning: true,
			},
			children: [slot],
			notes: [
				jazzValue("co_zNote", {
					text: "Measure the desk first.",
					url: "https://example.com/measure",
					done: true,
				}),
			],
		});

		expect(exportClassicCollections([collection])).toEqual([
			{
				legacyJazzId: "co_zCollection",
				name: "Lighting ideas",
				description: "A room-by-room list",
				color: "#6366f1",
				budgetCents: 50000,
				defaultViewMode: "grid",
				publicLayout: "feature",
				copyPolicy: "public",
				positionKey: "m00000000",
				nodes: [
					{
						legacyJazzId: "co_zSlot",
						parentLegacyJazzId: null,
						type: "section",
						title: "Desk lamps",
						properties: { budgetCents: 25000, maxSelections: 2 },
						positionKey: "m00000000",
					},
					{
						legacyJazzId: "co_zProduct",
						parentLegacyJazzId: "co_zSlot",
						type: "product",
						title: "Brass lamp",
						properties: {
							url: "https://example.com/lamp",
							imageUrl: "https://example.com/lamp.jpg",
							price: "$129",
							notes: "Check the cord color",
						},
						positionKey: "m00000000",
					},
					{
						legacyJazzId: "co_zNote",
						parentLegacyJazzId: null,
						type: "note",
						title: "Measure the desk first.",
						properties: {
							body: "Measure the desk first.",
							url: "https://example.com/measure",
							isDone: true,
						},
						positionKey: "n00000000",
					},
				],
			},
		]);
	});

	it("excludes published clones and unloaded values", () => {
		expect(
			exportClassicCollections([
				jazzValue("co_zPublished", {
					type: "collection",
					name: "Published clone",
					collectionData: { sourceId: "co_zSource" },
					children: [],
				}),
				{ $isLoaded: false },
			]),
		).toEqual([]);
	});

	it("exports resolved direct group members with Neon roles", async () => {
		const collection = jazzValue("co_zCollection", {
			type: "collection",
			name: "Shared collection",
			collectionData: {},
			children: [],
		});
		collection.$jazz.owner = {
			getDirectMembers: () => [
				{ id: "co_zOwner", role: "admin" },
				{ id: "co_zAdmin", role: "admin" },
				{ id: "co_zWriter", role: "writer" },
				{ id: "co_zReader", role: "reader" },
				{ id: "co_zUnresolved", role: "reader" },
			],
		};
		const clerkIds = new Map([
			["co_zOwner", "owner_user"],
			["co_zAdmin", "admin_user"],
			["co_zWriter", "editor_user"],
			["co_zReader", "viewer_user"],
		]);

		const [exported] = await exportClassicCollectionsWithMembers(
			[collection],
			"owner_user",
			async (accountId) => clerkIds.get(accountId) ?? null,
		);
		expect(exported.members).toEqual([
			{ userId: "admin_user", role: "admin" },
			{ userId: "editor_user", role: "editor" },
			{ userId: "viewer_user", role: "viewer" },
		]);
	});
});

describe("migration fingerprints", () => {
	it("matches the server fingerprint independent of traversal order", async () => {
		const collections = exportClassicCollections([
			jazzValue("co_zCollection", {
				type: "collection",
				name: "Collection",
				collectionData: {},
				children: [
					jazzValue("co_zProduct", {
						type: "product",
						name: "Product",
						productData: { url: "https://example.com" },
					}),
				],
			}),
		]);

		expect(
			await fingerprintClassicMigrationCollectionsInBrowser(collections),
		).toBe(
			fingerprintMutationRequest(
				normalizeClassicMigrationCollections(collections),
			),
		);
	});
});
