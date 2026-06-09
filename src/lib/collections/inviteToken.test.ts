import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken } from "./inviteToken";

describe("collection invite tokens", () => {
	it("creates random bearer tokens and stable hashes", () => {
		const first = createInviteToken();
		const second = createInviteToken();

		expect(first).not.toBe(second);
		expect(first.length).toBeGreaterThanOrEqual(40);
		expect(hashInviteToken(first)).toBe(hashInviteToken(first));
		expect(hashInviteToken(first)).not.toBe(hashInviteToken(second));
	});
});
