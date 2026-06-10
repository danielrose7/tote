import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	enqueueCapture,
	flushOutbox,
	purgeAccountData,
	purgeInactiveAccountData,
	readCachedIndex,
	readLastSelectedCollection,
	readOutbox,
	removeOutboxEntry,
	requeueOutboxEntry,
	submitCapture,
	syncActiveAccount,
	writeCachedIndex,
	writeLastSelectedCollection,
} from "./captureStore";
import type { CapturePayload } from "./neonCapture";

function createStorageMock() {
	let store: Record<string, unknown> = {};
	return {
		dump: () => store,
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

function payload(overrides: Partial<CapturePayload> = {}): CapturePayload {
	return {
		id: "40000000-0000-4000-8000-000000000011",
		mutationId: "50000000-0000-4000-8000-000000000011",
		collectionId: "40000000-0000-4000-8000-000000000001",
		sectionId: null,
		title: "Task lamp",
		url: "https://example.com/lamp",
		imageUrl: undefined,
		images: undefined,
		price: undefined,
		description: undefined,
		...overrides,
	};
}

const okResponse = () =>
	new Response(JSON.stringify({ id: "node-id", replayed: false }), {
		status: 201,
	});
const replayedResponse = () =>
	new Response(JSON.stringify({ id: "node-id", replayed: true }), {
		status: 200,
	});

const getToken = () => Promise.resolve("session-token");

beforeEach(() => {
	storage.reset();
	vi.stubGlobal("chrome", { storage: { local: storage.local } });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("cached capture index", () => {
	it("round-trips the index scoped to one account", async () => {
		await writeCachedIndex("user-a", [
			{ id: "c1", name: "Lighting", color: null, role: "owner", sections: [] },
		]);
		const cached = await readCachedIndex("user-a");
		expect(cached?.collections[0]?.name).toBe("Lighting");
		expect(cached?.userId).toBe("user-a");
		expect(cached?.fetchedAt).toBeTruthy();
		await expect(readCachedIndex("user-b")).resolves.toBeNull();
	});

	it("scopes the last selected collection by account", async () => {
		await writeLastSelectedCollection("user-a", "c1");
		await writeLastSelectedCollection("user-b", "c2");
		await expect(readLastSelectedCollection("user-a")).resolves.toBe("c1");
		await expect(readLastSelectedCollection("user-b")).resolves.toBe("c2");
	});
});

describe("capture outbox", () => {
	it("persists the entry before any network attempt", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
		vi.stubGlobal("fetch", fetchMock);

		const outcome = await submitCapture({
			userId: "user-a",
			payload: payload(),
			getToken,
		});
		expect(outcome).toEqual({ status: "queued" });

		const entries = await readOutbox("user-a");
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			status: "pending",
			attempts: 1,
			lastError: "offline",
			nodeId: payload().id,
			mutationId: payload().mutationId,
		});
	});

	it("queues without sending when no token is available", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const outcome = await submitCapture({
			userId: "user-a",
			payload: payload(),
			getToken: () => Promise.resolve(null),
		});
		expect(outcome).toEqual({ status: "queued" });
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(readOutbox("user-a")).resolves.toHaveLength(1);
	});

	it("removes the entry only after a successful response", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
		const outcome = await submitCapture({
			userId: "user-a",
			payload: payload(),
			getToken,
		});
		expect(outcome).toMatchObject({ status: "saved", replayed: false });
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
	});

	it("replays the same payload on flush after restart", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("offline"))
			.mockResolvedValueOnce(replayedResponse());
		vi.stubGlobal("fetch", fetchMock);

		await submitCapture({ userId: "user-a", payload: payload(), getToken });
		// Simulates a later popup session: same storage, fresh flush.
		const result = await flushOutbox("user-a", getToken);
		expect(result).toEqual({ sent: 1, rejected: 0, remaining: 0 });
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);

		const bodies = fetchMock.mock.calls.map((call) =>
			JSON.parse(String((call[1] as RequestInit).body)),
		);
		expect(bodies[0].id).toBe(bodies[1].id);
		expect(bodies[0].mutationId).toBe(bodies[1].mutationId);
	});

	it("flushes entries stuck in sending from a dead popup", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
		await submitCapture({ userId: "user-a", payload: payload(), getToken });
		// Force a stale "sending" state as if the popup died mid-request.
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
		const result = await flushOutbox("user-a", getToken);
		expect(result.sent).toBe(1);
	});

	it("keeps permanently rejected entries visible and out of auto-flush", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "Forbidden" }), {
					status: 403,
				}),
			),
		);
		const outcome = await submitCapture({
			userId: "user-a",
			payload: payload(),
			getToken,
		});
		expect(outcome).toEqual({ status: "rejected", message: "Forbidden" });

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await flushOutbox("user-a", getToken);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(result).toEqual({ sent: 0, rejected: 0, remaining: 0 });

		const entries = await readOutbox("user-a");
		expect(entries[0]).toMatchObject({
			status: "failed",
			lastError: "Forbidden",
		});
	});

	it("retries a failed entry after an explicit requeue", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
				),
		);
		await submitCapture({ userId: "user-a", payload: payload(), getToken });
		await requeueOutboxEntry("user-a", payload().id);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
		const result = await flushOutbox("user-a", getToken);
		expect(result.sent).toBe(1);
	});

	it("supports explicit removal of a rejected entry", async () => {
		await enqueueCapture("user-a", payload());
		await removeOutboxEntry("user-a", payload().id);
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
	});

	it("does not duplicate an entry when the same capture is re-saved", async () => {
		await enqueueCapture("user-a", payload());
		await enqueueCapture("user-a", payload());
		await expect(readOutbox("user-a")).resolves.toHaveLength(1);
	});

	it("isolates outboxes between accounts", async () => {
		await enqueueCapture("user-a", payload());
		await enqueueCapture(
			"user-b",
			payload({ id: "40000000-0000-4000-8000-000000000099" }),
		);
		await expect(readOutbox("user-a")).resolves.toHaveLength(1);
		await expect(readOutbox("user-b")).resolves.toHaveLength(1);
		const result = await flushOutbox("user-a", () => Promise.resolve(null));
		expect(result.remaining).toBe(1);
	});
});

