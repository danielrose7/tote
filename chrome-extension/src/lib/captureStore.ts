import {
	type CapturePayload,
	type NeonCaptureCollection,
	NeonCaptureRequestError,
	sendCapturePayload,
} from "./neonCapture";

// Account-scoped capture cache and durable outbox in chrome.storage.local.
// Neon stays authoritative: the cache only mirrors the last successful read
// and the outbox only preserves not-yet-accepted user intent.

export type CachedCaptureIndex = {
	version: 1;
	userId: string;
	fetchedAt: string;
	collections: NeonCaptureCollection[];
};

export type CaptureOutboxEntry = {
	version: 1;
	userId: string;
	nodeId: string;
	mutationId: string;
	collectionId: string;
	sectionId: string | null;
	payload: CapturePayload;
	status: "pending" | "sending" | "failed";
	attempts: number;
	createdAt: string;
	lastAttemptAt: string | null;
	lastError: string | null;
};

export type SubmitCaptureOutcome =
	| { status: "saved"; id: string; replayed: boolean }
	| { status: "queued" }
	| { status: "rejected"; message: string };

export type FlushResult = {
	sent: number;
	rejected: number;
	remaining: number;
};

const ACTIVE_USER_KEY = "neonCapture:activeUserId";

function indexKey(userId: string) {
	return `neonCapture:index:${userId}`;
}

function outboxKey(userId: string) {
	return `neonCapture:outbox:${userId}`;
}

function lastCollectionKey(userId: string) {
	return `neonCapture:lastCollection:${userId}`;
}

type OutboxRecord = Record<string, CaptureOutboxEntry>;

async function readOutboxRecord(userId: string): Promise<OutboxRecord> {
	const stored = await chrome.storage.local.get(outboxKey(userId));
	const record = stored[outboxKey(userId)] as OutboxRecord | undefined;
	return record ?? {};
}

async function writeOutboxRecord(userId: string, record: OutboxRecord) {
	await chrome.storage.local.set({ [outboxKey(userId)]: record });
}

export async function readCachedIndex(
	userId: string,
): Promise<CachedCaptureIndex | null> {
	const stored = await chrome.storage.local.get(indexKey(userId));
	const index = stored[indexKey(userId)] as CachedCaptureIndex | undefined;
	if (!index || index.version !== 1 || index.userId !== userId) return null;
	return index;
}

export async function writeCachedIndex(
	userId: string,
	collections: NeonCaptureCollection[],
): Promise<CachedCaptureIndex> {
	const index: CachedCaptureIndex = {
		version: 1,
		userId,
		fetchedAt: new Date().toISOString(),
		collections,
	};
	await chrome.storage.local.set({ [indexKey(userId)]: index });
	return index;
}

export async function readLastSelectedCollection(
	userId: string,
): Promise<string | null> {
	const stored = await chrome.storage.local.get(lastCollectionKey(userId));
	return (stored[lastCollectionKey(userId)] as string | undefined) ?? null;
}

export async function writeLastSelectedCollection(
	userId: string,
	collectionId: string,
) {
	await chrome.storage.local.set({
		[lastCollectionKey(userId)]: collectionId,
	});
}

export async function readOutbox(
	userId: string,
): Promise<CaptureOutboxEntry[]> {
	const record = await readOutboxRecord(userId);
	return Object.values(record).sort((a, b) =>
		a.createdAt.localeCompare(b.createdAt),
	);
}

export async function enqueueCapture(
	userId: string,
	payload: CapturePayload,
): Promise<CaptureOutboxEntry> {
	const entry: CaptureOutboxEntry = {
		version: 1,
		userId,
		nodeId: payload.id,
		mutationId: payload.mutationId,
		collectionId: payload.collectionId,
		sectionId: payload.sectionId,
		payload,
		status: "pending",
		attempts: 0,
		createdAt: new Date().toISOString(),
		lastAttemptAt: null,
		lastError: null,
	};
	const record = await readOutboxRecord(userId);
	// Re-saving the same capture (stable nodeId) keeps the original entry so
	// retries replay instead of duplicating.
	record[entry.nodeId] = record[entry.nodeId] ?? entry;
	await writeOutboxRecord(userId, record);
	return record[entry.nodeId];
}

