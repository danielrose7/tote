"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "jazz-tools/react";
import Link from "next/link";
import { useState } from "react";
import cardStyles from "../../../components/CollectionCard/CollectionCard.module.css";
import listStyles from "../../../components/CollectionList/CollectionList.module.css";
import { Header } from "../../../components/Header";
import { getWaitingClassicSharedCollections } from "../../../lib/collections/classicSharedMigration";
import { fetchCollectionSummaries } from "../../../lib/collections/client";
import { collectionQueryKeys } from "../../../lib/collections/queryKeys";
import { JazzAccount } from "../../../schema";
import { NeonCreateCollectionDialog } from "./NeonCreateCollectionDialog";

export function NeonCollectionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const classicAccount = useAccount(JazzAccount, {
		resolve: { root: { sharedWithMe: { $each: {} } } },
	});
	const { data: collections = [] } = useQuery({
		queryKey: collectionQueryKeys.all,
		queryFn: fetchCollectionSummaries,
	});
	const waitingSharedCollections = getWaitingClassicSharedCollections(
		classicAccount.$isLoaded && classicAccount.root?.$isLoaded
			? classicAccount.root.sharedWithMe
			: null,
		collections,
	);
	const hasCollections =
		collections.length > 0 || waitingSharedCollections.length > 0;

	return (
		<>
			<Header
				showAddCollection
				onAddCollectionClick={() => setIsCreateOpen(true)}
			/>
			<main>
				<div className={listStyles.container}>
					{!hasCollections ? (
						<div className={listStyles.empty}>
							<h2 className={listStyles.emptyTitle}>No collections yet</h2>
							<p className={listStyles.emptyDescription}>
								Your Neon collections will appear here.
							</p>
						</div>
					) : (
						<>
							{collections.length > 0 && (
								<div className={listStyles.grid}>
									{collections.map((collection) => (
										<Link
											key={collection.id}
											href={`/collections/${collection.id}`}
											className={cardStyles.card}
											style={
												{
													"--collection-color":
														collection.color || "var(--color-accent)",
													textDecoration: "none",
												} as React.CSSProperties
											}
										>
											<div className={cardStyles.previewContainer}>
												<div className={cardStyles.previewPlaceholder}>
													<svg
														className={cardStyles.placeholderIcon}
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
														aria-hidden="true"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
														/>
													</svg>
												</div>
												<div className={cardStyles.countBadge}>
													<span>
														{collection.itemCount}{" "}
														{collection.itemCount === 1 ? "item" : "items"}
													</span>
												</div>
											</div>
											<div className={cardStyles.content}>
												<div className={cardStyles.header}>
													<h3 className={cardStyles.title}>
														{collection.name}
													</h3>
												</div>
												{collection.description && (
													<p className={cardStyles.description}>
														{collection.description}
													</p>
												)}
												{collection.role !== "owner" && (
													<span className={listStyles.sharedBadge}>
														Shared · {collection.role}
													</span>
												)}
											</div>
										</Link>
									))}
								</div>
							)}
							{waitingSharedCollections.length > 0 && (
								<section className={listStyles.sharedSection}>
									<h2 className={listStyles.sectionTitle}>
										Waiting for owner migration
									</h2>
									<p className={listStyles.waitingDescription}>
										These shared collections remain in Classic Jazz until their
										owners migrate them.
									</p>
									<div className={listStyles.grid}>
										{waitingSharedCollections.map((collection) => (
											<div
												key={collection.collectionId}
												className={listStyles.waitingCard}
											>
												<h3>{collection.name || "Shared collection"}</h3>
												<span className={listStyles.sharedBadge}>
													Shared · {collection.role}
												</span>
												<p>Waiting for the owner to migrate this collection.</p>
											</div>
										))}
									</div>
								</section>
							)}
						</>
					)}
				</div>
			</main>
			<NeonCreateCollectionDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
			/>
		</>
	);
}
