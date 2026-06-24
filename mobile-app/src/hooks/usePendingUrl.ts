/**
 * Reads pending URLs and structured captures from the App Group shared
 * container written by the share extension.
 *
 * Priority: pendingCaptures (extension picked a collection) > pendingUrls
 * (plain URL, present SaveProductSheet for manual assignment).
 */

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, NativeModules } from "react-native";

const { AppGroupModule } = NativeModules;

export type PendingCapture = {
	url: string;
	title?: string;
	collectionId: string;
	sectionId?: string;
};

async function fetchPendingCaptures(): Promise<PendingCapture[]> {
	try {
		const raw = await AppGroupModule?.getPendingCaptures?.();
		if (!Array.isArray(raw) || raw.length === 0) return [];
		return raw
			.map((s: string) => {
				try {
					return JSON.parse(s) as PendingCapture;
				} catch {
					return null;
				}
			})
			.filter((c): c is PendingCapture => !!c?.collectionId);
	} catch {
		return [];
	}
}

async function fetchPendingUrls(): Promise<string[]> {
	try {
		const urls = await AppGroupModule.getPendingUrls();
		return Array.from(
			new Set(
				(Array.isArray(urls) ? urls : [])
					.map((url) => (typeof url === "string" ? url.trim() : ""))
					.filter(Boolean),
			),
		);
	} catch {
		return [];
	}
}

async function fetchPendingUrlDebugEvents(): Promise<string[]> {
	try {
		const events = await AppGroupModule.getPendingUrlDebugEvents?.();
		return Array.isArray(events)
			? events.filter((event) => typeof event === "string")
			: [];
	} catch {
		return [];
	}
}

export function usePendingUrl() {
	const [queue, setQueue] = useState<string[]>([]);
	const [captures, setCaptures] = useState<PendingCapture[]>([]);
	const appState = useRef(AppState.currentState);
	const loaded = useRef(false);

	async function check() {
		// Structured captures take priority — extension already picked a collection
		const newCaptures = await fetchPendingCaptures();
		if (newCaptures.length > 0) {
			AppGroupModule?.clearPendingCaptures?.();
			// Also clear pendingUrls to avoid SaveProductSheet opening for the same URLs
			AppGroupModule?.clearPendingUrls?.();
			setCaptures((prev) => [...prev, ...newCaptures]);
			return;
		}

		// Fall through to plain URLs
		const urls = await fetchPendingUrls();
		const debugEvents = await fetchPendingUrlDebugEvents();
		if (__DEV__ && debugEvents.length > 0) {
			console.log("[pending-url-debug]", debugEvents);
			AppGroupModule.clearPendingUrlDebugEvents?.();
		}
		if (urls.length === 0) return;
		AppGroupModule.clearPendingUrls();
		setQueue((prev) =>
			Array.from(new Set([...prev, ...urls.filter((u) => !prev.includes(u))])),
		);
	}

	useEffect(() => {
		if (loaded.current) return;
		loaded.current = true;

		check();

		const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
			if (appState.current !== "active" && next === "active") check();
			appState.current = next;
		});

		return () => sub.remove();
	}, []);

	const pendingUrl = queue[0] ?? null;
	const queueLength = queue.length;

	function clearPendingUrl() {
		setQueue((prev) => prev.slice(1));
	}

	const pendingCapture = captures[0] ?? null;

	function clearPendingCapture() {
		setCaptures((prev) => prev.slice(1));
	}

	return { pendingUrl, clearPendingUrl, queueLength, pendingCapture, clearPendingCapture };
}
