"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./curate.module.css";

const PACKS = [
	{
		priceId: "price_1TKn8dIRyPXUFa52ClYqRPKI",
		label: "Starter",
		amount: "$5",
		cents: 500,
		description: "~25 curator runs",
	},
	{
		priceId: "price_1TKn8fIRyPXUFa52XCsjtETI",
		label: "Standard",
		amount: "$10",
		cents: 1000,
		description: "~50 curator runs",
	},
	{
		priceId: "price_1TKn8gIRyPXUFa52q6XX47mt",
		label: "Pro",
		amount: "$25",
		cents: 2500,
		description: "~125 curator runs",
	},
] as const;

function formatBalance(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

interface CreditsPanelProps {
	onBalanceLoaded?: (cents: number) => void;
}

export function CreditsPanel({ onBalanceLoaded }: CreditsPanelProps) {
	const [balanceCents, setBalanceCents] = useState<number | null>(null);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState<string | null>(null);

	const fetchBalance = useCallback(async () => {
		try {
			const res = await fetch("/api/billing/credits");
			if (res.ok) {
				const { balanceCents: b } = await res.json();
				setBalanceCents(b);
				onBalanceLoaded?.(b);
			}
		} catch {
			// ignore
		}
	}, [onBalanceLoaded]);

	useEffect(() => {
		fetchBalance();
	}, [fetchBalance]);

	async function handleBuy(priceId: string) {
		setLoading(priceId);
		try {
			const res = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ priceId }),
			});
			if (res.ok) {
				const { url } = await res.json();
				window.location.href = url;
			}
		} catch {
			setLoading(null);
		}
	}

	const isLow = balanceCents !== null && balanceCents < 50;
	const isEmpty = balanceCents !== null && balanceCents <= 0;

	return (
		<div className={styles.creditsPanel}>
			<div className={styles.creditsRow}>
				<span
					className={`${styles.creditsBalance} ${isLow ? styles.creditsBalanceLow : ""}`}
				>
					{balanceCents === null
						? "Loading..."
						: isEmpty
							? "No credits remaining"
							: `${formatBalance(balanceCents)} credit remaining`}
				</span>
				<button
					type="button"
					className={styles.creditsToggle}
					onClick={() => setOpen((o) => !o)}
				>
					{open ? "Cancel" : "Add credits"}
				</button>
			</div>

			{open && (
				<div className={styles.creditsPacks}>
					{PACKS.map((pack) => (
						<button
							key={pack.priceId}
							type="button"
							className={styles.creditsPack}
							onClick={() => handleBuy(pack.priceId)}
							disabled={loading !== null}
						>
							<span className={styles.creditsPackLabel}>{pack.label}</span>
							<span className={styles.creditsPackAmount}>{pack.amount}</span>
							<span className={styles.creditsPackDesc}>{pack.description}</span>
							{loading === pack.priceId && (
								<span className={styles.creditsPackLoading}>
									Redirecting...
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
