"use client";

import { SignedIn, SignedOut, SignOutButton, UserProfile } from "@clerk/nextjs";
import { useAccount } from "jazz-tools/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AiCreditsPanel } from "../../../components/Billing/AiCreditsPanel";
import { Header } from "../../../components/Header/Header";
import { JazzAccount } from "../../../schema";
import styles from "./settings.module.css";

type SettingsTab = "account" | "billing";

export default function SettingsPage() {
	const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "error">(
		"loading",
	);
	const searchParams = useSearchParams();
	const [activeTab, setActiveTab] = useState<SettingsTab>("account");

	const me = useAccount(JazzAccount, {
		resolve: {
			root: true,
		},
	});

	const syncMetadata = useCallback(async () => {
		setSyncStatus("loading");
		try {
			// Check current metadata
			const checkResponse = await fetch("/api/user/debug-metadata");
			const data = await checkResponse.json();

			// If not synced, auto-sync
			if (!data.publicMetadata?.jazzAccountId && me.$jazz?.id) {
				const syncResponse = await fetch("/api/user/sync-metadata-now", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jazzAccountId: me.$jazz?.id }),
				});

				if (syncResponse.ok) {
					setSyncStatus("synced");
				} else {
					setSyncStatus("error");
				}
			} else if (data.publicMetadata?.jazzAccountId) {
				setSyncStatus("synced");
			} else {
				setSyncStatus("error");
			}
		} catch (error) {
			console.error("Error syncing metadata:", error);
			setSyncStatus("error");
		}
	}, [me.$jazz?.id]);

	// Auto-sync metadata on page load
	useEffect(() => {
		if (me.$jazz?.id) {
			syncMetadata();
		}
	}, [me.$jazz?.id, syncMetadata]);

	useEffect(() => {
		if (searchParams.get("credits") === "added") {
			setActiveTab("billing");
			window.history.replaceState({}, "", "/settings?tab=billing");
		} else if (searchParams.get("tab") === "billing") {
			setActiveTab("billing");
		} else {
			setActiveTab("account");
		}
	}, [searchParams]);

	return (
		<div className={styles.container}>
			<SignedOut>
				<div className={styles.center}>
					<p>Please sign in to access settings.</p>
					<Link href="/">Back to home</Link>
				</div>
			</SignedOut>

			<SignedIn>
				<Header />

				<main className={styles.main}>
					<div className={styles.settingsRow}>
						<div className={styles.tabs} role="tablist" aria-label="Settings">
							<button
								type="button"
								role="tab"
								aria-selected={activeTab === "account"}
								className={styles.tabButton}
								onClick={() => {
									setActiveTab("account");
									window.history.replaceState({}, "", "/settings");
								}}
							>
								Account
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={activeTab === "billing"}
								className={styles.tabButton}
								onClick={() => {
									setActiveTab("billing");
									window.history.replaceState({}, "", "/settings?tab=billing");
								}}
							>
								Billing
							</button>
						</div>
						<SignOutButton>
							<button type="button" className={styles.logoutButton}>
								Log out
							</button>
						</SignOutButton>
					</div>

					{activeTab === "account" && (
						<>
							<div className={styles.syncStatus}>
								<span className={styles.syncLabel}>Extension sync:</span>
								<span
									className={
										syncStatus === "synced"
											? styles.statusSynced
											: syncStatus === "error"
												? styles.statusError
												: styles.statusLoading
									}
								>
									{syncStatus === "synced" && "Ready"}
									{syncStatus === "error" && "Error - please refresh"}
									{syncStatus === "loading" && "Syncing..."}
								</span>
								{syncStatus === "error" && (
									<button
										type="button"
										onClick={syncMetadata}
										className={styles.retryButton}
									>
										Retry
									</button>
								)}
							</div>

							<div className={styles.profileWrapper}>
								<UserProfile
									routing="hash"
									appearance={{
										elements: {
											rootBox: styles.clerkRootBox,
											card: styles.clerkCard,
										},
									}}
								/>
							</div>
						</>
					)}

					{activeTab === "billing" && (
						<div className={styles.billingWrapper}>
							<AiCreditsPanel returnPath="/settings?tab=billing" />
						</div>
					)}
				</main>
			</SignedIn>
		</div>
	);
}
