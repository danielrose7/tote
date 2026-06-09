import { describe, expect, it } from "vitest";
import {
	canUseNeonCollections,
	collectionIdSchema,
	createCollectionInputSchema,
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
