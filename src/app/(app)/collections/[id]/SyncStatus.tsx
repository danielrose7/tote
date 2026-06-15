"use client";

import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import styles from "./SyncStatus.module.css";

type Status = "idle" | "syncing" | "saved";

export function SyncStatus({ collectionId }: { collectionId: string }) {
	const isMutating = useIsMutating({
		mutationKey: ["collections", "nodes"],
		exact: false,
	});
	const [status, setStatus] = useState<Status>("idle");
	const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prevMutating = useRef(0);

	useEffect(() => {
		if (isMutating > 0) {
			if (savedTimer.current) {
				clearTimeout(savedTimer.current);
				savedTimer.current = null;
			}
			setStatus("syncing");
		} else if (prevMutating.current > 0) {
			setStatus("saved");
			savedTimer.current = setTimeout(() => setStatus("idle"), 3000);
		}
		prevMutating.current = isMutating;
		return () => {
			if (savedTimer.current) clearTimeout(savedTimer.current);
		};
	}, [isMutating]);

	if (status === "idle") return null;

	if (status === "syncing") {
		return (
			<span className={styles.status} aria-live="polite">
				<svg
					className={styles.spinner}
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
				Syncing
			</span>
		);
	}

	return (
		<span className={`${styles.status} ${styles.saved}`} aria-live="polite">
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
			Saved
		</span>
	);
}
