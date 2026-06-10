import { useAuth } from "@clerk/chrome-extension";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_URL } from "../config";
import type { ExtractedMetadata } from "../lib/extractors/types";
import {
	type CaptureIds,
	createCaptureIds,
	fetchNeonCaptureCollections,
	type NeonCaptureCollection,
	NeonCaptureRequestError,
	saveNeonCapture,
} from "../lib/neonCapture";

export function NeonSaveUI({
	metadata,
	onSuccess,
	onUnavailable,
}: {
	metadata: ExtractedMetadata;
	onSuccess: (collectionId: string) => void;
	onUnavailable: () => void;
}) {
	const { getToken } = useAuth();
	const [collections, setCollections] = useState<NeonCaptureCollection[]>([]);
	const [selectedCollection, setSelectedCollection] = useState("");
	const [selectedSection, setSelectedSection] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Stable per-capture identity so a retry replays the original save instead
	// of inserting a duplicate. Reset when the destination changes.
	const captureIds = useRef<CaptureIds | null>(null);
	const selected = useMemo(
		() =>
			collections.find((collection) => collection.id === selectedCollection),
		[collections, selectedCollection],
	);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const token = await getToken();
				if (!token) throw new Error("Your Tote session is unavailable.");
				const nextCollections = await fetchNeonCaptureCollections(token);
				if (cancelled) return;
				setCollections(nextCollections);
				const stored = await chrome.storage.local.get(
					"lastSelectedNeonCollection",
				);
				const storedId = stored.lastSelectedNeonCollection;
				setSelectedCollection(
					nextCollections.some((collection) => collection.id === storedId)
						? storedId
						: (nextCollections[0]?.id ?? ""),
				);
			} catch (loadError) {
				if (
					loadError instanceof NeonCaptureRequestError &&
					[404, 409].includes(loadError.status)
				) {
					onUnavailable();
					return;
				}
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Could not load collections.",
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [getToken, onUnavailable]);

	const chooseCollection = (collectionId: string) => {
		captureIds.current = null;
		setSelectedCollection(collectionId);
		setSelectedSection("");
		void chrome.storage.local.set({
			lastSelectedNeonCollection: collectionId,
		});
	};

	const chooseSection = (sectionId: string) => {
		captureIds.current = null;
		setSelectedSection(sectionId);
	};

	const save = async () => {
		if (!selectedCollection) return;
		setSaving(true);
		setError(null);
		try {
			const token = await getToken();
			if (!token) throw new Error("Your Tote session is unavailable.");
			captureIds.current ??= createCaptureIds();
			await saveNeonCapture({
				token,
				ids: captureIds.current,
				collectionId: selectedCollection,
				sectionId: selectedSection || null,
				metadata,
			});
			captureIds.current = null;
			onSuccess(selectedCollection);
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Could not save this product.",
			);
			setSaving(false);
		}
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
		</>
	);
}
