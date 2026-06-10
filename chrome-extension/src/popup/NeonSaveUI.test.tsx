import { fireEvent, waitFor } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOutbox, writeCachedIndex } from "../lib/captureStore";
import { NeonSaveUI } from "./NeonSaveUI";

const getTokenMock = vi.fn();

vi.mock("@clerk/chrome-extension", () => ({
	useAuth: () => ({ getToken: getTokenMock, userId: "user-a" }),
}));

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createStorageMock() {
	let store: Record<string, unknown> = {};
	return {
		reset: () => {
			store = {};
		},
		local: {
			get: vi.fn(async (keys: string | string[]) => {
				const list = Array.isArray(keys) ? keys : [keys];
				return Object.fromEntries(
					list.filter((key) => key in store).map((key) => [key, store[key]]),
				);
			}),
			set: vi.fn(async (items: Record<string, unknown>) => {
				Object.assign(store, items);
			}),
			remove: vi.fn(async (keys: string | string[]) => {
				for (const key of Array.isArray(keys) ? keys : [keys]) {
					delete store[key];
				}
			}),
		},
	};
}

const storage = createStorageMock();
const tabsCreate = vi.fn();

const METADATA = { title: "Task lamp", url: "https://example.com/lamp" };

const COLLECTIONS = [
	{
		id: "40000000-0000-4000-8000-000000000001",
		name: "Lighting",
		color: null,
		role: "owner" as const,
		sections: [{ id: "40000000-0000-4000-8000-000000000002", name: "Desk" }],
	},
];

let container: HTMLDivElement;
let root: Root | null = null;

async function render(ui: React.ReactElement) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => {
		root?.render(ui);
	});
	// Flush the async load effect.
	await act(async () => {});
}

function renderSaveUI(overrides: {
	onSuccess?: (collectionId: string) => void;
	onQueued?: (collectionId: string) => void;
	onUnavailable?: () => void;
}) {
	return render(
		<NeonSaveUI
			metadata={METADATA}
			onSuccess={overrides.onSuccess ?? vi.fn()}
			onQueued={overrides.onQueued ?? vi.fn()}
			onUnavailable={overrides.onUnavailable ?? vi.fn()}
		/>,
	);
}

beforeEach(() => {
	storage.reset();
	getTokenMock.mockReset();
	vi.stubGlobal("chrome", {
		storage: { local: storage.local },
		tabs: { create: tabsCreate },
	});
});

afterEach(async () => {
	if (root) {
		await act(async () => {
			root?.unmount();
		});
		root = null;
	}
	container?.remove();
	vi.unstubAllGlobals();
});

describe("NeonSaveUI", () => {
	it("falls back to Classic Jazz when the rollout gate rejects the account", async () => {
		getTokenMock.mockResolvedValue("token");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ error: "Neon collections are not enabled" }),
					{
						status: 409,
					},
				),
			),
		);
		const onUnavailable = vi.fn();

		await renderSaveUI({ onUnavailable });
		await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
	});

	it("offers collection creation in the signed-in empty state", async () => {
		getTokenMock.mockResolvedValue("token");
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ collections: [] }), { status: 200 }),
				),
		);

		await renderSaveUI({});
		await waitFor(() =>
			expect(container.textContent).toContain("No writable collections yet."),
		);
		expect(container.textContent).toContain("Add Collection");
	});

	it("saves online into the selected collection and section", async () => {
		getTokenMock.mockResolvedValue("token");
		const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
			if (init?.method === "POST") {
				return new Response(
					JSON.stringify({ id: "node-id", replayed: false }),
					{ status: 201 },
				);
			}
			return new Response(JSON.stringify({ collections: COLLECTIONS }), {
				status: 200,
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const onSuccess = vi.fn();

		await renderSaveUI({ onSuccess });
		await waitFor(() =>
			expect(container.querySelector("#neon-collection")).toBeTruthy(),
		);

		const sectionSelect = container.querySelector(
			"#neon-section",
		) as HTMLSelectElement;
		await act(async () => {
			fireEvent.change(sectionSelect, {
				target: { value: COLLECTIONS[0].sections[0].id },
			});
		});

		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Save to Tote",
		) as HTMLButtonElement;
		await act(async () => {
			fireEvent.click(saveButton);
		});

		await waitFor(() =>
			expect(onSuccess).toHaveBeenCalledWith(COLLECTIONS[0].id),
		);
		const postCall = fetchMock.mock.calls.find(
			(call) => (call[1] as RequestInit | undefined)?.method === "POST",
		);
		const body = JSON.parse(String((postCall?.[1] as RequestInit).body));
		expect(body.collectionId).toBe(COLLECTIONS[0].id);
		expect(body.sectionId).toBe(COLLECTIONS[0].sections[0].id);
		// The capture was confirmed online, so nothing is left in the outbox.
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
	});

	it("serves the cached index offline and queues the save", async () => {
		await writeCachedIndex("user-a", COLLECTIONS);
		getTokenMock.mockResolvedValue("token");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
		);
		const onQueued = vi.fn();

		await renderSaveUI({ onQueued });
		await waitFor(() =>
			expect(container.textContent).toContain("Offline — showing saved"),
		);
		expect(container.textContent).toContain("Lighting");

		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Save to Tote",
		) as HTMLButtonElement;
		await act(async () => {
			fireEvent.click(saveButton);
		});

		await waitFor(() =>
			expect(onQueued).toHaveBeenCalledWith(COLLECTIONS[0].id),
		);
		const entries = await readOutbox("user-a");
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ status: "pending", userId: "user-a" });
	});

	it("queues the save instead of losing it when the session is expired", async () => {
		await writeCachedIndex("user-a", COLLECTIONS);
		getTokenMock.mockResolvedValue(null);
		vi.stubGlobal("fetch", vi.fn());
		const onQueued = vi.fn();

		await renderSaveUI({ onQueued });
		await waitFor(() => expect(container.textContent).toContain("Lighting"));

		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Save to Tote",
		) as HTMLButtonElement;
		await act(async () => {
			fireEvent.click(saveButton);
		});

		await waitFor(() => expect(onQueued).toHaveBeenCalled());
		await expect(readOutbox("user-a")).resolves.toHaveLength(1);
	});

	it("keeps a revoked-membership rejection visible for retry or removal", async () => {
		getTokenMock.mockResolvedValue("token");
		const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
			if (init?.method === "POST") {
				return new Response(JSON.stringify({ error: "Forbidden" }), {
					status: 403,
				});
			}
			return new Response(JSON.stringify({ collections: COLLECTIONS }), {
				status: 200,
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const onSuccess = vi.fn();
		const onQueued = vi.fn();

		await renderSaveUI({ onSuccess, onQueued });
		await waitFor(() =>
			expect(container.querySelector("#neon-collection")).toBeTruthy(),
		);

		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Save to Tote",
		) as HTMLButtonElement;
		await act(async () => {
			fireEvent.click(saveButton);
		});

		await waitFor(() => expect(container.textContent).toContain("Forbidden"));
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onQueued).not.toHaveBeenCalled();
		await waitFor(() => expect(container.textContent).toContain("Retry"));
		const entries = await readOutbox("user-a");
		expect(entries[0]).toMatchObject({ status: "failed" });
	});
});