async function patchOutboxEntry(
	userId: string,
	nodeId: string,
	patch: Partial<CaptureOutboxEntry>,
): Promise<CaptureOutboxEntry | null> {
	const record = await readOutboxRecord(userId);
	const entry = record[nodeId];
	if (!entry) return null;
	const next = { ...entry, ...patch };
	record[nodeId] = next;
	await writeOutboxRecord(userId, record);
	return next;
}

export async function removeOutboxEntry(userId: string, nodeId: string) {
	const record = await readOutboxRecord(userId);
	if (!(nodeId in record)) return;
	delete record[nodeId];
	await writeOutboxRecord(userId, record);
}

export async function requeueOutboxEntry(userId: string, nodeId: string) {
	await patchOutboxEntry(userId, nodeId, { status: "pending" });
}

// Permanent rejections need user attention; everything else (network failure,
// expired session, server error) is retried automatically on the next flush.
function isPermanentRejection(error: unknown): boolean {
	return (
		error instanceof NeonCaptureRequestError &&
		[400, 403, 404, 409].includes(error.status)
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Could not save.";
}

async function attemptSend(
	userId: string,
	entry: CaptureOutboxEntry,
	token: string,
): Promise<SubmitCaptureOutcome> {
	await patchOutboxEntry(userId, entry.nodeId, { status: "sending" });
	try {
		const result = await sendCapturePayload(token, entry.payload);
		// Delete only after a successful or idempotently replayed response.
		await removeOutboxEntry(userId, entry.nodeId);
		return { status: "saved", ...result };
	} catch (error) {
		const failure: Partial<CaptureOutboxEntry> = {
			attempts: entry.attempts + 1,
			lastAttemptAt: new Date().toISOString(),
			lastError: errorMessage(error),
		};
		if (isPermanentRejection(error)) {
			await patchOutboxEntry(userId, entry.nodeId, {
				...failure,
				status: "failed",
			});
			return { status: "rejected", message: errorMessage(error) };
		}
		await patchOutboxEntry(userId, entry.nodeId, {
			...failure,
			status: "pending",
		});
		return { status: "queued" };
	}
}

// Persist first, then try the network once. The entry survives popup and
// browser restarts until the server confirms it.
export async function submitCapture({
	userId,
	payload,
	getToken,
}: {
	userId: string;
	payload: CapturePayload;
	getToken: () => Promise<string | null>;
}): Promise<SubmitCaptureOutcome> {
	const entry = await enqueueCapture(userId, payload);
	const token = await getToken().catch(() => null);
	if (!token) return { status: "queued" };
	return attemptSend(userId, entry, token);
}

// Flush pending entries (including ones stuck in "sending" from a popup that
// died mid-request — stable ids make the replay safe). Failed entries wait
// for an explicit user retry.
export async function flushOutbox(
	userId: string,
	getToken: () => Promise<string | null>,
): Promise<FlushResult> {
	const entries = (await readOutbox(userId)).filter(
		(entry) => entry.status !== "failed",
	);
	const result: FlushResult = { sent: 0, rejected: 0, remaining: 0 };
	if (entries.length === 0) return result;
	const token = await getToken().catch(() => null);
	if (!token) {
		result.remaining = entries.length;
		return result;
	}
	for (const entry of entries) {
		const outcome = await attemptSend(userId, entry, token);
		if (outcome.status === "saved") result.sent += 1;
		else if (outcome.status === "rejected") result.rejected += 1;
		else result.remaining += 1;
	}
	return result;
}

export async function purgeAccountData(userId: string) {
	await chrome.storage.local.remove([
		indexKey(userId),
		outboxKey(userId),
		lastCollectionKey(userId),
	]);
}

// Record which account the popup is serving; purge the previous account's
// cache and outbox when a different user signs in on the same profile.
export async function syncActiveAccount(userId: string) {
	const stored = await chrome.storage.local.get(ACTIVE_USER_KEY);
	const previous = stored[ACTIVE_USER_KEY] as string | undefined;
	if (previous && previous !== userId) {
		await purgeAccountData(previous);
	}
	await chrome.storage.local.set({ [ACTIVE_USER_KEY]: userId });
}

// Called when the popup observes a signed-out session.
export async function purgeInactiveAccountData() {
	const stored = await chrome.storage.local.get(ACTIVE_USER_KEY);
	const previous = stored[ACTIVE_USER_KEY] as string | undefined;
	if (!previous) return;
	await purgeAccountData(previous);
	await chrome.storage.local.remove(ACTIVE_USER_KEY);
}
