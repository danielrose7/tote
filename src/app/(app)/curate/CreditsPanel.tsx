"use client";

import { AiCreditsPanel } from "@/components/Billing/AiCreditsPanel";

interface CreditsPanelProps {
	onBalanceLoaded?: (cents: number) => void;
}

export function CreditsPanel({ onBalanceLoaded }: CreditsPanelProps) {
	return (
		<AiCreditsPanel
			onBalanceLoaded={onBalanceLoaded}
			returnPath="/curate"
			showTransactions={false}
		/>
	);
}
