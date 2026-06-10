import { describe, expect, it } from "vitest";
import {
	canStartCollectionMigration,
	canUseNeonCollections,
	collectionIdSchema,
	copyCollectionInputSchema,
	createCollectionInputSchema,
	createCollectionInviteInputSchema,
	createCollectionNodeInputSchema,
	importClassicCollectionsInputSchema,
	publishCollectionInputSchema,
	reorderCollectionNodesInputSchema,
	saveCaptureInputSchema,
	updateCollectionInputSchema,
	updateCollectionNodeInputSchema,
} from "./api";

describe("collectionIdSchema", () => {
	it("accepts UUIDs and rejects arbitrary identifiers", () => {
		expect(
			collectionIdSchema.safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479")
				.success,
		).toBe(true);
		expect(collectionIdSchema.safeParse("legacy-jazz-id").success).toBe(false);
	});
});

describe("createCollectionInputSchema", () => {
	it("normalizes a valid create request", () => {
		expect(
			createCollectionInputSchema.parse({
				name: "  Reading list  ",
				description: "  Things to revisit  ",
				positionKey: " a0 ",
			}),
		).toEqual({
			name: "Reading list",
			description: "Things to revisit",
			positionKey: "a0",
		});
	});

	it("rejects empty names and position keys", () => {
		expect(
			createCollectionInputSchema.safeParse({
				name: " ",
				positionKey: "",
			}).success,
		).toBe(false);
	});

	it("allows omitting positionKey so the server assigns ordering", () => {
		const parsed = createCollectionInputSchema.parse({
			id: "4e14f92e-66ef-47d6-bd34-a57299b89021",
			mutationId: "5e14f92e-66ef-47d6-bd34-a57299b89021",
			name: "Reading list",
		});
		expect(parsed.positionKey).toBeUndefined();
	});

	it("rejects malformed client-generated ids", () => {
		expect(
			createCollectionInputSchema.safeParse({
				id: "not-a-uuid",
				name: "Reading list",
				positionKey: "a0",
			}).success,
		).toBe(false);
	});

	it("requires a client-generated id with a mutation id", () => {
		expect(
			createCollectionInputSchema.safeParse({
				mutationId: "4e14f92e-66ef-47d6-bd34-a57299b89021",
				name: "Reading list",
				positionKey: "a0",
			}).success,
		).toBe(false);
	});
});

describe("collection mutation schemas", () => {
	it("requires an idempotency key for collection copies", () => {
		expect(copyCollectionInputSchema.safeParse({}).success).toBe(false);
		expect(
			copyCollectionInputSchema.parse({
				mutationId: "4e14f92e-66ef-47d6-bd34-a57299b89021",
				name: "  My lighting list  ",
			}),
		).toEqual({
			mutationId: "4e14f92e-66ef-47d6-bd34-a57299b89021",
			name: "My lighting list",
		});
	});

	it("requires a version and at least one collection change", () => {
		expect(
			updateCollectionInputSchema.safeParse({ expectedVersion: 2 }).success,
		).toBe(false);
		expect(
			updateCollectionInputSchema.safeParse({
				expectedVersion: 2,
				name: "Updated",
			}).success,
		).toBe(true);
	});

	it("allows generalized item types", () => {
		for (const type of ["product", "link", "photo", "note", "text"] as const) {
			expect(
				createCollectionNodeInputSchema.safeParse({
					type,
					positionKey: "a0",
				}).success,
			).toBe(true);
		}
	});

	it("keeps sections top-level", () => {
		expect(
			createCollectionNodeInputSchema.safeParse({
				type: "section",
				parentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
				positionKey: "a0",
			}).success,
		).toBe(false);
	});

	it("requires a client-generated node id with a mutation id", () => {
		expect(
			createCollectionNodeInputSchema.safeParse({
				mutationId: "4e14f92e-66ef-47d6-bd34-a57299b89021",
				type: "link",
				positionKey: "a0",
			}).success,
		).toBe(false);
	});

	it("requires a node change in addition to its expected version", () => {
		expect(
			updateCollectionNodeInputSchema.safeParse({ expectedVersion: 1 }).success,
		).toBe(false);
		expect(
			updateCollectionNodeInputSchema.safeParse({
				expectedVersion: 1,
				positionKey: "a1",
			}).success,
		).toBe(true);
	});

	it("requires at least two unique nodes for a reorder", () => {
		const mutationId = "4e14f92e-66ef-47d6-bd34-a57299b89021";
		const node = {
			id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
			expectedVersion: 1,
			positionKey: "r:0",
		};
		expect(
			reorderCollectionNodesInputSchema.safeParse({
				mutationId,
				nodes: [node],
			}).success,
		).toBe(false);
		expect(
			reorderCollectionNodesInputSchema.safeParse({
				mutationId,
				nodes: [node, node],
			}).success,
		).toBe(false);
		expect(
			reorderCollectionNodesInputSchema.safeParse({
				mutationId,
				nodes: [
					node,
					{
						...node,
						id: "550e8400-e29b-41d4-a716-446655440000",
						positionKey: "r:1",
					},
				],
			}).success,
		).toBe(true);
	});
});

