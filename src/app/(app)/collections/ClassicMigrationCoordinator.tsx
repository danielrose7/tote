"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { exportClassicCollections } from "../../../lib/collections/classicMigrationExport";
import { fingerprintClassicMigrationCollectionsInBrowser } from "../../../lib/collections/migrationPayload";
import styles from "./ClassicMigrationCoordinator.module.css";

type ReadySummary = {
	collectionCount: number;
	itemCount: number;
};

export function ClassicMigrationCoordinator({
	rootBlocks,
	initialReady,
}: {
	rootBlocks?: unknown;
	initialReady?: ReadySummary;
}) {
	const { user } = useUser();
	const router = useRouter();
	const started = useRef(false);
	const [attempt, setAttempt] = useState(0);
	const [phase, setPhase] = useState<
		"hidden" | "importing" | "ready" | "confirming" | "error"
	>(initialReady ? "ready" : "hidden");
	const [summary, setSummary] = useState<ReadySummary | null>(
		initialReady ?? null,
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void attempt;
		if (!rootBlocks || !user?.id || started.current) return;
		started.current = true;
		setPhase("importing");

		const run = async () => {
			const statusResponse = await fetch("/api/v2/migration/status");
			if (statusResponse.ok) {
				const status = (await statusResponse.json()) as {
					dataSource: string;
					cutoverAt: string | null;
					error: { code?: string } | null;
				};
				if (status.dataSource === "classic_jazz" && status.cutoverAt) {
					setPhase("hidden");
					return;
				}
				if (status.dataSource === "migration_failed" && attempt === 0) {
					setError(
						status.error?.code === "verification_failed"
							? "The imported collections could not be verified."
							: "The collection migration could not be completed.",
					);
					setPhase("error");
					return;
				}
			}
			const collections = exportClassicCollections(rootBlocks);
			const sourceFingerprint =
				await fingerprintClassicMigrationCollectionsInBrowser(collections);
			const response = await fetch("/api/v2/migration/import", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					migrationVersion: 1,
					sourceFingerprint,
					collections,
				}),
			});
			if (response.status === 404) {
				setPhase("hidden");
				return;
			}
			const body = (await response.json().catch(() => null)) as {
				error?: string;
				collectionCount?: number;
				itemCount?: number;
				collectionIdsByLegacyJazzId?: Record<string, string>;
			} | null;
			if (!response.ok) {
				throw new Error(body?.error || "Collection migration failed.");
			}
			const nextSummary = {
				collectionCount: body?.collectionCount ?? 0,
				itemCount: body?.itemCount ?? 0,
			};
			localStorage.setItem(
				`tote:collection-migration:${user.id}:v1`,
				JSON.stringify({
					migrationVersion: 1,
					sourceFingerprint,
					...nextSummary,
					collectionIdsByLegacyJazzId: body?.collectionIdsByLegacyJazzId ?? {},
					verifiedAt: new Date().toISOString(),
				}),
			);
			setSummary(nextSummary);
			setPhase("ready");
		};

		run().catch((migrationError) => {
			setError(
				migrationError instanceof Error
					? migrationError.message
					: "Collection migration failed.",
			);
			setPhase("error");
		});
	}, [rootBlocks, user?.id, attempt]);

	const confirm = async () => {
		setPhase("confirming");
		setError(null);
		const response = await fetch("/api/v2/migration/confirm", {
			method: "POST",
		});
		if (!response.ok) {
			const body = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;
			setError(body?.error || "Could not switch collection storage.");
			setPhase("ready");
			return;
		}
		router.refresh();
	};

	if (phase === "hidden") return null;

	return (
		<section className={styles.card} aria-live="polite">
			{phase === "importing" && (
				<>
					<h2>Preparing the new collection storage</h2>
					<p>
						Your current Jazz data remains authoritative while Tote verifies the
						import.
					</p>
				</>
			)}
			{(phase === "ready" || phase === "confirming") && (
				<>
					<h2>Your collections are ready to switch</h2>
					<p>
						Verified {summary?.collectionCount ?? 0} collections and{" "}
						{summary?.itemCount ?? 0} items. Classic Jazz stays available
						read-only for 14 days after you switch.
					</p>
					{error && <p className={styles.error}>{error}</p>}
					<div className={styles.actions}>
						<button
							type="button"
							className={styles.primary}
							disabled={phase === "confirming"}
							onClick={confirm}
						>
							{phase === "confirming"
								? "Switching..."
								: "Switch to new collections"}
						</button>
					</div>
				</>
			)}
			{phase === "error" && (
				<>
					<h2>Collection migration needs another try</h2>
					<p className={styles.error}>{error}</p>
					<div className={styles.actions}>
						<button
							type="button"
							className={styles.secondary}
							onClick={() => {
								started.current = false;
								setError(null);
								setAttempt((current) => current + 1);
							}}
						>
							Retry migration
						</button>
					</div>
				</>
			)}
		</section>
	);
}
