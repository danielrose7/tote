import { describe, expect, it } from "vitest";
import {
	type ItemCountNodeState,
	itemCountContribution,
	itemCountDelta,
} from "./itemCount";

const active = (
	type: NonNullable<ItemCountNodeState>["type"],
): NonNullable<ItemCountNodeState> => ({
	type,
	deletedAt: null,
});

const deleted = (
	type: NonNullable<ItemCountNodeState>["type"],
): NonNullable<ItemCountNodeState> => ({
	type,
	deletedAt: new Date("2026-06-08T00:00:00Z"),
});

describe("collection item count", () => {
	it.each(["product", "link", "photo"] as const)(
		"counts active %s nodes",
		(type) => {
			expect(itemCountContribution(active(type))).toBe(1);
		},
	);

	it.each(["section", "note", "text"] as const)(
		"does not count %s nodes",
		(type) => {
			expect(itemCountContribution(active(type))).toBe(0);
		},
	);

	it("increments when an item-like node is created", () => {
		expect(itemCountDelta(null, active("link"))).toBe(1);
	});

	it("decrements for soft and hard deletes", () => {
		expect(itemCountDelta(active("photo"), deleted("photo"))).toBe(-1);
		expect(itemCountDelta(active("photo"), null)).toBe(-1);
	});

	it("increments when a deleted item is restored", () => {
		expect(itemCountDelta(deleted("product"), active("product"))).toBe(1);
	});

	it("handles changes between structural and item node types", () => {
		expect(itemCountDelta(active("text"), active("link"))).toBe(1);
		expect(itemCountDelta(active("product"), active("note"))).toBe(-1);
	});

	it("does not change for edits that preserve countability", () => {
		expect(itemCountDelta(active("product"), active("link"))).toBe(0);
		expect(itemCountDelta(active("section"), active("note"))).toBe(0);
	});
});
