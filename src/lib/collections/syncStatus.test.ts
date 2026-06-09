import { describe, expect, it } from "vitest";
import { collectionMutationLabel } from "./syncStatus";

describe("collectionMutationLabel", () => {
	it("describes collection and node mutations", () => {
		expect(collectionMutationLabel(["collections", "create"])).toBe(
			"Collection creation",
		);
		expect(collectionMutationLabel(["collections", "nodes", "reorder"])).toBe(
			"Content reorder",
		);
	});

	it("describes team mutations", () => {
		expect(
			collectionMutationLabel(["collections", "team", "transfer-ownership"]),
		).toBe("Ownership transfer");
		expect(
			collectionMutationLabel(["collections", "team", "members", "remove"]),
		).toBe("Member removal");
	});

	it("falls back for unknown mutation keys", () => {
		expect(collectionMutationLabel(undefined)).toBe("Collection change");
		expect(collectionMutationLabel(["collections", "future"])).toBe(
			"Collection change",
		);
	});
});
