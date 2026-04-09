"use client";

import { useAccount } from "jazz-tools/react";
import { JazzAccount } from "../../../schema";
import styles from "./curate.module.css";

// claude-sonnet-4-6: $3/1M input, $15/1M output
function formatCost(inputTokens: number, outputTokens: number): string {
	const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
	return cost < 0.01 ? "<$0.01" : `~$${cost.toFixed(2)}`;
}

const phaseLabel: Record<string, string> = {
	interview: "Interview",
	started: "Starting",
	planning: "Planning",
	extracting: "Extracting",
	curating: "Curating",
	complete: "Complete",
	error: "Error",
};

export function CurateHistoryClient() {
	const me = useAccount(JazzAccount, {
		resolve: { root: { curatorSessions: true } },
	});

	const sessions =
		me.root?.curatorSessions?.$isLoaded
			? [...me.root.curatorSessions]
					.filter((s): s is NonNullable<typeof s> => s != null && !!s.createdAt)
					.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			: [];

	return (
		<main className={styles.main}>
			<div className={styles.container}>
				<div className={styles.historyHeader}>
					<h1 className={styles.heading}>Curations</h1>
					<a href="/curate/new" className={styles.primaryButton}>
						New curation
					</a>
				</div>

				{sessions.length === 0 ? (
					<p className={styles.subheading}>
						No sessions yet.{" "}
						<a href="/curate/new" className={styles.inlineLink}>
							Start your first curation
						</a>
						.
					</p>
				) : (
					<ul className={styles.sessionList}>
						{sessions.map((s) => (
							<li key={s.sessionId} className={styles.sessionItem}>
								<a href={`/curate/${s.sessionId}`} className={styles.sessionLink}>
									<span className={styles.sessionTopic}>{s.title ?? s.topic}</span>
									<span className={`${styles.sessionPhase} ${styles[`phase_${s.phase}`]}`}>
										{phaseLabel[s.phase] ?? s.phase}
									</span>
								</a>
								<span className={styles.sessionDate}>
									{s.createdAt?.toLocaleDateString()}
									{s.inputTokens != null && s.outputTokens != null && (
										<span
											className={styles.sessionCost}
											title={`${s.inputTokens.toLocaleString()} in / ${s.outputTokens.toLocaleString()} out`}
										>
											{formatCost(s.inputTokens, s.outputTokens)}
										</span>
									)}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</main>
	);
}
