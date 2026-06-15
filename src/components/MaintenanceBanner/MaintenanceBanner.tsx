"use client";

import { useState } from "react";
import styles from "./MaintenanceBanner.module.css";

const EXPIRES = new Date("2026-07-01");
const DISMISSED_KEY = "maintenance-banner-jun-2026-dismissed";

export function MaintenanceBanner() {
	const [dismissed, setDismissed] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(DISMISSED_KEY) === "1";
	});

	if (Date.now() >= EXPIRES.getTime()) return null;
	if (dismissed) return null;

	return (
		<div className={styles.banner}>
			<div className={styles.content}>
				<span>
					We&rsquo;re doing database maintenance through the end of June in
					preparation for the launch of our iOS app. Thanks for your patience.
				</span>
				<button
					type="button"
					onClick={() => {
						localStorage.setItem(DISMISSED_KEY, "1");
						setDismissed(true);
					}}
				>
					Dismiss
				</button>
			</div>
		</div>
	);
}
