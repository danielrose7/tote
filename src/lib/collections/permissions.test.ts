import { describe, expect, it } from "vitest";
import { roleCan } from "./permissions";

describe("roleCan", () => {
	it("allows every active member to read", () => {
		for (const role of ["owner", "admin", "editor", "viewer"] as const) {
			expect(roleCan(role, "read")).toBe(true);
		}
	});

	it("allows owners, admins, and editors to edit", () => {
		expect(roleCan("owner", "edit")).toBe(true);
		expect(roleCan("admin", "edit")).toBe(true);
		expect(roleCan("editor", "edit")).toBe(true);
		expect(roleCan("viewer", "edit")).toBe(false);
	});

	it("reserves destructive collection deletion for owners", () => {
		expect(roleCan("owner", "delete")).toBe(true);
		expect(roleCan("admin", "delete")).toBe(false);
		expect(roleCan("editor", "delete")).toBe(false);
		expect(roleCan("viewer", "delete")).toBe(false);
	});
});
