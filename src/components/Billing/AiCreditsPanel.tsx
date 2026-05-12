"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./AiCreditsPanel.module.css";

const PACKS = [
	{
		priceId: "price_1TKn8dIRyPXUFa52ClYqRPKI",
		label: "Starter",
		amount: "$5",
		description: "Adds $5 AI credits",
	},
	{
		priceId: "price_1TKn8fIRyPXUFa52XCsjtETI",
		label: "Standard",
		amount: "$10",
		description: "Adds $10 AI credits",
	},
	{
		priceId: "price_1TKn8gIRyPXUFa52q6XX47mt",
		label: "Pro",
		amount: "$25",
		description: "Adds $25 AI credits",
	},
] as const;

type CreditTransaction = {
	id: number;
	amountCents: number;
	type: "free_grant" | "purchase" | "deduction";
	feature: string;
	referenceId: string | null;
	stepLabel: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	webSearchRequests: number | null;
	urlCount: number | null;
	candidateCount: number | null;
	durationMs: number | null;
	codeExecutionCount: number | null;
	cfCount: number | null;
	geminiCount: number | null;
	failedCount: number | null;
	provider: string | null;
	model: string | null;
	balanceAfterCents: number | null;
	createdAt: string;
};

interface AiCreditsPanelProps {
	onBalanceLoaded?: (cents: number) => void;
	returnPath?: string;
	showTransactions?: boolean;
}

function formatCurrency(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

function formatSignedCurrency(cents: number): string {
	const sign = cents > 0 ? "+" : "";
	return `${sign}${formatCurrency(cents)}`;
}

function transactionTitle(transaction: CreditTransaction): string {
	if (transaction.type === "purchase") return "Credit purchase";
	if (transaction.type === "free_grant") return "Credit grant";
	if (transaction.feature === "chat") return "Chat";
	return "Curator";
}

function transactionDetails(transaction: CreditTransaction): string {
	const details: string[] = [];
	const tokens =
		(transaction.inputTokens ?? 0) + (transaction.outputTokens ?? 0);
	if (tokens > 0) {
		details.push(`${tokens.toLocaleString()} tokens`);
	}
	if ((transaction.webSearchRequests ?? 0) > 0) {
		details.push(`${transaction.webSearchRequests} searches`);
	}
	if ((transaction.cfCount ?? 0) > 0) {
		details.push(`${transaction.cfCount} browser sessions`);
	}
	if (transaction.model) {
		details.push(transaction.model);
	}
	if (transaction.balanceAfterCents !== null) {
		details.push(`balance ${formatCurrency(transaction.balanceAfterCents)}`);
	}
	return details.join(" / ");
}

export function AiCreditsPanel({
	onBalanceLoaded,
	returnPath = "/settings",
	showTransactions = true,
}: AiCreditsPanelProps) {
	const [balanceCents, setBalanceCents] = useState<number | null>(null);
	const [transactions, setTransactions] = useState<CreditTransaction[] | null>(
		null,
	);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState<string | null>(null);

	const fetchBalance = useCallback(async () => {
		try {
			const res = await fetch("/api/billing/credits");
			if (!res.ok) return;
			const { balanceCents: nextBalance } = await res.json();
			setBalanceCents(nextBalance);
			onBalanceLoaded?.(nextBalance);
		} catch {
			// Balance is non-critical UI; chat/curator requests still enforce it server-side.
		}
	}, [onBalanceLoaded]);

	const fetchTransactions = useCallback(async () => {
		if (!showTransactions) return;
		try {
			const res = await fetch("/api/billing/transactions?limit=12");
			if (!res.ok) return;
			const { transactions: nextTransactions } = await res.json();
			setTransactions(nextTransactions);
		} catch {
			setTransactions([]);
		}
	}, [showTransactions]);

	useEffect(() => {
		fetchBalance();
		fetchTransactions();
	}, [fetchBalance, fetchTransactions]);

	async function handleBuy(priceId: string) {
		setLoading(priceId);
		try {
			const res = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ priceId, returnPath }),
			});
			if (res.ok) {
				const { url } = await res.json();
				window.location.href = url;
				return;
			}
		} catch {
			// Fall through to reset loading.
		}
		setLoading(null);
	}

	const isLow = balanceCents !== null && balanceCents < 50;
	const isEmpty = balanceCents !== null && balanceCents <= 0;

	return (
		<section className={styles.panel} aria-label="AI credits">
			<div className={styles.header}>
				<div>
					<h2 className={styles.title}>AI credits</h2>
					<p className={styles.subtitle}>
						Pass-through model and search costs.
					</p>
				</div>
				<span className={`${styles.balance} ${isLow ? styles.balanceLow : ""}`}>
					{balanceCents === null
						? "Loading..."
						: isEmpty
							? "No credits"
							: formatCurrency(balanceCents)}
				</span>
			</div>

			<div className={styles.actions}>
				<button
					type="button"
					className={styles.toggleButton}
					onClick={() => setOpen((current) => !current)}
				>
					{open ? "Cancel" : "Add credits"}
				</button>
			</div>

			{open && (
				<div className={styles.packs}>
					{PACKS.map((pack) => (
						<button
							key={pack.priceId}
							type="button"
							className={styles.pack}
							onClick={() => handleBuy(pack.priceId)}
							disabled={loading !== null}
						>
							<span className={styles.packLabel}>{pack.label}</span>
							<span className={styles.packAmount}>{pack.amount}</span>
							<span className={styles.packDescription}>{pack.description}</span>
							{loading === pack.priceId && (
								<span className={styles.packLoading}>Redirecting...</span>
							)}
						</button>
					))}
				</div>
			)}

			{showTransactions && (
				<div className={styles.transactions}>
					<div className={styles.transactionsHeader}>
						<h3 className={styles.transactionsTitle}>Recent activity</h3>
						<button
							type="button"
							className={styles.refreshButton}
							onClick={() => {
								fetchBalance();
								fetchTransactions();
							}}
						>
							Refresh
						</button>
					</div>

					{transactions === null ? (
						<p className={styles.emptyState}>Loading activity...</p>
					) : transactions.length === 0 ? (
						<p className={styles.emptyState}>No credit activity yet.</p>
					) : (
						<ul className={styles.transactionList}>
							{transactions.map((transaction) => {
								const details = transactionDetails(transaction);
								return (
									<li key={transaction.id} className={styles.transactionItem}>
										<div className={styles.transactionMain}>
											<span className={styles.transactionTitle}>
												{transactionTitle(transaction)}
											</span>
											<span className={styles.transactionDate}>
												{new Date(transaction.createdAt).toLocaleString()}
											</span>
											{details && (
												<span className={styles.transactionDetails}>
													{details}
												</span>
											)}
										</div>
										<span
											className={
												transaction.amountCents < 0
													? styles.transactionNegative
													: styles.transactionPositive
											}
										>
											{formatSignedCurrency(transaction.amountCents)}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			)}
		</section>
	);
}
