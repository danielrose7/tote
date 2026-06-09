import { describe, expect, it } from "vitest";
import { fingerprintMutationRequest } from "./idempotency";

describe("fingerprintMutationRequest", () => {
	it("is stable across object key order", () => {
		expect(
			fingerprintMutationRequest({
				name: "Desk",
				nested: { color: "blue", count: 2 },
			}),
		).toBe(
			fingerprintMutationRequest({
				nested: { count: 2, color: "blue" },
				name: "Desk",
			}),
		);
	});

	it("changes when mutation input changes", () => {
		expect(fingerprintMutationRequest({ name: "Desk" })).not.toBe(
			fingerprintMutationRequest({ name: "Office" }),
		);
	});
});
