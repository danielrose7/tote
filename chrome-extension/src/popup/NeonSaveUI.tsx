import { useAuth } from "@clerk/chrome-extension";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_URL } from "../config";
import {
	type CaptureOutboxEntry,
	flushOutbox,
	readCachedIndex,
	readLastSelectedCollection,
	readOutbox,
	removeOutboxEntry,
	requeueOutboxEntry,
	submitCapture,
	syncActiveAccount,
	writeCachedIndex,
	writeLastSelectedCollection,
} from "../lib/captureStore";
import type { ExtractedMetadata } from "../lib/extractors/types";
import {
	buildCapturePayload,
	type CaptureIds,
	createCaptureIds,
	fetchNeonCaptureCollections,
	type NeonCaptureCollection,
	NeonCaptureRequestError,
} from "../lib/neonCapture";

export function NeonSaveUI({
	metadata,
	onSuccess,
	onQueued,
	onUnavailable,
}: {
	metadata: ExtractedMetadata;
	onSuccess: (collectionId: string) => void;
	onQueued: (collectionId: string) => void;
	onUnavailable: () => void;
}) {
	const { getToken, userId } = useAuth();
	const [collections, setCollections] = useState<NeonCaptureCollection[]>([]);
	const [selectedCollection, setSelectedCollection] = useState("");
	const [selectedSection, setSelectedSection] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// True while the picker shows the cached index because the network read
	// failed; the user can still queue saves into the outbox.
	const [offline, setOffline] = useState(false);
	const [outbox, setOutbox] = useState<CaptureOutboxEntry[]>([]);
	// Stable per-capture identity so a retry replays the original save instead
	// of inserting a duplicate. Reset when the destination changes.
	const captureIds = useRef<CaptureIds | null>(null);
	const selected = useMemo(
		() =>
			collections.find((collection) => collection.id === selectedCollection),
		[collections, selectedCollection],
	);
	const pendingCount = useMemo(
		() => outbox.filter((entry) => entry.status !== "failed").length,
		[outbox],
	);
	const failedEntries = useMemo(
		() => outbox.filter((entry) => entry.status === "failed"),
		[outbox],
	);

	const refreshOutbox = useCallback(async () => {
		if (!userId) return;
		setOutbox(await readOutbox(userId));
	}, [userId]);

	const applySelection = useCallback(
		async (nextCollections: NeonCaptureCollection[], accountId: string) => {
			const storedId = await readLastSelectedCollection(accountId);
			setSelectedCollection((current) => {
				if (nextCollections.some((collection) => collection.id === current)) {
					return current;
				}
				return nextCollections.some((collection) => collection.id === storedId)
					? (storedId as string)
					: (nextCollections[0]?.id ?? "");
			});
		},
		[],
	);

	useEffect(() => {
		if (!userId) return;
		let cancelled = false;
		const load = async () => {
			await syncActiveAccount(userId);
			void flushOutbox(userId, getToken).then(() => {
				if (!cancelled) void refreshOutbox();
			});
			const cached = await readCachedIndex(userId);
			if (cached && !cancelled) {
				setCollections(cached.collections);
				await applySelection(cached.collections, userId);
				setLoading(false);
			}
			try {
				const token = await getToken();
				if (!token) throw new Error("Your Tote session is unavailable.");
				const nextCollections = await fetchNeonCaptureCollections(token);
				if (cancelled) return;
				// A successful read is the authoritative index; it also drops
				// collections the account can no longer write to.
				await writeCachedIndex(userId, nextCollections);
				setCollections(nextCollections);
				setOffline(false);
				await applySelection(nextCollections, userId);
			} catch (loadError) {
				if (
					loadError instanceof NeonCaptureRequestError &&
					[404, 409].includes(loadError.status)
				) {
					onUnavailable();
					return;
				}
				if (!cancelled) {
					if (cached) {
						setOffline(true);
					} else {
						setError(
							loadError instanceof Error
								? loadError.message
								: "Could not load collections.",
						);
					}
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [userId, getToken, onUnavailable, refreshOutbox, applySelection]);

	useEffect(() => {
		if (!userId) return;
		const onOnline = () => {
			void flushOutbox(userId, getToken).then(() => refreshOutbox());
		};
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [userId, getToken, refreshOutbox]);

	const chooseCollection = (collectionId: string) => {
		captureIds.current = null;
		setSelectedCollection(collectionId);
		setSelectedSection("");
		if (userId) void writeLastSelectedCollection(userId, collectionId);
	};

	const chooseSection = (sectionId: string) => {
		captureIds.current = null;
		setSelectedSection(sectionId);
	};

	const save = async () => {
		if (!selectedCollection || !userId) return;
		setSaving(true);
		setError(null);
		captureIds.current ??= createCaptureIds();
		const outcome = await submitCapture({
			userId,
			payload: buildCapturePayload({
				ids: captureIds.current,
				collectionId: selectedCollection,
				sectionId: selectedSection || null,
				metadata,
			}),
			getToken,
		});
		if (outcome.status === "saved") {
			captureIds.current = null;
			onSuccess(selectedCollection);
			return;
		}
		if (outcome.status === "queued") {
			captureIds.current = null;
			onQueued(selectedCollection);
			return;
		}
		setError(outcome.message);
		await refreshOutbox();
		setSaving(false);
	};

	const retryEntry = async (nodeId: string) => {
		if (!userId) return;
		await requeueOutboxEntry(userId, nodeId);
		await flushOutbox(userId, getToken);
		await refreshOutbox();
	};

	const discardEntry = async (nodeId: string) => {
		if (!userId) return;
		await removeOutboxEntry(userId, nodeId);
		await refreshOutbox();
	};

	if (loading) {
		return (
			<div className="loading">
				<div className="spinner" />
				<span>Loading collections...</span>
			</div>
		);
	}
	if (error && collections.length === 0) {
		return <div className="error">{error}</div>;
	}
	if (collections.length === 0) {
		return (
			<div className="empty-collections">
				<p>No writable collections yet.</p>
				<button
					type="button"
					className="save-button"
					onClick={() => chrome.tabs.create({ url: `${APP_URL}/collections` })}
				>
					Open Tote
				</button>
			</div>
		);
	}

	return (
		<>
			{offline && (
				<div className="offline-banner">
					Offline — showing saved collections. Saves will sync when you're back
					online.
				</div>
			)}
			{error && <div className="error">{error}</div>}
			<div className="form-group">
				<label htmlFor="neon-collection">Collection</label>
				<select
					id="neon-collection"
					value={selectedCollection}
					onChange={(event) => chooseCollection(event.target.value)}
					disabled={saving}
				>
					{collections.map((collection) => (
						<option key={collection.id} value={collection.id}>
							{collection.name}
						</option>
					))}
				</select>
			</div>
			<div className="form-group">
				<label htmlFor="neon-section">
					Section <span className="optional">(optional)</span>
				</label>
				<select
					id="neon-section"
					value={selectedSection}
					onChange={(event) => chooseSection(event.target.value)}
					disabled={saving || !selected?.sections.length}
				>
					<option value="">No section</option>
					{selected?.sections.map((section) => (
						<option key={section.id} value={section.id}>
							{section.name}
						</option>
					))}
				</select>
			</div>
			<button
				type="button"
				className="save-button"
				onClick={save}
				disabled={saving || !selectedCollection}
			>
				{saving ? "Saving..." : "Save to Tote"}
			</button>
			{pendingCount > 0 && (
				<div className="outbox-status">
					{pendingCount} {pendingCount === 1 ? "save" : "saves"} waiting to sync
				</div>
			)}
			{failedEntries.map((entry) => (
				<div className="outbox-failed" key={entry.nodeId}>
					<div className="outbox-failed-info">
						<span className="outbox-failed-title">{entry.payload.title}</span>
						<span className="outbox-failed-error">{entry.lastError}</span>
					</div>
					<div className="outbox-failed-actions">
						<button type="button" onClick={() => retryEntry(entry.nodeId)}>
							Retry
						</button>
						<button type="button" onClick={() => discardEntry(entry.nodeId)}>
							Remove
						</button>
					</div>
				</div>
			))}
		</>
	);
}