describe("canUseNeonCollections", () => {
	it.each(["neon_verifying", "neon"] as const)(
		"allows %s accounts",
		(dataSource) => {
			expect(canUseNeonCollections(dataSource)).toBe(true);
		},
	);

	it.each(["classic_jazz", "migrating", "migration_failed"] as const)(
		"keeps %s accounts off the private API",
		(dataSource) => {
			expect(canUseNeonCollections(dataSource)).toBe(false);
		},
	);
});

describe("canStartCollectionMigration", () => {
	it("requires explicit eligibility for untouched Classic Jazz accounts", () => {
		expect(canStartCollectionMigration("classic_jazz", false)).toBe(false);
		expect(canStartCollectionMigration("classic_jazz", true)).toBe(true);
	});

	it.each(["migrating", "neon_verifying", "neon", "migration_failed"] as const)(
		"allows an existing %s account to continue",
		(dataSource) => {
			expect(canStartCollectionMigration(dataSource, false)).toBe(true);
		},
	);
});

describe("saveCaptureInputSchema", () => {
	it("accepts an idempotent product capture", () => {
		expect(
			saveCaptureInputSchema.parse({
				id: "40000000-0000-4000-8000-000000000901",
				mutationId: "50000000-0000-4000-8000-000000000901",
				collectionId: "40000000-0000-4000-8000-000000000902",
				sectionId: null,
				title: "Task lamp",
				url: "https://example.com/lamp",
				imageUrl: "https://example.com/lamp.jpg",
				price: "$129",
			}),
		).toMatchObject({
			title: "Task lamp",
			url: "https://example.com/lamp",
		});
	});

	it("rejects non-http capture URLs", () => {
		expect(
			saveCaptureInputSchema.safeParse({
				id: "40000000-0000-4000-8000-000000000901",
				mutationId: "50000000-0000-4000-8000-000000000901",
				collectionId: "40000000-0000-4000-8000-000000000902",
				title: "Unsafe",
				url: "not a url",
			}).success,
		).toBe(false);
	});
});

describe("collection team schemas", () => {
	it("normalizes invite metadata", () => {
		expect(
			createCollectionInviteInputSchema.parse({
				role: "viewer",
				recipientHint: "  person@example.com  ",
				expiresAt: "2026-06-15T12:00:00Z",
				maxUses: 1,
			}),
		).toEqual({
			role: "viewer",
			recipientHint: "person@example.com",
			expiresAt: new Date("2026-06-15T12:00:00Z"),
			maxUses: 1,
		});
	});

	it("rejects owner invites and invalid usage limits", () => {
		expect(
			createCollectionInviteInputSchema.safeParse({
				role: "owner",
			}).success,
		).toBe(false);
		expect(
			createCollectionInviteInputSchema.safeParse({
				role: "viewer",
				maxUses: 0,
			}).success,
		).toBe(false);
	});
});

describe("publishCollectionInputSchema", () => {
	it("accepts URL-safe snapshot settings", () => {
		expect(
			publishCollectionInputSchema.parse({
				slug: "lighting-ideas.v2",
				layout: "feature",
				allowCloning: false,
			}),
		).toEqual({
			slug: "lighting-ideas.v2",
			layout: "feature",
			allowCloning: false,
		});
	});

	it("rejects slashes and empty slugs", () => {
		expect(
			publishCollectionInputSchema.safeParse({ slug: "not/a/slug" }).success,
		).toBe(false);
		expect(publishCollectionInputSchema.safeParse({ slug: "" }).success).toBe(
			false,
		);
	});
});

describe("importClassicCollectionsInputSchema", () => {
	it("accepts a versioned migration graph and rejects invalid fingerprints", () => {
		const payload = {
			migrationVersion: 1,
			sourceFingerprint: "a".repeat(64),
			collections: [
				{
					legacyJazzId: "co_zCollection",
					name: "Imported",
					description: null,
					color: null,
					budgetCents: null,
					defaultViewMode: "grid",
					publicLayout: "minimal",
					copyPolicy: "disabled",
					positionKey: "a0",
					nodes: [],
				},
			],
		};
		expect(importClassicCollectionsInputSchema.safeParse(payload).success).toBe(
			true,
		);
		expect(
			importClassicCollectionsInputSchema.safeParse({
				...payload,
				sourceFingerprint: "not-a-fingerprint",
			}).success,
		).toBe(false);
	});
});
