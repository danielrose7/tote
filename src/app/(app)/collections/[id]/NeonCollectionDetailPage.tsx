"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "../../../../components/Header";
import type { CollectionNode } from "../../../../db/schema";
import { fetchCollectionDetail } from "../../../../lib/collections/client";
import { roleCan } from "../../../../lib/collections/permissions";
import { collectionQueryKeys } from "../../../../lib/collections/queryKeys";
import styles from "./NeonCollectionDetailPage.module.css";
import { NeonCreateNodeDialog } from "./NeonCreateNodeDialog";
import { NeonEditCollectionDialog } from "./NeonEditCollectionDialog";

type NodeProperties = {
	url?: string;
	imageUrl?: string;
	description?: string;
	price?: string | number;
	body?: string;
};

function propertiesFor(node: CollectionNode): NodeProperties {
	return node.properties as NodeProperties;
}

function ItemNode({ node }: { node: CollectionNode }) {
	const properties = propertiesFor(node);
	const title = node.title || (node.type === "photo" ? "Photo" : "Untitled");
	const content = (
		<>
			{properties.imageUrl && (
				<div className={styles.itemImage}>
					<img src={properties.imageUrl} alt="" />
				</div>
			)}
			<div className={styles.itemContent}>
				<div className={styles.itemHeading}>
					<span className={styles.typeBadge}>{node.type}</span>
					<h3>{title}</h3>
				</div>
				{properties.description && <p>{properties.description}</p>}
				{properties.body && <p>{properties.body}</p>}
				{properties.price !== undefined && properties.price !== null && (
					<span className={styles.price}>{String(properties.price)}</span>
				)}
			</div>
		</>
	);

	return properties.url ? (
		<a
			className={styles.itemCard}
			href={properties.url}
			target="_blank"
			rel="noopener noreferrer"
		>
			{content}
		</a>
	) : (
		<article className={styles.itemCard}>{content}</article>
	);
}

export function NeonCollectionDetailPage({
	collectionId,
}: {
	collectionId: string;
}) {
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isCreateNodeOpen, setIsCreateNodeOpen] = useState(false);
	const { data: detail } = useQuery({
		queryKey: collectionQueryKeys.detail(collectionId),
		queryFn: () => fetchCollectionDetail(collectionId),
	});
	if (!detail) {
		return null;
	}

	const { collection, nodes, role } = detail;
	const sections = nodes.filter((node) => node.type === "section");
	const rootNodes = nodes.filter(
		(node) => node.type !== "section" && node.parentId === null,
	);
	const childrenByParent = new Map<string, CollectionNode[]>();

	for (const node of nodes) {
		if (!node.parentId) continue;
		const children = childrenByParent.get(node.parentId) ?? [];
		children.push(node);
		childrenByParent.set(node.parentId, children);
	}

	return (
		<>
			<Header
				breadcrumbs={[
					{ label: "Collections", href: "/collections" },
					{ label: collection.name },
				]}
			/>
			<main className={styles.page}>
				<header className={styles.collectionHeader}>
					<div
						className={styles.colorIndicator}
						style={{
							backgroundColor: collection.color || "var(--color-accent)",
						}}
					/>
					<div>
						<div className={styles.titleRow}>
							<h1>{collection.name}</h1>
							<span className={styles.roleBadge}>{role}</span>
							{roleCan(role, "edit") && (
								<>
									<button
										type="button"
										className={styles.primaryButton}
										onClick={() => setIsCreateNodeOpen(true)}
									>
										Add Content
									</button>
									<button
										type="button"
										className={styles.editButton}
										onClick={() => setIsEditOpen(true)}
									>
										Edit
									</button>
								</>
							)}
						</div>
						{collection.description && <p>{collection.description}</p>}
						<div className={styles.meta}>
							<span>
								{collection.itemCount}{" "}
								{collection.itemCount === 1 ? "item" : "items"}
							</span>
							<span>Version {collection.version}</span>
						</div>
					</div>
				</header>

				{rootNodes.length > 0 && (
					<section className={styles.section}>
						<div className={styles.grid}>
							{rootNodes.map((node) => (
								<ItemNode key={node.id} node={node} />
							))}
						</div>
					</section>
				)}

				{sections.map((section) => {
					const children = childrenByParent.get(section.id) ?? [];
					return (
						<section key={section.id} className={styles.section}>
							<div className={styles.sectionHeader}>
								<h2>{section.title || "Untitled section"}</h2>
								<span>
									{children.length} {children.length === 1 ? "item" : "items"}
								</span>
							</div>
							{children.length > 0 ? (
								<div className={styles.grid}>
									{children.map((node) => (
										<ItemNode key={node.id} node={node} />
									))}
								</div>
							) : (
								<p className={styles.emptySection}>This section is empty.</p>
							)}
						</section>
					);
				})}

				{nodes.length === 0 && (
					<div className={styles.emptyCollection}>
						<h2>This collection is empty</h2>
						<p>Items added to the Neon collection will appear here.</p>
					</div>
				)}
			</main>
			{roleCan(role, "edit") && (
				<>
					<NeonCreateNodeDialog
						detail={detail}
						open={isCreateNodeOpen}
						onOpenChange={setIsCreateNodeOpen}
					/>
					<NeonEditCollectionDialog
						detail={detail}
						open={isEditOpen}
						onOpenChange={setIsEditOpen}
					/>
				</>
			)}
		</>
	);
}
