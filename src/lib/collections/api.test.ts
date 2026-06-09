import { describe, expect, it } from "vitest";
import {
	canUseNeonCollections,
	collectionIdSchema,
	createCollectionInputSchema,
	createCollectionNodeInputSchema,
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
