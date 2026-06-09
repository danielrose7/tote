import { describe, expect, it } from "vitest";
import {
	getRollbackExpiration,
	verifyMigrationReceipt,
} from "./migrationReceipt";

const validReceipt = {
	sourceCollectionCount: 3,
	sourceItemCount: 12,
	importedCollectionCount: 3,
	importedItemCount: 12,
	sourceFingerprint: "sha256:abc",
	importFingerprint: "sha256:abc",
};

describe("verifyMigrationReceipt", () => {
	it("accepts matching counts and fingerprints", () => {
		expect(verifyMigrationReceipt(validReceipt)).toEqual({ verified: true });
	});

	it("reports every verification mismatch", () => {
		expect(
			verifyMigrationReceipt({
				...validReceipt,
				importedCollectionCount: 2,
				importedItemCount: 11,
				importFingerprint: "sha256:different",
			}),
		).toEqual({
			verified: false,
			reasons: [
				"collection_count_mismatch",
				"item_count_mismatch",
				"fingerprint_mismatch",
			],
		});
	});

	it("rejects empty fingerprints", () => {
		expect(
			verifyMigrationReceipt({
				...validReceipt,
				sourceFingerprint: "",
				importFingerprint: "",
			}),
		).toEqual({
			verified: false,
			reasons: ["fingerprint_mismatch"],
		});
	});
});

describe("getRollbackExpiration", () => {
	it("defaults to a fourteen-day rollback window", () => {
		const cutoverAt = new Date("2026-06-08T12:00:00.000Z");

		expect(getRollbackExpiration(cutoverAt).toISOString()).toBe(
			"2026-06-22T12:00:00.000Z",
		);
	});

	it("rejects invalid retention periods", () => {
		expect(() => getRollbackExpiration(new Date(), 0)).toThrow(RangeError);
		expect(() => getRollbackExpiration(new Date(), 1.5)).toThrow(RangeError);
	});
});
