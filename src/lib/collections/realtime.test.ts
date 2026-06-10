import { describe, expect, it } from "vitest";
import {
	collectionRealtimeCapabilities,
	realtimeInvalidationKeys,
} from "./realtime";

describe("collectionRealtimeCapabilities", () => {
	it("grants subscribe-only access to the user index and active collections", () => {
		expect(
			collectionRealtimeCapabilities("user_123", [
				"collection-a",
				"collection-a",
				"collection-b",
			]),
		).toEqual({
			"user:user_123:collections": ["subscribe"],
			"collection:collection-a": ["subscribe"],
			"collection:collection-b": ["subscribe"],
		});
	});
});

describe("realtimeInvalidationKeys", () => {
	it("targets the collection index for user events", () => {
		expect(realtimeInvalidationKeys("user:user_123:collections")).toEqual([
			["collections"],
		]);
	});

	it("targets collection-scoped queries for collection events", () => {
		expect(realtimeInvalidationKeys("collection:collection-a")).toEqual([
			["collections"],
			["collections", "collection-a"],
			["collections", "collection-a", "team"],
			["collections", "collection-a", "publication"],
		]);
	});
});
