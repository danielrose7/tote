"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutationState } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { collectionQueryKeys } from "../../lib/collections/queryKeys";
import {
	type CollectionSyncIssue,
	dismissCollectionSyncIssue,
	getCollectionSyncIssues,
} from "../../lib/collections/queryPersistence";
import {
	collectionSyncIssueEvent,
	notifyCollectionSyncIssues,
} from "../../lib/collections/syncStatus";
import styles from "./OfflineBanner.module.css";

function useCollectionSyncIssues(userId: string | null) {
	const [issues, setIssues] = useState<CollectionSyncIssue[]>([]);

	useEffect(() => {
		if (!userId) {
			setIssues([]);
			return;
		}
		const refresh = () => {
			void getCollectionSyncIssues(userId).then(setIssues);
		};
		const handleChange = (event: Event) => {
			const detail = (event as CustomEvent<{ userId?: string }>).detail;
			if (!detail?.userId || detail.userId === userId) refresh();
		};
		refresh();
		window.addEventListener(collectionSyncIssueEvent, handleChange);
		return () =>
			window.removeEventListener(collectionSyncIssueEvent, handleChange);
	}, [userId]);

	return issues;
}

export function OfflineBanner() {
	const { userId } = useAuth();
	const isOnline = useOnlineStatus();
	const pausedStates = useMutationState({
		filters: {
			mutationKey: collectionQueryKeys.all,
			status: "pending",
		},
		select: (mutation) => mutation.state.isPaused,
	});
	const issues = useCollectionSyncIssues(userId);
	const previousPending = useRef(0);
	const [showSynced, setShowSynced] = useState(false);
	const [mounted, setMounted] = useState(false);
	const pendingCount = pausedStates.length;
	const pausedCount = pausedStates.filter(Boolean).length;

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		const didFinish =
			previousPending.current > 0 &&
			pendingCount === 0 &&
			issues.length === 0 &&
			isOnline;
		previousPending.current = pendingCount;
		if (!didFinish) return;
		setShowSynced(true);
		const timeout = window.setTimeout(() => setShowSynced(false), 2_500);
		return () => window.clearTimeout(timeout);
	}, [isOnline, issues.length, pendingCount]);

	if (!mounted) return null;

	const latestIssue = issues[0];
	if (latestIssue && userId) {
		return (
			<div className={`${styles.banner} ${styles.error}`}>
				<div className={styles.content}>
					<span>
						<strong>{latestIssue.operation} needs attention.</strong>{" "}
						{latestIssue.message}
						{issues.length > 1 && ` (${issues.length} unresolved changes)`}
					</span>
					<button
						type="button"
						onClick={() => {
							void dismissCollectionSyncIssue(userId, latestIssue.id).then(() =>
								notifyCollectionSyncIssues(userId),
							);
						}}
					>
						Dismiss
					</button>
				</div>
			</div>
		);
	}

	if (!isOnline) {
		return (
			<div className={`${styles.banner} ${styles.offline}`}>
				<div className={styles.content}>
					<span>
						You are offline.
						{pendingCount > 0
							? ` ${pendingCount} ${
									pendingCount === 1 ? "change is" : "changes are"
								} saved on this device.`
							: " Cached collections remain available."}
					</span>
				</div>
			</div>
		);
	}

	if (pendingCount > 0) {
		const queued = pausedCount === pendingCount;
		return (
			<div className={`${styles.banner} ${styles.syncing}`}>
				<div className={styles.content}>
					<span>
						{queued ? "Waiting to sync" : "Syncing"} {pendingCount}{" "}
						{pendingCount === 1 ? "change" : "changes"}...
					</span>
				</div>
			</div>
		);
	}

	if (showSynced) {
		return (
			<div className={`${styles.banner} ${styles.synced}`}>
				<div className={styles.content}>
					<span>All changes synced.</span>
				</div>
			</div>
		);
	}

	return null;
}
