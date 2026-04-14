"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import styles from "../AuthButton.module.css";

interface LandingAuthButtonsProps {
	showSignIn?: boolean;
	signInLabel?: string;
	signUpLabel?: string;
	signedInLabel?: string;
}

function AuthButtonsFallback() {
	return (
		<div className={styles.buttons}>
			<button className={styles.button} disabled>
				Log in
			</button>
			<button className={`${styles.button} ${styles.buttonPrimary}`} disabled>
				Sign up
			</button>
		</div>
	);
}

function LandingAuthButtonsInner({
	showSignIn = true,
	signInLabel = "Log in",
	signUpLabel = "Sign up",
	signedInLabel = "Open Tote",
}: LandingAuthButtonsProps) {
	return (
		<>
			<SignedOut>
				<div className={styles.buttons}>
					{showSignIn ? (
						<SignInButton mode="modal" fallbackRedirectUrl="/collections">
							<button className={styles.button}>{signInLabel}</button>
						</SignInButton>
					) : null}
					<SignUpButton mode="modal" fallbackRedirectUrl="/collections">
						<button className={`${styles.button} ${styles.buttonPrimary}`}>
							{signUpLabel}
						</button>
					</SignUpButton>
				</div>
			</SignedOut>
			<SignedIn>
				<Link
					href="/collections"
					className={`${styles.button} ${styles.buttonPrimary}`}
				>
					{signedInLabel}
				</Link>
			</SignedIn>
		</>
	);
}

export function LandingAuthButtons(props: LandingAuthButtonsProps) {
	return (
		<Suspense fallback={<AuthButtonsFallback />}>
			<LandingAuthButtonsInner {...props} />
		</Suspense>
	);
}
