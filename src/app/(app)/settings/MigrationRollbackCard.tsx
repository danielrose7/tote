"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./MigrationRollbackCard.module.css";

type MigrationStatus = {
	dataSource: string;
	rollbackExpiresAt: string | null;
};

export function MigrationRollbackCard() {
	const router = useRouter();
	const [status, setStatus] = useState<MigrationStatus | null>(null);
	const [rollingBack, setRollingBack] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/v2/migration/status")
			.then((response) => (response.ok ? response.json() : null))
			.then((nextStatus: MigrationStatus | null) => setStatus(nextStatus))
			.catch(() => setStatus(null));
	}, []);

	if (
		!status ||
		status.dataSource !== "neon" ||
		!status.rollbackExpiresAt ||
		new Date(status.rollbackExpiresAt) <= new Date()
	) {
		return null;
	}

	const rollback = async () => {
		if (
			!window.confirm(
				"Switch collection reads back to Classic Jazz? Neon data will be retained.",
			)
		) {
			return;
		}
		setRollingBack(true);
		setError(null);
		const response = await fetch("/api/v2/migration/rollback", {
			method: "POST",
		});
		if (!response.ok) {
			const body = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;
			setError(body?.error || "Rollback failed.");
			setRollingBack(false);
			return;
		}
		router.push("/collections");
		router.refresh();
	};

	return (
		<section className={styles.card}>
			<h2>Classic Jazz rollback</h2>
			<p>
				Available until {new Date(status.rollbackExpiresAt).toLocaleString()}.
				This switches collection reads back without deleting the verified Neon
				import.
			</p>
			{error && <p className={styles.error}>{error}</p>}
			<button type="button" disabled={rollingBack} onClick={rollback}>
				{rollingBack ? "Rolling back..." : "Use Classic Jazz"}
			</button>
		</section>
	);
}
