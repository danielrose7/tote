"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCuratorStore } from "../store/curatorStore";

export interface SectionToExtract {
	slug: string;
	title: string;
	urls: string[];
	mock?: boolean;
}

export function useCuratorSession(sessionId: string | null) {
	const { phase, hydrateFromSync, setRealtimeEnabled } = useCuratorStore();

	const extractedSlugsRef = useRef<Set<string>>(new Set());

	const syncSessionState = useCallback(
		async (sid: string) => {
			try {
				const res = await fetch(`/api/curate/sync/${sid}`);
				if (!res.ok) return;
				const snap = await res.json();

				if (snap.extractedSlugs) {
					for (const slug of snap.extractedSlugs as string[]) {
						extractedSlugsRef.current.add(slug);
					}
				}

				hydrateFromSync(snap);
			} catch {
				// best-effort
			}
		},
		[hydrateFromSync],
	);

	const hasSyncedRef = useRef(false);
	useEffect(() => {
		if (
			!sessionId ||
			hasSyncedRef.current ||
			phase === "complete" ||
			phase === "error"
		)
			return;
		hasSyncedRef.current = true;
		syncSessionState(sessionId);
	}, [sessionId, phase, syncSessionState]);

	// Realtime is the primary path, but long-running server phases can miss the
	// terminal event in an open tab. Poll persisted session state as a fallback.
	useEffect(() => {
		if (!sessionId || phase === "complete" || phase === "error") return;
		const interactivePhases = new Set([
			"interview-round-1",
			"interview-round-2",
			"brief-review",
		]);
		if (interactivePhases.has(phase)) return;

		const interval = window.setInterval(() => {
			syncSessionState(sessionId);
		}, 5000);

		return () => window.clearInterval(interval);
	}, [sessionId, phase, syncSessionState]);

	const handleReconnect = useCallback(async () => {
		if (sessionId) await syncSessionState(sessionId);
		setRealtimeEnabled(false);
		setTimeout(() => setRealtimeEnabled(true), 100);
	}, [sessionId, setRealtimeEnabled, syncSessionState]);

	const onWakeRef = useRef<() => void>(() => {});
	onWakeRef.current = () => {
		if (phase === "complete" || phase === "error") return;
		handleReconnect();
	};
	useEffect(() => {
		if (!sessionId) return;
		const handler = () => onWakeRef.current();
		const visHandler = () => {
			if (document.visibilityState === "visible") onWakeRef.current();
		};
		window.addEventListener("online", handler);
		window.addEventListener("focus", handler);
		document.addEventListener("visibilitychange", visHandler);
		return () => {
			window.removeEventListener("online", handler);
			window.removeEventListener("focus", handler);
			document.removeEventListener("visibilitychange", visHandler);
		};
	}, [sessionId]);

	function queueSectionForExtraction(_section: SectionToExtract) {
		// no-op: server handles extraction
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset refs when sessionId changes
	useEffect(() => {
		extractedSlugsRef.current = new Set();
		hasSyncedRef.current = false;
	}, [sessionId]);

	return { queueSectionForExtraction, handleReconnect };
}
