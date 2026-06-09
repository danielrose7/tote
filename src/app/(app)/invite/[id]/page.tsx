"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../../components/ToastNotification";
import styles from "./page.module.css";

type InviteStatus = "loading" | "accepting" | "success" | "error";

export default function InvitePage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { showToast } = useToast();
	const { isSignedIn, isLoaded } = useUser();
	const acceptedToken = useRef<string | null>(null);
	const [status, setStatus] = useState<InviteStatus>("loading");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const token = params.id;

	useEffect(() => {
		if (!isLoaded || !isSignedIn || !token || acceptedToken.current === token) {
			return;
		}
		acceptedToken.current = token;
		setStatus("accepting");

		void fetch("/api/v2/collection-invites/accept", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token }),
		})
			.then(async (response) => {
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as {
						error?: string;
					} | null;
					throw new Error(body?.error || "Could not accept this invite");
				}
				return response.json() as Promise<{ collectionId: string }>;
			})
			.then(({ collectionId }) => {
				setStatus("success");
				showToast({
					title: "Invite accepted",
					description: "The collection has been added to your account.",
					variant: "success",
				});
				window.setTimeout(
					() => router.replace(`/collections/${collectionId}`),
					900,
				);
			})
			.catch((error: unknown) => {
				setStatus("error");
				setErrorMessage(
					error instanceof Error
						? error.message
						: "Could not accept this invite",
				);
			});
	}, [isLoaded, isSignedIn, router, showToast, token]);

	if (isLoaded && !isSignedIn) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.icon} aria-hidden="true">
						+
					</div>
					<h1 className={styles.title}>You have been invited</h1>
					<p className={styles.description}>
						Sign in to add this shared collection to your account.
					</p>
					<SignInButton mode="modal">
						<button type="button" className={styles.signInButton}>
							Sign in to continue
						</button>
					</SignInButton>
				</div>
			</div>
		);
	}

	if (status === "loading" || status === "accepting") {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.spinner} />
					<p className={styles.loadingText}>
						{status === "accepting" ? "Accepting invite..." : "Loading..."}
					</p>
				</div>
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<div className={styles.errorIcon}>!</div>
					<h1 className={styles.title}>Invite unavailable</h1>
					<p className={styles.description}>{errorMessage}</p>
					<button
						type="button"
						className={styles.button}
						onClick={() => router.replace("/collections")}
					>
						Go to Collections
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.card}>
				<div className={styles.successIcon} aria-hidden="true">
					✓
				</div>
				<h1 className={styles.title}>Invite accepted</h1>
				<p className={styles.description}>Opening the collection...</p>
			</div>
		</div>
	);
}