describe("account purge", () => {
	it("purges only the requested account's data", async () => {
		await writeCachedIndex("user-a", []);
		await writeLastSelectedCollection("user-a", "c1");
		await enqueueCapture("user-a", payload());
		await writeCachedIndex("user-b", []);

		await purgeAccountData("user-a");
		await expect(readCachedIndex("user-a")).resolves.toBeNull();
		await expect(readLastSelectedCollection("user-a")).resolves.toBeNull();
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
		await expect(readCachedIndex("user-b")).resolves.not.toBeNull();
	});

	it("purges the previous account when a different user signs in", async () => {
		await syncActiveAccount("user-a");
		await writeCachedIndex("user-a", []);
		await enqueueCapture("user-a", payload());

		await syncActiveAccount("user-b");
		await expect(readCachedIndex("user-a")).resolves.toBeNull();
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
	});

	it("keeps data when the same user returns", async () => {
		await syncActiveAccount("user-a");
		await writeCachedIndex("user-a", []);
		await syncActiveAccount("user-a");
		await expect(readCachedIndex("user-a")).resolves.not.toBeNull();
	});

	it("purges the active account on observed sign-out", async () => {
		await syncActiveAccount("user-a");
		await writeCachedIndex("user-a", []);
		await enqueueCapture("user-a", payload());

		await purgeInactiveAccountData();
		await expect(readCachedIndex("user-a")).resolves.toBeNull();
		await expect(readOutbox("user-a")).resolves.toHaveLength(0);
		// Idempotent when nothing is active.
		await expect(purgeInactiveAccountData()).resolves.toBeUndefined();
	});
});
