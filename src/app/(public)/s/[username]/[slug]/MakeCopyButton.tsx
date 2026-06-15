"use client";

import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import styles from "../../../view/[id]/page.module.css";

function CopyIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

export function MakeCopyButton({ neonId }: { neonId: string }) {
	const cloneHref = `/clone/${neonId}`;
	return (
		<>
			<SignedIn>
				<Link href={cloneHref} className={styles.headerActionButton}>
					<CopyIcon />
					<span>Save a copy</span>
				</Link>
			</SignedIn>
			<SignedOut>
				<SignUpButton mode="modal" fallbackRedirectUrl={cloneHref}>
					<button type="button" className={styles.headerActionButton}>
						<CopyIcon />
						<span>Save a copy</span>
					</button>
				</SignUpButton>
			</SignedOut>
		</>
	);
}
