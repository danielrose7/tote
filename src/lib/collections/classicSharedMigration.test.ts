import { describe, expect, it } from "vitest";
import { getWaitingClassicSharedCollections } from "./classicSharedMigration";
import type { CollectionSummary } from "./repository";

function summary(id: string, legacyJazzId: string | null): CollectionSummary {
	return {
		id,
		ownerUserId: "owner",
		name: "Collection",
		description: null,
		color: null,
		itemCount: 0,
		legacyJazzId,
		positionKey: "a0",
		updatedAt: new Date(),
		role: "viewer",
	};
}

describe("getWaitingClassicSharedCollections", () => {
	it("returns loaded shared references whose owner migration is not visible", () => {
		const sharedWithMe = [
			{
				$isLoaded: true,
				collectionId: "co_zWaiting",
				name: "Waiting room",
				role: "writer",
			},
			{
				$isLoaded: true,
				collectionId: "co_zMigrated",
				name: "Already migrated",
				role: "reader",
			},
			{
				$isLoaded: false,
				collectionId: "co_zUnloaded",
				role: "reader",
			},
		];

		expect(
			getWaitingClassicSharedCollections(sharedWithMe, [
				summary("10000000-0000-4000-8000-000000000001", "co_zMigrated"),
			]),
		).toEqual([
			{
				collectionId: "co_zWaiting",
				name: "Waiting room",
				role: "writer",
			},
		]);
	});
});
