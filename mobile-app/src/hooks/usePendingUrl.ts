/**
 * Reads pending URLs from the App Group shared container written by the
 * share extension (ShareExtensionViewController.swift → group.tools.tote.app).
 *
 * Maintains a queue so multiple shares before opening the app are all
 * presented one after the other.
 */

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, NativeModules } from "react-native";

const { AppGroupModule } = NativeModules;

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
	const appState = useRef(AppState.currentState);
	const loaded = useRef(false);

	async function check() {
		const urls = await fetchPendingUrls();
		const debugEvents = await fetchPendingUrlDebugEvents();
		if (__DEV__ && debugEvents.length > 0) {
			console.log("[pending-url-debug]", debugEvents);
			AppGroupModule.clearPendingUrlDebugEvents?.();
		}
		if (urls.length === 0) return;
		// Clear from shared container immediately so they aren't re-read
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

	return { pendingUrl, clearPendingUrl, queueLength };
}
