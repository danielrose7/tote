import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildCapturePayload,
	createCaptureIds,
	fetchNeonCaptureCollections,
	saveNeonCapture,
} from "./neonCapture";

afterEach(() => {
	vi.unstubAllGlobals();
});

const CAPTURE_IDS = {
	nodeId: "40000000-0000-4000-8000-000000000011",
	mutationId: "50000000-0000-4000-8000-000000000011",
};

describe("Neon capture client", () => {
	it("loads writable collections with a bearer token", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					collections: [
						{
							id: "40000000-0000-4000-8000-000000000001",
							name: "Lighting",
							color: null,
							role: "owner",
							sections: [],
						},
					],
				}),
				{ status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchNeonCaptureCollections("session-token")).resolves.toEqual(
			[expect.objectContaining({ name: "Lighting" })],
		);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/v2/capture"),
			expect.objectContaining({
				headers: expect.objectContaining({
					authorization: "Bearer session-token",
				}),
			}),
		);
	});

	it("sends caller-provided ids and normalized product metadata", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: "node-id", replayed: false }), {
				status: 201,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await saveNeonCapture({
			token: "session-token",
			ids: CAPTURE_IDS,
			collectionId: "40000000-0000-4000-8000-000000000001",
			sectionId: null,
			metadata: {
				title: "Task lamp",
				url: "https://example.com/lamp?utm_source=test",
				price: "$129",
			},
		});
		const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(JSON.parse(String(request.body))).toMatchObject({
			id: CAPTURE_IDS.nodeId,
			mutationId: CAPTURE_IDS.mutationId,
			title: "Task lamp",
			url: "https://example.com/lamp",
		});
	});

	it("reuses the same ids across retries so the server can replay", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: "node-id", replayed: true }), {
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const attempt = {
			token: "session-token",
			ids: CAPTURE_IDS,
			collectionId: "40000000-0000-4000-8000-000000000001",
			sectionId: null,
			metadata: { title: "Task lamp", url: "https://example.com/lamp" },
		};
		await expect(saveNeonCapture(attempt)).rejects.toThrow("Failed to fetch");
		await expect(saveNeonCapture(attempt)).resolves.toEqual({
			id: "node-id",
			replayed: true,
		});

		const bodies = fetchMock.mock.calls.map((call) =>
			JSON.parse(String((call[1] as RequestInit).body)),
		);
		expect(bodies[0].id).toBe(bodies[1].id);
		expect(bodies[0].mutationId).toBe(bodies[1].mutationId);
	});

	it("generates distinct uuid pairs per capture", () => {
		const first = createCaptureIds();
		const second = createCaptureIds();
		expect(first.nodeId).not.toBe(first.mutationId);
		expect(first.nodeId).not.toBe(second.nodeId);
		expect(first.mutationId).not.toBe(second.mutationId);
	});

	it("omits empty and invalid optional fields the API would reject", () => {
		const payload = buildCapturePayload({
			ids: CAPTURE_IDS,
			collectionId: "40000000-0000-4000-8000-000000000001",
			sectionId: null,
			metadata: {
				title: "   ",
				url: "https://example.com/lamp",
				imageUrl: "",
				images: ["https://example.com/a.jpg", "/relative.jpg", ""],
				price: "  ",
				description: "",
			},
		});
		expect(payload).toEqual({
			id: CAPTURE_IDS.nodeId,
			mutationId: CAPTURE_IDS.mutationId,
			collectionId: "40000000-0000-4000-8000-000000000001",
			sectionId: null,
			title: "Untitled",
			url: "https://example.com/lamp",
			imageUrl: undefined,
			images: ["https://example.com/a.jpg"],
			price: undefined,
			description: undefined,
		});
	});

	it("exposes HTTP status for Classic Jazz fallback decisions", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "Not enabled" }), {
					status: 409,
				}),
			),
		);

		await expect(fetchNeonCaptureCollections("session-token")).rejects.toEqual(
			expect.objectContaining<{ status: number }>({
				status: 409,
			}),
		);
	});
});
